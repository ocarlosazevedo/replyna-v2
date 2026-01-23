-- =============================================================================
-- Verificar se os cron jobs foram criados pela migration 022
-- =============================================================================

-- 1. Listar TODOS os cron jobs ativos
SELECT
    jobid,
    jobname,
    schedule,
    active,
    database,
    command
FROM cron.job
ORDER BY jobname;

-- 2. Verificar se os cron jobs específicos existem
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-emails-cron')
        THEN '✅ fetch-emails-cron existe'
        ELSE '❌ fetch-emails-cron NÃO existe - Execute migration 022'
    END as check_1,
    CASE
        WHEN EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-queue-cron')
        THEN '✅ process-queue-cron existe'
        ELSE '❌ process-queue-cron NÃO existe - Execute migration 022'
    END as check_2,
    CASE
        WHEN EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'aggregate-queue-metrics-cron')
        THEN '✅ aggregate-queue-metrics-cron existe'
        ELSE '❌ aggregate-queue-metrics-cron NÃO existe - Execute migration 022'
    END as check_3;
