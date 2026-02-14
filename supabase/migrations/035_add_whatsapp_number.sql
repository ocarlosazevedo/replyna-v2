-- Adiciona campo whatsapp_number na tabela users
-- Usado pelo n8n para notificar clientes via WhatsApp sobre falhas de pagamento
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
