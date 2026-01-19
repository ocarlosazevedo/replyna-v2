-- =============================================================================
-- REPLYNA V2 - MIGRATION 004: Admin Panel Schema
-- =============================================================================
-- Este script configura as tabelas para o painel administrativo
-- Execute este script no SQL Editor do Supabase Dashboard
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABELA DE ADMINISTRADORES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON admins(is_active);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_admins_updated_at ON admins;
CREATE TRIGGER update_admins_updated_at
    BEFORE UPDATE ON admins
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. TABELA DE PLANOS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,

    -- Preços
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2),

    -- Limites
    emails_limit INTEGER NOT NULL DEFAULT 100,
    shops_limit INTEGER NOT NULL DEFAULT 1,

    -- Features (JSON para flexibilidade)
    features JSONB DEFAULT '[]',

    -- Stripe
    stripe_product_id TEXT,
    stripe_price_monthly_id TEXT,
    stripe_price_yearly_id TEXT,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_popular BOOLEAN DEFAULT FALSE, -- Destacar na página de preços
    sort_order INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);
CREATE INDEX IF NOT EXISTS idx_plans_sort_order ON plans(sort_order);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
CREATE TRIGGER update_plans_updated_at
    BEFORE UPDATE ON plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. TABELA DE CUPONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,

    -- Tipo de desconto
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
    discount_value DECIMAL(10,2) NOT NULL,

    -- Restrições
    min_purchase_amount DECIMAL(10,2), -- Valor mínimo para usar o cupom
    max_discount_amount DECIMAL(10,2), -- Desconto máximo (para %)

    -- Limites de uso
    usage_limit INTEGER, -- NULL = ilimitado
    usage_count INTEGER DEFAULT 0,
    usage_limit_per_user INTEGER DEFAULT 1,

    -- Validade
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,

    -- Planos específicos (NULL = todos os planos)
    applicable_plan_ids UUID[],

    -- Stripe
    stripe_coupon_id TEXT,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_valid_until ON coupons(valid_until);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_coupons_updated_at ON coupons;
CREATE TRIGGER update_coupons_updated_at
    BEFORE UPDATE ON coupons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. TABELA DE USO DE CUPONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupon_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Detalhes do uso
    discount_applied DECIMAL(10,2) NOT NULL,
    subscription_id TEXT, -- Stripe subscription ID

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(coupon_id, user_id, subscription_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_id ON coupon_usages(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user_id ON coupon_usages(user_id);

-- -----------------------------------------------------------------------------
-- 5. TABELA DE ASSINATURAS (para rastrear Stripe)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,

    -- Stripe
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT UNIQUE,
    stripe_price_id TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active',
        'past_due',
        'canceled',
        'unpaid',
        'trialing',
        'incomplete'
    )),

    -- Período
    billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMPTZ,

    -- Cupom aplicado
    coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 6. ADICIONAR CAMPOS NA TABELA USERS
-- -----------------------------------------------------------------------------
ALTER TABLE users
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Índice para stripe_customer_id
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- -----------------------------------------------------------------------------
-- 7. TABELA DE SESSÕES ADMIN
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);

-- -----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------

-- Habilitar RLS nas novas tabelas
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas para admins (apenas service_role pode acessar)
CREATE POLICY "Service role can manage admins" ON admins
    FOR ALL
    USING (auth.role() = 'service_role');

-- Políticas para plans (todos podem ver planos ativos, service_role gerencia)
CREATE POLICY "Anyone can view active plans" ON plans
    FOR SELECT
    USING (is_active = TRUE);

CREATE POLICY "Service role can manage plans" ON plans
    FOR ALL
    USING (auth.role() = 'service_role');

-- Políticas para coupons (service_role pode gerenciar)
CREATE POLICY "Service role can manage coupons" ON coupons
    FOR ALL
    USING (auth.role() = 'service_role');

-- Políticas para coupon_usages
CREATE POLICY "Users can view their coupon usages" ON coupon_usages
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role can manage coupon usages" ON coupon_usages
    FOR ALL
    USING (auth.role() = 'service_role');

-- Políticas para subscriptions
CREATE POLICY "Users can view their subscriptions" ON subscriptions
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role can manage subscriptions" ON subscriptions
    FOR ALL
    USING (auth.role() = 'service_role');

-- Políticas para admin_sessions
CREATE POLICY "Service role can manage admin sessions" ON admin_sessions
    FOR ALL
    USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 9. FUNÇÕES AUXILIARES
-- -----------------------------------------------------------------------------

-- Função para validar cupom
CREATE OR REPLACE FUNCTION validate_coupon(
    p_code TEXT,
    p_user_id UUID,
    p_plan_id UUID DEFAULT NULL
)
RETURNS TABLE (
    is_valid BOOLEAN,
    coupon_id UUID,
    discount_type TEXT,
    discount_value DECIMAL,
    error_message TEXT
) AS $$
DECLARE
    v_coupon RECORD;
    v_user_usage_count INTEGER;
BEGIN
    -- Buscar cupom
    SELECT * INTO v_coupon
    FROM coupons c
    WHERE c.code = UPPER(p_code)
    AND c.is_active = TRUE;

    -- Cupom não encontrado
    IF v_coupon IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::DECIMAL, 'Cupom não encontrado ou inativo'::TEXT;
        RETURN;
    END IF;

    -- Verificar validade
    IF v_coupon.valid_from > NOW() THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::DECIMAL, 'Cupom ainda não está válido'::TEXT;
        RETURN;
    END IF;

    IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < NOW() THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::DECIMAL, 'Cupom expirado'::TEXT;
        RETURN;
    END IF;

    -- Verificar limite de uso total
    IF v_coupon.usage_limit IS NOT NULL AND v_coupon.usage_count >= v_coupon.usage_limit THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::DECIMAL, 'Cupom atingiu o limite de usos'::TEXT;
        RETURN;
    END IF;

    -- Verificar limite de uso por usuário
    SELECT COUNT(*) INTO v_user_usage_count
    FROM coupon_usages cu
    WHERE cu.coupon_id = v_coupon.id
    AND cu.user_id = p_user_id;

    IF v_user_usage_count >= v_coupon.usage_limit_per_user THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::DECIMAL, 'Você já usou este cupom'::TEXT;
        RETURN;
    END IF;

    -- Verificar se é aplicável ao plano
    IF v_coupon.applicable_plan_ids IS NOT NULL AND p_plan_id IS NOT NULL THEN
        IF NOT (p_plan_id = ANY(v_coupon.applicable_plan_ids)) THEN
            RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::DECIMAL, 'Cupom não é válido para este plano'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- Cupom válido
    RETURN QUERY SELECT
        TRUE,
        v_coupon.id,
        v_coupon.discount_type,
        v_coupon.discount_value,
        NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Função para usar cupom
CREATE OR REPLACE FUNCTION use_coupon(
    p_coupon_id UUID,
    p_user_id UUID,
    p_discount_applied DECIMAL,
    p_subscription_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Registrar uso
    INSERT INTO coupon_usages (coupon_id, user_id, discount_applied, subscription_id)
    VALUES (p_coupon_id, p_user_id, p_discount_applied, p_subscription_id);

    -- Incrementar contador
    UPDATE coupons
    SET usage_count = usage_count + 1
    WHERE id = p_coupon_id;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 10. FUNÇÕES DE AUTENTICAÇÃO ADMIN
-- -----------------------------------------------------------------------------

-- Função para criar hash de senha
CREATE OR REPLACE FUNCTION hash_admin_password(p_password TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN crypt(p_password, gen_salt('bf', 10));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para login de admin
CREATE OR REPLACE FUNCTION admin_login(p_email TEXT, p_password TEXT)
RETURNS JSONB AS $$
DECLARE
    v_admin RECORD;
BEGIN
    -- Buscar admin
    SELECT * INTO v_admin
    FROM admins
    WHERE email = LOWER(p_email)
    AND is_active = TRUE;

    -- Admin não encontrado
    IF v_admin IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Email ou senha inválidos');
    END IF;

    -- Verificar senha
    IF v_admin.password_hash != crypt(p_password, v_admin.password_hash) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Email ou senha inválidos');
    END IF;

    -- Atualizar last_login_at
    UPDATE admins SET last_login_at = NOW() WHERE id = v_admin.id;

    -- Retornar sucesso com dados do admin (sem a senha)
    RETURN jsonb_build_object(
        'success', TRUE,
        'admin', jsonb_build_object(
            'id', v_admin.id,
            'email', v_admin.email,
            'name', v_admin.name,
            'role', v_admin.role,
            'is_active', v_admin.is_active,
            'last_login_at', NOW(),
            'created_at', v_admin.created_at
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para criar admin (apenas super_admin pode usar)
CREATE OR REPLACE FUNCTION create_admin(
    p_email TEXT,
    p_name TEXT,
    p_password TEXT,
    p_role TEXT DEFAULT 'admin'
)
RETURNS JSONB AS $$
DECLARE
    v_new_admin_id UUID;
BEGIN
    -- Verificar se email já existe
    IF EXISTS (SELECT 1 FROM admins WHERE email = LOWER(p_email)) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Email já cadastrado');
    END IF;

    -- Criar admin
    INSERT INTO admins (email, name, password_hash, role)
    VALUES (LOWER(p_email), p_name, hash_admin_password(p_password), p_role)
    RETURNING id INTO v_new_admin_id;

    RETURN jsonb_build_object('success', TRUE, 'admin_id', v_new_admin_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para alterar senha de admin
CREATE OR REPLACE FUNCTION change_admin_password(
    p_admin_id UUID,
    p_current_password TEXT,
    p_new_password TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_admin RECORD;
BEGIN
    -- Buscar admin
    SELECT * INTO v_admin FROM admins WHERE id = p_admin_id;

    IF v_admin IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Admin não encontrado');
    END IF;

    -- Verificar senha atual
    IF v_admin.password_hash != crypt(p_current_password, v_admin.password_hash) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Senha atual incorreta');
    END IF;

    -- Atualizar senha
    UPDATE admins SET password_hash = hash_admin_password(p_new_password) WHERE id = p_admin_id;

    RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 11. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- -----------------------------------------------------------------------------
COMMENT ON TABLE admins IS 'Administradores do sistema';
COMMENT ON TABLE plans IS 'Planos de assinatura disponíveis';
COMMENT ON TABLE coupons IS 'Cupons de desconto';
COMMENT ON TABLE coupon_usages IS 'Registro de uso de cupons por usuários';
COMMENT ON TABLE subscriptions IS 'Assinaturas ativas dos usuários';
COMMENT ON TABLE admin_sessions IS 'Sessões de autenticação dos administradores';

COMMENT ON COLUMN plans.features IS 'Array JSON de features do plano, ex: ["Suporte prioritário", "API access"]';
COMMENT ON COLUMN coupons.discount_type IS 'percentage = desconto em %, fixed_amount = valor fixo';
COMMENT ON COLUMN coupons.applicable_plan_ids IS 'Array de UUIDs dos planos onde o cupom é válido, NULL = todos';

-- -----------------------------------------------------------------------------
-- FIM DA MIGRATION
-- -----------------------------------------------------------------------------
