/**
 * Edge Function: process-queue (Processing Worker)
 *
 * Processa jobs da fila com retry automático e DLQ.
 * Chamado via pg_cron a cada 1 minuto.
 *
 * Fluxo:
 * 1. Dequeue batch de jobs (15 por vez, with 2s delay to avoid rate limits)
 * 2. Para cada job:
 *    - Processar email (classificar + responder)
 *    - Se success: complete_job()
 *    - Se error transient: fail_job() com retry
 *    - Se error permanent: fail_job() sem retry
 *    - Se max retries: fail_job() → DLQ
 * 3. Retornar estatísticas
 */

// deno-lint-ignore-file no-explicit-any
import { getSupabaseClient } from '../_shared/supabase.ts';

// Importar lógica de processamento existente
// NOTA: Este arquivo vai usar funções de _shared/ que já existem
import { processMessageFromQueue } from './processor.ts';

const BATCH_SIZE = 15; // Reduced from 50 to avoid Claude API rate limit (100k tokens/min)
const MAX_EXECUTION_TIME_MS = 110000; // 110 seconds
const DELAY_BETWEEN_JOBS_MS = 2000; // 2 second delay between jobs to spread API calls

// Shops que só processam via botão "Forçar resposta IA" (manual)
const MANUAL_PROCESSING_ONLY_SHOPS = [
  'c29834ca-9766-40b8-a91e-4f1321758b3d', // Teste Email (gustavolsilva2003@gmail.com)
];

interface Job {
  id: string;
  job_type: string;
  shop_id: string;
  message_id: string;
  payload: any;
  attempt_count: number;
  max_attempts: number;
}

interface ProcessResult {
  success: boolean;
  execution_time_ms: number;
  jobs_processed: number;
  jobs_completed: number;
  jobs_retried: number;
  jobs_failed: number;
  jobs_to_dlq: number;
}

Deno.serve(async (req: Request) => {
  const startTime = Date.now();
  const supabase = getSupabaseClient();

  try {
    console.log('[Queue] Starting processing cycle');

    // STALE JOB RECOVERY: Reset jobs stuck in 'processing' for > 5 minutes
    // This handles edge function timeouts, crashes, and stuck AI calls
    const STALE_THRESHOLD_MINUTES = 5;
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000).toISOString();
    const { data: staleJobs, error: staleError } = await supabase
      .from('job_queue')
      .update({
        status: 'pending',
        started_at: null,
        error_message: 'Auto-recovered: job was stuck in processing (edge function timeout)',
      })
      .eq('status', 'processing')
      .lt('started_at', staleThreshold)
      .select('id');

    if (staleError) {
      console.error('[Queue] Failed to recover stale jobs:', staleError.message);
    } else if (staleJobs && staleJobs.length > 0) {
      console.log(`[Queue] Recovered ${staleJobs.length} stale jobs stuck in processing`);
    }

    // Dequeue jobs (atomic with row-level locking)
    const { data: jobs, error: dequeueError } = await supabase.rpc('dequeue_jobs', {
      p_batch_size: BATCH_SIZE,
      p_job_types: ['process_email'], // Only process email jobs for now
    });

    if (dequeueError) {
      throw new Error(`Failed to dequeue jobs: ${dequeueError.message}`);
    }

    if (!jobs || jobs.length === 0) {
      console.log('[Queue] No jobs to process');
      return new Response(
        JSON.stringify({
          success: true,
          execution_time_ms: Date.now() - startTime,
          jobs_processed: 0,
          jobs_completed: 0,
          jobs_retried: 0,
          jobs_failed: 0,
          jobs_to_dlq: 0,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Queue] Dequeued ${jobs.length} jobs`);

    // Process jobs
    let jobsCompleted = 0;
    let jobsRetried = 0;
    let jobsFailed = 0;
    let jobsToDLQ = 0;

    for (let i = 0; i < (jobs as Job[]).length; i++) {
      const job = (jobs as Job[])[i];

      // Check timeout - reset remaining jobs back to pending before breaking
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        console.log('[Queue] Approaching timeout, resetting remaining jobs');
        const remainingJobs = (jobs as Job[]).slice(i);
        for (const remainingJob of remainingJobs) {
          await supabase
            .from('job_queue')
            .update({ status: 'pending', started_at: null })
            .eq('id', remainingJob.id);
        }
        console.log(`[Queue] Reset ${remainingJobs.length} unprocessed jobs back to pending`);
        break;
      }

      try {
        // Skip shops com processamento manual (Forçar resposta IA)
        if (MANUAL_PROCESSING_ONLY_SHOPS.includes(job.shop_id)) {
          console.log(`[Queue] Skipping job ${job.id} - shop ${job.shop_id} is manual-only`);
          await supabase
            .from('job_queue')
            .update({ status: 'pending', started_at: null })
            .eq('id', job.id);
          continue;
        }

        console.log(`[Queue] Processing job ${job.id} (attempt ${job.attempt_count}/${job.max_attempts})`);
        const jobStartTime = Date.now();

        // Process the job based on type
        if (job.job_type === 'process_email') {
          await processMessageFromQueue(job, supabase);
        } else {
          throw new Error(`Unknown job type: ${job.job_type}`);
        }

        // Success - mark as completed
        const processingTime = Date.now() - jobStartTime;
        await supabase.rpc('complete_job', {
          p_job_id: job.id,
          p_result: { success: true },
          p_processing_time_ms: processingTime,
        });

        jobsCompleted++;
        console.log(`[Queue] Job ${job.id} completed in ${processingTime}ms`);

        // Add delay between jobs to avoid rate limiting (except for last job)
        if (i < (jobs as Job[]).length - 1) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_JOBS_MS));
        }
      } catch (error: any) {
        console.error(`[Queue] Job ${job.id} failed:`, error.message);

        // Check if it's a rate limit error - stop processing immediately to avoid more 429s
        const isRateLimit = error.message?.toLowerCase().includes('rate_limit') ||
                           error.message?.includes('429');

        // Determine if error is retryable
        const isRetryable = isRetryableError(error);
        const errorType = getErrorType(error);

        // Fail the job (will retry or move to DLQ based on attempt count)
        const { data: newStatus, error: failError } = await supabase.rpc('fail_job', {
          p_job_id: job.id,
          p_error_message: error.message,
          p_error_type: errorType,
          p_error_stack: error.stack || null,
          p_is_retryable: isRetryable,
        });

        if (failError) {
          console.error(`[Queue] Failed to mark job ${job.id} as failed:`, failError);
        } else {
          console.log(`[Queue] Job ${job.id} marked as: ${newStatus}`);

          if (newStatus === 'pending') {
            jobsRetried++;
          } else if (newStatus === 'dead_letter') {
            jobsToDLQ++;
          } else {
            jobsFailed++;
          }
        }

        // If rate limited, stop processing this batch and wait for next cycle
        if (isRateLimit) {
          console.log('[Queue] Rate limit hit, stopping batch to avoid more 429 errors');
          break;
        }
      }
    }

    const executionTime = Date.now() - startTime;
    const result: ProcessResult = {
      success: true,
      execution_time_ms: executionTime,
      jobs_processed: jobs.length,
      jobs_completed: jobsCompleted,
      jobs_retried: jobsRetried,
      jobs_failed: jobsFailed,
      jobs_to_dlq: jobsToDLQ,
    };

    console.log('[Queue] Cycle complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Queue] Fatal error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        execution_time_ms: Date.now() - startTime,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Determina se um erro é transiente (retryable) ou permanente
 */
function isRetryableError(error: any): boolean {
  const message = error.message?.toLowerCase() || '';

  // Erros transientes (retry)
  if (
    message.includes('rate_limit') ||
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('connection') ||
    message.includes('econnreset') ||
    message.includes('503') ||
    message.includes('502') ||
    message.includes('504')
  ) {
    return true;
  }

  // Erros permanentes (no retry)
  if (
    message.includes('invalid_email') ||
    message.includes('inválido') ||  // Detecta "Email do remetente inválido"
    message.includes('remetente') ||  // Extra segurança
    message.includes('spam') ||
    message.includes('vazio') ||  // Detecta "Corpo do email vazio"
    message.includes('sistema') ||  // Detecta "Email de sistema ignorado"
    message.includes('404') ||
    message.includes('401') ||
    message.includes('forbidden')
  ) {
    return false;
  }

  // Default: retry
  return true;
}

/**
 * Classifica o tipo de erro para métricas
 */
function getErrorType(error: any): string {
  const message = error.message?.toLowerCase() || '';

  if (message.includes('rate_limit')) return 'rate_limit';
  if (message.includes('timeout')) return 'timeout';
  if (message.includes('network') || message.includes('connection')) return 'network_error';
  if (message.includes('invalid_email')) return 'invalid_data';
  if (message.includes('spam')) return 'spam';
  if (message.includes('shopify')) return 'shopify_error';
  if (message.includes('claude') || message.includes('anthropic')) return 'ai_error';
  if (message.includes('smtp')) return 'smtp_error';
  if (message.includes('imap')) return 'imap_error';

  return 'unknown_error';
}
