-- Add currency field to stores table
-- Used to display the correct currency symbol when AI mentions fixed-value coupons
ALTER TABLE shops ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL';
