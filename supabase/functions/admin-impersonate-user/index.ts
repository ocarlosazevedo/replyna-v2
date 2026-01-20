/**
 * Edge Function: Admin Impersonate User
 *
 * Gera um link de acesso temporário para o admin acessar o painel de um cliente.
 * Usa generateLink do Supabase Auth para criar um magic link.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
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

    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Gerando link de impersonate para:', userId);

    // Buscar dados do usuário
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Usuário não encontrado:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Gerando magic link para:', user.email);

    // Gerar magic link usando a API admin do Supabase
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
      options: {
        redirectTo: `${supabaseUrl.replace('.supabase.co', '.vercel.app')}/dashboard`,
      },
    });

    if (linkError) {
      console.error('Erro ao gerar magic link:', linkError);
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar link de acesso: ' + linkError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // O link gerado contém um token que pode ser usado para login
    // Precisamos extrair o token e construir a URL correta
    const actionLink = linkData.properties?.action_link;

    if (!actionLink) {
      console.error('Link de ação não encontrado na resposta');
      return new Response(
        JSON.stringify({ error: 'Não foi possível gerar o link de acesso' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Magic link gerado com sucesso para:', user.email);

    return new Response(
      JSON.stringify({
        success: true,
        link: actionLink,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao gerar link de impersonate:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
