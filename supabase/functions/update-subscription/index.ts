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
import {
  updateSubscription as asaasUpdateSubscription,
  createSubscription as asaasCreateSubscription,
  deleteSubscription as asaasDeleteSubscription,
} from '../_shared/asaas.ts';

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

    // === SEM ASSINATURA ATIVA: pedir checkout com dados de pagamento ===
    if (!subscription || !subscription.asaas_subscription_id) {
      console.log(`[UpdateSubscription] Usuario ${user_id} sem assinatura ativa, redirecionando para checkout...`);

      // Retornar flag para o frontend redirecionar ao checkout customizado
      return new Response(
        JSON.stringify({
          success: true,
          needs_checkout: true,
          plan: newPlan.name,
          new_plan: {
            id: newPlan.id,
            name: newPlan.name,
            emails_limit: newPlan.emails_limit,
            shops_limit: newPlan.shops_limit,
            price_monthly: newPlan.price_monthly,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === TRIAL -> PAGO: deletar assinatura trial e criar nova paga ===
    // O cartao ja esta salvo/tokenizado no Asaas desde o cadastro.
    // Deletamos a assinatura trial (R$0) e criamos uma nova com o valor do plano.
    // O Asaas cobra automaticamente o cartao salvo no customer.
    if (subscription.status === 'trialing') {
      console.log(`[UpdateSubscription] Trial user ${user_id} upgrading to ${newPlan.name}`);

      // Buscar customer do Asaas
      const { data: userData } = await supabase
        .from('users')
        .select('email, name, asaas_customer_id')
        .eq('id', user_id)
        .single();

      if (!userData?.asaas_customer_id) {
        // Sem customer no Asaas, precisa ir para checkout
        console.log(`[UpdateSubscription] Trial user ${user_id} sem customer Asaas, redirecionando para checkout...`);
        return new Response(
          JSON.stringify({
            success: true,
            needs_checkout: true,
            plan: newPlan.name,
            new_plan: {
              id: newPlan.id,
              name: newPlan.name,
              emails_limit: newPlan.emails_limit,
              shops_limit: newPlan.shops_limit,
              price_monthly: newPlan.price_monthly,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 1. Deletar assinatura trial no Asaas
      try {
        await asaasDeleteSubscription(subscription.asaas_subscription_id);
        console.log(`[UpdateSubscription] Assinatura trial deletada: ${subscription.asaas_subscription_id}`);
      } catch (delErr) {
        console.warn(`[UpdateSubscription] Erro ao deletar trial (pode ja estar inativa):`, delErr);
      }

      // 2. Criar nova assinatura paga (Asaas usa o cartao salvo no customer)
      const today = new Date();
      const nextDueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const newAsaasSub = await asaasCreateSubscription({
        customer: userData.asaas_customer_id,
        billingType: 'CREDIT_CARD',
        value: Number(newPlan.price_monthly || 0),
        cycle: 'MONTHLY',
        description: `Replyna - Plano ${newPlan.name}`,
        nextDueDate,
      });

      console.log(`[UpdateSubscription] Nova assinatura paga criada: ${newAsaasSub.id}`);

      const periodEnd = new Date(today);
      periodEnd.setDate(periodEnd.getDate() + 30);

      // 3. Atualizar subscription no banco
      await supabase
        .from('subscriptions')
        .update({
          plan_id: new_plan_id,
          asaas_subscription_id: newAsaasSub.id,
          status: 'active',
          billing_cycle: 'monthly',
          current_period_start: today.toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: today.toISOString(),
        })
        .eq('id', subscription.id);

      // 4. Atualizar usuario
      await supabase
        .from('users')
        .update({
          plan: newPlan.name,
          emails_limit: newPlan.emails_limit,
          shops_limit: newPlan.shops_limit,
          emails_used: 0,
          extra_emails_used: 0,
          pending_extra_emails: 0,
          is_trial: false,
          updated_at: today.toISOString(),
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
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === COM ASSINATURA ATIVA: atualizar plano existente ===
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
        is_trial: false,
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
