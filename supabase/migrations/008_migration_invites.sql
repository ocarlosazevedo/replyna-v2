-- Migration: Sistema de convites para migração de clientes V1
-- Date: 2026-01-20

-- Tabela de convites de migração
CREATE TABLE IF NOT EXISTS migration_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Código único do convite (usado na URL)
    code TEXT UNIQUE NOT NULL,

    -- Dados do cliente V1
    customer_email TEXT NOT NULL,
    customer_name TEXT,

    -- Plano e configurações
    plan_id UUID REFERENCES plans(id),
    shops_limit INTEGER DEFAULT 1,

    -- Data de início da cobrança (quando o Stripe vai começar a cobrar)
    billing_start_date TIMESTAMPTZ NOT NULL,

    -- Status do convite
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),

    -- Admin que criou
    created_by_admin_id UUID REFERENCES admins(id),

    -- Vinculação com novo usuário (após aceitar)
    accepted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    accepted_at TIMESTAMPTZ,

    -- Timestamps
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_migration_invites_code ON migration_invites(code);
CREATE INDEX IF NOT EXISTS idx_migration_invites_status ON migration_invites(status);
CREATE INDEX IF NOT EXISTS idx_migration_invites_email ON migration_invites(customer_email);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_migration_invites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS migration_invites_updated_at ON migration_invites;
CREATE TRIGGER migration_invites_updated_at
    BEFORE UPDATE ON migration_invites
    FOR EACH ROW
    EXECUTE FUNCTION update_migration_invites_updated_at();

-- Comentários
COMMENT ON TABLE migration_invites IS 'Convites para migração de clientes da V1 para V2';
COMMENT ON COLUMN migration_invites.code IS 'Código único usado na URL de convite';
COMMENT ON COLUMN migration_invites.billing_start_date IS 'Data em que o Stripe começará a cobrar (trial_end)';
COMMENT ON COLUMN migration_invites.status IS 'pending=aguardando, accepted=aceito, expired=expirado, cancelled=cancelado';
