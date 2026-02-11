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
 *
 * Compatível com Deno v2.x (Supabase Edge Runtime 1.70+)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getStripeClient, verifyWebhookSignature, Stripe } from '../_shared/stripe.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
import { maskEmail } from '../_shared/email.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

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

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

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
  console.log('Customer Email:', maskEmail(session.customer_email));
  console.log('Customer Details:', JSON.stringify(session.customer_details));
  console.log('Metadata:', JSON.stringify(session.metadata));

  const metadata = session.metadata || {};
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  // Verificar se é pagamento de emails extras
  if (metadata.type === 'extra_emails_payment' && metadata.purchase_id) {
    console.log('=== Processando pagamento de emails extras ===');
    const purchaseId = metadata.purchase_id;
    const paymentIntentId = session.payment_intent as string;

    // Buscar user_id da compra antes de confirmar
    const { data: purchase } = await supabase
      .from('extra_email_purchases')
      .select('user_id')
      .eq('id', purchaseId)
      .single();

    // Confirmar a compra no banco
    const { error: confirmError } = await supabase.rpc('confirm_extra_email_purchase', {
      p_purchase_id: purchaseId,
      p_stripe_invoice_id: null,
      p_stripe_charge_id: paymentIntentId,
    });

    if (confirmError) {
      console.error('Erro ao confirmar compra de emails extras:', confirmError);
      throw new Error(`Erro ao confirmar compra: ${confirmError.message}`);
    }

    console.log('Compra de emails extras confirmada:', purchaseId);

    // Reprocessar mensagens pendentes de créditos para este usuário
    if (purchase?.user_id) {
      await processPendingCreditsForUser(purchase.user_id);
    }

    return;
  }

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

    console.log('Criando novo usuário - Email:', maskEmail(email), 'Nome:', name);

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

      // Se é fluxo de migração, enviar email de reset de senha mesmo para usuário existente
      if (metadata.migration_invite_id) {
        const supabaseAdmin = getSupabaseAdminClient();
        try {
          console.log('Enviando email de reset de senha para usuário existente (migração):', maskEmail(email));
          const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
            redirectTo: 'https://app.replyna.me/reset-password',
          });
          if (resetError) {
            console.error('Erro ao enviar email de reset:', resetError);
          } else {
            console.log('Email de definição de senha enviado com sucesso para:', maskEmail(email));
          }
        } catch (resetErr) {
          console.error('Exceção ao enviar email de reset:', resetErr);
        }
      }
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
      }

      // Enviar email de reset de senha para o usuário definir sua senha
      // Envia sempre (seja usuário novo ou existente no Auth)
      try {
        console.log('Enviando email de reset de senha para:', maskEmail(email));
        const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
          redirectTo: 'https://app.replyna.me/reset-password',
        });
        if (resetError) {
          console.error('Erro ao enviar email de reset:', resetError);
        } else {
          console.log('Email de definição de senha enviado com sucesso para:', maskEmail(email));
        }
      } catch (resetErr) {
        console.error('Exceção ao enviar email de reset:', resetErr);
      }

      // Agora criar na tabela users
      // Parsear limites: 'unlimited' = null, número = valor numérico
      const parseLimit = (value: string | undefined, defaultValue: number): number | null => {
        if (!value || value === 'unlimited') return null;
        const parsed = parseInt(value);
        return isNaN(parsed) ? defaultValue : parsed;
      };

      const userData = {
        id: newUserId,
        email: email.toLowerCase(),
        name: name || null,
        plan: metadata.plan_name?.toLowerCase() || 'starter',
        emails_limit: parseLimit(metadata.emails_limit, 500),
        shops_limit: parseLimit(metadata.shops_limit, 1),
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
  // Parsear limites: 'unlimited' = null, número = valor numérico
  const parseLimitForUpdate = (value: string | undefined, defaultValue: number): number | null => {
    if (!value || value === 'unlimited') return null;
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  await supabase
    .from('users')
    .update({
      stripe_customer_id: customerId,
      plan: metadata.plan_name?.toLowerCase() || 'starter',
      emails_limit: parseLimitForUpdate(metadata.emails_limit, 500),
      shops_limit: parseLimitForUpdate(metadata.shops_limit, 1),
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

  // Verificar se já existe assinatura com esse stripe_subscription_id
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
    // Antes de inserir, cancelar outras assinaturas ativas do mesmo usuário
    // para evitar duplicatas (ex: usuário fez checkout 2x)
    const { data: oldSubs } = await supabase
      .from('subscriptions')
      .select('id, stripe_subscription_id')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing', 'past_due'])
      .neq('stripe_subscription_id', subscriptionId);

    if (oldSubs && oldSubs.length > 0) {
      console.log(`Cancelando ${oldSubs.length} assinatura(s) antiga(s) do usuário ${userId}`);
      for (const oldSub of oldSubs) {
        // Cancelar no Stripe
        try {
          await stripe.subscriptions.cancel(oldSub.stripe_subscription_id);
          console.log('Subscription cancelada no Stripe:', oldSub.stripe_subscription_id);
        } catch (cancelErr) {
          console.error('Erro ao cancelar subscription antiga no Stripe:', cancelErr);
        }
        // Marcar como cancelada no banco
        await supabase
          .from('subscriptions')
          .update({ status: 'canceled', canceled_at: new Date().toISOString() })
          .eq('id', oldSub.id);
      }
    }

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

  // Helper para converter timestamp Stripe para ISO string (previne Invalid Date)
  const toISOStringOrNull = (timestamp: number | null | undefined): string | null => {
    if (!timestamp || typeof timestamp !== 'number' || timestamp <= 0) return null;
    const date = new Date(timestamp * 1000);
    return isNaN(date.getTime()) ? null : date.toISOString();
  };

  // Atualizar assinatura
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status,
      stripe_price_id: priceId,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: toISOStringOrNull(subscription.canceled_at as number | null),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Erro ao atualizar assinatura:', error);
  }

  // Buscar subscription e usuário associado
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id, plan_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!sub?.user_id) {
    console.log('Subscription não encontrada no banco:', subscription.id);
    return;
  }

  // Se cancelado ou unpaid, atualizar status do usuário para free
  if (status === 'canceled' || status === 'unpaid') {
    await supabase
      .from('users')
      .update({
        status: status === 'canceled' ? 'inactive' : 'suspended',
        plan: 'free',
        emails_limit: 0,
        shops_limit: 0,
      })
      .eq('id', sub.user_id);
    console.log('Usuário atualizado para free devido a status:', status);
    return;
  }

  // Para outros status (active, trialing, etc), sincronizar plano baseado no price_id
  if (priceId) {
    // Buscar plano pelo stripe_price_id (mensal ou anual)
    const { data: plan } = await supabase
      .from('plans')
      .select('id, name, emails_limit, shops_limit')
      .or(`stripe_price_monthly_id.eq.${priceId},stripe_price_yearly_id.eq.${priceId}`)
      .single();

    if (plan) {
      // Atualizar subscription com o plan_id correto
      await supabase
        .from('subscriptions')
        .update({ plan_id: plan.id })
        .eq('stripe_subscription_id', subscription.id);

      // Atualizar usuário com os dados do novo plano
      // Quando faz upgrade, zera os contadores de emails usados (novo ciclo de billing)
      const { error: userError } = await supabase
        .from('users')
        .update({
          plan: plan.name,
          emails_limit: plan.emails_limit,
          shops_limit: plan.shops_limit,
          emails_used: 0,
          extra_emails_used: 0,
          pending_extra_emails: 0,
        })
        .eq('id', sub.user_id);

      if (userError) {
        console.error('Erro ao atualizar usuário com novo plano:', userError);
      } else {
        console.log(`Usuário ${sub.user_id} atualizado para plano: ${plan.name}`);
      }
    } else {
      console.log('Plano não encontrado para price_id:', priceId);
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
 * Fatura paga - renovação de assinatura ou pagamento atrasado regularizado
 */
async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  supabase: ReturnType<typeof getSupabaseClient>
) {
  console.log('Processando invoice.paid:', invoice.id);

  if (!invoice.subscription) return;

  const subscriptionId = invoice.subscription as string;

  // Buscar subscription atualizada do Stripe para obter as datas corretas
  const stripe = getStripeClient();
  let stripeSubscription: Stripe.Subscription | null = null;

  try {
    stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    console.log('Subscription do Stripe:', {
      id: stripeSubscription.id,
      status: stripeSubscription.status,
      current_period_start: stripeSubscription.current_period_start,
      current_period_end: stripeSubscription.current_period_end,
    });
  } catch (stripeError) {
    console.error('Erro ao buscar subscription do Stripe:', stripeError);
  }

  // Preparar dados de atualização da subscription
  const subscriptionUpdate: Record<string, any> = {
    status: 'active',
    updated_at: new Date().toISOString(),
  };

  // Se conseguimos buscar a subscription do Stripe, sincronizar as datas do período
  if (stripeSubscription) {
    subscriptionUpdate.current_period_start = new Date(stripeSubscription.current_period_start * 1000).toISOString();
    subscriptionUpdate.current_period_end = new Date(stripeSubscription.current_period_end * 1000).toISOString();
    console.log('Sincronizando datas do período:', {
      current_period_start: subscriptionUpdate.current_period_start,
      current_period_end: subscriptionUpdate.current_period_end,
    });
  }

  // Atualizar subscription no banco
  const { error: subError } = await supabase
    .from('subscriptions')
    .update(subscriptionUpdate)
    .eq('stripe_subscription_id', subscriptionId);

  if (subError) {
    console.error('Erro ao atualizar subscription:', subError);
  }

  // Buscar assinatura
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id, plan_id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!sub) return;

  // SEMPRE reativar o usuário quando pagamento é realizado
  console.log('Reativando usuário após pagamento:', sub.user_id);

  // Resetar emails_used no início do novo período e reativar conta
  await supabase
    .from('users')
    .update({
      emails_used: 0,
      status: 'active',
    })
    .eq('id', sub.user_id);

  console.log('Usuário reativado e créditos resetados:', sub.user_id);

  // Reprocessar mensagens pendentes para este usuário
  await processPendingCreditsForUser(sub.user_id);
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

/**
 * Reprocessa mensagens pendentes de créditos
 * Chamada automaticamente quando o usuário compra créditos extras ou renova assinatura
 */
async function processPendingCreditsForUser(userId: string): Promise<void> {
  try {
    console.log('[stripe-webhook] Chamando process-pending-credits para user:', userId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const response = await fetch(`${supabaseUrl}/functions/v1/process-pending-credits`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[stripe-webhook] Erro ao chamar process-pending-credits:', response.status, errorText);
    } else {
      const result = await response.json();
      console.log('[stripe-webhook] process-pending-credits resultado:', JSON.stringify(result));
    }
  } catch (error) {
    console.error('[stripe-webhook] Exceção ao chamar process-pending-credits:', error);
    // Não lançamos erro aqui para não interromper o fluxo do webhook
  }
}
