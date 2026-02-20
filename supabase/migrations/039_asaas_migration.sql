-- ============================================
-- Migracao Stripe -> Asaas
-- Adiciona campos Asaas mantendo Stripe durante transicao
-- ============================================

-- 1. Tabela plans: ID do plano no Asaas
ALTER TABLE plans ADD COLUMN IF NOT EXISTS asaas_plan_id TEXT;

-- 2. Tabela subscriptions: IDs do Asaas
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT;

-- 3. Tabela users: customer ID do Asaas
ALTER TABLE users ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

-- 4. Tabela email_extra_purchases: payment ID e URL do Asaas
ALTER TABLE email_extra_purchases ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT;
ALTER TABLE email_extra_purchases ADD COLUMN IF NOT EXISTS asaas_invoice_url TEXT;

-- 5. Tabela coupons: discount ID do Asaas
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS asaas_discount_id TEXT;

-- 6. Indices para performance
CREATE INDEX IF NOT EXISTS idx_users_asaas_customer_id ON users(asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_subscription_id ON subscriptions(asaas_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_customer_id ON subscriptions(asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_email_extra_purchases_asaas_payment_id ON email_extra_purchases(asaas_payment_id);
