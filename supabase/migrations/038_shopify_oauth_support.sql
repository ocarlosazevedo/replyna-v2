-- Migration: Add OAuth support for Shopify distribution apps
-- Adds columns to store OAuth access tokens and distinguish auth type

ALTER TABLE shops ADD COLUMN IF NOT EXISTS shopify_access_token_encrypted TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS shopify_auth_type TEXT DEFAULT 'custom_app';
