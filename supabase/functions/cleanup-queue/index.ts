/**
 * Edge Function: cleanup-queue
 *
 * Função de manutenção automática da fila de processamento.
 * Executada a cada 5 minutos via pg_cron.
 *
 * Responsabilidades:
 * 1. Recriar jobs para mensagens pendentes que não têm jobs ativos
 * 2. Limpar jobs antigos da dead_letter com erros transitórios
 * 3. Resetar mensagens stuck em "processing" há mais de 10 minutos
 */

import { getSupabaseClient } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Erros transitórios que devem ser re-tentados
const TRANSIENT_ERROR_PATTERNS = [
  'overloaded',
  'timeout',
  'rate_limit',
  'connection',
  '503',
  '502',
  '504',
  '529',
  'network',
  'econnreset',
];

interface CleanupResult {
  success: boolean;
  orphan_messages_fixed: number;
  stuck_messages_reset: number;
  transient_jobs_retried: number;
  old_dlq_cleaned: number;
  execution_time_ms: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabase = getSupabaseClient();

  const result: CleanupResult = {
    success: true,
    orphan_messages_fixed: 0,
    stuck_messages_reset: 0,
    transient_jobs_retried: 0,
    old_dlq_cleaned: 0,
    execution_time_ms: 0,
  };

  try {
    console.log('[Cleanup] Starting queue cleanup...');

    // =====================================================
    // 1. Resetar mensagens stuck em "processing" há mais de 10 minutos
    // =====================================================
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: stuckMessages, error: stuckError } = await supabase
      .from('messages')
      .update({ status: 'pending' })
      .eq('status', 'processing')
      .lt('created_at', tenMinutesAgo)
      .select('id');

    if (!stuckError && stuckMessages) {
      result.stuck_messages_reset = stuckMessages.length;
      if (stuckMessages.length > 0) {
        console.log(`[Cleanup] Reset ${stuckMessages.length} stuck messages to pending`);
      }
    }

    // =====================================================
    // 2. Encontrar mensagens pendentes sem jobs ativos
    // =====================================================
    const { data: pendingMessages, error: pendingError } = await supabase
      .from('messages')
      .select('id, conversation_id')
      .eq('status', 'pending')
      .eq('direction', 'inbound');

    if (pendingError) {
      console.error('[Cleanup] Error fetching pending messages:', pendingError);
    } else if (pendingMessages && pendingMessages.length > 0) {
      // Buscar jobs ativos (pending ou processing)
      const { data: activeJobs } = await supabase
        .from('job_queue')
        .select('message_id')
        .in('status', ['pending', 'processing']);

      const activeMessageIds = new Set((activeJobs || []).map(j => j.message_id));

      // Encontrar mensagens órfãs (sem job ativo)
      const orphanMessages = pendingMessages.filter(m => !activeMessageIds.has(m.id));

      if (orphanMessages.length > 0) {
        console.log(`[Cleanup] Found ${orphanMessages.length} orphan messages without active jobs`);

        for (const msg of orphanMessages) {
          // Buscar shop_id da conversa
          const { data: conv } = await supabase
            .from('conversations')
            .select('shop_id')
            .eq('id', msg.conversation_id)
            .single();

          if (conv?.shop_id) {
            // Deletar jobs antigos (completed, dead_letter) para esta mensagem
            await supabase
              .from('job_queue')
              .delete()
              .eq('message_id', msg.id);

            // Criar novo job
            const { error: enqueueError } = await supabase.rpc('enqueue_job', {
              p_job_type: 'process_email',
              p_shop_id: conv.shop_id,
              p_message_id: msg.id,
              p_payload: {},
              p_priority: 0,
              p_max_attempts: 3,
            });

            if (!enqueueError) {
              result.orphan_messages_fixed++;
            }
          }
        }

        console.log(`[Cleanup] Created jobs for ${result.orphan_messages_fixed} orphan messages`);
      }
    }

    // =====================================================
    // 3. Retry jobs com erros transitórios na dead_letter (últimas 24h)
    // =====================================================
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: dlqJobs, error: dlqError } = await supabase
      .from('job_queue')
      .select('id, message_id, error_message')
      .eq('status', 'dead_letter')
      .gt('completed_at', oneDayAgo);

    if (!dlqError && dlqJobs) {
      for (const job of dlqJobs) {
        const errorLower = (job.error_message || '').toLowerCase();
        const isTransient = TRANSIENT_ERROR_PATTERNS.some(p => errorLower.includes(p));

        if (!isTransient) continue;

        // Verificar se mensagem ainda está pendente
        const { data: msg } = await supabase
          .from('messages')
          .select('status')
          .eq('id', job.message_id)
          .single();

        if (msg?.status !== 'pending') continue;

        // Resetar job para pending
        const { error: resetError } = await supabase
          .from('job_queue')
          .update({
            status: 'pending',
            attempt_count: 0,
            error_message: null,
            error_type: null,
            error_stack: null,
            last_error_at: null,
            next_retry_at: null,
            started_at: null,
            completed_at: null,
          })
          .eq('id', job.id);

        if (!resetError) {
          result.transient_jobs_retried++;
        }
      }

      if (result.transient_jobs_retried > 0) {
        console.log(`[Cleanup] Retried ${result.transient_jobs_retried} jobs with transient errors`);
      }
    }

    // =====================================================
    // 4. Limpar jobs muito antigos da dead_letter (mais de 7 dias)
    // =====================================================
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: oldDlqJobs, error: oldDlqError } = await supabase
      .from('job_queue')
      .delete()
      .eq('status', 'dead_letter')
      .lt('completed_at', sevenDaysAgo)
      .select('id');

    if (!oldDlqError && oldDlqJobs) {
      result.old_dlq_cleaned = oldDlqJobs.length;
      if (oldDlqJobs.length > 0) {
        console.log(`[Cleanup] Cleaned ${oldDlqJobs.length} old dead_letter jobs`);
      }
    }

    result.execution_time_ms = Date.now() - startTime;

    console.log('[Cleanup] Completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Cleanup] Fatal error:', errorMessage);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        execution_time_ms: Date.now() - startTime,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
