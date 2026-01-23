-- =====================================================================
-- MIGRATION 023: Fix Missing Function and Column
-- =====================================================================
-- Corrige erro no fetch-emails:
-- 1. Adiciona coluna last_email_sync na tabela shops
-- 2. Garante que função get_or_create_conversation existe
-- =====================================================================

-- =====================================================================
-- PARTE 1: Adicionar coluna last_email_sync na tabela shops
-- =====================================================================

-- Adicionar coluna se não existir
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS last_email_sync TIMESTAMPTZ;

-- Comentário explicativo
COMMENT ON COLUMN shops.last_email_sync IS 'Última vez que emails foram fetchados via IMAP para esta loja';

-- =====================================================================
-- PARTE 2: Garantir que função get_or_create_conversation existe
-- =====================================================================
-- Esta função já deveria existir da migration 001, mas vamos garantir

CREATE OR REPLACE FUNCTION get_or_create_conversation(
    p_shop_id UUID,
    p_customer_email TEXT,
    p_subject TEXT,
    p_in_reply_to TEXT DEFAULT NULL,
    p_references TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    shop_id UUID,
    customer_email TEXT,
    subject TEXT,
    status TEXT,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
) AS $$
DECLARE
    v_conversation_id UUID;
    v_conversation RECORD;
BEGIN
    -- Normalizar email
    p_customer_email := LOWER(TRIM(p_customer_email));

    -- Tentar encontrar conversa existente por in_reply_to ou references
    IF p_in_reply_to IS NOT NULL OR p_references IS NOT NULL THEN
        SELECT c.* INTO v_conversation
        FROM conversations c
        JOIN messages m ON m.conversation_id = c.id
        WHERE c.shop_id = p_shop_id
          AND c.customer_email = p_customer_email
          AND (
            m.message_id = p_in_reply_to
            OR m.message_id = ANY(string_to_array(p_references, ' '))
          )
        ORDER BY c.last_message_at DESC
        LIMIT 1;

        IF FOUND THEN
            RETURN QUERY SELECT
                v_conversation.id,
                v_conversation.shop_id,
                v_conversation.customer_email,
                v_conversation.subject,
                v_conversation.status,
                v_conversation.last_message_at,
                v_conversation.created_at;
            RETURN;
        END IF;
    END IF;

    -- Tentar encontrar conversa por subject (últimas 24h)
    SELECT c.* INTO v_conversation
    FROM conversations c
    WHERE c.shop_id = p_shop_id
      AND c.customer_email = p_customer_email
      AND c.subject = p_subject
      AND c.last_message_at > NOW() - INTERVAL '24 hours'
    ORDER BY c.last_message_at DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN QUERY SELECT
            v_conversation.id,
            v_conversation.shop_id,
            v_conversation.customer_email,
            v_conversation.subject,
            v_conversation.status,
            v_conversation.last_message_at,
            v_conversation.created_at;
        RETURN;
    END IF;

    -- Criar nova conversa
    INSERT INTO conversations (
        shop_id,
        customer_email,
        subject,
        status,
        last_message_at,
        created_at
    )
    VALUES (
        p_shop_id,
        p_customer_email,
        p_subject,
        'open',
        NOW(),
        NOW()
    )
    RETURNING * INTO v_conversation;

    RETURN QUERY SELECT
        v_conversation.id,
        v_conversation.shop_id,
        v_conversation.customer_email,
        v_conversation.subject,
        v_conversation.status,
        v_conversation.last_message_at,
        v_conversation.created_at;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- VERIFICAÇÃO
-- =====================================================================
-- Para verificar se tudo funcionou:
--
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_name = 'shops' AND column_name = 'last_email_sync';
--
-- SELECT proname FROM pg_proc WHERE proname = 'get_or_create_conversation';
-- =====================================================================
