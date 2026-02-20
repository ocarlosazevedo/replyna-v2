/**
 * Edge Function: Create Asaas Subscription
 *
 * Cria cliente e assinatura no Asaas e registra no Supabase.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  createCustomer,
  getCustomerByEmail,
  createSubscription,
  getPaymentsBySubscription,
  AsaasDiscount,
} from '../_shared/asaas.ts';

interface CreateSubscriptionRequest {
  plan_id: string;
  user_email: string;
  user_name?: string;
  whatsapp_number?: string;
  coupon_code?: string;
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
    const { plan_id, user_email, user_name, whatsapp_number, coupon_code } = body;

    if (!plan_id || !user_email) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatorios: plan_id, user_email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseAdmin();

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
    let asaasDiscount: AsaasDiscount | undefined = undefined;

    if (coupon_code) {
      const upper = coupon_code.toUpperCase();

      // Validar cupom via RPC para regras de uso
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
            finalValue = Math.max(0, baseValue - discountApplied);
            asaasDiscount = {
              value: Number(coupon.discount_value || 0),
              dueDateLimitDays: 0,
              type: 'PERCENTAGE',
            };
          } else {
            discountApplied = Number(coupon.discount_value || 0);
            if (coupon.max_discount_amount) {
              discountApplied = Math.min(discountApplied, Number(coupon.max_discount_amount));
            }
            finalValue = Math.max(0, baseValue - discountApplied);
            asaasDiscount = {
              value: discountApplied,
              dueDateLimitDays: 0,
              type: 'FIXED',
            };
          }
        }
      }
    }

    // Criar ou buscar customer no Asaas
    let customer = await getCustomerByEmail(user_email);
    if (!customer) {
      customer = await createCustomer({
        name: user_name || user_email,
        email: user_email,
        mobilePhone: whatsapp_number || undefined,
      });
    }

    const nextDueDate = formatDateYYYYMMDD(new Date());

    // Criar assinatura
    const subscription = await createSubscription({
      customer: customer.id,
      billingType: 'CREDIT_CARD',
      value: finalValue,
      cycle: 'MONTHLY',
      description: `Replyna - Plano ${plan.name}`,
      nextDueDate,
      discount: asaasDiscount,
    });

    // Buscar primeira cobranca
    const payments = await getPaymentsBySubscription(subscription.id, { limit: 1, order: 'desc' });
    const firstPayment = payments.data?.[0];
    const invoiceUrl = firstPayment?.invoiceUrl || null;

    // Criar ou obter usuario no Auth
    const { data: existingAuth } = await supabase.auth.admin.getUserByEmail(user_email);
    let userId = existingAuth?.user?.id || null;

    if (!userId) {
      const tempPassword = crypto.randomUUID().slice(0, 12) + 'Aa1!';
      const { data: newAuth, error: authError } = await supabase.auth.admin.createUser({
        email: user_email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name: user_name || '' },
      });
      if (authError) {
        throw new Error(`Erro ao criar usuario no Auth: ${authError.message}`);
      }
      userId = newAuth.user.id;
    }

    // Upsert na tabela users
    await supabase
      .from('users')
      .upsert({
        id: userId,
        email: user_email.toLowerCase(),
        name: user_name || null,
        plan: plan.name,
        emails_limit: plan.emails_limit,
        shops_limit: plan.shops_limit,
        emails_used: 0,
        extra_emails_purchased: 0,
        extra_emails_used: 0,
        pending_extra_emails: 0,
        asaas_customer_id: customer.id,
        status: 'active',
        whatsapp_number: whatsapp_number || null,
        updated_at: new Date().toISOString(),
      });

    // Criar/atualizar assinatura no banco
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    const subscriptionData = {
      user_id: userId,
      plan_id: plan_id,
      asaas_customer_id: customer.id,
      asaas_subscription_id: subscription.id,
      status: 'active',
      billing_cycle: 'monthly',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      coupon_id: couponId,
    };

    if (existingSub && existingSub.length > 0) {
      await supabase
        .from('subscriptions')
        .update(subscriptionData)
        .eq('id', existingSub[0].id);
    } else {
      await supabase
        .from('subscriptions')
        .insert(subscriptionData);
    }

    if (couponId) {
      await supabase.rpc('use_coupon', {
        p_coupon_id: couponId,
        p_user_id: userId,
        p_discount_applied: discountApplied,
        p_subscription_id: subscription.id,
      });
    }

    // Enviar email de reset de senha
    try {
      await supabase.auth.admin.resetPasswordForEmail(user_email, {
        redirectTo: 'https://app.replyna.me/reset-password',
      });
    } catch (err) {
      console.error('Erro ao enviar reset de senha:', err);
    }

    return new Response(
      JSON.stringify({
        url: invoiceUrl,
        subscription_id: subscription.id,
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
