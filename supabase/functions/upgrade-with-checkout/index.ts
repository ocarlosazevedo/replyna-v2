/**
 * Edge Function: Upgrade With Checkout
 *
 * Cria/atualiza assinatura no Asaas com dados de cartao de credito
 * para usuarios existentes que estao fazendo upgrade pelo checkout customizado.
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
  addressComplement?: string;
}

interface UpgradeRequest {
  user_id: string;
  plan_id: string;
  user_email: string;
  user_name?: string;
  whatsapp_number?: string;
  creditCard: CreditCardInput;
  creditCardHolderInfo: CreditCardHolderInfoInput;
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

function formatDateBrazil(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts; // returns YYYY-MM-DD
}

function parseAsaasError(error: unknown): string {
  if (!error) return 'Erro ao processar pagamento';
  const msg = String(error);
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
  try {
    const parsed = JSON.parse(msg.replace(/^.*?(\{.+\}).*$/, '$1'));
    if (parsed.errors?.[0]?.description) return parsed.errors[0].description;
    if (parsed.description) return parsed.description;
  } catch {
    // ignore
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
    // Extract real client IP for Asaas anti-fraud
    const xff = req.headers.get('x-forwarded-for');
    const cfIp = req.headers.get('cf-connecting-ip');
    const realIp = req.headers.get('x-real-ip');
    const clientIp = xff?.split(',')[0]?.trim() || cfIp || realIp || '177.54.11.1';

    const body = (await req.json()) as UpgradeRequest;
    const {
      user_id,
      plan_id,
      user_email,
      user_name,
      whatsapp_number,
      creditCard,
      creditCardHolderInfo,
    } = body;

    if (!user_id || !plan_id) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatorios: user_id, plan_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Buscar usuario
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, name, asaas_customer_id, is_trial')
      .eq('id', user_id)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: 'Usuario nao encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        JSON.stringify({ error: 'Plano nao encontrado ou inativo' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = (user_email || userData.email).toLowerCase();

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
    let customerId = userData.asaas_customer_id;
    if (!customerId) {
      let customer = await getCustomerByEmail(normalizedEmail);
      if (!customer) {
        customer = await createCustomer({
          name: user_name || userData.name || normalizedEmail,
          email: normalizedEmail,
          cpfCnpj: creditCardHolderInfo.cpfCnpj,
          mobilePhone: cleanPhone || undefined,
          postalCode: creditCardHolderInfo.postalCode,
          addressNumber: creditCardHolderInfo.addressNumber,
        });
        console.log(`[UpgradeCheckout] Cliente Asaas criado: ${customer.id}`);
      } else {
        await updateCustomer(customer.id, {
          name: user_name || userData.name || customer.name,
          cpfCnpj: creditCardHolderInfo.cpfCnpj,
          mobilePhone: cleanPhone || undefined,
          postalCode: creditCardHolderInfo.postalCode,
          addressNumber: creditCardHolderInfo.addressNumber,
        });
      }
      customerId = customer.id;
      await supabase.from('users').update({ asaas_customer_id: customerId }).eq('id', user_id);
    } else {
      // Atualizar dados do customer existente
      await updateCustomer(customerId, {
        name: user_name || userData.name,
        cpfCnpj: creditCardHolderInfo.cpfCnpj,
        mobilePhone: cleanPhone || undefined,
        postalCode: creditCardHolderInfo.postalCode,
        addressNumber: creditCardHolderInfo.addressNumber,
      });
    }

    // Verificar se ja tem assinatura ativa
    const { data: existingSubs } = await supabase
      .from('subscriptions')
      .select('id, asaas_subscription_id, status')
      .eq('user_id', user_id)
      .in('status', ['active', 'trialing', 'past_due', 'incomplete'])
      .order('created_at', { ascending: false })
      .limit(1);

    const existingSub = existingSubs?.[0] || null;

    const now = new Date();
    const nextDueDate = formatDateBrazil();
    const baseValue = Number(plan.price_monthly || 0);

    try {
      // Se tem assinatura existente no Asaas, atualizar com dados raw do cartao
      if (existingSub?.asaas_subscription_id) {
        await updateSubscription(existingSub.asaas_subscription_id, {
          value: baseValue,
          description: `Replyna - Plano ${plan.name}`,
          cycle: 'MONTHLY',
          nextDueDate,
          updatePendingPayments: true,
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

        console.log(`[UpgradeCheckout] Assinatura existente atualizada: ${existingSub.asaas_subscription_id}`);

        const periodEnd = new Date(now);
        periodEnd.setDate(periodEnd.getDate() + 30);

        // Atualizar subscription no banco
        await supabase
          .from('subscriptions')
          .update({
            plan_id,
            status: 'active',
            billing_cycle: 'monthly',
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', existingSub.id);
      } else {
        // Criar nova assinatura com dados raw do cartao
        const newSub = await createSubscription({
          customer: customerId,
          billingType: 'CREDIT_CARD',
          value: baseValue,
          cycle: 'MONTHLY',
          description: `Replyna - Plano ${plan.name}`,
          nextDueDate,
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

        console.log(`[UpgradeCheckout] Nova assinatura criada: ${newSub.id}`);

        const periodEnd = new Date(now);
        periodEnd.setDate(periodEnd.getDate() + 30);

        // Criar registro no banco
        await supabase.from('subscriptions').insert({
          user_id,
          plan_id,
          asaas_customer_id: customerId,
          asaas_subscription_id: newSub.id,
          status: 'active',
          billing_cycle: 'monthly',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: false,
        });
      }

      // Atualizar usuario com novo plano
      const updateData: Record<string, unknown> = {
        plan: plan.slug,
        emails_limit: plan.emails_limit,
        shops_limit: plan.shops_limit,
        emails_used: 0,
        extra_emails_used: 0,
        pending_extra_emails: 0,
        status: 'active',
        is_trial: false,
        trial_ends_at: null,
        asaas_customer_id: customerId,
        updated_at: now.toISOString(),
      };

      // Salvar whatsapp se fornecido
      if (whatsapp_number) {
        updateData.whatsapp_number = whatsapp_number;
      }

      await supabase
        .from('users')
        .update(updateData)
        .eq('id', user_id);

      console.log(`[UpgradeCheckout] Usuario ${user_id} atualizado para plano ${plan.name}`);

      return new Response(
        JSON.stringify({
          success: true,
          plan: plan.name,
          new_plan: {
            id: plan.id,
            name: plan.name,
            emails_limit: plan.emails_limit,
            shops_limit: plan.shops_limit,
            price_monthly: plan.price_monthly,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (cardError) {
      console.error('[UpgradeCheckout] Card error:', cardError);
      const friendlyMessage = parseAsaasError(cardError?.message || cardError);
      return new Response(
        JSON.stringify({ error: friendlyMessage }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('[UpgradeCheckout] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
