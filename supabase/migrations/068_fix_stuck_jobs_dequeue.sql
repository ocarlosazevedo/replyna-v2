-- =====================================================
-- Migration 068: Fix stuck jobs in dequeue_jobs
-- =====================================================
-- BUG: dequeue_jobs only sets started_at when attempt_count=0.
-- After a retry (attempt_count > 0), started_at stays NULL,
-- making cleanup crons unable to detect stuck jobs
-- (NULL < timestamp = UNKNOWN in SQL).
--
-- FIX: Always set started_at = NOW() when dequeuing,
-- and update cleanup cron to also catch NULL started_at.

-- 1. Fix dequeue_jobs: always set started_at on dequeue
CREATE OR REPLACE FUNCTION dequeue_jobs(
    p_batch_size INTEGER DEFAULT 50,
    p_job_types TEXT[] DEFAULT NULL
)
RETURNS SETOF job_queue AS $$
BEGIN
    RETURN QUERY
    WITH next_jobs AS (
        SELECT id
        FROM job_queue
        WHERE status = 'pending'
          AND (next_retry_at IS NULL OR next_retry_at <= NOW())
          AND (p_job_types IS NULL OR job_type = ANY(p_job_types))
        ORDER BY priority DESC, created_at ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE job_queue
    SET
        status = 'processing',
        started_at = NOW(),
        attempt_count = attempt_count + 1
    WHERE id IN (SELECT id FROM next_jobs)
    RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- 2. Fix cleanup-stuck-jobs cron to also catch NULL started_at
SELECT cron.unschedule('cleanup-stuck-jobs-cron') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-stuck-jobs-cron'
);

SELECT cron.schedule(
    'cleanup-stuck-jobs-cron',
    '*/15 * * * *',
    $$
    -- Reset jobs stuck in 'processing' for more than 1 hour OR with NULL started_at
    UPDATE job_queue
    SET
        status = 'pending',
        next_retry_at = NOW(),
        started_at = NULL
    WHERE status = 'processing'
      AND (started_at IS NULL OR started_at < NOW() - INTERVAL '1 hour');

    -- Also reset messages stuck in 'processing' for more than 10 minutes
    UPDATE messages
    SET status = 'pending'
    WHERE status = 'processing'
      AND updated_at < NOW() - INTERVAL '10 minutes';
    $$
);

-- 3. Immediately fix currently stuck jobs (started_at IS NULL)
UPDATE job_queue
SET
    status = 'pending',
    next_retry_at = NOW(),
    started_at = NULL
WHERE status = 'processing'
  AND started_at IS NULL;
