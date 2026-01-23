/**
 * Cliente Stripe para Edge Functions
 * Atualizado para v20.2.0 (compatível com Deno v2)
 */

import Stripe from 'https://esm.sh/stripe@20.2.0?target=deno';

let stripeClient: Stripe | null = null;

/**
 * Obtém o cliente Stripe
 */
export function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY é obrigatória. Configure nas variáveis de ambiente.');
  }

  stripeClient = new Stripe(stripeSecretKey, {
    apiVersion: '2024-11-20.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  });

  return stripeClient;
}

/**
 * Verifica assinatura do webhook Stripe (async para Deno)
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  webhookSecret: string
): Promise<Stripe.Event> {
  const stripe = getStripeClient();
  return await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret);
}

export { Stripe };
