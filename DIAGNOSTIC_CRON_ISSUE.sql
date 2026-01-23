-- =============================================================================
-- DIAGNÓSTICO COMPLETO: Por que fetch-emails não está executando?
-- =============================================================================
-- Execute este arquivo completo no Supabase SQL Editor
-- =============================================================================

-- 1. Verificar se pg_cron está instalado
SELECT
    'pg_cron extension' as check_name,
    CASE
        WHEN COUNT(*) > 0 THEN '✅ INSTALADO'
        ELSE '❌ NÃO INSTALADO - Execute: CREATE EXTENSION pg_cron;'
    END as status
FROM pg_extension
WHERE extname = 'pg_cron';

-- 2. Verificar se pg_net está instalado (necessário para http_post)
SELECT
    'pg_net extension' as check_name,
    CASE
        WHEN COUNT(*) > 0 THEN '✅ INSTALADO'
        ELSE '❌ NÃO INSTALADO - Execute: CREATE EXTENSION pg_net;'
    END as status
FROM pg_extension
WHERE extname = 'pg_net';

-- 3. Verificar se os cron jobs NOVOS existem e estão ATIVOS
SELECT
    '📋 Cron jobs configurados' as section,
    jobid,
    jobname,
    schedule,
    active,
    database,
    nodename
FROM cron.job
WHERE jobname IN (
    'fetch-emails-cron',
    'process-queue-cron',
    'aggregate-queue-metrics-cron',
    'cleanup-completed-jobs-cron',
    'cleanup-stuck-jobs-cron'
)
ORDER BY jobname;

-- 4. Verificar se o cron job ANTIGO ainda existe (não deveria)
SELECT
    '⚠️  Cron jobs ANTIGOS (devem ser removidos)' as section,
    jobid,
    jobname,
    schedule,
    active
FROM cron.job
WHERE jobname IN (
    'process-emails-trigger',
    'process-emails',
    'trigger-email-processing',
    'email-processing'
)
ORDER BY jobname;

-- 5. Verificar últimas TENTATIVAS de execução do fetch-emails-cron
SELECT
    '📊 Últimas execuções do fetch-emails-cron' as section,
    r.runid,
    r.job_pid,
    r.status,
    r.return_message,
    r.start_time,
    r.end_time,
    EXTRACT(EPOCH FROM (r.end_time - r.start_time))::INTEGER as duration_seconds
FROM cron.job_run_details r
JOIN cron.job j ON r.jobid = j.jobid
WHERE j.jobname = 'fetch-emails-cron'
ORDER BY r.start_time DESC
LIMIT 10;

-- 6. Verificar últimas execuções de TODOS os cron jobs da queue
SELECT
    '📊 Últimas execuções de TODOS os cron jobs' as section,
    j.jobname,
    r.status,
    r.return_message,
    r.start_time,
    r.end_time
FROM cron.job_run_details r
JOIN cron.job j ON r.jobid = j.jobid
WHERE j.jobname LIKE '%queue%' OR j.jobname LIKE '%fetch%'
ORDER BY r.start_time DESC
LIMIT 20;

-- 7. Testar se pg_net está funcionando
SELECT
    '🌐 Teste de conectividade pg_net' as section,
    net.http_get('https://httpbin.org/get') as request_id,
    'Se retornar um número (request_id), pg_net está funcionando' as note;

-- 8. Verificar permissões no schema cron
SELECT
    '🔐 Permissões no schema cron' as section,
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'cron' AND table_name = 'job';

-- 9. Verificar permissões no schema net
SELECT
    '🔐 Permissões no schema net' as section,
    routine_schema,
    routine_name,
    grantee,
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'net' AND routine_name = 'http_post'
LIMIT 5;

-- =============================================================================
-- PRÓXIMOS PASSOS BASEADOS NOS RESULTADOS:
-- =============================================================================
/*

SE pg_cron NÃO ESTÁ INSTALADO:
    CREATE EXTENSION pg_cron;

SE pg_net NÃO ESTÁ INSTALADO:
    CREATE EXTENSION pg_net;
    GRANT USAGE ON SCHEMA net TO postgres;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO postgres;

SE OS CRON JOBS NOVOS NÃO EXISTEM:
    Execute a migration 022:
    \i supabase/migrations/022_setup_queue_cron_jobs.sql

SE OS CRON JOBS EXISTEM MAS NÃO HÁ EXECUÇÕES:
    Verifique os logs de erro do PostgreSQL no Supabase Dashboard
    Ou tente executar o comando manualmente:

    SELECT net.http_post(
        url := 'https://ulldjamxdsaqqyurcmcs.supabase.co/functions/v1/fetch-emails',
        headers := jsonb_build_object(
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbGRqYW14ZHNhcXF5dXJjbWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ3OTA1NywiZXhwIjoyMDg0MDU1MDU3fQ.M3ib-i9Y_YBopQWM5wEkVK2Oi2Ssf511vWgXeUlrfgs',
            'Content-Type', 'application/json'
        )
    );

SE O TESTE MANUAL FUNCIONA MAS O CRON NÃO:
    Pode ser um problema de permissões ou configuração do pg_cron no Supabase.
    Entre em contato com o suporte do Supabase.

*/
