import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { DollarSign, TrendingUp, Users, CreditCard, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface FinancialStats {
  activeSubscriptions: number
  totalRevenue: number
  mrr: number
  arr: number
  churnRate: number
  subscriptionsByPlan: { plan: string; count: number; revenue: number }[]
  recentSubscriptions: {
    id: string
    user_email: string
    plan_name: string
    status: string
    created_at: string
  }[]
}

export default function AdminFinancial() {
  const [stats, setStats] = useState<FinancialStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      // Buscar assinaturas ativas
      const { count: activeSubscriptions } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      // Buscar todas as assinaturas com detalhes
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select(`
          *,
          users(email, name),
          plans(name, price_monthly, price_yearly)
        `)
        .order('created_at', { ascending: false })

      // Calcular MRR baseado nas assinaturas ativas
      let mrr = 0
      const planCounts: Record<string, { count: number; revenue: number }> = {}

      const activeSubsList = (subscriptions || []).filter((s: { status: string }) => s.status === 'active')
      for (const sub of activeSubsList) {
        const plan = (sub as { plans: { price_monthly: number; price_yearly: number | null; name: string } | null }).plans
        if (plan) {
          const monthlyPrice = sub.billing_cycle === 'yearly' && plan.price_yearly
            ? plan.price_yearly / 12
            : plan.price_monthly

          mrr += monthlyPrice

          if (!planCounts[plan.name]) {
            planCounts[plan.name] = { count: 0, revenue: 0 }
          }
          planCounts[plan.name].count++
          planCounts[plan.name].revenue += monthlyPrice
        }
      }

      const subscriptionsByPlan = Object.entries(planCounts).map(([plan, data]) => ({
        plan,
        count: data.count,
        revenue: data.revenue,
      }))

      // Assinaturas recentes
      const recentSubscriptions = (subscriptions || []).slice(0, 10).map((sub: {
        id: string
        status: string
        created_at: string
        users: { email: string } | null
        plans: { name: string } | null
      }) => ({
        id: sub.id,
        user_email: sub.users?.email || 'N/A',
        plan_name: sub.plans?.name || 'N/A',
        status: sub.status,
        created_at: sub.created_at,
      }))

      setStats({
        activeSubscriptions: activeSubscriptions || 0,
        totalRevenue: mrr * 12, // Estimativa anual
        mrr,
        arr: mrr * 12,
        churnRate: 0, // Calcular depois com dados historicos
        subscriptionsByPlan,
        recentSubscriptions,
      })
    } catch (err) {
      console.error('Erro ao carregar estatisticas:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(date))

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
    const base = { padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600 }
    switch (status) {
      case 'active':
        return { ...base, backgroundColor: 'rgba(34, 197, 94, 0.16)', color: '#22c55e' }
      case 'canceled':
        return { ...base, backgroundColor: 'rgba(239, 68, 68, 0.16)', color: '#ef4444' }
      case 'past_due':
        return { ...base, backgroundColor: 'rgba(245, 158, 11, 0.16)', color: '#f59e0b' }
      default:
        return { ...base, backgroundColor: 'rgba(107, 114, 128, 0.16)', color: '#6b7280' }
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo'
      case 'canceled': return 'Cancelado'
      case 'past_due': return 'Atrasado'
      case 'trialing': return 'Trial'
      default: return status
    }
  }

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

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
          Financeiro
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Metricas financeiras e assinaturas
        </p>
      </div>

      {/* Metricas principais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '32px' }}>
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
            <div style={{ fontSize: '12px', color: '#22c55e', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUpRight size={14} />
              Receita recorrente mensal
            </div>
          </div>
        </div>

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
              clientes pagantes
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
              {stats?.churnRate || 0}%
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              taxa de cancelamento
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        {/* Distribuicao por plano */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px' }}>
            Receita por Plano
          </h2>
          {stats?.subscriptionsByPlan && stats.subscriptionsByPlan.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {stats.subscriptionsByPlan.map((item) => (
                <div key={item.plan}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.plan}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {item.count} assinantes
                    </span>
                  </div>
                  <div style={{
                    height: '8px',
                    backgroundColor: 'var(--border-color)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${(item.revenue / (stats?.mrr || 1)) * 100}%`,
                      height: '100%',
                      backgroundColor: '#22c55e',
                      borderRadius: '4px',
                    }} />
                  </div>
                  <div style={{ fontSize: '13px', color: '#22c55e', marginTop: '4px', fontWeight: 600 }}>
                    {formatCurrency(item.revenue)}/mes
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
              Nenhuma assinatura ativa
            </div>
          )}
        </div>

        {/* Assinaturas recentes */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px' }}>
            Assinaturas Recentes
          </h2>
          {stats?.recentSubscriptions && stats.recentSubscriptions.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
                  <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>Cliente</th>
                  <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>Plano</th>
                  <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>Status</th>
                  <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>Data</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentSubscriptions.map((sub) => (
                  <tr key={sub.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)' }}>
                      {sub.user_email}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 10px',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        color: '#8b5cf6',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}>
                        {sub.plan_name}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={getStatusBadge(sub.status)}>
                        {getStatusLabel(sub.status)}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {formatDate(sub.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
              Nenhuma assinatura registrada
            </div>
          )}
        </div>
      </div>

      {/* Integracao Stripe */}
      <div style={{ ...cardStyle, marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={iconBoxStyle('#635bff')}>
              <CreditCard size={24} style={{ color: '#635bff' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Integracao Stripe
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Gerencie pagamentos diretamente no dashboard do Stripe
              </p>
            </div>
          </div>
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '12px 20px',
              borderRadius: '10px',
              backgroundColor: '#635bff',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            Abrir Stripe Dashboard
            <ArrowUpRight size={16} />
          </a>
        </div>
      </div>
    </div>
  )
}
