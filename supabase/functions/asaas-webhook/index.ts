/**
 * Edge Function: Asaas Webhook
 *
 * Recebe webhooks do Asaas para eventos de pagamento e assinatura.
 * Atualiza status do usuario e subscription no banco de dados.
 *
 * Eventos tratados:
 * - PAYMENT_RECEIVED / PAYMENT_CONFIRMED: pagamento confirmado -> ativa usuario + reset creditos no novo ciclo
 * - PAYMENT_OVERDUE: pagamento vencido -> suspende usuario
 * - PAYMENT_DELETED / PAYMENT_REFUNDED / PAYMENT_CHARGEBACK: pagamento cancelado -> suspende usuario
 * - SUBSCRIPTION_DELETED / SUBSCRIPTION_INACTIVATED: assinatura cancelada -> desativa usuario
 *
 * Configuracao no Asaas:
 *   URL: https://ulldjamxdsaqqyurcmcs.supabase.co/functions/v1/asaas-webhook
 *   Auth Token: configurar ASAAS_WEBHOOK_TOKEN nas env vars do Supabase
 *
 * Apos processar, encaminha o payload para as URLs do N8N existentes:
 *   - Assinaturas: https://www.replyna.me/api/webhooks/asaas/subscriptions
 *   - Cobrancas: https://www.replyna.me/api/webhooks/asaas/payments
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';

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

// URLs do N8N para encaminhar o payload apos processar
const N8N_FORWARD_URLS = {
  subscriptions: 'https://www.replyna.me/api/webhooks/asaas/subscriptions',
  payments: 'https://www.replyna.me/api/webhooks/asaas/payments',
};

/**
 * Encaminha o payload original para as URLs do N8N.
 * Eventos de subscription vao para a URL de subscriptions, eventos de payment para payments.
 * Fire-and-forget: nao bloqueia o processamento se o N8N falhar.
 */
async function forwardToN8N(payload: AsaasWebhookPayload): Promise<void> {
  const event = payload.event;
  const isSubscriptionEvent = event.startsWith('SUBSCRIPTION_');
  const url = isSubscriptionEvent ? N8N_FORWARD_URLS.subscriptions : N8N_FORWARD_URLS.payments;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log(`[AsaasWebhook] Encaminhado para N8N (${isSubscriptionEvent ? 'subscriptions' : 'payments'}): ${response.status}`);
  } catch (error) {
    console.error(`[AsaasWebhook] Erro ao encaminhar para N8N:`, error);
  }
}

function maskId(id: string | undefined): string {
  if (!id) return '(none)';
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}

// Asaas webhook event types we handle
type AsaasEvent =
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_DELETED'
  | 'PAYMENT_REFUNDED'
  | 'PAYMENT_CHARGEBACK_REQUESTED'
  | 'PAYMENT_CHARGEBACK_DISPUTE'
  | 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL'
  | 'SUBSCRIPTION_DELETED'
  | 'SUBSCRIPTION_INACTIVATED';

interface AsaasWebhookPayload {
  event: string;
  payment?: {
    id: string;
    customer: string;
    subscription?: string;
    billingType: string;
    value: number;
    dueDate?: string;
    status: string;
    invoiceUrl?: string;
  };
  subscription?: {
    id: string;
    customer: string;
    status: string;
    value: number;
  };
}

serve(async (req) => {
  // Webhook do Asaas envia POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Validar token de autenticacao (opcional mas recomendado)
    const webhookToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN');
    if (webhookToken) {
      const authHeader = req.headers.get('asaas-access-token') || req.headers.get('access_token');
      if (authHeader !== webhookToken) {
        console.error('[AsaasWebhook] Token invalido');
        return new Response('Unauthorized', { status: 401 });
      }
    }

    const payload: AsaasWebhookPayload = await req.json();
    const event = payload.event;

    console.log(`[AsaasWebhook] Evento recebido: ${event}`);

    const supabase = getSupabaseAdmin();

    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        await handlePaymentConfirmed(supabase, payload);
        break;

      case 'PAYMENT_OVERDUE':
        await handlePaymentOverdue(supabase, payload);
        break;

      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_CHARGEBACK_REQUESTED':
      case 'PAYMENT_CHARGEBACK_DISPUTE':
      case 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL':
        await handlePaymentFailed(supabase, payload);
        break;

      case 'SUBSCRIPTION_DELETED':
      case 'SUBSCRIPTION_INACTIVATED':
        await handleSubscriptionCanceled(supabase, payload);
        break;

      default:
        console.log(`[AsaasWebhook] Evento ignorado: ${event}`);
    }

    // Encaminhar payload para o N8N (fire-and-forget, nao bloqueia resposta)
    forwardToN8N(payload);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[AsaasWebhook] Erro ao processar webhook:', error);
    // Retornar 200 para o Asaas nao reenviar indefinidamente
    return new Response(JSON.stringify({ received: true, error: error.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Busca a subscription no banco pelo asaas_subscription_id
 */
async function findSubscription(supabase: ReturnType<typeof getSupabaseAdmin>, asaasSubscriptionId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, user_id, plan_id, status, current_period_start, current_period_end')
    .eq('asaas_subscription_id', asaasSubscriptionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    console.warn(`[AsaasWebhook] Subscription nao encontrada: ${maskId(asaasSubscriptionId)}`);
    return null;
  }
  return data;
}

/**
 * Busca a subscription pelo asaas_customer_id (fallback quando nao tem subscription_id)
 */
async function findSubscriptionByCustomer(supabase: ReturnType<typeof getSupabaseAdmin>, asaasCustomerId: string) {
  const { data } = await supabase
    .from('subscriptions')
    .select('id, user_id, plan_id, status, current_period_start, current_period_end, asaas_subscription_id')
    .eq('asaas_customer_id', asaasCustomerId)
    .in('status', ['active', 'trialing', 'incomplete', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data || null;
}

/**
 * Verifica se um pagamento avulso (sem subscription) eh de emails extras.
 * Se for, confirma a compra e libera os creditos para o usuario.
 * Retorna true se tratou o pagamento, false se nao eh de emails extras.
 */
async function handleExtraEmailPayment(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  payment: NonNullable<AsaasWebhookPayload['payment']>
): Promise<boolean> {
  // Buscar compra de emails extras pelo asaas_payment_id
  const { data: purchase, error } = await supabase
    .from('email_extra_purchases')
    .select('id, user_id, package_size, status')
    .eq('asaas_payment_id', payment.id)
    .single();

  if (error || !purchase) {
    return false;
  }

  if (purchase.status === 'completed') {
    console.log(`[AsaasWebhook] Compra de emails extras ${maskId(purchase.id)} ja confirmada`);
    return true;
  }

  // Usar a RPC que marca como completed E libera creditos de forma atomica
  const { error: rpcError } = await supabase.rpc('confirm_extra_email_purchase', {
    p_purchase_id: purchase.id,
  });

  if (rpcError) {
    console.error(`[AsaasWebhook] Erro ao confirmar compra de emails extras: ${rpcError.message}`);
    return false;
  }

  console.log(
    `[AsaasWebhook] Compra de emails extras confirmada: ${purchase.package_size} emails para user ${maskId(purchase.user_id)}`
  );
  return true;
}

/**
 * PAYMENT_RECEIVED / PAYMENT_CONFIRMED
 *
 * Pagamento confirmado. Se eh renovacao mensal, reseta creditos e ativa usuario.
 * Se eh primeiro pagamento, ativa subscription que estava incomplete.
 */
async function handlePaymentConfirmed(supabase: ReturnType<typeof getSupabaseAdmin>, payload: AsaasWebhookPayload) {
  const payment = payload.payment;
  if (!payment) {
    console.warn('[AsaasWebhook] PAYMENT_CONFIRMED sem dados de payment');
    return;
  }

  const asaasSubId = payment.subscription;
  if (!asaasSubId) {
    // Verificar se eh pagamento de emails extras
    const handled = await handleExtraEmailPayment(supabase, payment);
    if (!handled) {
      console.log('[AsaasWebhook] Pagamento avulso (sem subscription), ignorando');
    }
    return;
  }

  let sub = await findSubscription(supabase, asaasSubId);
  if (!sub) {
    // Fallback: buscar pelo customer
    sub = await findSubscriptionByCustomer(supabase, payment.customer);
    if (!sub) {
      console.warn(`[AsaasWebhook] Nenhuma subscription encontrada para payment ${maskId(payment.id)}`);
      return;
    }
  }

  // Buscar plano para obter limites
  const { data: plan } = await supabase
    .from('plans')
    .select('name, emails_limit, shops_limit')
    .eq('id', sub.plan_id)
    .single();

  if (!plan) {
    console.error(`[AsaasWebhook] Plano nao encontrado: ${sub.plan_id}`);
    return;
  }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 30);

  // Verificar se eh renovacao, reativacao apos atraso, ou primeiro pagamento
  const isRenewal = sub.status === 'active';
  const isReactivation = sub.status === 'past_due';
  const isFirstPayment = sub.status === 'incomplete';

  // Atualizar subscription
  await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', sub.id);

  // Atualizar usuario: ativar + resetar creditos no novo ciclo
  const userUpdate: Record<string, unknown> = {
    status: 'active',
    plan: plan.name,
    emails_limit: plan.emails_limit,
    shops_limit: plan.shops_limit,
    is_trial: false,
    updated_at: now.toISOString(),
  };

  // Resetar creditos em renovacao, primeiro pagamento, ou reativacao
  if (isRenewal || isFirstPayment || isReactivation) {
    userUpdate.emails_used = 0;
    userUpdate.extra_emails_purchased = 0;
    userUpdate.extra_emails_used = 0;
    userUpdate.pending_extra_emails = 0;
    userUpdate.credits_warning_count = 0;
    userUpdate.last_credits_warning_at = null;
  }

  await supabase
    .from('users')
    .update(userUpdate)
    .eq('id', sub.user_id);

  const eventLabel = isRenewal ? 'Renovacao' : isReactivation ? 'Reativacao' : 'Primeiro pagamento';
  console.log(
    `[AsaasWebhook] ${eventLabel} confirmado para user ${maskId(sub.user_id)}, ` +
    `plano ${plan.name}, creditos resetados`
  );

  // Mensagens que ficaram com status 'pending_credits' durante a suspensao
  // serao reprocessadas automaticamente no proximo ciclo de processamento,
  // pois getPendingMessages() ja busca mensagens com status 'pending_credits'.
}

/**
 * PAYMENT_OVERDUE
 *
 * Pagamento vencido. Suspende o usuario (mantem plano para quando pagar).
 */
async function handlePaymentOverdue(supabase: ReturnType<typeof getSupabaseAdmin>, payload: AsaasWebhookPayload) {
  const payment = payload.payment;
  if (!payment) return;

  const asaasSubId = payment.subscription;
  if (!asaasSubId) return;

  let sub = await findSubscription(supabase, asaasSubId);
  if (!sub) {
    sub = await findSubscriptionByCustomer(supabase, payment.customer);
    if (!sub) return;
  }

  // Atualizar subscription para past_due
  await supabase
    .from('subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id);

  // Suspender usuario (mantem plano e limites para quando regularizar)
  await supabase
    .from('users')
    .update({
      status: 'suspended',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.user_id);

  console.log(`[AsaasWebhook] Usuario ${maskId(sub.user_id)} suspenso - pagamento vencido`);
}

/**
 * PAYMENT_DELETED / PAYMENT_REFUNDED / PAYMENT_CHARGEBACK
 *
 * Pagamento cancelado/estornado. Suspende o usuario.
 */
async function handlePaymentFailed(supabase: ReturnType<typeof getSupabaseAdmin>, payload: AsaasWebhookPayload) {
  const payment = payload.payment;
  if (!payment) return;

  const asaasSubId = payment.subscription;
  if (!asaasSubId) return;

  let sub = await findSubscription(supabase, asaasSubId);
  if (!sub) {
    sub = await findSubscriptionByCustomer(supabase, payment.customer);
    if (!sub) return;
  }

  await supabase
    .from('subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id);

  await supabase
    .from('users')
    .update({
      status: 'suspended',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.user_id);

  console.log(`[AsaasWebhook] Usuario ${maskId(sub.user_id)} suspenso - ${payload.event}`);
}

/**
 * SUBSCRIPTION_DELETED / SUBSCRIPTION_INACTIVATED
 *
 * Assinatura cancelada/removida. Desativa o usuario completamente.
 */
async function handleSubscriptionCanceled(supabase: ReturnType<typeof getSupabaseAdmin>, payload: AsaasWebhookPayload) {
  // O Asaas envia o subscription ID no campo subscription (nivel raiz) ou no payment.subscription
  const asaasSubId = payload.subscription?.id || payload.payment?.subscription;
  if (!asaasSubId) {
    console.warn('[AsaasWebhook] SUBSCRIPTION_DELETED sem subscription ID');
    return;
  }

  const sub = await findSubscription(supabase, asaasSubId);
  if (!sub) return;

  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id);

  await supabase
    .from('users')
    .update({
      status: 'inactive',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.user_id);

  console.log(`[AsaasWebhook] Usuario ${maskId(sub.user_id)} inativado - assinatura cancelada`);
}

