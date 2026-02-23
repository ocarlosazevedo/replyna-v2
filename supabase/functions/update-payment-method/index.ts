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
import { updateSubscription, createSubscription, createCustomer, getCustomerByEmail, updateCustomer } from '../_shared/asaas.ts';

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
      // Auto-criar cliente no Asaas se não existe
      console.log(`[UpdatePayment] Usuário ${user_id} sem asaas_customer_id, criando automaticamente...`);
      try {
        let customer = await getCustomerByEmail(user.email);
        if (!customer) {
          customer = await createCustomer({
            name: user.name || user.email,
            email: user.email,
            cpfCnpj: credit_card_holder_info.cpfCnpj.replace(/\D/g, ''),
            mobilePhone: credit_card_holder_info.phone.replace(/\D/g, ''),
          });
          console.log(`[UpdatePayment] Cliente Asaas criado: ${customer.id}`);
        } else {
          // Atualizar dados do customer existente com CPF e telefone do formulario
          console.log(`[UpdatePayment] Cliente Asaas encontrado por email: ${customer.id}, atualizando dados...`);
          await updateCustomer(customer.id, {
            name: user.name || user.email,
            cpfCnpj: credit_card_holder_info.cpfCnpj.replace(/\D/g, ''),
            mobilePhone: credit_card_holder_info.phone.replace(/\D/g, ''),
          });
        }

        // Salvar no banco
        await supabase
          .from('users')
          .update({ asaas_customer_id: customer.id })
          .eq('id', user_id);

        user.asaas_customer_id = customer.id;
      } catch (asaasError) {
        console.error(`[UpdatePayment] Erro ao criar cliente Asaas:`, asaasError);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar cadastro no gateway de pagamento. Tente novamente.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Buscar assinatura ativa do usuario
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('id, asaas_subscription_id, status, current_period_end, plan_id')
      .eq('user_id', user_id)
      .in('status', ['active', 'past_due', 'trialing', 'incomplete'])
      .order('created_at', { ascending: false })
      .limit(1);

    const subscription = subscriptions?.[0] || null;

    if (!subscription) {
      return new Response(
        JSON.stringify({ error: 'Você não possui uma assinatura ativa. Selecione um plano para assinar.', no_subscription: true }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Dados do cartao formatados
    const creditCardData = {
      holderName: credit_card.holderName,
      number: credit_card.number.replace(/\s/g, ''),
      expiryMonth: credit_card.expiryMonth,
      expiryYear: credit_card.expiryYear,
      ccv: credit_card.ccv,
    };
    const holderInfoData = {
      name: credit_card.holderName,
      email: user.email,
      cpfCnpj: credit_card_holder_info.cpfCnpj.replace(/\D/g, ''),
      postalCode: credit_card_holder_info.postalCode.replace(/\D/g, ''),
      addressNumber: credit_card_holder_info.addressNumber,
      phone: credit_card_holder_info.phone.replace(/\D/g, ''),
    };

    if (subscription.asaas_subscription_id) {
      // === JA TEM ASSINATURA NO ASAAS: apenas atualizar cartao ===
      await updateSubscription(subscription.asaas_subscription_id, {
        billingType: 'CREDIT_CARD',
        creditCard: creditCardData,
        creditCardHolderInfo: holderInfoData,
      });
    } else {
      // === TEM ASSINATURA ATIVA MAS SEM VINCULO ASAAS: criar assinatura no Asaas com cartao ===
      console.log(`[UpdatePayment] Assinatura ${subscription.id} sem asaas_subscription_id, criando no Asaas...`);

      // Buscar plano para saber o valor
      let planValue = 0;
      let planName = 'Replyna';
      if (subscription.plan_id) {
        const { data: plan } = await supabase
          .from('plans')
          .select('price_monthly, name')
          .eq('id', subscription.plan_id)
          .single();
        if (plan) {
          planValue = Number(plan.price_monthly || 0);
          planName = plan.name;
        }
      }

      // Usar current_period_end como data da primeira cobranca (nao cobrar hoje)
      let nextDueDate: string;
      if (subscription.current_period_end) {
        const d = new Date(subscription.current_period_end);
        nextDueDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      } else {
        // Fallback: 30 dias a partir de hoje
        const d = new Date();
        d.setDate(d.getDate() + 30);
        nextDueDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }

      console.log(`[UpdatePayment] Criando assinatura Asaas: valor=${planValue}, nextDueDate=${nextDueDate}`);

      const newSub = await createSubscription({
        customer: user.asaas_customer_id,
        billingType: 'CREDIT_CARD',
        value: planValue,
        cycle: 'MONTHLY',
        description: `Replyna - Plano ${planName}`,
        nextDueDate,
        creditCard: creditCardData,
        creditCardHolderInfo: holderInfoData,
      });

      // Vincular assinatura do Asaas no banco
      await supabase
        .from('subscriptions')
        .update({
          asaas_subscription_id: newSub.id,
          asaas_customer_id: user.asaas_customer_id,
        })
        .eq('id', subscription.id);

      console.log(`[UpdatePayment] Assinatura Asaas criada e vinculada: ${newSub.id}`);
    }

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
