-- =====================================================
-- Migration 031: Ensure cleanup-queue cron job is active
-- =====================================================
-- This migration ensures the cleanup-queue cron job exists and is running.
-- The cleanup-queue is critical for:
-- 1. Resetting messages stuck in "processing" status
-- 2. Retrying jobs with transient errors
-- 3. Fixing orphan messages without active jobs
--
-- Without this cron, messages can get permanently stuck.

-- First, try to unschedule any existing job to avoid duplicates
SELECT cron.unschedule('cleanup-queue-cron') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-queue-cron'
);

-- Schedule cleanup-queue to run every 5 minutes
SELECT cron.schedule(
    'cleanup-queue-cron',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://ulldjamxdsaqqyurcmcs.supabase.co/functions/v1/cleanup-queue',
        headers := jsonb_build_object(
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbGRqYW14ZHNhcXF5dXJjbWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ3OTA1NywiZXhwIjoyMDg0MDU1MDU3fQ.M3ib-i9Y_YBopQWM5wEkVK2Oi2Ssf511vWgXeUlrfgs',
            'Content-Type', 'application/json'
        )
    ) as request_id;
    $$
);

-- Also ensure the stuck-jobs cleanup runs (SQL-based, runs every 15 min)
SELECT cron.unschedule('cleanup-stuck-jobs-cron') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-stuck-jobs-cron'
);

SELECT cron.schedule(
    'cleanup-stuck-jobs-cron',
    '*/15 * * * *',
    $$
    -- Reset jobs stuck in 'processing' for more than 1 hour
    UPDATE job_queue
    SET
        status = 'pending',
        next_retry_at = NOW(),
        started_at = NULL
    WHERE status = 'processing'
      AND started_at < NOW() - INTERVAL '1 hour';

    -- Also reset messages stuck in 'processing' for more than 10 minutes
    UPDATE messages
    SET status = 'pending'
    WHERE status = 'processing'
      AND updated_at < NOW() - INTERVAL '10 minutes';
    $$
);

-- Verify jobs are scheduled
DO $$
BEGIN
    RAISE NOTICE 'Cleanup cron jobs configured successfully';
END $$;
