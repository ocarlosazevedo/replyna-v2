-- Migration: Simplifica categorias para apenas 5 opções
-- Categorias antigas: rastreio, reembolso, produto, pagamento, entrega, suporte_humano, spam, outros
-- Novas categorias: spam, duvidas_gerais, rastreio, troca_devolucao_reembolso, suporte_humano

-- 1. PRIMEIRO remove o constraint antigo (para permitir os novos valores)
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_category_check;

-- 2. Migrar dados das categorias antigas para as novas
UPDATE messages SET category = 'duvidas_gerais' WHERE category IN ('produto', 'pagamento', 'outros');
UPDATE messages SET category = 'troca_devolucao_reembolso' WHERE category IN ('reembolso', 'entrega');
-- rastreio, spam e suporte_humano permanecem iguais

-- 3. Adiciona o novo constraint com as 5 categorias simplificadas
ALTER TABLE messages ADD CONSTRAINT messages_category_check CHECK (category IN (
    'spam',
    'duvidas_gerais',
    'rastreio',
    'troca_devolucao_reembolso',
    'suporte_humano'
));

-- 4. Também atualizar a tabela conversations (se tiver constraint)
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_category_check;
UPDATE conversations SET category = 'duvidas_gerais' WHERE category IN ('produto', 'pagamento', 'outros');
UPDATE conversations SET category = 'troca_devolucao_reembolso' WHERE category IN ('reembolso', 'entrega');
