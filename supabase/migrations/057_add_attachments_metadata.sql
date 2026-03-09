-- Adiciona coluna para armazenar metadados de anexos (filename, content_type, url)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachments_metadata JSONB DEFAULT NULL;

-- Comentário descritivo
COMMENT ON COLUMN public.messages.attachments_metadata IS 'Array JSON com metadados dos anexos: [{filename, content_type, url}]';
