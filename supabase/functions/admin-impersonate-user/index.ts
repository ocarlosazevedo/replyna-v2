/**
 * Edge Function: Admin Impersonate User
 *
 * Gera um link de acesso temporário para o admin acessar o painel de um cliente.
 * Usa generateLink do Supabase Auth para criar um magic link.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { maskEmail } from '../_shared/email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// URL da aplicação frontend
const SITE_URL = 'https://app.replyna.me';

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

    console.log('Gerando magic link para:', maskEmail(user.email));

    // Gerar magic link usando a API admin do Supabase
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
      options: {
        redirectTo: `${SITE_URL}/dashboard`,
      },
    });

    if (linkError) {
      console.error('Erro ao gerar magic link:', linkError);
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar link de acesso: ' + linkError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // O generateLink retorna um link que aponta para o Supabase Auth
    // Precisamos extrair o token_hash e tipo, e construir uma URL para o nosso site
    const actionLink = linkData.properties?.action_link;
    const hashedToken = linkData.properties?.hashed_token;
    const verificationToken = linkData.properties?.verification_token;

    console.log('Link data:', JSON.stringify(linkData, null, 2));

    if (!actionLink) {
      console.error('Link de ação não encontrado na resposta');
      return new Response(
        JSON.stringify({ error: 'Não foi possível gerar o link de acesso' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // O actionLink está no formato:
    // https://xxx.supabase.co/auth/v1/verify?token=TOKEN&type=magiclink&redirect_to=URL
    // Precisamos transformar para:
    // https://replyna.com.br/auth/confirm?token_hash=HASH&type=magiclink

    // Extrair parâmetros do link original
    const url = new URL(actionLink);
    const token = url.searchParams.get('token');
    const type = url.searchParams.get('type');

    // Construir link que vai direto para o site e usa o fluxo de confirmação
    // O Supabase processa isso automaticamente se configurado corretamente
    const appLink = `${SITE_URL}/auth/confirm?token_hash=${hashedToken || token}&type=${type}`;

    console.log('Magic link gerado com sucesso para:', maskEmail(user.email));
    console.log('App link:', appLink);

    return new Response(
      JSON.stringify({
        success: true,
        link: appLink,
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
