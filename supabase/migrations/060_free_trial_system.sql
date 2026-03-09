-- =============================================
-- Migration 060: Free Trial System
-- =============================================
-- Adds free trial support with 30 email limit
-- and anti-abuse via Shopify domain tracking

-- 1. New table to track which Shopify domains have been used for free trials
CREATE TABLE IF NOT EXISTS trial_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopify_domain TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT trial_domains_shopify_domain_unique UNIQUE(shopify_domain)
);

CREATE INDEX IF NOT EXISTS idx_trial_domains_shopify_domain ON trial_domains(shopify_domain);
CREATE INDEX IF NOT EXISTS idx_trial_domains_user_id ON trial_domains(user_id);

-- 2. Add trial columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;

-- 3. RLS for trial_domains
ALTER TABLE trial_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trial domains"
    ON trial_domains FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own trial domains"
    ON trial_domains FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access to trial_domains"
    ON trial_domains FOR ALL
    USING (auth.role() = 'service_role');

-- 4. Function to check if a domain is available for trial
CREATE OR REPLACE FUNCTION check_domain_trial_available(p_shopify_domain TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM trial_domains WHERE shopify_domain = p_shopify_domain
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
