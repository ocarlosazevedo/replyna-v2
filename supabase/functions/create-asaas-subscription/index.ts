/**
 * Edge Function: Create Asaas Subscription
 *
 * Cria cliente e assinatura no Asaas (SEM criar conta no Supabase).
 * A conta so sera criada quando o usuario completar o checkout (confirm-registration).
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  createCustomer,
  getCustomerByEmail,
  createSubscription,
  getPaymentsBySubscription,
} from '../_shared/asaas.ts';

interface CreateSubscriptionRequest {
  plan_id: string;
  user_email: string;
  user_name?: string;
  whatsapp_number?: string;
  coupon_code?: string;
  is_trial?: boolean;
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

function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as CreateSubscriptionRequest;
    const { plan_id, user_email, user_name, whatsapp_number, coupon_code, is_trial } = body;

    if (!plan_id || !user_email) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatorios: plan_id, user_email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseAdmin();
    const normalizedEmail = user_email.toLowerCase();

    // Verificar se email ja existe no Auth
    const { data: existingUsers } = await supabase.auth.admin.listUsers({ perPage: 1 });
    // Buscar pelo email direto
    const { data: userByEmail } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .limit(1);

    if (userByEmail && userByEmail.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Este email ja possui uma conta ativa. Faca login ou use outro email.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: 'Plano nao encontrado ou inativo' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseValue = Number(plan.price_monthly || 0);
    let finalValue = baseValue;
    let discountApplied = 0;
    let couponId: string | null = null;

    if (coupon_code) {
      const upper = coupon_code.toUpperCase();

      const { data: validation } = await supabase.rpc('validate_coupon', {
        p_code: upper,
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_plan_id: plan_id,
      });

      const isValid = validation?.[0]?.is_valid;

      if (isValid) {
        const { data: coupon } = await supabase
          .from('coupons')
          .select('*')
          .eq('code', upper)
          .eq('is_active', true)
          .single();

        if (coupon) {
          couponId = coupon.id;
          if (coupon.discount_type === 'percentage') {
            discountApplied = (baseValue * (coupon.discount_value || 0)) / 100;
            if (coupon.max_discount_amount) {
              discountApplied = Math.min(discountApplied, Number(coupon.max_discount_amount));
            }
          } else {
            discountApplied = Number(coupon.discount_value || 0);
            if (coupon.max_discount_amount) {
              discountApplied = Math.min(discountApplied, Number(coupon.max_discount_amount));
            }
          }
          finalValue = Math.max(0, baseValue - discountApplied);
        }
      }
    }

    // Limpar telefone
    const digitsOnly = (whatsapp_number || '').replace(/\D/g, '');
    let cleanPhone = digitsOnly;
    if (digitsOnly.length > 11) {
      const candidates = [3, 2, 1]
        .map(prefix => digitsOnly.slice(prefix))
        .filter(value => value.length === 10 || value.length === 11);
      cleanPhone = candidates[0] || digitsOnly.slice(-11);
    }

    // Criar ou buscar customer no Asaas
    let customer = await getCustomerByEmail(normalizedEmail);
    if (!customer) {
      customer = await createCustomer({
        name: user_name || user_email,
        email: normalizedEmail,
        mobilePhone: cleanPhone || undefined,
      });
    }

    // === TRIAL: apenas criar customer (lead), sem assinatura/checkout ===
    if (is_trial) {
      console.log(`[CreateSubscription] Trial flow - customer only: ${customer.id}`);

      return new Response(
        JSON.stringify({
          url: null,
          asaas_customer_id: customer.id,
          asaas_subscription_id: null,
          plan_id: plan.id,
          plan_name: plan.name,
          coupon_id: null,
          discount_applied: 0,
          is_trial: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === PAGO: criar assinatura no Asaas com checkout ===
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const nextDueDate = formatDateYYYYMMDD(futureDate);

    let subscriptionDescription = `Replyna - Plano ${plan.name}`;
    if (couponId) {
      subscriptionDescription = `Replyna - Plano ${plan.name} (Cupom aplicado: -${discountApplied.toFixed(2)})`;
    }

    const subscription = await createSubscription({
      customer: customer.id,
      billingType: 'CREDIT_CARD',
      value: finalValue,
      cycle: 'MONTHLY',
      description: subscriptionDescription,
      nextDueDate,
      callback: {
        successUrl: 'https://app.replyna.me/checkout/success',
        autoRedirect: true,
      },
    });

    // Buscar URL do checkout
    const payments = await getPaymentsBySubscription(subscription.id, { limit: 1, order: 'desc' });
    const firstPayment = payments.data?.[0];
    const invoiceUrl = firstPayment?.invoiceUrl || null;

    console.log(`[CreateSubscription] Subscription created: ${subscription.id}, invoice: ${invoiceUrl}`);

    return new Response(
      JSON.stringify({
        url: invoiceUrl,
        asaas_customer_id: customer.id,
        asaas_subscription_id: subscription.id,
        plan_id: plan.id,
        plan_name: plan.name,
        coupon_id: couponId,
        discount_applied: discountApplied,
        is_trial: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao criar assinatura Asaas:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
