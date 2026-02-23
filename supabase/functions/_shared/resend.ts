/**
 * Helper para enviar emails de reset de senha via Resend API.
 * Gera o link via Supabase Auth Admin e envia email customizado.
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';

interface SendPasswordEmailOptions {
  supabase: SupabaseClient;
  email: string;
  name?: string | null;
}

/**
 * Gera um link de recovery via Auth Admin e envia email via Resend.
 * Retorna { success, error? }
 */
export async function sendPasswordResetViaResend({
  supabase,
  email,
  name,
}: SendPasswordEmailOptions): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.error('[RESEND] RESEND_API_KEY não configurada');
    return { success: false, error: 'RESEND_API_KEY não configurada' };
  }

  // Gerar link de recuperação via Auth Admin
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: 'https://app.replyna.me/reset-password' },
  });

  if (linkError) {
    console.error('[RESEND] Erro ao gerar link de reset:', linkError);
    return { success: false, error: linkError.message };
  }

  const actionLink = linkData?.properties?.action_link;
  if (!actionLink) {
    console.error('[RESEND] Link de reset ausente na resposta');
    return { success: false, error: 'Link de reset não foi gerado' };
  }

  const safeName = name?.trim() || 'Olá';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Replyna <no-reply@replyna.me>',
        to: email,
        subject: 'Defina sua senha no Replyna',
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
            <h2 style="margin: 0 0 12px;">${safeName}, sua conta foi ativada!</h2>
            <p style="margin: 0 0 16px;">
              Clique no botão abaixo para definir sua senha e acessar o Replyna.
            </p>
            <p style="margin: 0 0 24px;">
              <a href="${actionLink}" style="background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">
                Definir minha senha
              </a>
            </p>
            <p style="margin: 0; font-size: 13px; color: #475569;">
              Se o botão não funcionar, copie e cole este link no navegador:<br/>
              ${actionLink}
            </p>
          </div>
        `,
        text: `Sua conta foi ativada. Defina sua senha: ${actionLink}`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[RESEND] Erro ao enviar:', response.status, errorText);
      return { success: false, error: errorText };
    }

    console.log('[RESEND] Email de senha enviado para', email);
    return { success: true };
  } catch (err) {
    console.error('[RESEND] Exceção:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Erro desconhecido' };
  }
}
