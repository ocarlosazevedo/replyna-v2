/**
 * Edge Function: Admin Send Reset Password
 *
 * Envia email de reset de senha para um usuário.
 * Usa service role key para poder gerar o link.
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

    console.log('Enviando email de reset para:', email);

    // Gerar link de recuperação
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: 'https://app.replyna.com/reset-password',
      },
    });

    if (error) {
      console.error('Erro ao gerar link:', error);
      throw new Error(`Erro ao gerar link: ${error.message}`);
    }

    console.log('Link gerado com sucesso');

    // Também podemos usar o método resetPasswordForEmail que envia o email automaticamente
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://app.replyna.com/reset-password',
    });

    if (resetError) {
      console.error('Erro ao enviar email:', resetError);
      throw new Error(`Erro ao enviar email: ${resetError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email de recuperação enviado para ${email}`,
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
