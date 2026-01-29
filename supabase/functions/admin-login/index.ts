/**
 * Edge Function: Admin Login
 *
 * Login de administrador com rate limiting integrado.
 * Previne ataques de força bruta limitando tentativas por IP.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';
import { isValidEmail } from '../_shared/validation.ts';
import { getClientIP } from '../_shared/rate-limit.ts';

interface LoginRequest {
  email: string;
  password: string;
  token_hash: string;
  user_agent?: string;
}

interface RateLimitResult {
  allowed: boolean;
  attempts_count: number;
  blocked_until: string | null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body: LoginRequest = await req.json();
    const { email, password, token_hash, user_agent } = body;

    // Validações básicas
    if (!email || !password || !token_hash) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email, senha e token são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidEmail(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Formato de email inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter IP do cliente
    const clientIP = getClientIP(req);
    console.log('Tentativa de login admin:', { email: email.toLowerCase(), ip: clientIP });

    // Verificar rate limit
    const { data: rateLimitData, error: rateLimitError } = await supabase.rpc('check_admin_rate_limit', {
      p_ip_address: clientIP,
      p_max_attempts: 5,
      p_window_minutes: 15,
    });

    if (rateLimitError) {
      console.error('Erro ao verificar rate limit:', rateLimitError);
      // Continua mesmo com erro (fail open)
    } else {
      const rateLimit = rateLimitData as RateLimitResult;

      if (!rateLimit.allowed) {
        const blockedUntil = rateLimit.blocked_until
          ? new Date(rateLimit.blocked_until).toLocaleTimeString('pt-BR')
          : '15 minutos';

        console.log('IP bloqueado por rate limit:', clientIP);

        return new Response(
          JSON.stringify({
            success: false,
            error: `Muitas tentativas de login. Tente novamente após ${blockedUntil}.`,
            blocked: true,
            blocked_until: rateLimit.blocked_until,
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Tentar fazer login
    const { data: loginData, error: loginError } = await supabase.rpc('admin_login_with_session', {
      p_email: email.toLowerCase(),
      p_password: password,
      p_token_hash: token_hash,
      p_user_agent: user_agent || 'unknown',
    });

    // Determinar se login foi bem sucedido
    const loginSuccess = !loginError && loginData?.success === true;

    // Registrar tentativa (sucesso ou falha)
    const { error: recordError } = await supabase.rpc('record_admin_login_attempt', {
      p_ip_address: clientIP,
      p_email: email.toLowerCase(),
      p_success: loginSuccess,
    });

    if (recordError) {
      console.error('Erro ao registrar tentativa:', recordError);
      // Não bloqueia o fluxo
    }

    // Retornar resultado do login
    if (loginError) {
      console.error('Erro no login:', loginError);
      return new Response(
        JSON.stringify({ success: false, error: loginError.message || 'Erro ao conectar com o servidor' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!loginData?.success) {
      return new Response(
        JSON.stringify({ success: false, error: loginData?.error || 'Email ou senha inválidos' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Login admin bem sucedido:', email.toLowerCase());

    return new Response(
      JSON.stringify({
        success: true,
        admin: loginData.admin,
        expires_at: loginData.expires_at,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no login admin:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
