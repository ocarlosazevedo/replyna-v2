-- Fix all RLS disabled warnings and security definer view
-- All these tables are accessed only via service_role (Edge Functions)

-- 1. notification_templates
ALTER TABLE IF EXISTS notification_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_templates' AND table_schema = 'public') THEN
    CREATE POLICY "service_role_all" ON notification_templates FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 2. notifications
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications' AND table_schema = 'public') THEN
    CREATE POLICY "service_role_all" ON notifications FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 3. notification_logs
ALTER TABLE IF EXISTS notification_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_logs' AND table_schema = 'public') THEN
    CREATE POLICY "service_role_all" ON notification_logs FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 4. notification_broadcasts
ALTER TABLE IF EXISTS notification_broadcasts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_broadcasts' AND table_schema = 'public') THEN
    CREATE POLICY "service_role_all" ON notification_broadcasts FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 5. cron_execution_log
ALTER TABLE IF EXISTS cron_execution_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cron_execution_log' AND table_schema = 'public') THEN
    CREATE POLICY "service_role_all" ON cron_execution_log FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 6. admin_login_attempts
ALTER TABLE IF EXISTS admin_login_attempts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_login_attempts' AND table_schema = 'public') THEN
    CREATE POLICY "service_role_all" ON admin_login_attempts FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 7. Fix shops_pending_encryption view (remove SECURITY DEFINER)
DROP VIEW IF EXISTS shops_pending_encryption;
CREATE VIEW shops_pending_encryption
WITH (security_invoker = true) AS
SELECT * FROM shops
WHERE imap_password_encrypted IS NULL
   OR smtp_password_encrypted IS NULL
   OR shopify_client_secret_encrypted IS NULL;
