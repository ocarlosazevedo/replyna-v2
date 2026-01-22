/**
 * Edge Function: Charge Extra Emails
 *
 * Cobra um pacote de emails extras do usuário via Stripe
 * Chamada automaticamente quando o usuário atinge o limite do pacote
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ChargeRequest {
  user_id: string;
  package_size?: number; // Opcional, usa o padrão do plano se não fornecido
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, package_size } = (await req.json()) as ChargeRequest;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();
    const stripe = getStripeClient();

    // Buscar usuário
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name, stripe_customer_id, pending_extra_emails')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      throw new Error('Usuário não encontrado');
    }

    if (!user.stripe_customer_id) {
      throw new Error('Usuário não possui customer_id no Stripe');
    }

    // Buscar assinatura ativa e plano
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        plan_id,
        stripe_subscription_id,
        plans (
          id,
          name,
          extra_email_price,
          extra_email_package_size,
          stripe_extra_email_price_id
        )
      `)
      .eq('user_id', user_id)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      throw new Error('Assinatura ativa não encontrada');
    }

    const plan = subscription.plans as {
      id: string;
      name: string;
      extra_email_price: number;
      extra_email_package_size: number;
      stripe_extra_email_price_id: string | null;
    };

    if (!plan.stripe_extra_email_price_id) {
      throw new Error(`Plano ${plan.name} não tem preço de email extra configurado no Stripe`);
    }

    const finalPackageSize = package_size || plan.extra_email_package_size;
    const totalAmount = finalPackageSize * plan.extra_email_price;

    console.log(`Cobrando pacote de ${finalPackageSize} emails extras para usuário ${user.email}`);
    console.log(`Valor total: R$${totalAmount.toFixed(2)}`);

    // Registrar compra pendente no banco
    const { data: purchaseData, error: purchaseError } = await supabase
      .rpc('register_extra_email_purchase', {
        p_user_id: user_id,
        p_package_size: finalPackageSize,
        p_price_per_email: plan.extra_email_price,
      });

    if (purchaseError) {
      throw new Error(`Erro ao registrar compra: ${purchaseError.message}`);
    }

    const purchaseId = purchaseData;

    // Buscar método de pagamento da assinatura no Stripe
    let defaultPaymentMethod: string | null = null;
    if (subscription.stripe_subscription_id) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
        defaultPaymentMethod = stripeSubscription.default_payment_method as string | null;
        console.log('Método de pagamento da assinatura:', defaultPaymentMethod);
      } catch (e) {
        console.log('Não foi possível obter método de pagamento da assinatura:', e);
      }
    }

    // Criar Invoice Item no Stripe (será cobrado na próxima fatura ou imediatamente)
    try {
      // Criar um invoice item para o pacote de emails extras
      const invoiceItem = await stripe.invoiceItems.create({
        customer: user.stripe_customer_id,
        price: plan.stripe_extra_email_price_id,
        quantity: 1, // 1 pacote
        description: `Pacote de ${finalPackageSize} emails extras - Plano ${plan.name}`,
        metadata: {
          user_id: user_id,
          purchase_id: purchaseId,
          package_size: finalPackageSize.toString(),
          price_per_email: plan.extra_email_price.toString(),
        },
      });

      console.log('Invoice item criado:', invoiceItem.id);

      // Criar e finalizar invoice imediatamente
      const invoiceParams: Record<string, unknown> = {
        customer: user.stripe_customer_id,
        auto_advance: true, // Finaliza automaticamente
        collection_method: 'charge_automatically',
        pending_invoice_items_behavior: 'include', // IMPORTANTE: incluir items pendentes
        description: `Emails extras - ${plan.name}`,
        metadata: {
          user_id: user_id,
          purchase_id: purchaseId,
          type: 'extra_emails',
        },
      };

      // Usar método de pagamento da assinatura se disponível
      if (defaultPaymentMethod) {
        invoiceParams.default_payment_method = defaultPaymentMethod;
      }

      const invoice = await stripe.invoices.create(invoiceParams);

      // Finalizar a invoice (isso vai cobrar automaticamente se tiver método de pagamento)
      let finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

      console.log('Invoice finalizada:', finalizedInvoice.id, 'Status:', finalizedInvoice.status);

      // Se não foi paga automaticamente, tentar pagar explicitamente
      if (finalizedInvoice.status === 'open' && defaultPaymentMethod) {
        console.log('Tentando pagar invoice explicitamente com método:', defaultPaymentMethod);
        try {
          finalizedInvoice = await stripe.invoices.pay(finalizedInvoice.id, {
            payment_method: defaultPaymentMethod,
          });
          console.log('Invoice paga explicitamente. Novo status:', finalizedInvoice.status);
        } catch (payError) {
          console.error('Erro ao pagar invoice explicitamente:', payError);
        }
      }

      // Se a invoice foi paga
      if (finalizedInvoice.status === 'paid') {
        // Confirmar compra no banco
        await supabase.rpc('confirm_extra_email_purchase', {
          p_purchase_id: purchaseId,
          p_stripe_invoice_id: finalizedInvoice.id,
          p_stripe_charge_id: finalizedInvoice.charge as string,
        });

        console.log('Compra confirmada com sucesso');

        return new Response(
          JSON.stringify({
            success: true,
            message: `Pacote de ${finalPackageSize} emails extras cobrado com sucesso`,
            invoice_id: finalizedInvoice.id,
            amount: totalAmount,
            purchase_id: purchaseId,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Invoice criada mas não paga - cliente não tem método de pagamento
        // Atualizar purchase com invoice_id e URL de pagamento
        const hostedInvoiceUrl = finalizedInvoice.hosted_invoice_url;

        await supabase
          .from('email_extra_purchases')
          .update({
            stripe_invoice_id: finalizedInvoice.id,
            status: 'pending', // Cliente precisa pagar manualmente
          })
          .eq('id', purchaseId);

        // NÃO liberar créditos - manter mensagem como pending_credits
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Cliente não possui método de pagamento. Invoice criada aguardando pagamento manual.',
            invoice_id: finalizedInvoice.id,
            invoice_url: hostedInvoiceUrl,
            invoice_status: finalizedInvoice.status,
            purchase_id: purchaseId,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (stripeError: unknown) {
      // Atualizar purchase como falha
      const errorMessage = stripeError instanceof Error ? stripeError.message : 'Erro desconhecido';
      await supabase
        .from('email_extra_purchases')
        .update({
          status: 'failed',
          error_message: errorMessage,
        })
        .eq('id', purchaseId);

      throw stripeError;
    }
  } catch (error) {
    console.error('Erro ao cobrar emails extras:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
