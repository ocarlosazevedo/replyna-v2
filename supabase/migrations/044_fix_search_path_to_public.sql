-- ============================================================================
-- HOTFIX: Change search_path from '' to 'public' on all functions
--
-- Migration 042 set search_path = '' on all functions, but the function bodies
-- reference tables without schema qualification (e.g. 'users' instead of
-- 'public.users'). This broke ALL SQL functions causing:
--   "relation 'users' does not exist"
--   "relation 'job_queue' does not exist"
--   etc.
--
-- Fix: Set search_path = 'public' which is still secure (explicit path,
-- not vulnerable to search_path attacks) but allows unqualified table names.
-- ============================================================================

DO $$ BEGIN
  ALTER FUNCTION public.update_updated_at_column() SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.increment_emails_used(UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.requeue_pending_shopify_emails() SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.requeue_pending_shopify_emails(UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.get_pending_message_counts_by_shop() SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.release_credit(UUID, UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.release_credit(UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.check_credits_available(UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.try_lock_conversation(UUID, UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.try_lock_conversation(UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.aggregate_queue_metrics() SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.get_user_credits_status(UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.mark_password_migrated(UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.mark_password_migrated(UUID, TEXT, TEXT, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.get_encryption_migration_stats() SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.is_partner_active(UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.hash_admin_password(TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.admin_login(TEXT, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.get_partner_by_coupon(TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.enqueue_job(TEXT, JSONB, INTEGER) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.enqueue_job(TEXT, UUID, UUID, JSONB, INTEGER, INTEGER) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.change_admin_password(UUID, TEXT, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.dequeue_jobs(INTEGER, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.dequeue_jobs(INTEGER, TEXT[]) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.complete_job(UUID, JSONB) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.complete_job(UUID, JSONB, INTEGER) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.cleanup_old_logs() SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.reset_expired_rate_limits() SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.get_system_health() SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.dequeue_notifications(INTEGER) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.register_partner_referral(UUID, UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.register_partner_referral(UUID, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.fail_job(UUID, TEXT, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.fail_job(UUID, TEXT, TEXT, TEXT, BOOLEAN) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.requeue_dlq_job(UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.requeue_dlq_job(UUID, BOOLEAN) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.record_shopify_failure(UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.record_shopify_failure(UUID, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.record_shopify_success(UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.create_admin(TEXT, TEXT, TEXT, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.validate_coupon(TEXT, UUID, UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.release_pending_commissions() SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.use_coupon(UUID, UUID, NUMERIC, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.complete_notification(UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.check_extra_email_billing(UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.increment_pending_extra_email(UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.register_extra_email_purchase(UUID, UUID, INTEGER, NUMERIC, NUMERIC) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.register_extra_email_purchase(UUID, INTEGER, DECIMAL, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.confirm_extra_email_purchase(UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.confirm_extra_email_purchase(UUID, TEXT, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.reset_email_counters(UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.request_partner_withdrawal(UUID, NUMERIC) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.fail_notification(UUID, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.get_partner_stats(UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.try_reserve_credit(UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.cleanup_old_login_attempts() SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.cleanup_old_login_attempts(INT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.admin_login_with_session(TEXT, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.admin_login_with_session(TEXT, TEXT, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.generate_recurring_commission(UUID, NUMERIC) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.check_admin_rate_limit(TEXT, INTEGER, INTEGER) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.record_admin_login_attempt(TEXT, TEXT, BOOLEAN) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.is_shopify_circuit_open(UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.get_or_create_conversation(UUID, TEXT, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.get_or_create_conversation(UUID, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.get_or_create_conversation(UUID, TEXT, TEXT, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.get_or_create_conversation(UUID, TEXT, TEXT, TEXT, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.activate_referral_and_generate_commission(UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.activate_referral_and_generate_commission(UUID, NUMERIC) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.activate_referral_and_generate_commission(UUID, DECIMAL) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
