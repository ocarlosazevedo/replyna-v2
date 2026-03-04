-- Adiciona coluna para cachear URL do logo da loja (buscado via Shopify API)
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT NULL;
