-- Migration: Adiciona categoria 'spam' ao constraint messages_category_check
-- Esta categoria é usada pela IA para classificar emails de spam/marketing

-- Remove o constraint antigo
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_category_check;

-- Adiciona o novo constraint com a categoria 'spam'
ALTER TABLE messages ADD CONSTRAINT messages_category_check CHECK (category IN (
    'rastreio',
    'reembolso',
    'produto',
    'pagamento',
    'entrega',
    'suporte_humano',
    'spam',
    'outros'
));
