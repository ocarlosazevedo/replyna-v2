/**
 * Edge Function: Stripe Debug
 *
 * Funções de diagnóstico para Stripe (apenas para admin)
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = getStripeClient();
    const supabase = getSupabaseClient();
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Listar sessões de checkout recentes
    if (action === 'sessions') {
      const sessions = await stripe.checkout.sessions.list({
        limit: 10,
        expand: ['data.customer', 'data.subscription'],
      });

      return new Response(
        JSON.stringify({
          sessions: sessions.data.map(s => ({
            id: s.id,
            status: s.status,
            payment_status: s.payment_status,
            customer_email: s.customer_email,
            customer_details: s.customer_details,
            customer_id: s.customer,
            subscription_id: s.subscription,
            metadata: s.metadata,
            created: new Date(s.created * 1000).toISOString(),
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar sessão por subscription_id
    if (action === 'find-session') {
      const subscriptionId = url.searchParams.get('subscription_id');
      if (!subscriptionId) {
        return new Response(
          JSON.stringify({ error: 'subscription_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const sessions = await stripe.checkout.sessions.list({
        subscription: subscriptionId,
        limit: 1,
      });

      if (sessions.data.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Sessão não encontrada para essa subscription' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const session = sessions.data[0];
      return new Response(
        JSON.stringify({
          session_id: session.id,
          status: session.status,
          payment_status: session.payment_status,
          customer_email: session.customer_email,
          metadata: session.metadata,
          reprocess_url: `https://ulldjamxdsaqqyurcmcs.supabase.co/functions/v1/stripe-webhook?session_id=${session.id}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar customer por ID
    if (action === 'customer') {
      const customerId = url.searchParams.get('customer_id');
      if (!customerId) {
        return new Response(
          JSON.stringify({ error: 'customer_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const customer = await stripe.customers.retrieve(customerId);

      // Buscar usuário no banco
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('stripe_customer_id', customerId)
        .single();

      return new Response(
        JSON.stringify({
          stripe_customer: customer,
          database_user: user || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sincronizar usuário a partir de customer
    if (action === 'sync-customer' && req.method === 'POST') {
      const body = await req.json();
      const customerId = body.customer_id;

      if (!customerId) {
        return new Response(
          JSON.stringify({ error: 'customer_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const customer = await stripe.customers.retrieve(customerId) as any;

      // Buscar subscriptions do customer
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        limit: 1,
        status: 'all',
      });

      const subscription = subscriptions.data[0];

      if (!subscription) {
        return new Response(
          JSON.stringify({ error: 'Nenhuma subscription encontrada para esse customer' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar sessão de checkout para obter metadata
      const sessions = await stripe.checkout.sessions.list({
        subscription: subscription.id,
        limit: 1,
      });

      const session = sessions.data[0];
      const metadata = session?.metadata || {};

      // Verificar se usuário já existe
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', customer.email.toLowerCase())
        .single();

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
        // Atualizar usuário existente
        await supabase
          .from('users')
          .update({
            stripe_customer_id: customerId,
            plan: metadata.plan_name?.toLowerCase() || 'starter',
            emails_limit: parseInt(metadata.emails_limit || '500'),
            shops_limit: parseInt(metadata.shops_limit || '1'),
            status: subscription.status === 'active' ? 'active' : 'inactive',
          })
          .eq('id', userId);
      } else {
        // Gerar UUID manualmente
        const newUserId = crypto.randomUUID();

        // Criar novo usuário com ID explícito
        const { error: createError } = await supabase
          .from('users')
          .insert({
            id: newUserId,
            email: customer.email.toLowerCase(),
            name: customer.name || metadata.user_name || null,
            plan: metadata.plan_name?.toLowerCase() || 'starter',
            emails_limit: parseInt(metadata.emails_limit || '500'),
            shops_limit: parseInt(metadata.shops_limit || '1'),
            emails_used: 0,
            stripe_customer_id: customerId,
            status: subscription.status === 'active' ? 'active' : 'inactive',
          });

        if (createError) {
          throw new Error(`Erro ao criar usuário: ${createError.message}`);
        }
        userId = newUserId;
      }

      // Criar/atualizar subscription no banco
      const priceId = subscription.items.data[0]?.price.id;

      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('stripe_subscription_id', subscription.id)
        .single();

      const subscriptionData = {
        user_id: userId,
        plan_id: metadata.plan_id || null,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        status: subscription.status === 'active' ? 'active' : subscription.status,
        billing_cycle: priceId?.includes('year') ? 'yearly' : 'monthly',
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
      };

      if (existingSub) {
        await supabase
          .from('subscriptions')
          .update(subscriptionData)
          .eq('id', existingSub.id);
      } else {
        await supabase
          .from('subscriptions')
          .insert(subscriptionData);
      }

      // Atualizar metadata do customer no Stripe
      await stripe.customers.update(customerId, {
        metadata: { user_id: userId },
      });

      return new Response(
        JSON.stringify({
          success: true,
          user_id: userId,
          message: existingUser ? 'Usuário atualizado' : 'Usuário criado',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar estrutura da tabela users
    if (action === 'check-users-table') {
      const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'users' });

      // Se a função não existir, criar uma query direta
      if (error) {
        const { data: columns, error: colError } = await supabase
          .from('users')
          .select('*')
          .limit(0);

        return new Response(
          JSON.stringify({
            message: 'Não foi possível obter estrutura da tabela',
            hint: 'Execute no Supabase SQL Editor: SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = \'users\';',
            error: error?.message
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ columns: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default: mostrar instruções
    return new Response(
      JSON.stringify({
        message: 'Stripe Debug API',
        endpoints: {
          'GET ?action=sessions': 'Lista as 10 sessões de checkout mais recentes',
          'GET ?action=find-session&subscription_id=sub_xxx': 'Encontra sessão por subscription ID',
          'GET ?action=customer&customer_id=cus_xxx': 'Busca customer e usuário no banco',
          'GET ?action=check-users-table': 'Verifica estrutura da tabela users',
          'POST ?action=sync-customer': 'Sincroniza/cria usuário a partir de customer (body: { customer_id: "cus_xxx" })',
        },
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
