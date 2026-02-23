-- Add archived and ticket_status columns to conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ticket_status TEXT DEFAULT NULL
    CHECK (ticket_status IN ('pending', 'answered', 'closed'));

-- Index for ticket queries: pending_human + not archived
CREATE INDEX IF NOT EXISTS idx_conversations_tickets
  ON conversations(status, archived)
  WHERE status = 'pending_human' AND archived = false;
