/**
 * Edge Function: Update Payment Method
 *
 * Busca a proxima cobranca pendente ou vencida da assinatura do usuario
 * e retorna a invoiceUrl do Asaas para que o usuario possa pagar
 * com um novo cartao de credito.
 *
 * Quando o usuario paga pela pagina do Asaas com um novo cartao,
 * o Asaas automaticamente atualiza o metodo de pagamento para cobranças futuras.
 */

import { getCorsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
import {
  getPaymentsBySubscription,
  getPaymentsByCustomer,
} from '../_shared/asaas.ts';

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id e obrigatorio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();

    // Buscar usuario e assinatura ativa
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('asaas_customer_id')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuario nao encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!user.asaas_customer_id) {
      return new Response(
        JSON.stringify({ error: 'Usuario nao possui cadastro no Asaas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar assinatura ativa do usuario
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('asaas_subscription_id, status')
      .eq('user_id', user_id)
      .in('status', ['active', 'past_due', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1);

    const subscription = subscriptions?.[0] || null;

    let invoiceUrl: string | null = null;

    // Estrategia 1: Buscar cobranca pendente/vencida da assinatura
    if (subscription?.asaas_subscription_id) {
      // Buscar pagamentos PENDING (proxima cobranca)
      const pendingPayments = await getPaymentsBySubscription(
        subscription.asaas_subscription_id,
        { status: 'PENDING', limit: 1, order: 'asc' }
      );

      if (pendingPayments.data?.length > 0 && pendingPayments.data[0].invoiceUrl) {
        invoiceUrl = pendingPayments.data[0].invoiceUrl;
      }

      // Se nao achou PENDING, buscar OVERDUE
      if (!invoiceUrl) {
        const overduePayments = await getPaymentsBySubscription(
          subscription.asaas_subscription_id,
          { status: 'OVERDUE', limit: 1, order: 'desc' }
        );

        if (overduePayments.data?.length > 0 && overduePayments.data[0].invoiceUrl) {
          invoiceUrl = overduePayments.data[0].invoiceUrl;
        }
      }
    }

    // Estrategia 2: Buscar qualquer cobranca pendente do cliente
    if (!invoiceUrl) {
      const customerPayments = await getPaymentsByCustomer(
        user.asaas_customer_id,
        { status: 'PENDING', limit: 1, order: 'asc' }
      );

      if (customerPayments.data?.length > 0 && customerPayments.data[0].invoiceUrl) {
        invoiceUrl = customerPayments.data[0].invoiceUrl;
      }
    }

    if (!invoiceUrl) {
      const customerOverdue = await getPaymentsByCustomer(
        user.asaas_customer_id,
        { status: 'OVERDUE', limit: 1, order: 'desc' }
      );

      if (customerOverdue.data?.length > 0 && customerOverdue.data[0].invoiceUrl) {
        invoiceUrl = customerOverdue.data[0].invoiceUrl;
      }
    }

    if (!invoiceUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Nenhuma cobranca pendente encontrada. O metodo de pagamento sera atualizado automaticamente na proxima cobranca.',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: invoiceUrl,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao buscar link de atualizacao de pagamento:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
