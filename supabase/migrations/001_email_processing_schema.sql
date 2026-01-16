-- =============================================================================
-- REPLYNA V2 - MIGRATION 001: Email Processing Schema
-- =============================================================================
-- Este script configura o banco de dados para o sistema de processamento de emails
-- Execute este script no SQL Editor do Supabase Dashboard
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXTENSÃO PARA CRIPTOGRAFIA
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 2. ADICIONAR CAMPOS NA TABELA CONVERSATIONS
-- -----------------------------------------------------------------------------
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS customer_email TEXT,
ADD COLUMN IF NOT EXISTS data_request_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'pt-BR',
ADD COLUMN IF NOT EXISTS shopify_order_id TEXT,
ADD COLUMN IF NOT EXISTS shopify_customer_id TEXT,
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Índices para conversations
CREATE INDEX IF NOT EXISTS idx_conversations_customer_email ON conversations(customer_email);
CREATE INDEX IF NOT EXISTS idx_conversations_shop_status ON conversations(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. RECRIAR/EXPANDIR TABELA MESSAGES
-- -----------------------------------------------------------------------------
-- Primeiro, fazer backup dos dados existentes se houver
DO $$
BEGIN
    -- Verificar se a tabela messages existe e tem dados
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'messages') THEN
        -- Criar tabela de backup
        CREATE TABLE IF NOT EXISTS messages_backup AS SELECT * FROM messages;
        -- Dropar a tabela antiga
        DROP TABLE messages;
    END IF;
END $$;

-- Criar a nova tabela messages com estrutura completa
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

    -- Campos do email
    from_email TEXT NOT NULL,
    from_name TEXT,
    to_email TEXT NOT NULL,
    subject TEXT,
    body_text TEXT,
    body_html TEXT,

    -- Headers para threading
    message_id TEXT UNIQUE, -- ID único do IMAP
    in_reply_to TEXT,
    references_header TEXT,

    -- Anexos (apenas metadados)
    has_attachments BOOLEAN DEFAULT FALSE,
    attachment_count INTEGER DEFAULT 0,

    -- Direção e status
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',           -- Aguardando processamento
        'processing',        -- Sendo processado
        'replied',           -- Respondido com sucesso
        'pending_credits',   -- Sem créditos para responder
        'pending_human',     -- Encaminhado para humano
        'failed'             -- Erro no processamento
    )),

    -- Classificação IA
    category TEXT CHECK (category IN (
        'rastreio',
        'reembolso',
        'produto',
        'pagamento',
        'entrega',
        'suporte_humano',
        'outros'
    )),
    category_confidence DECIMAL(3,2), -- 0.00 a 1.00

    -- Resposta automática
    was_auto_replied BOOLEAN DEFAULT FALSE,
    auto_reply_message_id TEXT, -- ID da mensagem de resposta enviada

    -- Tokens usados (para billing/logs)
    tokens_input INTEGER,
    tokens_output INTEGER,

    -- Timestamps
    received_at TIMESTAMPTZ, -- Quando o email foi recebido (header Date)
    processed_at TIMESTAMPTZ, -- Quando foi processado pela IA
    replied_at TIMESTAMPTZ, -- Quando a resposta foi enviada
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Erro (se falhou)
    error_message TEXT
);

-- Índices para messages
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_direction ON messages(direction);
CREATE INDEX idx_messages_message_id ON messages(message_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_from_email ON messages(from_email);

-- -----------------------------------------------------------------------------
-- 4. TABELA DE LOGS DE PROCESSAMENTO
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_processing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

    -- Tipo de evento
    event_type TEXT NOT NULL CHECK (event_type IN (
        'email_received',
        'email_classified',
        'shopify_lookup',
        'response_generated',
        'response_sent',
        'forwarded_to_human',
        'credits_exhausted',
        'data_requested',
        'error'
    )),

    -- Dados do evento (JSON flexível)
    event_data JSONB DEFAULT '{}',

    -- Métricas de performance
    processing_time_ms INTEGER,
    tokens_input INTEGER,
    tokens_output INTEGER,

    -- Erro (se aplicável)
    error_type TEXT,
    error_message TEXT,
    error_stack TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para logs
CREATE INDEX idx_logs_shop_id ON email_processing_logs(shop_id);
CREATE INDEX idx_logs_event_type ON email_processing_logs(event_type);
CREATE INDEX idx_logs_created_at ON email_processing_logs(created_at DESC);
CREATE INDEX idx_logs_message_id ON email_processing_logs(message_id);

-- Política de retenção: deletar logs com mais de 90 dias (rodar via cron)
-- SELECT cron.schedule('cleanup-old-logs', '0 3 * * *', $$
--   DELETE FROM email_processing_logs WHERE created_at < NOW() - INTERVAL '90 days'
-- $$);

-- -----------------------------------------------------------------------------
-- 5. ADICIONAR CAMPOS DE CRIPTOGRAFIA NA TABELA SHOPS
-- -----------------------------------------------------------------------------
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS imap_password_encrypted TEXT,
ADD COLUMN IF NOT EXISTS smtp_password_encrypted TEXT,
ADD COLUMN IF NOT EXISTS shopify_client_secret_encrypted TEXT,
ADD COLUMN IF NOT EXISTS fallback_message_template TEXT,
ADD COLUMN IF NOT EXISTS signature_html TEXT,
ADD COLUMN IF NOT EXISTS last_email_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_sync_error TEXT;

-- -----------------------------------------------------------------------------
-- 6. ADICIONAR CAMPOS NA TABELA USERS PARA NOTIFICAÇÕES
-- -----------------------------------------------------------------------------
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_credits_warning_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS credits_warning_count INTEGER DEFAULT 0;

-- -----------------------------------------------------------------------------
-- 7. TABELA DE RATE LIMITING
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    customer_email TEXT NOT NULL,

    -- Contadores
    responses_last_hour INTEGER DEFAULT 0,
    last_response_at TIMESTAMPTZ,

    -- Reset automático
    hour_window_start TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(shop_id, customer_email)
);

CREATE INDEX idx_rate_limits_shop_customer ON rate_limits(shop_id, customer_email);

-- -----------------------------------------------------------------------------
-- 8. FUNÇÕES AUXILIARES
-- -----------------------------------------------------------------------------

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rate_limits_updated_at ON rate_limits;
CREATE TRIGGER update_rate_limits_updated_at
    BEFORE UPDATE ON rate_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para incrementar emails_used do usuário
CREATE OR REPLACE FUNCTION increment_emails_used(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_new_count INTEGER;
BEGIN
    UPDATE users
    SET emails_used = emails_used + 1
    WHERE id = p_user_id
    RETURNING emails_used INTO v_new_count;

    RETURN v_new_count;
END;
$$ LANGUAGE plpgsql;

-- Função para verificar se usuário tem créditos disponíveis
CREATE OR REPLACE FUNCTION check_credits_available(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_used INTEGER;
    v_limit INTEGER;
BEGIN
    SELECT emails_used, emails_limit
    INTO v_used, v_limit
    FROM users
    WHERE id = p_user_id;

    RETURN COALESCE(v_used, 0) < COALESCE(v_limit, 0);
END;
$$ LANGUAGE plpgsql;

-- Função para buscar ou criar conversation por email thread
CREATE OR REPLACE FUNCTION get_or_create_conversation(
    p_shop_id UUID,
    p_customer_email TEXT,
    p_subject TEXT,
    p_in_reply_to TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
    v_clean_subject TEXT;
BEGIN
    -- Limpar subject (remover Re:, Fwd:, etc.)
    v_clean_subject := REGEXP_REPLACE(
        COALESCE(p_subject, ''),
        '^(Re:|Fwd:|Enc:|Fw:)\s*',
        '',
        'gi'
    );
    v_clean_subject := TRIM(v_clean_subject);

    -- Se tem in_reply_to, buscar conversation existente pela message
    IF p_in_reply_to IS NOT NULL THEN
        SELECT c.id INTO v_conversation_id
        FROM conversations c
        JOIN messages m ON m.conversation_id = c.id
        WHERE c.shop_id = p_shop_id
        AND m.message_id = p_in_reply_to
        LIMIT 1;

        IF v_conversation_id IS NOT NULL THEN
            -- Atualizar last_message_at
            UPDATE conversations
            SET last_message_at = NOW()
            WHERE id = v_conversation_id;

            RETURN v_conversation_id;
        END IF;
    END IF;

    -- Buscar conversation recente (últimas 24h) do mesmo cliente com subject similar
    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE shop_id = p_shop_id
    AND customer_email = p_customer_email
    AND created_at > NOW() - INTERVAL '24 hours'
    AND (
        TRIM(REGEXP_REPLACE(COALESCE(subject, ''), '^(Re:|Fwd:|Enc:|Fw:)\s*', '', 'gi')) = v_clean_subject
        OR v_clean_subject = ''
    )
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_conversation_id IS NOT NULL THEN
        UPDATE conversations
        SET last_message_at = NOW()
        WHERE id = v_conversation_id;

        RETURN v_conversation_id;
    END IF;

    -- Criar nova conversation
    INSERT INTO conversations (
        shop_id,
        customer_email,
        subject,
        status,
        created_at,
        last_message_at
    ) VALUES (
        p_shop_id,
        p_customer_email,
        p_subject,
        'open',
        NOW(),
        NOW()
    )
    RETURNING id INTO v_conversation_id;

    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------

-- Habilitar RLS nas novas tabelas
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_processing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Políticas para messages
CREATE POLICY "Users can view messages from their shops" ON messages
    FOR SELECT
    USING (
        conversation_id IN (
            SELECT c.id FROM conversations c
            JOIN shops s ON s.id = c.shop_id
            WHERE s.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage all messages" ON messages
    FOR ALL
    USING (auth.role() = 'service_role');

-- Políticas para email_processing_logs
CREATE POLICY "Users can view logs from their shops" ON email_processing_logs
    FOR SELECT
    USING (
        shop_id IN (
            SELECT id FROM shops WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage all logs" ON email_processing_logs
    FOR ALL
    USING (auth.role() = 'service_role');

-- Políticas para rate_limits
CREATE POLICY "Users can view rate limits from their shops" ON rate_limits
    FOR SELECT
    USING (
        shop_id IN (
            SELECT id FROM shops WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage all rate limits" ON rate_limits
    FOR ALL
    USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 10. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- -----------------------------------------------------------------------------
COMMENT ON TABLE messages IS 'Armazena todos os emails recebidos e enviados pelo sistema';
COMMENT ON TABLE email_processing_logs IS 'Log de eventos de processamento para auditoria e debug';
COMMENT ON TABLE rate_limits IS 'Controle de rate limiting por cliente/loja';

COMMENT ON COLUMN messages.status IS 'pending=aguardando, processing=em andamento, replied=respondido, pending_credits=sem créditos, pending_human=encaminhado, failed=erro';
COMMENT ON COLUMN messages.category IS 'Categoria classificada pela IA: rastreio, reembolso, produto, pagamento, entrega, suporte_humano, outros';
COMMENT ON COLUMN conversations.data_request_count IS 'Contador de vezes que pedimos dados do pedido ao cliente (máx 3)';

-- -----------------------------------------------------------------------------
-- FIM DA MIGRATION
-- -----------------------------------------------------------------------------
