-- Migration: Add release_credit function for credit rollback
--
-- PROBLEMA: Quando tryReserveCredit() é chamado e o processamento falha depois
-- (ex: timeout da API, erro de rede), o crédito é consumido mas nenhuma resposta
-- é enviada ao cliente. Sem mecanismo de rollback, créditos vazam em erros transitórios.
--
-- SOLUÇÃO: Função atômica para devolver um crédito reservado que não foi utilizado.

CREATE OR REPLACE FUNCTION release_credit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_updated_rows INTEGER;
BEGIN
    -- Decrementa emails_used, mas nunca abaixo de 0
    UPDATE users
    SET emails_used = GREATEST(COALESCE(emails_used, 0) - 1, 0),
        updated_at = NOW()
    WHERE id = p_user_id
      AND COALESCE(emails_used, 0) > 0;

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    RETURN v_updated_rows > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION release_credit(UUID) IS
'Devolve um crédito reservado por try_reserve_credit() quando o processamento falha.
Decrementa emails_used em 1, nunca abaixo de 0. Retorna TRUE se o crédito foi devolvido.';
