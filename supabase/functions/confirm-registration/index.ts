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
  stage?: 'pending' | 'address' | 'finalize';
  user_id?: string;
  email?: string;
  name?: string;
  whatsapp_number?: string;
  cpf_cnpj?: string;
  password?: string;
  plan_id?: string;
  asaas_customer_id?: string;
  asaas_subscription_id?: string;
  asaas_credit_card_token?: string;
  coupon_id?: string;
  discount_applied?: number;
  partner_id?: string;
  is_trial?: boolean;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
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
      stage,
      user_id,
      email,
      name,
      whatsapp_number,
      cpf_cnpj,
      password,
      plan_id,
      asaas_customer_id,
      asaas_subscription_id,
      asaas_credit_card_token,
      coupon_id,
      discount_applied,
      partner_id,
      is_trial,
      cep,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      estado,
    } = body;

    const supabase = getSupabaseAdmin();
    const currentStage = stage || 'finalize';
    const normalizedEmail = email ? email.toLowerCase() : '';
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (currentStage === 'address') {
      if (!user_id && !normalizedEmail) {
        return new Response(
          JSON.stringify({ error: 'Campos obrigatorios: user_id ou email' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let targetUserId = user_id || null;
      if (!targetUserId) {
        const { data: userByEmail } = await supabase
          .from('users')
          .select('id')
          .eq('email', normalizedEmail)
          .limit(1);
        targetUserId = userByEmail?.[0]?.id || null;
      }

      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: 'Usuario nao encontrado para atualizar endereco' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const addressUpdate: Record<string, unknown> = {
        cep,
        logradouro,
        numero,
        complemento,
        bairro,
        cidade,
        estado,
        updated_at: now.toISOString(),
      };

      Object.keys(addressUpdate).forEach((key) => {
        if (addressUpdate[key] === undefined) delete addressUpdate[key];
      });

      await supabase.from('users').update(addressUpdate).eq('id', targetUserId);

      return new Response(
        JSON.stringify({ success: true, user_id: targetUserId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (currentStage === 'pending') {
      if (!normalizedEmail || !plan_id) {
        return new Response(
          JSON.stringify({ error: 'Campos obrigatorios: email, plan_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: planData, error: planError } = await supabase
        .from('plans')
        .select('name, slug, emails_limit, shops_limit')
        .eq('id', plan_id)
        .single();

      if (planError || !planData) {
        return new Response(
          JSON.stringify({ error: 'Plano nao encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const userIsTrial = is_trial === true;

      const { data: existingUser } = await supabase
        .from('users')
        .select('id, status')
        .eq('email', normalizedEmail)
        .limit(1);

      if (existingUser && existingUser.length > 0) {
        const existing = existingUser[0];
        if (existing.status === 'active' || existing.status === 'suspended') {
          return new Response(
            JSON.stringify({ error: 'Este email ja possui uma conta ativa. Faca login ou use outro email.' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateData: Record<string, unknown> = {
          name: name || null,
          whatsapp_number: whatsapp_number || null,
          cpf_cnpj: cpf_cnpj || null,
          plan: userIsTrial ? 'trial' : (planData?.slug || 'starter'),
          is_trial: userIsTrial,
          status: 'pending',
          updated_at: now.toISOString(),
        };

        await supabase.from('users').update(updateData).eq('id', existing.id);

        return new Response(
          JSON.stringify({ success: true, user_id: existing.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let authUserId: string | null = null;
      const tempPassword = crypto.randomUUID().slice(0, 12) + 'Aa1!';
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password: password || tempPassword,
        email_confirm: true,
        user_metadata: { name: name || '' },
      });

      if (authError) {
        const message = authError.message?.toLowerCase() || '';
        if (message.includes('already') || message.includes('exists') || message.includes('registered')) {
          const { data: linkData } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: normalizedEmail,
            options: {
              redirectTo: `${origin || 'https://app.replyna.me'}/dashboard`,
            },
          });
          authUserId = linkData?.user?.id || null;
        } else {
          throw new Error(`Erro ao criar usuario: ${authError.message}`);
        }
      } else {
        authUserId = authData?.user?.id || null;
      }

      if (!authUserId) {
        throw new Error('Erro ao criar usuario: ID ausente');
      }

      await supabase.from('users').insert({
        id: authUserId,
        email: normalizedEmail,
        name: name || null,
        plan: userIsTrial ? 'trial' : (planData?.slug || 'starter'),
        emails_limit: userIsTrial ? 30 : (planData?.emails_limit ?? 30),
        shops_limit: userIsTrial ? 1 : (planData?.shops_limit ?? 1),
        emails_used: 0,
        extra_emails_purchased: 0,
        extra_emails_used: 0,
        pending_extra_emails: 0,
        asaas_customer_id: null,
        asaas_credit_card_token: null,
        status: 'pending',
        is_trial: userIsTrial,
        trial_started_at: userIsTrial ? now.toISOString() : null,
        trial_ends_at: userIsTrial ? trialEndsAt.toISOString() : null,
        whatsapp_number: whatsapp_number || null,
        cpf_cnpj: cpf_cnpj || null,
        updated_at: now.toISOString(),
      });

      return new Response(
        JSON.stringify({ success: true, user_id: authUserId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === FINALIZE (default) ===
    if (!normalizedEmail || !plan_id || !asaas_customer_id) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatorios: email, plan_id, asaas_customer_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const { data: planData } = await supabase
      .from('plans')
      .select('name, slug, emails_limit, shops_limit')
      .eq('id', plan_id)
      .single();

    const userIsTrial = is_trial === true;

    let targetUserId = user_id || null;
    if (!targetUserId) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', normalizedEmail)
        .limit(1);
      targetUserId = existingUser?.[0]?.id || null;
    }

    if (!targetUserId) {
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
          const { data: linkData } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: normalizedEmail,
            options: {
              redirectTo: `${origin || 'https://app.replyna.me'}/dashboard`,
            },
          });
          targetUserId = linkData?.user?.id || null;
        } else {
          throw new Error(`Erro ao criar usuario: ${authError.message}`);
        }
      } else {
        targetUserId = authData?.user?.id || null;
      }
    }

    if (!targetUserId) {
      throw new Error('Erro ao criar usuario: ID ausente');
    }

    const updateData: Record<string, unknown> = {
      email: normalizedEmail,
      name: name || null,
      whatsapp_number: whatsapp_number || null,
      cpf_cnpj: cpf_cnpj || null,
      plan: userIsTrial ? 'trial' : (planData?.slug || 'starter'),
      emails_limit: userIsTrial ? 30 : (planData?.emails_limit ?? 30),
      shops_limit: userIsTrial ? 1 : (planData?.shops_limit ?? 1),
      asaas_customer_id,
      asaas_credit_card_token: asaas_credit_card_token || null,
      status: 'active',
      is_trial: userIsTrial,
      trial_started_at: userIsTrial ? now.toISOString() : null,
      trial_ends_at: userIsTrial ? trialEndsAt.toISOString() : null,
      updated_at: now.toISOString(),
    };

    const { data: existingFinalUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', targetUserId)
      .limit(1);

    if (existingFinalUser && existingFinalUser.length > 0) {
      await supabase.from('users').update(updateData).eq('id', targetUserId);
    } else {
      await supabase.from('users').insert({
        id: targetUserId,
        ...updateData,
        emails_used: 0,
        extra_emails_purchased: 0,
        extra_emails_used: 0,
        pending_extra_emails: 0,
      });
    }

    if (asaas_subscription_id) {
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('asaas_subscription_id', asaas_subscription_id)
        .limit(1);

      if (!existingSub || existingSub.length === 0) {
        const periodEnd = new Date(now);
        periodEnd.setDate(periodEnd.getDate() + 30);

        await supabase.from('subscriptions').insert({
          user_id: targetUserId,
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

        if (coupon_id && discount_applied) {
          await supabase.rpc('use_coupon', {
            p_coupon_id: coupon_id,
            p_user_id: targetUserId,
            p_discount_applied: discount_applied,
            p_subscription_id: asaas_subscription_id,
          });
        }
      } else {
        console.log(`[ConfirmRegistration] Subscription ja existe: ${asaas_subscription_id}`);
      }
    }

    // Criar vínculo de referral se veio de um partner
    if (partner_id) {
      try {
        await supabase.from('partner_referrals').insert({
          partner_id,
          referred_user_id: targetUserId,
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

        console.log(`[ConfirmRegistration] Partner referral created: partner=${partner_id}, user=${targetUserId}`);
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

    console.log(`[ConfirmRegistration] User created: ${targetUserId}, trial: ${is_trial}`);

    return new Response(
      JSON.stringify({
        success: true,
        user_id: targetUserId,
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
