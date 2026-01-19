/**
 * Edge Function: Stripe Webhook
 *
 * Processa eventos do Stripe como:
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.paid
 * - invoice.payment_failed
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { getStripeClient, verifyWebhookSignature, Stripe } from '../_shared/stripe.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET não configurado');
    }

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.text();
    const event = verifyWebhookSignature(body, signature, webhookSecret);

    console.log(`Webhook recebido: ${event.type}`);

    const supabase = getSupabaseClient();
    const stripe = getStripeClient();

    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, supabase, stripe);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription, supabase);
        break;
      }

      case 'customer.subscription.deleted': {
        await handleSubscriptionCanceled(event.data.object as Stripe.Subscription, supabase);
        break;
      }

      case 'invoice.paid': {
        await handleInvoicePaid(event.data.object as Stripe.Invoice, supabase);
        break;
      }

      case 'invoice.payment_failed': {
        await handlePaymentFailed(event.data.object as Stripe.Invoice, supabase);
        break;
      }

      default:
        console.log(`Evento não tratado: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Checkout completado - criar/atualizar usuário e assinatura
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  supabase: ReturnType<typeof getSupabaseClient>,
  stripe: Stripe
) {
  console.log('Processando checkout.session.completed:', session.id);

  const metadata = session.metadata || {};
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  // Buscar subscription para obter detalhes
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;

  // Verificar se é novo usuário ou upgrade
  let userId = metadata.user_id;

  if (!userId || userId === 'pending') {
    // Novo usuário - criar conta
    const email = metadata.user_email || session.customer_email;
    const name = metadata.user_name || session.customer_details?.name;

    if (!email) {
      throw new Error('Email do usuário não encontrado');
    }

    // Verificar se usuário já existe
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Criar novo usuário
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: email.toLowerCase(),
          name: name || null,
          plan: metadata.plan_name?.toLowerCase() || 'starter',
          emails_limit: parseInt(metadata.emails_limit || '500'),
          shops_limit: parseInt(metadata.shops_limit || '1'),
          emails_used: 0,
          stripe_customer_id: customerId,
          status: 'active',
        })
        .select('id')
        .single();

      if (createError) {
        throw new Error(`Erro ao criar usuário: ${createError.message}`);
      }

      userId = newUser.id;
      console.log('Novo usuário criado:', userId);
    }
  }

  // Atualizar usuário com stripe_customer_id e plano
  await supabase
    .from('users')
    .update({
      stripe_customer_id: customerId,
      plan: metadata.plan_name?.toLowerCase() || 'starter',
      emails_limit: parseInt(metadata.emails_limit || '500'),
      shops_limit: parseInt(metadata.shops_limit || '1'),
      status: 'active',
    })
    .eq('id', userId);

  // Criar/atualizar registro de assinatura
  const subscriptionData = {
    user_id: userId,
    plan_id: metadata.plan_id || null,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: priceId,
    status: 'active',
    billing_cycle: priceId?.includes('year') ? 'yearly' : 'monthly',
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
  };

  // Verificar se já existe assinatura
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (existingSub) {
    await supabase
      .from('subscriptions')
      .update(subscriptionData)
      .eq('id', existingSub.id);
  } else {
    await supabase
      .from('subscriptions')
      .insert(subscriptionData);
  }

  // Registrar uso de cupom se aplicável
  if (metadata.coupon_id) {
    await supabase.rpc('use_coupon', {
      p_coupon_id: metadata.coupon_id,
      p_user_id: userId,
      p_discount_applied: 0, // TODO: calcular desconto
      p_subscription_id: subscriptionId,
    });
  }

  // Atualizar metadata do customer no Stripe com user_id correto
  await stripe.customers.update(customerId, {
    metadata: { user_id: userId },
  });

  console.log('Checkout processado com sucesso para usuário:', userId);
}

/**
 * Assinatura atualizada - sincronizar status
 */
async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription,
  supabase: ReturnType<typeof getSupabaseClient>
) {
  console.log('Processando subscription update:', subscription.id);

  const status = mapStripeStatus(subscription.status);
  const priceId = subscription.items.data[0]?.price.id;

  // Atualizar assinatura
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status,
      stripe_price_id: priceId,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Erro ao atualizar assinatura:', error);
  }

  // Se cancelado ou unpaid, atualizar status do usuário
  if (status === 'canceled' || status === 'unpaid') {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (sub?.user_id) {
      await supabase
        .from('users')
        .update({
          status: status === 'canceled' ? 'inactive' : 'suspended',
          plan: 'free',
          emails_limit: 0,
          shops_limit: 0,
        })
        .eq('id', sub.user_id);
    }
  }
}

/**
 * Assinatura cancelada
 */
async function handleSubscriptionCanceled(
  subscription: Stripe.Subscription,
  supabase: ReturnType<typeof getSupabaseClient>
) {
  console.log('Processando subscription canceled:', subscription.id);

  // Atualizar assinatura
  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  // Atualizar usuário
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (sub?.user_id) {
    await supabase
      .from('users')
      .update({
        status: 'inactive',
        plan: 'free',
        emails_limit: 0,
        shops_limit: 0,
      })
      .eq('id', sub.user_id);
  }
}

/**
 * Fatura paga - renovação de assinatura
 */
async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  supabase: ReturnType<typeof getSupabaseClient>
) {
  console.log('Processando invoice.paid:', invoice.id);

  if (!invoice.subscription) return;

  const subscriptionId = invoice.subscription as string;

  // Buscar assinatura
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id, plan_id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!sub) return;

  // Buscar limites do plano
  if (sub.plan_id) {
    const { data: plan } = await supabase
      .from('plans')
      .select('emails_limit')
      .eq('id', sub.plan_id)
      .single();

    if (plan) {
      // Resetar emails_used no início do novo período
      await supabase
        .from('users')
        .update({
          emails_used: 0,
          status: 'active',
        })
        .eq('id', sub.user_id);

      console.log('Créditos resetados para usuário:', sub.user_id);
    }
  }
}

/**
 * Pagamento falhou
 */
async function handlePaymentFailed(
  invoice: Stripe.Invoice,
  supabase: ReturnType<typeof getSupabaseClient>
) {
  console.log('Processando invoice.payment_failed:', invoice.id);

  if (!invoice.subscription) return;

  const subscriptionId = invoice.subscription as string;

  // Atualizar status da assinatura
  await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', subscriptionId);

  // Atualizar status do usuário
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (sub?.user_id) {
    await supabase
      .from('users')
      .update({ status: 'suspended' })
      .eq('id', sub.user_id);
  }
}

/**
 * Mapeia status do Stripe para status interno
 */
function mapStripeStatus(stripeStatus: string): string {
  const statusMap: Record<string, string> = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'unpaid',
    trialing: 'trialing',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
  };
  return statusMap[stripeStatus] || 'active';
}
