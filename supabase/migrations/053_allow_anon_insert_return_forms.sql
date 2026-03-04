-- =============================================================================
-- MIGRATION 053: Allow Anonymous Insert for Return Forms
-- =============================================================================
-- O formulário de devolução é público (sem autenticação).
-- Precisa permitir INSERT na tabela conversations via anon key
-- apenas para a categoria 'troca_devolucao_reembolso'.
-- =============================================================================

-- Política para permitir INSERT anônimo (formulário de devolução)
CREATE POLICY "allow_anon_insert_return_forms"
ON conversations
FOR INSERT
TO anon
WITH CHECK (category = 'troca_devolucao_reembolso');

-- =============================================================================
-- VERIFICAÇÃO
-- =============================================================================
-- Para verificar que a política foi aplicada:
-- SELECT * FROM pg_policies WHERE tablename = 'conversations' AND policyname LIKE '%anon%';
-- =============================================================================
