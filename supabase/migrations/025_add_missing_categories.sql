-- =============================================================================
-- MIGRATION 025: Add Missing Categories to Constraint
-- =============================================================================
-- Adiciona as categorias 'edicao_pedido' e 'acknowledgment' que estão sendo
-- usadas pelo código mas não existem no constraint do banco de dados.
-- =============================================================================

-- 1. Remove o constraint antigo de messages
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_category_check;

-- 2. Adiciona o novo constraint com TODAS as categorias usadas
ALTER TABLE messages ADD CONSTRAINT messages_category_check CHECK (category IN (
    'spam',
    'duvidas_gerais',
    'rastreio',
    'troca_devolucao_reembolso',
    'edicao_pedido',      -- NOVA: para edição/cancelamento de pedidos não enviados
    'suporte_humano',
    'acknowledgment'      -- NOVA: para mensagens de agradecimento/confirmação
));

-- 3. Também atualizar a tabela conversations (se tiver constraint)
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_category_check;

-- 4. Adicionar constraint em conversations também
ALTER TABLE conversations ADD CONSTRAINT conversations_category_check CHECK (category IS NULL OR category IN (
    'spam',
    'duvidas_gerais',
    'rastreio',
    'troca_devolucao_reembolso',
    'edicao_pedido',
    'suporte_humano',
    'acknowledgment'
));

-- =============================================================================
-- VERIFICAÇÃO
-- =============================================================================
-- Para verificar que o constraint foi aplicado corretamente:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname LIKE '%category_check%';
-- =============================================================================
