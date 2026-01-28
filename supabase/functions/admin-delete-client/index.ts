/**
 * Edge Function: Admin Delete Client
 *
 * Deleta um cliente completamente:
 * - Cancela assinatura no Stripe
 * - Remove dados do Supabase (users, shops, subscriptions, etc)
 * - Remove usuário do Auth
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import Stripe from 'https://esm.sh/stripe@20.2.0?target=deno';
import { maskEmail } from '../_shared/email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'DELETE') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Iniciando exclusão do cliente:', userId);

    // 1. Buscar dados do usuário
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Usuário não encontrado:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Usuário encontrado:', maskEmail(user.email));

    // 2. Buscar e cancelar assinatura no Stripe
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', userId)
      .single();

    if (subscription?.stripe_subscription_id) {
      try {
        console.log('Cancelando assinatura no Stripe:', subscription.stripe_subscription_id);
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        console.log('Assinatura cancelada com sucesso');
      } catch (stripeError) {
        console.error('Erro ao cancelar assinatura (pode já estar cancelada):', stripeError);
        // Continua mesmo se falhar - a assinatura pode já estar cancelada
      }
    }

    // 3. Deletar dados relacionados no Supabase (ordem importa por causa das FK)

    // 3.1 Deletar mensagens das conversas das lojas do usuário
    const { data: shops } = await supabase
      .from('shops')
      .select('id')
      .eq('user_id', userId);

    if (shops && shops.length > 0) {
      const shopIds = shops.map(s => s.id);

      // Buscar conversas dessas lojas
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .in('shop_id', shopIds);

      if (conversations && conversations.length > 0) {
        const conversationIds = conversations.map(c => c.id);

        // Deletar mensagens
        const { error: messagesError } = await supabase
          .from('messages')
          .delete()
          .in('conversation_id', conversationIds);

        if (messagesError) {
          console.error('Erro ao deletar mensagens:', messagesError);
        } else {
          console.log('Mensagens deletadas');
        }

        // Deletar conversas
        const { error: convsError } = await supabase
          .from('conversations')
          .delete()
          .in('id', conversationIds);

        if (convsError) {
          console.error('Erro ao deletar conversas:', convsError);
        } else {
          console.log('Conversas deletadas');
        }
      }

      // 3.2 Deletar email_processing_logs das lojas
      const { error: logsError } = await supabase
        .from('email_processing_logs')
        .delete()
        .in('shop_id', shopIds);

      if (logsError) {
        console.error('Erro ao deletar logs:', logsError);
      }

      // 3.3 Deletar rate_limits das lojas
      const { error: rateLimitsError } = await supabase
        .from('rate_limits')
        .delete()
        .in('shop_id', shopIds);

      if (rateLimitsError) {
        console.error('Erro ao deletar rate limits:', rateLimitsError);
      }

      // 3.4 Deletar lojas
      const { error: shopsError } = await supabase
        .from('shops')
        .delete()
        .eq('user_id', userId);

      if (shopsError) {
        console.error('Erro ao deletar lojas:', shopsError);
      } else {
        console.log('Lojas deletadas');
      }
    }

    // 3.5 Deletar coupon_usages
    const { error: couponError } = await supabase
      .from('coupon_usages')
      .delete()
      .eq('user_id', userId);

    if (couponError) {
      console.error('Erro ao deletar coupon usages:', couponError);
    }

    // 3.6 Deletar email_extra_purchases
    const { error: extraEmailsError } = await supabase
      .from('email_extra_purchases')
      .delete()
      .eq('user_id', userId);

    if (extraEmailsError) {
      console.error('Erro ao deletar extra emails:', extraEmailsError);
    }

    // 3.7 Deletar subscription
    const { error: subError } = await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', userId);

    if (subError) {
      console.error('Erro ao deletar subscription:', subError);
    } else {
      console.log('Subscription deletada');
    }

    // 3.8 Deletar usuário da tabela users
    const { error: deleteUserError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteUserError) {
      console.error('Erro ao deletar usuário:', deleteUserError);
      throw new Error(`Erro ao deletar usuário: ${deleteUserError.message}`);
    }
    console.log('Usuário deletado da tabela users');

    // 4. Deletar usuário do Auth
    try {
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) {
        console.error('Erro ao deletar do Auth:', authError);
        // Não falha se o usuário não existir no Auth
      } else {
        console.log('Usuário deletado do Auth');
      }
    } catch (authErr) {
      console.error('Exceção ao deletar do Auth:', authErr);
    }

    console.log('Cliente deletado com sucesso:', userId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cliente deletado com sucesso',
        deletedUser: user.email
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao deletar cliente:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao deletar cliente' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
