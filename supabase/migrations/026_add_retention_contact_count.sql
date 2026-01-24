-- -----------------------------------------------------------------------------
-- Migration 026: Adiciona contador de contatos de retenção
-- -----------------------------------------------------------------------------
-- Este campo rastreia quantas vezes o cliente pediu cancelamento/reembolso
-- na mesma conversa, para aplicar o fluxo de retenção de 3 contatos.
-- -----------------------------------------------------------------------------

-- Adicionar campo retention_contact_count na tabela conversations
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS retention_contact_count INTEGER DEFAULT 0;

-- Comentário explicativo
COMMENT ON COLUMN conversations.retention_contact_count IS 'Contador de contatos de retenção para cancelamento/reembolso (fluxo de 3 contatos)';

-- -----------------------------------------------------------------------------
-- FIM DA MIGRATION
-- -----------------------------------------------------------------------------
