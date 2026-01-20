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
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getStripeClient, verifyWebhookSignature, Stripe } from '../_shared/stripe.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';

/**
 * Obtém o cliente Supabase com service role key para operações admin
 */
function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  console.log('=== WEBHOOK STRIPE CHAMADO ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Endpoint de teste para verificar se o webhook está acessível
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('session_id');

    // Se tiver session_id, reprocessar manualmente (para debug)
    if (sessionId) {
      try {
        console.log('=== REPROCESSANDO SESSÃO MANUALMENTE ===');
        console.log('Session ID:', sessionId);

        const stripe = getStripeClient();
        const supabase = getSupabaseClient();

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        console.log('Session status:', session.status);
        console.log('Payment status:', session.payment_status);

        if (session.status === 'complete' && session.payment_status === 'paid') {
          await handleCheckoutCompleted(session as Stripe.Checkout.Session, supabase, stripe);
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Sessão reprocessada com sucesso',
              session_id: sessionId,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'Sessão não está completa ou não foi paga',
              status: session.status,
              payment_status: session.payment_status,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (error) {
        console.error('Erro ao reprocessar sessão:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        status: 'ok',
        message: 'Webhook endpoint ativo',
        timestamp: new Date().toISOString(),
        hasSecret: !!Deno.env.get('STRIPE_WEBHOOK_SECRET'),
        usage: 'Adicione ?session_id=cs_xxx para reprocessar uma sessão manualmente',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    console.log('Webhook Secret configurado:', !!webhookSecret);

    if (!webhookSecret) {
      console.error('ERRO: STRIPE_WEBHOOK_SECRET não configurado!');
      throw new Error('STRIPE_WEBHOOK_SECRET não configurado');
    }

    const signature = req.headers.get('stripe-signature');
    console.log('Stripe Signature presente:', !!signature);

    if (!signature) {
      console.error('ERRO: stripe-signature header ausente');
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.text();
    console.log('Body recebido (primeiros 200 chars):', body.substring(0, 200));

    const event = await verifyWebhookSignature(body, signature, webhookSecret);

    console.log('=== Webhook verificado com sucesso ===');
    console.log(`Evento recebido: ${event.type}`);

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
  console.log('=== Processando checkout.session.completed ===');
  console.log('Session ID:', session.id);
  console.log('Customer ID:', session.customer);
  console.log('Subscription ID:', session.subscription);
  console.log('Customer Email:', session.customer_email);
  console.log('Customer Details:', JSON.stringify(session.customer_details));
  console.log('Metadata:', JSON.stringify(session.metadata));

  const metadata = session.metadata || {};
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!subscriptionId) {
    console.error('ERRO: subscriptionId não encontrado na sessão');
    throw new Error('Subscription ID não encontrado');
  }

  // Buscar subscription para obter detalhes
  console.log('Buscando subscription no Stripe:', subscriptionId);
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  console.log('Price ID:', priceId);

  // Verificar se é novo usuário ou upgrade
  let userId = metadata.user_id;
  console.log('User ID dos metadados:', userId);

  if (!userId || userId === 'pending') {
    // Novo usuário - criar conta
    const email = metadata.user_email || session.customer_email;
    const name = metadata.user_name || session.customer_details?.name;

    console.log('Criando novo usuário - Email:', email, 'Nome:', name);

    if (!email) {
      console.error('ERRO: Email do usuário não encontrado');
      throw new Error('Email do usuário não encontrado');
    }

    // Verificar se usuário já existe
    console.log('Verificando se usuário já existe no banco...');
    const { data: existingUser, error: existingError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    console.log('Resultado busca usuário existente:', { existingUser, error: existingError?.message });

    if (existingUser) {
      userId = existingUser.id;
      console.log('Usuário já existe, usando ID:', userId);
    } else {
      // Usuário não existe no banco - vamos criar usando Admin API
      console.log('Usuário não existe, criando via Admin API...');
      const supabaseAdmin = getSupabaseAdminClient();

      // Verificar se usuário já existe no Auth
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingAuthUser = authUsers?.users.find(u =>
        u.email?.toLowerCase() === email.toLowerCase()
      );

      let newUserId: string;

      if (existingAuthUser) {
        console.log('Usuário já existe no Auth:', existingAuthUser.id);
        newUserId = existingAuthUser.id;
      } else {
        // Criar usuário no Auth com senha temporária
        const tempPassword = crypto.randomUUID().slice(0, 12) + 'Aa1!';
        const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { name: name || '' },
        });

        if (authError) {
          console.error('ERRO ao criar usuário no Auth:', authError);
          throw new Error(`Erro ao criar usuário no Auth: ${authError.message}`);
        }

        newUserId = newAuthUser.user.id;
        console.log('Usuário criado no Auth:', newUserId);

        // Enviar email de reset de senha para o usuário definir sua senha
        try {
          const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
            redirectTo: 'https://app.replyna.me/reset-password',
          });
          if (resetError) {
            console.error('Erro ao enviar email de reset:', resetError);
          } else {
            console.log('Email de definição de senha enviado para:', email);
          }
        } catch (resetErr) {
          console.error('Exceção ao enviar email de reset:', resetErr);
        }
      }

      // Agora criar na tabela users
      const userData = {
        id: newUserId,
        email: email.toLowerCase(),
        name: name || null,
        plan: metadata.plan_name?.toLowerCase() || 'starter',
        emails_limit: parseInt(metadata.emails_limit || '500'),
        shops_limit: parseInt(metadata.shops_limit || '1'),
        emails_used: 0,
        stripe_customer_id: customerId,
        status: 'active',
      };
      console.log('Dados do usuário:', JSON.stringify(userData));

      const { error: createError } = await supabaseAdmin
        .from('users')
        .insert(userData);

      if (createError) {
        console.error('ERRO ao criar usuário na tabela users:', createError);
        throw new Error(`Erro ao criar usuário: ${createError.message}`);
      }

      userId = newUserId;
      console.log('Novo usuário criado com sucesso! ID:', userId);
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
    console.log('Registrando uso de cupom:', metadata.coupon_id);
    await supabase.rpc('use_coupon', {
      p_coupon_id: metadata.coupon_id,
      p_user_id: userId,
      p_discount_applied: 0, // TODO: calcular desconto
      p_subscription_id: subscriptionId,
    });
  }

  // Marcar convite de migração como aceito se aplicável
  if (metadata.migration_invite_id) {
    console.log('Marcando convite de migração como aceito:', metadata.migration_invite_id);

    // Primeiro, verificar o status atual do convite
    const { data: currentInvite, error: checkError } = await supabase
      .from('migration_invites')
      .select('id, status, code')
      .eq('id', metadata.migration_invite_id)
      .single();

    if (checkError) {
      console.error('Erro ao buscar convite de migração:', checkError);
    } else if (!currentInvite) {
      console.error('Convite de migração não encontrado com ID:', metadata.migration_invite_id);
    } else {
      console.log('Status atual do convite:', currentInvite.status, '- Código:', currentInvite.code);

      // Atualizar independente do status atual (exceto se já estiver 'accepted')
      if (currentInvite.status !== 'accepted') {
        const { error: inviteError, count } = await supabase
          .from('migration_invites')
          .update({
            status: 'accepted',
            accepted_by_user_id: userId,
            accepted_at: new Date().toISOString(),
          })
          .eq('id', metadata.migration_invite_id);

        if (inviteError) {
          console.error('Erro ao atualizar convite de migração:', inviteError);
        } else {
          console.log('Convite de migração atualizado. Linhas afetadas:', count);
        }
      } else {
        console.log('Convite já estava marcado como aceito');
      }
    }
  }

  // Atualizar metadata do customer no Stripe com user_id correto
  console.log('Atualizando metadata do customer no Stripe com user_id:', userId);
  await stripe.customers.update(customerId, {
    metadata: { user_id: userId },
  });

  console.log('=== Checkout processado com SUCESSO para usuário:', userId, '===');
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
