-- =============================================================================
-- CRIAR CRON JOBS - Execução Manual
-- =============================================================================
-- Execute este arquivo completo no Supabase SQL Editor
-- Vai criar os 5 cron jobs necessários para a arquitetura de filas
-- =============================================================================

-- Limpar cron jobs antigos primeiro (se existirem)
DO $$
BEGIN
    -- Remover cron jobs antigos
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-emails-cron') THEN
        PERFORM cron.unschedule('fetch-emails-cron');
    END IF;

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-queue-cron') THEN
        PERFORM cron.unschedule('process-queue-cron');
    END IF;

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'aggregate-queue-metrics-cron') THEN
        PERFORM cron.unschedule('aggregate-queue-metrics-cron');
    END IF;

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-completed-jobs-cron') THEN
        PERFORM cron.unschedule('cleanup-completed-jobs-cron');
    END IF;

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-stuck-jobs-cron') THEN
        PERFORM cron.unschedule('cleanup-stuck-jobs-cron');
    END IF;
END $$;

-- =============================================================================
-- CRON JOB 1: fetch-emails (Ingestion) - A cada 5 minutos
-- =============================================================================
SELECT cron.schedule(
    'fetch-emails-cron',
    '*/5 * * * *',
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

-- =============================================================================
-- CRON JOB 2: process-queue (Processing) - A cada 1 minuto
-- =============================================================================
SELECT cron.schedule(
    'process-queue-cron',
    '* * * * *',
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

-- =============================================================================
-- CRON JOB 3: aggregate-queue-metrics (Monitoring) - A cada 5 minutos
-- =============================================================================
SELECT cron.schedule(
    'aggregate-queue-metrics-cron',
    '*/5 * * * *',
    $$
    SELECT aggregate_queue_metrics();
    $$
);

-- =============================================================================
-- CRON JOB 4: cleanup-completed-jobs (Maintenance) - Diariamente às 3am
-- =============================================================================
SELECT cron.schedule(
    'cleanup-completed-jobs-cron',
    '0 3 * * *',
    $$
    DELETE FROM job_queue
    WHERE status IN ('completed', 'failed')
      AND completed_at < NOW() - INTERVAL '7 days';
    $$
);

-- =============================================================================
-- CRON JOB 5: cleanup-stuck-jobs (Recovery) - A cada 15 minutos
-- =============================================================================
SELECT cron.schedule(
    'cleanup-stuck-jobs-cron',
    '*/15 * * * *',
    $$
    UPDATE job_queue
    SET
        status = 'pending',
        next_retry_at = NOW(),
        attempt_count = attempt_count
    WHERE status = 'processing'
      AND started_at < NOW() - INTERVAL '1 hour';
    $$
);

-- =============================================================================
-- VERIFICAÇÃO - Listar todos os cron jobs criados
-- =============================================================================
SELECT
    jobid,
    jobname,
    schedule,
    active,
    command
FROM cron.job
ORDER BY jobname;
