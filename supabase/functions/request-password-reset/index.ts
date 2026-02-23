/**
 * Edge Function: Request Password Reset
 *
 * Endpoint público para "Esqueci minha senha".
 * Gera link via Auth Admin e envia email via Resend.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';
import { isValidEmail } from '../_shared/validation.ts';
import { sendPasswordResetViaResend } from '../_shared/resend.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email || !isValidEmail(email)) {
      // Retorna sucesso mesmo com email inválido para não expor se o email existe
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Buscar nome do usuário (se existir)
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('name')
      .eq('email', email.toLowerCase())
      .single();

    // Enviar email via Resend (se o usuário não existir, generateLink vai falhar silenciosamente)
    const result = await sendPasswordResetViaResend({
      supabase: supabaseAdmin,
      email: email.toLowerCase(),
      name: userData?.name,
    });

    if (!result.success) {
      console.error('Erro ao enviar reset via Resend:', result.error);
    }

    // Sempre retorna sucesso para não expor se o email existe
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    // Sempre retorna sucesso para segurança
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
