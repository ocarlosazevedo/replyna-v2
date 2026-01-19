/**
 * Edge Function: Update Subscription
 *
 * Atualiza a subscription do Stripe para um novo plano,
 * aplicando proration (cliente paga apenas a diferença).
 *
 * Versão standalone - não depende de arquivos externos
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface UpdateSubscriptionRequest {
  user_id: string;
  new_plan_id: string;
  billing_cycle?: 'monthly' | 'yearly';
}

// Função para obter cliente Stripe
function getStripeClient(): Stripe {
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY é obrigatória');
  }
  return new Stripe(stripeSecretKey, {
    apiVersion: '2024-11-20.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

// Função para obter cliente Supabase
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = getStripeClient();
    const supabase = getSupabaseClient();

    const body: UpdateSubscriptionRequest = await req.json();
    const { user_id, new_plan_id, billing_cycle } = body;

    // Validar campos obrigatórios
    if (!user_id || !new_plan_id) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: user_id, new_plan_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar subscription atual do usuário
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id, stripe_subscription_id, stripe_customer_id, plan_id, billing_cycle, status')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      console.error('Erro ao buscar subscription:', subError);
      return new Response(
        JSON.stringify({ error: 'Assinatura ativa não encontrada para este usuário' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscription.stripe_subscription_id) {
      return new Response(
        JSON.stringify({ error: 'Assinatura não tem vínculo com o Stripe' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar novo plano
    const { data: newPlan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', new_plan_id)
      .eq('is_active', true)
      .single();

    if (planError || !newPlan) {
      return new Response(
        JSON.stringify({ error: 'Plano não encontrado ou inativo' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determinar o ciclo de cobrança (manter o atual ou usar o novo)
    const finalBillingCycle = billing_cycle || subscription.billing_cycle || 'monthly';

    // Determinar o price_id do Stripe baseado no ciclo de cobrança
    const newStripePriceId = finalBillingCycle === 'yearly'
      ? newPlan.stripe_price_yearly_id
      : newPlan.stripe_price_monthly_id;

    if (!newStripePriceId) {
      return new Response(
        JSON.stringify({ error: 'Plano não configurado no Stripe. Configure os IDs de preço no painel admin.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar subscription atual no Stripe para obter o item_id
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);

    if (!stripeSubscription || stripeSubscription.status === 'canceled') {
      return new Response(
        JSON.stringify({ error: 'Assinatura não encontrada ou cancelada no Stripe' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se já está no mesmo plano/preço
    const currentItem = stripeSubscription.items.data[0];
    if (currentItem.price.id === newStripePriceId) {
      return new Response(
        JSON.stringify({ error: 'Você já está neste plano' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar subscription no Stripe com proration
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        items: [
          {
            id: currentItem.id,
            price: newStripePriceId,
          },
        ],
        proration_behavior: 'create_prorations', // Aplica proration
        metadata: {
          plan_id: new_plan_id,
          plan_name: newPlan.name,
          user_id: user_id,
        },
      }
    );

    console.log('Atualizando subscription no banco:', {
      subscription_id: subscription.id,
      plan_id: new_plan_id,
      stripe_price_id: newStripePriceId,
      billing_cycle: finalBillingCycle,
    });

    // Atualizar subscription no banco de dados
    const { data: updatedSubData, error: updateError } = await supabase
      .from('subscriptions')
      .update({
        plan_id: new_plan_id,
        stripe_price_id: newStripePriceId,
        billing_cycle: finalBillingCycle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)
      .select();

    console.log('Resultado update subscriptions:', { updatedSubData, updateError });

    if (updateError) {
      console.error('Erro ao atualizar subscription no banco:', updateError);
    }

    console.log('Atualizando usuário na tabela users:', {
      user_id,
      plan_id: new_plan_id,
      plan: newPlan.name,
      emails_limit: newPlan.emails_limit,
      shops_limit: newPlan.shops_limit,
    });

    // Atualizar plano do usuário na tabela users
    const { data: updatedUserData, error: userUpdateError } = await supabase
      .from('users')
      .update({
        plan_id: new_plan_id,
        plan: newPlan.name, // Campo texto com nome do plano
        emails_limit: newPlan.emails_limit,
        shops_limit: newPlan.shops_limit,
      })
      .eq('id', user_id)
      .select();

    console.log('Resultado update users:', { updatedUserData, userUpdateError });

    if (userUpdateError) {
      console.error('Erro ao atualizar usuário:', userUpdateError);
      // Retornar erro parcial mas informar que o Stripe foi atualizado
      return new Response(
        JSON.stringify({
          success: true,
          partial_error: true,
          message: 'Plano atualizado no Stripe, mas houve erro ao sincronizar banco de dados. Recarregue a página.',
          error_detail: userUpdateError.message,
          new_plan: {
            id: newPlan.id,
            name: newPlan.name,
            emails_limit: newPlan.emails_limit,
            shops_limit: newPlan.shops_limit,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o update realmente afetou alguma linha
    if (!updatedUserData || updatedUserData.length === 0) {
      console.error('Update executou mas não afetou nenhuma linha. User ID:', user_id);
      return new Response(
        JSON.stringify({
          success: true,
          partial_error: true,
          message: 'Plano atualizado no Stripe, mas usuário não encontrado no banco. Recarregue a página.',
          new_plan: {
            id: newPlan.id,
            name: newPlan.name,
            emails_limit: newPlan.emails_limit,
            shops_limit: newPlan.shops_limit,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar informações de proration para informar o cliente
    let prorationAmount = 0;
    try {
      const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
        subscription: subscription.stripe_subscription_id,
      });

      // Calcular valor do proration
      prorationAmount = upcomingInvoice.lines.data
        .filter((line: { proration: boolean }) => line.proration)
        .reduce((sum: number, line: { amount: number }) => sum + line.amount, 0);
    } catch (invoiceError) {
      console.error('Erro ao buscar proration:', invoiceError);
      // Não bloqueia a operação se não conseguir buscar o proration
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Plano atualizado com sucesso!',
        new_plan: {
          id: newPlan.id,
          name: newPlan.name,
          emails_limit: newPlan.emails_limit,
          shops_limit: newPlan.shops_limit,
        },
        proration_amount: prorationAmount / 100, // Converter de centavos para reais
        billing_cycle: finalBillingCycle,
        subscription_id: updatedSubscription.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao atualizar subscription:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
