/**
 * Edge Function: Admin Get Clients
 *
 * Lista todos os clientes com suas lojas.
 * Usa service role key para bypassar RLS.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Usar service role key para bypassar RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Buscar todos os dados em paralelo
    const [usersResult, shopsResult, plansResult, subscriptionsResult] = await Promise.all([
      supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('shops')
        .select('id, name, shopify_domain, is_active, user_id'),
      supabase
        .from('plans')
        .select('id, name, emails_limit, shops_limit, is_active')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('subscriptions')
        .select('user_id, stripe_subscription_id, status, current_period_end'),
    ]);

    if (usersResult.error) {
      console.error('Erro ao buscar usuários:', usersResult.error);
      throw new Error(`Erro ao buscar usuários: ${usersResult.error.message}`);
    }

    // Agrupar lojas por usuário
    const shopsByUser: Record<string, Array<{
      id: string;
      name: string;
      shopify_domain: string;
      is_active: boolean;
    }>> = {};

    (shopsResult.data || []).forEach((shop) => {
      if (!shopsByUser[shop.user_id]) {
        shopsByUser[shop.user_id] = [];
      }
      shopsByUser[shop.user_id].push({
        id: shop.id,
        name: shop.name,
        shopify_domain: shop.shopify_domain,
        is_active: shop.is_active,
      });
    });

    // Agrupar subscriptions por usuário
    const subscriptionsByUser: Record<string, {
      stripe_subscription_id: string;
      status: string;
      current_period_end: string;
    }> = {};

    // Priorizar subscription ativa sobre cancelada
    // Usuários podem ter múltiplas subscriptions (ex: cancelou e reativou)
    const statusPriority: Record<string, number> = {
      'active': 0,
      'trialing': 1,
      'past_due': 2,
      'unpaid': 3,
      'canceled': 4,
    };

    (subscriptionsResult.data || []).forEach((sub) => {
      const existing = subscriptionsByUser[sub.user_id];
      const existingPriority = existing ? (statusPriority[existing.status] ?? 99) : 99;
      const newPriority = statusPriority[sub.status] ?? 99;

      // Só sobrescrever se a nova subscription tem status de maior prioridade
      if (newPriority < existingPriority) {
        subscriptionsByUser[sub.user_id] = {
          stripe_subscription_id: sub.stripe_subscription_id,
          status: sub.status,
          current_period_end: sub.current_period_end,
        };
      }
    });

    // Combinar dados
    const clients = (usersResult.data || []).map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      emails_limit: user.emails_limit,
      emails_used: user.emails_used,
      shops_limit: user.shops_limit,
      status: user.status,
      created_at: user.created_at,
      last_login_at: user.last_login_at,
      stripe_customer_id: user.stripe_customer_id,
      shops: shopsByUser[user.id] || [],
      subscription: subscriptionsByUser[user.id] || null,
    }));

    return new Response(
      JSON.stringify({
        clients,
        plans: plansResult.data || [],
        total: clients.length,
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
