/**
 * Edge Function: create-billing-portal
 *
 * Cria uma sessão do Stripe Customer Portal para o cliente gerenciar:
 * - Métodos de pagamento (alterar cartão)
 * - Histórico de faturas
 * - Dados de cobrança
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
import { getStripeClient } from '../_shared/stripe.ts';

Deno.serve(async (req: Request) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseClient();
    const stripe = getStripeClient();

    // Buscar customer_id do usuário
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('customer_id, email')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      console.error('Erro ao buscar usuário:', userError);
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!user.customer_id) {
      return new Response(
        JSON.stringify({
          error: 'Você precisa ter uma assinatura ativa para gerenciar seus pagamentos.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Criar sessão do Customer Portal
    const returnUrl = Deno.env.get('APP_URL') || 'https://app.replyna.me';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.customer_id,
      return_url: `${returnUrl}/account`,
    });

    console.log(`[Billing Portal] Sessão criada para usuário ${user_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        url: portalSession.url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Erro ao criar sessão do billing portal:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro interno do servidor',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
