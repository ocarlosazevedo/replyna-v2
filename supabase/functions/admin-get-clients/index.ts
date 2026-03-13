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
    const [usersResult, shopsResult, plansResult, subscriptionsResult, teamMembersResult, teamInvitesResult] = await Promise.all([
      supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('shops')
        .select('id, name, shopify_domain, is_active, user_id'),
      supabase
        .from('plans')
        .select('id, name, slug, price_monthly, emails_limit, shops_limit, is_active')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('subscriptions')
        .select('user_id, asaas_subscription_id, status, current_period_end, cancel_at_period_end'),
      supabase
        .from('team_members')
        .select('id, owner_user_id, member_user_id, role, allowed_shop_ids, created_at'),
      supabase
        .from('team_invites')
        .select('id, owner_user_id, invited_email, invited_name, role, status, created_at')
        .eq('status', 'pending'),
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
      asaas_subscription_id: string;
      status: string;
      current_period_end: string;
      cancel_at_period_end: boolean | null;
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
          asaas_subscription_id: sub.asaas_subscription_id,
          status: sub.status,
          current_period_end: sub.current_period_end,
          cancel_at_period_end: sub.cancel_at_period_end ?? null,
        };
      }
    });

    // Agrupar team_members por owner
    const teamMembersByOwner: Record<string, Array<{
      id: string;
      member_user_id: string;
      member_name: string | null;
      member_email: string;
      role: string;
      allowed_shop_ids: string[];
      created_at: string;
    }>> = {};

    // Criar lookup de users para resolver nomes dos membros
    const usersById: Record<string, { name: string | null; email: string }> = {};
    (usersResult.data || []).forEach((u) => {
      usersById[u.id] = { name: u.name, email: u.email };
    });

    (teamMembersResult.data || []).forEach((tm) => {
      if (!teamMembersByOwner[tm.owner_user_id]) {
        teamMembersByOwner[tm.owner_user_id] = [];
      }
      const memberInfo = usersById[tm.member_user_id];
      teamMembersByOwner[tm.owner_user_id].push({
        id: tm.id,
        member_user_id: tm.member_user_id,
        member_name: memberInfo?.name || null,
        member_email: memberInfo?.email || 'Email desconhecido',
        role: tm.role,
        allowed_shop_ids: tm.allowed_shop_ids || [],
        created_at: tm.created_at,
      });
    });

    // Agrupar convites pendentes por owner
    const pendingInvitesByOwner: Record<string, Array<{
      id: string;
      invited_email: string;
      invited_name: string | null;
      role: string;
      created_at: string;
    }>> = {};

    (teamInvitesResult.data || []).forEach((inv) => {
      if (!pendingInvitesByOwner[inv.owner_user_id]) {
        pendingInvitesByOwner[inv.owner_user_id] = [];
      }
      pendingInvitesByOwner[inv.owner_user_id].push({
        id: inv.id,
        invited_email: inv.invited_email,
        invited_name: inv.invited_name,
        role: inv.role,
        created_at: inv.created_at,
      });
    });

    // Combinar dados
    const clients = (usersResult.data || []).map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      whatsapp_number: user.whatsapp_number,
      emails_limit: user.emails_limit,
      emails_used: user.emails_used,
      extra_emails_purchased: user.extra_emails_purchased || 0,
      shops_limit: user.shops_limit,
      status: user.status,
      is_trial: user.is_trial ?? false,
      trial_ends_at: user.trial_ends_at ?? null,
      created_at: user.created_at,
      last_login_at: user.last_login_at,
      stripe_customer_id: user.stripe_customer_id,
      shops: shopsByUser[user.id] || [],
      subscription: subscriptionsByUser[user.id] || null,
      team_members: teamMembersByOwner[user.id] || [],
      team_pending_invites: pendingInvitesByOwner[user.id] || [],
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
