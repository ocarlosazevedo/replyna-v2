-- =============================================================================
-- REPLYNA V2 - MIGRATION 061: Teams System
-- =============================================================================
-- Sistema de equipes com convites e controle de permissões.
-- Permite que o dono da conta convide membros para acessar
-- lojas específicas com permissões granulares.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABELA DE CONVITES DE EQUIPE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Quem enviou o convite (dono da conta)
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Dados do convite
    code TEXT UNIQUE NOT NULL,
    invited_email TEXT NOT NULL,
    invited_name TEXT,

    -- Role e permissões
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'operator', 'manager')),
    allowed_shop_ids UUID[] NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{}',

    -- Status do convite
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    accepted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    accepted_at TIMESTAMPTZ,

    -- Validade
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_team_invites_owner ON team_invites(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_code ON team_invites(code);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites(invited_email);
CREATE INDEX IF NOT EXISTS idx_team_invites_status ON team_invites(status);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_team_invites_updated_at ON team_invites;
CREATE TRIGGER update_team_invites_updated_at
    BEFORE UPDATE ON team_invites
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. TABELA DE MEMBROS DA EQUIPE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Dono da conta
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Membro da equipe (precisa ter conta Replyna)
    member_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Role do membro
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'operator', 'manager')),

    -- Lojas que o membro pode acessar
    allowed_shop_ids UUID[] NOT NULL DEFAULT '{}',

    -- Permissões granulares (JSON)
    permissions JSONB NOT NULL DEFAULT '{}',

    -- Referência ao convite que gerou este membro
    invite_id UUID REFERENCES team_invites(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Um usuário só pode ser membro de um owner uma vez
    UNIQUE(owner_user_id, member_user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_team_members_owner ON team_members(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_member ON team_members(member_user_id);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_team_members_updated_at ON team_members;
CREATE TRIGGER update_team_members_updated_at
    BEFORE UPDATE ON team_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. ADICIONAR COLUNA team_members_limit NA TABELA PLANS
-- -----------------------------------------------------------------------------
ALTER TABLE plans ADD COLUMN IF NOT EXISTS team_members_limit INTEGER DEFAULT 0;

COMMENT ON COLUMN plans.team_members_limit IS '0 = sem membros, NULL = ilimitado';

-- -----------------------------------------------------------------------------
-- 4. FUNÇÃO HELPER PARA RLS (lojas acessíveis por um usuário)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_accessible_shop_ids(p_user_id UUID)
RETURNS UUID[] AS $$
DECLARE
    v_owned UUID[];
    v_member UUID[];
BEGIN
    -- Lojas que o usuário possui diretamente
    SELECT ARRAY_AGG(id) INTO v_owned
    FROM shops
    WHERE user_id = p_user_id;

    -- Lojas que o usuário tem acesso como membro de equipe
    SELECT ARRAY_AGG(unnested) INTO v_member
    FROM (
        SELECT UNNEST(allowed_shop_ids) AS unnested
        FROM team_members
        WHERE member_user_id = p_user_id
    ) sub;

    RETURN COALESCE(v_owned, '{}') || COALESCE(v_member, '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

COMMENT ON FUNCTION get_accessible_shop_ids IS 'Retorna todas as shop_ids acessíveis por um usuário (próprias + equipes)';

-- -----------------------------------------------------------------------------
-- 5. RLS PARA team_invites
-- -----------------------------------------------------------------------------
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

-- Owners podem ver seus convites
CREATE POLICY "Owners can view their team invites" ON team_invites
    FOR SELECT
    USING (owner_user_id = auth.uid());

-- Service role gerencia tudo
CREATE POLICY "Service role can manage team invites" ON team_invites
    FOR ALL
    USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 6. RLS PARA team_members
-- -----------------------------------------------------------------------------
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Owners podem ver seus membros
CREATE POLICY "Owners can view their team members" ON team_members
    FOR SELECT
    USING (owner_user_id = auth.uid());

-- Membros podem ver sua própria membership
CREATE POLICY "Members can view their own membership" ON team_members
    FOR SELECT
    USING (member_user_id = auth.uid());

-- Service role gerencia tudo
CREATE POLICY "Service role can manage team members" ON team_members
    FOR ALL
    USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 7. ATUALIZAR RLS POLICIES EXISTENTES PARA SUPORTAR MEMBROS DE EQUIPE
-- -----------------------------------------------------------------------------

-- 7.1 MESSAGES: Atualizar policy para incluir membros de equipe
DROP POLICY IF EXISTS "Users can view messages from their shops" ON messages;
CREATE POLICY "Users can view messages from their shops" ON messages
    FOR SELECT
    USING (
        conversation_id IN (
            SELECT c.id FROM conversations c
            WHERE c.shop_id = ANY(get_accessible_shop_ids(auth.uid()))
        )
    );

-- 7.2 EMAIL_PROCESSING_LOGS: Atualizar policy
DROP POLICY IF EXISTS "Users can view logs from their shops" ON email_processing_logs;
CREATE POLICY "Users can view logs from their shops" ON email_processing_logs
    FOR SELECT
    USING (
        shop_id = ANY(get_accessible_shop_ids(auth.uid()))
    );

-- 7.3 RATE_LIMITS: Atualizar policy
DROP POLICY IF EXISTS "Users can view rate limits from their shops" ON rate_limits;
CREATE POLICY "Users can view rate limits from their shops" ON rate_limits
    FOR SELECT
    USING (
        shop_id = ANY(get_accessible_shop_ids(auth.uid()))
    );

-- 7.4 SHOP_PRODUCTS_CACHE: Atualizar policy
DROP POLICY IF EXISTS "Users can view products from their shops" ON shop_products_cache;
CREATE POLICY "Users can view products from their shops" ON shop_products_cache
    FOR SELECT
    USING (
        shop_id = ANY(get_accessible_shop_ids(auth.uid()))
    );

-- 7.5 JOB_QUEUE: Atualizar policy
DROP POLICY IF EXISTS "Users can view their shop jobs" ON job_queue;
CREATE POLICY "Users can view their shop jobs" ON job_queue
    FOR SELECT
    TO authenticated
    USING (
        shop_id = ANY(get_accessible_shop_ids(auth.uid()))
    );

-- 7.6 CIRCUIT_BREAKERS: Atualizar policy
DROP POLICY IF EXISTS "Users can view their shop circuit breakers" ON circuit_breakers;
CREATE POLICY "Users can view their shop circuit breakers" ON circuit_breakers
    FOR SELECT
    TO authenticated
    USING (
        shop_id = ANY(get_accessible_shop_ids(auth.uid()))
    );

-- 7.7 QUEUE_METRICS: Atualizar policy
DROP POLICY IF EXISTS "Users can view their shop metrics" ON queue_metrics;
CREATE POLICY "Users can view their shop metrics" ON queue_metrics
    FOR SELECT
    TO authenticated
    USING (
        shop_id IS NULL
        OR shop_id = ANY(get_accessible_shop_ids(auth.uid()))
    );

-- -----------------------------------------------------------------------------
-- 8. FUNÇÃO PARA GERAR CÓDIGO DE CONVITE ÚNICO
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_team_invite_code()
RETURNS TEXT AS $$
DECLARE
    v_code TEXT;
    v_exists BOOLEAN;
BEGIN
    LOOP
        -- Gerar código alfanumérico de 8 caracteres
        v_code := UPPER(SUBSTRING(MD5(gen_random_uuid()::TEXT) FROM 1 FOR 8));

        -- Verificar se já existe
        SELECT EXISTS(SELECT 1 FROM team_invites WHERE code = v_code) INTO v_exists;

        EXIT WHEN NOT v_exists;
    END LOOP;

    RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------------
-- 9. FUNÇÃO PARA OBTER PERMISSÕES PADRÃO POR ROLE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_default_team_permissions(p_role TEXT)
RETURNS JSONB AS $$
BEGIN
    CASE p_role
        WHEN 'viewer' THEN
            RETURN '{
                "conversations": {"read": true, "reply": false, "close": false},
                "shops": {"read": true, "edit": false},
                "tickets": {"read": true, "reply": false},
                "forms": {"read": true, "manage": false},
                "billing": {"read": false},
                "team": {"read": false, "manage": false}
            }'::JSONB;
        WHEN 'operator' THEN
            RETURN '{
                "conversations": {"read": true, "reply": true, "close": false},
                "shops": {"read": true, "edit": false},
                "tickets": {"read": true, "reply": true},
                "forms": {"read": true, "manage": true},
                "billing": {"read": false},
                "team": {"read": false, "manage": false}
            }'::JSONB;
        WHEN 'manager' THEN
            RETURN '{
                "conversations": {"read": true, "reply": true, "close": true},
                "shops": {"read": true, "edit": true},
                "tickets": {"read": true, "reply": true},
                "forms": {"read": true, "manage": true},
                "billing": {"read": true},
                "team": {"read": true, "manage": true}
            }'::JSONB;
        ELSE
            RETURN '{}'::JSONB;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- -----------------------------------------------------------------------------
-- 10. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- -----------------------------------------------------------------------------
COMMENT ON TABLE team_invites IS 'Convites para membros de equipe';
COMMENT ON TABLE team_members IS 'Membros de equipe com acesso a lojas específicas';

COMMENT ON COLUMN team_invites.code IS 'Código único de 8 caracteres para o convite';
COMMENT ON COLUMN team_invites.role IS 'viewer = só leitura, operator = leitura + ações, manager = acesso total';
COMMENT ON COLUMN team_invites.allowed_shop_ids IS 'Array de UUIDs das lojas que o membro pode acessar';
COMMENT ON COLUMN team_invites.permissions IS 'Permissões granulares em formato JSON';

COMMENT ON COLUMN team_members.role IS 'viewer = só leitura, operator = leitura + ações, manager = acesso total';
COMMENT ON COLUMN team_members.allowed_shop_ids IS 'Array de UUIDs das lojas que o membro pode acessar';
COMMENT ON COLUMN team_members.permissions IS 'Permissões granulares em formato JSON';

-- -----------------------------------------------------------------------------
-- FIM DA MIGRATION
-- -----------------------------------------------------------------------------
