-- Enable RLS on migration_invites table (was exposed without protection)
ALTER TABLE migration_invites ENABLE ROW LEVEL SECURITY;

-- Only service_role can access this table (used exclusively by Edge Functions)
CREATE POLICY "service_role_all" ON migration_invites
  FOR ALL
  USING (auth.role() = 'service_role');
