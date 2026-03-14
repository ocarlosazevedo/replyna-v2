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
        plan: plan.slug,
        emails_limit: plan.emails_limit,
        shops_limit: plan.shops_limit,
        status: 'active',
        is_trial: false,
        trial_ends_at: null,
        emails_used: 0,
        updated_at: now.toISOString(),
      })
      .eq('id', user_id);

    console.log(`[ConfirmPayment] User ${user_id} ativado com plano ${plan.name}`);

    // Atualizar lojas: remover filtro de data para buscar TODOS os emails não lidos
    // e marcar para backfill de emails antigos que foram marcados como lidos no trial
    const { data: userShops } = await supabase
      .from('shops')
      .select('id')
      .eq('user_id', user_id);

    if (userShops && userShops.length > 0) {
      const shopIds = userShops.map((s: any) => s.id);

      // Mudar para all_unread: próximo fetch vai buscar TODOS os não lidos sem filtro de data
      await supabase
        .from('shops')
        .update({
          email_start_mode: 'all_unread',
          pending_backfill: true,
          updated_at: now.toISOString(),
        })
        .in('id', shopIds);

      console.log(`[ConfirmPayment] ${shopIds.length} loja(s) atualizadas para all_unread + backfill`);

      // Re-enfileirar mensagens pending_credits para serem processadas agora
      for (const shopId of shopIds) {
        const { data: pendingMessages } = await supabase
          .from('messages')
          .select('id, conversation:conversations!inner(shop_id)')
          .eq('status', 'pending_credits')
          .eq('direction', 'inbound')
          .eq('conversation.shop_id', shopId);

        if (pendingMessages && pendingMessages.length > 0) {
          // Atualizar status para pending
          const messageIds = pendingMessages.map((m: any) => m.id);
          await supabase
            .from('messages')
            .update({ status: 'pending', updated_at: now.toISOString() })
            .in('id', messageIds);

          // Enfileirar cada mensagem na job_queue
          for (const msg of pendingMessages) {
            await supabase.rpc('enqueue_job', {
              p_job_type: 'process_email',
              p_shop_id: shopId,
              p_message_id: msg.id,
              p_payload: {},
              p_priority: 0,
              p_max_attempts: 3,
            });
          }

          console.log(`[ConfirmPayment] ${pendingMessages.length} mensagens pending_credits re-enfileiradas para loja ${shopId}`);
        }
      }
    }

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
