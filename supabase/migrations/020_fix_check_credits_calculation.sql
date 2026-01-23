-- Migration: Fix check_credits_available calculation bug
--
-- BUG: A função estava subtraindo extra_emails_used quando emails_used já conta todos os emails
--
-- ERRADO: emails_limit + extra_purchased - emails_used - extra_used
-- CORRETO: emails_limit + extra_purchased - emails_used
--
-- Exemplo que estava falhando:
--   emails_limit = 300
--   extra_purchased = 100
--   emails_used = 350
--   extra_used = 50
--
--   ERRADO: 300 + 100 - 350 - 50 = 0 (sem créditos) ❌
--   CORRETO: 300 + 100 - 350 = 50 (tem créditos) ✅

CREATE OR REPLACE FUNCTION check_credits_available(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_user RECORD;
    v_total_available INTEGER;
BEGIN
    SELECT * INTO v_user FROM users WHERE id = p_user_id;

    IF v_user IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Se emails_limit é NULL, significa ilimitado - sempre retorna TRUE
    IF v_user.emails_limit IS NULL THEN
        RETURN TRUE;
    END IF;

    -- CORREÇÃO: emails_used JÁ CONTA todos os emails (plano + extras)
    -- Portanto, não devemos subtrair extra_emails_used novamente
    v_total_available := v_user.emails_limit + COALESCE(v_user.extra_emails_purchased, 0) - COALESCE(v_user.emails_used, 0);

    RETURN v_total_available > 0;
END;
$$ LANGUAGE plpgsql;

-- Comentário explicativo
COMMENT ON FUNCTION check_credits_available(UUID) IS 'Verifica se usuário tem créditos disponíveis. Total = emails_limit + extra_emails_purchased - emails_used. Nota: emails_used já conta todos os emails (plano + extras), por isso não subtraímos extra_emails_used.';
