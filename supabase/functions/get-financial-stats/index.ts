/**
 * Edge Function: Get Financial Stats (Asaas)
 *
 * Fonte única de verdade: Asaas.
 * Supabase usado somente para enriquecer com nome/email de clientes.
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
  updatedAt?: string;
  dateUpdated?: string;
  canceledAt?: string;
  cancelDate?: string;
  deletedDate?: string;
}

interface AsaasPayment {
  id: string;
  customer: string;
  value: number;
  status?: string;
  invoiceUrl?: string | null;
  createdAt?: string;
  dateCreated?: string;
  description?: string | null;
}

interface AsaasBalance {
  balance?: number;
  available: number;
  pending: number;
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
  const response = await asaasRequest<AsaasListResponse<T>>('GET', path, { ...params, limit, offset });
  return response;
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
  const batchSize = 5; // evitar explosao de requests

  for (let i = 0; i < offsets.length; i += batchSize) {
    const batch = offsets.slice(i, i + batchSize);
    const pages = await Promise.all(batch.map((offset) => fetchPage<T>(path, params, 100, offset)));
    for (const page of pages) {
      results.push(...(page.data || []));
    }
  }

  return { data: results, totalCount };
}

async function fetchTotalCount(path: string, params: Record<string, string | number | boolean | undefined>): Promise<number> {
  const page = await fetchPage(path, params, 1, 0);
  if (typeof page.totalCount === 'number') return page.totalCount;
  return page.data?.length || 0;
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

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getCreatedAt(sub: AsaasSubscription): Date | null {
  return parseDate(sub.createdAt || sub.dateCreated);
}

function getCanceledAt(sub: AsaasSubscription): Date | null {
  return parseDate(sub.canceledAt || sub.cancelDate || sub.deletedDate || sub.dateUpdated || sub.updatedAt);
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

async function fetchPaymentsForRange(status: string, startDate: string, endDate: string): Promise<AsaasPayment[]> {
  const { data } = await fetchAll<AsaasPayment>('/payments', {
    status,
    'dateCreated[ge]': startDate,
    'dateCreated[le]': endDate,
  });
  return data || [];
}

async function fetchPaymentsForRangeMulti(statuses: string[], startDate: string, endDate: string): Promise<AsaasPayment[]> {
  const results = await Promise.all(statuses.map((status) => fetchPaymentsForRange(status, startDate, endDate)));
  return results.flat();
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

    const periodStartStr = customStartDate || formatDateYYYYMMDD(periodStart);
    const periodEndStr = customEndDate || formatDateYYYYMMDD(periodEnd);

    // Mes anterior ao periodo selecionado
    const prevMonthStart = new Date(periodStart.getFullYear(), periodStart.getMonth() - 1, 1);
    const prevMonthEnd = new Date(periodStart.getFullYear(), periodStart.getMonth(), 0);
    const prevMonthStartStr = formatDateYYYYMMDD(prevMonthStart);
    const prevMonthEndStr = formatDateYYYYMMDD(prevMonthEnd);

    const sixMonthsStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const sixMonthsStartStr = formatDateYYYYMMDD(sixMonthsStart);
    const sixMonthsEndStr = formatDateYYYYMMDD(new Date(now.getFullYear(), now.getMonth() + 1, 0));

    const supabase = getSupabaseAdmin();
    const replynaCustomersPromise = supabase
      .from('users')
      .select('asaas_customer_id')
      .not('asaas_customer_id', 'is', null);

    const [
      balance,
      activeSubsRes,
      inactiveSubsRes,
      expiredSubsRes,
      totalCustomers,
      overduePaymentsRes,
      allChargesInPeriodRes,
      newSubsInPeriodRes,
      canceledInPeriodRes,
      replynaCustomersRes,
      recentPaymentsRes,
      paymentsConfirmedInPeriod,
      paymentsReceivedInPeriod,
      paymentsConfirmedLastMonth,
      paymentsReceivedLastMonth,
      paymentsConfirmedSixMonths,
      paymentsReceivedSixMonths,
    ] = await Promise.all([
      asaasRequest<AsaasBalance>('GET', '/finance/balance'),
      fetchAll<AsaasSubscription>('/subscriptions', { status: 'ACTIVE' }),
      fetchAll<AsaasSubscription>('/subscriptions', { status: 'INACTIVE' }),
      fetchAll<AsaasSubscription>('/subscriptions', { status: 'EXPIRED' }),
      fetchTotalCount('/customers', {}),
      fetchAll<AsaasPayment>('/payments', { status: 'OVERDUE' }),
      fetchAll<AsaasPayment>('/payments', { 'dateCreated[ge]': periodStartStr, 'dateCreated[le]': periodEndStr }),
      fetchAll<AsaasSubscription>('/subscriptions', { 'dateCreated[ge]': periodStartStr, 'dateCreated[le]': periodEndStr }),
      fetchAll<AsaasSubscription>('/subscriptions', { status: 'INACTIVE', 'dateUpdated[ge]': periodStartStr, 'dateUpdated[le]': periodEndStr }),
      replynaCustomersPromise,
      asaasRequest<AsaasListResponse<AsaasPayment>>('GET', '/payments', { limit: 10, order: 'desc' }),
      fetchPaymentsForRange('CONFIRMED', periodStartStr, periodEndStr),
      fetchPaymentsForRange('RECEIVED', periodStartStr, periodEndStr),
      fetchPaymentsForRange('CONFIRMED', prevMonthStartStr, prevMonthEndStr),
      fetchPaymentsForRange('RECEIVED', prevMonthStartStr, prevMonthEndStr),
      fetchPaymentsForRange('CONFIRMED', sixMonthsStartStr, sixMonthsEndStr),
      fetchPaymentsForRange('RECEIVED', sixMonthsStartStr, sixMonthsEndStr),
    ]);

    if (replynaCustomersRes.error) {
      throw new Error(replynaCustomersRes.error.message || 'Erro ao buscar clientes Replyna');
    }

    const replynaCustomerIds = new Set(
      (replynaCustomersRes.data || [])
        .map((r) => r.asaas_customer_id)
        .filter(Boolean)
    );

    const isReplyna = (customerId?: string | null): boolean => {
      return !!customerId && replynaCustomerIds.has(customerId);
    };

    const activeSubs = (activeSubsRes.data || []).filter((sub) => isReplyna(sub.customer));
    const inactiveSubs = (inactiveSubsRes.data || []).filter((sub) => isReplyna(sub.customer));
    const expiredSubs = (expiredSubsRes.data || []).filter((sub) => isReplyna(sub.customer));
    const allSubs = [...activeSubs, ...inactiveSubs, ...expiredSubs];

    const mrr = activeSubs.reduce((sum, sub) => sum + Number(sub.value || 0), 0);
    const arr = mrr * 12;
    const activeSubscriptions = activeSubs.length;

    const filteredPaymentsConfirmedInPeriod = paymentsConfirmedInPeriod.filter((p) => isReplyna(p.customer));
    const filteredPaymentsReceivedInPeriod = paymentsReceivedInPeriod.filter((p) => isReplyna(p.customer));
    const filteredPaymentsConfirmedLastMonth = paymentsConfirmedLastMonth.filter((p) => isReplyna(p.customer));
    const filteredPaymentsReceivedLastMonth = paymentsReceivedLastMonth.filter((p) => isReplyna(p.customer));
    const filteredPaymentsConfirmedSixMonths = paymentsConfirmedSixMonths.filter((p) => isReplyna(p.customer));
    const filteredPaymentsReceivedSixMonths = paymentsReceivedSixMonths.filter((p) => isReplyna(p.customer));

    const paymentsInPeriod = [...filteredPaymentsConfirmedInPeriod, ...filteredPaymentsReceivedInPeriod];
    const revenueInPeriod = sumPayments(paymentsInPeriod);
    const paymentsCountInPeriod = paymentsInPeriod.length;

    const revenueLastMonth = sumPayments([...filteredPaymentsConfirmedLastMonth, ...filteredPaymentsReceivedLastMonth]);
    const revenueGrowth = revenueLastMonth > 0
      ? ((revenueInPeriod - revenueLastMonth) / revenueLastMonth) * 100
      : (revenueInPeriod > 0 ? 100 : 0);

    const averageTicket = paymentsCountInPeriod > 0 ? revenueInPeriod / paymentsCountInPeriod : 0;

    // Churn (canceled in period)
    const canceledInPeriod = (canceledInPeriodRes.data || []).filter((sub) => isReplyna(sub.customer)).length;

    const activeAtStart = allSubs.filter((sub) => {
      const createdAt = getCreatedAt(sub);
      if (!createdAt || createdAt > periodStart) return false;
      const canceledAt = getCanceledAt(sub);
      if (canceledAt && canceledAt <= periodStart) return false;
      return true;
    }).length;

    const churnRate = activeAtStart > 0 ? (canceledInPeriod / activeAtStart) * 100 : 0;

    // Subscriptions por status
    const overdueReplyna = (overduePaymentsRes.data || []).filter((p) => isReplyna(p.customer));
    const overdueCount = new Set(overdueReplyna.map((p) => p.customer)).size;

    const subscriptionsByStatus = {
      active: activeSubs.length,
      canceled: inactiveSubs.length + expiredSubs.length,
      past_due: overdueCount,
      trialing: 0,
    };

    // Subscriptions por plano (usa description do Asaas)
    const planCounts: Record<string, number> = {};
    activeSubs.forEach((sub) => {
      const planName = (sub.description || 'Plano').trim();
      planCounts[planName] = (planCounts[planName] || 0) + 1;
    });
    const subscriptionsByPlan = Object.entries(planCounts).map(([plan_name, count]) => ({ plan_name, count }));

    // Receita mensal (ultimos 6 meses)
    const paymentsSixMonths = [...filteredPaymentsConfirmedSixMonths, ...filteredPaymentsReceivedSixMonths];
    const revenueByMonth = new Map<string, number>();

    for (const payment of paymentsSixMonths) {
      const dateValue = payment.createdAt || payment.dateCreated;
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

    // Enriquecer dados de clientes (nome/email) usando Supabase
    const recentPaymentsData = (recentPaymentsRes.data || []).filter((p) => isReplyna(p.customer));
    const customerIds = Array.from(new Set(recentPaymentsData.map((p) => p.customer).filter(Boolean)));
    const customerMap: Record<string, { name: string | null; email: string | null }> = {};

    if (customerIds.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < customerIds.length; i += chunkSize) {
        const chunk = customerIds.slice(i, i + chunkSize);
        const { data } = await supabase
          .from('users')
          .select('asaas_customer_id, name, email')
          .in('asaas_customer_id', chunk);
        (data || []).forEach((row) => {
          if (row.asaas_customer_id) {
            customerMap[row.asaas_customer_id] = {
              name: row.name || null,
              email: row.email || null,
            };
          }
        });
      }
    }

    const recentPayments = recentPaymentsData.map((p) => {
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

    const recentInvoices = recentPaymentsData.map((p) => {
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

    const newSubscriptionsInPeriod = (newSubsInPeriodRes.data || []).filter((sub) => isReplyna(sub.customer)).length;
    const chargesInPeriod = (allChargesInPeriodRes.data || []).filter((p) => isReplyna(p.customer)).length;

    const stats: FinancialStats = {
      balance: {
        available: balance.available ?? balance.balance ?? 0,
        pending: balance.pending ?? 0,
        currency: 'BRL',
      },
      mrr,
      arr,
      activeSubscriptions,
      totalCustomers,
      revenueThisMonth: revenueInPeriod,
      revenueLastMonth,
      revenueGrowth,
      churnRate,
      averageTicket,
      recentPayments,
      recentInvoices,
      subscriptionsByStatus,
      subscriptionsByPlan,
      monthlyRevenue,
      periodMetrics: {
        availableBalance: balance.available ?? 0,
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
