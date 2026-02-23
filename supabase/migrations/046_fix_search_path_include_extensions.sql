-- ============================================================================
-- Fix: Include 'extensions' schema in search_path for all functions
--
-- Migration 044 set search_path = 'public' but functions that use pgcrypto
-- (crypt, gen_salt) need access to the 'extensions' schema where pgcrypto
-- is installed. This caused "function crypt(text, text) does not exist" errors.
--
-- Fix: Set search_path = 'public, extensions' on ALL public functions.
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
  LOOP
    BEGIN
      sql_text := format(
        'ALTER FUNCTION public.%I(%s) SET search_path = ''public'', ''extensions''',
        func_record.func_name,
        func_record.func_args
      );
      EXECUTE sql_text;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not fix %(%): %', func_record.func_name, func_record.func_args, SQLERRM;
    END;
  END LOOP;
END $$;
