-- =============================================================================
-- Verificar se o cron fetch-emails-cron já executou automaticamente
-- =============================================================================

-- Ver últimas execuções do fetch-emails-cron
SELECT
    j.jobname,
    r.runid,
    r.status,
    r.return_message,
    r.start_time AT TIME ZONE 'America/Sao_Paulo' as start_time_brt,
    r.end_time AT TIME ZONE 'America/Sao_Paulo' as end_time_brt,
    EXTRACT(EPOCH FROM (r.end_time - r.start_time))::INTEGER as duration_seconds
FROM cron.job_run_details r
JOIN cron.job j ON r.jobid = j.jobid
WHERE j.jobname IN ('fetch-emails-cron', 'process-queue-cron')
ORDER BY r.start_time DESC
LIMIT 10;

-- Ver quando será a próxima execução (estimativa)
SELECT
    jobname,
    schedule,
    CASE
        WHEN schedule = '*/5 * * * *' THEN 'Próxima execução em até 5 minutos'
        WHEN schedule = '* * * * *' THEN 'Próxima execução em até 1 minuto'
        ELSE schedule
    END as next_run
FROM cron.job
WHERE jobname IN ('fetch-emails-cron', 'process-queue-cron')
ORDER BY jobname;
