/**
 * Edge Function: Admin Create Client
 *
 * Cria um usuário manualmente (para clientes VIP/influenciadores)
 * sem passar pelo fluxo de pagamento do Stripe
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { maskEmail } from '../_shared/email.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { isValidEmail } from '../_shared/validation.ts';
import { sendPasswordResetViaResend } from '../_shared/resend.ts';

interface CreateClientRequest {
  email: string;
  name: string;
  plan_id?: string;
  plan_slug?: string;
  notes?: string;
  whatsapp_number?: string;
  password?: string;
  invite_token?: string;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

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

    const { email, name, plan_id, plan_slug, notes, whatsapp_number, password, invite_token } = await req.json() as CreateClientRequest;

    // Validações
    if (!email || !isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: 'Email inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!name || name.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: 'Nome é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!plan_id && !plan_slug) {
      return new Response(
        JSON.stringify({ error: 'Plano é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar convite, se informado
    let inviteRecord: { id: string } | null = null;
    if (invite_token) {
      const { data: inviteData, error: inviteError } = await supabaseAdmin
        .from('partner_invites')
        .select('id, used, expires_at')
        .eq('token', invite_token)
        .maybeSingle();

      const isExpired = inviteData?.expires_at
        ? new Date(inviteData.expires_at).getTime() < Date.now()
        : false;

      if (inviteError || !inviteData || inviteData.used || isExpired) {
        return new Response(
          JSON.stringify({ error: 'Convite inválido ou expirado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      inviteRecord = { id: inviteData.id };
    }

    // Buscar dados do plano
    const planQuery = supabaseAdmin
      .from('plans')
      .select('id, name, slug, emails_limit, shops_limit')
      .limit(1);

    const { data: plan, error: planError } = plan_id
      ? await planQuery.eq('id', plan_id).single()
      : await planQuery.eq('slug', plan_slug).single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: 'Plano não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se usuário já existe na tabela users
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Já existe um usuário com este email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se já existe no Auth
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = authUsers?.users.find(u =>
      u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;

    if (existingAuthUser) {
      userId = existingAuthUser.id;
      console.log('Usuário já existe no Auth, usando ID:', userId);

      if (password) {
        const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password,
        });

        if (updateAuthError) {
          console.error('Erro ao atualizar senha do usuário no Auth:', updateAuthError);
          return new Response(
            JSON.stringify({ error: `Erro ao atualizar senha: ${updateAuthError.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } else {
      // Criar usuário no Auth com senha definida ou temporária
      const tempPassword = password || (crypto.randomUUID().slice(0, 12) + 'Aa1!');
      const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase(),
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name: name.trim() },
      });

      if (authError) {
        console.error('Erro ao criar usuário no Auth:', authError);
        return new Response(
          JSON.stringify({ error: `Erro ao criar usuário: ${authError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = newAuthUser.user.id;
      console.log('Usuário criado no Auth:', userId);
    }

    // Criar na tabela users
    const userData = {
      id: userId,
      email: email.toLowerCase(),
      name: name.trim(),
      plan: (plan.slug || plan.name.toLowerCase()),
      emails_limit: plan.emails_limit, // null = ilimitado
      shops_limit: plan.shops_limit,   // null = ilimitado
      emails_used: 0,
      status: 'active',
      whatsapp_number: whatsapp_number ? String(whatsapp_number).trim() : null,
      // Campo para identificar que é um cliente VIP (não tem assinatura Stripe)
      stripe_customer_id: null,
    };

    const { error: createError } = await supabaseAdmin
      .from('users')
      .insert(userData);

    if (createError) {
      console.error('Erro ao criar usuário na tabela users:', createError);
      return new Response(
        JSON.stringify({ error: `Erro ao criar usuário: ${createError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let magicLink: string | null = null;

    if (password) {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: email.toLowerCase(),
        options: { redirectTo: 'https://app.replyna.me/dashboard' },
      });

      if (linkError) {
        console.error('Erro ao gerar magic link:', linkError);
      } else {
        magicLink = linkData?.properties?.action_link ?? null;
      }
    } else {
      // Enviar email de definição de senha via Resend
      const resetResult = await sendPasswordResetViaResend({
        supabase: supabaseAdmin,
        email: email.toLowerCase(),
        name: name.trim(),
      });
      if (!resetResult.success) {
        console.error('Erro ao enviar email via Resend:', resetResult.error);
      }
    }

    if (inviteRecord) {
      const { error: inviteUpdateError } = await supabaseAdmin
        .from('partner_invites')
        .update({ used: true, used_by: userId })
        .eq('id', inviteRecord.id);

      if (inviteUpdateError) {
        console.error('Erro ao marcar convite como usado:', inviteUpdateError);
        return new Response(
          JSON.stringify({ error: 'Erro ao finalizar convite' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Cliente VIP criado com sucesso:', userId, maskEmail(email));

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        email: email.toLowerCase(),
        name: name.trim(),
        plan: plan.name,
        message: 'Cliente criado com sucesso. Email de definição de senha enviado.',
        magic_link: magicLink,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
