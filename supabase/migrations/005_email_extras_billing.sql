-- =============================================================================
-- REPLYNA V2 - MIGRATION 005: Email Extras Billing
-- =============================================================================
-- Este script configura a cobrança de emails extras por pacote
-- Execute este script no SQL Editor do Supabase Dashboard
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ADICIONAR CAMPOS NA TABELA PLANS PARA EMAILS EXTRAS
-- -----------------------------------------------------------------------------
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS extra_email_price DECIMAL(10,2) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS extra_email_package_size INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS stripe_extra_email_price_id TEXT;

COMMENT ON COLUMN plans.extra_email_price IS 'Preço por email extra (ex: R$1.00)';
COMMENT ON COLUMN plans.extra_email_package_size IS 'Tamanho do pacote de emails extras (ex: 100 emails)';
COMMENT ON COLUMN plans.stripe_extra_email_price_id IS 'ID do preço no Stripe para cobrar pacote de emails extras';

-- -----------------------------------------------------------------------------
-- 2. ADICIONAR CAMPOS NA TABELA USERS PARA CONTROLE DE EXTRAS
-- -----------------------------------------------------------------------------
ALTER TABLE users
ADD COLUMN IF NOT EXISTS extra_emails_purchased INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_emails_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_extra_emails INTEGER DEFAULT 0;

COMMENT ON COLUMN users.extra_emails_purchased IS 'Total de emails extras comprados no período atual';
COMMENT ON COLUMN users.extra_emails_used IS 'Total de emails extras já utilizados no período atual';
COMMENT ON COLUMN users.pending_extra_emails IS 'Emails extras pendentes de cobrança (acumulados até atingir o pacote)';

-- -----------------------------------------------------------------------------
-- 3. TABELA DE COMPRAS DE EMAILS EXTRAS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_extra_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,

    -- Detalhes do pacote
    package_size INTEGER NOT NULL,
    price_per_email DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,

    -- Stripe
    stripe_payment_intent_id TEXT,
    stripe_invoice_id TEXT,
    stripe_charge_id TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Aguardando pagamento
        'processing',   -- Processando pagamento
        'completed',    -- Pagamento concluído
        'failed',       -- Pagamento falhou
        'refunded'      -- Reembolsado
    )),

    -- Metadata
    triggered_at_usage INTEGER, -- Quantos emails extras o usuário tinha quando foi cobrado
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_email_extra_purchases_user_id ON email_extra_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_email_extra_purchases_status ON email_extra_purchases(status);
CREATE INDEX IF NOT EXISTS idx_email_extra_purchases_created_at ON email_extra_purchases(created_at);
CREATE INDEX IF NOT EXISTS idx_email_extra_purchases_stripe_payment_intent ON email_extra_purchases(stripe_payment_intent_id);

-- RLS
ALTER TABLE email_extra_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their extra email purchases" ON email_extra_purchases
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role can manage extra email purchases" ON email_extra_purchases
    FOR ALL
    USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 4. FUNÇÃO PARA VERIFICAR SE PRECISA COBRAR PACOTE EXTRA
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_extra_email_billing(p_user_id UUID)
RETURNS TABLE (
    needs_billing BOOLEAN,
    pending_emails INTEGER,
    package_size INTEGER,
    total_amount DECIMAL,
    plan_name TEXT
) AS $$
DECLARE
    v_user RECORD;
    v_plan RECORD;
    v_pending INTEGER;
BEGIN
    -- Buscar usuário
    SELECT * INTO v_user FROM users WHERE id = p_user_id;

    IF v_user IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 0, 0::DECIMAL, ''::TEXT;
        RETURN;
    END IF;

    -- Buscar plano do usuário
    SELECT p.* INTO v_plan
    FROM plans p
    JOIN subscriptions s ON s.plan_id = p.id
    WHERE s.user_id = p_user_id
    AND s.status = 'active'
    LIMIT 1;

    IF v_plan IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 0, 0::DECIMAL, ''::TEXT;
        RETURN;
    END IF;

    -- Calcular emails pendentes
    v_pending := v_user.pending_extra_emails;

    -- Verificar se atingiu o tamanho do pacote
    IF v_pending >= v_plan.extra_email_package_size THEN
        RETURN QUERY SELECT
            TRUE,
            v_pending,
            v_plan.extra_email_package_size,
            (v_plan.extra_email_package_size * v_plan.extra_email_price)::DECIMAL,
            v_plan.name;
    ELSE
        RETURN QUERY SELECT
            FALSE,
            v_pending,
            v_plan.extra_email_package_size,
            (v_plan.extra_email_package_size * v_plan.extra_email_price)::DECIMAL,
            v_plan.name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 5. FUNÇÃO PARA INCREMENTAR EMAIL EXTRA PENDENTE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_pending_extra_email(p_user_id UUID)
RETURNS TABLE (
    new_pending_count INTEGER,
    needs_billing BOOLEAN,
    package_size INTEGER,
    total_amount DECIMAL
) AS $$
DECLARE
    v_user RECORD;
    v_plan RECORD;
    v_new_pending INTEGER;
BEGIN
    -- Incrementar contador de pendentes
    UPDATE users
    SET pending_extra_emails = pending_extra_emails + 1,
        extra_emails_used = extra_emails_used + 1
    WHERE id = p_user_id
    RETURNING * INTO v_user;

    v_new_pending := v_user.pending_extra_emails;

    -- Buscar plano
    SELECT p.* INTO v_plan
    FROM plans p
    JOIN subscriptions s ON s.plan_id = p.id
    WHERE s.user_id = p_user_id
    AND s.status = 'active'
    LIMIT 1;

    IF v_plan IS NULL THEN
        RETURN QUERY SELECT v_new_pending, FALSE, 0, 0::DECIMAL;
        RETURN;
    END IF;

    -- Verificar se precisa cobrar
    IF v_new_pending >= v_plan.extra_email_package_size THEN
        RETURN QUERY SELECT
            v_new_pending,
            TRUE,
            v_plan.extra_email_package_size,
            (v_plan.extra_email_package_size * v_plan.extra_email_price)::DECIMAL;
    ELSE
        RETURN QUERY SELECT
            v_new_pending,
            FALSE,
            v_plan.extra_email_package_size,
            (v_plan.extra_email_package_size * v_plan.extra_email_price)::DECIMAL;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 6. FUNÇÃO PARA REGISTRAR COMPRA DE PACOTE EXTRA
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION register_extra_email_purchase(
    p_user_id UUID,
    p_package_size INTEGER,
    p_price_per_email DECIMAL,
    p_stripe_payment_intent_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_purchase_id UUID;
    v_plan_id UUID;
    v_pending INTEGER;
BEGIN
    -- Buscar plan_id atual
    SELECT s.plan_id INTO v_plan_id
    FROM subscriptions s
    WHERE s.user_id = p_user_id
    AND s.status = 'active'
    LIMIT 1;

    -- Buscar pending atual
    SELECT pending_extra_emails INTO v_pending FROM users WHERE id = p_user_id;

    -- Criar registro de compra
    INSERT INTO email_extra_purchases (
        user_id,
        plan_id,
        package_size,
        price_per_email,
        total_amount,
        stripe_payment_intent_id,
        status,
        triggered_at_usage
    ) VALUES (
        p_user_id,
        v_plan_id,
        p_package_size,
        p_price_per_email,
        p_package_size * p_price_per_email,
        p_stripe_payment_intent_id,
        'pending',
        v_pending
    )
    RETURNING id INTO v_purchase_id;

    RETURN v_purchase_id;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 7. FUNÇÃO PARA CONFIRMAR COMPRA DE PACOTE EXTRA
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION confirm_extra_email_purchase(
    p_purchase_id UUID,
    p_stripe_charge_id TEXT DEFAULT NULL,
    p_stripe_invoice_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_purchase RECORD;
BEGIN
    -- Buscar compra
    SELECT * INTO v_purchase FROM email_extra_purchases WHERE id = p_purchase_id;

    IF v_purchase IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Atualizar status da compra
    UPDATE email_extra_purchases
    SET status = 'completed',
        stripe_charge_id = p_stripe_charge_id,
        stripe_invoice_id = p_stripe_invoice_id,
        completed_at = NOW()
    WHERE id = p_purchase_id;

    -- Atualizar usuário: adicionar créditos e zerar pendentes
    UPDATE users
    SET extra_emails_purchased = extra_emails_purchased + v_purchase.package_size,
        pending_extra_emails = GREATEST(0, pending_extra_emails - v_purchase.package_size)
    WHERE id = v_purchase.user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 8. FUNÇÃO PARA RESETAR CONTADORES NO INÍCIO DO PERÍODO
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reset_email_counters(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET emails_used = 0,
        extra_emails_purchased = 0,
        extra_emails_used = 0,
        pending_extra_emails = 0
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 9. ATUALIZAR FUNÇÃO check_credits_available PARA CONSIDERAR EXTRAS
-- -----------------------------------------------------------------------------
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

    -- Total disponível = limite do plano + extras comprados - usados
    v_total_available := v_user.emails_limit + v_user.extra_emails_purchased - v_user.emails_used - v_user.extra_emails_used;

    RETURN v_total_available > 0;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 10. FUNÇÃO PARA OBTER STATUS DE CRÉDITOS DO USUÁRIO
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_credits_status(p_user_id UUID)
RETURNS TABLE (
    plan_limit INTEGER,
    plan_used INTEGER,
    extras_purchased INTEGER,
    extras_used INTEGER,
    pending_billing INTEGER,
    total_available INTEGER,
    percentage_used DECIMAL
) AS $$
DECLARE
    v_user RECORD;
    v_total_available INTEGER;
    v_total_limit INTEGER;
    v_total_used INTEGER;
BEGIN
    SELECT * INTO v_user FROM users WHERE id = p_user_id;

    IF v_user IS NULL THEN
        RETURN QUERY SELECT 0, 0, 0, 0, 0, 0, 0::DECIMAL;
        RETURN;
    END IF;

    v_total_limit := v_user.emails_limit + v_user.extra_emails_purchased;
    v_total_used := v_user.emails_used + v_user.extra_emails_used;
    v_total_available := GREATEST(0, v_total_limit - v_total_used);

    RETURN QUERY SELECT
        v_user.emails_limit,
        v_user.emails_used,
        v_user.extra_emails_purchased,
        v_user.extra_emails_used,
        v_user.pending_extra_emails,
        v_total_available,
        CASE
            WHEN v_total_limit > 0 THEN (v_total_used::DECIMAL / v_total_limit * 100)
            ELSE 0
        END;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- FIM DA MIGRATION
-- -----------------------------------------------------------------------------
