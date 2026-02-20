/**
 * Edge Function: Pay Pending Invoice (Asaas)
 *
 * Retorna o link de pagamento (invoiceUrl) de uma cobranca pendente.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { getPaymentsByCustomer } from '../_shared/asaas.ts';

interface PayInvoiceRequest {
  user_id: string;
  purchase_id?: string;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, purchase_id } = (await req.json()) as PayInvoiceRequest;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id e obrigatorio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();

    if (purchase_id) {
      const { data: purchase, error: purchaseError } = await supabase
        .from('email_extra_purchases')
        .select('id, asaas_invoice_url, status')
        .eq('id', purchase_id)
        .eq('user_id', user_id)
        .eq('status', 'pending')
        .single();

      if (purchaseError || !purchase) {
        return new Response(
          JSON.stringify({ error: 'Fatura nao encontrada ou ja foi paga' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ url: purchase.asaas_invoice_url }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: user } = await supabase
      .from('users')
      .select('asaas_customer_id')
      .eq('id', user_id)
      .single();

    if (!user?.asaas_customer_id) {
      return new Response(
        JSON.stringify({ error: 'Usuario nao possui customer_id no Asaas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payments = await getPaymentsByCustomer(user.asaas_customer_id, {
      status: 'PENDING',
      limit: 1,
      order: 'desc',
    });
    const payment = payments.data?.[0];

    if (!payment?.invoiceUrl) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma cobranca pendente encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ url: payment.invoiceUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao buscar invoice pendente:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
