/**
 * Edge Function: Get Financial Stats (Asaas)
 *
 * Busca dados financeiros via Asaas e complementa com Supabase.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';
import { getBalance, getPaymentStatistics, getPaymentsByDateRange } from '../_shared/asaas.ts';

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

function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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
    const url = new URL(req.url);
    const period = url.searchParams.get('period') || '6months';
    const customStartDate = url.searchParams.get('startDate');
    const customEndDate = url.searchParams.get('endDate');

    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date = now;

    if (period === 'custom' && customStartDate && customEndDate) {
      periodStart = new Date(customStartDate);
      periodEnd = new Date(customEndDate);
      periodEnd.setHours(23, 59, 59, 999);
    } else {
      switch (period) {
        case '7days':
          periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '3months':
          periodStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          break;
        case '12months':
          periodStart = new Date(now.getFullYear(), now.getMonth() - 12, 1);
          break;
        case 'all':
          periodStart = new Date(2020, 0, 1);
          break;
        case '6months':
        default:
          periodStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
          break;
      }
    }

    const supabase = getSupabaseAdmin();

    const [
      balance,
      subscriptionsResult,
      totalCustomersResult,
    ] = await Promise.all([
      getBalance(),
      supabase
        .from('subscriptions')
        .select('status, plan_id, plans(name, price_monthly)')
        .in('status', ['active', 'trialing', 'past_due', 'canceled']),
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true }),
    ]);

    const subs = subscriptionsResult.data || [];
    const totalCustomers = totalCustomersResult.count || 0;

    let mrr = 0;
    const subscriptionsByStatus = {
      active: 0,
      past_due: 0,
      canceled: 0,
      trialing: 0,
    };
    const planCounts: Record<string, number> = {};

    for (const sub of subs) {
      const status = sub.status as keyof typeof subscriptionsByStatus;
      if (subscriptionsByStatus[status] !== undefined) {
        subscriptionsByStatus[status] += 1;
      }

      if (sub.status === 'active') {
        const planName = sub.plans?.name || 'Starter';
        const price = Number(sub.plans?.price_monthly || 0);
        mrr += price;
        planCounts[planName] = (planCounts[planName] || 0) + 1;
      }
    }

    const arr = mrr * 12;
    const activeSubscriptions = subscriptionsByStatus.active;

    const startDateStr = formatDateYYYYMMDD(periodStart);
    const endDateStr = formatDateYYYYMMDD(periodEnd);

    const paymentStats = await getPaymentStatistics({
      startDate: startDateStr,
      endDate: endDateStr,
    });

    const paymentsInPeriod = await getPaymentsByDateRange({
      startDate: startDateStr,
      endDate: endDateStr,
      status: 'CONFIRMED',
    });

    const revenueInPeriod = paymentsInPeriod.data?.reduce((sum, p) => sum + Number(p.value || 0), 0) || 0;
    const chargesInPeriod = paymentsInPeriod.data?.length || 0;

    const newSubscriptionsResult = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString());

    const canceledSubscriptionsResult = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .gte('canceled_at', periodStart.toISOString())
      .lte('canceled_at', periodEnd.toISOString());

    const periodMetrics = {
      revenueInPeriod,
      newSubscriptionsInPeriod: newSubscriptionsResult.count || 0,
      canceledSubscriptionsInPeriod: canceledSubscriptionsResult.count || 0,
      chargesInPeriod,
    };

    const recentPayments = (paymentsInPeriod.data || []).slice(0, 10).map((p) => ({
      id: p.id,
      amount: Number(p.value || 0) * 100,
      currency: 'brl',
      status: p.status || 'unknown',
      customer_email: null,
      customer_name: null,
      description: null,
      created: p.createdAt ? Math.floor(new Date(p.createdAt).getTime() / 1000) : Math.floor(Date.now() / 1000),
    }));

    const recentInvoices = (paymentsInPeriod.data || []).slice(0, 10).map((p) => ({
      id: p.id,
      number: null,
      amount_due: Number(p.value || 0) * 100,
      amount_paid: Number(p.value || 0) * 100,
      status: p.status || null,
      customer_email: null,
      customer_name: null,
      created: p.createdAt ? Math.floor(new Date(p.createdAt).getTime() / 1000) : Math.floor(Date.now() / 1000),
      hosted_invoice_url: p.invoiceUrl || null,
    }));

    const subscriptionsByPlan = Object.entries(planCounts).map(([plan_name, count]) => ({
      plan_name,
      count,
    }));

    const monthlyRevenue: { month: string; revenue: number }[] = [];

    const stats: FinancialStats = {
      balance: {
        available: balance.available || balance.balance || 0,
        pending: balance.pending || 0,
        currency: 'BRL',
      },
      mrr,
      arr,
      activeSubscriptions,
      totalCustomers,
      revenueThisMonth: paymentStats.totalValue || 0,
      revenueLastMonth: 0,
      revenueGrowth: 0,
      churnRate: activeSubscriptions > 0
        ? (subscriptionsByStatus.canceled / activeSubscriptions) * 100
        : 0,
      averageTicket: chargesInPeriod > 0 ? revenueInPeriod / chargesInPeriod : 0,
      recentPayments,
      recentInvoices,
      subscriptionsByStatus,
      subscriptionsByPlan,
      monthlyRevenue,
      periodMetrics,
    };

    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro ao buscar dados financeiros:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
