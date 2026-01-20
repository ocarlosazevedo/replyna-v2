-- Migration: Fix email_start_mode default for existing shops
-- Date: 2026-01-19
--
-- The previous migration (006) incorrectly set the default to 'from_integration_date'
-- which caused existing shops to ignore emails received before the migration date.
-- This migration fixes that by setting all existing shops to 'all_unread' mode.

-- Update all existing shops to use 'all_unread' mode
-- This ensures no customer emails are ignored
UPDATE shops
SET email_start_mode = 'all_unread',
    email_start_date = NULL
WHERE email_start_mode = 'from_integration_date';

-- Also update the column default (in case it wasn't applied)
ALTER TABLE shops ALTER COLUMN email_start_mode SET DEFAULT 'all_unread';
