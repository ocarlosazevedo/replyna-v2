-- =====================================================================
-- MIGRATION 028: Shopify Circuit Breaker - Offline Detection
-- =====================================================================
-- Adds 'pending_shopify' status for messages when Shopify is offline
-- Adds function to requeue pending_shopify messages when circuit closes
-- =====================================================================

-- =====================================================================
-- 1. Add 'pending_shopify' to allowed message statuses
-- =====================================================================
-- Note: messages.status is a TEXT column without constraints, so we just
-- document the new status here. The app will handle the logic.

COMMENT ON COLUMN messages.status IS 'Status values: pending, processing, replied, pending_credits, pending_human, pending_shopify, failed';

-- =====================================================================
-- 2. Index for pending_shopify messages (for efficient reprocessing)
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_messages_pending_shopify
ON messages(conversation_id, created_at DESC)
WHERE status = 'pending_shopify';

-- =====================================================================
-- 3. Function to requeue pending_shopify emails when circuit closes
-- =====================================================================
-- Called when Shopify comes back online to reprocess stuck emails

CREATE OR REPLACE FUNCTION requeue_pending_shopify_emails(p_shop_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_requeued_count INTEGER := 0;
    v_message RECORD;
BEGIN
    -- Find all messages with status 'pending_shopify' for this shop's conversations
    FOR v_message IN
        SELECT m.id, m.conversation_id
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.shop_id = p_shop_id
          AND m.status = 'pending_shopify'
          AND m.direction = 'inbound'
        ORDER BY m.created_at ASC
        LIMIT 100  -- Process in batches to avoid long locks
    LOOP
        -- Reset message status to pending
        UPDATE messages
        SET status = 'pending',
            error_message = NULL,
            processed_at = NULL
        WHERE id = v_message.id;

        -- Create a new job in the queue
        INSERT INTO job_queue (
            job_type,
            shop_id,
            message_id,
            payload,
            priority,
            status,
            created_at
        )
        VALUES (
            'process_email',
            p_shop_id,
            v_message.id,
            jsonb_build_object(
                'message_id', v_message.id,
                'shop_id', p_shop_id,
                'requeued_from', 'pending_shopify'
            ),
            1,  -- Higher priority for requeued emails
            'pending',
            NOW()
        )
        ON CONFLICT (job_type, message_id) DO UPDATE
            SET status = 'pending',
                priority = 1,
                next_retry_at = NULL,
                attempt_count = 0;

        v_requeued_count := v_requeued_count + 1;
    END LOOP;

    -- Log the requeue event
    INSERT INTO email_processing_logs (
        shop_id,
        event_type,
        event_data,
        created_at
    )
    VALUES (
        p_shop_id,
        'shopify_recovery',
        jsonb_build_object(
            'requeued_count', v_requeued_count,
            'action', 'requeue_pending_shopify_emails'
        ),
        NOW()
    );

    RETURN v_requeued_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION requeue_pending_shopify_emails(UUID) IS 'Requeue emails stuck in pending_shopify status when Shopify circuit closes';

-- =====================================================================
-- 4. Update circuit breaker functions for Shopify
-- =====================================================================

-- Function to check if Shopify circuit is open for a shop
CREATE OR REPLACE FUNCTION is_shopify_circuit_open(p_shop_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_circuit RECORD;
BEGIN
    SELECT * INTO v_circuit
    FROM circuit_breakers
    WHERE shop_id = p_shop_id
      AND service = 'shopify';

    IF NOT FOUND THEN
        RETURN FALSE;  -- No circuit breaker = closed (working)
    END IF;

    -- Check if circuit is open
    IF v_circuit.state = 'open' THEN
        -- Check if timeout has passed (should try half_open)
        IF v_circuit.next_attempt_at IS NOT NULL AND v_circuit.next_attempt_at <= NOW() THEN
            -- Transition to half_open
            UPDATE circuit_breakers
            SET state = 'half_open'
            WHERE id = v_circuit.id;
            RETURN FALSE;  -- Allow one attempt
        END IF;
        RETURN TRUE;  -- Circuit is open, skip
    END IF;

    -- half_open or closed = allow processing
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION is_shopify_circuit_open(UUID) IS 'Check if Shopify circuit breaker is open for a shop';

-- Function to record Shopify failure and potentially open circuit
CREATE OR REPLACE FUNCTION record_shopify_failure(
    p_shop_id UUID,
    p_error_message TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    v_circuit RECORD;
    v_new_failure_count INTEGER;
    v_new_state TEXT;
BEGIN
    -- Upsert circuit breaker record
    INSERT INTO circuit_breakers (
        shop_id,
        service,
        state,
        failure_count,
        success_count,
        last_failure_at,
        failure_threshold,
        timeout_seconds
    )
    VALUES (
        p_shop_id,
        'shopify',
        'closed',
        1,
        0,
        NOW(),
        3,      -- 3 failures to open
        300     -- 5 minutes timeout
    )
    ON CONFLICT (shop_id, service) DO UPDATE
    SET failure_count = circuit_breakers.failure_count + 1,
        success_count = 0,  -- Reset success count on failure
        last_failure_at = NOW()
    RETURNING * INTO v_circuit;

    v_new_failure_count := v_circuit.failure_count;
    v_new_state := v_circuit.state;

    -- Check if we should open the circuit
    IF v_new_failure_count >= v_circuit.failure_threshold AND v_circuit.state != 'open' THEN
        UPDATE circuit_breakers
        SET state = 'open',
            next_attempt_at = NOW() + (v_circuit.timeout_seconds || ' seconds')::INTERVAL
        WHERE id = v_circuit.id;
        v_new_state := 'open';

        -- Log circuit open event
        INSERT INTO email_processing_logs (
            shop_id,
            event_type,
            event_data,
            created_at
        )
        VALUES (
            p_shop_id,
            'shopify_circuit_open',
            jsonb_build_object(
                'failure_count', v_new_failure_count,
                'error_message', p_error_message,
                'timeout_seconds', v_circuit.timeout_seconds
            ),
            NOW()
        );
    END IF;

    RETURN v_new_state;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_shopify_failure(UUID, TEXT) IS 'Record a Shopify failure and potentially open the circuit breaker';

-- Function to record Shopify success and close circuit
CREATE OR REPLACE FUNCTION record_shopify_success(p_shop_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_circuit RECORD;
    v_new_state TEXT;
    v_requeued INTEGER;
BEGIN
    SELECT * INTO v_circuit
    FROM circuit_breakers
    WHERE shop_id = p_shop_id
      AND service = 'shopify';

    IF NOT FOUND THEN
        RETURN 'closed';  -- No circuit = everything working
    END IF;

    -- Update circuit breaker
    IF v_circuit.state = 'half_open' THEN
        -- Success in half_open = close the circuit
        UPDATE circuit_breakers
        SET state = 'closed',
            failure_count = 0,
            success_count = v_circuit.success_count + 1,
            last_success_at = NOW(),
            next_attempt_at = NULL
        WHERE id = v_circuit.id;
        v_new_state := 'closed';

        -- Requeue pending emails
        SELECT requeue_pending_shopify_emails(p_shop_id) INTO v_requeued;

        -- Log circuit close event
        INSERT INTO email_processing_logs (
            shop_id,
            event_type,
            event_data,
            created_at
        )
        VALUES (
            p_shop_id,
            'shopify_circuit_closed',
            jsonb_build_object(
                'previous_state', 'half_open',
                'requeued_emails', v_requeued
            ),
            NOW()
        );
    ELSIF v_circuit.state = 'closed' THEN
        -- Already closed, just reset failure count
        UPDATE circuit_breakers
        SET failure_count = 0,
            success_count = v_circuit.success_count + 1,
            last_success_at = NOW()
        WHERE id = v_circuit.id;
        v_new_state := 'closed';
    ELSE
        -- State is 'open' but we got a success? Shouldn't happen, but handle it
        UPDATE circuit_breakers
        SET state = 'closed',
            failure_count = 0,
            success_count = 1,
            last_success_at = NOW(),
            next_attempt_at = NULL
        WHERE id = v_circuit.id;
        v_new_state := 'closed';

        -- Requeue pending emails
        SELECT requeue_pending_shopify_emails(p_shop_id) INTO v_requeued;
    END IF;

    RETURN v_new_state;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_shopify_success(UUID) IS 'Record a Shopify success and close circuit breaker if in half_open state';

-- =====================================================================
-- 5. Index for efficient circuit breaker queries from frontend
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_circuit_breakers_shopify_open
ON circuit_breakers(shop_id)
WHERE service = 'shopify' AND state IN ('open', 'half_open');

-- =====================================================================
-- 6. RLS policy for circuit_breakers (already exists but ensure it works)
-- =====================================================================
-- Users should be able to see their shop's circuit breakers via the frontend

-- Already has: "Users can view their shop circuit breakers" policy from migration 021
