/**
 * Edge Function: Get Financial Stats (Supabase + Asaas)
 *
 * Supabase: fonte principal para métricas de assinaturas.
 * Asaas: somente financeiro (saldo, receitas, pagamentos).
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface AsaasListResponse<T> {
  data: T[];
  totalCount?: number;
  hasMore?: boolean;
}

interface AsaasSubscription {
  id: string;
  customer: string;
  value: number;
  status?: string;
  description?: string;
  createdAt?: string;
  dateCreated?: string;
}

interface AsaasPayment {
  id: string;
  customer: string;
  value: number;
  status?: string;
  invoiceUrl?: string | null;
  dueDate?: string;
  createdAt?: string;
  dateCreated?: string;
  description?: string | null;
}

interface AsaasBalance {
  balance: number;
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
    partners: number;
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
    availableBalance: number;
    revenueInPeriod: number;
    newSubscriptionsInPeriod: number;
    canceledSubscriptionsInPeriod: number;
    chargesInPeriod: number;
  };
}

const ASAAS_BASE_URL = Deno.env.get('ASAAS_BASE_URL') || 'https://api.asaas.com/v3';
const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');

function assertApiKey(): void {
  if (!ASAAS_API_KEY) throw new Error('ASAAS_API_KEY nao configurada');
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null);
  if (entries.length === 0) return '';
  return `?${entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')}`;
}

async function asaasRequest<T>(method: HttpMethod, path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  assertApiKey();
  const url = `${ASAAS_BASE_URL}${path}${params ? buildQuery(params) : ''}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY!,
    },
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch (err) {
    console.error('[ASAAS] Falha ao parsear JSON:', err);
  }

  if (!response.ok) {
    console.error(`[ASAAS] Error ${response.status}:`, JSON.stringify(data));
    throw new Error(`Asaas API error: ${response.status} - ${JSON.stringify(data)}`);
  }

  return data as T;
}

async function fetchPage<T>(path: string, params: Record<string, string | number | boolean | undefined>, limit = 100, offset = 0) {
  return await asaasRequest<AsaasListResponse<T>>('GET', path, { ...params, limit, offset });
}

async function fetchAll<T>(path: string, params: Record<string, string | number | boolean | undefined>): Promise<{ data: T[]; totalCount: number }> {
  const first = await fetchPage<T>(path, params, 100, 0);
  const totalCount = typeof first.totalCount === 'number' ? first.totalCount : first.data.length;

  if (totalCount <= 100) {
    return { data: first.data || [], totalCount };
  }

  const offsets: number[] = [];
  for (let offset = 100; offset < totalCount; offset += 100) {
    offsets.push(offset);
  }

  const results: T[] = [...(first.data || [])];
  const batchSize = 5;

  for (let i = 0; i < offsets.length; i += batchSize) {
    const batch = offsets.slice(i, i + batchSize);
    const pages = await Promise.all(batch.map((offset) => fetchPage<T>(path, params, 100, offset)));
    for (const page of pages) {
      results.push(...(page.data || []));
    }
  }

  return { data: results, totalCount };
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

function formatMonthLabel(date: Date): string {
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(date);
  const cleaned = label.replace('.', '');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function toUnixSeconds(value?: string): number {
  const date = value ? new Date(value) : new Date();
  return Math.floor(date.getTime() / 1000);
}

function sumPayments(payments: AsaasPayment[]): number {
  return payments.reduce((sum, p) => sum + Number(p.value || 0), 0);
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const startDateParam = url.searchParams.get('startDate');
    const endDateParam = url.searchParams.get('endDate');

    const now = new Date();
    const periodStart = startDateParam
      ? new Date(startDateParam)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    let periodEnd = endDateParam
      ? new Date(endDateParam)
      : new Date(now);
    // Se o filtro for "Este mês" (início no 1º dia e fim em hoje),
    // usar o último dia do mês completo para bater com o Asaas.
    if (startDateParam && endDateParam) {
      const startIsFirstDay = periodStart.getDate() === 1;
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endParamDate = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate());
      const sameMonth = periodStart.getFullYear() === now.getFullYear() && periodStart.getMonth() === now.getMonth();
      if (startIsFirstDay && sameMonth && endParamDate.getTime() === today.getTime()) {
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }
    }
    periodEnd.setHours(23, 59, 59, 999);

    const periodStartStr = formatDateYYYYMMDD(periodStart);
    const periodEndStr = formatDateYYYYMMDD(periodEnd);

    const prevMonthStart = new Date(periodStart.getFullYear(), periodStart.getMonth() - 1, 1);
    const prevMonthEnd = new Date(periodStart.getFullYear(), periodStart.getMonth(), 0);
    const prevMonthStartStr = formatDateYYYYMMDD(prevMonthStart);
    const prevMonthEndStr = formatDateYYYYMMDD(prevMonthEnd);

    const sixMonthsStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const sixMonthsEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const sixMonthsStartStr = formatDateYYYYMMDD(sixMonthsStart);
    const sixMonthsEndStr = formatDateYYYYMMDD(sixMonthsEnd);

    const supabase = getSupabaseAdmin();

    const supabasePromise = Promise.all([
      supabase
        .from('subscriptions')
        .select('plan_id, plans(name, price_monthly)')
        .eq('status', 'active')
        .not('asaas_subscription_id', 'is', null),
      supabase
        .from('subscriptions')
        .select('status')
        .not('asaas_subscription_id', 'is', null),
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .not('asaas_subscription_id', 'is', null)
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodEnd.toISOString()),
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .not('asaas_subscription_id', 'is', null)
        .gte('canceled_at', periodStart.toISOString())
        .lte('canceled_at', periodEnd.toISOString()),
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .not('asaas_subscription_id', 'is', null)
        .lte('created_at', periodStart.toISOString())
        .or(`canceled_at.is.null,canceled_at.gt.${periodStart.toISOString()}`),
      supabase
        .from('users')
        .select('asaas_customer_id, name, email')
        .not('asaas_customer_id', 'is', null),
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('is_trial', true)
        .eq('status', 'active'),
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('plan', 'partners'),
    ]);

    const asaasPromise = Promise.all([
      asaasRequest<AsaasBalance>('GET', '/finance/balance'),
      fetchAll<AsaasPayment>('/payments', {
        status: 'CONFIRMED',
        'dueDate[ge]': periodStartStr,
        'dueDate[le]': periodEndStr,
      }),
      fetchAll<AsaasPayment>('/payments', {
        status: 'RECEIVED',
        'dueDate[ge]': periodStartStr,
        'dueDate[le]': periodEndStr,
      }),
      fetchAll<AsaasPayment>('/payments', {
        status: 'CONFIRMED',
        'dueDate[ge]': prevMonthStartStr,
        'dueDate[le]': prevMonthEndStr,
      }),
      fetchAll<AsaasPayment>('/payments', {
        status: 'RECEIVED',
        'dueDate[ge]': prevMonthStartStr,
        'dueDate[le]': prevMonthEndStr,
      }),
      fetchAll<AsaasPayment>('/payments', {
        status: 'CONFIRMED',
        'dueDate[ge]': sixMonthsStartStr,
        'dueDate[le]': sixMonthsEndStr,
      }),
      fetchAll<AsaasPayment>('/payments', {
        status: 'RECEIVED',
        'dueDate[ge]': sixMonthsStartStr,
        'dueDate[le]': sixMonthsEndStr,
      }),
      fetchAll<AsaasPayment>('/payments', {
        'dateCreated[ge]': periodStartStr,
        'dateCreated[le]': periodEndStr,
      }),
      asaasRequest<AsaasListResponse<AsaasPayment>>('GET', '/payments', { limit: 10, order: 'desc' }),
    ]);

    const [
      [
        activeSubsRes,
        subsStatusRes,
        newSubsCountRes,
        canceledSubsCountRes,
        activeAtStartRes,
        replynaCustomersRes,
        trialUsersCountRes,
        partnersCountRes,
      ],
      [
        balance,
        paymentsConfirmedInPeriodRes,
        paymentsReceivedInPeriodRes,
        paymentsConfirmedLastMonthRes,
        paymentsReceivedLastMonthRes,
        paymentsConfirmedSixMonthsRes,
        paymentsReceivedSixMonthsRes,
        allChargesInPeriodRes,
        recentPaymentsRes,
      ],
    ] = await Promise.all([supabasePromise, asaasPromise]);

    if (activeSubsRes.error) throw new Error(activeSubsRes.error.message);
    if (subsStatusRes.error) throw new Error(subsStatusRes.error.message);
    if (newSubsCountRes.error) throw new Error(newSubsCountRes.error.message);
    if (canceledSubsCountRes.error) throw new Error(canceledSubsCountRes.error.message);
    if (activeAtStartRes.error) throw new Error(activeAtStartRes.error.message);
    if (replynaCustomersRes.error) throw new Error(replynaCustomersRes.error.message);
    if (trialUsersCountRes.error) throw new Error(trialUsersCountRes.error.message);
    if (partnersCountRes.error) throw new Error(partnersCountRes.error.message);

    const replynaCustomers = replynaCustomersRes.data || [];
    const replynaCustomerIds = new Set(
      replynaCustomers.map((r) => r.asaas_customer_id).filter(Boolean)
    );
    const isReplyna = (customerId?: string | null): boolean => {
      return !!customerId && replynaCustomerIds.has(customerId);
    };

    const activeSubs = activeSubsRes.data || [];
    const mrr = activeSubs.reduce((sum, sub) => {
      const plan = Array.isArray(sub.plans) ? sub.plans[0] : sub.plans;
      return sum + Number(plan?.price_monthly || 0);
    }, 0);

    const activeSubscriptions = activeSubs.length;
    const arr = mrr * 12;
    const averageTicket = activeSubscriptions > 0 ? mrr / activeSubscriptions : 0;

    const statusCounts = { active: 0, past_due: 0, canceled: 0, trialing: 0, partners: 0 };
    (subsStatusRes.data || []).forEach((row: { status: string | null }) => {
      const status = row.status || '';
      if (status === 'active') statusCounts.active += 1;
      else if (status === 'past_due') statusCounts.past_due += 1;
      else if (status === 'canceled') statusCounts.canceled += 1;
      else if (status === 'trialing') statusCounts.trialing += 1;
    });
    statusCounts.trialing = trialUsersCountRes.count || 0;
    statusCounts.partners = partnersCountRes.count || 0;

    const planCounts: Record<string, number> = {};
    activeSubs.forEach((sub) => {
      const plan = Array.isArray(sub.plans) ? sub.plans[0] : sub.plans;
      const planName = plan?.name || 'Plano';
      planCounts[planName] = (planCounts[planName] || 0) + 1;
    });
    const subscriptionsByPlan = Object.entries(planCounts).map(([plan_name, count]) => ({ plan_name, count }));

    const newSubscriptionsInPeriod = newSubsCountRes.count || 0;
    const canceledInPeriod = canceledSubsCountRes.count || 0;
    const activeAtStart = activeAtStartRes.count || 0;
    const churnRate = activeAtStart > 0 ? (canceledInPeriod / activeAtStart) * 100 : 0;

    const paymentsConfirmedInPeriod = (paymentsConfirmedInPeriodRes.data || []).filter((p) => isReplyna(p.customer));
    const paymentsReceivedInPeriod = (paymentsReceivedInPeriodRes.data || []).filter((p) => isReplyna(p.customer));
    const paymentsConfirmedLastMonth = (paymentsConfirmedLastMonthRes.data || []).filter((p) => isReplyna(p.customer));
    const paymentsReceivedLastMonth = (paymentsReceivedLastMonthRes.data || []).filter((p) => isReplyna(p.customer));
    const paymentsConfirmedSixMonths = (paymentsConfirmedSixMonthsRes.data || []).filter((p) => isReplyna(p.customer));
    const paymentsReceivedSixMonths = (paymentsReceivedSixMonthsRes.data || []).filter((p) => isReplyna(p.customer));
    const allChargesInPeriod = (allChargesInPeriodRes.data || []).filter((p) => isReplyna(p.customer));

    const revenueInPeriod = sumPayments([...paymentsConfirmedInPeriod, ...paymentsReceivedInPeriod]);
    const revenueLastMonth = sumPayments([...paymentsConfirmedLastMonth, ...paymentsReceivedLastMonth]);
    const revenueGrowth = revenueLastMonth > 0
      ? ((revenueInPeriod - revenueLastMonth) / revenueLastMonth) * 100
      : (revenueInPeriod > 0 ? 100 : 0);

    const chargesInPeriod = allChargesInPeriod.length;

    const paymentsSixMonths = [...paymentsConfirmedSixMonths, ...paymentsReceivedSixMonths];
    const revenueByMonth = new Map<string, number>();
    for (const payment of paymentsSixMonths) {
      const dateValue = payment.dueDate || payment.dateCreated || payment.createdAt;
      if (!dateValue) continue;
      const date = new Date(dateValue);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + Number(payment.value || 0));
    }

    const monthlyRevenue: { month: string; revenue: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const monthDate = new Date(sixMonthsStart.getFullYear(), sixMonthsStart.getMonth() + i, 1);
      const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      monthlyRevenue.push({
        month: formatMonthLabel(monthDate),
        revenue: revenueByMonth.get(key) || 0,
      });
    }

    const recentPaymentsRaw = (recentPaymentsRes.data || []).filter((p) => isReplyna(p.customer));
    const customerMap: Record<string, { name: string | null; email: string | null }> = {};
    replynaCustomers.forEach((row) => {
      if (row.asaas_customer_id) {
        customerMap[row.asaas_customer_id] = {
          name: row.name || null,
          email: row.email || null,
        };
      }
    });

    const recentPayments = recentPaymentsRaw.map((p) => {
      const customerInfo = customerMap[p.customer] || { name: null, email: null };
      return {
        id: p.id,
        amount: Number(p.value || 0),
        currency: 'brl',
        status: p.status || 'unknown',
        customer_email: customerInfo.email,
        customer_name: customerInfo.name,
        description: p.description || null,
        created: toUnixSeconds(p.createdAt || p.dateCreated),
      };
    });

    const recentInvoices = recentPaymentsRaw.map((p) => {
      const customerInfo = customerMap[p.customer] || { name: null, email: null };
      const value = Number(p.value || 0);
      return {
        id: p.id,
        number: null,
        amount_due: value,
        amount_paid: value,
        status: p.status || null,
        customer_email: customerInfo.email,
        customer_name: customerInfo.name,
        created: toUnixSeconds(p.createdAt || p.dateCreated),
        hosted_invoice_url: p.invoiceUrl || null,
      };
    });

    const availableBalance = balance.balance ?? 0;

    const stats: FinancialStats = {
      balance: {
        available: availableBalance,
        pending: 0,
        currency: 'BRL',
      },
      mrr,
      arr,
      activeSubscriptions,
      totalCustomers: replynaCustomerIds.size,
      revenueThisMonth: revenueInPeriod,
      revenueLastMonth,
      revenueGrowth,
      churnRate,
      averageTicket,
      recentPayments,
      recentInvoices,
      subscriptionsByStatus: statusCounts,
      subscriptionsByPlan,
      monthlyRevenue,
      periodMetrics: {
        availableBalance,
        revenueInPeriod,
        newSubscriptionsInPeriod,
        canceledSubscriptionsInPeriod: canceledInPeriod,
        chargesInPeriod,
      },
    };

    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro ao buscar dados financeiros:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
