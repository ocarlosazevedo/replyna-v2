/**
 * Edge Function: Get Financial Stats
 *
 * Busca dados financeiros diretamente da API do Stripe
 * - Balance (saldo disponível e pendente)
 * - Charges recentes
 * - Invoices
 * - Subscriptions
 * - MRR calculado
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { getStripeClient } from '../_shared/stripe.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

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
  monthlyRevenue: {
    month: string;
    revenue: number;
  }[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = getStripeClient();

    // Pegar período da query string
    const url = new URL(req.url);
    const period = url.searchParams.get('period') || '6months'; // 7days, 30days, 3months, 6months, 12months, all

    // Calcular datas base
    const now = new Date();
    let periodStart: Date;
    let monthsToShow: number;

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

    const periodStartTimestamp = Math.floor(periodStart.getTime() / 1000);

    // Buscar dados em paralelo para performance
    const [
      balance,
      subscriptions,
      charges,
      invoices,
    ] = await Promise.all([
      stripe.balance.retrieve(),
      stripe.subscriptions.list({ limit: 100, status: 'all' }),
      stripe.charges.list({ limit: 100, created: { gte: periodStartTimestamp } }),
      stripe.invoices.list({ limit: 50, created: { gte: periodStartTimestamp } }),
    ]);

    // Calcular datas para comparação
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Calcular MRR baseado em assinaturas ativas
    let mrr = 0;
    let activeCount = 0;
    let pastDueCount = 0;
    let canceledCount = 0;
    let trialingCount = 0;

    for (const sub of subscriptions.data) {
      if (sub.status === 'active' || sub.status === 'trialing') {
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
        }
      }

      // Contar por status
      switch (sub.status) {
        case 'active': activeCount++; break;
        case 'past_due': pastDueCount++; break;
        case 'canceled': canceledCount++; break;
        case 'trialing': trialingCount++; break;
      }
    }

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

    // Churn rate (cancelados / total ativo no início do período)
    const totalWithHistory = activeCount + canceledCount;
    const churnRate = totalWithHistory > 0
      ? (canceledCount / totalWithHistory) * 100
      : 0;

    // Ticket médio
    const averageTicket = successfulCharges.length > 0
      ? (successfulCharges.reduce((sum, c) => sum + c.amount, 0) / successfulCharges.length) / 100
      : 0;

    // Pagamentos recentes com detalhes do cliente
    const recentPayments = await Promise.all(
      charges.data.slice(0, 10).map(async (charge) => {
        let customerEmail: string | null = null;
        let customerName: string | null = null;

        if (charge.customer && typeof charge.customer === 'string') {
          try {
            const customer = await stripe.customers.retrieve(charge.customer);
            if (!customer.deleted) {
              customerEmail = customer.email;
              customerName = customer.name;
            }
          } catch {
            // Ignorar erro se cliente não existir
          }
        }

        return {
          id: charge.id,
          amount: charge.amount / 100,
          currency: charge.currency,
          status: charge.status,
          customer_email: customerEmail || charge.billing_details?.email || null,
          customer_name: customerName || charge.billing_details?.name || null,
          description: charge.description,
          created: charge.created,
        };
      })
    );

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

    if (period === '7days') {
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

    // Buscar total de clientes
    const customersCount = await stripe.customers.list({ limit: 1 });
    const totalCustomers = customersCount.data.length > 0
      ? (await stripe.customers.list({ limit: 100 })).data.length
      : 0;

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
      monthlyRevenue,
    };

    return new Response(JSON.stringify(stats), {
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
