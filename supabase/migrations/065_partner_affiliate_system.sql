-- ============================================
-- Migration 065: Partner/Affiliate System
-- ============================================

-- ── Drop tabelas antigas (estrutura diferente da v1) ──
DROP TABLE IF EXISTS partner_withdrawals CASCADE;
DROP TABLE IF EXISTS partner_commissions CASCADE;
DROP TABLE IF EXISTS partner_referrals CASCADE;
DROP TABLE IF EXISTS partners CASCADE;

-- ── Tabela partners ──
CREATE TABLE IF NOT EXISTS partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    coupon_code TEXT UNIQUE NOT NULL,
    pix_key_type TEXT CHECK (pix_key_type IN ('cpf', 'email', 'phone', 'random')),
    pix_key TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    total_referrals INTEGER DEFAULT 0,
    total_earned DECIMAL(10,2) DEFAULT 0,
    available_balance DECIMAL(10,2) DEFAULT 0,
    pending_balance DECIMAL(10,2) DEFAULT 0,
    withdrawn_balance DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabela partner_referrals ──
CREATE TABLE IF NOT EXISTS partner_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    referred_user_id UUID NOT NULL UNIQUE REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabela partner_commissions ──
CREATE TABLE IF NOT EXISTS partner_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    referral_id UUID NOT NULL REFERENCES partner_referrals(id),
    commission_type TEXT NOT NULL CHECK (commission_type IN ('first_sale', 'recurring')),
    payment_value DECIMAL(10,2) NOT NULL,
    commission_rate DECIMAL(5,2) NOT NULL,
    commission_value DECIMAL(10,2) NOT NULL,
    asaas_payment_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'withdrawn', 'reversed')),
    available_at TIMESTAMPTZ NOT NULL,
    released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabela partner_withdrawals ──
CREATE TABLE IF NOT EXISTS partner_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    pix_key_type TEXT NOT NULL,
    pix_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    admin_notes TEXT,
    reviewed_by UUID REFERENCES admins(id),
    reviewed_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices ──
CREATE INDEX IF NOT EXISTS idx_partners_user_id ON partners(user_id);
CREATE INDEX IF NOT EXISTS idx_partners_coupon_code ON partners(coupon_code);
CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_partner_id ON partner_referrals(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_referred_user_id ON partner_referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner_id ON partner_commissions(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_referral_id ON partner_commissions(referral_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON partner_commissions(status);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_available_at ON partner_commissions(available_at);
CREATE INDEX IF NOT EXISTS idx_partner_withdrawals_partner_id ON partner_withdrawals(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_withdrawals_status ON partner_withdrawals(status);

-- ── RLS ──
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_withdrawals ENABLE ROW LEVEL SECURITY;

-- Partners: usuário lê/atualiza próprio registro
CREATE POLICY "partners_select_own" ON partners
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "partners_update_own" ON partners
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Referrals: acesso via partner_id do próprio partner
CREATE POLICY "referrals_select_own" ON partner_referrals
    FOR SELECT USING (
        partner_id IN (SELECT id FROM partners WHERE user_id = auth.uid())
    );

-- Commissions: acesso via partner_id do próprio partner
CREATE POLICY "commissions_select_own" ON partner_commissions
    FOR SELECT USING (
        partner_id IN (SELECT id FROM partners WHERE user_id = auth.uid())
    );

-- Withdrawals: acesso via partner_id do próprio partner
CREATE POLICY "withdrawals_select_own" ON partner_withdrawals
    FOR SELECT USING (
        partner_id IN (SELECT id FROM partners WHERE user_id = auth.uid())
    );

CREATE POLICY "withdrawals_insert_own" ON partner_withdrawals
    FOR INSERT WITH CHECK (
        partner_id IN (SELECT id FROM partners WHERE user_id = auth.uid())
    );

-- ── Drop funções antigas com assinatura diferente ──
DROP FUNCTION IF EXISTS validate_partner_coupon(TEXT);
DROP FUNCTION IF EXISTS generate_partner_commission(UUID, UUID, DECIMAL, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS release_pending_commissions();
DROP FUNCTION IF EXISTS suspend_partner(UUID);
DROP FUNCTION IF EXISTS reverse_partner_commission(TEXT);

-- ── RPC: validate_partner_coupon ──
-- Verifica se um código é um cupom de partner válido
CREATE OR REPLACE FUNCTION validate_partner_coupon(p_code TEXT)
RETURNS TABLE (
    partner_id UUID,
    is_valid BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    v_partner RECORD;
BEGIN
    SELECT p.id, p.status, u.status AS user_status
    INTO v_partner
    FROM partners p
    JOIN users u ON u.id = p.user_id
    WHERE p.coupon_code = UPPER(p_code);

    IF v_partner IS NULL THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'Cupom não encontrado'::TEXT;
        RETURN;
    END IF;

    IF v_partner.status != 'active' THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'Parceiro suspenso'::TEXT;
        RETURN;
    END IF;

    IF v_partner.user_status != 'active' THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'Parceiro inativo'::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT v_partner.id, TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RPC: generate_partner_commission ──
-- Cria comissão com rate correto e atualiza balances
CREATE OR REPLACE FUNCTION generate_partner_commission(
    p_partner_id UUID,
    p_referral_id UUID,
    p_payment_value DECIMAL,
    p_asaas_payment_id TEXT,
    p_is_first BOOLEAN
)
RETURNS UUID AS $$
DECLARE
    v_rate DECIMAL;
    v_commission DECIMAL;
    v_commission_id UUID;
    v_type TEXT;
BEGIN
    -- Determinar rate: 30% primeira venda, 10% recorrente
    IF p_is_first THEN
        v_rate := 30;
        v_type := 'first_sale';
    ELSE
        v_rate := 10;
        v_type := 'recurring';
    END IF;

    v_commission := ROUND((p_payment_value * v_rate) / 100, 2);

    -- Criar comissão
    INSERT INTO partner_commissions (
        partner_id, referral_id, commission_type,
        payment_value, commission_rate, commission_value,
        asaas_payment_id, status, available_at
    ) VALUES (
        p_partner_id, p_referral_id, v_type,
        p_payment_value, v_rate, v_commission,
        p_asaas_payment_id, 'pending', NOW() + INTERVAL '15 days'
    ) RETURNING id INTO v_commission_id;

    -- Atualizar balances do partner
    UPDATE partners SET
        pending_balance = pending_balance + v_commission,
        total_earned = total_earned + v_commission,
        updated_at = NOW()
    WHERE id = p_partner_id;

    RETURN v_commission_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RPC: release_pending_commissions ──
-- Move comissões de pending → available onde available_at <= NOW()
CREATE OR REPLACE FUNCTION release_pending_commissions()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_record RECORD;
BEGIN
    FOR v_record IN
        SELECT id, partner_id, commission_value
        FROM partner_commissions
        WHERE status = 'pending'
        AND available_at <= NOW()
    LOOP
        -- Atualizar comissão
        UPDATE partner_commissions
        SET status = 'available', released_at = NOW()
        WHERE id = v_record.id;

        -- Mover de pending para available no partner
        UPDATE partners SET
            pending_balance = pending_balance - v_record.commission_value,
            available_balance = available_balance + v_record.commission_value,
            updated_at = NOW()
        WHERE id = v_record.partner_id;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RPC: suspend_partner ──
-- Suspende partner quando usuário fica inadimplente (zera balances)
CREATE OR REPLACE FUNCTION suspend_partner(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_partner RECORD;
BEGIN
    SELECT id, available_balance, pending_balance
    INTO v_partner
    FROM partners
    WHERE user_id = p_user_id AND status = 'active';

    IF v_partner IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Reverter comissões pendentes
    UPDATE partner_commissions
    SET status = 'reversed'
    WHERE partner_id = v_partner.id
    AND status IN ('pending', 'available');

    -- Zerar balances e suspender
    UPDATE partners SET
        status = 'suspended',
        available_balance = 0,
        pending_balance = 0,
        updated_at = NOW()
    WHERE id = v_partner.id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RPC: reverse_partner_commission ──
-- Reverte comissão por chargeback
CREATE OR REPLACE FUNCTION reverse_partner_commission(p_asaas_payment_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_commission RECORD;
BEGIN
    SELECT id, partner_id, commission_value, status
    INTO v_commission
    FROM partner_commissions
    WHERE asaas_payment_id = p_asaas_payment_id
    AND status IN ('pending', 'available')
    LIMIT 1;

    IF v_commission IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Reverter comissão
    UPDATE partner_commissions
    SET status = 'reversed'
    WHERE id = v_commission.id;

    -- Ajustar balance correspondente
    IF v_commission.status = 'pending' THEN
        UPDATE partners SET
            pending_balance = GREATEST(0, pending_balance - v_commission.commission_value),
            total_earned = GREATEST(0, total_earned - v_commission.commission_value),
            updated_at = NOW()
        WHERE id = v_commission.partner_id;
    ELSIF v_commission.status = 'available' THEN
        UPDATE partners SET
            available_balance = GREATEST(0, available_balance - v_commission.commission_value),
            total_earned = GREATEST(0, total_earned - v_commission.commission_value),
            updated_at = NOW()
        WHERE id = v_commission.partner_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
