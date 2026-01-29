/**
 * Rate Limiting compartilhado
 * Segurança: previne ataques de força bruta
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';

/**
 * Configuração de rate limiting
 */
export interface RateLimitConfig {
  maxAttempts: number;      // Número máximo de tentativas
  windowMinutes: number;    // Janela de tempo em minutos
  blockDurationMinutes: number; // Duração do bloqueio em minutos
}

/**
 * Resultado da verificação de rate limit
 */
export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  blockedUntil?: string;
  error?: string;
}

/**
 * Configuração padrão para login admin
 */
export const ADMIN_LOGIN_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  windowMinutes: 15,
  blockDurationMinutes: 30,
};

/**
 * Obtém cliente Supabase admin
 */
function getSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Extrai IP da requisição
 * Considera headers de proxy reverso
 * @param req - Requisição HTTP
 * @returns IP do cliente
 */
export function getClientIP(req: Request): string {
  // Headers comuns de proxy reverso (Cloudflare, nginx, etc.)
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Pega o primeiro IP (cliente original)
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }

  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }

  // Fallback - IP desconhecido
  return 'unknown';
}

/**
 * Verifica se o IP está bloqueado para login admin
 * Usa a função SQL check_admin_rate_limit
 *
 * @param ipAddress - IP a verificar
 * @param config - Configuração de rate limit (opcional)
 * @returns Resultado da verificação
 */
export async function checkAdminRateLimit(
  ipAddress: string,
  config: RateLimitConfig = ADMIN_LOGIN_CONFIG
): Promise<RateLimitResult> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.rpc('check_admin_rate_limit', {
      p_ip_address: ipAddress,
      p_max_attempts: config.maxAttempts,
      p_window_minutes: config.windowMinutes,
    });

    if (error) {
      console.error('[rate-limit] Erro ao verificar rate limit:', error);
      // Em caso de erro no banco, permite a tentativa (fail open)
      // Isso evita bloquear todos se houver problema no banco
      return { allowed: true, remainingAttempts: config.maxAttempts };
    }

    // A função SQL retorna: { allowed, attempts_count, blocked_until }
    const result = data as { allowed: boolean; attempts_count: number; blocked_until: string | null };

    return {
      allowed: result.allowed,
      remainingAttempts: Math.max(0, config.maxAttempts - result.attempts_count),
      blockedUntil: result.blocked_until || undefined,
    };
  } catch (err) {
    console.error('[rate-limit] Exceção ao verificar rate limit:', err);
    // Fail open em caso de exceção
    return { allowed: true, remainingAttempts: config.maxAttempts };
  }
}

/**
 * Registra uma tentativa de login admin
 *
 * @param ipAddress - IP que tentou login
 * @param email - Email usado na tentativa
 * @param success - Se o login foi bem sucedido
 */
export async function recordAdminLoginAttempt(
  ipAddress: string,
  email: string,
  success: boolean
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.rpc('record_admin_login_attempt', {
      p_ip_address: ipAddress,
      p_email: email,
      p_success: success,
    });

    if (error) {
      console.error('[rate-limit] Erro ao registrar tentativa:', error);
    }
  } catch (err) {
    console.error('[rate-limit] Exceção ao registrar tentativa:', err);
    // Não lança erro - registro de tentativa não é crítico
  }
}

/**
 * Limpa tentativas antigas (para manutenção)
 * Normalmente executado via cron job
 *
 * @param olderThanMinutes - Remove tentativas mais antigas que X minutos
 */
export async function cleanupOldAttempts(olderThanMinutes: number = 60): Promise<number> {
  try {
    const supabase = getSupabaseAdmin();

    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('admin_login_attempts')
      .delete()
      .lt('attempted_at', cutoffTime)
      .select('id');

    if (error) {
      console.error('[rate-limit] Erro ao limpar tentativas antigas:', error);
      return 0;
    }

    return data?.length || 0;
  } catch (err) {
    console.error('[rate-limit] Exceção ao limpar tentativas:', err);
    return 0;
  }
}
