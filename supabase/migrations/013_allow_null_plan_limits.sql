-- -----------------------------------------------------------------------------
-- Migration: 013_allow_null_plan_limits
-- Description: Remove NOT NULL constraint das colunas de limite para permitir
--              planos ilimitados (NULL = ilimitado)
-- -----------------------------------------------------------------------------

-- Remover NOT NULL de emails_limit na tabela plans
ALTER TABLE plans ALTER COLUMN emails_limit DROP NOT NULL;

-- Remover NOT NULL de shops_limit na tabela plans
ALTER TABLE plans ALTER COLUMN shops_limit DROP NOT NULL;

-- Comentários já foram adicionados na migration 012
