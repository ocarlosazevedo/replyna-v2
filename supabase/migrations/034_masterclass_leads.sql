-- Tabela para leads capturadas na Masterclass
CREATE TABLE IF NOT EXISTS masterclass_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  whatsapp text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index no email para buscas e deduplicação
CREATE INDEX IF NOT EXISTS idx_masterclass_leads_email ON masterclass_leads (email);

-- RLS: permitir inserts anônimos (landing page usa anon key)
ALTER TABLE masterclass_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts on masterclass_leads"
  ON masterclass_leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Bloquear leitura/update/delete via anon (apenas service_role pode ler)
CREATE POLICY "Only service_role can read masterclass_leads"
  ON masterclass_leads
  FOR SELECT
  TO service_role
  USING (true);
