-- =============================================================================
-- 051: Cache de Produtos Shopify
-- Tabela para armazenar catálogo de produtos sincronizados do Shopify
-- Permite que a IA responda perguntas sobre disponibilidade, variantes, preços
-- =============================================================================

-- 1. Tabela de cache de produtos
CREATE TABLE IF NOT EXISTS shop_products_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    shopify_product_id BIGINT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    vendor TEXT,
    product_type TEXT,
    tags TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active',
    variants JSONB DEFAULT '[]'::jsonb,
    options JSONB DEFAULT '[]'::jsonb,
    image_url TEXT,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_shop_product UNIQUE (shop_id, shopify_product_id)
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_shop_products_cache_shop_id
    ON shop_products_cache(shop_id);

CREATE INDEX IF NOT EXISTS idx_shop_products_cache_shop_status
    ON shop_products_cache(shop_id, status);

CREATE INDEX IF NOT EXISTS idx_shop_products_cache_title_search
    ON shop_products_cache USING gin(to_tsvector('simple', title));

-- 3. Coluna na shops para controlar última sincronização
ALTER TABLE shops ADD COLUMN IF NOT EXISTS products_synced_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS products_count INTEGER DEFAULT 0;

-- 4. RLS
ALTER TABLE shop_products_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view products from their shops" ON shop_products_cache
    FOR SELECT
    USING (
        shop_id IN (
            SELECT id FROM shops WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage all products cache" ON shop_products_cache
    FOR ALL
    USING (auth.role() = 'service_role');

-- 5. Trigger para updated_at
CREATE OR REPLACE FUNCTION update_shop_products_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_shop_products_cache_updated_at
    BEFORE UPDATE ON shop_products_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_shop_products_cache_updated_at();
