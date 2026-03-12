-- =====================================================================
-- MIGRATION 066: Cron Job para verificar trials expirados
-- =====================================================================
-- Marca trials como 'expired' quando passam de 7 dias ou atingem 30 emails.
-- Executa diariamente.
-- =====================================================================

SELECT cron.schedule(
    'check-expired-trials-cron',
    '0 2 * * *',  -- Daily at 02:00
    $$
    SELECT net.http_post(
        url := 'https://ulldjamxdsaqqyurcmcs.supabase.co/functions/v1/check-expired-trials',
        headers := jsonb_build_object(
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbGRqYW14ZHNhcXF5dXJjbWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ3OTA1NywiZXhwIjoyMDg0MDU1MDU3fQ.M3ib-i9Y_YBopQWM5wEkVK2Oi2Ssf511vWgXeUlrfgs',
            'Content-Type', 'application/json'
        )
    ) as request_id;
    $$
);
