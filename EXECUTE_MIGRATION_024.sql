-- =============================================================================
-- MIGRATION 024: Disable Old Process Emails Cron Job
-- =============================================================================
-- Garante que o cron job antigo 'process-emails-trigger' seja desabilitado
-- para evitar conflito com a nova arquitetura de filas
-- =============================================================================

-- Remover cron job antigo (se existir)
DO $$
BEGIN
    -- Verificar se o job existe e remover
    IF EXISTS (
        SELECT 1 FROM cron.job
        WHERE jobname = 'process-emails-trigger'
    ) THEN
        PERFORM cron.unschedule('process-emails-trigger');
        RAISE NOTICE 'Cron job antigo "process-emails-trigger" foi removido com sucesso';
    ELSE
        RAISE NOTICE 'Cron job "process-emails-trigger" não existe (já foi removido ou nunca existiu)';
    END IF;
END $$;

-- Também remover outros possíveis nomes de cron jobs do sistema antigo
DO $$
DECLARE
    v_job RECORD;
BEGIN
    FOR v_job IN
        SELECT jobname
        FROM cron.job
        WHERE jobname IN (
            'process-emails',
            'trigger-email-processing',
            'email-processing'
        )
    LOOP
        PERFORM cron.unschedule(v_job.jobname);
        RAISE NOTICE 'Removido cron job: %', v_job.jobname;
    END LOOP;
END $$;

-- =============================================================================
-- VERIFICAÇÃO
-- =============================================================================
-- Para verificar que apenas os novos cron jobs estão ativos:
SELECT jobname, schedule
FROM cron.job
ORDER BY jobname;
