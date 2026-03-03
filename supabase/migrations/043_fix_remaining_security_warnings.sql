-- ============================================================================
-- Fix remaining function search_path warnings (correct signatures)
-- ============================================================================

-- requeue_pending_shopify_emails(UUID)
DO $$ BEGIN
  ALTER FUNCTION public.requeue_pending_shopify_emails(UUID) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- release_credit(UUID) - was wrongly called with (UUID, UUID)
DO $$ BEGIN
  ALTER FUNCTION public.release_credit(UUID) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- try_lock_conversation(UUID) - was wrongly called with (UUID, UUID)
DO $$ BEGIN
  ALTER FUNCTION public.try_lock_conversation(UUID) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- get_or_create_conversation overloads
DO $$ BEGIN
  ALTER FUNCTION public.get_or_create_conversation(UUID, TEXT, TEXT, TEXT) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.get_or_create_conversation(UUID, TEXT, TEXT, TEXT, TEXT) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- mark_password_migrated(UUID, TEXT, TEXT, TEXT)
DO $$ BEGIN
  ALTER FUNCTION public.mark_password_migrated(UUID, TEXT, TEXT, TEXT) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- enqueue_job(TEXT, UUID, UUID, JSONB, INTEGER, INTEGER)
DO $$ BEGIN
  ALTER FUNCTION public.enqueue_job(TEXT, UUID, UUID, JSONB, INTEGER, INTEGER) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- dequeue_jobs(INTEGER, TEXT[])
DO $$ BEGIN
  ALTER FUNCTION public.dequeue_jobs(INTEGER, TEXT[]) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- complete_job(UUID, JSONB, INTEGER)
DO $$ BEGIN
  ALTER FUNCTION public.complete_job(UUID, JSONB, INTEGER) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- fail_job(UUID, TEXT, TEXT, TEXT, BOOLEAN)
DO $$ BEGIN
  ALTER FUNCTION public.fail_job(UUID, TEXT, TEXT, TEXT, BOOLEAN) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- requeue_dlq_job(UUID, BOOLEAN)
DO $$ BEGIN
  ALTER FUNCTION public.requeue_dlq_job(UUID, BOOLEAN) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- record_shopify_failure(UUID, TEXT)
DO $$ BEGIN
  ALTER FUNCTION public.record_shopify_failure(UUID, TEXT) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- record_shopify_success(UUID)
DO $$ BEGIN
  ALTER FUNCTION public.record_shopify_success(UUID) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- register_partner_referral - try various signatures
DO $$ BEGIN
  ALTER FUNCTION public.register_partner_referral(UUID, UUID) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.register_partner_referral(UUID, TEXT) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- register_extra_email_purchase(UUID, INTEGER, DECIMAL, TEXT)
DO $$ BEGIN
  ALTER FUNCTION public.register_extra_email_purchase(UUID, INTEGER, DECIMAL, TEXT) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- confirm_extra_email_purchase(UUID, TEXT, TEXT)
DO $$ BEGIN
  ALTER FUNCTION public.confirm_extra_email_purchase(UUID, TEXT, TEXT) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- cleanup_old_login_attempts(INT)
DO $$ BEGIN
  ALTER FUNCTION public.cleanup_old_login_attempts(INT) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- admin_login_with_session - try various signatures
DO $$ BEGIN
  ALTER FUNCTION public.admin_login_with_session(TEXT, TEXT) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.admin_login_with_session(TEXT, TEXT, TEXT) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- activate_referral_and_generate_commission - try various signatures
DO $$ BEGIN
  ALTER FUNCTION public.activate_referral_and_generate_commission(UUID) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.activate_referral_and_generate_commission(UUID, NUMERIC) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.activate_referral_and_generate_commission(UUID, DECIMAL) SET search_path = '';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- ============================================================================
-- Fix remaining RLS policies with USING(true)
-- ============================================================================

-- plans: UPDATE policy
DROP POLICY IF EXISTS "Permitir update de plans" ON plans;
CREATE POLICY "Permitir update de plans" ON plans FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- subscriptions: INSERT and UPDATE policies
DROP POLICY IF EXISTS "Permitir insert de subscriptions" ON subscriptions;
CREATE POLICY "Permitir insert de subscriptions" ON subscriptions FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Permitir update de subscriptions" ON subscriptions;
CREATE POLICY "Permitir update de subscriptions" ON subscriptions FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- pg_net extension: move from public to extensions schema
-- ============================================================================
DO $$ BEGIN
  ALTER EXTENSION pg_net SET SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not move pg_net extension: %', SQLERRM;
END $$;
