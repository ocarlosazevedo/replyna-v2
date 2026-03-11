-- =====================================================================
-- MIGRATION 064: Cron Job para verificar subscriptions expiradas
-- =====================================================================
-- Suspende automaticamente usuarios cujo periodo de assinatura expirou
-- e o pagamento nao foi renovado.
-- Executa a cada hora.
-- =====================================================================

SELECT cron.schedule(
    'check-expired-subscriptions-cron',
    '0 * * * *',  -- Every hour at minute 0
    $$
    SELECT net.http_post(
        url := 'https://ulldjamxdsaqqyurcmcs.supabase.co/functions/v1/check-expired-subscriptions',
        headers := jsonb_build_object(
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbGRqYW14ZHNhcXF5dXJjbWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ3OTA1NywiZXhwIjoyMDg0MDU1MDU3fQ.M3ib-i9Y_YBopQWM5wEkVK2Oi2Ssf511vWgXeUlrfgs',
            'Content-Type', 'application/json'
        )
    ) as request_id;
    $$
);
