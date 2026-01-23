-- =====================================================================
-- MIGRATION 021: Job Queue System for Ultra-Scale Architecture
-- =====================================================================
-- Implements reliable job queue with retry logic, DLQ, and monitoring
-- Supports 500-5,000 emails/hour with zero message loss
-- =====================================================================

-- =====================================================================
-- TABLE 1: job_queue
-- =====================================================================
-- Main job queue table with retry logic and exponential backoff

CREATE TABLE job_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Job metadata
    job_type TEXT NOT NULL,  -- 'process_email' | 'send_email' | 'fetch_shopify'
    priority INTEGER DEFAULT 0,  -- Higher = more urgent (-1=low, 0=normal, 1=high)

    -- Status tracking (follows existing pattern from messages/email_extra_purchases)
    status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter'

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,  -- NULL = process immediately, future timestamp = retry later

    -- Retry logic
    attempt_count INTEGER DEFAULT 0 NOT NULL,
    max_attempts INTEGER DEFAULT 5 NOT NULL,

    -- Payload & results (JSONB for flexibility, follows existing pattern)
    payload JSONB NOT NULL DEFAULT '{}',
    result JSONB,

    -- Error tracking (follows existing pattern from email_processing_logs)
    error_message TEXT,
    error_type TEXT,  -- 'rate_limit' | 'api_timeout' | 'invalid_data' | 'network_error' | etc
    error_stack TEXT,
    last_error_at TIMESTAMPTZ,

    -- Performance tracking
    processing_time_ms INTEGER,

    -- Relationships
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,

    -- Prevent duplicate jobs for same message
    CONSTRAINT unique_job_per_message UNIQUE(job_type, message_id)
);

-- Performance indexes for queue queries
-- Note: Cannot use NOW() in index predicate (must be IMMUTABLE)
-- Query will filter by next_retry_at at runtime
CREATE INDEX idx_job_queue_pending_priority ON job_queue(priority DESC, created_at ASC)
    WHERE status = 'pending';

-- Index for retry scheduling (includes next_retry_at for efficient retry queries)
CREATE INDEX idx_job_queue_pending_retry ON job_queue(next_retry_at ASC)
    WHERE status = 'pending' AND next_retry_at IS NOT NULL;

-- Composite index for dequeue optimization
CREATE INDEX idx_job_queue_dequeue ON job_queue(status, priority DESC, created_at ASC, next_retry_at);

CREATE INDEX idx_job_queue_processing ON job_queue(started_at DESC)
    WHERE status = 'processing';

CREATE INDEX idx_job_queue_shop_status ON job_queue(shop_id, status, created_at DESC);

CREATE INDEX idx_job_queue_dlq ON job_queue(last_error_at DESC, error_type)
    WHERE status = 'dead_letter';

CREATE INDEX idx_job_queue_completed ON job_queue(completed_at DESC)
    WHERE status = 'completed';

-- Enable Row Level Security (follows existing pattern)
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;

-- Service role bypass (Edge Functions use service_role key)
CREATE POLICY "Service role can manage all jobs"
    ON job_queue
    FOR ALL
    TO service_role
    USING (true);

-- Users can only see jobs from their shops
CREATE POLICY "Users can view their shop jobs"
    ON job_queue
    FOR SELECT
    TO authenticated
    USING (shop_id IN (
        SELECT id FROM shops WHERE user_id = auth.uid()
    ));

-- =====================================================================
-- TABLE 2: circuit_breakers
-- =====================================================================
-- Circuit breaker state for external service failures

CREATE TABLE circuit_breakers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Which shop/service combo
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    service TEXT NOT NULL,  -- 'imap' | 'smtp' | 'shopify' | 'claude'

    -- Circuit state
    state TEXT DEFAULT 'closed' NOT NULL,  -- 'closed' | 'open' | 'half_open'
    failure_count INTEGER DEFAULT 0 NOT NULL,
    success_count INTEGER DEFAULT 0 NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_failure_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ,  -- When to try again if open

    -- Configuration
    failure_threshold INTEGER DEFAULT 3 NOT NULL,  -- Failures before opening
    success_threshold INTEGER DEFAULT 2 NOT NULL,  -- Successes to close from half_open
    timeout_seconds INTEGER DEFAULT 300 NOT NULL,  -- 5 min before trying again

    -- One circuit breaker per shop+service
    CONSTRAINT unique_circuit_breaker UNIQUE(shop_id, service)
);

-- Indexes
CREATE INDEX idx_circuit_breakers_shop ON circuit_breakers(shop_id);
CREATE INDEX idx_circuit_breakers_state ON circuit_breakers(state, next_attempt_at)
    WHERE state = 'open';

-- RLS
ALTER TABLE circuit_breakers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage circuit breakers"
    ON circuit_breakers
    FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Users can view their shop circuit breakers"
    ON circuit_breakers
    FOR SELECT
    TO authenticated
    USING (shop_id IN (
        SELECT id FROM shops WHERE user_id = auth.uid()
    ));

-- =====================================================================
-- TABLE 3: queue_metrics
-- =====================================================================
-- Aggregated metrics for monitoring and alerting

CREATE TABLE queue_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recorded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Queue health metrics
    jobs_pending INTEGER,
    jobs_processing INTEGER,
    jobs_completed_last_hour INTEGER,
    jobs_failed_last_hour INTEGER,
    jobs_in_dlq INTEGER,

    -- Performance metrics
    avg_processing_time_ms INTEGER,
    p95_processing_time_ms INTEGER,
    p99_processing_time_ms INTEGER,

    -- Per-shop metrics (NULL = global)
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,

    -- Per-error-type metrics (NULL = all)
    error_type TEXT,
    error_count INTEGER
);

-- Indexes
CREATE INDEX idx_queue_metrics_recorded_at ON queue_metrics(recorded_at DESC);
CREATE INDEX idx_queue_metrics_shop ON queue_metrics(shop_id, recorded_at DESC);
CREATE INDEX idx_queue_metrics_error_type ON queue_metrics(error_type, recorded_at DESC)
    WHERE error_type IS NOT NULL;

-- RLS
ALTER TABLE queue_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage metrics"
    ON queue_metrics
    FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Users can view their shop metrics"
    ON queue_metrics
    FOR SELECT
    TO authenticated
    USING (
        shop_id IS NULL  -- Global metrics visible to all
        OR shop_id IN (SELECT id FROM shops WHERE user_id = auth.uid())
    );

-- =====================================================================
-- FUNCTION 1: try_lock_conversation
-- =====================================================================
-- Advisory lock for preventing duplicate processing of same conversation
-- Lock is automatically released at transaction end

CREATE OR REPLACE FUNCTION try_lock_conversation(p_conversation_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Use advisory lock with conversation UUID hash
    -- Transaction-level lock (released automatically at COMMIT/ROLLBACK)
    -- Returns TRUE if lock acquired, FALSE if already locked
    RETURN pg_try_advisory_xact_lock(
        -- Convert UUID to bigint by hashing and taking first 16 hex chars
        ('x' || substring(md5(p_conversation_id::text) from 1 for 16))::bit(64)::bigint
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- FUNCTION 2: aggregate_queue_metrics
-- =====================================================================
-- Aggregate queue metrics for monitoring dashboard
-- Called by pg_cron every 5 minutes

CREATE OR REPLACE FUNCTION aggregate_queue_metrics()
RETURNS VOID AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_one_hour_ago TIMESTAMPTZ := NOW() - INTERVAL '1 hour';
BEGIN
    -- Global metrics
    INSERT INTO queue_metrics (
        recorded_at,
        jobs_pending,
        jobs_processing,
        jobs_completed_last_hour,
        jobs_failed_last_hour,
        jobs_in_dlq,
        avg_processing_time_ms,
        p95_processing_time_ms,
        p99_processing_time_ms,
        shop_id,
        error_type,
        error_count
    )
    SELECT
        v_now,
        COUNT(*) FILTER (WHERE status = 'pending') AS jobs_pending,
        COUNT(*) FILTER (WHERE status = 'processing') AS jobs_processing,
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > v_one_hour_ago) AS jobs_completed_last_hour,
        COUNT(*) FILTER (WHERE status = 'failed' AND completed_at > v_one_hour_ago) AS jobs_failed_last_hour,
        COUNT(*) FILTER (WHERE status = 'dead_letter') AS jobs_in_dlq,
        COALESCE(AVG(processing_time_ms) FILTER (WHERE processing_time_ms IS NOT NULL), 0)::INTEGER AS avg_processing_time_ms,
        COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_ms) FILTER (WHERE processing_time_ms IS NOT NULL), 0)::INTEGER AS p95_processing_time_ms,
        COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY processing_time_ms) FILTER (WHERE processing_time_ms IS NOT NULL), 0)::INTEGER AS p99_processing_time_ms,
        NULL AS shop_id,  -- Global
        NULL AS error_type,
        NULL AS error_count
    FROM job_queue;

    -- Per-shop metrics
    INSERT INTO queue_metrics (
        recorded_at,
        jobs_pending,
        jobs_processing,
        jobs_completed_last_hour,
        jobs_failed_last_hour,
        jobs_in_dlq,
        avg_processing_time_ms,
        p95_processing_time_ms,
        p99_processing_time_ms,
        shop_id,
        error_type,
        error_count
    )
    SELECT
        v_now,
        COUNT(*) FILTER (WHERE status = 'pending'),
        COUNT(*) FILTER (WHERE status = 'processing'),
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > v_one_hour_ago),
        COUNT(*) FILTER (WHERE status = 'failed' AND completed_at > v_one_hour_ago),
        COUNT(*) FILTER (WHERE status = 'dead_letter'),
        COALESCE(AVG(processing_time_ms) FILTER (WHERE processing_time_ms IS NOT NULL), 0)::INTEGER,
        COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_ms) FILTER (WHERE processing_time_ms IS NOT NULL), 0)::INTEGER,
        COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY processing_time_ms) FILTER (WHERE processing_time_ms IS NOT NULL), 0)::INTEGER,
        shop_id,
        NULL AS error_type,
        NULL AS error_count
    FROM job_queue
    WHERE shop_id IS NOT NULL
    GROUP BY shop_id;

    -- Per-error-type metrics (last 24 hours)
    INSERT INTO queue_metrics (
        recorded_at,
        jobs_pending,
        jobs_processing,
        jobs_completed_last_hour,
        jobs_failed_last_hour,
        jobs_in_dlq,
        avg_processing_time_ms,
        p95_processing_time_ms,
        p99_processing_time_ms,
        shop_id,
        error_type,
        error_count
    )
    SELECT
        v_now,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL AS shop_id,
        error_type,
        COUNT(*) AS error_count
    FROM job_queue
    WHERE error_type IS NOT NULL
      AND last_error_at > NOW() - INTERVAL '24 hours'
    GROUP BY error_type;

    -- Cleanup old metrics (keep last 7 days)
    DELETE FROM queue_metrics
    WHERE recorded_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- FUNCTION 3: enqueue_job
-- =====================================================================
-- Utility function to enqueue a job with idempotency check

CREATE OR REPLACE FUNCTION enqueue_job(
    p_job_type TEXT,
    p_shop_id UUID,
    p_message_id UUID DEFAULT NULL,
    p_payload JSONB DEFAULT '{}',
    p_priority INTEGER DEFAULT 0,
    p_max_attempts INTEGER DEFAULT 5
)
RETURNS UUID AS $$
DECLARE
    v_job_id UUID;
BEGIN
    -- Insert job (unique constraint prevents duplicates)
    INSERT INTO job_queue (
        job_type,
        shop_id,
        message_id,
        payload,
        priority,
        max_attempts,
        status,
        created_at
    )
    VALUES (
        p_job_type,
        p_shop_id,
        p_message_id,
        p_payload,
        p_priority,
        p_max_attempts,
        'pending',
        NOW()
    )
    ON CONFLICT (job_type, message_id) DO UPDATE
        SET priority = GREATEST(job_queue.priority, p_priority),  -- Upgrade priority if higher
            payload = p_payload  -- Update payload
    RETURNING id INTO v_job_id;

    RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- FUNCTION 4: dequeue_jobs
-- =====================================================================
-- Atomically dequeue a batch of jobs for processing
-- Uses FOR UPDATE SKIP LOCKED to prevent race conditions

CREATE OR REPLACE FUNCTION dequeue_jobs(
    p_batch_size INTEGER DEFAULT 50,
    p_job_types TEXT[] DEFAULT NULL  -- Filter by job types (NULL = all)
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
        FOR UPDATE SKIP LOCKED  -- Critical: prevents duplicate processing
    )
    UPDATE job_queue
    SET
        status = 'processing',
        started_at = CASE WHEN attempt_count = 0 THEN NOW() ELSE started_at END,
        attempt_count = attempt_count + 1
    WHERE id IN (SELECT id FROM next_jobs)
    RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- FUNCTION 5: complete_job
-- =====================================================================
-- Mark job as completed with result

CREATE OR REPLACE FUNCTION complete_job(
    p_job_id UUID,
    p_result JSONB DEFAULT NULL,
    p_processing_time_ms INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE job_queue
    SET
        status = 'completed',
        completed_at = NOW(),
        result = p_result,
        processing_time_ms = p_processing_time_ms,
        error_message = NULL,
        error_type = NULL,
        error_stack = NULL
    WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- FUNCTION 6: fail_job
-- =====================================================================
-- Mark job as failed with retry logic or move to DLQ

CREATE OR REPLACE FUNCTION fail_job(
    p_job_id UUID,
    p_error_message TEXT,
    p_error_type TEXT DEFAULT 'unknown',
    p_error_stack TEXT DEFAULT NULL,
    p_is_retryable BOOLEAN DEFAULT TRUE
)
RETURNS TEXT AS $$  -- Returns new status: 'pending' (retry), 'failed', or 'dead_letter'
DECLARE
    v_job RECORD;
    v_backoff_minutes INTEGER;
    v_jitter_seconds INTEGER;
    v_new_status TEXT;
BEGIN
    -- Get current job state
    SELECT * INTO v_job
    FROM job_queue
    WHERE id = p_job_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Job not found: %', p_job_id;
    END IF;

    -- Determine if we should retry or move to DLQ
    IF p_is_retryable AND v_job.attempt_count < v_job.max_attempts THEN
        -- Calculate exponential backoff: 2^attempt_count minutes
        v_backoff_minutes := POWER(2, v_job.attempt_count);
        -- Add jitter (0-60 seconds) to prevent thundering herd
        v_jitter_seconds := FLOOR(RANDOM() * 60);

        -- Retry
        UPDATE job_queue
        SET
            status = 'pending',
            next_retry_at = NOW() + (v_backoff_minutes || ' minutes')::INTERVAL + (v_jitter_seconds || ' seconds')::INTERVAL,
            error_message = p_error_message,
            error_type = p_error_type,
            error_stack = p_error_stack,
            last_error_at = NOW()
        WHERE id = p_job_id;

        v_new_status := 'pending';
    ELSIF v_job.attempt_count >= v_job.max_attempts THEN
        -- Max retries exceeded → Dead Letter Queue
        UPDATE job_queue
        SET
            status = 'dead_letter',
            completed_at = NOW(),
            error_message = p_error_message,
            error_type = p_error_type,
            error_stack = p_error_stack,
            last_error_at = NOW()
        WHERE id = p_job_id;

        v_new_status := 'dead_letter';
    ELSE
        -- Non-retryable error → Failed
        UPDATE job_queue
        SET
            status = 'failed',
            completed_at = NOW(),
            error_message = p_error_message,
            error_type = p_error_type,
            error_stack = p_error_stack,
            last_error_at = NOW()
        WHERE id = p_job_id;

        v_new_status := 'failed';
    END IF;

    RETURN v_new_status;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- FUNCTION 7: requeue_dlq_job
-- =====================================================================
-- Manually requeue a job from dead letter queue

CREATE OR REPLACE FUNCTION requeue_dlq_job(
    p_job_id UUID,
    p_reset_attempts BOOLEAN DEFAULT TRUE
)
RETURNS VOID AS $$
BEGIN
    UPDATE job_queue
    SET
        status = 'pending',
        next_retry_at = NULL,
        attempt_count = CASE WHEN p_reset_attempts THEN 0 ELSE attempt_count END,
        error_message = NULL,
        error_type = NULL,
        error_stack = NULL,
        last_error_at = NULL
    WHERE id = p_job_id
      AND status = 'dead_letter';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Job not found in DLQ: %', p_job_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- COMMENTS
-- =====================================================================

COMMENT ON TABLE job_queue IS 'Reliable job queue with retry logic and dead-letter queue for email processing at scale';
COMMENT ON TABLE circuit_breakers IS 'Circuit breaker state for external service failures (IMAP, SMTP, Shopify, Claude)';
COMMENT ON TABLE queue_metrics IS 'Aggregated metrics for queue monitoring and SLA tracking';

COMMENT ON FUNCTION try_lock_conversation(UUID) IS 'Acquire advisory lock for conversation to prevent duplicate processing';
COMMENT ON FUNCTION aggregate_queue_metrics() IS 'Aggregate queue metrics for dashboard (called by pg_cron every 5 min)';
COMMENT ON FUNCTION enqueue_job(TEXT, UUID, UUID, JSONB, INTEGER, INTEGER) IS 'Enqueue a new job with idempotency check';
COMMENT ON FUNCTION dequeue_jobs(INTEGER, TEXT[]) IS 'Atomically dequeue jobs for processing using row-level locking';
COMMENT ON FUNCTION complete_job(UUID, JSONB, INTEGER) IS 'Mark job as successfully completed';
COMMENT ON FUNCTION fail_job(UUID, TEXT, TEXT, TEXT, BOOLEAN) IS 'Fail job with retry logic or move to DLQ';
COMMENT ON FUNCTION requeue_dlq_job(UUID, BOOLEAN) IS 'Manually requeue a job from dead-letter queue';
