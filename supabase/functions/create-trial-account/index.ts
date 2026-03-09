/**
 * Edge Function: Create Trial Account
 *
 * Cria uma conta de teste gratuito (30 emails, 1 loja).
 * Sem necessidade de cartao de credito.
 * Cria o cliente no Asaas (sem cobranca) para facilitar conversao futura.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';
import { createCustomer, getCustomerByEmail } from '../_shared/asaas.ts';

interface CreateTrialRequest {
  email: string;
  name: string;
  whatsapp_number?: string;
}

function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as CreateTrialRequest;
    const { email, name, whatsapp_number } = body;

    if (!email || !name) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatorios: email, name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.toLowerCase();
    const supabase = getSupabaseAdmin();

    // Create user in Auth
    const tempPassword = crypto.randomUUID().slice(0, 12) + 'Aa1!';
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authError) {
      const message = authError.message?.toLowerCase() || '';
      if (message.includes('already') || message.includes('exists') || message.includes('registered')) {
        return new Response(
          JSON.stringify({ error: 'Este email ja possui uma conta. Faca login ou use outro email.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Erro ao criar usuario: ${authError.message}`);
    }

    const userId = authData?.user?.id;
    if (!userId) {
      throw new Error('Erro ao criar usuario: ID ausente');
    }

    // Criar cliente no Asaas (sem cobranca, apenas cadastro)
    let asaasCustomerId: string | null = null;
    try {
      // Limpar telefone: remover codigo do pais e caracteres nao numericos
      const digitsOnly = (whatsapp_number || '').replace(/\D/g, '');
      let cleanPhone = digitsOnly;
      if (digitsOnly.length > 11) {
        const candidates = [3, 2, 1]
          .map(prefix => digitsOnly.slice(prefix))
          .filter(value => value.length === 10 || value.length === 11);
        cleanPhone = candidates[0] || digitsOnly.slice(-11);
      }

      // Verificar se ja existe cliente no Asaas com esse email
      let customer = await getCustomerByEmail(normalizedEmail);
      if (!customer) {
        customer = await createCustomer({
          name,
          email: normalizedEmail,
          mobilePhone: cleanPhone || undefined,
        });
      }
      asaasCustomerId = customer.id;
      console.log(`[CreateTrialAccount] Cliente criado no Asaas: ${asaasCustomerId}`);
    } catch (asaasError) {
      // Se falhar no Asaas, continua criando a conta (nao bloqueia o trial)
      console.error('[CreateTrialAccount] Erro ao criar cliente no Asaas (continuando sem):', asaasError);
    }

    // Insert user as trial
    const now = new Date().toISOString();
    await supabase.from('users').insert({
      id: userId,
      email: normalizedEmail,
      name,
      plan: 'Free Trial',
      emails_limit: 30,
      emails_used: 0,
      shops_limit: 1,
      extra_emails_purchased: 0,
      extra_emails_used: 0,
      pending_extra_emails: 0,
      asaas_customer_id: asaasCustomerId,
      status: 'active',
      is_trial: true,
      trial_started_at: now,
      whatsapp_number: whatsapp_number || null,
      updated_at: now,
    });

    // Generate magic link so user can access the dashboard
    const { data: linkData } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
      options: {
        redirectTo: `${origin || 'https://app.replyna.me'}/dashboard`,
      },
    });

    const magicLink = linkData?.properties?.action_link || null;

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        asaas_customer_id: asaasCustomerId,
        magic_link: magicLink,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao criar conta trial:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
