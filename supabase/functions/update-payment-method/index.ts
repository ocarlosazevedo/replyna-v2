/**
 * Edge Function: Update Payment Method
 *
 * Atualiza o cartao de credito da assinatura do usuario diretamente via API do Asaas.
 * Nao gera cobranca imediata - apenas atualiza o cartao para cobranças futuras.
 *
 * Requer dados do cartao: holderName, number, expiryMonth, expiryYear, ccv
 * e dados do titular: cpfCnpj, postalCode, addressNumber, phone
 */

import { getCorsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
import { updateSubscription } from '../_shared/asaas.ts';

interface UpdatePaymentMethodRequest {
  user_id: string;
  credit_card: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  credit_card_holder_info: {
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as UpdatePaymentMethodRequest;
    const { user_id, credit_card, credit_card_holder_info } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id e obrigatorio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!credit_card?.number || !credit_card?.ccv || !credit_card?.expiryMonth || !credit_card?.expiryYear || !credit_card?.holderName) {
      return new Response(
        JSON.stringify({ error: 'Dados do cartao sao obrigatorios (holderName, number, expiryMonth, expiryYear, ccv)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!credit_card_holder_info?.cpfCnpj || !credit_card_holder_info?.postalCode || !credit_card_holder_info?.addressNumber || !credit_card_holder_info?.phone) {
      return new Response(
        JSON.stringify({ error: 'Dados do titular sao obrigatorios (cpfCnpj, postalCode, addressNumber, phone)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();

    // Buscar usuario
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email, name, asaas_customer_id')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuario nao encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!user.asaas_customer_id) {
      return new Response(
        JSON.stringify({ error: 'Usuario nao possui cadastro no Asaas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar assinatura ativa do usuario
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('asaas_subscription_id, status')
      .eq('user_id', user_id)
      .in('status', ['active', 'past_due', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1);

    const subscription = subscriptions?.[0] || null;

    if (!subscription?.asaas_subscription_id) {
      return new Response(
        JSON.stringify({ error: 'Assinatura ativa nao encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar assinatura com novo cartao no Asaas
    await updateSubscription(subscription.asaas_subscription_id, {
      billingType: 'CREDIT_CARD',
      creditCard: {
        holderName: credit_card.holderName,
        number: credit_card.number.replace(/\s/g, ''),
        expiryMonth: credit_card.expiryMonth,
        expiryYear: credit_card.expiryYear,
        ccv: credit_card.ccv,
      },
      creditCardHolderInfo: {
        name: credit_card.holderName,
        email: user.email,
        cpfCnpj: credit_card_holder_info.cpfCnpj.replace(/\D/g, ''),
        postalCode: credit_card_holder_info.postalCode.replace(/\D/g, ''),
        addressNumber: credit_card_holder_info.addressNumber,
        phone: credit_card_holder_info.phone.replace(/\D/g, ''),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Metodo de pagamento atualizado com sucesso. O novo cartao sera usado nas proximas cobranças.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao atualizar metodo de pagamento:', error);

    // Tentar extrair mensagem de erro do Asaas
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    let friendlyMessage = 'Erro ao atualizar cartao. Verifique os dados e tente novamente.';

    if (errorMessage.includes('invalid') || errorMessage.includes('creditCard')) {
      friendlyMessage = 'Dados do cartao invalidos. Verifique numero, validade e CVV.';
    } else if (errorMessage.includes('cpfCnpj')) {
      friendlyMessage = 'CPF/CNPJ invalido.';
    }

    return new Response(
      JSON.stringify({ error: friendlyMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
