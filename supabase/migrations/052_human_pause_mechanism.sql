-- =============================================================================
-- 052: Human Pause Mechanism
-- Pauses AI auto-responses for 7 days after a human manually replies.
-- =============================================================================

-- 1. Add column to conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS human_paused_until TIMESTAMPTZ DEFAULT NULL;

-- 2. Partial index for efficient filtering in the processor
CREATE INDEX IF NOT EXISTS idx_conversations_human_paused
  ON conversations(human_paused_until)
  WHERE human_paused_until IS NOT NULL;

-- 3. Backfill: Set human_paused_until for conversations that were recently
--    answered by a human (last 7 days) to prevent AI from responding immediately
--    after deployment.
UPDATE conversations c
SET human_paused_until = m.replied_at + INTERVAL '7 days'
FROM (
  SELECT DISTINCT ON (conversation_id)
    conversation_id,
    replied_at
  FROM messages
  WHERE direction = 'outbound'
    AND was_auto_replied = false
    AND replied_at > NOW() - INTERVAL '7 days'
  ORDER BY conversation_id, replied_at DESC
) m
WHERE c.id = m.conversation_id
  AND c.human_paused_until IS NULL;
