-- Add pending_backfill flag to shops table
-- When a user upgrades from free trial to paid plan,
-- this flag triggers the system to fetch old emails from IMAP
-- that were marked as seen during the trial period.

ALTER TABLE shops ADD COLUMN IF NOT EXISTS pending_backfill boolean DEFAULT false;
