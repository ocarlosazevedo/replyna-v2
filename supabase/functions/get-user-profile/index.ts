/**
 * Edge Function: Get User Profile
 *
 * Retorna o perfil do usuário logado.
 * Usa service role key para bypassar RLS.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { maskEmail } from '../_shared/email.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Primeiro, verificar o token do usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente com anon key para verificar o usuário
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Obter usuário autenticado
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.error('Erro de autenticação:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Usuário autenticado:', user.id, maskEmail(user.email));

    // Criar cliente admin para buscar dados
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Buscar perfil do usuário
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, plan, emails_limit, emails_used, shops_limit, status, created_at')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Erro ao buscar perfil:', profileError);

      // Se não encontrou, pode ser que o usuário existe no Auth mas não na tabela users
      if (profileError.code === 'PGRST116') {
        return new Response(
          JSON.stringify({
            error: 'User profile not found',
            hint: 'User exists in Auth but not in users table',
            user_id: user.id,
            email: user.email,
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`Erro ao buscar perfil: ${profileError.message}`);
    }

    // Buscar lojas do usuário
    const { data: shops, error: shopsError } = await supabaseAdmin
      .from('shops')
      .select('id, name, shopify_domain, is_active')
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (shopsError) {
      console.error('Erro ao buscar lojas:', shopsError);
    }

    return new Response(
      JSON.stringify({
        profile,
        shops: shops || [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
