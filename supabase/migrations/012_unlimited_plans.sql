-- -----------------------------------------------------------------------------
-- Migration: 012_unlimited_plans
-- Description: Permite planos com limites ilimitados (NULL = ilimitado)
-- -----------------------------------------------------------------------------

-- 1. ATUALIZAR FUNÇÃO check_credits_available PARA TRATAR NULL COMO ILIMITADO
-- Quando emails_limit é NULL, o usuário tem créditos ilimitados
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

    -- Total disponível = limite do plano + extras comprados - usados
    v_total_available := v_user.emails_limit + COALESCE(v_user.extra_emails_purchased, 0) - COALESCE(v_user.emails_used, 0) - COALESCE(v_user.extra_emails_used, 0);

    RETURN v_total_available > 0;
END;
$$ LANGUAGE plpgsql;

-- 2. ATUALIZAR FUNÇÃO get_user_credits_status PARA TRATAR NULL COMO ILIMITADO
-- Precisa fazer DROP primeiro porque a assinatura mudou (novo campo is_unlimited)
DROP FUNCTION IF EXISTS get_user_credits_status(UUID);
CREATE OR REPLACE FUNCTION get_user_credits_status(p_user_id UUID)
RETURNS TABLE (
    plan_limit INTEGER,
    plan_used INTEGER,
    extras_purchased INTEGER,
    extras_used INTEGER,
    pending_billing INTEGER,
    total_available INTEGER,
    percentage_used DECIMAL,
    is_unlimited BOOLEAN
) AS $$
DECLARE
    v_user RECORD;
    v_total_available INTEGER;
    v_total_limit INTEGER;
    v_total_used INTEGER;
BEGIN
    SELECT * INTO v_user FROM users WHERE id = p_user_id;

    IF v_user IS NULL THEN
        RETURN QUERY SELECT 0, 0, 0, 0, 0, 0, 0::DECIMAL, FALSE;
        RETURN;
    END IF;

    -- Se emails_limit é NULL, é ilimitado
    IF v_user.emails_limit IS NULL THEN
        RETURN QUERY SELECT
            NULL::INTEGER,
            COALESCE(v_user.emails_used, 0)::INTEGER,
            COALESCE(v_user.extra_emails_purchased, 0)::INTEGER,
            COALESCE(v_user.extra_emails_used, 0)::INTEGER,
            COALESCE(v_user.pending_extra_emails, 0)::INTEGER,
            NULL::INTEGER,
            0::DECIMAL,
            TRUE;
        RETURN;
    END IF;

    v_total_limit := v_user.emails_limit + COALESCE(v_user.extra_emails_purchased, 0);
    v_total_used := COALESCE(v_user.emails_used, 0) + COALESCE(v_user.extra_emails_used, 0);
    v_total_available := v_total_limit - v_total_used;

    RETURN QUERY SELECT
        v_user.emails_limit::INTEGER,
        COALESCE(v_user.emails_used, 0)::INTEGER,
        COALESCE(v_user.extra_emails_purchased, 0)::INTEGER,
        COALESCE(v_user.extra_emails_used, 0)::INTEGER,
        COALESCE(v_user.pending_extra_emails, 0)::INTEGER,
        v_total_available::INTEGER,
        CASE WHEN v_total_limit > 0 THEN ROUND((v_total_used::DECIMAL / v_total_limit) * 100, 2) ELSE 0 END,
        FALSE;
END;
$$ LANGUAGE plpgsql;

-- 3. COMENTÁRIOS EXPLICATIVOS NAS COLUNAS
COMMENT ON COLUMN users.emails_limit IS 'Limite de emails do plano. NULL = ilimitado';
COMMENT ON COLUMN users.shops_limit IS 'Limite de lojas do plano. NULL = ilimitado';
COMMENT ON COLUMN plans.emails_limit IS 'Limite de emails do plano. NULL = ilimitado';
COMMENT ON COLUMN plans.shops_limit IS 'Limite de lojas do plano. NULL = ilimitado';
COMMENT ON COLUMN plans.extra_email_price IS 'Preço por email extra. NULL ou 0 = sem cobrança extra';
