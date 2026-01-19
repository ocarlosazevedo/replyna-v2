-- Migration: Add COD and Email Start Mode fields to shops table
-- Date: 2026-01-19

-- Add is_cod column (Cash on Delivery mode)
-- Default is false since most shops operate in prepaid model
ALTER TABLE shops ADD COLUMN IF NOT EXISTS is_cod BOOLEAN DEFAULT FALSE;

-- Add email_start_mode column
-- Options: 'all_unread' (process all unread emails) or 'from_integration_date' (only emails after integration)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS email_start_mode TEXT DEFAULT 'from_integration_date';

-- Add email_start_date column
-- Stores the date from which Replyna should start processing emails
-- When email_start_mode is 'from_integration_date', this is set to the activation timestamp
ALTER TABLE shops ADD COLUMN IF NOT EXISTS email_start_date TIMESTAMPTZ;

-- Add check constraint for email_start_mode values
ALTER TABLE shops DROP CONSTRAINT IF EXISTS shops_email_start_mode_check;
ALTER TABLE shops ADD CONSTRAINT shops_email_start_mode_check
  CHECK (email_start_mode IN ('all_unread', 'from_integration_date'));

-- Set email_start_date to created_at for existing active shops that don't have it set
UPDATE shops
SET email_start_date = created_at
WHERE is_active = TRUE
  AND email_start_date IS NULL;

-- Comment on columns for documentation
COMMENT ON COLUMN shops.is_cod IS 'Whether the shop operates in Cash on Delivery mode. Affects how AI responds to customers.';
COMMENT ON COLUMN shops.email_start_mode IS 'How Replyna should handle existing emails: all_unread or from_integration_date';
COMMENT ON COLUMN shops.email_start_date IS 'The date from which Replyna should process emails (when mode is from_integration_date)';
