import { useEffect, useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { subDays } from 'date-fns'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  CreditCard,
  ArrowDownRight,
  RefreshCw,
  ExternalLink,
  Receipt,
  Calendar,
  Package,
} from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import DateRangePicker from '../../components/DateRangePicker'
import { useTheme } from '../../context/ThemeContext'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isMobile
}

const getDefaultRange = (): DateRange => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return { from: subDays(today, 179), to: today }
}

interface SubscriptionByPlan {
  plan_name: string
  count: number
}

interface FinancialStats {
  balance: {
    available: number
    pending: number
    currency: string
  }
  mrr: number
  arr: number
  activeSubscriptions: number
  totalCustomers: number
  revenueThisMonth: number
  revenueLastMonth: number
  revenueGrowth: number
  churnRate: number
  averageTicket: number
  recentPayments: {
    id: string
    amount: number
    currency: string
    status: string
    customer_email: string | null
    customer_name: string | null
    description: string | null
    created: number
  }[]
  recentInvoices: {
    id: string
    number: string | null
    amount_due: number
    amount_paid: number
    status: string | null
    customer_email: string | null
    customer_name: string | null
    created: number
    hosted_invoice_url: string | null
  }[]
  subscriptionsByStatus: {
    active: number
    past_due: number
    canceled: number
    trialing: number
  }
  subscriptionsByPlan?: SubscriptionByPlan[]
  monthlyRevenue: {
    month: string
    revenue: number
  }[]
  periodMetrics?: {
    revenueInPeriod: number
    newSubscriptionsInPeriod: number
    canceledSubscriptionsInPeriod: number
    chargesInPeriod: number
  }
}

export default function AdminFinancial() {
  const isMobile = useIsMobile()
  const { theme } = useTheme()
  const [stats, setStats] = useState<FinancialStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [range, setRange] = useState<DateRange>(getDefaultRange())

  useEffect(() => {
    if (range?.from && range?.to) {
      loadStats()
    }
  }, [range])

  const loadStats = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const startDate = range?.from?.toISOString().split('T')[0]
      const endDate = range?.to?.toISOString().split('T')[0]

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-financial-stats?period=custom&startDate=${startDate}&endDate=${endDate}`

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao carregar dados')
      }

      const data = await response.json()
      setStats(data)
    } catch (err) {
      console.error('Erro ao carregar estatisticas:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  const formatDateShort = (timestamp: number) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    }).format(new Date(timestamp * 1000))

  const cardStyle = {
    backgroundColor: 'var(--bg-card)',
    borderRadius: '16px',
    padding: isMobile ? '16px' : '24px',
    border: '1px solid var(--border-color)',
    overflow: 'hidden' as const,
  }

  const statCardStyle = {
    ...cardStyle,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
  }

  const iconBoxStyle = (color: string) => ({
    width: isMobile ? '40px' : '48px',
    height: isMobile ? '40px' : '48px',
    borderRadius: '12px',
    backgroundColor: `${color}15`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  })

  const getStatusBadge = (status: string) => {
    const base: React.CSSProperties = { padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600 }
    switch (status) {
      case 'succeeded':
      case 'paid':
      case 'active':
        return { ...base, backgroundColor: 'rgba(34, 197, 94, 0.16)', color: '#22c55e' }
      case 'failed':
      case 'canceled':
      case 'void':
        return { ...base, backgroundColor: 'rgba(239, 68, 68, 0.16)', color: '#ef4444' }
      case 'pending':
      case 'past_due':
      case 'open':
        return { ...base, backgroundColor: 'rgba(245, 158, 11, 0.16)', color: '#f59e0b' }
      case 'draft':
      case 'trialing':
        return { ...base, backgroundColor: 'rgba(107, 114, 128, 0.16)', color: '#6b7280' }
      default:
        return { ...base, backgroundColor: 'rgba(107, 114, 128, 0.16)', color: '#6b7280' }
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      succeeded: 'Pago',
      paid: 'Pago',
      active: 'Ativo',
      failed: 'Falhou',
      canceled: 'Cancelado',
      void: 'Anulado',
      pending: 'Pendente',
      past_due: 'Atrasado',
      open: 'Aberto',
      draft: 'Rascunho',
      trialing: 'Trial',
    }
    return labels[status] || status
  }

  const chartColors = useMemo(() => {
    if (typeof document === 'undefined') {
      return {
        text: '#42506a',
        grid: 'rgba(215, 222, 239, 0.6)',
      }
    }
    const styles = getComputedStyle(document.documentElement)
    const text = styles.getPropertyValue('--text-secondary').trim() || '#42506a'
    const grid = styles.getPropertyValue('--border-color').trim() || 'rgba(215, 222, 239, 0.6)'
    return { text, grid }
  }, [theme])

  const maxRevenue = stats?.monthlyRevenue
    ? Math.max(...stats.monthlyRevenue.map(m => m.revenue), 1)
    : 1

  const chartData = useMemo(() => ({
    labels: stats?.monthlyRevenue.map((item) => item.month) || [],
    datasets: [
      {
        label: 'Receita',
        data: stats?.monthlyRevenue.map((item) => item.revenue) || [],
        borderColor: '#4672ec',
        backgroundColor: 'rgba(70, 114, 236, 0.18)',
        tension: 0.3,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#4672ec',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  }), [stats?.monthlyRevenue])

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#0e1729',
        titleColor: '#f5fafe',
        bodyColor: '#f5fafe',
        padding: 12,
        callbacks: {
          label: (context: { parsed: { y: number | null } }) => {
            return formatCurrency(context.parsed.y ?? 0)
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: chartColors.grid,
        },
        ticks: {
          color: chartColors.text,
        },
      },
      y: {
        grid: {
          color: chartColors.grid,
        },
        ticks: {
          color: chartColors.text,
          callback: (value: number | string) => {
            if (typeof value === 'number') {
              return formatCurrency(value)
            }
            return value
          },
        },
        min: 0,
        suggestedMax: Math.ceil(maxRevenue * 1.2),
      },
    },
  }), [chartColors, maxRevenue])

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{
          height: '32px',
          width: '200px',
          backgroundColor: 'var(--border-color)',
          borderRadius: '8px',
          marginBottom: '32px',
          animation: 'replyna-pulse 1.6s ease-in-out infinite',
        }} />
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '12px' : '24px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                height: isMobile ? '100px' : '120px',
                backgroundColor: 'var(--border-color)',
                borderRadius: '16px',
                animation: 'replyna-pulse 1.6s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{
          ...cardStyle,
          textAlign: 'center',
          padding: '48px',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <CreditCard size={32} style={{ color: '#ef4444' }} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Erro ao carregar dados
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            {error}
          </p>
          <button
            onClick={() => loadStats()}
            style={{
              padding: '12px 24px',
              borderRadius: '10px',
              backgroundColor: 'var(--accent)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <RefreshCw size={16} />
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? '24px' : '32px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', gap: isMobile ? '16px' : '0' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Financeiro
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '14px' : '15px' }}>
            Dados em tempo real do Stripe
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          <DateRangePicker value={range} onChange={setRange} />
          <button
            onClick={() => loadStats(true)}
            disabled={refreshing}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              fontWeight: 500,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
            }}
          >
            <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Atualizar
          </button>
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              backgroundColor: '#635bff',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
            }}
          >
            Stripe Dashboard
            <ExternalLink size={16} />
          </a>
        </div>
      </div>

      {/* Metricas do Periodo Selecionado */}
      <div style={{ ...cardStyle, marginBottom: '24px', background: 'linear-gradient(135deg, rgba(70, 114, 236, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)' }}>
        <div style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: 600, color: 'var(--accent)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={isMobile ? 16 : 18} />
          Metricas do Periodo Selecionado
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '16px' : '24px' }}>
          <div>
            <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: '#22c55e' }}>
              {formatCurrency(stats?.periodMetrics?.revenueInPeriod || 0)}
            </div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)' }}>Faturamento</div>
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: '#3b82f6' }}>
              {stats?.periodMetrics?.newSubscriptionsInPeriod || 0}
            </div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)' }}>Novas Assinaturas</div>
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: '#ef4444' }}>
              {stats?.periodMetrics?.canceledSubscriptionsInPeriod || 0}
            </div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)' }}>Cancelamentos</div>
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: '#8b5cf6' }}>
              {stats?.periodMetrics?.chargesInPeriod || 0}
            </div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)' }}>Cobrancas</div>
          </div>
        </div>
      </div>

      {/* Metricas principais */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '12px' : '24px', marginBottom: '24px' }}>
        <div style={statCardStyle}>
          <div style={iconBoxStyle('#22c55e')}>
            <DollarSign size={isMobile ? 20 : 24} style={{ color: '#22c55e' }} />
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              MRR
            </div>
            <div style={{ fontSize: isMobile ? '18px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(stats?.mrr || 0)}
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Receita recorrente mensal
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#3b82f6')}>
            <Calendar size={isMobile ? 20 : 24} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Receita do Mes
            </div>
            <div style={{ fontSize: isMobile ? '18px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(stats?.revenueThisMonth || 0)}
            </div>
            <div style={{
              fontSize: isMobile ? '10px' : '12px',
              color: (stats?.revenueGrowth || 0) >= 0 ? '#22c55e' : '#ef4444',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              {(stats?.revenueGrowth || 0) >= 0 ? <TrendingUp size={isMobile ? 12 : 14} /> : <TrendingDown size={isMobile ? 12 : 14} />}
              {(stats?.revenueGrowth || 0).toFixed(1)}% vs mes anterior
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#8b5cf6')}>
            <Users size={isMobile ? 20 : 24} style={{ color: '#8b5cf6' }} />
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Assinaturas Ativas
            </div>
            <div style={{ fontSize: isMobile ? '18px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.activeSubscriptions || 0}
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {stats?.totalCustomers || 0} clientes no total
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#f59e0b')}>
            <Receipt size={isMobile ? 20 : 24} style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Ticket Medio
            </div>
            <div style={{ fontSize: isMobile ? '18px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(stats?.averageTicket || 0)}
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              por transacao
            </div>
          </div>
        </div>
      </div>

      {/* Segunda linha de metricas */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '12px' : '24px', marginBottom: '24px' }}>
        <div style={statCardStyle}>
          <div style={iconBoxStyle('#3b82f6')}>
            <TrendingUp size={isMobile ? 20 : 24} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              ARR
            </div>
            <div style={{ fontSize: isMobile ? '18px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(stats?.arr || 0)}
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Receita recorrente anual
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#ef4444')}>
            <ArrowDownRight size={isMobile ? 20 : 24} style={{ color: '#ef4444' }} />
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Churn Rate
            </div>
            <div style={{ fontSize: isMobile ? '18px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {(stats?.churnRate || 0).toFixed(1)}%
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              taxa de cancelamento
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#6b7280')}>
            <CreditCard size={isMobile ? 20 : 24} style={{ color: '#6b7280' }} />
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Mes Anterior
            </div>
            <div style={{ fontSize: isMobile ? '18px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(stats?.revenueLastMonth || 0)}
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              receita total
            </div>
          </div>
        </div>

        {/* Card de Assinaturas por Status */}
        <div style={statCardStyle}>
          <div style={iconBoxStyle('#22c55e')}>
            <Users size={isMobile ? 20 : 24} style={{ color: '#22c55e' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Assinaturas por Status
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>Ativos</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {(stats?.subscriptionsByStatus.active || 0) + (stats?.subscriptionsByStatus.trialing || 0)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600 }}>Cancelados</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {stats?.subscriptionsByStatus.canceled || 0}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 600 }}>Inadimplência</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {stats?.subscriptionsByStatus.past_due || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bloco de Assinaturas por Plano - Linha inteira */}
      <div style={{ ...cardStyle, marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Package size={isMobile ? 18 : 20} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Clientes Ativos por Plano
          </h2>
        </div>
        {stats?.subscriptionsByPlan && stats.subscriptionsByPlan.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {stats.subscriptionsByPlan.map((plan, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '12px',
                  padding: '16px 24px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  minWidth: isMobile ? '100%' : '180px',
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(70, 114, 236, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)' }}>{plan.count}</span>
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {plan.plan_name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {plan.count === 1 ? 'cliente ativo' : 'clientes ativos'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '12px',
              padding: '16px 24px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(70, 114, 236, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)' }}>{stats?.activeSubscriptions || 0}</span>
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Starter
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  clientes ativos
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grafico de receita - Linha inteira */}
      <div style={{ ...cardStyle, marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <TrendingUp size={isMobile ? 18 : 20} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Receita no Periodo
          </h2>
        </div>
        <div style={{ height: isMobile ? '250px' : '320px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* Faturas recentes */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Receipt size={isMobile ? 18 : 20} style={{ color: '#f59e0b' }} />
          <h2 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Faturas Recentes
          </h2>
        </div>
        {stats?.recentInvoices && stats.recentInvoices.length > 0 ? (
          isMobile ? (
            <div className="replyna-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
              {stats.recentInvoices.map((invoice) => (
                <div key={invoice.id} style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '10px',
                  padding: '12px',
                  border: '1px solid var(--border-color)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {invoice.number || invoice.id.slice(-8)}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {invoice.customer_name || invoice.customer_email || 'N/A'}
                      </div>
                    </div>
                    <span style={getStatusBadge(invoice.status || 'draft')}>
                      {getStatusLabel(invoice.status || 'draft')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatCurrency(invoice.amount_due)}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {formatDateShort(invoice.created)}
                      </div>
                    </div>
                    {invoice.hosted_invoice_url && (
                      <a
                        href={invoice.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--accent)',
                          textDecoration: 'none',
                          fontSize: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        Ver <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="replyna-scrollbar" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ textAlign: 'left', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>Fatura</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>Cliente</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>Valor</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>Status</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>Data</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentInvoices.map((invoice) => (
                    <tr key={invoice.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {invoice.number || invoice.id.slice(-8)}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)' }}>
                        {invoice.customer_name || invoice.customer_email || 'N/A'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatCurrency(invoice.amount_due)}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={getStatusBadge(invoice.status || 'draft')}>
                          {getStatusLabel(invoice.status || 'draft')}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {formatDateShort(invoice.created)}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {invoice.hosted_invoice_url && (
                          <a
                            href={invoice.hosted_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              backgroundColor: 'var(--bg-primary)',
                              color: 'var(--accent)',
                              textDecoration: 'none',
                              fontSize: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            Ver <ExternalLink size={12} />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
            Nenhuma fatura registrada
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
