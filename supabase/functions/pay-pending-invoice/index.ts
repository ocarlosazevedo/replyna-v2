/**
 * Edge Function: Pay Pending Invoice
 *
 * Permite que o usuário pague uma invoice pendente de emails extras
 * Cria uma Checkout Session do Stripe para pagamento
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PayInvoiceRequest {
  purchase_id: string;
  stripe_invoice_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { purchase_id, stripe_invoice_id } = (await req.json()) as PayInvoiceRequest;

    if (!purchase_id || !stripe_invoice_id) {
      return new Response(
        JSON.stringify({ error: 'purchase_id e stripe_invoice_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();
    const stripe = getStripeClient();

    // Buscar a compra pendente
    const { data: purchase, error: purchaseError } = await supabase
      .from('email_extra_purchases')
      .select('*, users!inner(id, email, name, stripe_customer_id)')
      .eq('id', purchase_id)
      .in('status', ['pending', 'processing'])
      .single();

    if (purchaseError || !purchase) {
      return new Response(
        JSON.stringify({ error: 'Fatura não encontrada ou já foi paga' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = purchase.users as {
      id: string;
      email: string;
      name: string | null;
      stripe_customer_id: string | null;
    };

    if (!user.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: 'Usuário não possui cadastro no Stripe' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar status da invoice no Stripe
    const stripeInvoice = await stripe.invoices.retrieve(stripe_invoice_id);

    // Se a invoice já foi paga, confirmar no banco
    if (stripeInvoice.status === 'paid') {
      await supabase.rpc('confirm_extra_email_purchase', {
        p_purchase_id: purchase_id,
        p_stripe_invoice_id: stripe_invoice_id,
        p_stripe_charge_id: stripeInvoice.charge as string,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Pagamento já realizado anteriormente. Créditos liberados.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se a invoice está aberta, tentar cobrar ou criar checkout
    if (stripeInvoice.status === 'open') {
      // Primeiro, tentar pegar um método de pagamento do cliente
      const paymentMethods = await stripe.paymentMethods.list({
        customer: user.stripe_customer_id,
        type: 'card',
        limit: 1,
      });

      if (paymentMethods.data.length > 0) {
        // Cliente tem cartão salvo, tentar cobrar
        try {
          const paidInvoice = await stripe.invoices.pay(stripe_invoice_id, {
            payment_method: paymentMethods.data[0].id,
          });

          if (paidInvoice.status === 'paid') {
            // Confirmar no banco
            await supabase.rpc('confirm_extra_email_purchase', {
              p_purchase_id: purchase_id,
              p_stripe_invoice_id: stripe_invoice_id,
              p_stripe_charge_id: paidInvoice.charge as string,
            });

            return new Response(
              JSON.stringify({
                success: true,
                message: 'Pagamento realizado com sucesso!',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (payError) {
          console.log('Erro ao pagar com cartão salvo:', payError);
          // Continua para criar checkout session
        }
      }

      // Criar Checkout Session para pagamento
      const baseUrl = Deno.env.get('FRONTEND_URL') || 'https://app.replyna.me';

      const checkoutSession = await stripe.checkout.sessions.create({
        customer: user.stripe_customer_id,
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'brl',
              product_data: {
                name: `Pacote de ${purchase.package_size} emails extras`,
                description: 'Créditos adicionais para respostas automáticas',
              },
              unit_amount: Math.round(purchase.total_amount * 100), // Em centavos
            },
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/account?payment=success&purchase_id=${purchase_id}`,
        cancel_url: `${baseUrl}/account?payment=cancelled`,
        metadata: {
          purchase_id: purchase_id,
          user_id: user.id,
          type: 'extra_emails_payment',
        },
        payment_intent_data: {
          metadata: {
            purchase_id: purchase_id,
            user_id: user.id,
            type: 'extra_emails_payment',
          },
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          checkout_url: checkoutSession.url,
          message: 'Redirecionando para pagamento',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Invoice em outro status (void, uncollectible, etc)
    return new Response(
      JSON.stringify({
        error: `Fatura não pode ser paga. Status: ${stripeInvoice.status}`,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao processar pagamento:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
