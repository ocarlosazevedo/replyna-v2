/**
 * Edge Function: Admin Create Client
 *
 * Cria um usuário manualmente (para clientes VIP/influenciadores)
 * sem passar pelo fluxo de pagamento do Stripe
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateClientRequest {
  email: string;
  name: string;
  plan_id: string;
  notes?: string;
}

Deno.serve(async (req) => {
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

    const { email, name, plan_id, notes } = await req.json() as CreateClientRequest;

    // Validações
    if (!email || !email.includes('@')) {
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

    if (!plan_id) {
      return new Response(
        JSON.stringify({ error: 'Plano é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar dados do plano
    const { data: plan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('id, name, emails_limit, shops_limit')
      .eq('id', plan_id)
      .single();

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
    } else {
      // Criar usuário no Auth com senha temporária
      const tempPassword = crypto.randomUUID().slice(0, 12) + 'Aa1!';
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
      plan: plan.name.toLowerCase(),
      emails_limit: plan.emails_limit, // null = ilimitado
      shops_limit: plan.shops_limit,   // null = ilimitado
      emails_used: 0,
      status: 'active',
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

    // Enviar email de reset de senha para o usuário definir sua senha
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
      email.toLowerCase(),
      { redirectTo: 'https://app.replyna.me/reset-password' }
    );

    if (resetError) {
      console.error('Erro ao enviar email de reset:', resetError);
      // Não retorna erro porque o usuário foi criado com sucesso
    }

    console.log('Cliente VIP criado com sucesso:', userId, email);

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        email: email.toLowerCase(),
        name: name.trim(),
        plan: plan.name,
        message: 'Cliente criado com sucesso. Email de definição de senha enviado.',
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
