-- =====================================================================
-- MIGRATION 066: Cron Job para liberar comissões pendentes de partners
-- =====================================================================
-- Executa diariamente às 06:00 UTC chamando release_pending_commissions()
-- Move comissões de pending → available quando available_at <= NOW()
-- =====================================================================

SELECT cron.schedule(
    'release-partner-commissions-cron',
    '0 6 * * *',  -- Every day at 06:00 UTC
    $$
    SELECT release_pending_commissions();
    $$
);
