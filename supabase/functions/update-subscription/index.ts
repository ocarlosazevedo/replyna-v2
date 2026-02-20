/**
 * Edge Function: Update Subscription (Asaas)
 *
 * Atualiza a assinatura do Asaas para um novo plano.
 * - UPGRADE: cobra imediatamente (updatePendingPayments = true)
 * - DOWNGRADE: aplica novo valor, sem cobranca imediata
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';
import { updateSubscription as asaasUpdateSubscription } from '../_shared/asaas.ts';

interface UpdateSubscriptionRequest {
  user_id: string;
  new_plan_id: string;
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
    const body = (await req.json()) as UpdateSubscriptionRequest;
    const { user_id, new_plan_id } = body;

    if (!user_id || !new_plan_id) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatorios: user_id, new_plan_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('id, asaas_subscription_id, plan_id, status')
      .eq('user_id', user_id)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1);

    const subscription = subscriptions?.[0] || null;

    if (subError || !subscription) {
      return new Response(
        JSON.stringify({ error: 'Assinatura ativa nao encontrada para este usuario' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscription.asaas_subscription_id) {
      return new Response(
        JSON.stringify({ error: 'Assinatura nao tem vinculo com o Asaas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: newPlan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', new_plan_id)
      .eq('is_active', true)
      .single();

    if (planError || !newPlan) {
      return new Response(
        JSON.stringify({ error: 'Plano nao encontrado ou inativo' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let currentPlan = null;
    if (subscription.plan_id) {
      const { data: currentPlanData } = await supabase
        .from('plans')
        .select('*')
        .eq('id', subscription.plan_id)
        .single();
      currentPlan = currentPlanData;
    }

    const currentPrice = Number(currentPlan?.price_monthly || 0);
    const newPrice = Number(newPlan.price_monthly || 0);

    const isUpgrade = newPrice > currentPrice;
    const isDowngrade = newPrice < currentPrice;

    const priceDifference = isUpgrade ? (newPrice - currentPrice) : 0;

    await asaasUpdateSubscription(subscription.asaas_subscription_id, {
      value: newPrice,
      description: `Replyna - Plano ${newPlan.name}`,
      cycle: 'MONTHLY',
      updatePendingPayments: isUpgrade,
    });

    const now = new Date();

    await supabase
      .from('subscriptions')
      .update({
        plan_id: new_plan_id,
        billing_cycle: 'monthly',
        updated_at: now.toISOString(),
      })
      .eq('id', subscription.id);

    await supabase
      .from('users')
      .update({
        plan: newPlan.name,
        emails_limit: newPlan.emails_limit,
        shops_limit: newPlan.shops_limit,
        emails_used: 0,
        extra_emails_used: 0,
        pending_extra_emails: 0,
        updated_at: now.toISOString(),
      })
      .eq('id', user_id);

    return new Response(
      JSON.stringify({
        success: true,
        plan: newPlan.name,
        new_plan: {
          id: newPlan.id,
          name: newPlan.name,
          emails_limit: newPlan.emails_limit,
          shops_limit: newPlan.shops_limit,
          price_monthly: newPlan.price_monthly,
        },
        is_upgrade: isUpgrade,
        is_downgrade: isDowngrade,
        price_difference: priceDifference,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao atualizar assinatura:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
