-- Função para contar mensagens pendentes por loja de forma eficiente
-- Usado para ordenar o processamento de lojas (menos pendentes primeiro)

CREATE OR REPLACE FUNCTION get_pending_message_counts_by_shop()
RETURNS TABLE(shop_id UUID, count BIGINT)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    c.shop_id,
    COUNT(m.id) as count
  FROM messages m
  INNER JOIN conversations c ON m.conversation_id = c.id
  WHERE m.status = 'pending'
    AND m.direction = 'inbound'
  GROUP BY c.shop_id;
$$;

COMMENT ON FUNCTION get_pending_message_counts_by_shop() IS 'Retorna contagem de mensagens pendentes por loja para ordenação de processamento';
