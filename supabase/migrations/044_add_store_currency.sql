-- Add currency field to stores table
-- Used to display the correct currency symbol when AI mentions fixed-value coupons
ALTER TABLE stores ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL';
