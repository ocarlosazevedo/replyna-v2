-- =============================================================================
-- MIGRATION 056: Ticket reopened status + frozen_until mechanism
-- =============================================================================
-- 1. Adds 'reopened' to ticket_status constraint
-- 2. Adds frozen_until column for ignoring emails from closed-ticket customers
-- 3. Creates trigger to auto-reopen tickets when customer replies to answered ticket
-- =============================================================================

-- 1. Extend ticket_status CHECK constraint to include 'reopened'
ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_ticket_status_check;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_ticket_status_check
  CHECK (ticket_status IN ('pending', 'answered', 'closed', 'approved', 'rejected', 'reopened'));

-- 2. Add frozen_until column
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS frozen_until TIMESTAMPTZ DEFAULT NULL;

-- 3. Partial index for efficient frozen checks
CREATE INDEX IF NOT EXISTS idx_conversations_frozen_until
  ON conversations(frozen_until)
  WHERE frozen_until IS NOT NULL;

-- 4. Trigger function: auto-reopen ticket when customer sends inbound message
CREATE OR REPLACE FUNCTION public.fn_ticket_reopen_on_inbound()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.direction = 'inbound' THEN
    UPDATE conversations
    SET ticket_status = 'reopened'
    WHERE id = NEW.conversation_id
      AND status = 'pending_human'
      AND ticket_status = 'answered';
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Create the trigger on messages table
DROP TRIGGER IF EXISTS trg_ticket_reopen_on_inbound ON messages;
CREATE TRIGGER trg_ticket_reopen_on_inbound
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_ticket_reopen_on_inbound();
