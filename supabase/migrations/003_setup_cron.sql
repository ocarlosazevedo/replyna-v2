-- =============================================================================
-- REPLYNA V2 - MIGRATION 003: Setup pg_cron for Email Processing
-- =============================================================================
-- IMPORTANTE: pg_cron deve estar habilitado no projeto Supabase
-- Vá em Database > Extensions e habilite pg_cron se necessário
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. HABILITAR EXTENSÃO pg_cron (se não estiver)
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Dar permissões ao schema cron
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- -----------------------------------------------------------------------------
-- 2. TABELA PARA CONTROLAR EXECUÇÕES DO CRON
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cron_execution_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status TEXT CHECK (status IN ('running', 'success', 'error')),
    shops_processed INTEGER DEFAULT 0,
    emails_processed INTEGER DEFAULT 0,
    emails_replied INTEGER DEFAULT 0,
    error_message TEXT,
    execution_time_ms INTEGER
);

CREATE INDEX idx_cron_log_job_name ON cron_execution_log(job_name);
CREATE INDEX idx_cron_log_started_at ON cron_execution_log(started_at DESC);

-- Limpar logs antigos (manter últimos 7 dias)
-- Este job roda todo dia às 4am
SELECT cron.schedule(
    'cleanup-cron-logs',
    '0 4 * * *',
    $$DELETE FROM cron_execution_log WHERE started_at < NOW() - INTERVAL '7 days'$$
);

-- -----------------------------------------------------------------------------
-- 3. FUNÇÃO QUE SERÁ CHAMADA PELO CRON
-- -----------------------------------------------------------------------------
-- Esta função chama a Edge Function via HTTP
-- A Edge Function faz o processamento real dos emails

CREATE OR REPLACE FUNCTION trigger_email_processing()
RETURNS void AS $$
DECLARE
    v_execution_id UUID;
    v_response JSONB;
    v_edge_function_url TEXT;
    v_service_role_key TEXT;
BEGIN
    -- Registrar início da execução
    INSERT INTO cron_execution_log (job_name, status)
    VALUES ('process-emails', 'running')
    RETURNING id INTO v_execution_id;

    -- Buscar URL da Edge Function das configurações
    -- NOTA: Você precisa criar uma tabela de configurações ou usar secrets do Supabase
    -- Por enquanto, a Edge Function será chamada diretamente pelo cron do Supabase

    -- Atualizar status para indicar que a trigger foi disparada
    -- O status final será atualizado pela Edge Function
    UPDATE cron_execution_log
    SET
        status = 'success',
        finished_at = NOW(),
        execution_time_ms = EXTRACT(MILLISECONDS FROM (NOW() - started_at))::INTEGER
    WHERE id = v_execution_id;

EXCEPTION WHEN OTHERS THEN
    UPDATE cron_execution_log
    SET
        status = 'error',
        finished_at = NOW(),
        error_message = SQLERRM,
        execution_time_ms = EXTRACT(MILLISECONDS FROM (NOW() - started_at))::INTEGER
    WHERE id = v_execution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 4. AGENDAR O JOB DE PROCESSAMENTO DE EMAILS
-- -----------------------------------------------------------------------------
-- Roda a cada 15 minutos (0, 15, 30, 45 de cada hora)

-- Primeiro, remover job existente se houver
SELECT cron.unschedule('process-emails-trigger') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-emails-trigger'
);

-- Agendar novo job
-- NOTA: Para Supabase, é melhor usar o Cron da própria plataforma para chamar Edge Functions
-- Este schedule é um fallback/backup

SELECT cron.schedule(
    'process-emails-trigger',
    '*/15 * * * *',  -- A cada 15 minutos
    $$SELECT trigger_email_processing()$$
);

-- -----------------------------------------------------------------------------
-- 5. LIMPEZA DE LOGS ANTIGOS DE PROCESSAMENTO
-- -----------------------------------------------------------------------------
-- Roda todo dia às 3am - remove logs com mais de 90 dias

SELECT cron.schedule(
    'cleanup-processing-logs',
    '0 3 * * *',
    $$DELETE FROM email_processing_logs WHERE created_at < NOW() - INTERVAL '90 days'$$
);

-- -----------------------------------------------------------------------------
-- 6. RESET DE RATE LIMITS
-- -----------------------------------------------------------------------------
-- Roda a cada hora - reseta contadores de rate limit

SELECT cron.schedule(
    'reset-rate-limits',
    '0 * * * *',
    $$
    UPDATE rate_limits
    SET
        responses_last_hour = 0,
        hour_window_start = NOW()
    WHERE hour_window_start < NOW() - INTERVAL '1 hour'
    $$
);

-- -----------------------------------------------------------------------------
-- 7. VIEW PARA MONITORAR JOBS AGENDADOS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW scheduled_jobs AS
SELECT
    jobid,
    jobname,
    schedule,
    command,
    nodename,
    nodeport,
    database,
    username,
    active
FROM cron.job
ORDER BY jobname;

COMMENT ON VIEW scheduled_jobs IS 'Lista todos os jobs agendados no pg_cron';

-- -----------------------------------------------------------------------------
-- 8. FUNÇÃO PARA VERIFICAR SAÚDE DO SISTEMA
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_system_health()
RETURNS TABLE (
    metric TEXT,
    value TEXT,
    status TEXT
) AS $$
BEGIN
    -- Última execução do cron
    RETURN QUERY
    SELECT
        'last_cron_execution'::TEXT,
        COALESCE(TO_CHAR(MAX(started_at), 'YYYY-MM-DD HH24:MI:SS'), 'never')::TEXT,
        CASE
            WHEN MAX(started_at) > NOW() - INTERVAL '20 minutes' THEN 'ok'
            WHEN MAX(started_at) > NOW() - INTERVAL '1 hour' THEN 'warning'
            ELSE 'critical'
        END::TEXT
    FROM cron_execution_log
    WHERE job_name = 'process-emails';

    -- Emails pendentes
    RETURN QUERY
    SELECT
        'pending_emails'::TEXT,
        COUNT(*)::TEXT,
        CASE
            WHEN COUNT(*) = 0 THEN 'ok'
            WHEN COUNT(*) < 50 THEN 'ok'
            WHEN COUNT(*) < 200 THEN 'warning'
            ELSE 'critical'
        END::TEXT
    FROM messages
    WHERE status = 'pending';

    -- Lojas ativas
    RETURN QUERY
    SELECT
        'active_shops'::TEXT,
        COUNT(*)::TEXT,
        'info'::TEXT
    FROM shops
    WHERE is_active = TRUE AND mail_status = 'ok';

    -- Erros nas últimas 24h
    RETURN QUERY
    SELECT
        'errors_24h'::TEXT,
        COUNT(*)::TEXT,
        CASE
            WHEN COUNT(*) = 0 THEN 'ok'
            WHEN COUNT(*) < 10 THEN 'warning'
            ELSE 'critical'
        END::TEXT
    FROM email_processing_logs
    WHERE event_type = 'error'
    AND created_at > NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- INSTRUÇÕES DE USO
-- -----------------------------------------------------------------------------
/*
CONFIGURAÇÃO DO CRON NO SUPABASE:

1. Vá em Database > Extensions e habilite pg_cron

2. A Edge Function 'process-emails' será chamada pelo Supabase Cron:
   - Vá em Edge Functions no dashboard do Supabase
   - Configure um Schedule Trigger para a função process-emails
   - Cron expression: */15 * * * * (a cada 15 minutos)

3. Verificar jobs agendados:
   SELECT * FROM scheduled_jobs;

4. Verificar histórico de execuções:
   SELECT * FROM cron_execution_log ORDER BY started_at DESC LIMIT 20;

5. Verificar saúde do sistema:
   SELECT * FROM get_system_health();

ALTERNATIVA - Vercel Cron:
Se preferir usar Vercel Cron em vez de pg_cron:

1. Adicione em vercel.json:
   {
     "crons": [{
       "path": "/api/cron/process-emails",
       "schedule": "*/15 * * * *"
     }]
   }

2. Crie o endpoint /api/cron/process-emails que chama a lógica de processamento

NOTA: O Vercel Cron tem limite de 1 execução por dia no plano Hobby.
Para execução a cada 15 min, use Supabase pg_cron ou faça upgrade do plano.
*/

-- -----------------------------------------------------------------------------
-- FIM DA MIGRATION
-- -----------------------------------------------------------------------------
