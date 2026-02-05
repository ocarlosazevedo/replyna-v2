-- Migration: Fix credits race condition
--
-- PROBLEMA: Race condition quando múltiplos emails são processados em paralelo
-- O check de créditos e o incremento eram operações separadas, permitindo que
-- vários emails passassem no check antes de qualquer um incrementar o contador.
--
-- SOLUÇÃO: Operação atômica que verifica E reserva o crédito em uma única transação

-- Função atômica: tenta reservar um crédito, retorna TRUE se conseguiu
CREATE OR REPLACE FUNCTION try_reserve_credit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_user RECORD;
    v_total_limit INTEGER;
    v_updated_rows INTEGER;
BEGIN
    -- Buscar usuário com lock para evitar race condition
    SELECT * INTO v_user
    FROM users
    WHERE id = p_user_id
    FOR UPDATE;  -- Lock na row durante a transação

    IF v_user IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Se emails_limit é NULL, significa ilimitado
    IF v_user.emails_limit IS NULL THEN
        -- Incrementa mesmo assim para tracking, mas sempre permite
        UPDATE users
        SET emails_used = COALESCE(emails_used, 0) + 1,
            updated_at = NOW()
        WHERE id = p_user_id;
        RETURN TRUE;
    END IF;

    -- Calcular limite total (plano + extras comprados)
    v_total_limit := v_user.emails_limit + COALESCE(v_user.extra_emails_purchased, 0);

    -- Verificar se ainda tem crédito disponível
    IF COALESCE(v_user.emails_used, 0) >= v_total_limit THEN
        RETURN FALSE;  -- Sem créditos
    END IF;

    -- Tem crédito: incrementa atomicamente
    UPDATE users
    SET emails_used = COALESCE(emails_used, 0) + 1,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION try_reserve_credit(UUID) IS
'Tenta reservar um crédito de email para o usuário. Operação atômica que verifica
disponibilidade E incrementa o contador em uma única transação com row-level lock.
Retorna TRUE se crédito foi reservado, FALSE se não há créditos disponíveis.';

-- Manter a função antiga para compatibilidade, mas ela agora é apenas para consulta
-- (não deve ser usada para decidir se processa ou não)
COMMENT ON FUNCTION check_credits_available(UUID) IS
'[DEPRECATED para decisões de processamento] Use try_reserve_credit() em vez disso.
Esta função ainda pode ser usada para consultas informativas, mas não garante
atomicidade e pode causar race conditions se usada para decidir processamento.';
