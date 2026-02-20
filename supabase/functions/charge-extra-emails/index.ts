/**
 * Edge Function: Charge Extra Emails (Asaas)
 *
 * Cobra um pacote de emails extras do usuario via Asaas.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { createPayment } from '../_shared/asaas.ts';

interface ChargeRequest {
  user_id: string;
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
    const { user_id } = (await req.json()) as ChargeRequest;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id e obrigatorio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name, asaas_customer_id, emails_used, pending_extra_emails, plan')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      throw new Error('Usuario nao encontrado');
    }

    if (!user.asaas_customer_id) {
      throw new Error('Usuario nao possui customer_id no Asaas');
    }

    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, name, extra_email_price, extra_email_package_size')
      .eq('name', user.plan)
      .single();

    if (planError || !plan) {
      throw new Error('Plano nao encontrado');
    }

    if (!plan.extra_email_price || plan.extra_email_price <= 0) {
      throw new Error('Plano nao possui cobranca de emails extras');
    }

    const packageSize = plan.extra_email_package_size || 100;
    const totalAmount = Number(plan.extra_email_price) * packageSize;

    const payment = await createPayment({
      customer: user.asaas_customer_id,
      billingType: 'CREDIT_CARD',
      value: totalAmount,
      dueDate: formatDateYYYYMMDD(new Date()),
      description: `Replyna - Pacote extra de ${packageSize} emails`,
    });

    const { data: purchase, error: purchaseError } = await supabase
      .from('email_extra_purchases')
      .insert({
        user_id: user_id,
        plan_id: plan.id,
        package_size: packageSize,
        price_per_email: plan.extra_email_price,
        total_amount: totalAmount,
        asaas_payment_id: payment.id,
        asaas_invoice_url: payment.invoiceUrl || null,
        status: 'pending',
        triggered_at_usage: user.emails_used,
      })
      .select('id')
      .single();

    if (purchaseError) {
      throw new Error(`Erro ao registrar compra: ${purchaseError.message}`);
    }

    const now = new Date();

    await supabase
      .from('users')
      .update({
        pending_extra_emails: (user.pending_extra_emails || 0) + packageSize,
        updated_at: now.toISOString(),
      })
      .eq('id', user_id);

    const isPaid = payment.status === 'CONFIRMED' || payment.status === 'RECEIVED';

    if (isPaid && purchase?.id) {
      await supabase
        .from('email_extra_purchases')
        .update({
          status: 'completed',
          completed_at: now.toISOString(),
        })
        .eq('id', purchase.id);

      await supabase
        .from('users')
        .update({
          extra_emails_purchased: (user.extra_emails_purchased || 0) + packageSize,
          pending_extra_emails: Math.max(0, (user.pending_extra_emails || 0) - packageSize),
          updated_at: now.toISOString(),
        })
        .eq('id', user_id);

      return new Response(
        JSON.stringify({
          success: true,
          payment_id: payment.id,
          invoice_url: payment.invoiceUrl || null,
          purchase_id: purchase?.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        payment_id: payment.id,
        invoice_url: payment.invoiceUrl || null,
        purchase_id: purchase?.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao cobrar emails extras:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
