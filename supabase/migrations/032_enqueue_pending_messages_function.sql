-- =====================================================================
-- MIGRATION 032: Function to Enqueue Pending Messages
-- =====================================================================
-- Cria função para enfileirar mensagens pendentes que foram criadas
-- pelo sistema antigo (process-emails) e não têm jobs na fila
-- =====================================================================

CREATE OR REPLACE FUNCTION enqueue_pending_messages(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  job_id UUID,
  message_id UUID,
  shop_id UUID,
  from_email TEXT,
  subject TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    enqueue_job(
      'process_email'::TEXT,
      c.shop_id,
      m.id,
      jsonb_build_object(
        'conversation_id', m.conversation_id,
        'from_email', m.from_email,
        'subject', COALESCE(m.subject, '(Sem assunto)')
      ),
      0,
      5
    ) as job_id,
    m.id as message_id,
    c.shop_id,
    m.from_email,
    m.subject
  FROM messages m
  INNER JOIN conversations c ON c.id = m.conversation_id
  WHERE m.status = 'pending'
    AND m.direction = 'inbound'
    AND m.from_email IS NOT NULL
    AND m.from_email != ''
    AND NOT EXISTS (
      SELECT 1 FROM job_queue jq
      WHERE jq.message_id = m.id
      AND jq.job_type = 'process_email'
    )
  ORDER BY m.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION enqueue_pending_messages(INTEGER) IS 'Enqueue pending messages that do not have jobs in the queue (for migration from old system)';

-- Grant execution to service_role
GRANT EXECUTE ON FUNCTION enqueue_pending_messages(INTEGER) TO service_role;
