import { useCallback, useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { subDays } from 'date-fns'
import {
  Users,
  Store,
  CheckCircle,
  Mail,
  AlertTriangle,
  TrendingUp,
  Package,
  RefreshCw,
  HelpCircle,
  Truck,
  Headphones,
  Inbox,
  Eye,
  EyeOff,
  Filter,
  ChevronDown,
} from 'lucide-react'
import DateRangePicker from '../../components/DateRangePicker'
import ConversationModal from '../../components/ConversationModal'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../constants/categories'
import { useAdminDashboardStats } from '../../hooks/useAdminDashboardData'
import { useIsMobile } from '../../hooks/useIsMobile'


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

// Ícones para categorias (mesmas de categories.ts)
const categoryIcons: Record<string, typeof Package> = {
  rastreio: Truck,
  troca_devolucao_reembolso: RefreshCw,
  edicao_pedido: Package,
  suporte_humano: Headphones,
  duvidas_gerais: HelpCircle,
  spam: AlertTriangle,
  acknowledgment: Mail,
}

// Usando CATEGORY_LABELS e CATEGORY_COLORS de src/constants/categories.ts para consistência

// Categorias disponíveis para filtro no Super Inbox
const filterCategories = [
  { value: 'all', label: 'Todas categorias' },
  { value: 'duvidas_gerais', label: 'Dúvidas gerais' },
  { value: 'rastreio', label: 'Rastreio' },
  { value: 'troca_devolucao_reembolso', label: 'Troca/Devolução/Reembolso' },
  { value: 'edicao_pedido', label: 'Edição de pedido' },
  { value: 'suporte_humano', label: 'Suporte humano' },
  { value: 'spam', label: 'Spam' },
]

export default function AdminDashboard() {
  const [range, setRange] = useState<DateRange>(getDefaultRange())
  const isMobile = useIsMobile()

  // Calcular datas para o SWR
  const dateStart = useMemo(() => range?.from ? startOfDay(range.from) : null, [range?.from])
  const dateEnd = useMemo(() => range?.to ? endOfDay(range.to) : null, [range?.to])

  // SWR hook para dados do dashboard com cache automático
  const { data, isLoading: loading, mutate } = useAdminDashboardStats(dateStart, dateEnd)

  // Extrair dados do SWR
  const stats = data?.stats || null
  const recentConversations = data?.recentConversations || []
  const clients = data?.clients || []

  // Super Inbox states
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showSpam, setShowSpam] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string>('all')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // Função para recarregar dados manualmente
  const loadStats = useCallback(() => {
    mutate()
    setLastUpdate(new Date())
  }, [mutate])

  // Função para atualizar categoria localmente (otimistic update)
  const handleCategoryChange = useCallback((convId: string, newCategory: string) => {
    if (data) {
      mutate({
        ...data,
        recentConversations: data.recentConversations.map(conv =>
          conv.id === convId ? { ...conv, category: newCategory } : conv
        )
      }, false)
    }
  }, [data, mutate])

  // Memoizar cliente selecionado e suas lojas
  const selectedClientShops = useMemo(() => {
    const selectedClient = clients.find(c => c.id === selectedClientId)
    return selectedClient?.shops || []
  }, [clients, selectedClientId])

  // Memoizar conversas filtradas
  const filteredConversations = useMemo(() => {
    return recentConversations.filter((conv) => {
      if (selectedClientId !== 'all' && !selectedClientShops.includes(conv.shop_id)) return false
      if (!showSpam && conv.category === 'spam') return false
      if (categoryFilter !== 'all' && conv.category !== categoryFilter) return false
      return true
    })
  }, [recentConversations, selectedClientId, selectedClientShops, showSpam, categoryFilter])

  // Memoizar total categorizado
  const totalCategorized = useMemo(() =>
    Object.values(stats?.categories || {}).reduce((a, b) => a + b, 0),
    [stats?.categories]
  )

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
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(date))

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

      {/* Metricas de Conversas */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: isMobile ? '12px' : '24px', marginBottom: isMobile ? '12px' : '24px' }}>
        <div style={statCardStyle}>
          <div style={iconBoxStyle('#06b6d4')}>
            <Mail size={isMobile ? 20 : 24} style={{ color: '#06b6d4' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? '11px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Conversas Recebidas
            </div>
            <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.conversationsReceived || 0}
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>clientes no periodo</div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#10b981')}>
            <CheckCircle size={isMobile ? 20 : 24} style={{ color: '#10b981' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? '11px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Conversas Atendidas
            </div>
            <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.conversationsReplied || 0}
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>com resposta</div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#8b5cf6')}>
            <TrendingUp size={isMobile ? 20 : 24} style={{ color: '#8b5cf6' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? '11px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Taxa de Automacao
            </div>
            <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.automationRate || 0}%
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              atendidas/recebidas
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#22c55e')}>
            <CheckCircle size={isMobile ? 20 : 24} style={{ color: '#22c55e' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? '11px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Taxa de Sucesso
            </div>
            <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.successRate || 0}%
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              sem intervencao humana
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#f59e0b')}>
            <Headphones size={isMobile ? 20 : 24} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? '11px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              E-mails Humanos
            </div>
            <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.humanEmails || 0}
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              encaminhados
            </div>
          </div>
        </div>
      </div>

      {/* Distribuição por categoria */}
      <div style={{ ...cardStyle, marginBottom: isMobile ? '12px' : '24px' }}>
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
                const color = CATEGORY_COLORS[category] || '#6b7280'
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
                          {CATEGORY_LABELS[category] || category}
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

      {/* Super Inbox */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={iconBoxStyle('#8b5cf6')}>
              <Inbox size={20} style={{ color: '#8b5cf6' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Super Inbox</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                Atualizado: {new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo' }).format(lastUpdate)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadStats()}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
              }}
              title="Atualizar agora"
            >
              <RefreshCw size={14} style={{ color: 'var(--text-secondary)', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Filtro de cliente - Dropdown customizado */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  setShowClientDropdown(!showClientDropdown)
                  setShowCategoryDropdown(false)
                }}
                className={`replyna-dropdown-trigger ${showClientDropdown ? 'open' : ''}`}
                style={{
                  padding: '8px 12px',
                  fontSize: '13px',
                  minWidth: '160px',
                  backgroundColor: selectedClientId !== 'all' ? 'rgba(139, 92, 246, 0.1)' : undefined,
                  borderColor: selectedClientId !== 'all' ? 'rgba(139, 92, 246, 0.3)' : undefined,
                  color: selectedClientId !== 'all' ? '#8b5cf6' : undefined,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={14} />
                  {selectedClientId === 'all'
                    ? 'Todos os clientes'
                    : (clients.find(c => c.id === selectedClientId)?.name || clients.find(c => c.id === selectedClientId)?.email || 'Cliente')}
                </span>
                <ChevronDown
                  size={16}
                  style={{
                    transform: showClientDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                />
              </button>

              {showClientDropdown && (
                <>
                  <div
                    className="replyna-dropdown-menu replyna-scrollbar"
                    style={{ maxHeight: '250px', overflowY: 'auto', minWidth: '220px' }}
                  >
                    <button
                      onClick={() => {
                        setSelectedClientId('all')
                        setShowClientDropdown(false)
                      }}
                      className={`replyna-dropdown-item ${selectedClientId === 'all' ? 'active' : ''}`}
                    >
                      Todos os clientes
                    </button>
                    {clients.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => {
                          setSelectedClientId(client.id)
                          setShowClientDropdown(false)
                        }}
                        className={`replyna-dropdown-item ${selectedClientId === client.id ? 'active' : ''}`}
                      >
                        {client.name || client.email}
                      </button>
                    ))}
                  </div>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 50 }}
                    onClick={() => setShowClientDropdown(false)}
                  />
                </>
              )}
            </div>

            {/* Filtro de categoria - Dropdown customizado */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  setShowCategoryDropdown(!showCategoryDropdown)
                  setShowClientDropdown(false)
                }}
                className={`replyna-dropdown-trigger ${showCategoryDropdown ? 'open' : ''}`}
                style={{ padding: '8px 12px', fontSize: '13px', minWidth: '140px' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Filter size={14} />
                  {filterCategories.find(c => c.value === categoryFilter)?.label || 'Categoria'}
                </span>
                <ChevronDown
                  size={16}
                  style={{
                    transform: showCategoryDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                />
              </button>

              {showCategoryDropdown && (
                <>
                  <div className="replyna-dropdown-menu" style={{ minWidth: '180px' }}>
                    {filterCategories.map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => {
                          setCategoryFilter(cat.value)
                          setShowCategoryDropdown(false)
                        }}
                        className={`replyna-dropdown-item ${categoryFilter === cat.value ? 'active' : ''}`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 50 }}
                    onClick={() => setShowCategoryDropdown(false)}
                  />
                </>
              )}
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
        {filteredConversations.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '40px' }}>
            {recentConversations.length === 0
              ? 'Nenhuma conversa no periodo selecionado'
              : 'Nenhuma conversa encontrada com os filtros aplicados'
            }
          </div>
        ) : (
          <div className="replyna-scrollbar" style={{ maxHeight: isMobile ? '350px' : '450px', overflowY: 'auto', overflowX: 'auto', scrollBehavior: 'smooth' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Loja</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Cliente</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Assunto</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Categoria</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Data</th>
                </tr>
              </thead>
              <tbody>
                  {filteredConversations.map((conv) => {
                    const categoryColor = (conv.category && CATEGORY_COLORS[conv.category]) || '#6b7280'
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
                          {conv.category ? (
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
                              {CATEGORY_LABELS[conv.category] || conv.category}
                            </span>
                          ) : (
                            <span
                              style={{
                                padding: '4px 10px',
                                borderRadius: '999px',
                                fontSize: '11px',
                                fontWeight: 600,
                                backgroundColor: 'rgba(251, 191, 36, 0.15)',
                                color: '#f59e0b',
                                whiteSpace: 'nowrap',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <span style={{ animation: 'replyna-pulse 1.5s ease-in-out infinite' }}>⏳</span>
                              Processando...
                            </span>
                          )}
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
        )}
      </div>

      {/* Modal de conversa */}
      <ConversationModal
        conversationId={selectedConversationId}
        onClose={() => setSelectedConversationId(null)}
        onCategoryChange={handleCategoryChange}
        isAdmin={true}
      />
    </div>
  )
}
