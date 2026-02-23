-- ============================================================================
-- Fix remaining functions with mutable search_path warnings
-- These overloads were missed by migration 044
-- ============================================================================

-- mark_password_migrated - try all possible signatures
DO $$ BEGIN
  ALTER FUNCTION public.mark_password_migrated(UUID, TEXT, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.mark_password_migrated(UUID, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.mark_password_migrated(UUID, TEXT, TEXT, TEXT, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- register_partner_referral - try additional signatures
DO $$ BEGIN
  ALTER FUNCTION public.register_partner_referral(UUID) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.register_partner_referral(UUID, UUID, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.register_partner_referral(UUID, TEXT, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- admin_login_with_session - the actual call uses 4 params (TEXT, TEXT, TEXT, TEXT)
DO $$ BEGIN
  ALTER FUNCTION public.admin_login_with_session(TEXT, TEXT, TEXT, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- activate_referral_and_generate_commission - try additional signatures
DO $$ BEGIN
  ALTER FUNCTION public.activate_referral_and_generate_commission(UUID, NUMERIC, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.activate_referral_and_generate_commission(UUID, DECIMAL, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  ALTER FUNCTION public.activate_referral_and_generate_commission(UUID, TEXT) SET search_path = 'public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- ============================================================================
-- Brute-force: set search_path on ALL public functions that still don't have it
-- This catches any overloads we may have missed
-- ============================================================================
DO $$
DECLARE
  func_record RECORD;
  sql_text TEXT;
BEGIN
  FOR func_record IN
    SELECT
      p.proname AS func_name,
      pg_get_function_identity_arguments(p.oid) AS func_args,
      p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND (
        p.proconfig IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM unnest(p.proconfig) AS c WHERE c LIKE 'search_path=%'
        )
      )
  LOOP
    BEGIN
      sql_text := format(
        'ALTER FUNCTION public.%I(%s) SET search_path = ''public''',
        func_record.func_name,
        func_record.func_args
      );
      EXECUTE sql_text;
      RAISE NOTICE 'Fixed search_path for: %(%)', func_record.func_name, func_record.func_args;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not fix %(%): %', func_record.func_name, func_record.func_args, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- Move pg_net extension from public to extensions schema (if not already done)
-- ============================================================================
DO $$ BEGIN
  ALTER EXTENSION pg_net SET SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not move pg_net extension: %', SQLERRM;
END $$;
