/**
 * Edge Function: Create Asaas Subscription
 *
 * Cria cliente e assinatura no Asaas com cartao de credito direto.
 * A conta so sera criada quando o usuario completar o checkout (confirm-registration).
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  createCustomer,
  getCustomerByEmail,
  updateCustomer,
  createSubscription,
  updateSubscription,
} from '../_shared/asaas.ts';

interface CreditCardInput {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

interface CreditCardHolderInfoInput {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode?: string;
  addressNumber?: string;
  phone: string;
  mobilePhone?: string;
  addressComplement?: string;
}

interface CreateSubscriptionRequest {
  plan_id: string;
  user_id?: string;
  user_email: string;
  user_name?: string;
  whatsapp_number?: string;
  coupon_code?: string;
  is_trial?: boolean;
  creditCard?: CreditCardInput;
  creditCardHolderInfo?: CreditCardHolderInfoInput;
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

function getTodayBrazil(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Parse Asaas error responses into user-friendly messages */
function parseAsaasError(error: unknown): string {
  if (!error) return 'Erro ao processar pagamento';

  const msg = String(error);

  // Common Asaas credit card errors
  if (msg.includes('declined') || msg.includes('recusado') || msg.includes('DECLINED'))
    return 'Cartao recusado. Verifique os dados ou tente outro cartao.';
  if (msg.includes('insufficient') || msg.includes('insuficiente'))
    return 'Saldo insuficiente. Tente outro cartao.';
  if (msg.includes('expired') || msg.includes('expirado') || msg.includes('EXPIRED'))
    return 'Cartao expirado. Verifique a validade.';
  if (msg.includes('invalid') && (msg.includes('card') || msg.includes('cartao') || msg.includes('number')))
    return 'Numero do cartao invalido. Verifique os dados.';
  if (msg.includes('cvv') || msg.includes('ccv') || msg.includes('security code'))
    return 'CVV invalido. Verifique o codigo de seguranca.';
  if (msg.includes('holderName'))
    return 'Nome do titular invalido.';
  if (msg.includes('cpfCnpj'))
    return 'CPF/CNPJ invalido.';
  if (msg.includes('postalCode'))
    return 'CEP invalido.';

  // Try to extract Asaas error description
  try {
    const parsed = JSON.parse(msg.replace(/^.*?(\{.+\}).*$/, '$1'));
    if (parsed.errors?.[0]?.description) return parsed.errors[0].description;
    if (parsed.description) return parsed.description;
  } catch {
    // ignore parse errors
  }

  return 'Erro ao processar pagamento. Verifique os dados do cartao e tente novamente.';
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract real client IP for Asaas anti-fraud (required field)
    const xff = req.headers.get('x-forwarded-for');
    const cfIp = req.headers.get('cf-connecting-ip');
    const realIp = req.headers.get('x-real-ip');
    const clientIp = xff?.split(',')[0]?.trim() || cfIp || realIp || '177.54.11.1';
    console.log(`[CreateSubscription] Client IP resolved: ${clientIp} (xff=${xff}, cf=${cfIp}, real=${realIp})`);

    const body = (await req.json()) as CreateSubscriptionRequest;
    const {
      plan_id,
      user_id,
      user_email,
      user_name,
      whatsapp_number,
      coupon_code,
      is_trial,
      creditCard,
      creditCardHolderInfo,
    } = body;

    if (!plan_id || !user_email) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatorios: plan_id, user_email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Credit card is required for both paid and trial flows
    if (!creditCard || !creditCard.number || !creditCard.holderName || !creditCard.expiryMonth || !creditCard.expiryYear || !creditCard.ccv) {
      return new Response(
        JSON.stringify({ error: 'Dados do cartao de credito sao obrigatorios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!creditCardHolderInfo || !creditCardHolderInfo.cpfCnpj) {
      return new Response(
        JSON.stringify({ error: 'Dados do titular do cartao sao obrigatorios (CPF/CNPJ)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseAdmin();
    const normalizedEmail = user_email.toLowerCase();

    // Verificar se email ja existe
    const { data: userByEmail } = await supabase
      .from('users')
      .select('id, status')
      .eq('email', normalizedEmail)
      .limit(1);

    if (userByEmail && userByEmail.length > 0) {
      const existing = userByEmail[0];
      if (!user_id || existing.id !== user_id) {
        return new Response(
          JSON.stringify({ error: 'Este email ja possui uma conta ativa. Faca login ou use outro email.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
    let partnerId: string | null = null;
    let isPartnerCoupon = false;

    // Process coupon (only for paid flow)
    if (coupon_code && !is_trial) {
      const upper = coupon_code.toUpperCase();

      // 1) Check if it's a partner coupon first
      const { data: partnerValidation } = await supabase.rpc('validate_partner_coupon', {
        p_code: upper,
      });

      const partnerResult = partnerValidation?.[0];
      console.log(`[CreateSubscription] Partner coupon validation result:`, JSON.stringify(partnerResult));

      if (partnerResult?.is_valid) {
        // Partner coupon: fixed 10% discount, does NOT combine with regular coupons
        partnerId = partnerResult.partner_id;
        isPartnerCoupon = true;
        discountApplied = Math.round((baseValue * 10) / 100 * 100) / 100;
        finalValue = Math.max(0, baseValue - discountApplied);
        console.log(`[CreateSubscription] Partner coupon applied: partner=${partnerId}, discount=${discountApplied}, finalValue=${finalValue}`);
      } else {
        // 2) Not a partner coupon — try regular coupon validation
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
        cpfCnpj: creditCardHolderInfo?.cpfCnpj || undefined,
        mobilePhone: cleanPhone || undefined,
        postalCode: creditCardHolderInfo?.postalCode || undefined,
        addressNumber: creditCardHolderInfo?.addressNumber || undefined,
      });
    } else {
      // Update existing customer with CPF and address if missing
      await updateCustomer(customer.id, {
        name: user_name || customer.name,
        cpfCnpj: creditCardHolderInfo?.cpfCnpj || undefined,
        mobilePhone: cleanPhone || undefined,
        postalCode: creditCardHolderInfo?.postalCode || undefined,
        addressNumber: creditCardHolderInfo?.addressNumber || undefined,
      });
    }

    // Trial flow: save card via tokenization (no charge), do NOT create a subscription
    if (is_trial) {
      // Trial: create subscription with nextDueDate in 7 days (validates card without charging)
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);
      const trialDueDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(trialEnd);

      try {
        const trialSub = await createSubscription({
          customer: customer.id,
          billingType: 'CREDIT_CARD',
          value: baseValue,
          cycle: 'MONTHLY',
          description: `Replyna - Plano ${plan.name} (Trial)`,
          nextDueDate: trialDueDate,
          creditCard: {
            holderName: creditCard!.holderName,
            number: creditCard!.number,
            expiryMonth: creditCard!.expiryMonth,
            expiryYear: creditCard!.expiryYear,
            ccv: creditCard!.ccv,
          },
          creditCardHolderInfo: {
            name: creditCardHolderInfo!.name,
            email: normalizedEmail,
            cpfCnpj: creditCardHolderInfo!.cpfCnpj,
            postalCode: creditCardHolderInfo!.postalCode || undefined,
            addressNumber: creditCardHolderInfo!.addressNumber || undefined,
            phone: creditCardHolderInfo!.phone || cleanPhone,
            addressComplement: creditCardHolderInfo!.addressComplement || undefined,
          },
          remoteIp: clientIp,
        });

        const returnedToken = trialSub.creditCard?.creditCardToken || null;
        console.log(`[CreateSubscription] Trial subscription created: ${trialSub.id}, first charge on ${trialDueDate}`);

        return new Response(
          JSON.stringify({
            asaas_customer_id: customer.id,
            asaas_subscription_id: trialSub.id,
            asaas_credit_card_token: returnedToken,
            plan_id: plan.id,
            plan_name: plan.name,
            coupon_id: null,
            discount_applied: 0,
            partner_id: null,
            is_trial: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (cardError: any) {
        const rawError = cardError?.message || String(cardError);
        console.error('[CreateSubscription] Trial card error:', rawError);
        const friendlyMessage = parseAsaasError(rawError);
        return new Response(
          JSON.stringify({ error: friendlyMessage, debug_error: rawError }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Paid flow: create subscription with immediate charge
    const nextDueDate = getTodayBrazil();

    // Build subscription description
    let subscriptionDescription = `Replyna - Plano ${plan.name}`;
    if (couponId) {
      subscriptionDescription = `Replyna - Plano ${plan.name} (Cupom: -${discountApplied.toFixed(2)})`;
    }

    // Use Asaas native discount for first payment instead of sending a lower value
    // This avoids floating point issues (e.g., 197 - 19.7 = 177.29999999999998)
    const discountRounded = Math.round(discountApplied * 100) / 100;
    const asaasDiscount = (discountRounded > 0) ? {
      value: discountRounded,
      dueDateLimitDays: 0,
      type: 'FIXED' as const,
    } : undefined;

    const firstPaymentValue = baseValue; // Always full price, discount handled by Asaas

    try {
      const subscription = await createSubscription({
        customer: customer.id,
        billingType: 'CREDIT_CARD',
        value: firstPaymentValue,
        cycle: 'MONTHLY',
        description: subscriptionDescription,
        nextDueDate,
        discount: asaasDiscount,
        creditCard: {
          holderName: creditCard.holderName,
          number: creditCard.number,
          expiryMonth: creditCard.expiryMonth,
          expiryYear: creditCard.expiryYear,
          ccv: creditCard.ccv,
        },
        creditCardHolderInfo: {
          name: creditCardHolderInfo.name,
          email: normalizedEmail,
          cpfCnpj: creditCardHolderInfo.cpfCnpj,
          postalCode: creditCardHolderInfo.postalCode || undefined,
          addressNumber: creditCardHolderInfo.addressNumber || undefined,
          phone: creditCardHolderInfo.phone || cleanPhone,
          addressComplement: creditCardHolderInfo.addressComplement || undefined,
        },
        remoteIp: clientIp,
      });

      console.log(`[CreateSubscription] Subscription created: ${subscription.id}`);

      // Save the token that Asaas returns in the response
      const returnedToken = subscription.creditCard?.creditCardToken || null;

      // Remove discount for future payments (discount was only for first payment)
      if (asaasDiscount) {
        await updateSubscription(subscription.id, {
          description: `Replyna - Plano ${plan.name}`,
        });
        console.log(`[CreateSubscription] Removed first-payment discount for future payments`);
      }

      return new Response(
        JSON.stringify({
          asaas_customer_id: customer.id,
          asaas_subscription_id: subscription.id,
          asaas_credit_card_token: returnedToken,
          plan_id: plan.id,
          plan_name: plan.name,
          coupon_id: couponId,
          discount_applied: discountApplied,
          partner_id: partnerId,
          is_trial: false,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (cardError: any) {
      const rawError = cardError?.message || String(cardError);
      console.error('[CreateSubscription] Card error:', rawError);
      const friendlyMessage = parseAsaasError(rawError);
      return new Response(
        JSON.stringify({
          error: friendlyMessage,
          debug_error: rawError,
          debug_info: {
            value: firstPaymentValue,
            baseValue,
            discountApplied: discountRounded,
            asaasDiscount: asaasDiscount || null,
            isPartnerCoupon,
            coupon_code: coupon_code || null,
            remoteIp: clientIp,
          },
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Erro ao criar assinatura Asaas:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
