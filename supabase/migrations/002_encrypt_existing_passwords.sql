-- =============================================================================
-- REPLYNA V2 - MIGRATION 002: Encrypt Existing Passwords
-- =============================================================================
-- IMPORTANTE: Este script deve ser executado APÓS configurar a variável
-- de ambiente EMAIL_ENCRYPTION_KEY no Supabase Vault ou Vercel
--
-- A encriptação é feita no lado da aplicação (Edge Function), não no banco.
-- Este script apenas prepara a estrutura e documenta o processo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. VERIFICAR ESTRUTURA
-- -----------------------------------------------------------------------------
-- Confirmar que os campos encrypted existem
DO $$
BEGIN
    -- Verificar se os campos de senha encriptada existem
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'shops'
        AND column_name = 'imap_password_encrypted'
    ) THEN
        RAISE EXCEPTION 'Coluna imap_password_encrypted não existe. Execute migration 001 primeiro.';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. CRIAR FUNÇÃO PARA MARCAR SENHAS COMO MIGRADAS
-- -----------------------------------------------------------------------------
-- Esta função será chamada pela Edge Function após encriptar cada senha

CREATE OR REPLACE FUNCTION mark_password_migrated(
    p_shop_id UUID,
    p_imap_encrypted TEXT,
    p_smtp_encrypted TEXT,
    p_shopify_encrypted TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE shops
    SET
        imap_password_encrypted = p_imap_encrypted,
        smtp_password_encrypted = COALESCE(p_smtp_encrypted, p_imap_encrypted), -- SMTP geralmente usa mesma senha
        shopify_client_secret_encrypted = p_shopify_encrypted,
        -- Limpar senhas em texto puro após migração
        imap_password = NULL,
        smtp_password = NULL,
        shopify_client_secret = CASE
            WHEN p_shopify_encrypted IS NOT NULL THEN NULL
            ELSE shopify_client_secret
        END
    WHERE id = p_shop_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 3. VIEW PARA IDENTIFICAR LOJAS QUE PRECISAM MIGRAÇÃO
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW shops_pending_encryption AS
SELECT
    id,
    name,
    user_id,
    CASE WHEN imap_password IS NOT NULL AND imap_password != '' THEN TRUE ELSE FALSE END AS has_imap_password,
    CASE WHEN imap_password_encrypted IS NOT NULL THEN TRUE ELSE FALSE END AS imap_migrated,
    CASE WHEN shopify_client_secret IS NOT NULL AND shopify_client_secret != '' THEN TRUE ELSE FALSE END AS has_shopify_secret,
    CASE WHEN shopify_client_secret_encrypted IS NOT NULL THEN TRUE ELSE FALSE END AS shopify_migrated
FROM shops
WHERE
    (imap_password IS NOT NULL AND imap_password != '' AND imap_password_encrypted IS NULL)
    OR (shopify_client_secret IS NOT NULL AND shopify_client_secret != '' AND shopify_client_secret_encrypted IS NULL);

COMMENT ON VIEW shops_pending_encryption IS 'Lojas que ainda têm senhas em texto puro aguardando migração';

-- -----------------------------------------------------------------------------
-- 4. FUNÇÃO PARA ESTATÍSTICAS DE MIGRAÇÃO
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_encryption_migration_stats()
RETURNS TABLE (
    total_shops BIGINT,
    shops_with_email BIGINT,
    email_migrated BIGINT,
    shops_with_shopify BIGINT,
    shopify_migrated BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_shops,
        COUNT(*) FILTER (WHERE imap_password IS NOT NULL AND imap_password != '')::BIGINT as shops_with_email,
        COUNT(*) FILTER (WHERE imap_password_encrypted IS NOT NULL)::BIGINT as email_migrated,
        COUNT(*) FILTER (WHERE shopify_client_secret IS NOT NULL AND shopify_client_secret != '')::BIGINT as shops_with_shopify,
        COUNT(*) FILTER (WHERE shopify_client_secret_encrypted IS NOT NULL)::BIGINT as shopify_migrated
    FROM shops;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 5. INSTRUÇÕES PARA MIGRAÇÃO
-- -----------------------------------------------------------------------------
/*
PROCESSO DE MIGRAÇÃO DAS SENHAS:

1. Configure a variável de ambiente EMAIL_ENCRYPTION_KEY na Vercel:
   - Gere uma chave segura: openssl rand -hex 32
   - Adicione em Vercel > Settings > Environment Variables

2. Execute a Edge Function de migração (será criada na Fase 2):
   POST /api/migrate-passwords

3. Verifique o progresso:
   SELECT * FROM get_encryption_migration_stats();

4. Confirme que todas as lojas foram migradas:
   SELECT * FROM shops_pending_encryption;
   (Deve retornar 0 linhas)

5. APÓS confirmar que tudo foi migrado, execute:
   -- CUIDADO: Isso remove permanentemente as senhas em texto puro
   -- UPDATE shops SET imap_password = NULL, smtp_password = NULL, shopify_client_secret = NULL
   -- WHERE imap_password_encrypted IS NOT NULL;

NOTA: A Edge Function de processamento de emails usará APENAS as senhas encriptadas.
Se uma loja não tiver senha encriptada, ela será ignorada no processamento.
*/

-- -----------------------------------------------------------------------------
-- FIM DA MIGRATION
-- -----------------------------------------------------------------------------
