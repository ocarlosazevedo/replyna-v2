import { useEffect, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { subDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  MessageSquare,
  Users,
  Store,
  CheckCircle,
  Mail,
  AlertTriangle,
  UserPlus,
  TrendingUp,
  Package,
  RefreshCw,
  CreditCard,
  HelpCircle,
  Truck,
  Headphones,
} from 'lucide-react'
import DateRangePicker from '../../components/DateRangePicker'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isMobile
}

interface DashboardStats {
  totalUsers: number
  activeUsers: number
  totalShops: number
  activeShops: number
  totalConversations: number
  totalMessages: number
  automationRate: number
  newUsersInPeriod: number
  emailsProcessed: number
  usersAtLimit: number
  categories: Record<string, number>
}

interface RecentUser {
  id: string
  name: string | null
  email: string
  plan: string
  created_at: string
  shops_count: number
}

interface Plan {
  name: string
  count: number
}

const getDefaultRange = (): DateRange => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return { from: subDays(today, 29), to: today }
}

const startOfDay = (date: Date) => {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

const endOfDay = (date: Date) => {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

const categoryIcons: Record<string, typeof Package> = {
  rastreio: Truck,
  reembolso: RefreshCw,
  produto: Package,
  pagamento: CreditCard,
  entrega: Truck,
  suporte_humano: Headphones,
  outros: HelpCircle,
}

const categoryLabels: Record<string, string> = {
  rastreio: 'Rastreio',
  reembolso: 'Reembolso',
  produto: 'Produto',
  pagamento: 'Pagamento',
  entrega: 'Entrega',
  suporte_humano: 'Suporte Humano',
  outros: 'Outros',
}

const categoryColors: Record<string, string> = {
  rastreio: '#3b82f6',
  reembolso: '#ef4444',
  produto: '#8b5cf6',
  pagamento: '#22c55e',
  entrega: '#f59e0b',
  suporte_humano: '#ec4899',
  outros: '#6b7280',
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([])
  const [planDistribution, setPlanDistribution] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<DateRange>(getDefaultRange())
  const isMobile = useIsMobile()

  useEffect(() => {
    loadStats()
  }, [range])

  const loadStats = async () => {
    if (!range?.from || !range?.to) return

    setLoading(true)
    try {
      const dateStart = startOfDay(range.from)
      const dateEnd = endOfDay(range.to)

      // Usar Edge Function que bypassa RLS
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-dashboard-stats?dateStart=${dateStart.toISOString()}&dateEnd=${dateEnd.toISOString()}`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao carregar estatísticas')
      }

      const data = await response.json()

      setStats(data.stats)
      setRecentUsers(data.recentUsers || [])

      // Processar distribuição por plano
      const planDist: Plan[] = Object.entries(data.planDistribution || {})
        .map(([name, count]) => ({ name, count: count as number }))
        .sort((a, b) => b.count - a.count)

      setPlanDistribution(planDist)
    } catch (err) {
      console.error('Erro ao carregar estatisticas:', err)
    } finally {
      setLoading(false)
    }
  }

  const cardStyle = {
    backgroundColor: 'var(--bg-card)',
    borderRadius: '16px',
    padding: isMobile ? '16px' : '24px',
    border: '1px solid var(--border-color)',
  }

  const statCardStyle = {
    ...cardStyle,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
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

  const formatDate = (date: string) =>
    format(new Date(date), "dd 'de' MMM", { locale: ptBR })

  if (loading) {
    return (
      <div>
        <div
          style={{
            height: '32px',
            width: '200px',
            backgroundColor: 'var(--border-color)',
            borderRadius: '8px',
            marginBottom: '32px',
            animation: 'replyna-pulse 1.6s ease-in-out infinite',
          }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '24px' }}>
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

  const totalCategorized = Object.values(stats?.categories || {}).reduce((a, b) => a + b, 0)

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'flex-start',
          marginBottom: isMobile ? '20px' : '32px',
          gap: '16px',
        }}
      >
        <div>
          <h1 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Painel de Controle
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Visao geral de todas as metricas da Replyna
          </p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {/* Metricas principais - Linha 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '12px' : '24px', marginBottom: isMobile ? '12px' : '24px' }}>
        <div style={statCardStyle}>
          <div style={iconBoxStyle('#3b82f6')}>
            <Users size={isMobile ? 20 : 24} style={{ color: '#3b82f6' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? '11px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total de Clientes</div>
            <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.totalUsers || 0}
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#22c55e', marginTop: '4px' }}>{stats?.activeUsers || 0} ativos</div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#8b5cf6')}>
            <Store size={isMobile ? 20 : 24} style={{ color: '#8b5cf6' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? '11px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total de Lojas</div>
            <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.totalShops || 0}
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#22c55e', marginTop: '4px' }}>{stats?.activeShops || 0} ativas</div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#f59e0b')}>
            <MessageSquare size={isMobile ? 20 : 24} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? '11px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Conversas
            </div>
            <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.totalConversations || 0}
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {stats?.totalMessages || 0} mensagens
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#22c55e')}>
            <CheckCircle size={isMobile ? 20 : 24} style={{ color: '#22c55e' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? '11px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Taxa Automacao</div>
            <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.automationRate || 0}%
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              no periodo
            </div>
          </div>
        </div>
      </div>

      {/* Metricas secundarias - Linha 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '12px' : '24px', marginBottom: isMobile ? '12px' : '24px' }}>
        <div style={statCardStyle}>
          <div style={iconBoxStyle('#10b981')}>
            <UserPlus size={isMobile ? 20 : 24} style={{ color: '#10b981' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? '11px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Novos Cadastros</div>
            <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.newUsersInPeriod || 0}
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>no periodo</div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#06b6d4')}>
            <Mail size={isMobile ? 20 : 24} style={{ color: '#06b6d4' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? '11px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Emails Recebidos
            </div>
            <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.emailsProcessed || 0}
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>no periodo</div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#ef4444')}>
            <AlertTriangle size={isMobile ? 20 : 24} style={{ color: '#ef4444' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? '11px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>No Limite</div>
            <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.usersAtLimit || 0}
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>sem creditos</div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#a855f7')}>
            <TrendingUp size={isMobile ? 20 : 24} style={{ color: '#a855f7' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? '11px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Media/Cliente
            </div>
            <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.totalUsers ? Math.round((stats?.emailsProcessed || 0) / stats.totalUsers) : 0}
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>no periodo</div>
          </div>
        </div>
      </div>

      {/* Grid de 2 colunas - Distribuição por categoria e Distribuição por plano */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '12px' : '24px', marginBottom: isMobile ? '12px' : '24px' }}>
        {/* Distribuição por categoria */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px' }}>
            Conversas por Categoria
          </h2>
          {totalCategorized === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '24px' }}>
              Nenhuma conversa no periodo selecionado
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(stats?.categories || {})
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => {
                  const Icon = categoryIcons[category] || HelpCircle
                  const color = categoryColors[category] || '#6b7280'
                  const percentage = totalCategorized ? Math.round((count / totalCategorized) * 100) : 0
                  return (
                    <div key={category} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: `${color}15`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={16} style={{ color }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '4px',
                          }}
                        >
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {categoryLabels[category] || category}
                          </span>
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {count} ({percentage}%)
                          </span>
                        </div>
                        <div
                          style={{
                            height: '6px',
                            backgroundColor: 'var(--border-color)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${percentage}%`,
                              height: '100%',
                              backgroundColor: color,
                              borderRadius: '3px',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>

        {/* Distribuição por plano */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px' }}>
            Distribuicao por Plano
          </h2>
          {planDistribution.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '24px' }}>
              Nenhum usuario cadastrado
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {planDistribution.map((plan, index) => {
                const colors = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444']
                const color = colors[index % colors.length]
                const percentage = stats?.totalUsers ? Math.round((plan.count / stats.totalUsers) * 100) : 0
                return (
                  <div key={plan.name} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: `${color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontSize: '12px',
                        fontWeight: 700,
                        color,
                        textTransform: 'uppercase',
                      }}
                    >
                      {plan.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '4px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            textTransform: 'capitalize',
                          }}
                        >
                          {plan.name}
                        </span>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {plan.count} ({percentage}%)
                        </span>
                      </div>
                      <div
                        style={{
                          height: '6px',
                          backgroundColor: 'var(--border-color)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${percentage}%`,
                            height: '100%',
                            backgroundColor: color,
                            borderRadius: '3px',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Clientes recentes */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Clientes Recentes</h2>
          <a
            href="/admin/clients"
            style={{
              fontSize: '13px',
              color: 'var(--accent)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Ver todos
          </a>
        </div>

        {recentUsers.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '24px' }}>
            Nenhum cliente cadastrado
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentUsers.map((user) => (
              <div
                key={user.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(70, 114, 236, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Users size={18} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                      {user.name || 'Sem nome'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{user.email}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(139, 92, 246, 0.1)',
                      color: '#8b5cf6',
                      fontSize: '12px',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                    }}
                  >
                    {user.plan || 'free'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                    <Store size={14} />
                    <span style={{ fontSize: '12px' }}>{user.shops_count}</span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{formatDate(user.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
