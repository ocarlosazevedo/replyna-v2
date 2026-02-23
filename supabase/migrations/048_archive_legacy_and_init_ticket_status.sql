-- Archive all pending_human conversations created before 2026-02-23
UPDATE conversations
SET archived = true
WHERE status = 'pending_human'
  AND created_at < '2026-02-23T00:00:00Z';

-- Initialize ticket_status = 'pending' for non-archived pending_human tickets
UPDATE conversations
SET ticket_status = 'pending'
WHERE status = 'pending_human'
  AND archived = false
  AND ticket_status IS NULL;
