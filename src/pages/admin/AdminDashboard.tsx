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
  Inbox,
  Eye,
  EyeOff,
  Filter,
} from 'lucide-react'
import DateRangePicker from '../../components/DateRangePicker'
import ConversationModal from '../../components/ConversationModal'

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

interface Plan {
  name: string
  count: number
}

interface RecentConversation {
  id: string
  shop_id: string
  shop_name: string
  customer_email: string
  customer_name: string | null
  subject: string | null
  category: string | null
  created_at: string
  last_message_at: string | null
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
  spam: 'Spam',
  duvidas_gerais: 'Duvidas gerais',
  rastreio: 'Rastreio',
  troca_devolucao_reembolso: 'Troca/Devolucao/Reembolso',
  edicao_pedido: 'Edicao de pedido',
  suporte_humano: 'Suporte Humano',
  reembolso: 'Reembolso',
  produto: 'Produto',
  pagamento: 'Pagamento',
  entrega: 'Entrega',
  outros: 'Outros',
}

const categoryColors: Record<string, string> = {
  spam: '#dc2626',
  duvidas_gerais: '#3b82f6',
  rastreio: '#22c55e',
  troca_devolucao_reembolso: '#f59e0b',
  edicao_pedido: '#8b5cf6',
  suporte_humano: '#ec4899',
  reembolso: '#ef4444',
  produto: '#8b5cf6',
  pagamento: '#22c55e',
  entrega: '#f59e0b',
  outros: '#6b7280',
}

// Categorias disponíveis para filtro no Super Inbox
const filterCategories = [
  { value: 'all', label: 'Todas categorias' },
  { value: 'duvidas_gerais', label: 'Duvidas gerais' },
  { value: 'rastreio', label: 'Rastreio' },
  { value: 'troca_devolucao_reembolso', label: 'Troca/Devolucao/Reembolso' },
  { value: 'edicao_pedido', label: 'Edicao de pedido' },
  { value: 'suporte_humano', label: 'Suporte humano' },
  { value: 'outros', label: 'Outros' },
]

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [planDistribution, setPlanDistribution] = useState<Plan[]>([])
  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<DateRange>(getDefaultRange())
  const isMobile = useIsMobile()

  // Super Inbox states
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showSpam, setShowSpam] = useState(false)

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
      setRecentConversations(data.recentConversations || [])

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

      {/* Super Inbox */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={iconBoxStyle('#8b5cf6')}>
              <Inbox size={20} style={{ color: '#8b5cf6' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Super Inbox</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Todas as conversas de todas as lojas</p>
            </div>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Filtro de categoria */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {filterCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* Toggle SPAM */}
            <button
              type="button"
              onClick={() => setShowSpam(!showSpam)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: showSpam ? 'rgba(220, 38, 38, 0.1)' : 'var(--bg-primary)',
                color: showSpam ? '#dc2626' : 'var(--text-secondary)',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {showSpam ? <Eye size={14} /> : <EyeOff size={14} />}
              {showSpam ? 'Mostrando SPAM' : 'SPAM oculto'}
            </button>
          </div>
        </div>

        {/* Lista de conversas */}
        {(() => {
          const filteredConversations = recentConversations.filter((conv) => {
            // Filtrar por SPAM
            if (!showSpam && conv.category === 'spam') return false
            // Filtrar por categoria
            if (categoryFilter !== 'all' && conv.category !== categoryFilter) return false
            return true
          })

          if (filteredConversations.length === 0) {
            return (
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '40px' }}>
                {recentConversations.length === 0
                  ? 'Nenhuma conversa no periodo selecionado'
                  : 'Nenhuma conversa encontrada com os filtros aplicados'
                }
              </div>
            )
          }

          return (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Loja</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Cliente</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Assunto</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Categoria</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConversations.map((conv) => {
                    const categoryColor = categoryColors[conv.category || 'outros'] || '#6b7280'
                    return (
                      <tr
                        key={conv.id}
                        onClick={() => setSelectedConversationId(conv.id)}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Store size={14} style={{ color: '#8b5cf6' }} />
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                              {conv.shop_name}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                            {conv.customer_name || conv.customer_email}
                          </div>
                          {conv.customer_name && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                              {conv.customer_email}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'block', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {conv.subject || '(Sem assunto)'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: `${categoryColor}15`,
                              color: categoryColor,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {categoryLabels[conv.category || 'outros'] || conv.category || 'Outros'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {formatDate(conv.last_message_at || conv.created_at)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })()}
      </div>

      {/* Modal de conversa */}
      <ConversationModal
        conversationId={selectedConversationId}
        onClose={() => setSelectedConversationId(null)}
        onCategoryChange={(convId, newCategory) => {
          // Atualizar a categoria na lista local
          setRecentConversations(prev =>
            prev.map(conv =>
              conv.id === convId ? { ...conv, category: newCategory } : conv
            )
          )
        }}
      />
    </div>
  )
}
