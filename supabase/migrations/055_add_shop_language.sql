-- Add language column to shops table
-- Populated from Shopify primary_locale during OAuth callback
ALTER TABLE shops ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
