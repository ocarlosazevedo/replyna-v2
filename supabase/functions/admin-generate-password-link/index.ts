/**
 * Edge Function: Admin Generate Password Link
 *
 * Gera um link direto para o usuário definir/resetar sua senha.
 * Retorna o link para ser enviado manualmente ou exibido.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { maskEmail } from '../_shared/email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body = await req.json();
    const { email } = body;

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'email é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Gerando link de reset para:', maskEmail(email));

    // Gerar link de recuperação (magic link)
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: 'https://app.replyna.me/reset-password',
      },
    });

    if (error) {
      console.error('Erro ao gerar link:', error);
      throw new Error(`Erro ao gerar link: ${error.message}`);
    }

    console.log('Link gerado com sucesso');

    // O link gerado precisa ser formatado corretamente
    // data.properties.action_link contém o link completo
    const actionLink = data.properties?.action_link;

    return new Response(
      JSON.stringify({
        success: true,
        email: email,
        link: actionLink,
        message: 'Link gerado. O usuário pode usar este link para definir sua senha.',
        expires_in: '24 horas',
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
