/**
 * Edge Function: Accept Migration Invite
 *
 * Valida o código de convite e cria sessão de checkout com trial
 * até a data de início da cobrança.
 *
 * GET - Valida o código e retorna dados do convite
 * POST - Aceita o convite e cria checkout session
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import Stripe from 'https://esm.sh/stripe@20.2.0?target=deno';
import { getCorsHeaders } from '../_shared/cors.ts';
import { isValidEmail } from '../_shared/validation.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // GET - Validar código e retornar dados do convite
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const code = url.searchParams.get('code');

      if (!code) {
        return new Response(
          JSON.stringify({ error: 'Código do convite é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar convite
      const { data: invite, error } = await supabase
        .from('migration_invites')
        .select(`
          *,
          plan:plans(id, name, price_monthly, shops_limit, emails_limit)
        `)
        .eq('code', code.toUpperCase())
        .single();

      if (error || !invite) {
        return new Response(
          JSON.stringify({ error: 'Convite não encontrado', valid: false }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar status
      if (invite.status !== 'pending') {
        return new Response(
          JSON.stringify({
            error: invite.status === 'accepted'
              ? 'Este convite já foi utilizado'
              : invite.status === 'expired'
                ? 'Este convite expirou'
                : 'Este convite foi cancelado',
            valid: false,
            status: invite.status,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar expiração
      if (new Date(invite.expires_at) < new Date()) {
        // Atualizar status para expirado
        await supabase
          .from('migration_invites')
          .update({ status: 'expired' })
          .eq('id', invite.id);

        return new Response(
          JSON.stringify({ error: 'Este convite expirou', valid: false }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Calcular dias de trial (diferença em dias completos usando UTC)
      const billingDate = new Date(invite.billing_start_date);
      const todayUTC = new Date();

      // Extrair apenas ano, mês, dia em UTC
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

    // POST - Aceitar convite e criar checkout session
    if (req.method === 'POST') {
      const body = await req.json();
      const { code, user_email, user_name, success_url, cancel_url } = body;

      if (!code || !user_email || !success_url || !cancel_url) {
        return new Response(
          JSON.stringify({ error: 'Campos obrigatórios: code, user_email, success_url, cancel_url' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validar formato do email
      if (!isValidEmail(user_email)) {
        return new Response(
          JSON.stringify({ error: 'Email inválido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar convite
      const { data: invite, error: inviteError } = await supabase
        .from('migration_invites')
        .select(`
          *,
          plan:plans(*)
        `)
        .eq('code', code.toUpperCase())
        .eq('status', 'pending')
        .single();

      if (inviteError || !invite) {
        return new Response(
          JSON.stringify({ error: 'Convite não encontrado ou já utilizado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar expiração
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
          JSON.stringify({ error: 'Plano do convite não encontrado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Determinar price_id (sempre mensal para migração)
      const stripePriceId = plan.stripe_price_monthly_id;
      if (!stripePriceId) {
        return new Response(
          JSON.stringify({ error: 'Plano não configurado no Stripe' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Criar/buscar customer Stripe
      let stripeCustomerId: string;

      const existingCustomers = await stripe.customers.list({
        email: user_email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        stripeCustomerId = existingCustomers.data[0].id;
      } else {
        const newCustomer = await stripe.customers.create({
          email: user_email,
          name: user_name || invite.customer_name,
          metadata: {
            migration_invite_code: code,
          },
        });
        stripeCustomerId = newCustomer.id;
      }

      // Calcular trial_end (timestamp Unix)
      const billingStartDate = new Date(invite.billing_start_date);
      const trialEnd = Math.floor(billingStartDate.getTime() / 1000);

      // Criar checkout session com trial
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: stripePriceId,
            quantity: 1,
          },
        ],
        success_url: `${success_url}?session_id={CHECKOUT_SESSION_ID}&migration=true`,
        cancel_url: cancel_url,
        subscription_data: {
          trial_end: trialEnd,
          metadata: {
            plan_id: plan.id,
            plan_name: plan.name,
            migration_invite_id: invite.id,
            migration_invite_code: code,
            user_id: 'pending',
          },
        },
        metadata: {
          plan_id: plan.id,
          plan_name: plan.name,
          user_email: user_email,
          user_name: user_name || invite.customer_name || '',
          user_id: 'pending',
          emails_limit: plan.emails_limit?.toString() ?? 'unlimited',
          shops_limit: plan.shops_limit?.toString() ?? 'unlimited',
          migration_invite_id: invite.id,
          migration_invite_code: code,
        },
        billing_address_collection: 'auto',
        locale: 'pt-BR',
      });

      return new Response(
        JSON.stringify({
          session_id: session.id,
          url: session.url,
          trial_end: invite.billing_start_date,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
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
