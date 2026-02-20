/**
 * Edge Function: Accept Migration Invite (Asaas)
 *
 * GET - valida convite
 * POST - cria assinatura no Asaas com nextDueDate futuro
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';
import { isValidEmail } from '../_shared/validation.ts';
import { createCustomer, getCustomerByEmail, createSubscription, getPaymentsBySubscription } from '../_shared/asaas.ts';

function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // GET - Validar codigo e retornar dados do convite
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const code = url.searchParams.get('code');

      if (!code) {
        return new Response(
          JSON.stringify({ error: 'Codigo do convite e obrigatorio' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: invite, error } = await supabase
        .from('migration_invites')
        .select(`*, plan:plans(id, name, price_monthly, shops_limit, emails_limit)`)
        .eq('code', code.toUpperCase())
        .single();

      if (error || !invite) {
        return new Response(
          JSON.stringify({ error: 'Convite nao encontrado', valid: false }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (invite.status !== 'pending') {
        return new Response(
          JSON.stringify({
            error: invite.status === 'accepted'
              ? 'Este convite ja foi utilizado'
              : invite.status === 'expired'
                ? 'Este convite expirou'
                : 'Este convite foi cancelado',
            valid: false,
            status: invite.status,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (new Date(invite.expires_at) < new Date()) {
        await supabase
          .from('migration_invites')
          .update({ status: 'expired' })
          .eq('id', invite.id);

        return new Response(
          JSON.stringify({ error: 'Este convite expirou', valid: false }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const billingDate = new Date(invite.billing_start_date);
      const todayUTC = new Date();
      const billingUTC = Date.UTC(billingDate.getUTCFullYear(), billingDate.getUTCMonth(), billingDate.getUTCDate());
      const nowUTC = Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate());
      const trialDays = Math.max(0, Math.floor((billingUTC - nowUTC) / (1000 * 60 * 60 * 24)));

      return new Response(
        JSON.stringify({
          valid: true,
          invite: {
            code: invite.code,
            customer_email: invite.customer_email,
            customer_name: invite.customer_name,
            plan: invite.plan,
            billing_start_date: invite.billing_start_date,
            trial_days: trialDays,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Aceitar convite e criar assinatura no Asaas
    if (req.method === 'POST') {
      const body = await req.json();
      const { code, user_email, user_name, whatsapp_number } = body;

      if (!code || !user_email) {
        return new Response(
          JSON.stringify({ error: 'Campos obrigatorios: code, user_email' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!isValidEmail(user_email)) {
        return new Response(
          JSON.stringify({ error: 'Email invalido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: invite, error: inviteError } = await supabase
        .from('migration_invites')
        .select(`*, plan:plans(*)`)
        .eq('code', code.toUpperCase())
        .eq('status', 'pending')
        .single();

      if (inviteError || !invite) {
        return new Response(
          JSON.stringify({ error: 'Convite nao encontrado ou ja utilizado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (new Date(invite.expires_at) < new Date()) {
        await supabase
          .from('migration_invites')
          .update({ status: 'expired' })
          .eq('id', invite.id);

        return new Response(
          JSON.stringify({ error: 'Este convite expirou' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const plan = invite.plan;
      if (!plan) {
        return new Response(
          JSON.stringify({ error: 'Plano do convite nao encontrado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Limpar telefone: remover +55, parênteses, espaços, traços
      const cleanPhone = (whatsapp_number || '')
        .replace(/^\+?55\s?/, '')
        .replace(/[\s\-\(\)]/g, '');

      // Criar/buscar customer Asaas
      let customer = await getCustomerByEmail(user_email);
      if (!customer) {
        customer = await createCustomer({
          name: user_name || invite.customer_name || user_email,
          email: user_email,
          mobilePhone: cleanPhone || undefined,
        });
      }

      const nextDueDate = formatDateYYYYMMDD(new Date(invite.billing_start_date));

      const subscription = await createSubscription({
        customer: customer.id,
        billingType: 'CREDIT_CARD',
        value: Number(plan.price_monthly || 0),
        cycle: 'MONTHLY',
        description: `Replyna - Plano ${plan.name} (migracao)`,
        nextDueDate,
      });

      const payments = await getPaymentsBySubscription(subscription.id, { limit: 1, order: 'desc' });
      const firstPayment = payments.data?.[0];
      const invoiceUrl = firstPayment?.invoiceUrl || null;

      // Criar ou obter usuario no Auth
      const { data: existingAuth, error: existingAuthError } = await supabase.auth.admin.listUsers({
        filter: { email: user_email },
      });
      if (existingAuthError) {
        throw new Error(`Erro ao buscar usuario no Auth: ${existingAuthError.message}`);
      }
      const existingUser = existingAuth?.users?.[0] || null;
      let userId = existingUser?.id || null;

      if (!userId) {
        const tempPassword = crypto.randomUUID().slice(0, 12) + 'Aa1!';
        const { data: newAuth, error: authError } = await supabase.auth.admin.createUser({
          email: user_email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { name: user_name || invite.customer_name || '' },
        });
        if (authError) {
          throw new Error(`Erro ao criar usuario no Auth: ${authError.message}`);
        }
        userId = newAuth.user.id;
      }

      // Upsert user
      await supabase
        .from('users')
        .upsert({
          id: userId,
          email: user_email.toLowerCase(),
          name: user_name || invite.customer_name || null,
          plan: plan.name,
          emails_limit: plan.emails_limit,
          shops_limit: plan.shops_limit,
          emails_used: 0,
          extra_emails_purchased: 0,
          extra_emails_used: 0,
          pending_extra_emails: 0,
          asaas_customer_id: customer.id,
          status: 'active',
          updated_at: new Date().toISOString(),
        });

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 30);

      await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          plan_id: plan.id,
          asaas_customer_id: customer.id,
          asaas_subscription_id: subscription.id,
          status: 'active',
          billing_cycle: 'monthly',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: false,
        });

      await supabase
        .from('migration_invites')
        .update({
          status: 'accepted',
          accepted_by_user_id: userId,
          accepted_at: now.toISOString(),
        })
        .eq('id', invite.id);

      try {
        await supabase.auth.admin.resetPasswordForEmail(user_email, {
          redirectTo: 'https://app.replyna.me/reset-password',
        });
      } catch (err) {
        console.error('Erro ao enviar reset de senha:', err);
      }

      return new Response(
        JSON.stringify({
          subscription_id: subscription.id,
          url: invoiceUrl,
          next_due_date: invite.billing_start_date,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Metodo nao permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
