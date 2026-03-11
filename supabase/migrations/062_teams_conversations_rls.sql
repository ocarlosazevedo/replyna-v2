-- =============================================================================
-- 062: Atualizar RLS de conversations e shops para suportar membros de equipe
-- =============================================================================
-- A migration 061 atualizou messages, email_processing_logs, rate_limits, etc.
-- mas NÃO atualizou conversations e shops. Membros de equipe não conseguem
-- ver conversas das lojas que têm acesso.

-- 1. CONVERSATIONS: Atualizar policy de SELECT para incluir membros de equipe
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view conversations from their shops" ON conversations;
CREATE POLICY "Users can view conversations from their shops" ON conversations
    FOR SELECT
    USING (
        shop_id = ANY(get_accessible_shop_ids(auth.uid()))
    );

-- 2. SHOPS: Adicionar policy para membros de equipe verem lojas permitidas
-- (shops pode não ter RLS habilitado, então habilitamos primeiro)
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own shops" ON shops;
CREATE POLICY "Users can view their own shops" ON shops
    FOR SELECT
    USING (
        id = ANY(get_accessible_shop_ids(auth.uid()))
    );

-- Manter policy para owner gerenciar suas lojas
DROP POLICY IF EXISTS "Users can manage their own shops" ON shops;
CREATE POLICY "Users can manage their own shops" ON shops
    FOR ALL
    USING (user_id = auth.uid());

-- Service role pode tudo
DROP POLICY IF EXISTS "Service role can manage all shops" ON shops;
CREATE POLICY "Service role can manage all shops" ON shops
    FOR ALL
    USING (auth.role() = 'service_role');
