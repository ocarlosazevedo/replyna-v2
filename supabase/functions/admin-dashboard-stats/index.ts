/**
 * Edge Function: Admin Dashboard Stats
 *
 * Retorna estatísticas do dashboard admin bypassing RLS
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Obter parâmetros de data
    const url = new URL(req.url);
    const dateStart = url.searchParams.get('dateStart') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const dateEnd = url.searchParams.get('dateEnd') || new Date().toISOString();

    console.log('Buscando stats do dashboard:', { dateStart, dateEnd });

    // Executar todas as queries em paralelo
    const [
      totalUsersRes,
      activeUsersRes,
      totalShopsRes,
      activeShopsRes,
      conversationsRes,
      totalMessagesRes,
      inboundEmailsRes,
      outboundEmailsRes,
      humanEmailsRes,
      newUsersInPeriodRes,
      categoriesRes,
      recentUsersRes,
      shopsRes,
      allUsersForPlansRes,
      usersWithLimitsRes,
      recentConversationsRes,
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('shops').select('*', { count: 'exact', head: true }),
      supabase.from('shops').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dateStart)
        .lte('created_at', dateEnd),
      supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dateStart)
        .lte('created_at', dateEnd),
      // E-mails recebidos (inbound, excluindo spam e acknowledgment)
      // Acknowledgment são emails que não precisam de resposta (cliente dizendo "ok", "obrigado", etc.)
      supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('direction', 'inbound')
        .not('category', 'in', '("spam","acknowledgment")')
        .gte('created_at', dateStart)
        .lte('created_at', dateEnd),
      // E-mails respondidos (outbound)
      supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('direction', 'outbound')
        .gte('created_at', dateStart)
        .lte('created_at', dateEnd),
      // Conversas encaminhadas para humano (status pending_human)
      // Conta CONVERSAS ao invés de mensagens para consistência com a lista
      // Exclui troca_devolucao_reembolso pois são encaminhados mas não devem penalizar a taxa
      supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending_human')
        .neq('category', 'troca_devolucao_reembolso')
        .gte('created_at', dateStart)
        .lte('created_at', dateEnd),
      supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dateStart)
        .lte('created_at', dateEnd),
      supabase
        .from('conversations')
        .select('category')
        .gte('created_at', dateStart)
        .lte('created_at', dateEnd),
      supabase
        .from('users')
        .select('id, name, email, plan, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('shops').select('user_id, id, name'),
      supabase.from('users').select('id, name, email, plan'),
      supabase.from('users').select('emails_used, emails_limit'),
      // Conversas recentes para o Super Inbox
      // Busca conversas finalizadas OU spam no período (excluindo as ainda em processamento)
      supabase
        .from('conversations')
        .select('id, shop_id, customer_email, customer_name, subject, category, status, created_at, last_message_at')
        .not('category', 'is', null) // Excluir conversas ainda em processamento
        .gte('created_at', dateStart)
        .lte('created_at', dateEnd)
        .or('status.in.(replied,pending_human,closed),category.eq.spam')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(200),
    ]);

    // Contar usuários no limite (emails_used >= emails_limit)
    const usersAtLimitCount = (usersWithLimitsRes.data || []).filter(
      (u: { emails_used: number; emails_limit: number }) => u.emails_used >= u.emails_limit && u.emails_limit > 0
    ).length;

    // Processar categorias (ignorar conversas sem categoria - ainda estão processando)
    const categories: Record<string, number> = {};
    (categoriesRes.data || []).forEach((conv: { category?: string }) => {
      if (!conv.category) return; // Ignorar conversas sem categoria
      categories[conv.category] = (categories[conv.category] || 0) + 1;
    });

    // Processar lojas para lookup
    const shopCountByUser: Record<string, number> = {};
    const shopById: Record<string, { id: string; name: string; user_id: string }> = {};
    (shopsRes.data || []).forEach((shop: { user_id: string; id: string; name: string }) => {
      shopCountByUser[shop.user_id] = (shopCountByUser[shop.user_id] || 0) + 1;
      shopById[shop.id] = shop;
    });

    const recentUsers = (recentUsersRes.data || []).map(
      (user: { id: string; name: string | null; email: string; plan: string; created_at: string }) => ({
        ...user,
        shops_count: shopCountByUser[user.id] || 0,
      })
    );

    // Processar conversas recentes com dados da loja
    const recentConversations = (recentConversationsRes.data || []).map(
      (conv: {
        id: string;
        shop_id: string;
        customer_email: string;
        customer_name: string | null;
        subject: string | null;
        category: string | null;
        status: string | null;
        created_at: string;
        last_message_at: string | null;
      }) => ({
        ...conv,
        shop_name: shopById[conv.shop_id]?.name || 'Loja desconhecida',
      })
    );

    // Distribuição de planos e lista de clientes
    const planDistribution: Record<string, number> = {};
    const clients: Array<{ id: string; name: string | null; email: string; shops: string[] }> = [];

    (allUsersForPlansRes.data || []).forEach((user: { id: string; name: string | null; email: string; plan: string }) => {
      const plan = user.plan || 'starter';
      planDistribution[plan] = (planDistribution[plan] || 0) + 1;

      // Encontrar as lojas deste usuário
      const userShops = (shopsRes.data || [])
        .filter((shop: { user_id: string }) => shop.user_id === user.id)
        .map((shop: { id: string }) => shop.id);

      if (userShops.length > 0) {
        clients.push({
          id: user.id,
          name: user.name,
          email: user.email,
          shops: userShops,
        });
      }
    });

    // Ordenar clientes por nome/email
    clients.sort((a, b) => {
      const nameA = a.name || a.email;
      const nameB = b.name || b.email;
      return nameA.localeCompare(nameB);
    });

    // Métricas de email
    const emailsReceived = inboundEmailsRes.count || 0;
    const emailsReplied = outboundEmailsRes.count || 0;
    const humanEmails = humanEmailsRes.count || 0;

    // Taxa de automação = emails respondidos / emails recebidos
    const automationRate = emailsReceived > 0
      ? Math.round((emailsReplied / emailsReceived) * 100)
      : 0;

    // Taxa de sucesso = (emails respondidos - emails humanos) / emails respondidos
    // Representa % de emails resolvidos automaticamente sem intervenção humana
    const successRate = emailsReplied > 0
      ? Math.round(((emailsReplied - humanEmails) / emailsReplied) * 100)
      : 0;

    const stats = {
      totalUsers: totalUsersRes.count || 0,
      activeUsers: activeUsersRes.count || 0,
      totalShops: totalShopsRes.count || 0,
      activeShops: activeShopsRes.count || 0,
      totalConversations: conversationsRes.count || 0,
      totalMessages: totalMessagesRes.count || 0,
      // Novas métricas de email
      emailsReceived,
      emailsReplied,
      humanEmails,
      automationRate,
      successRate,
      // Métricas existentes
      newUsersInPeriod: newUsersInPeriodRes.count || 0,
      usersAtLimit: usersAtLimitCount,
      categories,
    };

    console.log('Stats calculados:', stats);

    return new Response(
      JSON.stringify({
        stats,
        recentUsers,
        planDistribution,
        recentConversations,
        clients,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao buscar stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
