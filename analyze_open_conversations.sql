-- 1. Distribuição por data de criação (há quanto tempo estão open)
SELECT 
  DATE(created_at) as data,
  COUNT(*) as quantidade
FROM conversations 
WHERE status = 'open'
  AND category IS NOT NULL 
  AND category NOT IN ('spam', 'acknowledgment')
GROUP BY DATE(created_at)
ORDER BY data DESC
LIMIT 20;

-- 2. Distribuição por loja
SELECT 
  s.name as loja,
  s.is_active as loja_ativa,
  COUNT(*) as conversas_open
FROM conversations c
JOIN shops s ON c.shop_id = s.id
WHERE c.status = 'open'
  AND c.category IS NOT NULL 
  AND c.category NOT IN ('spam', 'acknowledgment')
GROUP BY s.id, s.name, s.is_active
ORDER BY conversas_open DESC
LIMIT 20;

-- 3. Distribuição por categoria
SELECT 
  category,
  COUNT(*) as quantidade
FROM conversations 
WHERE status = 'open'
  AND category IS NOT NULL 
  AND category NOT IN ('spam', 'acknowledgment')
GROUP BY category
ORDER BY quantidade DESC;

-- 4. Conversas open mais antigas (possível bug)
SELECT 
  id,
  customer_email,
  category,
  created_at,
  NOW() - created_at as tempo_open
FROM conversations 
WHERE status = 'open'
  AND category IS NOT NULL 
  AND category NOT IN ('spam', 'acknowledgment')
ORDER BY created_at ASC
LIMIT 10;

-- 5. Verificar se têm mensagens mas sem outbound
SELECT 
  c.id,
  c.status,
  c.created_at,
  COUNT(m.id) as total_mensagens,
  SUM(CASE WHEN m.direction = 'inbound' THEN 1 ELSE 0 END) as inbound,
  SUM(CASE WHEN m.direction = 'outbound' THEN 1 ELSE 0 END) as outbound
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id
WHERE c.status = 'open'
  AND c.category IS NOT NULL 
  AND c.category NOT IN ('spam', 'acknowledgment')
GROUP BY c.id, c.status, c.created_at
HAVING SUM(CASE WHEN m.direction = 'outbound' THEN 1 ELSE 0 END) = 0
ORDER BY c.created_at ASC
LIMIT 20;
