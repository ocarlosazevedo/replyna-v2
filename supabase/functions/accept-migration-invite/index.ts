/**
 * Edge Function: Accept Migration Invite (Asaas)
 *
 * Fluxo TEMPORARIO para migracao de usuarios existentes.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';
import { createSubscription, getPaymentsBySubscription } from '../_shared/asaas.ts';

interface AcceptMigrationRequest {
  token: string;
}

interface AsaasCustomer {
  id: string;
}

const ASAAS_BASE_URL = Deno.env.get('ASAAS_BASE_URL') || 'https://api.asaas.com/v3';
const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');

async function createAsaasCustomer(input: {
  name: string | null;
  email: string;
  phone?: string;
}): Promise<AsaasCustomer> {
  if (!ASAAS_API_KEY) {
    throw new Error('ASAAS_API_KEY nao configurada');
  }

  const response = await fetch(`${ASAAS_BASE_URL}/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    },
    body: JSON.stringify({
      name: input.name || input.email,
      email: input.email,
      phone: input.phone,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Erro ao criar customer no Asaas: ${response.status} - ${JSON.stringify(data)}`);
  }

  return data as AsaasCustomer;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Metodo nao permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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

    const body = (await req.json()) as AcceptMigrationRequest;
    const { token } = body;

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token invalido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: tokenData } = await supabase
      .from('migration_tokens')
      .select('id, user_id, used')
      .eq('token', token)
      .maybeSingle();

    if (!tokenData?.id) {
      return new Response(
        JSON.stringify({ error: 'Token invalido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (tokenData.used) {
      return new Response(
        JSON.stringify({ error: 'Token ja utilizado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, email, name, whatsapp_number, plan')
      .eq('id', tokenData.user_id)
      .maybeSingle();

    if (!user?.id) {
      return new Response(
        JSON.stringify({ error: 'Usuario nao encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: plan } = await supabase
      .from('plans')
      .select('id, name, price_monthly, emails_limit, shops_limit')
      .ilike('name', user.plan)
      .maybeSingle();

    if (!plan?.id) {
      return new Response(
        JSON.stringify({ error: 'Plano nao encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanPhone = (user.whatsapp_number || '')
      .replace(/^\+?55\s?/, '')
      .replace(/[\s\-\(\)]/g, '');

    const asaasCustomer = await createAsaasCustomer({
      name: user.name,
      email: user.email,
      phone: cleanPhone || undefined,
    });

    const nowIso = new Date().toISOString();

    const { error: cancelStripeError } = await supabase
      .from('subscriptions')
      .update({ status: 'canceled', canceled_at: nowIso })
      .eq('user_id', user.id)
      .is('asaas_subscription_id', null);

    if (cancelStripeError) {
      console.error('[SUPABASE] Cancel Stripe subscriptions error:', JSON.stringify(cancelStripeError));
      return new Response(
        JSON.stringify({ error: 'Erro ao cancelar subscriptions antigas', details: cancelStripeError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const asaasSubscription = await createSubscription({
      customer: asaasCustomer.id,
      billingType: 'CREDIT_CARD',
      value: parseFloat(String(plan.price_monthly || 0)),
      cycle: 'MONTHLY',
      description: `Replyna - Plano ${plan.name}`,
      nextDueDate: nowIso.split('T')[0],
    });

    const payments = await getPaymentsBySubscription(asaasSubscription.id, { limit: 1, order: 'desc' });
    const invoiceUrl = payments.data?.[0]?.invoiceUrl || null;

    const { error: updateUserError } = await supabase
      .from('users')
      .update({ asaas_customer_id: asaasCustomer.id })
      .eq('id', user.id);

    if (updateUserError) {
      console.error('[SUPABASE] Update user error:', JSON.stringify(updateUserError));
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar usuario', details: updateUserError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error: insertSubError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        status: 'incomplete',
        asaas_subscription_id: asaasSubscription.id,
        asaas_customer_id: asaasCustomer.id,
        billing_cycle: 'monthly',
        current_period_start: nowIso,
        current_period_end: periodEnd,
      });

    if (insertSubError) {
      console.error('[SUPABASE] Insert subscription error:', JSON.stringify(insertSubError));
      return new Response(
        JSON.stringify({ error: 'Erro ao criar subscription', details: insertSubError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: updateTokenError } = await supabase
      .from('migration_tokens')
      .update({ used: true, used_at: nowIso })
      .eq('id', tokenData.id);

    if (updateTokenError) {
      console.error('[SUPABASE] Update token error:', JSON.stringify(updateTokenError));
      return new Response(
        JSON.stringify({ error: 'Erro ao marcar token como usado', details: updateTokenError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, invoiceUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
