-- Add currency column to shops table
-- Nullable with no default - currency comes from Shopify orders, not stored here
-- This column exists only to prevent errors from cached frontend versions
ALTER TABLE shops ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT NULL;
