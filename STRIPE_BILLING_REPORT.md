# Relatorio Stripe & Billing (Replyna V2)

Data de geracao: 2026-02-20
Workspace: /Users/User/Desktop/replyna-v2

**1. Arquivos com referencia a Stripe (com trechos relevantes)**

File: `supabase/migrations/004_admin_panel_schema.sql`
```sql
-- Stripe
stripe_product_id TEXT,
stripe_price_monthly_id TEXT,
stripe_price_yearly_id TEXT,
...
-- Stripe
stripe_customer_id TEXT,
stripe_subscription_id TEXT UNIQUE,
stripe_price_id TEXT,
```

File: `supabase/migrations/005_email_extras_billing.sql`
```sql
ADD COLUMN IF NOT EXISTS stripe_extra_email_price_id TEXT;
...
stripe_payment_intent_id TEXT,
stripe_invoice_id TEXT,
stripe_charge_id TEXT,
```

File: `supabase/migrations/008_migration_invites.sql`
```sql
-- Data de inicio da cobranca (quando o Stripe vai comecar a cobrar)
billing_start_date TIMESTAMPTZ NOT NULL,
...
COMMENT ON COLUMN migration_invites.billing_start_date IS 'Data em que o Stripe comecara a cobrar (trial_end)';
```

File: `supabase/functions/_shared/stripe.ts`
```ts
import Stripe from 'https://esm.sh/stripe@20.2.0?target=deno';
...
export function getStripeClient(): Stripe {
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  ...
  stripeClient = new Stripe(stripeSecretKey, {
    apiVersion: '2024-11-20.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  });
}
```

File: `supabase/functions/_shared/cors.ts`
```ts
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
```

File: `supabase/functions/stripe-webhook/index.ts`
```ts
switch (event.type) {
  case 'checkout.session.completed':
  case 'customer.subscription.created':
  case 'customer.subscription.updated':
  case 'customer.subscription.deleted':
  case 'invoice.paid':
  case 'invoice.payment_failed':
}
```

File: `supabase/functions/create-checkout-session/index.ts`
```ts
const stripe = getStripeClient();
...
const session = await stripe.checkout.sessions.create(checkoutParams);
```

File: `supabase/functions/create-billing-portal/index.ts`
```ts
const portalSession = await stripe.billingPortal.sessions.create({
  customer: user.stripe_customer_id,
  return_url: `${returnUrl}/account`,
});
```

File: `supabase/functions/update-subscription/index.ts`
```ts
const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
...
updatedSubscription = await stripe.subscriptions.update(
  subscription.stripe_subscription_id,
  updateParams
);
```

File: `supabase/functions/charge-extra-emails/index.ts`
```ts
const invoiceItem = await stripe.invoiceItems.create({ ... });
const invoice = await stripe.invoices.create(invoiceParams);
let finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
```

File: `supabase/functions/pay-pending-invoice/index.ts`
```ts
const stripeInvoice = await stripe.invoices.retrieve(stripe_invoice_id);
...
const checkoutSession = await stripe.checkout.sessions.create({ mode: 'payment', ... });
```

File: `supabase/functions/accept-migration-invite/index.ts`
```ts
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
...
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  subscription_data: { trial_end: trialEnd, ... },
});
```

File: `supabase/functions/sync-stripe-customer/index.ts`
```ts
const customer = await stripe.customers.retrieve(customer_id);
const subscriptions = await stripe.subscriptions.list({ customer: customer_id });
```

File: `supabase/functions/sync-coupon/index.ts`
```ts
await stripe.coupons.create(stripeCouponData);
await stripe.promotionCodes.create({ coupon: stripeCouponId, code: coupon.code.toUpperCase() });
```

File: `supabase/functions/get-financial-stats/index.ts`
```ts
const [balance, subscriptions, charges, invoices] = await Promise.all([
  stripe.balance.retrieve(),
  stripe.subscriptions.list({ limit: 50, status: 'all', expand: ['data.customer'] }),
  stripe.charges.list(chargesFilter),
  stripe.invoices.list(invoicesFilter),
]);
```

File: `supabase/functions/stripe-debug/index.ts`
```ts
const sessions = await stripe.checkout.sessions.list({ limit: 10, expand: ['data.customer', 'data.subscription'] });
const customer = await stripe.customers.retrieve(customerId);
```

File: `supabase/functions/admin-delete-client/index.ts`
```ts
await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
```

File: `supabase/functions/admin-create-client/index.ts`
```ts
// Campo para identificar que e um cliente VIP (nao tem assinatura Stripe)
stripe_customer_id: null,
```

File: `supabase/functions/admin-get-clients/index.ts`
```ts
.from('subscriptions')
.select('user_id, stripe_subscription_id, status, current_period_end')
```

File: `supabase/functions/process-emails/index.ts`
```ts
const systemEmailPatterns = [
  '@paypal.com',
  '@stripe.com',
];
```

File: `supabase/functions/process-shop-emails/index.ts`
```ts
const systemEmailPatterns = [
  '@paypal.com',
  '@stripe.com',
];
```

File: `supabase/functions/process-queue/processor.ts`
```ts
const systemEmailPatterns = [
  '@paypal.com',
  '@stripe.com',
];
```

File: `supabase/config.toml`
```toml
[functions.stripe-webhook]
verify_jwt = false
```

File: `src/pages/Register.tsx`
```ts
if (!selectedPlan.stripe_price_monthly_id) {
  setError('Este plano ainda nao esta configurado para pagamento. ...')
}
...
const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`, ...)
window.location.href = data.url
```

File: `src/pages/MigrationAccept.tsx`
```ts
const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-migration-invite`, ...)
...
window.location.href = data.url
```

File: `src/pages/Account.tsx`
```ts
const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-billing-portal`, ...)
...
const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-subscription`, ...)
```

File: `src/pages/admin/AdminPlans.tsx`
```ts
stripe_product_id: string | null
stripe_price_monthly_id: string | null
stripe_price_yearly_id: string | null
stripe_extra_email_price_id: string | null
```

File: `src/pages/admin/AdminClients.tsx`
```ts
const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-subscription`, ...)
```

File: `src/pages/admin/AdminCoupons.tsx`
```ts
const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-coupon`, ...)
```

File: `src/pages/admin/AdminFinancial.tsx`
```ts
const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-financial-stats?...`
...
<a href="https://dashboard.stripe.com">Stripe Dashboard</a>
```

File: `src/pages/admin/AdminMigration.tsx`
```tsx
<li>Na data definida, o Stripe cobra automaticamente</li>
```

File: `src/pages/ChargebackPage.tsx`
```ts
'Processador ... Exemplos: Shopify Payments, Stripe, PayPal.'
```

**2. Webhooks Stripe: eventos, efeitos no Supabase e tabelas afetadas**

Fonte: `supabase/functions/stripe-webhook/index.ts`

Evento: `checkout.session.completed`
Acoes:
- Se `metadata.type === 'extra_emails_payment'` e `metadata.purchase_id`:
  - Busca compra em `extra_email_purchases` (nota: o nome da tabela no banco e `email_extra_purchases`).
  - Chama RPC `confirm_extra_email_purchase(p_purchase_id, p_stripe_invoice_id=null, p_stripe_charge_id=paymentIntentId)`.
  - Isso atualiza `email_extra_purchases` (status -> completed, stripe_* ids) e ajusta `users.extra_emails_purchased` e `users.pending_extra_emails`.
  - Chama `process-pending-credits` para reprocessar mensagens pendentes.
- Se for checkout de assinatura:
  - Busca subscription no Stripe para obter `priceId` e periodo.
  - Cria/atualiza usuario no Auth (Admin API) e na tabela `users` com:
    - `stripe_customer_id`, `plan`, `emails_limit`, `shops_limit`, `status='active'`, `whatsapp_number`.
  - Cria/atualiza `subscriptions` com:
    - `user_id`, `plan_id`, `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`, `billing_cycle`, `current_period_start/end`, `cancel_at_period_end`.
  - Cancela assinaturas antigas do mesmo usuario (Stripe cancel + `subscriptions.status='canceled'`).
  - Se houver cupom: chama RPC `use_coupon` (insere `coupon_usages` e incrementa `coupons.usage_count`).
  - Se houver `migration_invite_id`: atualiza `migration_invites` (status=accepted, accepted_by_user_id, accepted_at).
  - Atualiza metadata do customer no Stripe com `user_id`.

Evento: `customer.subscription.created` e `customer.subscription.updated`
Acoes:
- Atualiza `subscriptions`:
  - `status`, `stripe_price_id`, `current_period_start/end`, `cancel_at_period_end`, `canceled_at`.
- Busca `subscriptions` para obter `user_id`.
- Se status `canceled`/`unpaid`/`past_due`:
  - Atualiza `users.status` para `inactive` (canceled/unpaid) ou `suspended` (past_due).
  - Para canceled/unpaid, tambem zera plano (`plan='free'`, `emails_limit=0`, `shops_limit=0`).
- Para status ativo/trial:
  - Busca `plans` por `stripe_price_monthly_id` ou `stripe_price_yearly_id`.
  - Atualiza `subscriptions.plan_id` e `users.plan`, `emails_limit`, `shops_limit`.
  - Reseta contadores: `users.emails_used`, `extra_emails_used`, `pending_extra_emails`.

Evento: `customer.subscription.deleted`
Acoes:
- `subscriptions.status='canceled'`, `canceled_at=now()`.
- `users.status='inactive'`, `plan='free'`, `emails_limit=0`, `shops_limit=0`.

Evento: `invoice.paid`
Acoes:
- Atualiza `subscriptions.status='active'` e sincroniza `current_period_start/end` com Stripe.
- Atualiza `users`: `emails_used=0`, `status='active'`.
- Chama `process-pending-credits`.

Evento: `invoice.payment_failed`
Acoes:
- Atualiza `subscriptions.status='past_due'`.
- Atualiza `users.status='suspended'`.

**3. Tabelas do Supabase afetadas pelo billing (schema completo conhecido)**

Observacao: o repositorio nao contem o CREATE TABLE original de `users`. Abaixo segue o schema completo das tabelas criadas nas migrations + todas as colunas de `users` relacionadas a billing que sao adicionadas em migrations. Campos basicos de `users` (id, email, name, plan, emails_limit, emails_used, shops_limit, created_at, updated_at) aparecem no codigo, mas nao estao definidos nas migrations presentes.

Tabela: `plans` (definida em `supabase/migrations/004_admin_panel_schema.sql`, alterada em `005_email_extras_billing.sql`, `013_allow_null_plan_limits.sql`)
Colunas:
- `id` UUID PK
- `name` TEXT
- `description` TEXT
- `price_monthly` DECIMAL(10,2)
- `price_yearly` DECIMAL(10,2)
- `emails_limit` INTEGER (NULL = ilimitado)
- `shops_limit` INTEGER (NULL = ilimitado)
- `features` JSONB
- `stripe_product_id` TEXT
- `stripe_price_monthly_id` TEXT
- `stripe_price_yearly_id` TEXT
- `extra_email_price` DECIMAL(10,2)
- `extra_email_package_size` INTEGER
- `stripe_extra_email_price_id` TEXT
- `is_active` BOOLEAN
- `is_popular` BOOLEAN
- `sort_order` INTEGER
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ
FKs: nenhuma

Tabela: `subscriptions` (definida em `supabase/migrations/004_admin_panel_schema.sql`)
Colunas:
- `id` UUID PK
- `user_id` UUID FK -> users(id) ON DELETE CASCADE
- `plan_id` UUID FK -> plans(id) ON DELETE SET NULL
- `stripe_customer_id` TEXT
- `stripe_subscription_id` TEXT UNIQUE
- `stripe_price_id` TEXT
- `status` TEXT CHECK (active, past_due, canceled, unpaid, trialing, incomplete)
- `billing_cycle` TEXT CHECK (monthly, yearly)
- `current_period_start` TIMESTAMPTZ
- `current_period_end` TIMESTAMPTZ
- `cancel_at_period_end` BOOLEAN
- `canceled_at` TIMESTAMPTZ
- `coupon_id` UUID FK -> coupons(id) ON DELETE SET NULL
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

Tabela: `coupons` (definida em `supabase/migrations/004_admin_panel_schema.sql`)
Colunas:
- `id` UUID PK
- `code` TEXT UNIQUE
- `description` TEXT
- `discount_type` TEXT CHECK (percentage, fixed_amount)
- `discount_value` DECIMAL(10,2)
- `min_purchase_amount` DECIMAL(10,2)
- `max_discount_amount` DECIMAL(10,2)
- `usage_limit` INTEGER
- `usage_count` INTEGER
- `usage_limit_per_user` INTEGER
- `valid_from` TIMESTAMPTZ
- `valid_until` TIMESTAMPTZ
- `applicable_plan_ids` UUID[]
- `stripe_coupon_id` TEXT
- `is_active` BOOLEAN
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

Tabela: `coupon_usages` (definida em `supabase/migrations/004_admin_panel_schema.sql`)
Colunas:
- `id` UUID PK
- `coupon_id` UUID FK -> coupons(id) ON DELETE CASCADE
- `user_id` UUID FK -> users(id) ON DELETE CASCADE
- `discount_applied` DECIMAL(10,2)
- `subscription_id` TEXT (Stripe subscription ID)
- `created_at` TIMESTAMPTZ

Tabela: `email_extra_purchases` (definida em `supabase/migrations/005_email_extras_billing.sql`)
Colunas:
- `id` UUID PK
- `user_id` UUID FK -> users(id) ON DELETE CASCADE
- `plan_id` UUID FK -> plans(id) ON DELETE SET NULL
- `package_size` INTEGER
- `price_per_email` DECIMAL(10,2)
- `total_amount` DECIMAL(10,2)
- `stripe_payment_intent_id` TEXT
- `stripe_invoice_id` TEXT
- `stripe_charge_id` TEXT
- `status` TEXT CHECK (pending, processing, completed, failed, refunded)
- `triggered_at_usage` INTEGER
- `error_message` TEXT
- `created_at` TIMESTAMPTZ
- `completed_at` TIMESTAMPTZ

Tabela: `migration_invites` (definida em `supabase/migrations/008_migration_invites.sql`)
Colunas:
- `id` UUID PK
- `code` TEXT UNIQUE
- `customer_email` TEXT
- `customer_name` TEXT
- `plan_id` UUID FK -> plans(id)
- `shops_limit` INTEGER
- `billing_start_date` TIMESTAMPTZ
- `status` TEXT CHECK (pending, accepted, expired, cancelled)
- `created_by_admin_id` UUID FK -> admins(id)
- `accepted_by_user_id` UUID FK -> users(id)
- `accepted_at` TIMESTAMPTZ
- `expires_at` TIMESTAMPTZ
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

Tabela: `users` (apenas colunas relacionadas a billing adicionadas em migrations)
- `stripe_customer_id` TEXT
- `status` TEXT CHECK (active, inactive, suspended)
- `last_login_at` TIMESTAMPTZ
- `extra_emails_purchased` INTEGER
- `extra_emails_used` INTEGER
- `pending_extra_emails` INTEGER
- `last_credits_warning_at` TIMESTAMPTZ
- `credits_warning_count` INTEGER
- `whatsapp_number` TEXT
- Comentarios em `012_unlimited_plans.sql` indicam que `emails_limit` e `shops_limit` podem ser NULL (ilimitado).

**4. Fluxo completo de checkout (clique em "Selecionar" ate ativacao)**

1) Pagina de planos (`src/pages/Register.tsx`)
- Usuario escolhe um plano. Se o plano nao tem `stripe_price_monthly_id` ou `price_monthly=0`, trata como Enterprise e abre WhatsApp.
- Para planos com Stripe, `handleSubmit` chama a Edge Function `create-checkout-session`.

2) Edge Function `create-checkout-session`
- Busca o plano em `plans` e escolhe `stripe_price_monthly_id` ou `stripe_price_yearly_id`.
- Cria ou reutiliza o customer no Stripe.
- Cria `checkout.session` (Stripe Checkout Hosted) com `mode='subscription'`, metadata do plano e limites.
- Retorna `session.url`.

3) Redirecionamento para o Stripe Checkout
- Front-end salva `pending_registration` no localStorage.
- Navega para `session.url` (pagina segura do Stripe).

4) Stripe processa pagamento
- Stripe dispara webhook `checkout.session.completed`.

5) Edge Function `stripe-webhook`
- Cria/atualiza usuario no Auth (Admin API) e na tabela `users`.
- Cria/atualiza registro em `subscriptions`.
- Atualiza `stripe_customer_id`, limites e status do usuario.
- Cancela assinaturas antigas do mesmo usuario (se existir).
- Aplica cupom (RPC `use_coupon`) e marca convite de migracao (se houver).
- Atualiza metadata do customer no Stripe.

6) Pagina de sucesso (`/checkout/success`)
- Exibe mensagem de sucesso e instrui o usuario a definir senha (email de reset enviado pelo webhook).

Variacao: Migracao V1 (`src/pages/MigrationAccept.tsx` + `supabase/functions/accept-migration-invite`)
- Valida convite e cria checkout com `trial_end` igual a `billing_start_date`.
- O resto do fluxo eh identico (webhook cria usuario/assinatura).

**5. Planos (Starter, Business, Scale, High Scale, Enterprise)**

- Os planos sao configurados no banco (tabela `plans`), nao hardcoded no front-end.
- O admin edita via `src/pages/admin/AdminPlans.tsx`.
- IDs do Stripe ficam em:
  - `plans.stripe_price_monthly_id`
  - `plans.stripe_price_yearly_id`
  - `plans.stripe_extra_email_price_id`
- Limites de cada plano ficam em `plans.emails_limit` e `plans.shops_limit` (NULL = ilimitado).
- O checkout envia esses limites em `metadata` e o webhook atualiza `users.emails_limit` e `users.shops_limit`.
- Na UI, um plano e tratado como "Enterprise" se `stripe_price_monthly_id` estiver vazio OU `price_monthly` for 0, e entao abre WhatsApp.

**6. Logica de upgrade/downgrade/cancelamento**

Upgrade/Downgrade:
- Implementado em `supabase/functions/update-subscription/index.ts`.
- Chamada por `src/pages/Account.tsx` e `src/pages/admin/AdminClients.tsx`.
- Regras principais:
  - Upgrade (plano mais caro): cobra imediatamente e reinicia o ciclo (`billing_cycle_anchor: 'now'`).
  - Downgrade (mais barato): aplica novo preco somente na proxima fatura (sem proration).
  - Se nao houver metodo de pagamento, cria checkout `mode='setup'` para adicionar cartao.
  - Se pagamento falhar, retorna URL de invoice ou checkout para pagamento manual.
- Supabase:
  - Atualiza `subscriptions` (plan_id, stripe_price_id, billing_cycle, status).
  - Atualiza `users` (plan, limits) e zera contadores (`emails_used`, `extra_emails_used`, `pending_extra_emails`).

Cancelamento:
- Nao ha endpoint dedicado de cancelamento pelo app (o usuario abre WhatsApp pelo `Account.tsx`).
- Cancelamentos reais ocorrem via Stripe (Customer Portal) ou admin.
- `stripe-webhook` trata `customer.subscription.deleted` e tambem status `canceled/unpaid/past_due` em `customer.subscription.updated`.
- `admin-delete-client` cancela no Stripe e remove dados locais.

**7. Checkout: Stripe Checkout hosted vs Elements**

- A integracao utiliza **Stripe Checkout hosted** (nao Stripe Elements).
- Evidencias:
  - `create-checkout-session` chama `stripe.checkout.sessions.create({... mode: 'subscription' ...})`.
  - Front-end redireciona para `session.url`.
  - Pagamento de extras usa `mode: 'payment'`.
  - Upgrade sem cartao usa `mode: 'setup'`.

**8. Variaveis de ambiente relacionadas a Stripe**

Encontradas no codigo:
- `STRIPE_SECRET_KEY` (obrigatoria) – usada em `_shared/stripe.ts`, `update-subscription`, `accept-migration-invite`, `admin-delete-client`.
- `STRIPE_WEBHOOK_SECRET` – usada em `stripe-webhook` para validar assinatura.
- `APP_URL` – usada em `create-billing-portal` (return_url).
- `FRONTEND_URL` – usada em `pay-pending-invoice` (success/cancel URLs).
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` – usadas para operacoes admin que acompanham o billing.
- Front-end usa `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para chamar Edge Functions.

Arquivos de ambiente no repo:
- `.env.example` contem apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- `vercel.json` nao declara env vars.

**9. API Routes / Edge Functions que interagem com Stripe (codigo completo)**

O codigo completo das Edge Functions e modulos Stripe esta logo abaixo nesta secao.

File: `supabase/functions/_shared/stripe.ts`
```ts
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

```

File: `supabase/functions/stripe-webhook/index.ts`
```ts
/**
 * Edge Function: Stripe Webhook
 *
 * Processa eventos do Stripe como:
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.paid
 * - invoice.payment_failed
 *
 * Compatível com Deno v2.x (Supabase Edge Runtime 1.70+)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getStripeClient, verifyWebhookSignature, Stripe } from '../_shared/stripe.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
import { maskEmail } from '../_shared/email.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * Helper: extrai current_period_start/end da subscription.
 * Na API Stripe 2025-12-15.clover, esses campos foram movidos para items.data[].
 */
function getSubscriptionPeriod(subscription: Stripe.Subscription): { start: number; end: number } {
  const item = subscription.items?.data?.[0];
  const start = (subscription as any).current_period_start ?? item?.current_period_start ?? item?.period?.start;
  const end = (subscription as any).current_period_end ?? item?.current_period_end ?? item?.period?.end;
  return { start, end };
}

function safeTimestampToISO(timestamp: number | null | undefined): string | null {
  if (!timestamp || typeof timestamp !== 'number' || timestamp <= 0) return null;
  const date = new Date(timestamp * 1000);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Obtém o cliente Supabase com service role key para operações admin
 */
function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  console.log('=== WEBHOOK STRIPE CHAMADO ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Endpoint de teste para verificar se o webhook está acessível
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('session_id');

    // Se tiver session_id, reprocessar manualmente (para debug)
    if (sessionId) {
      try {
        console.log('=== REPROCESSANDO SESSÃO MANUALMENTE ===');
        console.log('Session ID:', sessionId);

        const stripe = getStripeClient();
        const supabase = getSupabaseClient();

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        console.log('Session status:', session.status);
        console.log('Payment status:', session.payment_status);

        if (session.status === 'complete' && session.payment_status === 'paid') {
          await handleCheckoutCompleted(session as Stripe.Checkout.Session, supabase, stripe);
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Sessão reprocessada com sucesso',
              session_id: sessionId,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'Sessão não está completa ou não foi paga',
              status: session.status,
              payment_status: session.payment_status,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (error) {
        console.error('Erro ao reprocessar sessão:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        status: 'ok',
        message: 'Webhook endpoint ativo',
        timestamp: new Date().toISOString(),
        hasSecret: !!Deno.env.get('STRIPE_WEBHOOK_SECRET'),
        usage: 'Adicione ?session_id=cs_xxx para reprocessar uma sessão manualmente',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    console.log('Webhook Secret configurado:', !!webhookSecret);

    if (!webhookSecret) {
      console.error('ERRO: STRIPE_WEBHOOK_SECRET não configurado!');
      throw new Error('STRIPE_WEBHOOK_SECRET não configurado');
    }

    const signature = req.headers.get('stripe-signature');
    console.log('Stripe Signature presente:', !!signature);

    if (!signature) {
      console.error('ERRO: stripe-signature header ausente');
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.text();
    console.log('Body recebido (primeiros 200 chars):', body.substring(0, 200));

    const event = await verifyWebhookSignature(body, signature, webhookSecret);

    console.log('=== Webhook verificado com sucesso ===');
    console.log(`Evento recebido: ${event.type}`);

    const supabase = getSupabaseClient();
    const stripe = getStripeClient();

    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, supabase, stripe);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription, supabase);
        break;
      }

      case 'customer.subscription.deleted': {
        await handleSubscriptionCanceled(event.data.object as Stripe.Subscription, supabase);
        break;
      }

      case 'invoice.paid': {
        await handleInvoicePaid(event.data.object as Stripe.Invoice, supabase);
        break;
      }

      case 'invoice.payment_failed': {
        await handlePaymentFailed(event.data.object as Stripe.Invoice, supabase);
        break;
      }

      default:
        console.log(`Evento não tratado: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Checkout completado - criar/atualizar usuário e assinatura
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  supabase: ReturnType<typeof getSupabaseClient>,
  stripe: Stripe
) {
  console.log('=== Processando checkout.session.completed ===');
  console.log('Session ID:', session.id);
  console.log('Customer ID:', session.customer);
  console.log('Subscription ID:', session.subscription);
  console.log('Customer Email:', maskEmail(session.customer_email));
  console.log('Customer Details:', JSON.stringify(session.customer_details));
  console.log('Metadata:', JSON.stringify(session.metadata));

  const metadata = session.metadata || {};
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  // Verificar se é pagamento de emails extras
  if (metadata.type === 'extra_emails_payment' && metadata.purchase_id) {
    console.log('=== Processando pagamento de emails extras ===');
    const purchaseId = metadata.purchase_id;
    const paymentIntentId = session.payment_intent as string;

    // Buscar user_id da compra antes de confirmar
    const { data: purchase } = await supabase
      .from('extra_email_purchases')
      .select('user_id')
      .eq('id', purchaseId)
      .single();

    // Confirmar a compra no banco
    const { error: confirmError } = await supabase.rpc('confirm_extra_email_purchase', {
      p_purchase_id: purchaseId,
      p_stripe_invoice_id: null,
      p_stripe_charge_id: paymentIntentId,
    });

    if (confirmError) {
      console.error('Erro ao confirmar compra de emails extras:', confirmError);
      throw new Error(`Erro ao confirmar compra: ${confirmError.message}`);
    }

    console.log('Compra de emails extras confirmada:', purchaseId);

    // Reprocessar mensagens pendentes de créditos para este usuário
    if (purchase?.user_id) {
      await processPendingCreditsForUser(purchase.user_id);
    }

    return;
  }

  if (!subscriptionId) {
    console.error('ERRO: subscriptionId não encontrado na sessão');
    throw new Error('Subscription ID não encontrado');
  }

  // Buscar subscription para obter detalhes
  console.log('Buscando subscription no Stripe:', subscriptionId);
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  console.log('Price ID:', priceId);

  // Verificar se é novo usuário ou upgrade
  let userId = metadata.user_id;
  console.log('User ID dos metadados:', userId);

  if (!userId || userId === 'pending') {
    // Novo usuário - criar conta
    const email = metadata.user_email || session.customer_email;
    const name = metadata.user_name || session.customer_details?.name;

    console.log('Criando novo usuário - Email:', maskEmail(email), 'Nome:', name);

    if (!email) {
      console.error('ERRO: Email do usuário não encontrado');
      throw new Error('Email do usuário não encontrado');
    }

    // Verificar se usuário já existe
    console.log('Verificando se usuário já existe no banco...');
    const { data: existingUser, error: existingError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    console.log('Resultado busca usuário existente:', { existingUser, error: existingError?.message });

    if (existingUser) {
      userId = existingUser.id;
      console.log('Usuário já existe, usando ID:', userId);

      // Se é fluxo de migração, enviar email de reset de senha mesmo para usuário existente
      if (metadata.migration_invite_id) {
        const supabaseAdmin = getSupabaseAdminClient();
        try {
          console.log('Enviando email de reset de senha para usuário existente (migração):', maskEmail(email));
          const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
            redirectTo: 'https://app.replyna.me/reset-password',
          });
          if (resetError) {
            console.error('Erro ao enviar email de reset:', resetError);
          } else {
            console.log('Email de definição de senha enviado com sucesso para:', maskEmail(email));
          }
        } catch (resetErr) {
          console.error('Exceção ao enviar email de reset:', resetErr);
        }
      }
    } else {
      // Usuário não existe no banco - vamos criar usando Admin API
      console.log('Usuário não existe, criando via Admin API...');
      const supabaseAdmin = getSupabaseAdminClient();

      // Verificar se usuário já existe no Auth
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingAuthUser = authUsers?.users.find(u =>
        u.email?.toLowerCase() === email.toLowerCase()
      );

      let newUserId: string;

      if (existingAuthUser) {
        console.log('Usuário já existe no Auth:', existingAuthUser.id);
        newUserId = existingAuthUser.id;
      } else {
        // Criar usuário no Auth com senha temporária
        const tempPassword = crypto.randomUUID().slice(0, 12) + 'Aa1!';
        const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { name: name || '' },
        });

        if (authError) {
          console.error('ERRO ao criar usuário no Auth:', authError);
          throw new Error(`Erro ao criar usuário no Auth: ${authError.message}`);
        }

        newUserId = newAuthUser.user.id;
        console.log('Usuário criado no Auth:', newUserId);
      }

      // Enviar email de reset de senha para o usuário definir sua senha
      // Envia sempre (seja usuário novo ou existente no Auth)
      try {
        console.log('Enviando email de reset de senha para:', maskEmail(email));
        const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
          redirectTo: 'https://app.replyna.me/reset-password',
        });
        if (resetError) {
          console.error('Erro ao enviar email de reset:', resetError);
        } else {
          console.log('Email de definição de senha enviado com sucesso para:', maskEmail(email));
        }
      } catch (resetErr) {
        console.error('Exceção ao enviar email de reset:', resetErr);
      }

      // Agora criar na tabela users
      // Parsear limites: 'unlimited' = null, número = valor numérico
      const parseLimit = (value: string | undefined, defaultValue: number): number | null => {
        if (!value || value === 'unlimited') return null;
        const parsed = parseInt(value);
        return isNaN(parsed) ? defaultValue : parsed;
      };

      const userData = {
        id: newUserId,
        email: email.toLowerCase(),
        name: name || null,
        plan: metadata.plan_name?.toLowerCase() || 'starter',
        emails_limit: parseLimit(metadata.emails_limit, 500),
        shops_limit: parseLimit(metadata.shops_limit, 1),
        emails_used: 0,
        stripe_customer_id: customerId,
        status: 'active',
        whatsapp_number: metadata.whatsapp_number || null,
      };
      console.log('Dados do usuário:', JSON.stringify(userData));

      const { error: createError } = await supabaseAdmin
        .from('users')
        .insert(userData);

      if (createError) {
        console.error('ERRO ao criar usuário na tabela users:', createError);
        throw new Error(`Erro ao criar usuário: ${createError.message}`);
      }

      userId = newUserId;
      console.log('Novo usuário criado com sucesso! ID:', userId);
    }
  }

  // Atualizar usuário com stripe_customer_id e plano
  // Parsear limites: 'unlimited' = null, número = valor numérico
  const parseLimitForUpdate = (value: string | undefined, defaultValue: number): number | null => {
    if (!value || value === 'unlimited') return null;
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  await supabase
    .from('users')
    .update({
      stripe_customer_id: customerId,
      plan: metadata.plan_name?.toLowerCase() || 'starter',
      emails_limit: parseLimitForUpdate(metadata.emails_limit, 500),
      shops_limit: parseLimitForUpdate(metadata.shops_limit, 1),
      status: 'active',
    })
    .eq('id', userId);

  // Criar/atualizar registro de assinatura
  const subscriptionData = {
    user_id: userId,
    plan_id: metadata.plan_id || null,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: priceId,
    status: 'active',
    billing_cycle: priceId?.includes('year') ? 'yearly' : 'monthly',
    current_period_start: safeTimestampToISO(getSubscriptionPeriod(subscription).start) || new Date().toISOString(),
    current_period_end: safeTimestampToISO(getSubscriptionPeriod(subscription).end) || new Date().toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
  };

  // Verificar se já existe assinatura com esse stripe_subscription_id
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (existingSub) {
    await supabase
      .from('subscriptions')
      .update(subscriptionData)
      .eq('id', existingSub.id);
  } else {
    // Antes de inserir, cancelar outras assinaturas ativas do mesmo usuário
    // para evitar duplicatas (ex: usuário fez checkout 2x)
    const { data: oldSubs } = await supabase
      .from('subscriptions')
      .select('id, stripe_subscription_id')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing', 'past_due'])
      .neq('stripe_subscription_id', subscriptionId);

    if (oldSubs && oldSubs.length > 0) {
      console.log(`Cancelando ${oldSubs.length} assinatura(s) antiga(s) do usuário ${userId}`);
      for (const oldSub of oldSubs) {
        // Cancelar no Stripe
        try {
          await stripe.subscriptions.cancel(oldSub.stripe_subscription_id);
          console.log('Subscription cancelada no Stripe:', oldSub.stripe_subscription_id);
        } catch (cancelErr) {
          console.error('Erro ao cancelar subscription antiga no Stripe:', cancelErr);
        }
        // Marcar como cancelada no banco
        await supabase
          .from('subscriptions')
          .update({ status: 'canceled', canceled_at: new Date().toISOString() })
          .eq('id', oldSub.id);
      }
    }

    await supabase
      .from('subscriptions')
      .insert(subscriptionData);
  }

  // Registrar uso de cupom se aplicável
  if (metadata.coupon_id) {
    console.log('Registrando uso de cupom:', metadata.coupon_id);
    await supabase.rpc('use_coupon', {
      p_coupon_id: metadata.coupon_id,
      p_user_id: userId,
      p_discount_applied: 0, // TODO: calcular desconto
      p_subscription_id: subscriptionId,
    });
  }

  // Marcar convite de migração como aceito se aplicável
  if (metadata.migration_invite_id) {
    console.log('Marcando convite de migração como aceito:', metadata.migration_invite_id);

    // Primeiro, verificar o status atual do convite
    const { data: currentInvite, error: checkError } = await supabase
      .from('migration_invites')
      .select('id, status, code')
      .eq('id', metadata.migration_invite_id)
      .single();

    if (checkError) {
      console.error('Erro ao buscar convite de migração:', checkError);
    } else if (!currentInvite) {
      console.error('Convite de migração não encontrado com ID:', metadata.migration_invite_id);
    } else {
      console.log('Status atual do convite:', currentInvite.status, '- Código:', currentInvite.code);

      // Atualizar independente do status atual (exceto se já estiver 'accepted')
      if (currentInvite.status !== 'accepted') {
        const { error: inviteError, count } = await supabase
          .from('migration_invites')
          .update({
            status: 'accepted',
            accepted_by_user_id: userId,
            accepted_at: new Date().toISOString(),
          })
          .eq('id', metadata.migration_invite_id);

        if (inviteError) {
          console.error('Erro ao atualizar convite de migração:', inviteError);
        } else {
          console.log('Convite de migração atualizado. Linhas afetadas:', count);
        }
      } else {
        console.log('Convite já estava marcado como aceito');
      }
    }
  }

  // Atualizar metadata do customer no Stripe com user_id correto
  console.log('Atualizando metadata do customer no Stripe com user_id:', userId);
  await stripe.customers.update(customerId, {
    metadata: { user_id: userId },
  });

  console.log('=== Checkout processado com SUCESSO para usuário:', userId, '===');
}

/**
 * Assinatura atualizada - sincronizar status
 */
async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription,
  supabase: ReturnType<typeof getSupabaseClient>
) {
  console.log('Processando subscription update:', subscription.id);

  const status = mapStripeStatus(subscription.status);
  const priceId = subscription.items.data[0]?.price.id;

  const period = getSubscriptionPeriod(subscription);

  // Atualizar assinatura
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status,
      stripe_price_id: priceId,
      current_period_start: safeTimestampToISO(period.start) || new Date().toISOString(),
      current_period_end: safeTimestampToISO(period.end) || new Date().toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: safeTimestampToISO(subscription.canceled_at as number | null),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Erro ao atualizar assinatura:', error);
  }

  // Buscar subscription e usuário associado
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id, plan_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!sub?.user_id) {
    console.log('Subscription não encontrada no banco:', subscription.id);
    return;
  }

  // Se cancelado, unpaid ou past_due, atualizar status do usuário
  if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
    const userStatus = status === 'canceled' ? 'inactive' : 'suspended';
    const updateData: Record<string, any> = { status: userStatus };

    // Apenas resetar plano para canceled/unpaid (past_due mantém o plano para quando pagar)
    if (status === 'canceled' || status === 'unpaid') {
      updateData.plan = 'free';
      updateData.emails_limit = 0;
      updateData.shops_limit = 0;
    }

    await supabase
      .from('users')
      .update(updateData)
      .eq('id', sub.user_id);
    console.log(`Usuário ${sub.user_id} atualizado para status '${userStatus}' devido a subscription status: ${status}`);
    return;
  }

  // Se past_due, suspender usuário mas manter plano (redundância com handlePaymentFailed)
  if (status === 'past_due') {
    await supabase
      .from('users')
      .update({ status: 'suspended' })
      .eq('id', sub.user_id);
    console.log('Usuário suspenso devido a subscription past_due:', sub.user_id);
    return;
  }

  // Para outros status (active, trialing, etc), sincronizar plano baseado no price_id
  if (priceId) {
    // Buscar plano pelo stripe_price_id (mensal ou anual)
    const { data: plan } = await supabase
      .from('plans')
      .select('id, name, emails_limit, shops_limit')
      .or(`stripe_price_monthly_id.eq.${priceId},stripe_price_yearly_id.eq.${priceId}`)
      .single();

    if (plan) {
      // Atualizar subscription com o plan_id correto
      await supabase
        .from('subscriptions')
        .update({ plan_id: plan.id })
        .eq('stripe_subscription_id', subscription.id);

      // Atualizar usuário com os dados do novo plano
      // Quando faz upgrade, zera os contadores de emails usados (novo ciclo de billing)
      const { error: userError } = await supabase
        .from('users')
        .update({
          plan: plan.name,
          emails_limit: plan.emails_limit,
          shops_limit: plan.shops_limit,
          emails_used: 0,
          extra_emails_used: 0,
          pending_extra_emails: 0,
        })
        .eq('id', sub.user_id);

      if (userError) {
        console.error('Erro ao atualizar usuário com novo plano:', userError);
      } else {
        console.log(`Usuário ${sub.user_id} atualizado para plano: ${plan.name}`);
      }
    } else {
      console.log('Plano não encontrado para price_id:', priceId);
    }
  }
}

/**
 * Assinatura cancelada
 */
async function handleSubscriptionCanceled(
  subscription: Stripe.Subscription,
  supabase: ReturnType<typeof getSupabaseClient>
) {
  console.log('Processando subscription canceled:', subscription.id);

  // Atualizar assinatura
  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  // Atualizar usuário
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (sub?.user_id) {
    await supabase
      .from('users')
      .update({
        status: 'inactive',
        plan: 'free',
        emails_limit: 0,
        shops_limit: 0,
      })
      .eq('id', sub.user_id);
  }
}

/**
 * Fatura paga - renovação de assinatura ou pagamento atrasado regularizado
 */
async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  supabase: ReturnType<typeof getSupabaseClient>
) {
  console.log('Processando invoice.paid:', invoice.id);

  if (!invoice.subscription) return;

  const subscriptionId = invoice.subscription as string;

  // Buscar subscription atualizada do Stripe para obter as datas corretas
  const stripe = getStripeClient();
  let stripeSubscription: Stripe.Subscription | null = null;

  try {
    stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    console.log('Subscription do Stripe:', {
      id: stripeSubscription.id,
      status: stripeSubscription.status,
      current_period_start: stripeSubscription.current_period_start,
      current_period_end: stripeSubscription.current_period_end,
    });
  } catch (stripeError) {
    console.error('Erro ao buscar subscription do Stripe:', stripeError);
  }

  // Preparar dados de atualização da subscription
  const subscriptionUpdate: Record<string, any> = {
    status: 'active',
    updated_at: new Date().toISOString(),
  };

  // Se conseguimos buscar a subscription do Stripe, sincronizar as datas do período
  if (stripeSubscription) {
    const period = getSubscriptionPeriod(stripeSubscription);
    subscriptionUpdate.current_period_start = safeTimestampToISO(period.start) || new Date().toISOString();
    subscriptionUpdate.current_period_end = safeTimestampToISO(period.end) || new Date().toISOString();
    console.log('Sincronizando datas do período:', {
      current_period_start: subscriptionUpdate.current_period_start,
      current_period_end: subscriptionUpdate.current_period_end,
    });
  }

  // Atualizar subscription no banco
  const { error: subError } = await supabase
    .from('subscriptions')
    .update(subscriptionUpdate)
    .eq('stripe_subscription_id', subscriptionId);

  if (subError) {
    console.error('Erro ao atualizar subscription:', subError);
  }

  // Buscar assinatura
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id, plan_id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!sub) return;

  // SEMPRE reativar o usuário quando pagamento é realizado
  console.log('Reativando usuário após pagamento:', sub.user_id);

  // Resetar emails_used no início do novo período e reativar conta
  await supabase
    .from('users')
    .update({
      emails_used: 0,
      status: 'active',
    })
    .eq('id', sub.user_id);

  console.log('Usuário reativado e créditos resetados:', sub.user_id);

  // Reprocessar mensagens pendentes para este usuário
  await processPendingCreditsForUser(sub.user_id);
}

/**
 * Pagamento falhou
 */
async function handlePaymentFailed(
  invoice: Stripe.Invoice,
  supabase: ReturnType<typeof getSupabaseClient>
) {
  console.log('Processando invoice.payment_failed:', invoice.id);

  if (!invoice.subscription) return;

  const subscriptionId = invoice.subscription as string;

  // Atualizar status da assinatura
  await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', subscriptionId);

  // Atualizar status do usuário
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (sub?.user_id) {
    await supabase
      .from('users')
      .update({ status: 'suspended' })
      .eq('id', sub.user_id);
  }
}

/**
 * Mapeia status do Stripe para status interno
 */
function mapStripeStatus(stripeStatus: string): string {
  const statusMap: Record<string, string> = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'unpaid',
    trialing: 'trialing',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
  };
  return statusMap[stripeStatus] || 'active';
}

/**
 * Reprocessa mensagens pendentes de créditos
 * Chamada automaticamente quando o usuário compra créditos extras ou renova assinatura
 */
async function processPendingCreditsForUser(userId: string): Promise<void> {
  try {
    console.log('[stripe-webhook] Chamando process-pending-credits para user:', userId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const response = await fetch(`${supabaseUrl}/functions/v1/process-pending-credits`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[stripe-webhook] Erro ao chamar process-pending-credits:', response.status, errorText);
    } else {
      const result = await response.json();
      console.log('[stripe-webhook] process-pending-credits resultado:', JSON.stringify(result));
    }
  } catch (error) {
    console.error('[stripe-webhook] Exceção ao chamar process-pending-credits:', error);
    // Não lançamos erro aqui para não interromper o fluxo do webhook
  }
}

```

File: `supabase/functions/create-checkout-session/index.ts`
```ts
/**
 * Edge Function: Create Checkout Session
 *
 * Cria uma sessão de checkout do Stripe para novos usuários
 * ou upgrades de plano.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { isValidEmail } from '../_shared/validation.ts';

interface CreateCheckoutRequest {
  plan_id: string;
  user_email: string;
  user_name?: string;
  user_id?: string; // Se já existe (upgrade)
  whatsapp_number?: string;
  billing_cycle?: 'monthly' | 'yearly';
  coupon_code?: string;
  success_url: string;
  cancel_url: string;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = getStripeClient();
    const supabase = getSupabaseClient();

    const body: CreateCheckoutRequest = await req.json();
    const {
      plan_id,
      user_email,
      user_name,
      user_id,
      whatsapp_number,
      billing_cycle = 'monthly',
      coupon_code,
      success_url,
      cancel_url,
    } = body;

    // Validar campos obrigatórios
    if (!plan_id || !user_email || !success_url || !cancel_url) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: plan_id, user_email, success_url, cancel_url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar formato do email
    if (!isValidEmail(user_email)) {
      return new Response(
        JSON.stringify({ error: 'Email inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        JSON.stringify({ error: 'Plano não encontrado ou inativo' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determinar o price_id do Stripe baseado no ciclo de cobrança
    const stripePriceId = billing_cycle === 'yearly'
      ? plan.stripe_price_yearly_id
      : plan.stripe_price_monthly_id;

    if (!stripePriceId) {
      return new Response(
        JSON.stringify({ error: 'Plano não configurado no Stripe. Configure os IDs de preço no painel admin.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar/criar cliente Stripe
    let stripeCustomerId: string | undefined;

    if (user_id) {
      // Usuário existente - buscar stripe_customer_id
      const { data: existingUser } = await supabase
        .from('users')
        .select('stripe_customer_id')
        .eq('id', user_id)
        .single();

      stripeCustomerId = existingUser?.stripe_customer_id || undefined;

      // Verificar se já tem assinatura ativa - se sim, deve usar update-subscription
      const { data: existingSubs } = await supabase
        .from('subscriptions')
        .select('id, status, stripe_subscription_id')
        .eq('user_id', user_id)
        .in('status', ['active', 'trialing', 'past_due'])
        .limit(1);

      if (existingSubs && existingSubs.length > 0) {
        console.log('Usuário já tem assinatura ativa:', existingSubs[0].stripe_subscription_id);
        return new Response(
          JSON.stringify({
            error: 'Você já possui uma assinatura ativa. Use a opção de alterar plano na sua conta.',
            has_active_subscription: true,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Se não tem customer, criar um
    if (!stripeCustomerId) {
      // Verificar se já existe customer com esse email
      const existingCustomers = await stripe.customers.list({
        email: user_email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        stripeCustomerId = existingCustomers.data[0].id;
      } else {
        // Criar novo customer
        const newCustomer = await stripe.customers.create({
          email: user_email,
          name: user_name,
          metadata: {
            user_id: user_id || 'pending',
          },
        });
        stripeCustomerId = newCustomer.id;
      }
    }

    // Preparar parâmetros do checkout
    const checkoutParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${success_url}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url,
      subscription_data: {
        metadata: {
          plan_id: plan_id,
          plan_name: plan.name,
          user_id: user_id || 'pending',
        },
      },
      metadata: {
        plan_id: plan_id,
        plan_name: plan.name,
        user_email: user_email,
        user_name: user_name || '',
        user_id: user_id || 'pending',
        whatsapp_number: whatsapp_number || '',
        emails_limit: plan.emails_limit?.toString() ?? 'unlimited',
        shops_limit: plan.shops_limit?.toString() ?? 'unlimited',
      },
      allow_promotion_codes: true, // Permite cupons do Stripe
      billing_address_collection: 'auto',
      locale: 'pt-BR',
    };

    // Aplicar cupom se fornecido
    if (coupon_code) {
      console.log('Cupom recebido:', coupon_code);

      // Validar cupom no banco
      const { data: couponValidation, error: couponError } = await supabase.rpc('validate_coupon', {
        p_code: coupon_code.toUpperCase(),
        p_user_id: user_id || '00000000-0000-0000-0000-000000000000',
        p_plan_id: plan_id,
      });

      console.log('Validação do cupom:', JSON.stringify(couponValidation));
      if (couponError) {
        console.error('Erro ao validar cupom:', couponError);
      }

      if (couponValidation && couponValidation[0]?.is_valid && couponValidation[0]?.coupon_id) {
        console.log('Cupom válido, buscando stripe_coupon_id para:', couponValidation[0].coupon_id);

        // Buscar stripe_coupon_id
        const { data: coupon, error: couponFetchError } = await supabase
          .from('coupons')
          .select('stripe_coupon_id')
          .eq('id', couponValidation[0].coupon_id)
          .single();

        console.log('Cupom do banco:', JSON.stringify(coupon));
        if (couponFetchError) {
          console.error('Erro ao buscar cupom:', couponFetchError);
        }

        if (coupon?.stripe_coupon_id) {
          console.log('Aplicando cupom Stripe:', coupon.stripe_coupon_id);
          // Stripe não permite discounts + allow_promotion_codes juntos
          delete checkoutParams.allow_promotion_codes;
          checkoutParams.discounts = [{ coupon: coupon.stripe_coupon_id }];
          checkoutParams.metadata!.coupon_id = couponValidation[0].coupon_id;
          checkoutParams.metadata!.coupon_code = coupon_code.toUpperCase();
        } else {
          console.log('Cupom não tem stripe_coupon_id configurado');
        }
      } else {
        console.log('Cupom inválido ou não encontrado');
      }
    } else {
      console.log('Nenhum cupom fornecido');
    }

    // Criar sessão de checkout
    const session = await stripe.checkout.sessions.create(checkoutParams);

    return new Response(
      JSON.stringify({
        session_id: session.id,
        url: session.url,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao criar checkout session:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

```

File: `supabase/functions/create-billing-portal/index.ts`
```ts
/**
 * Edge Function: create-billing-portal
 *
 * Cria uma sessão do Stripe Customer Portal para o cliente gerenciar:
 * - Métodos de pagamento (alterar cartão)
 * - Histórico de faturas
 * - Dados de cobrança
 */

import { getCorsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
import { getStripeClient } from '../_shared/stripe.ts';

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Buscar stripe_customer_id do usuário
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('stripe_customer_id, email')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      console.error('Erro ao buscar usuário:', userError);
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!user.stripe_customer_id) {
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
      customer: user.stripe_customer_id,
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

```

File: `supabase/functions/update-subscription/index.ts`
```ts
/**
 * Edge Function: Update Subscription
 *
 * Atualiza a subscription do Stripe para um novo plano.
 *
 * Comportamento:
 * - UPGRADE (novo plano mais caro): Cobra a diferença imediatamente
 * - DOWNGRADE (novo plano mais barato): Novo valor só na próxima fatura
 *
 * Versão standalone - não depende de arquivos externos
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@20.2.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';

/** Extrai period dates da subscription (compatível com API Stripe 2025-12-15.clover) */
function getSubscriptionPeriod(subscription: any): { start: number; end: number } {
  const item = subscription.items?.data?.[0];
  const start = subscription.current_period_start ?? item?.current_period_start ?? item?.period?.start;
  const end = subscription.current_period_end ?? item?.current_period_end ?? item?.period?.end;
  return { start, end };
}

function safeTimestampToISO(timestamp: number | null | undefined): string | null {
  if (!timestamp || typeof timestamp !== 'number' || timestamp <= 0) return null;
  const date = new Date(timestamp * 1000);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

interface UpdateSubscriptionRequest {
  user_id: string;
  new_plan_id: string;
  billing_cycle?: 'monthly' | 'yearly';
}

// Função para obter cliente Stripe
function getStripeClient(): Stripe {
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY é obrigatória');
  }
  return new Stripe(stripeSecretKey, {
    apiVersion: '2024-11-20.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

// Função para obter cliente Supabase
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = getStripeClient();
    const supabase = getSupabaseClient();

    const body: UpdateSubscriptionRequest = await req.json();
    const { user_id, new_plan_id, billing_cycle } = body;

    // Validar campos obrigatórios
    if (!user_id || !new_plan_id) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: user_id, new_plan_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar subscription atual do usuário
    // Aceitar assinaturas active, trialing ou past_due (todas são válidas para upgrade)
    // Ordenar por created_at desc e pegar a mais recente (caso haja duplicatas)
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('id, stripe_subscription_id, stripe_customer_id, plan_id, billing_cycle, status')
      .eq('user_id', user_id)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1);

    const subscription = subscriptions?.[0] || null;

    if (subError || !subscription) {
      console.error('Erro ao buscar subscription:', subError);
      return new Response(
        JSON.stringify({ error: 'Assinatura ativa não encontrada para este usuário' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscription.stripe_subscription_id) {
      return new Response(
        JSON.stringify({ error: 'Assinatura não tem vínculo com o Stripe' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar novo plano
    const { data: newPlan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', new_plan_id)
      .eq('is_active', true)
      .single();

    if (planError || !newPlan) {
      return new Response(
        JSON.stringify({ error: 'Plano não encontrado ou inativo' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar plano atual para comparar preços
    let currentPlan = null;
    if (subscription.plan_id) {
      const { data: currentPlanData } = await supabase
        .from('plans')
        .select('*')
        .eq('id', subscription.plan_id)
        .single();
      currentPlan = currentPlanData;
    }

    // Determinar o ciclo de cobrança (manter o atual ou usar o novo)
    const finalBillingCycle = billing_cycle || subscription.billing_cycle || 'monthly';

    // Determinar o price_id do Stripe baseado no ciclo de cobrança
    const newStripePriceId = finalBillingCycle === 'yearly'
      ? newPlan.stripe_price_yearly_id
      : newPlan.stripe_price_monthly_id;

    if (!newStripePriceId) {
      return new Response(
        JSON.stringify({ error: 'Plano não configurado no Stripe. Configure os IDs de preço no painel admin.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar subscription atual no Stripe para obter o item_id
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);

    if (!stripeSubscription || stripeSubscription.status === 'canceled') {
      return new Response(
        JSON.stringify({ error: 'Assinatura não encontrada ou cancelada no Stripe' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o cliente tem método de pagamento
    let customer = await stripe.customers.retrieve(subscription.stripe_customer_id) as Stripe.Customer;
    let hasPaymentMethod = customer.invoice_settings?.default_payment_method || customer.default_source;

    // Se não tem método de pagamento padrão, verificar se tem algum método de pagamento anexado
    // Isso pode acontecer após o setup session - o cartão é adicionado mas não definido como padrão
    if (!hasPaymentMethod) {
      console.log('Cliente sem método de pagamento padrão. Verificando métodos anexados...');

      // Buscar métodos de pagamento do cliente
      const paymentMethods = await stripe.paymentMethods.list({
        customer: subscription.stripe_customer_id,
        type: 'card',
      });

      console.log(`Encontrados ${paymentMethods.data.length} métodos de pagamento`);

      if (paymentMethods.data.length > 0) {
        // Usar o método mais recente
        const latestPaymentMethod = paymentMethods.data[0];
        console.log(`Definindo método ${latestPaymentMethod.id} como padrão...`);

        // Definir como método de pagamento padrão para invoices
        await stripe.customers.update(subscription.stripe_customer_id, {
          invoice_settings: {
            default_payment_method: latestPaymentMethod.id,
          },
        });

        // Também atualizar o método de pagamento padrão na subscription
        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          default_payment_method: latestPaymentMethod.id,
        });

        console.log('Método de pagamento padrão definido com sucesso');
        hasPaymentMethod = latestPaymentMethod.id;

        // Atualizar referência do customer
        customer = await stripe.customers.retrieve(subscription.stripe_customer_id) as Stripe.Customer;
      }
    }

    // Se ainda não tem método de pagamento, criar sessão de checkout para adicionar cartão
    if (!hasPaymentMethod) {
      console.log('Cliente sem método de pagamento. Criando sessão de checkout...');

      const checkoutSession = await stripe.checkout.sessions.create({
        customer: subscription.stripe_customer_id,
        mode: 'setup',
        payment_method_types: ['card'],
        success_url: `${req.headers.get('origin') || 'https://app.replyna.com.br'}/account?upgrade_pending=true&plan_id=${new_plan_id}&billing_cycle=${finalBillingCycle}`,
        cancel_url: `${req.headers.get('origin') || 'https://app.replyna.com.br'}/account?upgrade_cancelled=true`,
        metadata: {
          user_id: user_id,
          new_plan_id: new_plan_id,
          billing_cycle: finalBillingCycle,
        },
      });

      return new Response(
        JSON.stringify({
          requires_payment_method: true,
          checkout_url: checkoutSession.url,
          message: 'Você precisa adicionar um método de pagamento para fazer upgrade.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se já está no mesmo plano/preço no Stripe
    const currentItem = stripeSubscription.items.data[0];
    const alreadyOnPlanInStripe = currentItem.price.id === newStripePriceId;

    // Se já está no plano no Stripe, verificar se o banco está sincronizado
    if (alreadyOnPlanInStripe) {
      console.log('Usuário já está no plano no Stripe. Verificando sincronização do banco...');

      // Buscar dados atuais do usuário no banco
      const { data: currentUser } = await supabase
        .from('users')
        .select('plan, emails_limit, shops_limit')
        .eq('id', user_id)
        .single();

      console.log('Dados atuais do usuário no banco:', currentUser);
      console.log('Plano esperado:', newPlan.name);

      // Verificar se o banco precisa ser sincronizado
      const needsSync = !currentUser ||
        currentUser.plan?.toLowerCase() !== newPlan.name.toLowerCase() ||
        currentUser.emails_limit !== newPlan.emails_limit ||
        currentUser.shops_limit !== newPlan.shops_limit;

      if (needsSync) {
        console.log('Banco desatualizado. Sincronizando...');

        // Atualizar tabela subscriptions
        await supabase
          .from('subscriptions')
          .update({
            plan_id: new_plan_id,
            stripe_price_id: newStripePriceId,
            billing_cycle: finalBillingCycle,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);

        // Atualizar tabela users
        const { data: syncedUserData, error: syncError } = await supabase
          .from('users')
          .update({
            plan: newPlan.name,
            emails_limit: newPlan.emails_limit,
            shops_limit: newPlan.shops_limit,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user_id)
          .select();

        if (syncError) {
          console.error('Erro ao sincronizar banco:', syncError);
          return new Response(
            JSON.stringify({ error: 'Erro ao sincronizar banco de dados: ' + syncError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Banco sincronizado com sucesso:', syncedUserData);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Banco de dados sincronizado com o plano atual do Stripe.',
            synced: true,
            new_plan: {
              id: newPlan.id,
              name: newPlan.name,
              emails_limit: newPlan.emails_limit,
              shops_limit: newPlan.shops_limit,
            },
            billing_cycle: finalBillingCycle,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Banco já está sincronizado
      return new Response(
        JSON.stringify({ error: 'Você já está neste plano' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determinar se é upgrade ou downgrade baseado no preço
    // Usar o preço baseado no ciclo de cobrança atual
    const currentPlanPrice = finalBillingCycle === 'yearly'
      ? (currentPlan?.price_yearly || 0)
      : (currentPlan?.price_monthly || 0);
    const newPlanPrice = finalBillingCycle === 'yearly'
      ? (newPlan.price_yearly || 0)
      : (newPlan.price_monthly || 0);

    const isUpgrade = newPlanPrice > currentPlanPrice;
    const isDowngrade = newPlanPrice < currentPlanPrice;

    console.log('Comparação de planos:', {
      currentPlan: currentPlan?.name,
      currentPlanPrice,
      newPlan: newPlan.name,
      newPlanPrice,
      isUpgrade,
      isDowngrade,
    });

    // Definir comportamento de proration baseado em upgrade/downgrade
    // UPGRADE: Reseta o ciclo de cobrança e cobra o valor cheio do novo plano imediatamente
    // DOWNGRADE: Mantém o ciclo atual, novo valor só na próxima fatura

    console.log('Tipo de alteração:', isUpgrade ? 'UPGRADE' : isDowngrade ? 'DOWNGRADE' : 'MESMO_PRECO');

    let updatedSubscription;

    // Verificar se a subscription tem trial ativo
    const hasActiveTrial = stripeSubscription.trial_end && stripeSubscription.trial_end > Math.floor(Date.now() / 1000);

    console.log('Atualizando subscription no Stripe...', {
      subscription_id: subscription.stripe_subscription_id,
      new_price_id: newStripePriceId,
      hasActiveTrial,
    });

    if (isUpgrade) {
      // Para UPGRADE: atualizar subscription e cobrar imediatamente
      console.log('UPGRADE detectado. Atualizando subscription com cobrança imediata...');

      const updateParams: any = {
        items: [
          {
            id: currentItem.id,
            price: newStripePriceId,
          },
        ],
        proration_behavior: 'none',
        billing_cycle_anchor: 'now',
        payment_behavior: 'error_if_incomplete',
        // Forçar cobrança automática para evitar erro de 'days_until_due'
        collection_method: 'charge_automatically',
        metadata: {
          plan_id: new_plan_id,
          plan_name: newPlan.name,
          user_id: user_id,
        },
      };

      if (hasActiveTrial) {
        updateParams.trial_end = 'now';
      }

      try {
        updatedSubscription = await stripe.subscriptions.update(
          subscription.stripe_subscription_id,
          updateParams
        );
        console.log('Subscription atualizada com sucesso. Status:', updatedSubscription.status);
      } catch (stripeError: any) {
        console.error('Erro ao atualizar subscription:', stripeError.message);

        // Se falhou por problema de pagamento, buscar a invoice pendente
        if (stripeError.code === 'subscription_payment_intent_requires_action' ||
            stripeError.code === 'card_declined' ||
            stripeError.type === 'StripeCardError') {

          // Buscar a invoice pendente
          const invoices = await stripe.invoices.list({
            subscription: subscription.stripe_subscription_id,
            status: 'open',
            limit: 1,
          });

          if (invoices.data.length > 0) {
            const pendingInvoice = invoices.data[0];
            const paymentUrl = pendingInvoice.hosted_invoice_url;

            if (paymentUrl) {
              return new Response(
                JSON.stringify({
                  payment_required: true,
                  payment_url: paymentUrl,
                  message: 'Pagamento necessário para completar o upgrade.',
                  is_upgrade: true,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }

          // Se não encontrou invoice, criar checkout session
          console.log('Criando checkout session para upgrade...');
          const checkoutSession = await stripe.checkout.sessions.create({
            customer: subscription.stripe_customer_id,
            mode: 'subscription',
            line_items: [
              {
                price: newStripePriceId,
                quantity: 1,
              },
            ],
            success_url: `${req.headers.get('origin') || 'https://app.replyna.com.br'}/account?upgrade_success=true`,
            cancel_url: `${req.headers.get('origin') || 'https://app.replyna.com.br'}/account?upgrade_cancelled=true`,
            subscription_data: {
              metadata: {
                plan_id: new_plan_id,
                plan_name: newPlan.name,
                user_id: user_id,
              },
            },
          });

          return new Response(
            JSON.stringify({
              payment_required: true,
              payment_url: checkoutSession.url,
              message: `Complete o pagamento para ativar o plano ${newPlan.name}.`,
              is_upgrade: true,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        throw stripeError;
      }
    } else {
      // Para DOWNGRADE ou mesmo preço: mantém o ciclo atual
      const updateParams: any = {
        items: [
          {
            id: currentItem.id,
            price: newStripePriceId,
          },
        ],
        proration_behavior: 'none',
        // Forçar cobrança automática para evitar erro de 'days_until_due'
        collection_method: 'charge_automatically',
        metadata: {
          plan_id: new_plan_id,
          plan_name: newPlan.name,
          user_id: user_id,
        },
      };

      // Só incluir trial_end se houver trial ativo
      if (hasActiveTrial) {
        updateParams.trial_end = 'now';
      }

      updatedSubscription = await stripe.subscriptions.update(
        subscription.stripe_subscription_id,
        updateParams
      );
    }

    // Verificar se o pagamento foi processado com sucesso
    // Se status for incomplete ou past_due, o pagamento falhou
    if (updatedSubscription.status === 'incomplete' || updatedSubscription.status === 'past_due') {
      console.log('Pagamento falhou. Status da subscription:', updatedSubscription.status);

      // Buscar a última invoice para obter a URL de pagamento
      const invoices = await stripe.invoices.list({
        subscription: updatedSubscription.id,
        limit: 1,
      });

      const latestInvoice = invoices.data[0];
      let paymentUrl = latestInvoice?.hosted_invoice_url;

      console.log('Invoice encontrada:', {
        invoice_id: latestInvoice?.id,
        status: latestInvoice?.status,
        hosted_invoice_url: paymentUrl,
      });

      // Se não tiver URL de pagamento da invoice, criar uma sessão de checkout
      if (!paymentUrl) {
        console.log('Sem URL de invoice. Criando sessão de checkout...');

        const checkoutSession = await stripe.checkout.sessions.create({
          customer: subscription.stripe_customer_id,
          mode: 'subscription',
          line_items: [
            {
              price: newStripePriceId,
              quantity: 1,
            },
          ],
          success_url: `${req.headers.get('origin') || 'https://app.replyna.com.br'}/account?upgrade_success=true`,
          cancel_url: `${req.headers.get('origin') || 'https://app.replyna.com.br'}/account?upgrade_cancelled=true`,
          subscription_data: {
            metadata: {
              plan_id: new_plan_id,
              plan_name: newPlan.name,
              user_id: user_id,
              replaces_subscription: subscription.stripe_subscription_id,
            },
          },
        });

        paymentUrl = checkoutSession.url;
      }

      return new Response(
        JSON.stringify({
          payment_required: true,
          payment_url: paymentUrl,
          message: 'Pagamento pendente. Complete o pagamento para ativar o novo plano.',
          subscription_status: updatedSubscription.status,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Atualizando subscription no banco:', {
      subscription_id: subscription.id,
      plan_id: new_plan_id,
      stripe_price_id: newStripePriceId,
      billing_cycle: finalBillingCycle,
    });

    // Atualizar subscription no banco de dados
    // IMPORTANTE: Se foi upgrade, sincronizar as novas datas do período de cobrança
    const subscriptionUpdate: any = {
      plan_id: new_plan_id,
      stripe_price_id: newStripePriceId,
      billing_cycle: finalBillingCycle,
      status: 'active',
      updated_at: new Date().toISOString(),
    };

    // Se foi upgrade, atualizar as datas do período baseado na subscription atualizada do Stripe
    const upgradePeriod = getSubscriptionPeriod(updatedSubscription);
    if (isUpgrade && upgradePeriod.start && upgradePeriod.end) {
      subscriptionUpdate.current_period_start = safeTimestampToISO(upgradePeriod.start) || new Date().toISOString();
      subscriptionUpdate.current_period_end = safeTimestampToISO(upgradePeriod.end) || new Date().toISOString();
      console.log('Upgrade: sincronizando datas do período:', {
        current_period_start: subscriptionUpdate.current_period_start,
        current_period_end: subscriptionUpdate.current_period_end,
      });
    }

    const { data: updatedSubData, error: updateError } = await supabase
      .from('subscriptions')
      .update(subscriptionUpdate)
      .eq('id', subscription.id)
      .select();

    console.log('Resultado update subscriptions:', { updatedSubData, updateError });

    if (updateError) {
      console.error('Erro ao atualizar subscription no banco:', updateError);
    }

    console.log('Atualizando usuário na tabela users:', {
      user_id,
      plan: newPlan.name,
      emails_limit: newPlan.emails_limit,
      shops_limit: newPlan.shops_limit,
    });

    // Atualizar plano do usuário na tabela users
    // NOTA: A tabela users NÃO tem coluna plan_id, apenas o campo texto 'plan'
    // Quando faz upgrade, zera os contadores de emails usados (novo ciclo de billing)
    const { data: updatedUserData, error: userUpdateError } = await supabase
      .from('users')
      .update({
        plan: newPlan.name,
        emails_limit: newPlan.emails_limit,
        shops_limit: newPlan.shops_limit,
        emails_used: 0,
        extra_emails_used: 0,
        pending_extra_emails: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user_id)
      .select();

    console.log('Resultado update users:', { updatedUserData, userUpdateError });

    if (userUpdateError) {
      console.error('Erro ao atualizar usuário:', userUpdateError);
      // Retornar erro parcial mas informar que o Stripe foi atualizado
      return new Response(
        JSON.stringify({
          success: true,
          partial_error: true,
          message: 'Plano atualizado no Stripe, mas houve erro ao sincronizar banco de dados. Recarregue a página.',
          error_detail: userUpdateError.message,
          new_plan: {
            id: newPlan.id,
            name: newPlan.name,
            emails_limit: newPlan.emails_limit,
            shops_limit: newPlan.shops_limit,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o update realmente afetou alguma linha
    if (!updatedUserData || updatedUserData.length === 0) {
      console.error('Update executou mas não afetou nenhuma linha. User ID:', user_id);
      return new Response(
        JSON.stringify({
          success: true,
          partial_error: true,
          message: 'Plano atualizado no Stripe, mas usuário não encontrado no banco. Recarregue a página.',
          new_plan: {
            id: newPlan.id,
            name: newPlan.name,
            emails_limit: newPlan.emails_limit,
            shops_limit: newPlan.shops_limit,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Plano atualizado com sucesso!',
        new_plan: {
          id: newPlan.id,
          name: newPlan.name,
          emails_limit: newPlan.emails_limit,
          shops_limit: newPlan.shops_limit,
          price_monthly: newPlan.price_monthly,
        },
        billing_cycle: finalBillingCycle,
        subscription_id: updatedSubscription.id,
        is_upgrade: isUpgrade,
        is_downgrade: isDowngrade,
        price_difference: isUpgrade ? (newPlanPrice - currentPlanPrice) : 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao atualizar subscription:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

```

File: `supabase/functions/charge-extra-emails/index.ts`
```ts
/**
 * Edge Function: Charge Extra Emails
 *
 * Cobra um pacote de emails extras do usuário via Stripe
 * Chamada automaticamente quando o usuário atinge o limite do pacote
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
import { maskEmail } from '../_shared/email.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

interface ChargeRequest {
  user_id: string;
  package_size?: number; // Opcional, usa o padrão do plano se não fornecido
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

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

    console.log(`Cobrando pacote de ${finalPackageSize} emails extras para usuário ${maskEmail(user.email)}`);
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

```

File: `supabase/functions/pay-pending-invoice/index.ts`
```ts
/**
 * Edge Function: Pay Pending Invoice
 *
 * Permite que o usuário pague uma invoice pendente de emails extras
 * Cria uma Checkout Session do Stripe para pagamento
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

interface PayInvoiceRequest {
  purchase_id: string;
  stripe_invoice_id: string;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

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

```

File: `supabase/functions/accept-migration-invite/index.ts`
```ts
/**
 * Edge Function: Accept Migration Invite
 *
 * Valida o código de convite e cria sessão de checkout com trial
 * até a data de início da cobrança.
 *
 * GET - Valida o código e retorna dados do convite
 * POST - Aceita o convite e cria checkout session
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import Stripe from 'https://esm.sh/stripe@20.2.0?target=deno';
import { getCorsHeaders } from '../_shared/cors.ts';
import { isValidEmail } from '../_shared/validation.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // GET - Validar código e retornar dados do convite
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const code = url.searchParams.get('code');

      if (!code) {
        return new Response(
          JSON.stringify({ error: 'Código do convite é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar convite
      const { data: invite, error } = await supabase
        .from('migration_invites')
        .select(`
          *,
          plan:plans(id, name, price_monthly, shops_limit, emails_limit)
        `)
        .eq('code', code.toUpperCase())
        .single();

      if (error || !invite) {
        return new Response(
          JSON.stringify({ error: 'Convite não encontrado', valid: false }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar status
      if (invite.status !== 'pending') {
        return new Response(
          JSON.stringify({
            error: invite.status === 'accepted'
              ? 'Este convite já foi utilizado'
              : invite.status === 'expired'
                ? 'Este convite expirou'
                : 'Este convite foi cancelado',
            valid: false,
            status: invite.status,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar expiração
      if (new Date(invite.expires_at) < new Date()) {
        // Atualizar status para expirado
        await supabase
          .from('migration_invites')
          .update({ status: 'expired' })
          .eq('id', invite.id);

        return new Response(
          JSON.stringify({ error: 'Este convite expirou', valid: false }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Calcular dias de trial (diferença em dias completos usando UTC)
      const billingDate = new Date(invite.billing_start_date);
      const todayUTC = new Date();

      // Extrair apenas ano, mês, dia em UTC
      const billingUTC = Date.UTC(billingDate.getUTCFullYear(), billingDate.getUTCMonth(), billingDate.getUTCDate());
      const nowUTC = Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate());

      const trialDays = Math.max(0, Math.floor((billingUTC - nowUTC) / (1000 * 60 * 60 * 24)));

      return new Response(
        JSON.stringify({
          valid: true,
          invite: {
            code: invite.code,
            customer_email: invite.customer_email,
            customer_name: invite.customer_name,
            plan: invite.plan,
            billing_start_date: invite.billing_start_date,
            trial_days: trialDays,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Aceitar convite e criar checkout session
    if (req.method === 'POST') {
      const body = await req.json();
      const { code, user_email, user_name, success_url, cancel_url } = body;

      if (!code || !user_email || !success_url || !cancel_url) {
        return new Response(
          JSON.stringify({ error: 'Campos obrigatórios: code, user_email, success_url, cancel_url' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validar formato do email
      if (!isValidEmail(user_email)) {
        return new Response(
          JSON.stringify({ error: 'Email inválido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar convite
      const { data: invite, error: inviteError } = await supabase
        .from('migration_invites')
        .select(`
          *,
          plan:plans(*)
        `)
        .eq('code', code.toUpperCase())
        .eq('status', 'pending')
        .single();

      if (inviteError || !invite) {
        return new Response(
          JSON.stringify({ error: 'Convite não encontrado ou já utilizado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar expiração
      if (new Date(invite.expires_at) < new Date()) {
        await supabase
          .from('migration_invites')
          .update({ status: 'expired' })
          .eq('id', invite.id);

        return new Response(
          JSON.stringify({ error: 'Este convite expirou' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const plan = invite.plan;
      if (!plan) {
        return new Response(
          JSON.stringify({ error: 'Plano do convite não encontrado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Determinar price_id (sempre mensal para migração)
      const stripePriceId = plan.stripe_price_monthly_id;
      if (!stripePriceId) {
        return new Response(
          JSON.stringify({ error: 'Plano não configurado no Stripe' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Criar/buscar customer Stripe
      let stripeCustomerId: string;

      const existingCustomers = await stripe.customers.list({
        email: user_email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        stripeCustomerId = existingCustomers.data[0].id;
      } else {
        const newCustomer = await stripe.customers.create({
          email: user_email,
          name: user_name || invite.customer_name,
          metadata: {
            migration_invite_code: code,
          },
        });
        stripeCustomerId = newCustomer.id;
      }

      // Calcular trial_end (timestamp Unix)
      const billingStartDate = new Date(invite.billing_start_date);
      const trialEnd = Math.floor(billingStartDate.getTime() / 1000);

      // Criar checkout session com trial
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: stripePriceId,
            quantity: 1,
          },
        ],
        success_url: `${success_url}?session_id={CHECKOUT_SESSION_ID}&migration=true`,
        cancel_url: cancel_url,
        subscription_data: {
          trial_end: trialEnd,
          metadata: {
            plan_id: plan.id,
            plan_name: plan.name,
            migration_invite_id: invite.id,
            migration_invite_code: code,
            user_id: 'pending',
          },
        },
        metadata: {
          plan_id: plan.id,
          plan_name: plan.name,
          user_email: user_email,
          user_name: user_name || invite.customer_name || '',
          user_id: 'pending',
          emails_limit: plan.emails_limit?.toString() ?? 'unlimited',
          shops_limit: plan.shops_limit?.toString() ?? 'unlimited',
          migration_invite_id: invite.id,
          migration_invite_code: code,
        },
        billing_address_collection: 'auto',
        locale: 'pt-BR',
      });

      return new Response(
        JSON.stringify({
          session_id: session.id,
          url: session.url,
          trial_end: invite.billing_start_date,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

```

File: `supabase/functions/sync-stripe-customer/index.ts`
```ts
/**
 * Edge Function: Sync Stripe Customer
 *
 * Cria/sincroniza um usuário a partir de um customer do Stripe que já pagou.
 * Usa a Admin API do Supabase para criar a conta.
 *
 * IMPORTANTE: Esta função deve ser protegida e só deve ser chamada por admins
 * ou internamente pelo sistema.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getStripeClient } from '../_shared/stripe.ts';
import { maskEmail } from '../_shared/email.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

/** Extrai period dates da subscription (compatível com API Stripe 2025-12-15.clover) */
function getSubscriptionPeriod(subscription: any): { start: number; end: number } {
  const item = subscription.items?.data?.[0];
  const start = subscription.current_period_start ?? item?.current_period_start ?? item?.period?.start;
  const end = subscription.current_period_end ?? item?.current_period_end ?? item?.period?.end;
  return { start, end };
}

function safeTimestampToISO(timestamp: number | null | undefined): string | null {
  if (!timestamp || typeof timestamp !== 'number' || timestamp <= 0) return null;
  const date = new Date(timestamp * 1000);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Usar service role key para poder criar usuários
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const stripe = getStripeClient();

    const body = await req.json();
    const { customer_id, temporary_password } = body;

    if (!customer_id) {
      return new Response(
        JSON.stringify({ error: 'customer_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar customer no Stripe
    const customer = await stripe.customers.retrieve(customer_id) as any;

    if (customer.deleted) {
      return new Response(
        JSON.stringify({ error: 'Customer foi deletado no Stripe' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const email = customer.email;
    const name = customer.name;

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Customer não tem email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sincronizando customer:', { customer_id, email: maskEmail(email), name });

    // Verificar se usuário já existe no Auth
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    const existingAuthUser = existingUsers?.users.find(u =>
      u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;

    if (existingAuthUser) {
      console.log('Usuário já existe no Auth:', existingAuthUser.id);
      userId = existingAuthUser.id;
    } else {
      // Criar usuário no Auth
      // Gerar uma senha temporária se não fornecida
      const password = temporary_password || crypto.randomUUID().slice(0, 12) + 'Aa1!';

      const { data: newAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true, // Confirma o email automaticamente
        user_metadata: { name },
      });

      if (createAuthError) {
        console.error('Erro ao criar usuário no Auth:', createAuthError);
        throw new Error(`Erro ao criar usuário no Auth: ${createAuthError.message}`);
      }

      userId = newAuthUser.user.id;
      console.log('Usuário criado no Auth:', userId);
    }

    // Buscar subscription do customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer_id,
      limit: 1,
      status: 'all',
    });

    const subscription = subscriptions.data[0];

    // Buscar metadata da sessão de checkout se existir
    let metadata: Record<string, string> = {};
    if (subscription) {
      const sessions = await stripe.checkout.sessions.list({
        subscription: subscription.id,
        limit: 1,
      });
      metadata = sessions.data[0]?.metadata || {};
    }

    // Verificar se usuário já existe na tabela users
    const { data: existingDbUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    const plan = metadata.plan_name?.toLowerCase() || 'starter';

    // Parsear limites: 'unlimited' = null, número = valor numérico
    const parseLimit = (value: string | undefined, defaultValue: number): number | null => {
      if (!value || value === 'unlimited') return null;
      const parsed = parseInt(value);
      return isNaN(parsed) ? defaultValue : parsed;
    };

    const emailsLimit = parseLimit(metadata.emails_limit, 500);
    const shopsLimit = parseLimit(metadata.shops_limit, 1);

    if (existingDbUser) {
      // Atualizar
      await supabaseAdmin
        .from('users')
        .update({
          stripe_customer_id: customer_id,
          plan,
          emails_limit: emailsLimit,
          shops_limit: shopsLimit,
          status: subscription?.status === 'active' ? 'active' : 'inactive',
        })
        .eq('id', userId);
      console.log('Usuário atualizado na tabela users');
    } else {
      // Inserir
      const { error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          email: email.toLowerCase(),
          name: name || null,
          plan,
          emails_limit: emailsLimit,
          shops_limit: shopsLimit,
          emails_used: 0,
          stripe_customer_id: customer_id,
          status: subscription?.status === 'active' ? 'active' : 'inactive',
        });

      if (insertError) {
        console.error('Erro ao inserir na tabela users:', insertError);
        throw new Error(`Erro ao inserir na tabela users: ${insertError.message}`);
      }
      console.log('Usuário inserido na tabela users');
    }

    // Criar/atualizar subscription se existir
    if (subscription) {
      const priceId = subscription.items.data[0]?.price.id;

      const { data: existingSub } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('stripe_subscription_id', subscription.id)
        .single();

      const subscriptionData = {
        user_id: userId,
        plan_id: metadata.plan_id || null,
        stripe_customer_id: customer_id,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        status: subscription.status === 'active' ? 'active' : subscription.status,
        billing_cycle: priceId?.includes('year') ? 'yearly' : 'monthly',
        current_period_start: safeTimestampToISO(getSubscriptionPeriod(subscription).start) || new Date().toISOString(),
        current_period_end: safeTimestampToISO(getSubscriptionPeriod(subscription).end) || new Date().toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
      };

      if (existingSub) {
        await supabaseAdmin
          .from('subscriptions')
          .update(subscriptionData)
          .eq('id', existingSub.id);
      } else {
        await supabaseAdmin
          .from('subscriptions')
          .insert(subscriptionData);
      }
      console.log('Subscription sincronizada');
    }

    // Atualizar metadata do customer no Stripe
    await stripe.customers.update(customer_id, {
      metadata: { user_id: userId },
    });

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        email: email,
        message: existingAuthUser ? 'Usuário já existia, apenas atualizado' : 'Novo usuário criado',
        note: existingAuthUser ? null : 'O usuário precisa resetar a senha para acessar a conta',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

```

File: `supabase/functions/sync-coupon/index.ts`
```ts
/**
 * Edge Function: Sync Coupon
 *
 * Sincroniza cupons entre o banco de dados Replyna e o Stripe.
 * Cria ou atualiza cupons no Stripe quando criados/editados no admin.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SyncCouponRequest {
  coupon_id: string;
  action: 'create' | 'update' | 'delete';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { coupon_id, action } = (await req.json()) as SyncCouponRequest;

    if (!coupon_id) {
      return new Response(
        JSON.stringify({ error: 'coupon_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();
    const stripe = getStripeClient();

    // Buscar cupom no banco
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select('*')
      .eq('id', coupon_id)
      .single();

    if (couponError && action !== 'delete') {
      throw new Error('Cupom não encontrado');
    }

    // Ação: Deletar
    if (action === 'delete') {
      if (coupon?.stripe_coupon_id) {
        try {
          await stripe.coupons.del(coupon.stripe_coupon_id);
          console.log(`Cupom ${coupon.stripe_coupon_id} deletado do Stripe`);
        } catch (stripeError: unknown) {
          // Se o cupom não existe no Stripe, ignorar
          const error = stripeError as { code?: string };
          if (error.code !== 'resource_missing') {
            throw stripeError;
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Cupom deletado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preparar dados do cupom para o Stripe
    const stripeCouponData: {
      id?: string;
      name: string;
      percent_off?: number;
      amount_off?: number;
      currency?: string;
      duration: 'forever' | 'once' | 'repeating';
      duration_in_months?: number;
      max_redemptions?: number;
      redeem_by?: number;
    } = {
      name: coupon.description || coupon.code,
      duration: 'once', // Desconto apenas na primeira mensalidade
    };

    // Configurar tipo de desconto
    if (coupon.discount_type === 'percentage') {
      stripeCouponData.percent_off = coupon.discount_value;
    } else {
      // Stripe espera valores em centavos
      stripeCouponData.amount_off = Math.round(coupon.discount_value * 100);
      stripeCouponData.currency = 'brl';
    }

    // Limite de usos
    if (coupon.usage_limit) {
      stripeCouponData.max_redemptions = coupon.usage_limit;
    }

    // Data de expiração
    if (coupon.valid_until) {
      stripeCouponData.redeem_by = Math.floor(new Date(coupon.valid_until).getTime() / 1000);
    }

    let stripeCouponId = coupon.stripe_coupon_id;

    // Ação: Criar ou Atualizar
    if (action === 'create' || !stripeCouponId) {
      // Criar novo cupom no Stripe
      // Usar o código como ID do cupom no Stripe para facilitar
      stripeCouponData.id = coupon.code.toUpperCase();

      try {
        const stripeCoupon = await stripe.coupons.create(stripeCouponData);
        stripeCouponId = stripeCoupon.id;
        console.log(`Cupom criado no Stripe: ${stripeCouponId}`);
      } catch (stripeError: unknown) {
        const error = stripeError as { code?: string; message?: string };
        // Se já existe um cupom com esse ID, tentar atualizar
        if (error.code === 'resource_already_exists') {
          stripeCouponId = coupon.code.toUpperCase();
          console.log(`Cupom ${stripeCouponId} já existe no Stripe`);
        } else {
          throw stripeError;
        }
      }
    } else if (action === 'update' && stripeCouponId) {
      // Stripe não permite atualizar todos os campos de um cupom
      // A estratégia é deletar e recriar se houve mudanças significativas
      try {
        // Verificar se o cupom existe
        const existingCoupon = await stripe.coupons.retrieve(stripeCouponId);

        // Verificar se houve mudanças significativas
        const hasSignificantChanges =
          (coupon.discount_type === 'percentage' && existingCoupon.percent_off !== coupon.discount_value) ||
          (coupon.discount_type === 'fixed_amount' && existingCoupon.amount_off !== Math.round(coupon.discount_value * 100));

        if (hasSignificantChanges) {
          // Deletar cupom antigo
          await stripe.coupons.del(stripeCouponId);

          // Criar novo com o mesmo código
          stripeCouponData.id = coupon.code.toUpperCase();
          const newCoupon = await stripe.coupons.create(stripeCouponData);
          stripeCouponId = newCoupon.id;
          console.log(`Cupom recriado no Stripe: ${stripeCouponId}`);
        } else {
          // Apenas atualizar nome (único campo atualizável)
          await stripe.coupons.update(stripeCouponId, {
            name: coupon.description || coupon.code,
          });
          console.log(`Cupom atualizado no Stripe: ${stripeCouponId}`);
        }
      } catch (stripeError: unknown) {
        const error = stripeError as { code?: string };
        if (error.code === 'resource_missing') {
          // Cupom não existe, criar novo
          stripeCouponData.id = coupon.code.toUpperCase();
          const newCoupon = await stripe.coupons.create(stripeCouponData);
          stripeCouponId = newCoupon.id;
          console.log(`Cupom criado no Stripe (não existia): ${stripeCouponId}`);
        } else {
          throw stripeError;
        }
      }
    }

    // Criar Promotion Code (código que o cliente digita no checkout)
    // O Promotion Code é diferente do Coupon - é o código público
    if (stripeCouponId) {
      try {
        // Verificar se já existe um promotion code com esse código
        const existingPromoCodes = await stripe.promotionCodes.list({
          code: coupon.code.toUpperCase(),
          limit: 1,
        });

        if (existingPromoCodes.data.length === 0) {
          // Criar novo promotion code
          await stripe.promotionCodes.create({
            coupon: stripeCouponId,
            code: coupon.code.toUpperCase(),
            active: coupon.is_active,
            max_redemptions: coupon.usage_limit || undefined,
            expires_at: coupon.valid_until
              ? Math.floor(new Date(coupon.valid_until).getTime() / 1000)
              : undefined,
          });
          console.log(`Promotion Code criado: ${coupon.code.toUpperCase()}`);
        } else {
          // Atualizar promotion code existente (apenas active pode ser atualizado)
          await stripe.promotionCodes.update(existingPromoCodes.data[0].id, {
            active: coupon.is_active,
          });
          console.log(`Promotion Code atualizado: ${coupon.code.toUpperCase()}`);
        }
      } catch (promoError: unknown) {
        console.error('Erro ao criar/atualizar Promotion Code:', promoError);
        // Não falhar a operação toda por causa do promotion code
      }
    }

    // Atualizar stripe_coupon_id no banco se mudou
    if (stripeCouponId && stripeCouponId !== coupon.stripe_coupon_id) {
      await supabase
        .from('coupons')
        .update({ stripe_coupon_id: stripeCouponId })
        .eq('id', coupon_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        stripe_coupon_id: stripeCouponId,
        message: action === 'create' ? 'Cupom criado no Stripe' : 'Cupom atualizado no Stripe',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao sincronizar cupom:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

```

File: `supabase/functions/get-financial-stats/index.ts`
```ts
/**
 * Edge Function: Get Financial Stats
 *
 * Busca dados financeiros diretamente da API do Stripe
 * - Balance (saldo disponível e pendente)
 * - Charges recentes
 * - Invoices
 * - Subscriptions
 * - MRR calculado
 *
 * OTIMIZAÇÃO: Cache em memória de 5 minutos para carregamento instantâneo
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

// Cache em memória (5 minutos de TTL)
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const cache = new Map<string, { data: FinancialStats; timestamp: number }>();

function getCacheKey(startDate: string, endDate: string): string {
  return `${startDate}_${endDate}`;
}

function getFromCache(key: string): FinancialStats | null {
  const cached = cache.get(key);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return cached.data;
}

function setCache(key: string, data: FinancialStats): void {
  // Limpar cache antigo (manter no máximo 10 entradas)
  if (cache.size > 10) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { data, timestamp: Date.now() });
}

interface FinancialStats {
  balance: {
    available: number;
    pending: number;
    currency: string;
  };
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  totalCustomers: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueGrowth: number;
  churnRate: number;
  averageTicket: number;
  recentPayments: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    customer_email: string | null;
    customer_name: string | null;
    description: string | null;
    created: number;
  }[];
  recentInvoices: {
    id: string;
    number: string | null;
    amount_due: number;
    amount_paid: number;
    status: string | null;
    customer_email: string | null;
    customer_name: string | null;
    created: number;
    hosted_invoice_url: string | null;
  }[];
  subscriptionsByStatus: {
    active: number;
    past_due: number;
    canceled: number;
    trialing: number;
  };
  subscriptionsByPlan: {
    plan_name: string;
    count: number;
  }[];
  monthlyRevenue: {
    month: string;
    revenue: number;
  }[];
  periodMetrics: {
    revenueInPeriod: number;
    newSubscriptionsInPeriod: number;
    canceledSubscriptionsInPeriod: number;
    chargesInPeriod: number;
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Pegar período da query string
    const url = new URL(req.url);
    const period = url.searchParams.get('period') || '6months'; // 7days, 30days, 3months, 6months, 12months, all, custom
    const customStartDate = url.searchParams.get('startDate');
    const customEndDate = url.searchParams.get('endDate');
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    // Verificar cache primeiro (se não for refresh forçado)
    const cacheKey = getCacheKey(customStartDate || period, customEndDate || 'now');
    if (!forceRefresh) {
      const cachedData = getFromCache(cacheKey);
      if (cachedData) {
        console.log('[Cache HIT] Retornando dados do cache');
        return new Response(JSON.stringify({ ...cachedData, fromCache: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    console.log('[Cache MISS] Buscando dados do Stripe...');

    const stripe = getStripeClient();

    // Calcular datas base
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date = now;
    let monthsToShow: number;

    if (period === 'custom' && customStartDate && customEndDate) {
      periodStart = new Date(customStartDate);
      periodEnd = new Date(customEndDate);
      periodEnd.setHours(23, 59, 59, 999); // Fim do dia
      const diffDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
      monthsToShow = Math.max(1, Math.ceil(diffDays / 30));
    } else {
      switch (period) {
        case '7days':
          periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          monthsToShow = 1;
          break;
        case '30days':
          periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          monthsToShow = 1;
          break;
        case '3months':
          periodStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          monthsToShow = 3;
          break;
        case '12months':
          periodStart = new Date(now.getFullYear(), now.getMonth() - 12, 1);
          monthsToShow = 12;
          break;
        case 'all':
          periodStart = new Date(2020, 0, 1); // Data bem antiga
          monthsToShow = 12;
          break;
        case '6months':
        default:
          periodStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
          monthsToShow = 6;
          break;
      }
    }

    const periodStartTimestamp = Math.floor(periodStart.getTime() / 1000);
    const periodEndTimestamp = Math.floor(periodEnd.getTime() / 1000);

    // Buscar dados em paralelo para performance (limites otimizados)
    const chargesFilter: { limit: number; created: { gte: number; lte?: number } } = {
      limit: 50, // Reduzido para carregar mais rápido
      created: { gte: periodStartTimestamp },
    };
    const invoicesFilter: { limit: number; created: { gte: number; lte?: number } } = {
      limit: 20, // Reduzido para carregar mais rápido
      created: { gte: periodStartTimestamp },
    };

    // Aplicar filtro de data final para períodos customizados
    if (period === 'custom' && periodEndTimestamp) {
      chargesFilter.created.lte = periodEndTimestamp;
      invoicesFilter.created.lte = periodEndTimestamp;
    }

    // Emails de contas internas, testes e VIPs (não geram receita real)
    const excludedEmails = new Set([
      'carlosrian114@gmail.com',       // Rian - cancelado
      'bruno.pinheiro@replyna.com',    // Bruno Pinheiro - conta clonada para criativos
      'carlos@eternityholding.com',    // Carlos Azevedo - conta de testes
      'samcadastro@gmail.com',         // Samuel - VIP
      'razbergcapital@gmail.com',      // Bernardo Chourik - VIP
      'itssnobre@gmail.com',           // Nobre - VIP
      'gustavolsilva2003@gmail.com',   // Teste Email - conta de teste
      'horizonbluesolutionsllc@gmail.com', // Carlos Azevedo - VIP
    ]);

    // Buscar todos os dados em paralelo (expand customer para filtrar por email)
    const [
      balance,
      subscriptions,
      charges,
      invoices,
    ] = await Promise.all([
      stripe.balance.retrieve(),
      stripe.subscriptions.list({ limit: 50, status: 'all', expand: ['data.customer'] }),
      stripe.charges.list(chargesFilter), // Sem expand - usa billing_details
      stripe.invoices.list(invoicesFilter),
    ]);

    // Calcular datas para comparação
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Calcular MRR baseado em assinaturas ativas (excluindo contas internas/VIP)
    let mrr = 0;
    let activeCount = 0;
    let pastDueCount = 0;
    let canceledCount = 0;
    let trialingCount = 0;
    const planCounts: Record<string, number> = {};

    for (const sub of subscriptions.data) {
      // Extrair email do customer expandido
      const customer = sub.customer as { email?: string | null } | string;
      const customerEmail = (typeof customer === 'object' && customer?.email)
        ? customer.email.toLowerCase()
        : '';
      const isExcluded = excludedEmails.has(customerEmail);

      if (!isExcluded && (sub.status === 'active' || sub.status === 'trialing')) {
        // Calcular valor mensal da assinatura
        for (const item of sub.items.data) {
          const price = item.price;
          if (price.recurring) {
            let monthlyAmount = price.unit_amount || 0;
            if (price.recurring.interval === 'year') {
              monthlyAmount = monthlyAmount / 12;
            } else if (price.recurring.interval === 'week') {
              monthlyAmount = monthlyAmount * 4;
            }
            mrr += monthlyAmount;
          }

          // Contar por plano (apenas ativos e trialing pagantes)
          const planName = sub.metadata?.plan_name || price.nickname || 'Starter';
          planCounts[planName] = (planCounts[planName] || 0) + 1;
        }
      }

      // Contar por status (excluindo contas internas/VIP)
      if (!isExcluded) {
        switch (sub.status) {
          case 'active': activeCount++; break;
          case 'past_due': pastDueCount++; break;
          case 'canceled': canceledCount++; break;
          case 'trialing': trialingCount++; break;
        }
      }
    }

    // Converter contagem de planos para array
    const subscriptionsByPlan = Object.entries(planCounts)
      .map(([plan_name, count]) => ({ plan_name, count }))
      .sort((a, b) => b.count - a.count);

    // MRR em reais (Stripe retorna em centavos)
    mrr = mrr / 100;

    // Receita do mês atual e anterior
    let revenueThisMonth = 0;
    let revenueLastMonth = 0;
    const successfulCharges = charges.data.filter(c => c.status === 'succeeded' && !c.refunded);

    for (const charge of successfulCharges) {
      const chargeDate = new Date(charge.created * 1000);
      if (chargeDate >= startOfMonth) {
        revenueThisMonth += charge.amount;
      } else if (chargeDate >= startOfLastMonth && chargeDate <= endOfLastMonth) {
        revenueLastMonth += charge.amount;
      }
    }

    revenueThisMonth = revenueThisMonth / 100;
    revenueLastMonth = revenueLastMonth / 100;

    // Crescimento de receita
    const revenueGrowth = revenueLastMonth > 0
      ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
      : 0;

    // Ticket médio
    const averageTicket = successfulCharges.length > 0
      ? (successfulCharges.reduce((sum, c) => sum + c.amount, 0) / successfulCharges.length) / 100
      : 0;

    // === MÉTRICAS DO PERÍODO SELECIONADO ===
    // Receita no período selecionado
    let revenueInPeriod = 0;
    for (const charge of successfulCharges) {
      const chargeDate = new Date(charge.created * 1000);
      if (chargeDate >= periodStart && chargeDate <= periodEnd) {
        revenueInPeriod += charge.amount;
      }
    }
    revenueInPeriod = revenueInPeriod / 100;

    // Novas assinaturas no período (excluindo contas internas/VIP)
    let newSubscriptionsInPeriod = 0;
    let canceledSubscriptionsInPeriod = 0;
    for (const sub of subscriptions.data) {
      const customer = sub.customer as { email?: string | null } | string;
      const customerEmail = (typeof customer === 'object' && customer?.email)
        ? customer.email.toLowerCase()
        : '';
      if (excludedEmails.has(customerEmail)) continue;

      const createdDate = new Date(sub.created * 1000);
      if (createdDate >= periodStart && createdDate <= periodEnd) {
        newSubscriptionsInPeriod++;
      }
      // Assinaturas canceladas no período
      if (sub.status === 'canceled' && sub.canceled_at) {
        const canceledDate = new Date(sub.canceled_at * 1000);
        if (canceledDate >= periodStart && canceledDate <= periodEnd) {
          canceledSubscriptionsInPeriod++;
        }
      }
    }

    // Churn rate do PERÍODO: cancelados no período / ativos no início do período
    // Ativos no início do período = ativos agora + cancelados no período (pois estavam ativos antes de cancelar)
    const activesAtPeriodStart = activeCount + trialingCount + pastDueCount + canceledSubscriptionsInPeriod;
    const churnRate = activesAtPeriodStart > 0
      ? (canceledSubscriptionsInPeriod / activesAtPeriodStart) * 100
      : 0;

    // Total de cobranças no período
    const chargesInPeriod = successfulCharges.filter(c => {
      const chargeDate = new Date(c.created * 1000);
      return chargeDate >= periodStart && chargeDate <= periodEnd;
    }).length;

    // Pagamentos recentes (usa billing_details que já vem na resposta)
    const recentPayments = charges.data.slice(0, 10).map((charge) => ({
      id: charge.id,
      amount: charge.amount / 100,
      currency: charge.currency,
      status: charge.status,
      customer_email: charge.billing_details?.email || charge.receipt_email || null,
      customer_name: charge.billing_details?.name || null,
      description: charge.description,
      created: charge.created,
    }));

    // Invoices recentes
    const recentInvoices = invoices.data.slice(0, 10).map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      amount_due: invoice.amount_due / 100,
      amount_paid: invoice.amount_paid / 100,
      status: invoice.status,
      customer_email: invoice.customer_email,
      customer_name: invoice.customer_name,
      created: invoice.created,
      hosted_invoice_url: invoice.hosted_invoice_url,
    }));

    // Receita por período
    const monthlyRevenue: { month: string; revenue: number }[] = [];

    if (period === 'custom' && customStartDate && customEndDate) {
      // Para período customizado, decidir granularidade baseado na diferença de dias
      const diffDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 7) {
        // Mostrar por dia
        for (let d = new Date(periodStart); d <= periodEnd; d.setDate(d.getDate() + 1)) {
          const dayStart = new Date(d);
          const dayEnd = new Date(d);
          dayEnd.setDate(dayEnd.getDate() + 1);

          let dayRevenue = 0;
          for (const charge of successfulCharges) {
            const chargeDate = new Date(charge.created * 1000);
            if (chargeDate >= dayStart && chargeDate < dayEnd) {
              dayRevenue += charge.amount;
            }
          }

          monthlyRevenue.push({
            month: dayStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            revenue: dayRevenue / 100,
          });
        }
      } else if (diffDays <= 60) {
        // Mostrar por semana
        let weekStart = new Date(periodStart);
        while (weekStart < periodEnd) {
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 7);
          if (weekEnd > periodEnd) weekEnd.setTime(periodEnd.getTime());

          let weekRevenue = 0;
          for (const charge of successfulCharges) {
            const chargeDate = new Date(charge.created * 1000);
            if (chargeDate >= weekStart && chargeDate < weekEnd) {
              weekRevenue += charge.amount;
            }
          }

          monthlyRevenue.push({
            month: `${weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`,
            revenue: weekRevenue / 100,
          });

          weekStart = new Date(weekEnd);
        }
      } else {
        // Mostrar por mês
        let monthStart = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);
        while (monthStart <= periodEnd) {
          const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

          let monthRevenue = 0;
          for (const charge of successfulCharges) {
            const chargeDate = new Date(charge.created * 1000);
            if (chargeDate >= monthStart && chargeDate <= monthEnd) {
              monthRevenue += charge.amount;
            }
          }

          monthlyRevenue.push({
            month: monthStart.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
            revenue: monthRevenue / 100,
          });

          monthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
        }
      }
    } else if (period === '7days') {
      // Mostrar por dia nos últimos 7 dias
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);

        let dayRevenue = 0;
        for (const charge of successfulCharges) {
          const chargeDate = new Date(charge.created * 1000);
          if (chargeDate >= dayStart && chargeDate < dayEnd) {
            dayRevenue += charge.amount;
          }
        }

        monthlyRevenue.push({
          month: dayStart.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
          revenue: dayRevenue / 100,
        });
      }
    } else if (period === '30days') {
      // Mostrar por semana nos últimos 30 dias
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);

        let weekRevenue = 0;
        for (const charge of successfulCharges) {
          const chargeDate = new Date(charge.created * 1000);
          if (chargeDate >= weekStart && chargeDate < weekEnd) {
            weekRevenue += charge.amount;
          }
        }

        monthlyRevenue.push({
          month: `${weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`,
          revenue: weekRevenue / 100,
        });
      }
    } else {
      // Mostrar por mês
      for (let i = monthsToShow - 1; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

        let monthRevenue = 0;
        for (const charge of successfulCharges) {
          const chargeDate = new Date(charge.created * 1000);
          if (chargeDate >= monthStart && chargeDate <= monthEnd) {
            monthRevenue += charge.amount;
          }
        }

        monthlyRevenue.push({
          month: monthStart.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
          revenue: monthRevenue / 100,
        });
      }
    }

    // Saldo
    const availableBalance = balance.available.find(b => b.currency === 'brl')?.amount || 0;
    const pendingBalance = balance.pending.find(b => b.currency === 'brl')?.amount || 0;

    // Total de clientes baseado em todas as assinaturas (todos os status)
    const totalCustomers = activeCount + pastDueCount + canceledCount + trialingCount;

    const stats: FinancialStats = {
      balance: {
        available: availableBalance / 100,
        pending: pendingBalance / 100,
        currency: 'BRL',
      },
      mrr,
      arr: mrr * 12,
      activeSubscriptions: activeCount,
      totalCustomers,
      revenueThisMonth,
      revenueLastMonth,
      revenueGrowth,
      churnRate,
      averageTicket,
      recentPayments,
      recentInvoices,
      subscriptionsByStatus: {
        active: activeCount,
        past_due: pastDueCount,
        canceled: canceledCount,
        trialing: trialingCount,
      },
      subscriptionsByPlan,
      monthlyRevenue,
      periodMetrics: {
        revenueInPeriod,
        newSubscriptionsInPeriod,
        canceledSubscriptionsInPeriod,
        chargesInPeriod,
      },
    };

    // Salvar no cache para próximas requisições
    setCache(cacheKey, stats);
    console.log('[Cache SET] Dados salvos no cache');

    return new Response(JSON.stringify({ ...stats, fromCache: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas financeiras:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

```

File: `supabase/functions/stripe-debug/index.ts`
```ts
/**
 * Edge Function: Stripe Debug
 *
 * Funções de diagnóstico para Stripe (apenas para admin)
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = getStripeClient();
    const supabase = getSupabaseClient();
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Listar sessões de checkout recentes
    if (action === 'sessions') {
      const sessions = await stripe.checkout.sessions.list({
        limit: 10,
        expand: ['data.customer', 'data.subscription'],
      });

      return new Response(
        JSON.stringify({
          sessions: sessions.data.map(s => ({
            id: s.id,
            status: s.status,
            payment_status: s.payment_status,
            customer_email: s.customer_email,
            customer_details: s.customer_details,
            customer_id: s.customer,
            subscription_id: s.subscription,
            metadata: s.metadata,
            created: new Date(s.created * 1000).toISOString(),
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar sessão por subscription_id
    if (action === 'find-session') {
      const subscriptionId = url.searchParams.get('subscription_id');
      if (!subscriptionId) {
        return new Response(
          JSON.stringify({ error: 'subscription_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const sessions = await stripe.checkout.sessions.list({
        subscription: subscriptionId,
        limit: 1,
      });

      if (sessions.data.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Sessão não encontrada para essa subscription' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const session = sessions.data[0];
      return new Response(
        JSON.stringify({
          session_id: session.id,
          status: session.status,
          payment_status: session.payment_status,
          customer_email: session.customer_email,
          metadata: session.metadata,
          reprocess_url: `https://ulldjamxdsaqqyurcmcs.supabase.co/functions/v1/stripe-webhook?session_id=${session.id}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar customer por ID
    if (action === 'customer') {
      const customerId = url.searchParams.get('customer_id');
      if (!customerId) {
        return new Response(
          JSON.stringify({ error: 'customer_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const customer = await stripe.customers.retrieve(customerId);

      // Buscar usuário no banco
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('stripe_customer_id', customerId)
        .single();

      return new Response(
        JSON.stringify({
          stripe_customer: customer,
          database_user: user || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sincronizar usuário a partir de customer
    if (action === 'sync-customer' && req.method === 'POST') {
      const body = await req.json();
      const customerId = body.customer_id;

      if (!customerId) {
        return new Response(
          JSON.stringify({ error: 'customer_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const customer = await stripe.customers.retrieve(customerId) as any;

      // Buscar subscriptions do customer
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        limit: 1,
        status: 'all',
      });

      const subscription = subscriptions.data[0];

      if (!subscription) {
        return new Response(
          JSON.stringify({ error: 'Nenhuma subscription encontrada para esse customer' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar sessão de checkout para obter metadata
      const sessions = await stripe.checkout.sessions.list({
        subscription: subscription.id,
        limit: 1,
      });

      const session = sessions.data[0];
      const metadata = session?.metadata || {};

      // Verificar se usuário já existe
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', customer.email.toLowerCase())
        .single();

      // Parsear limites: 'unlimited' = null, número = valor numérico
      const parseLimit = (value: string | undefined, defaultValue: number): number | null => {
        if (!value || value === 'unlimited') return null;
        const parsed = parseInt(value);
        return isNaN(parsed) ? defaultValue : parsed;
      };

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
        // Atualizar usuário existente
        await supabase
          .from('users')
          .update({
            stripe_customer_id: customerId,
            plan: metadata.plan_name?.toLowerCase() || 'starter',
            emails_limit: parseLimit(metadata.emails_limit, 500),
            shops_limit: parseLimit(metadata.shops_limit, 1),
            status: subscription.status === 'active' ? 'active' : 'inactive',
          })
          .eq('id', userId);
      } else {
        // Gerar UUID manualmente
        const newUserId = crypto.randomUUID();

        // Criar novo usuário com ID explícito
        const { error: createError } = await supabase
          .from('users')
          .insert({
            id: newUserId,
            email: customer.email.toLowerCase(),
            name: customer.name || metadata.user_name || null,
            plan: metadata.plan_name?.toLowerCase() || 'starter',
            emails_limit: parseLimit(metadata.emails_limit, 500),
            shops_limit: parseLimit(metadata.shops_limit, 1),
            emails_used: 0,
            stripe_customer_id: customerId,
            status: subscription.status === 'active' ? 'active' : 'inactive',
          });

        if (createError) {
          throw new Error(`Erro ao criar usuário: ${createError.message}`);
        }
        userId = newUserId;
      }

      // Criar/atualizar subscription no banco
      const priceId = subscription.items.data[0]?.price.id;

      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('stripe_subscription_id', subscription.id)
        .single();

      const subscriptionData = {
        user_id: userId,
        plan_id: metadata.plan_id || null,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        status: subscription.status === 'active' ? 'active' : subscription.status,
        billing_cycle: priceId?.includes('year') ? 'yearly' : 'monthly',
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
      };

      if (existingSub) {
        await supabase
          .from('subscriptions')
          .update(subscriptionData)
          .eq('id', existingSub.id);
      } else {
        await supabase
          .from('subscriptions')
          .insert(subscriptionData);
      }

      // Atualizar metadata do customer no Stripe
      await stripe.customers.update(customerId, {
        metadata: { user_id: userId },
      });

      return new Response(
        JSON.stringify({
          success: true,
          user_id: userId,
          message: existingUser ? 'Usuário atualizado' : 'Usuário criado',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar estrutura da tabela users
    if (action === 'check-users-table') {
      const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'users' });

      // Se a função não existir, criar uma query direta
      if (error) {
        const { data: columns, error: colError } = await supabase
          .from('users')
          .select('*')
          .limit(0);

        return new Response(
          JSON.stringify({
            message: 'Não foi possível obter estrutura da tabela',
            hint: 'Execute no Supabase SQL Editor: SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = \'users\';',
            error: error?.message
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ columns: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default: mostrar instruções
    return new Response(
      JSON.stringify({
        message: 'Stripe Debug API',
        endpoints: {
          'GET ?action=sessions': 'Lista as 10 sessões de checkout mais recentes',
          'GET ?action=find-session&subscription_id=sub_xxx': 'Encontra sessão por subscription ID',
          'GET ?action=customer&customer_id=cus_xxx': 'Busca customer e usuário no banco',
          'GET ?action=check-users-table': 'Verifica estrutura da tabela users',
          'POST ?action=sync-customer': 'Sincroniza/cria usuário a partir de customer (body: { customer_id: "cus_xxx" })',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

```

File: `supabase/functions/admin-delete-client/index.ts`
```ts
/**
 * Edge Function: Admin Delete Client
 *
 * Deleta um cliente completamente:
 * - Cancela assinatura no Stripe
 * - Remove dados do Supabase (users, shops, subscriptions, etc)
 * - Remove usuário do Auth
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import Stripe from 'https://esm.sh/stripe@20.2.0?target=deno';
import { maskEmail } from '../_shared/email.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'DELETE') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Iniciando exclusão do cliente:', userId);

    // 1. Buscar dados do usuário
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Usuário não encontrado:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Usuário encontrado:', maskEmail(user.email));

    // 2. Buscar e cancelar assinatura no Stripe
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', userId)
      .single();

    if (subscription?.stripe_subscription_id) {
      try {
        console.log('Cancelando assinatura no Stripe:', subscription.stripe_subscription_id);
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        console.log('Assinatura cancelada com sucesso');
      } catch (stripeError) {
        console.error('Erro ao cancelar assinatura (pode já estar cancelada):', stripeError);
        // Continua mesmo se falhar - a assinatura pode já estar cancelada
      }
    }

    // 3. Deletar dados relacionados no Supabase (ordem importa por causa das FK)

    // 3.1 Deletar mensagens das conversas das lojas do usuário
    const { data: shops } = await supabase
      .from('shops')
      .select('id')
      .eq('user_id', userId);

    if (shops && shops.length > 0) {
      const shopIds = shops.map(s => s.id);

      // Buscar conversas dessas lojas
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .in('shop_id', shopIds);

      if (conversations && conversations.length > 0) {
        const conversationIds = conversations.map(c => c.id);

        // Deletar mensagens
        const { error: messagesError } = await supabase
          .from('messages')
          .delete()
          .in('conversation_id', conversationIds);

        if (messagesError) {
          console.error('Erro ao deletar mensagens:', messagesError);
        } else {
          console.log('Mensagens deletadas');
        }

        // Deletar conversas
        const { error: convsError } = await supabase
          .from('conversations')
          .delete()
          .in('id', conversationIds);

        if (convsError) {
          console.error('Erro ao deletar conversas:', convsError);
        } else {
          console.log('Conversas deletadas');
        }
      }

      // 3.2 Deletar email_processing_logs das lojas
      const { error: logsError } = await supabase
        .from('email_processing_logs')
        .delete()
        .in('shop_id', shopIds);

      if (logsError) {
        console.error('Erro ao deletar logs:', logsError);
      }

      // 3.3 Deletar rate_limits das lojas
      const { error: rateLimitsError } = await supabase
        .from('rate_limits')
        .delete()
        .in('shop_id', shopIds);

      if (rateLimitsError) {
        console.error('Erro ao deletar rate limits:', rateLimitsError);
      }

      // 3.4 Deletar lojas
      const { error: shopsError } = await supabase
        .from('shops')
        .delete()
        .eq('user_id', userId);

      if (shopsError) {
        console.error('Erro ao deletar lojas:', shopsError);
      } else {
        console.log('Lojas deletadas');
      }
    }

    // 3.5 Deletar coupon_usages
    const { error: couponError } = await supabase
      .from('coupon_usages')
      .delete()
      .eq('user_id', userId);

    if (couponError) {
      console.error('Erro ao deletar coupon usages:', couponError);
    }

    // 3.6 Deletar email_extra_purchases
    const { error: extraEmailsError } = await supabase
      .from('email_extra_purchases')
      .delete()
      .eq('user_id', userId);

    if (extraEmailsError) {
      console.error('Erro ao deletar extra emails:', extraEmailsError);
    }

    // 3.7 Deletar subscription
    const { error: subError } = await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', userId);

    if (subError) {
      console.error('Erro ao deletar subscription:', subError);
    } else {
      console.log('Subscription deletada');
    }

    // 3.8 Deletar usuário da tabela users
    const { error: deleteUserError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteUserError) {
      console.error('Erro ao deletar usuário:', deleteUserError);
      throw new Error(`Erro ao deletar usuário: ${deleteUserError.message}`);
    }
    console.log('Usuário deletado da tabela users');

    // 4. Deletar usuário do Auth
    try {
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) {
        console.error('Erro ao deletar do Auth:', authError);
        // Não falha se o usuário não existir no Auth
      } else {
        console.log('Usuário deletado do Auth');
      }
    } catch (authErr) {
      console.error('Exceção ao deletar do Auth:', authErr);
    }

    console.log('Cliente deletado com sucesso:', userId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cliente deletado com sucesso',
        deletedUser: user.email
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao deletar cliente:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao deletar cliente' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

```

**10. Logica extra de billing (trial, extras, uso mensal, cron)**

Trial period:
- `accept-migration-invite` calcula `trial_days` baseado em `migration_invites.billing_start_date`.
- Cria checkout com `subscription_data.trial_end` igual ao inicio de cobranca.

Cobrança por email extra:
- `email_extra_purchases` armazena invoices e status.
- `charge-extra-emails` cria invoice item + invoice no Stripe e tenta cobrar automaticamente.
- `pay-pending-invoice` permite pagar invoices pendentes via cartao salvo ou Stripe Checkout `mode: 'payment'`.
- `stripe-webhook` confirma compra quando recebe `checkout.session.completed` com `metadata.type='extra_emails_payment'`.
- `process-emails` e `process-shop-emails` chamam `increment_pending_extra_email` e disparam `charge-extra-emails` quando o pacote atinge o limite.

Controle de uso / reset:
- Funcoes SQL: `check_credits_available`, `try_reserve_credit`, `reset_email_counters`, `get_user_credits_status`.
- Reset mensal efetivo ocorre em `invoice.paid` (webhook) e em `update-subscription` (upgrade/downgrade), que zeram `emails_used` e extras.
- Nao foi encontrado cron especifico para reset mensal; o reset depende do webhook de pagamento.

Grace period:
- Nao ha regra explicita de grace period. O fluxo usa `invoice.payment_failed` para suspender (`users.status='suspended'`) e `invoice.paid` para reativar.

Cron jobs:
- `process-emails` e `process-queue` sao agendados via Supabase/Vercel; eles podem disparar cobranca de extras.

**11. Supabase RLS (billing)**

Fonte: `supabase/migrations/004_admin_panel_schema.sql` e `005_email_extras_billing.sql`.

Policies:
- `plans`: SELECT permitido para qualquer usuario ativo; service_role gerencia.
- `subscriptions`: usuario ve as proprias; service_role gerencia.
- `coupons`: service_role gerencia.
- `coupon_usages`: usuario ve os proprios; service_role gerencia.
- `email_extra_purchases`: usuario ve os proprios; service_role gerencia.

Service role no billing:
- `stripe-webhook`, `sync-stripe-customer`, `admin-get-clients`, `admin-delete-client`, `update-subscription` usam `SUPABASE_SERVICE_ROLE_KEY` para bypass de RLS e operacoes administrativas.

**12. Portal do cliente**

Existe. Implementacao:
- Edge Function `create-billing-portal` cria sessao no Stripe Customer Portal.
- `src/pages/Account.tsx` chama essa funcao e redireciona o usuario.
- O portal permite gerenciar cartao, ver faturas e dados de cobranca (conforme configuracao do Stripe).

