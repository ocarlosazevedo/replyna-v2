/**
 * Edge Function: Create Checkout Session
 *
 * Cria uma sessão de checkout do Stripe para novos usuários
 * ou upgrades de plano.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { isValidEmail } from '../_shared/validation.ts';

interface CreateCheckoutRequest {
  plan_id: string;
  user_email: string;
  user_name?: string;
  user_id?: string; // Se já existe (upgrade)
  whatsapp_number?: string;
  billing_cycle?: 'monthly' | 'yearly';
  coupon_code?: string;
  success_url: string;
  cancel_url: string;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = getStripeClient();
    const supabase = getSupabaseClient();

    const body: CreateCheckoutRequest = await req.json();
    const {
      plan_id,
      user_email,
      user_name,
      user_id,
      whatsapp_number,
      billing_cycle = 'monthly',
      coupon_code,
      success_url,
      cancel_url,
    } = body;

    // Validar campos obrigatórios
    if (!plan_id || !user_email || !success_url || !cancel_url) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: plan_id, user_email, success_url, cancel_url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar formato do email
    if (!isValidEmail(user_email)) {
      return new Response(
        JSON.stringify({ error: 'Email inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar plano
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: 'Plano não encontrado ou inativo' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determinar o price_id do Stripe baseado no ciclo de cobrança
    const stripePriceId = billing_cycle === 'yearly'
      ? plan.stripe_price_yearly_id
      : plan.stripe_price_monthly_id;

    if (!stripePriceId) {
      return new Response(
        JSON.stringify({ error: 'Plano não configurado no Stripe. Configure os IDs de preço no painel admin.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar/criar cliente Stripe
    let stripeCustomerId: string | undefined;

    if (user_id) {
      // Usuário existente - buscar stripe_customer_id
      const { data: existingUser } = await supabase
        .from('users')
        .select('stripe_customer_id')
        .eq('id', user_id)
        .single();

      stripeCustomerId = existingUser?.stripe_customer_id || undefined;

      // Verificar se já tem assinatura ativa - se sim, deve usar update-subscription
      const { data: existingSubs } = await supabase
        .from('subscriptions')
        .select('id, status, stripe_subscription_id')
        .eq('user_id', user_id)
        .in('status', ['active', 'trialing', 'past_due'])
        .limit(1);

      if (existingSubs && existingSubs.length > 0) {
        console.log('Usuário já tem assinatura ativa:', existingSubs[0].stripe_subscription_id);
        return new Response(
          JSON.stringify({
            error: 'Você já possui uma assinatura ativa. Use a opção de alterar plano na sua conta.',
            has_active_subscription: true,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Se não tem customer, criar um
    if (!stripeCustomerId) {
      // Verificar se já existe customer com esse email
      const existingCustomers = await stripe.customers.list({
        email: user_email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        stripeCustomerId = existingCustomers.data[0].id;
      } else {
        // Criar novo customer
        const newCustomer = await stripe.customers.create({
          email: user_email,
          name: user_name,
          metadata: {
            user_id: user_id || 'pending',
          },
        });
        stripeCustomerId = newCustomer.id;
      }
    }

    // Preparar parâmetros do checkout
    const checkoutParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${success_url}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url,
      subscription_data: {
        metadata: {
          plan_id: plan_id,
          plan_name: plan.name,
          user_id: user_id || 'pending',
        },
      },
      metadata: {
        plan_id: plan_id,
        plan_name: plan.name,
        user_email: user_email,
        user_name: user_name || '',
        user_id: user_id || 'pending',
        whatsapp_number: whatsapp_number || '',
        emails_limit: plan.emails_limit?.toString() ?? 'unlimited',
        shops_limit: plan.shops_limit?.toString() ?? 'unlimited',
      },
      allow_promotion_codes: true, // Permite cupons do Stripe
      billing_address_collection: 'auto',
      locale: 'pt-BR',
    };

    // Aplicar cupom se fornecido
    if (coupon_code) {
      console.log('Cupom recebido:', coupon_code);

      // Validar cupom no banco
      const { data: couponValidation, error: couponError } = await supabase.rpc('validate_coupon', {
        p_code: coupon_code.toUpperCase(),
        p_user_id: user_id || '00000000-0000-0000-0000-000000000000',
        p_plan_id: plan_id,
      });

      console.log('Validação do cupom:', JSON.stringify(couponValidation));
      if (couponError) {
        console.error('Erro ao validar cupom:', couponError);
      }

      if (couponValidation && couponValidation[0]?.is_valid && couponValidation[0]?.coupon_id) {
        console.log('Cupom válido, buscando stripe_coupon_id para:', couponValidation[0].coupon_id);

        // Buscar stripe_coupon_id
        const { data: coupon, error: couponFetchError } = await supabase
          .from('coupons')
          .select('stripe_coupon_id')
          .eq('id', couponValidation[0].coupon_id)
          .single();

        console.log('Cupom do banco:', JSON.stringify(coupon));
        if (couponFetchError) {
          console.error('Erro ao buscar cupom:', couponFetchError);
        }

        if (coupon?.stripe_coupon_id) {
          console.log('Aplicando cupom Stripe:', coupon.stripe_coupon_id);
          // Stripe não permite discounts + allow_promotion_codes juntos
          delete checkoutParams.allow_promotion_codes;
          checkoutParams.discounts = [{ coupon: coupon.stripe_coupon_id }];
          checkoutParams.metadata!.coupon_id = couponValidation[0].coupon_id;
          checkoutParams.metadata!.coupon_code = coupon_code.toUpperCase();
        } else {
          console.log('Cupom não tem stripe_coupon_id configurado');
        }
      } else {
        console.log('Cupom inválido ou não encontrado');
      }
    } else {
      console.log('Nenhum cupom fornecido');
    }

    // Criar sessão de checkout
    const session = await stripe.checkout.sessions.create(checkoutParams);

    return new Response(
      JSON.stringify({
        session_id: session.id,
        url: session.url,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao criar checkout session:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
