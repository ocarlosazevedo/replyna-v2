-- =============================================================================
-- MIGRATION 054: Add form_data JSONB column + Extend ticket_status
-- =============================================================================
-- Permite armazenar dados completos do formulário de devolução na tabela
-- conversations e adiciona status 'approved'/'rejected' para aprovação.
-- =============================================================================

-- 1. Adicionar coluna JSONB para dados do formulário
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT NULL;

-- 2. Índice parcial para queries eficientes em formulários com dados
CREATE INDEX IF NOT EXISTS idx_conversations_form_data_not_null
  ON conversations(created_at DESC)
  WHERE form_data IS NOT NULL;

-- 3. Estender CHECK constraint de ticket_status
ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_ticket_status_check;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_ticket_status_check
  CHECK (ticket_status IN ('pending', 'answered', 'closed', 'approved', 'rejected'));
