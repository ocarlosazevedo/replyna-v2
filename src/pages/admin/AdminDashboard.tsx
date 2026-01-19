import { useEffect, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { subDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
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

  useEffect(() => {
    loadStats()
  }, [range])

  const loadStats = async () => {
    if (!range?.from || !range?.to) return

    setLoading(true)
    try {
      const dateStart = startOfDay(range.from)
      const dateEnd = endOfDay(range.to)

      // Executar todas as queries em paralelo
      const [
        totalUsersRes,
        activeUsersRes,
        totalShopsRes,
        activeShopsRes,
        totalConversationsRes,
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
          .gte('created_at', dateStart.toISOString())
          .lte('created_at', dateEnd.toISOString()),
        supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', dateStart.toISOString())
          .lte('created_at', dateEnd.toISOString()),
        supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('was_auto_replied', true)
          .gte('created_at', dateStart.toISOString())
          .lte('created_at', dateEnd.toISOString()),
        supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', dateStart.toISOString())
          .lte('created_at', dateEnd.toISOString()),
        supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('direction', 'inbound')
          .gte('created_at', dateStart.toISOString())
          .lte('created_at', dateEnd.toISOString()),
        supabase
          .from('conversations')
          .select('category')
          .gte('created_at', dateStart.toISOString())
          .lte('created_at', dateEnd.toISOString()),
        supabase
          .from('users')
          .select('id, name, email, plan, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('shops').select('user_id'),
        supabase.from('users').select('plan'),
        supabase.from('users').select('emails_used, emails_limit'),
      ])

      // Contar usuários no limite (emails_used >= emails_limit)
      const usersAtLimitCount = (usersWithLimitsRes.data || []).filter(
        (u) => u.emails_used >= u.emails_limit && u.emails_limit > 0
      ).length

      // Processar categorias
      const categories: Record<string, number> = {}
      ;(categoriesRes.data || []).forEach((conv: { category?: string }) => {
        const cat = conv.category || 'outros'
        categories[cat] = (categories[cat] || 0) + 1
      })

      // Processar usuários recentes com contagem de lojas
      const shopCountByUser: Record<string, number> = {}
      ;(shopsRes.data || []).forEach((shop: { user_id: string }) => {
        shopCountByUser[shop.user_id] = (shopCountByUser[shop.user_id] || 0) + 1
      })

      const processedRecentUsers: RecentUser[] = (recentUsersRes.data || []).map(
        (user: { id: string; name: string | null; email: string; plan: string; created_at: string }) => ({
          ...user,
          shops_count: shopCountByUser[user.id] || 0,
        })
      )

      // Processar distribuição por plano
      const planCounts: Record<string, number> = {}
      ;(allUsersForPlansRes.data || []).forEach((user: { plan?: string }) => {
        const plan = user.plan || 'free'
        planCounts[plan] = (planCounts[plan] || 0) + 1
      })

      const planDist: Plan[] = Object.entries(planCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)

      setStats({
        totalUsers: totalUsersRes.count || 0,
        activeUsers: activeUsersRes.count || 0,
        totalShops: totalShopsRes.count || 0,
        activeShops: activeShopsRes.count || 0,
        totalConversations: totalConversationsRes.count || 0,
        totalMessages: totalMessagesRes.count || 0,
        automationRate:
          totalMessagesRes.count && autoRepliedRes.count
            ? Math.round((autoRepliedRes.count / totalMessagesRes.count) * 100)
            : 0,
        newUsersInPeriod: newUsersInPeriodRes.count || 0,
        emailsProcessed: emailsProcessedRes.count || 0,
        usersAtLimit: usersAtLimitCount,
        categories,
      })

      setRecentUsers(processedRecentUsers)
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
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '32px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Painel de Controle
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            Visao geral de todas as metricas da Replyna
          </p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {/* Metricas principais - Linha 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '24px' }}>
        <div style={statCardStyle}>
          <div style={iconBoxStyle('#3b82f6')}>
            <Users size={24} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total de Clientes</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.totalUsers || 0}
            </div>
            <div style={{ fontSize: '12px', color: '#22c55e', marginTop: '4px' }}>{stats?.activeUsers || 0} ativos</div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#8b5cf6')}>
            <Store size={24} style={{ color: '#8b5cf6' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total de Lojas</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.totalShops || 0}
            </div>
            <div style={{ fontSize: '12px', color: '#22c55e', marginTop: '4px' }}>{stats?.activeShops || 0} ativas</div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#f59e0b')}>
            <MessageSquare size={24} style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Conversas no Periodo
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.totalConversations || 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {stats?.totalMessages || 0} mensagens
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#22c55e')}>
            <CheckCircle size={24} style={{ color: '#22c55e' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Taxa de Automacao</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.automationRate || 0}%
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              no periodo selecionado
            </div>
          </div>
        </div>
      </div>

      {/* Metricas secundarias - Linha 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '24px' }}>
        <div style={statCardStyle}>
          <div style={iconBoxStyle('#10b981')}>
            <UserPlus size={24} style={{ color: '#10b981' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Novos Cadastros</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.newUsersInPeriod || 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>no periodo</div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#06b6d4')}>
            <Mail size={24} style={{ color: '#06b6d4' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Emails Recebidos
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.emailsProcessed || 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>no periodo</div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#ef4444')}>
            <AlertTriangle size={24} style={{ color: '#ef4444' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Clientes no Limite</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.usersAtLimit || 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>sem creditos</div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#a855f7')}>
            <TrendingUp size={24} style={{ color: '#a855f7' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Media Emails/Cliente
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.totalUsers ? Math.round((stats?.emailsProcessed || 0) / stats.totalUsers) : 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>no periodo</div>
          </div>
        </div>
      </div>

      {/* Grid de 2 colunas - Distribuição por categoria e Distribuição por plano */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
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
