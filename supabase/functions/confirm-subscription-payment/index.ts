/**
 * Edge Function: Confirm Subscription Payment
 *
 * Verifica no Asaas se o pagamento da subscription foi confirmado
 * e ativa o user/subscription no banco.
 * Chamada pela CheckoutSuccess após redirect do Asaas.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';
import { getPaymentsBySubscription } from '../_shared/asaas.ts';

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
    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id obrigatorio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseAdmin();

    // Buscar subscription incomplete do usuario
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('id, asaas_subscription_id, plan_id, status')
      .eq('user_id', user_id)
      .eq('status', 'incomplete')
      .order('created_at', { ascending: false })
      .limit(1);

    const subscription = subscriptions?.[0];
    if (!subscription || !subscription.asaas_subscription_id) {
      return new Response(
        JSON.stringify({ confirmed: false, reason: 'Nenhuma subscription incomplete encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar pagamentos no Asaas
    const payments = await getPaymentsBySubscription(subscription.asaas_subscription_id, {
      limit: 5,
      order: 'desc',
    });

    const confirmedPayment = payments.data?.find(
      (p: any) => p.status === 'CONFIRMED' || p.status === 'RECEIVED'
    );

    if (!confirmedPayment) {
      return new Response(
        JSON.stringify({ confirmed: false, reason: 'Pagamento ainda nao confirmado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Pagamento confirmado! Buscar o plano para atualizar o user
    const { data: plan } = await supabase
      .from('plans')
      .select('*')
      .eq('id', subscription.plan_id)
      .single();

    if (!plan) {
      return new Response(
        JSON.stringify({ confirmed: false, reason: 'Plano nao encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    // Ativar subscription
    await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', subscription.id);

    // Ativar user com o novo plano
    await supabase
      .from('users')
      .update({
        plan: plan.name,
        emails_limit: plan.emails_limit,
        shops_limit: plan.shops_limit,
        status: 'active',
        is_trial: false,
        emails_used: 0,
        updated_at: now.toISOString(),
      })
      .eq('id', user_id);

    console.log(`[ConfirmPayment] User ${user_id} ativado com plano ${plan.name}`);

    return new Response(
      JSON.stringify({
        confirmed: true,
        plan: plan.name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao confirmar pagamento:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
