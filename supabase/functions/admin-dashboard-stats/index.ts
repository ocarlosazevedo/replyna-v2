/**
 * Edge Function: Admin Dashboard Stats
 *
 * Retorna estatísticas do dashboard admin bypassing RLS
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

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
      autoRepliedRes,
      newUsersInPeriodRes,
      emailsProcessedRes,
      categoriesRes,
      recentUsersRes,
      shopsRes,
      allUsersForPlansRes,
      usersWithLimitsRes,
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
      // Mensagens inbound que foram auto-respondidas (excluindo spam)
      supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('direction', 'inbound')
        .eq('was_auto_replied', true)
        .neq('category', 'spam')
        .gte('created_at', dateStart)
        .lte('created_at', dateEnd),
      supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dateStart)
        .lte('created_at', dateEnd),
      // Mensagens inbound excluindo spam (base para cálculo da taxa de automação)
      supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('direction', 'inbound')
        .neq('category', 'spam')
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
      supabase.from('shops').select('user_id'),
      supabase.from('users').select('plan'),
      supabase.from('users').select('emails_used, emails_limit'),
    ]);

    // Contar usuários no limite (emails_used >= emails_limit)
    const usersAtLimitCount = (usersWithLimitsRes.data || []).filter(
      (u: { emails_used: number; emails_limit: number }) => u.emails_used >= u.emails_limit && u.emails_limit > 0
    ).length;

    // Processar categorias
    const categories: Record<string, number> = {};
    (categoriesRes.data || []).forEach((conv: { category?: string }) => {
      const cat = conv.category || 'outros';
      categories[cat] = (categories[cat] || 0) + 1;
    });

    // Processar usuários recentes com contagem de lojas
    const shopCountByUser: Record<string, number> = {};
    (shopsRes.data || []).forEach((shop: { user_id: string }) => {
      shopCountByUser[shop.user_id] = (shopCountByUser[shop.user_id] || 0) + 1;
    });

    const recentUsers = (recentUsersRes.data || []).map(
      (user: { id: string; name: string | null; email: string; plan: string; created_at: string }) => ({
        ...user,
        shops_count: shopCountByUser[user.id] || 0,
      })
    );

    // Distribuição de planos
    const planDistribution: Record<string, number> = {};
    (allUsersForPlansRes.data || []).forEach((user: { plan: string }) => {
      const plan = user.plan || 'starter';
      planDistribution[plan] = (planDistribution[plan] || 0) + 1;
    });

    // Taxa de automação = emails inbound auto-respondidos / emails inbound (excluindo spam)
    const inboundExcludingSpam = emailsProcessedRes.count || 0;
    const autoRepliedCount = autoRepliedRes.count || 0;

    const stats = {
      totalUsers: totalUsersRes.count || 0,
      activeUsers: activeUsersRes.count || 0,
      totalShops: totalShopsRes.count || 0,
      activeShops: activeShopsRes.count || 0,
      totalConversations: conversationsRes.count || 0,
      totalMessages: totalMessagesRes.count || 0,
      automationRate: inboundExcludingSpam > 0
        ? Math.round((autoRepliedCount / inboundExcludingSpam) * 100)
        : 0,
      newUsersInPeriod: newUsersInPeriodRes.count || 0,
      emailsProcessed: inboundExcludingSpam,
      usersAtLimit: usersAtLimitCount,
      categories,
    };

    console.log('Stats calculados:', stats);

    return new Response(
      JSON.stringify({
        stats,
        recentUsers,
        planDistribution,
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
