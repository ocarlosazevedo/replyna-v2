/**
 * Edge Function: create-billing-portal (Asaas)
 *
 * Asaas nao possui Customer Portal.
 * Retorna a URL da ultima cobranca do cliente.
 */

import { getCorsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
import { getPaymentsByCustomer, getCustomerByEmail, createCustomer } from '../_shared/asaas.ts';

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id e obrigatorio' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseClient();

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('asaas_customer_id, email, name')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Usuario nao encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!user.asaas_customer_id) {
      // Auto-criar cliente no Asaas se não existe
      console.log(`[BillingPortal] Usuário ${user_id} sem asaas_customer_id, criando automaticamente...`);
      try {
        let customer = await getCustomerByEmail(user.email);
        if (!customer) {
          customer = await createCustomer({
            name: user.name || user.email,
            email: user.email,
          });
          console.log(`[BillingPortal] Cliente Asaas criado: ${customer.id}`);
        } else {
          console.log(`[BillingPortal] Cliente Asaas encontrado por email: ${customer.id}`);
        }

        await supabase
          .from('users')
          .update({ asaas_customer_id: customer.id })
          .eq('id', user_id);

        user.asaas_customer_id = customer.id;
      } catch (asaasError) {
        console.error(`[BillingPortal] Erro ao criar cliente Asaas:`, asaasError);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar cadastro no gateway de pagamento.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const payments = await getPaymentsByCustomer(user.asaas_customer_id, { limit: 1, order: 'desc' });
    const latest = payments.data?.[0];

    return new Response(
      JSON.stringify({
        success: true,
        url: latest?.invoiceUrl || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Erro ao buscar ultima cobranca:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
