-- Migration: Add retention coupon details (type and value)
-- Permite configurar se o cupom é porcentagem ou valor fixo e o valor do desconto

-- Tipo do cupom: 'percentage' ou 'fixed'
ALTER TABLE shops ADD COLUMN IF NOT EXISTS retention_coupon_type TEXT DEFAULT 'percentage';

-- Valor do desconto (ex: 10 para 10% ou 10 para R$10)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS retention_coupon_value NUMERIC(10,2);

-- Comentários explicativos
COMMENT ON COLUMN shops.retention_coupon_type IS 'Tipo do cupom de retenção: percentage (porcentagem) ou fixed (valor fixo)';
COMMENT ON COLUMN shops.retention_coupon_value IS 'Valor do desconto do cupom (ex: 10 para 10% ou 10 para R$10)';
