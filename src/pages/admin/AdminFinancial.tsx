import { useEffect, useState } from 'react'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ExternalLink,
  Receipt,
  Wallet,
  Calendar,
  BarChart3,
} from 'lucide-react'

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
  monthlyRevenue: {
    month: string
    revenue: number
  }[]
}

export default function AdminFinancial() {
  const [stats, setStats] = useState<FinancialStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-financial-stats`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      )

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
    padding: '24px',
    border: '1px solid var(--border-color)',
  }

  const statCardStyle = {
    ...cardStyle,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
  }

  const iconBoxStyle = (color: string) => ({
    width: '48px',
    height: '48px',
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

  // Calcular altura maxima do grafico
  const maxRevenue = stats?.monthlyRevenue
    ? Math.max(...stats.monthlyRevenue.map(m => m.revenue), 1)
    : 1

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                height: '120px',
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
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Financeiro
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            Dados em tempo real do Stripe
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
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

      {/* Saldo Stripe */}
      <div style={{ ...cardStyle, marginBottom: '24px', display: 'flex', gap: '32px', alignItems: 'center' }}>
        <div style={iconBoxStyle('#635bff')}>
          <Wallet size={24} style={{ color: '#635bff' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Saldo Stripe
          </div>
          <div style={{ display: 'flex', gap: '32px' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#22c55e' }}>
                {formatCurrency(stats?.balance.available || 0)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Disponivel para saque</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#f59e0b' }}>
                {formatCurrency(stats?.balance.pending || 0)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pendente</div>
            </div>
          </div>
        </div>
      </div>

      {/* Metricas principais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '24px' }}>
        <div style={statCardStyle}>
          <div style={iconBoxStyle('#22c55e')}>
            <DollarSign size={24} style={{ color: '#22c55e' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              MRR
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(stats?.mrr || 0)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Receita recorrente mensal
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#3b82f6')}>
            <Calendar size={24} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Receita do Mes
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(stats?.revenueThisMonth || 0)}
            </div>
            <div style={{
              fontSize: '12px',
              color: (stats?.revenueGrowth || 0) >= 0 ? '#22c55e' : '#ef4444',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              {(stats?.revenueGrowth || 0) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {(stats?.revenueGrowth || 0).toFixed(1)}% vs mes anterior
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#8b5cf6')}>
            <Users size={24} style={{ color: '#8b5cf6' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Assinaturas Ativas
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.activeSubscriptions || 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {stats?.totalCustomers || 0} clientes no total
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#f59e0b')}>
            <Receipt size={24} style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Ticket Medio
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(stats?.averageTicket || 0)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              por transacao
            </div>
          </div>
        </div>
      </div>

      {/* Segunda linha de metricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '24px' }}>
        <div style={statCardStyle}>
          <div style={iconBoxStyle('#3b82f6')}>
            <TrendingUp size={24} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              ARR
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(stats?.arr || 0)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Receita recorrente anual
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#ef4444')}>
            <ArrowDownRight size={24} style={{ color: '#ef4444' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Churn Rate
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {(stats?.churnRate || 0).toFixed(1)}%
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              taxa de cancelamento
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#22c55e')}>
            <ArrowUpRight size={24} style={{ color: '#22c55e' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Assinaturas por Status
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
              <span style={{ ...getStatusBadge('active'), fontSize: '12px' }}>
                {stats?.subscriptionsByStatus.active || 0} ativos
              </span>
              <span style={{ ...getStatusBadge('past_due'), fontSize: '12px' }}>
                {stats?.subscriptionsByStatus.past_due || 0} atrasados
              </span>
              <span style={{ ...getStatusBadge('trialing'), fontSize: '12px' }}>
                {stats?.subscriptionsByStatus.trialing || 0} trial
              </span>
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#6b7280')}>
            <CreditCard size={24} style={{ color: '#6b7280' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Mes Anterior
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(stats?.revenueLastMonth || 0)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              receita total
            </div>
          </div>
        </div>
      </div>

      {/* Grafico de receita e tabelas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Grafico de receita mensal */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <BarChart3 size={20} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Receita Mensal
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '200px' }}>
            {stats?.monthlyRevenue.map((item, index) => (
              <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: '100%',
                  backgroundColor: index === (stats?.monthlyRevenue?.length ?? 0) - 1 ? 'var(--accent)' : 'rgba(70, 114, 236, 0.3)',
                  borderRadius: '6px 6px 0 0',
                  height: `${Math.max((item.revenue / maxRevenue) * 160, 4)}px`,
                  transition: 'height 0.3s ease',
                }} />
                <div style={{
                  fontSize: '10px',
                  color: 'var(--text-secondary)',
                  marginTop: '8px',
                  textTransform: 'capitalize',
                }}>
                  {item.month}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                }}>
                  {formatCurrency(item.revenue)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pagamentos recentes */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <CreditCard size={20} style={{ color: '#22c55e' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Pagamentos Recentes
            </h2>
          </div>
          {stats?.recentPayments && stats.recentPayments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '240px', overflowY: 'auto' }}>
              {stats.recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: '10px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {payment.customer_name || payment.customer_email || 'Cliente'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {formatDateShort(payment.created)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#22c55e' }}>
                      {formatCurrency(payment.amount)}
                    </div>
                    <span style={getStatusBadge(payment.status)}>
                      {getStatusLabel(payment.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
              Nenhum pagamento registrado
            </div>
          )}
        </div>
      </div>

      {/* Faturas recentes */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Receipt size={20} style={{ color: '#f59e0b' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Faturas Recentes
          </h2>
        </div>
        {stats?.recentInvoices && stats.recentInvoices.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
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
