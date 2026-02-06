/**
 * Edge Function: Update Subscription
 *
 * Atualiza a subscription do Stripe para um novo plano.
 *
 * Comportamento:
 * - UPGRADE (novo plano mais caro): Cobra a diferença imediatamente
 * - DOWNGRADE (novo plano mais barato): Novo valor só na próxima fatura
 *
 * Versão standalone - não depende de arquivos externos
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@20.2.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';

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
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

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

    // Buscar plano atual para comparar preços
    let currentPlan = null;
    if (subscription.plan_id) {
      const { data: currentPlanData } = await supabase
        .from('plans')
        .select('*')
        .eq('id', subscription.plan_id)
        .single();
      currentPlan = currentPlanData;
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

    // Verificar se o cliente tem método de pagamento
    let customer = await stripe.customers.retrieve(subscription.stripe_customer_id) as Stripe.Customer;
    let hasPaymentMethod = customer.invoice_settings?.default_payment_method || customer.default_source;

    // Se não tem método de pagamento padrão, verificar se tem algum método de pagamento anexado
    // Isso pode acontecer após o setup session - o cartão é adicionado mas não definido como padrão
    if (!hasPaymentMethod) {
      console.log('Cliente sem método de pagamento padrão. Verificando métodos anexados...');

      // Buscar métodos de pagamento do cliente
      const paymentMethods = await stripe.paymentMethods.list({
        customer: subscription.stripe_customer_id,
        type: 'card',
      });

      console.log(`Encontrados ${paymentMethods.data.length} métodos de pagamento`);

      if (paymentMethods.data.length > 0) {
        // Usar o método mais recente
        const latestPaymentMethod = paymentMethods.data[0];
        console.log(`Definindo método ${latestPaymentMethod.id} como padrão...`);

        // Definir como método de pagamento padrão para invoices
        await stripe.customers.update(subscription.stripe_customer_id, {
          invoice_settings: {
            default_payment_method: latestPaymentMethod.id,
          },
        });

        // Também atualizar o método de pagamento padrão na subscription
        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          default_payment_method: latestPaymentMethod.id,
        });

        console.log('Método de pagamento padrão definido com sucesso');
        hasPaymentMethod = latestPaymentMethod.id;

        // Atualizar referência do customer
        customer = await stripe.customers.retrieve(subscription.stripe_customer_id) as Stripe.Customer;
      }
    }

    // Se ainda não tem método de pagamento, criar sessão de checkout para adicionar cartão
    if (!hasPaymentMethod) {
      console.log('Cliente sem método de pagamento. Criando sessão de checkout...');

      const checkoutSession = await stripe.checkout.sessions.create({
        customer: subscription.stripe_customer_id,
        mode: 'setup',
        payment_method_types: ['card'],
        success_url: `${req.headers.get('origin') || 'https://app.replyna.com.br'}/account?upgrade_pending=true&plan_id=${new_plan_id}&billing_cycle=${finalBillingCycle}`,
        cancel_url: `${req.headers.get('origin') || 'https://app.replyna.com.br'}/account?upgrade_cancelled=true`,
        metadata: {
          user_id: user_id,
          new_plan_id: new_plan_id,
          billing_cycle: finalBillingCycle,
        },
      });

      return new Response(
        JSON.stringify({
          requires_payment_method: true,
          checkout_url: checkoutSession.url,
          message: 'Você precisa adicionar um método de pagamento para fazer upgrade.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se já está no mesmo plano/preço no Stripe
    const currentItem = stripeSubscription.items.data[0];
    const alreadyOnPlanInStripe = currentItem.price.id === newStripePriceId;

    // Se já está no plano no Stripe, verificar se o banco está sincronizado
    if (alreadyOnPlanInStripe) {
      console.log('Usuário já está no plano no Stripe. Verificando sincronização do banco...');

      // Buscar dados atuais do usuário no banco
      const { data: currentUser } = await supabase
        .from('users')
        .select('plan, emails_limit, shops_limit')
        .eq('id', user_id)
        .single();

      console.log('Dados atuais do usuário no banco:', currentUser);
      console.log('Plano esperado:', newPlan.name);

      // Verificar se o banco precisa ser sincronizado
      const needsSync = !currentUser ||
        currentUser.plan?.toLowerCase() !== newPlan.name.toLowerCase() ||
        currentUser.emails_limit !== newPlan.emails_limit ||
        currentUser.shops_limit !== newPlan.shops_limit;

      if (needsSync) {
        console.log('Banco desatualizado. Sincronizando...');

        // Atualizar tabela subscriptions
        await supabase
          .from('subscriptions')
          .update({
            plan_id: new_plan_id,
            stripe_price_id: newStripePriceId,
            billing_cycle: finalBillingCycle,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);

        // Atualizar tabela users
        const { data: syncedUserData, error: syncError } = await supabase
          .from('users')
          .update({
            plan: newPlan.name,
            emails_limit: newPlan.emails_limit,
            shops_limit: newPlan.shops_limit,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user_id)
          .select();

        if (syncError) {
          console.error('Erro ao sincronizar banco:', syncError);
          return new Response(
            JSON.stringify({ error: 'Erro ao sincronizar banco de dados: ' + syncError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Banco sincronizado com sucesso:', syncedUserData);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Banco de dados sincronizado com o plano atual do Stripe.',
            synced: true,
            new_plan: {
              id: newPlan.id,
              name: newPlan.name,
              emails_limit: newPlan.emails_limit,
              shops_limit: newPlan.shops_limit,
            },
            billing_cycle: finalBillingCycle,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Banco já está sincronizado
      return new Response(
        JSON.stringify({ error: 'Você já está neste plano' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determinar se é upgrade ou downgrade baseado no preço
    // Usar o preço baseado no ciclo de cobrança atual
    const currentPlanPrice = finalBillingCycle === 'yearly'
      ? (currentPlan?.price_yearly || 0)
      : (currentPlan?.price_monthly || 0);
    const newPlanPrice = finalBillingCycle === 'yearly'
      ? (newPlan.price_yearly || 0)
      : (newPlan.price_monthly || 0);

    const isUpgrade = newPlanPrice > currentPlanPrice;
    const isDowngrade = newPlanPrice < currentPlanPrice;

    console.log('Comparação de planos:', {
      currentPlan: currentPlan?.name,
      currentPlanPrice,
      newPlan: newPlan.name,
      newPlanPrice,
      isUpgrade,
      isDowngrade,
    });

    // Definir comportamento de proration baseado em upgrade/downgrade
    // UPGRADE: Reseta o ciclo de cobrança e cobra o valor cheio do novo plano imediatamente
    // DOWNGRADE: Mantém o ciclo atual, novo valor só na próxima fatura

    console.log('Tipo de alteração:', isUpgrade ? 'UPGRADE' : isDowngrade ? 'DOWNGRADE' : 'MESMO_PRECO');

    let updatedSubscription;

    // Verificar se a subscription tem trial ativo
    const hasActiveTrial = stripeSubscription.trial_end && stripeSubscription.trial_end > Math.floor(Date.now() / 1000);

    console.log('Atualizando subscription no Stripe...', {
      subscription_id: subscription.stripe_subscription_id,
      new_price_id: newStripePriceId,
      hasActiveTrial,
    });

    if (isUpgrade) {
      // Para UPGRADE: atualizar subscription e cobrar imediatamente
      console.log('UPGRADE detectado. Atualizando subscription com cobrança imediata...');

      const updateParams: any = {
        items: [
          {
            id: currentItem.id,
            price: newStripePriceId,
          },
        ],
        proration_behavior: 'none',
        billing_cycle_anchor: 'now',
        payment_behavior: 'error_if_incomplete',
        metadata: {
          plan_id: new_plan_id,
          plan_name: newPlan.name,
          user_id: user_id,
        },
      };

      if (hasActiveTrial) {
        updateParams.trial_end = 'now';
      }

      try {
        updatedSubscription = await stripe.subscriptions.update(
          subscription.stripe_subscription_id,
          updateParams
        );
        console.log('Subscription atualizada com sucesso. Status:', updatedSubscription.status);
      } catch (stripeError: any) {
        console.error('Erro ao atualizar subscription:', stripeError.message);

        // Se falhou por problema de pagamento, buscar a invoice pendente
        if (stripeError.code === 'subscription_payment_intent_requires_action' ||
            stripeError.code === 'card_declined' ||
            stripeError.type === 'StripeCardError') {

          // Buscar a invoice pendente
          const invoices = await stripe.invoices.list({
            subscription: subscription.stripe_subscription_id,
            status: 'open',
            limit: 1,
          });

          if (invoices.data.length > 0) {
            const pendingInvoice = invoices.data[0];
            const paymentUrl = pendingInvoice.hosted_invoice_url;

            if (paymentUrl) {
              return new Response(
                JSON.stringify({
                  payment_required: true,
                  payment_url: paymentUrl,
                  message: 'Pagamento necessário para completar o upgrade.',
                  is_upgrade: true,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }

          // Se não encontrou invoice, criar checkout session
          console.log('Criando checkout session para upgrade...');
          const checkoutSession = await stripe.checkout.sessions.create({
            customer: subscription.stripe_customer_id,
            mode: 'subscription',
            line_items: [
              {
                price: newStripePriceId,
                quantity: 1,
              },
            ],
            success_url: `${req.headers.get('origin') || 'https://app.replyna.com.br'}/account?upgrade_success=true`,
            cancel_url: `${req.headers.get('origin') || 'https://app.replyna.com.br'}/account?upgrade_cancelled=true`,
            subscription_data: {
              metadata: {
                plan_id: new_plan_id,
                plan_name: newPlan.name,
                user_id: user_id,
              },
            },
          });

          return new Response(
            JSON.stringify({
              payment_required: true,
              payment_url: checkoutSession.url,
              message: `Complete o pagamento para ativar o plano ${newPlan.name}.`,
              is_upgrade: true,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        throw stripeError;
      }
    } else {
      // Para DOWNGRADE ou mesmo preço: mantém o ciclo atual
      const updateParams: any = {
        items: [
          {
            id: currentItem.id,
            price: newStripePriceId,
          },
        ],
        proration_behavior: 'none',
        metadata: {
          plan_id: new_plan_id,
          plan_name: newPlan.name,
          user_id: user_id,
        },
      };

      // Só incluir trial_end se houver trial ativo
      if (hasActiveTrial) {
        updateParams.trial_end = 'now';
      }

      updatedSubscription = await stripe.subscriptions.update(
        subscription.stripe_subscription_id,
        updateParams
      );
    }

    // Verificar se o pagamento foi processado com sucesso
    // Se status for incomplete ou past_due, o pagamento falhou
    if (updatedSubscription.status === 'incomplete' || updatedSubscription.status === 'past_due') {
      console.log('Pagamento falhou. Status da subscription:', updatedSubscription.status);

      // Buscar a última invoice para obter a URL de pagamento
      const invoices = await stripe.invoices.list({
        subscription: updatedSubscription.id,
        limit: 1,
      });

      const latestInvoice = invoices.data[0];
      let paymentUrl = latestInvoice?.hosted_invoice_url;

      console.log('Invoice encontrada:', {
        invoice_id: latestInvoice?.id,
        status: latestInvoice?.status,
        hosted_invoice_url: paymentUrl,
      });

      // Se não tiver URL de pagamento da invoice, criar uma sessão de checkout
      if (!paymentUrl) {
        console.log('Sem URL de invoice. Criando sessão de checkout...');

        const checkoutSession = await stripe.checkout.sessions.create({
          customer: subscription.stripe_customer_id,
          mode: 'subscription',
          line_items: [
            {
              price: newStripePriceId,
              quantity: 1,
            },
          ],
          success_url: `${req.headers.get('origin') || 'https://app.replyna.com.br'}/account?upgrade_success=true`,
          cancel_url: `${req.headers.get('origin') || 'https://app.replyna.com.br'}/account?upgrade_cancelled=true`,
          subscription_data: {
            metadata: {
              plan_id: new_plan_id,
              plan_name: newPlan.name,
              user_id: user_id,
              replaces_subscription: subscription.stripe_subscription_id,
            },
          },
        });

        paymentUrl = checkoutSession.url;
      }

      return new Response(
        JSON.stringify({
          payment_required: true,
          payment_url: paymentUrl,
          message: 'Pagamento pendente. Complete o pagamento para ativar o novo plano.',
          subscription_status: updatedSubscription.status,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Atualizando subscription no banco:', {
      subscription_id: subscription.id,
      plan_id: new_plan_id,
      stripe_price_id: newStripePriceId,
      billing_cycle: finalBillingCycle,
    });

    // Atualizar subscription no banco de dados
    // IMPORTANTE: Se foi upgrade, sincronizar as novas datas do período de cobrança
    const subscriptionUpdate: any = {
      plan_id: new_plan_id,
      stripe_price_id: newStripePriceId,
      billing_cycle: finalBillingCycle,
      status: 'active',
      updated_at: new Date().toISOString(),
    };

    // Se foi upgrade, atualizar as datas do período baseado na subscription atualizada do Stripe
    if (isUpgrade && updatedSubscription.current_period_start && updatedSubscription.current_period_end) {
      subscriptionUpdate.current_period_start = new Date(updatedSubscription.current_period_start * 1000).toISOString();
      subscriptionUpdate.current_period_end = new Date(updatedSubscription.current_period_end * 1000).toISOString();
      console.log('Upgrade: sincronizando datas do período:', {
        current_period_start: subscriptionUpdate.current_period_start,
        current_period_end: subscriptionUpdate.current_period_end,
      });
    }

    const { data: updatedSubData, error: updateError } = await supabase
      .from('subscriptions')
      .update(subscriptionUpdate)
      .eq('id', subscription.id)
      .select();

    console.log('Resultado update subscriptions:', { updatedSubData, updateError });

    if (updateError) {
      console.error('Erro ao atualizar subscription no banco:', updateError);
    }

    console.log('Atualizando usuário na tabela users:', {
      user_id,
      plan: newPlan.name,
      emails_limit: newPlan.emails_limit,
      shops_limit: newPlan.shops_limit,
    });

    // Atualizar plano do usuário na tabela users
    // NOTA: A tabela users NÃO tem coluna plan_id, apenas o campo texto 'plan'
    // Quando faz upgrade, zera os contadores de emails usados (novo ciclo de billing)
    const { data: updatedUserData, error: userUpdateError } = await supabase
      .from('users')
      .update({
        plan: newPlan.name,
        emails_limit: newPlan.emails_limit,
        shops_limit: newPlan.shops_limit,
        emails_used: 0,
        extra_emails_used: 0,
        pending_extra_emails: 0,
        updated_at: new Date().toISOString(),
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

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Plano atualizado com sucesso!',
        new_plan: {
          id: newPlan.id,
          name: newPlan.name,
          emails_limit: newPlan.emails_limit,
          shops_limit: newPlan.shops_limit,
          price_monthly: newPlan.price_monthly,
        },
        billing_cycle: finalBillingCycle,
        subscription_id: updatedSubscription.id,
        is_upgrade: isUpgrade,
        is_downgrade: isDowngrade,
        price_difference: isUpgrade ? (newPlanPrice - currentPlanPrice) : 0,
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
