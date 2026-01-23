-- =====================================================================
-- MIGRATION 022: Setup Queue Cron Jobs
-- =====================================================================
-- Configura cron jobs para a arquitetura de filas
-- =====================================================================

-- =====================================================================
-- CRON JOB 1: fetch-emails (Ingestion)
-- =====================================================================
-- Busca emails via IMAP e enfileira para processamento
-- Executa a cada 5 minutos

SELECT cron.schedule(
    'fetch-emails-cron',
    '*/5 * * * *',  -- Every 5 minutes
    $$
    SELECT net.http_post(
        url := 'https://ulldjamxdsaqqyurcmcs.supabase.co/functions/v1/fetch-emails',
        headers := jsonb_build_object(
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbGRqYW14ZHNhcXF5dXJjbWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ3OTA1NywiZXhwIjoyMDg0MDU1MDU3fQ.M3ib-i9Y_YBopQWM5wEkVK2Oi2Ssf511vWgXeUlrfgs',
            'Content-Type', 'application/json'
        )
    ) as request_id;
    $$
);

-- =====================================================================
-- CRON JOB 2: process-queue (Processing)
-- =====================================================================
-- Processa jobs da fila com retry automático
-- Executa a cada 1 minuto

SELECT cron.schedule(
    'process-queue-cron',
    '* * * * *',  -- Every 1 minute
    $$
    SELECT net.http_post(
        url := 'https://ulldjamxdsaqqyurcmcs.supabase.co/functions/v1/process-queue',
        headers := jsonb_build_object(
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbGRqYW14ZHNhcXF5dXJjbWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ3OTA1NywiZXhwIjoyMDg0MDU1MDU3fQ.M3ib-i9Y_YBopQWM5wEkVK2Oi2Ssf511vWgXeUlrfgs',
            'Content-Type', 'application/json'
        )
    ) as request_id;
    $$
);

-- =====================================================================
-- CRON JOB 3: aggregate-queue-metrics (Monitoring)
-- =====================================================================
-- Agrega métricas da fila para dashboard
-- Executa a cada 5 minutos

SELECT cron.schedule(
    'aggregate-queue-metrics-cron',
    '*/5 * * * *',  -- Every 5 minutes
    $$
    SELECT aggregate_queue_metrics();
    $$
);

-- =====================================================================
-- CRON JOB 4: cleanup-completed-jobs (Maintenance)
-- =====================================================================
-- Remove jobs completed/failed antigos (keep last 7 days)
-- Executa diariamente às 3am

SELECT cron.schedule(
    'cleanup-completed-jobs-cron',
    '0 3 * * *',  -- Daily at 3am
    $$
    DELETE FROM job_queue
    WHERE status IN ('completed', 'failed')
      AND completed_at < NOW() - INTERVAL '7 days';
    $$
);

-- =====================================================================
-- CRON JOB 5: cleanup-stuck-processing-jobs (Recovery)
-- =====================================================================
-- Reseta jobs stuck em 'processing' por mais de 1 hora
-- Executa a cada 15 minutos

SELECT cron.schedule(
    'cleanup-stuck-jobs-cron',
    '*/15 * * * *',  -- Every 15 minutes
    $$
    UPDATE job_queue
    SET
        status = 'pending',
        next_retry_at = NOW(),
        attempt_count = attempt_count  -- Mantém contagem para DLQ
    WHERE status = 'processing'
      AND started_at < NOW() - INTERVAL '1 hour';
    $$
);

-- =====================================================================
-- DESABILITAR CRON ANTIGO (se existir)
-- =====================================================================
-- O cron job antigo 'process-emails-trigger' pode conflitar com a nova arquitetura
-- Comentar/descomentar conforme necessário durante transição

-- SELECT cron.unschedule('process-emails-trigger');

-- =====================================================================
-- VERIFICAR CRON JOBS ATIVOS
-- =====================================================================

-- Query para ver todos os cron jobs configurados:
-- SELECT * FROM cron.job ORDER BY jobname;

-- Query para ver execuções recentes:
-- SELECT * FROM cron.job_run_details
-- WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE '%queue%')
-- ORDER BY start_time DESC LIMIT 20;

-- =====================================================================
-- COMMENTS
-- =====================================================================

COMMENT ON EXTENSION cron IS 'Job scheduling with pg_cron - used for queue-based email processing';
