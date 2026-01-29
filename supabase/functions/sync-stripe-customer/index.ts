/**
 * Edge Function: Sync Stripe Customer
 *
 * Cria/sincroniza um usuário a partir de um customer do Stripe que já pagou.
 * Usa a Admin API do Supabase para criar a conta.
 *
 * IMPORTANTE: Esta função deve ser protegida e só deve ser chamada por admins
 * ou internamente pelo sistema.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getStripeClient } from '../_shared/stripe.ts';
import { maskEmail } from '../_shared/email.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Usar service role key para poder criar usuários
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const stripe = getStripeClient();

    const body = await req.json();
    const { customer_id, temporary_password } = body;

    if (!customer_id) {
      return new Response(
        JSON.stringify({ error: 'customer_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar customer no Stripe
    const customer = await stripe.customers.retrieve(customer_id) as any;

    if (customer.deleted) {
      return new Response(
        JSON.stringify({ error: 'Customer foi deletado no Stripe' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const email = customer.email;
    const name = customer.name;

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Customer não tem email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sincronizando customer:', { customer_id, email: maskEmail(email), name });

    // Verificar se usuário já existe no Auth
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    const existingAuthUser = existingUsers?.users.find(u =>
      u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;

    if (existingAuthUser) {
      console.log('Usuário já existe no Auth:', existingAuthUser.id);
      userId = existingAuthUser.id;
    } else {
      // Criar usuário no Auth
      // Gerar uma senha temporária se não fornecida
      const password = temporary_password || crypto.randomUUID().slice(0, 12) + 'Aa1!';

      const { data: newAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true, // Confirma o email automaticamente
        user_metadata: { name },
      });

      if (createAuthError) {
        console.error('Erro ao criar usuário no Auth:', createAuthError);
        throw new Error(`Erro ao criar usuário no Auth: ${createAuthError.message}`);
      }

      userId = newAuthUser.user.id;
      console.log('Usuário criado no Auth:', userId);
    }

    // Buscar subscription do customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer_id,
      limit: 1,
      status: 'all',
    });

    const subscription = subscriptions.data[0];

    // Buscar metadata da sessão de checkout se existir
    let metadata: Record<string, string> = {};
    if (subscription) {
      const sessions = await stripe.checkout.sessions.list({
        subscription: subscription.id,
        limit: 1,
      });
      metadata = sessions.data[0]?.metadata || {};
    }

    // Verificar se usuário já existe na tabela users
    const { data: existingDbUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    const plan = metadata.plan_name?.toLowerCase() || 'starter';

    // Parsear limites: 'unlimited' = null, número = valor numérico
    const parseLimit = (value: string | undefined, defaultValue: number): number | null => {
      if (!value || value === 'unlimited') return null;
      const parsed = parseInt(value);
      return isNaN(parsed) ? defaultValue : parsed;
    };

    const emailsLimit = parseLimit(metadata.emails_limit, 500);
    const shopsLimit = parseLimit(metadata.shops_limit, 1);

    if (existingDbUser) {
      // Atualizar
      await supabaseAdmin
        .from('users')
        .update({
          stripe_customer_id: customer_id,
          plan,
          emails_limit: emailsLimit,
          shops_limit: shopsLimit,
          status: subscription?.status === 'active' ? 'active' : 'inactive',
        })
        .eq('id', userId);
      console.log('Usuário atualizado na tabela users');
    } else {
      // Inserir
      const { error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          email: email.toLowerCase(),
          name: name || null,
          plan,
          emails_limit: emailsLimit,
          shops_limit: shopsLimit,
          emails_used: 0,
          stripe_customer_id: customer_id,
          status: subscription?.status === 'active' ? 'active' : 'inactive',
        });

      if (insertError) {
        console.error('Erro ao inserir na tabela users:', insertError);
        throw new Error(`Erro ao inserir na tabela users: ${insertError.message}`);
      }
      console.log('Usuário inserido na tabela users');
    }

    // Criar/atualizar subscription se existir
    if (subscription) {
      const priceId = subscription.items.data[0]?.price.id;

      const { data: existingSub } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('stripe_subscription_id', subscription.id)
        .single();

      const subscriptionData = {
        user_id: userId,
        plan_id: metadata.plan_id || null,
        stripe_customer_id: customer_id,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        status: subscription.status === 'active' ? 'active' : subscription.status,
        billing_cycle: priceId?.includes('year') ? 'yearly' : 'monthly',
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
      };

      if (existingSub) {
        await supabaseAdmin
          .from('subscriptions')
          .update(subscriptionData)
          .eq('id', existingSub.id);
      } else {
        await supabaseAdmin
          .from('subscriptions')
          .insert(subscriptionData);
      }
      console.log('Subscription sincronizada');
    }

    // Atualizar metadata do customer no Stripe
    await stripe.customers.update(customer_id, {
      metadata: { user_id: userId },
    });

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        email: email,
        message: existingAuthUser ? 'Usuário já existia, apenas atualizado' : 'Novo usuário criado',
        note: existingAuthUser ? null : 'O usuário precisa resetar a senha para acessar a conta',
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
