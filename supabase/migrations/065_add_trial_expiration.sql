-- =====================================================================
-- MIGRATION 065: Trial expiration fields + status update
-- =====================================================================

-- 1. Add trial_ends_at to users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- 2. Backfill trial_ends_at for existing trial users
UPDATE users
SET trial_ends_at = trial_started_at + INTERVAL '7 days'
WHERE is_trial = TRUE
  AND trial_started_at IS NOT NULL
  AND trial_ends_at IS NULL;

-- 3. Update status constraint to include 'expired'
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'users'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%status%'
    AND pg_get_constraintdef(c.oid) ILIKE '%active%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE users
ADD CONSTRAINT users_status_check
CHECK (status IN ('active', 'inactive', 'suspended', 'expired'));
