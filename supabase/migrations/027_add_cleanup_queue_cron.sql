-- =====================================================
-- Migration: Add cleanup-queue cron job
-- =====================================================
-- Adds a scheduled job to run cleanup-queue every 5 minutes
-- This prevents messages from getting stuck due to:
-- 1. Jobs stuck in dead_letter with transient errors
-- 2. Orphan messages without active jobs
-- 3. Messages stuck in "processing" status

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
