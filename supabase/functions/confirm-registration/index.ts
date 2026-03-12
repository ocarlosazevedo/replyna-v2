/**
 * Edge Function: Confirm Registration
 *
 * Chamada apos o usuario completar o checkout do Asaas.
 * Cria a conta no Auth + tabela users + subscription no banco.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';
import { getSubscription } from '../_shared/asaas.ts';

interface ConfirmRegistrationRequest {
  email: string;
  name: string;
  whatsapp_number?: string;
  plan_id: string;
  asaas_customer_id: string;
  asaas_subscription_id?: string;
  asaas_credit_card_token?: string;
  coupon_id?: string;
  discount_applied?: number;
  partner_id?: string;
  is_trial?: boolean;
}

function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ConfirmRegistrationRequest;
    const {
      email,
      name,
      whatsapp_number,
      plan_id,
      asaas_customer_id,
      asaas_subscription_id,
      asaas_credit_card_token,
      coupon_id,
      discount_applied,
      partner_id,
      is_trial,
    } = body;

    if (!email || !plan_id || !asaas_customer_id) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatorios: email, plan_id, asaas_customer_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.toLowerCase();
    const supabase = getSupabaseAdmin();

    // Verificar assinatura no Asaas se fornecida (pago, nao trial)
    if (asaas_subscription_id) {
      try {
        await getSubscription(asaas_subscription_id);
      } catch {
        return new Response(
          JSON.stringify({ error: 'Assinatura nao encontrada no Asaas' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Verificar se usuario ja existe (evitar duplicatas se chamado 2x)
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .limit(1);

    if (existingUser && existingUser.length > 0) {
      // Usuario ja existe - atualizar dados do Asaas que possam estar faltando
      const existingId = existingUser[0].id;
      const updateData: Record<string, unknown> = {};
      if (asaas_customer_id) updateData.asaas_customer_id = asaas_customer_id;
      if (asaas_credit_card_token) updateData.asaas_credit_card_token = asaas_credit_card_token;
      if (is_trial !== undefined) updateData.is_trial = is_trial;
      if (whatsapp_number) updateData.whatsapp_number = whatsapp_number;
      if (name) updateData.name = name;

      if (Object.keys(updateData).length > 0) {
        await supabase.from('users').update(updateData).eq('id', existingId);
        console.log(`[ConfirmRegistration] Usuario existente atualizado com dados Asaas: ${existingId}`);
      }

      // Gerar magic link
      const { data: linkData } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: normalizedEmail,
        options: {
          redirectTo: `${origin || 'https://app.replyna.me'}/dashboard`,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          already_exists: true,
          magic_link: linkData?.properties?.action_link || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar usuario no Auth
    const tempPassword = crypto.randomUUID().slice(0, 12) + 'Aa1!';
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name: name || '' },
    });

    if (authError) {
      const message = authError.message?.toLowerCase() || '';
      if (message.includes('already') || message.includes('exists') || message.includes('registered')) {
        // Auth user exists but not in users table - generate magic link
        const { data: linkData } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: normalizedEmail,
          options: {
            redirectTo: `${origin || 'https://app.replyna.me'}/dashboard`,
          },
        });

        return new Response(
          JSON.stringify({
            success: true,
            already_exists: true,
            magic_link: linkData?.properties?.action_link || null,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Erro ao criar usuario: ${authError.message}`);
    }

    const userId = authData?.user?.id;
    if (!userId) {
      throw new Error('Erro ao criar usuario: ID ausente');
    }

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Buscar dados do plano para definir limites corretos
    const { data: planData } = await supabase
      .from('plans')
      .select('name, emails_limit, shops_limit')
      .eq('id', plan_id)
      .single();

    // Determinar se eh trial ou pago
    const userIsTrial = is_trial === true;

    // Insert na tabela users com dados corretos do plano
    await supabase.from('users').insert({
      id: userId,
      email: normalizedEmail,
      name: name || null,
      plan: userIsTrial ? 'Free Trial' : (planData?.name || 'Starter'),
      emails_limit: userIsTrial ? 30 : (planData?.emails_limit ?? 30),
      shops_limit: userIsTrial ? 1 : (planData?.shops_limit ?? 1),
      emails_used: 0,
      extra_emails_purchased: 0,
      extra_emails_used: 0,
      pending_extra_emails: 0,
      asaas_customer_id,
      asaas_credit_card_token: asaas_credit_card_token || null,
      status: 'active',
      is_trial: userIsTrial,
      trial_started_at: userIsTrial ? now.toISOString() : null,
      trial_ends_at: userIsTrial ? trialEndsAt.toISOString() : null,
      whatsapp_number: whatsapp_number || null,
      updated_at: now.toISOString(),
    });

    // Criar subscription no banco (apenas se tem assinatura no Asaas)
    if (asaas_subscription_id) {
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 30);

      await supabase.from('subscriptions').insert({
        user_id: userId,
        plan_id,
        asaas_customer_id,
        asaas_subscription_id,
        status: userIsTrial ? 'trialing' : 'active',
        billing_cycle: 'monthly',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        coupon_id: coupon_id || null,
      });

      // Aplicar cupom se houver
      if (coupon_id && discount_applied) {
        await supabase.rpc('use_coupon', {
          p_coupon_id: coupon_id,
          p_user_id: userId,
          p_discount_applied: discount_applied,
          p_subscription_id: asaas_subscription_id,
        });
      }
    }

    // Criar vínculo de referral se veio de um partner
    if (partner_id) {
      try {
        await supabase.from('partner_referrals').insert({
          partner_id,
          referred_user_id: userId,
        });

        // Incrementar total_referrals do partner
        const { data: currentPartner } = await supabase
          .from('partners')
          .select('total_referrals')
          .eq('id', partner_id)
          .single();

        if (currentPartner) {
          await supabase
            .from('partners')
            .update({
              total_referrals: (currentPartner.total_referrals || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', partner_id);
        }

        console.log(`[ConfirmRegistration] Partner referral created: partner=${partner_id}, user=${userId}`);
      } catch (refError) {
        // Não falhar o registro por erro no referral
        console.error('[ConfirmRegistration] Error creating partner referral:', refError);
      }
    }

    // Gerar magic link para login automatico
    const { data: linkData } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
      options: {
        redirectTo: `${origin || 'https://app.replyna.me'}/dashboard`,
      },
    });
    const magicLink = linkData?.properties?.action_link || null;

    console.log(`[ConfirmRegistration] User created: ${userId}, trial: ${is_trial}`);

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        magic_link: magicLink,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao confirmar registro:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
