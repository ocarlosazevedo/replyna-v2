-- -----------------------------------------------------------------------------
-- Migration 030: Adiciona cupom de retenção para lojas
-- -----------------------------------------------------------------------------
-- Este campo permite que cada loja configure um código de cupom que a IA
-- pode oferecer aos clientes que querem cancelar/devolver (fluxo de retenção).
-- O cupom é oferecido no segundo contato de retenção.
-- -----------------------------------------------------------------------------

-- Adicionar campo retention_coupon_code na tabela shops
-- É um campo de texto simples com o código do cupom (ex: "FICA10", "DESC20")
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS retention_coupon_code TEXT;

-- Comentário explicativo
COMMENT ON COLUMN shops.retention_coupon_code IS 'Código do cupom de desconto para oferecer no fluxo de retenção (cancelamento/devolução)';

-- -----------------------------------------------------------------------------
-- FIM DA MIGRATION
-- -----------------------------------------------------------------------------
