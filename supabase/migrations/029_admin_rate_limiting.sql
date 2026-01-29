-- Migration: Admin Rate Limiting
-- Segurança: previne ataques de força bruta no login admin

-- Tabela para rastrear tentativas de login admin
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  email TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT FALSE,

  -- Índices para consultas eficientes
  CONSTRAINT admin_login_attempts_ip_idx UNIQUE (id)
);

-- Índice para buscar tentativas por IP e tempo
CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_ip_time
  ON admin_login_attempts (ip_address, attempted_at DESC);

-- Índice para limpeza de tentativas antigas
CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_time
  ON admin_login_attempts (attempted_at);

-- Função para verificar rate limit
-- Retorna: { allowed: boolean, attempts_count: int, blocked_until: timestamp }
CREATE OR REPLACE FUNCTION check_admin_rate_limit(
  p_ip_address TEXT,
  p_max_attempts INT DEFAULT 5,
  p_window_minutes INT DEFAULT 15
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attempts_count INT;
  v_window_start TIMESTAMPTZ;
  v_blocked_until TIMESTAMPTZ;
BEGIN
  -- Calcular início da janela de tempo
  v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  -- Contar tentativas falhadas na janela
  SELECT COUNT(*)
  INTO v_attempts_count
  FROM admin_login_attempts
  WHERE ip_address = p_ip_address
    AND attempted_at > v_window_start
    AND success = FALSE;

  -- Se excedeu limite, calcular quando será desbloqueado
  IF v_attempts_count >= p_max_attempts THEN
    -- Pegar a tentativa mais antiga na janela
    SELECT MIN(attempted_at) + (p_window_minutes || ' minutes')::INTERVAL
    INTO v_blocked_until
    FROM admin_login_attempts
    WHERE ip_address = p_ip_address
      AND attempted_at > v_window_start
      AND success = FALSE;

    RETURN json_build_object(
      'allowed', FALSE,
      'attempts_count', v_attempts_count,
      'blocked_until', v_blocked_until
    );
  END IF;

  -- Permitido
  RETURN json_build_object(
    'allowed', TRUE,
    'attempts_count', v_attempts_count,
    'blocked_until', NULL
  );
END;
$$;

-- Função para registrar tentativa de login
CREATE OR REPLACE FUNCTION record_admin_login_attempt(
  p_ip_address TEXT,
  p_email TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO admin_login_attempts (ip_address, email, success)
  VALUES (p_ip_address, p_email, p_success);

  -- Se login bem sucedido, limpar tentativas anteriores deste IP
  -- Isso "reseta" o rate limit após login correto
  IF p_success THEN
    DELETE FROM admin_login_attempts
    WHERE ip_address = p_ip_address
      AND success = FALSE
      AND attempted_at > NOW() - INTERVAL '1 hour';
  END IF;
END;
$$;

-- Função para limpar tentativas antigas (manutenção)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts(
  p_older_than_hours INT DEFAULT 24
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  DELETE FROM admin_login_attempts
  WHERE attempted_at < NOW() - (p_older_than_hours || ' hours')::INTERVAL;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;

-- Comentários
COMMENT ON TABLE admin_login_attempts IS 'Rastreia tentativas de login admin para rate limiting';
COMMENT ON FUNCTION check_admin_rate_limit IS 'Verifica se IP está bloqueado por excesso de tentativas';
COMMENT ON FUNCTION record_admin_login_attempt IS 'Registra tentativa de login admin';
COMMENT ON FUNCTION cleanup_old_login_attempts IS 'Remove tentativas antigas para manutenção';

-- Grant para service role
GRANT ALL ON admin_login_attempts TO service_role;
GRANT EXECUTE ON FUNCTION check_admin_rate_limit TO service_role;
GRANT EXECUTE ON FUNCTION record_admin_login_attempt TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_login_attempts TO service_role;
