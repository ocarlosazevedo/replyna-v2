import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DateRange } from 'react-day-picker'
import { Mail, CheckCircle, TrendingUp, Headphones, Package, RefreshCw, Truck, HelpCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { supabase } from '../lib/supabase'
import DateRangePicker from '../components/DateRangePicker'
import CreditsWarningBanner from '../components/CreditsWarningBanner'
import ShopifyErrorBanner from '../components/ShopifyErrorBanner'
import ConversationModal from '../components/ConversationModal'
import { getCategoryBadgeStyle, getCategoryLabel, CATEGORY_COLORS, CATEGORY_LABELS } from '../constants/categories'

const VolumeChart = lazy(() => import('../components/VolumeChart'))

const CACHE_TTL = 5 * 60 * 1000

interface ShopOption {
  id: string
  name: string
}

interface UserProfile {
  name: string | null
  plan: string | null
  emails_limit: number | null
  emails_used: number | null
  shops_limit: number | null
  created_at: string | null
  extra_emails_purchased: number | null
  extra_emails_used: number | null
}

interface ConversationRow {
  id: string
  shop_id: string
  customer_email: string
  customer_name: string | null
  subject: string | null
  category: string | null
  status: string | null
  created_at: string
  shop_name?: string
}

interface MetricSummary {
  conversationsReceived: number
  conversationsReplied: number
  automationRate: number
  successRate: number
  pendingHuman: number
}

interface MessageRow {
  created_at: string
  direction: string
  was_auto_replied: boolean | null
  category: string | null
  conversation_id: string
  conversations: { shop_id: string; category: string | null }[]
}

const formatNumber = (value: number) =>
  new Intl.NumberFormat('pt-BR').format(value)

const formatPercent = (value: number) =>
  `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)

const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(date)

const getDefaultRange = (): DateRange => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Sempre retornar apenas "Hoje" como padrão
  return { from: today, to: today }
}

const toLocalDateString = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseLocalDateString = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
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

const calculateRenewalDate = (createdAt: string | null) => {
  if (!createdAt) return null
  const created = new Date(createdAt)
  const today = new Date()
  const renewal = new Date(created)
  while (renewal <= today) {
    renewal.setMonth(renewal.getMonth() + 1)
  }
  return renewal
}

const getWeekStart = (date: Date) => {
  const day = date.getDay()
  const diff = (day + 6) % 7
  const start = new Date(date)
  start.setDate(date.getDate() - diff)
  start.setHours(0, 0, 0, 0)
  return start
}

const buildVolumeSeries = (messages: MessageRow[], granularity: 'day' | 'week' | 'month', inboundConversationIds?: Set<string>) => {
  const buckets = new Map<string, { date: Date; received: number; replied: number }>()

  // Helper para obter categoria da conversa
  const getConvCategory = (message: MessageRow) => {
    const conv = message.conversations?.[0] || (message.conversations as unknown as { category: string | null })
    return conv?.category || message.category
  }

  messages.forEach((message) => {
    // Ignorar spam e acknowledgment no gráfico de volume (usa categoria da conversa)
    const category = getConvCategory(message)
    if (category === 'spam' || category === 'acknowledgment') return

    // Para outbound, só contar se tiver inbound correspondente no período
    if (message.direction === 'outbound' && inboundConversationIds && !inboundConversationIds.has(message.conversation_id)) {
      return
    }

    const date = new Date(message.created_at)
    let key = ''
    let labelDate = date

    if (granularity === 'day') {
      labelDate = startOfDay(date)
      key = labelDate.toISOString().slice(0, 10)
    } else if (granularity === 'week') {
      labelDate = getWeekStart(date)
      key = labelDate.toISOString().slice(0, 10)
    } else {
      labelDate = new Date(date.getFullYear(), date.getMonth(), 1)
      key = `${labelDate.getFullYear()}-${labelDate.getMonth()}`
    }

    if (!buckets.has(key)) {
      buckets.set(key, { date: labelDate, received: 0, replied: 0 })
    }
    const bucket = buckets.get(key)
    if (!bucket) return

    if (message.direction === 'inbound') {
      bucket.received += 1
    }
    if (message.direction === 'outbound' && message.was_auto_replied) {
      bucket.replied += 1
    }
  })

  return Array.from(buckets.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((bucket) => {
      let label = ''
      if (granularity === 'day') {
        label = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(bucket.date)
      } else if (granularity === 'week') {
        label = `Sem ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(bucket.date)}`
      } else {
        label = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(bucket.date)
      }
      return {
        label,
        received: bucket.received,
        replied: bucket.replied,
      }
    })
}

// Usando constantes compartilhadas de src/constants/categories.ts para consistência

// Ícones para cada categoria
const categoryIcons: Record<string, typeof Package> = {
  rastreio: Truck,
  troca_devolucao_reembolso: RefreshCw,
  edicao_pedido: Package,
  suporte_humano: Headphones,
  duvidas_gerais: HelpCircle,
  spam: Mail,
}

// Estilo do box do ícone nas métricas
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

const Skeleton = ({ height = 16, width = '100%' }: { height?: number; width?: number | string }) => (
  <div
    style={{
      width,
      height,
      backgroundColor: 'var(--border-color)',
      borderRadius: 8,
      animation: 'replyna-pulse 1.6s ease-in-out infinite',
    }}
  />
)

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const cacheRef = useRef(new Map<string, { timestamp: number; data: unknown }>())

  const [shops, setShops] = useState<ShopOption[]>([])
  const [selectedShopId, setSelectedShopId] = useState('all')
  const [range, setRange] = useState<DateRange>(getDefaultRange())

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [metrics, setMetrics] = useState<MetricSummary>({
    conversationsReceived: 0,
    conversationsReplied: 0,
    automationRate: 0,
    successRate: 0,
    pendingHuman: 0,
  })
  const [volumeData, setVolumeData] = useState<Array<{ label: string; received: number; replied: number }>>([])
  const [conversations, setConversations] = useState<ConversationRow[]>([])

  const [loadingProfile, setLoadingProfile] = useState(true)
  const [loadingShops, setLoadingShops] = useState(true)
  const [loadingMetrics, setLoadingMetrics] = useState(true)
  const [loadingChart, setLoadingChart] = useState(true)
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const cacheFetch = useCallback(<T,>(key: string, fetcher: () => Promise<T>): Promise<T> => {
    const cached = cacheRef.current.get(key)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return Promise.resolve(cached.data as T)
    }
    return fetcher().then((data) => {
      cacheRef.current.set(key, { timestamp: Date.now(), data })
      return data
    })
  }, [])

  const storagePrefix = useMemo(() => (user?.id ? `replyna.dashboard.${user.id}` : 'replyna.dashboard'), [user?.id])

  const activeShopIds = useMemo(() => shops.map((shop) => shop.id), [shops])
  const effectiveShopIds = useMemo(() => {
    if (selectedShopId === 'all') return activeShopIds
    return [selectedShopId]
  }, [activeShopIds, selectedShopId])

  const dateStart = useMemo(() => (range?.from ? startOfDay(range.from) : null), [range])
  const dateEnd = useMemo(() => (range?.to ? endOfDay(range.to) : null), [range])

  // Calcular granularidade automaticamente baseado no range de datas
  const granularity = useMemo((): 'day' | 'week' | 'month' => {
    if (!range?.from || !range?.to) return 'day'
    const diffDays = Math.ceil((range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays <= 14) return 'day' // Até 2 semanas: por dia
    if (diffDays <= 90) return 'week' // Até 3 meses: por semana
    return 'month' // Mais de 3 meses: por mês
  }, [range])

  useEffect(() => {
    if (!user) return

    // Sempre verificar se a data salva é de hoje
    const storedRange = localStorage.getItem(`${storagePrefix}.range`)
    if (storedRange) {
      try {
        const parsed = JSON.parse(storedRange)
        const from = parsed?.from ? parseLocalDateString(parsed.from) : null
        const to = parsed?.to ? parseLocalDateString(parsed.to) : null

        // Verificar se o range salvo é de hoje
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayStr = toLocalDateString(today)

        // Só restaurar se a data "to" for hoje, senão resetar para hoje
        if (to && toLocalDateString(to) === todayStr) {
          setRange({ from: from || today, to })
        } else {
          // Resetar para "Hoje" se a data salva não for de hoje
          setRange(getDefaultRange())
        }
      } catch {
        setRange(getDefaultRange())
      }
    }

  }, [storagePrefix, user])

  useEffect(() => {
    if (!user) return
    localStorage.setItem(
      `${storagePrefix}.range`,
      JSON.stringify({
        from: range?.from ? toLocalDateString(range.from) : null,
        to: range?.to ? toLocalDateString(range.to) : null,
      })
    )
  }, [range, storagePrefix, user])

  useEffect(() => {
    if (!user) return
    localStorage.setItem(`${storagePrefix}.shop`, selectedShopId)
  }, [selectedShopId, storagePrefix, user])

  useEffect(() => {
    if (!user) return
    const loadProfile = async () => {
      setLoadingProfile(true)
      try {
        const data = await cacheFetch(`profile:${user.id}`, async () => {
          const { data, error } = await supabase
            .from('users')
            .select('name, plan, emails_limit, emails_used, shops_limit, created_at, extra_emails_purchased, extra_emails_used')
            .eq('id', user.id)
            .maybeSingle()
          if (error) throw error
          return data as UserProfile | null
        })
        setProfile(data)
      } catch (err) {
        console.error('Erro ao carregar perfil:', err)
      } finally {
        setLoadingProfile(false)
      }
    }

    const loadShops = async () => {
      setLoadingShops(true)
      try {
        const data = await cacheFetch(`shops:${user.id}`, async () => {
          const { data, error } = await supabase
            .from('shops')
            .select('id, name')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('name', { ascending: true })
          if (error) throw error
          return (data || []) as ShopOption[]
        })
        setShops(data)
      } catch (err) {
        console.error('Erro ao carregar lojas:', err)
      } finally {
        setLoadingShops(false)
      }
    }

    loadProfile()
    loadShops()
  }, [cacheFetch, user])

  useEffect(() => {
    if (!user || loadingShops) return
    if (shops.length === 0) {
      navigate('/shops')
      return
    }

    const storedShop = localStorage.getItem(`${storagePrefix}.shop`)
    if (storedShop && (storedShop === 'all' || shops.some((shop) => shop.id === storedShop))) {
      setSelectedShopId(storedShop)
    } else {
      setSelectedShopId('all')
    }
  }, [loadingShops, navigate, shops, storagePrefix, user])

  useEffect(() => {
    if (!user || !dateStart || !dateEnd || effectiveShopIds.length === 0) return
    let isActive = true
    setError(null)
    setLoadingMetrics(true)
    setLoadingConversations(true)
    // Gráfico carrega separadamente para não bloquear métricas
    setLoadingChart(true)

    const loadPendingHuman = async () => {
      // Excluir troca_devolucao_reembolso da contagem de atendimento humano
      const baseQuery = () =>
        supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', dateStart.toISOString())
          .lte('created_at', dateEnd.toISOString())
          .eq('status', 'pending_human')
          .neq('category', 'troca_devolucao_reembolso')

      const pendingQuery =
        selectedShopId === 'all'
          ? baseQuery().in('shop_id', effectiveShopIds)
          : baseQuery().eq('shop_id', selectedShopId)

      const { count: pendingHuman } = await cacheFetch(
        `conversations-pending:${user.id}:${selectedShopId}:${effectiveShopIds.join(',')}:${dateStart.toISOString()}:${dateEnd.toISOString()}`,
        async () => {
          const { count, error } = await pendingQuery
          if (error) throw error
          return { count }
        }
      )

      return pendingHuman ?? 0
    }

    // Usar count queries para métricas baseadas em CONVERSAS (não mensagens)
    const loadConversationCounts = async () => {
      // Count de conversas recebidas (excluindo spam e acknowledgment)
      const receivedBaseQuery = () =>
        supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', dateStart.toISOString())
          .lte('created_at', dateEnd.toISOString())
          .not('category', 'in', '("spam","acknowledgment")')

      const receivedQuery =
        selectedShopId === 'all'
          ? receivedBaseQuery().in('shop_id', effectiveShopIds)
          : receivedBaseQuery().eq('shop_id', selectedShopId)

      // Count de conversas atendidas (que têm pelo menos 1 mensagem outbound)
      // Usamos uma subquery para verificar se existe resposta na conversa
      const repliedBaseQuery = () =>
        supabase
          .from('conversations')
          .select('id, messages!inner(direction)', { count: 'exact', head: true })
          .gte('created_at', dateStart.toISOString())
          .lte('created_at', dateEnd.toISOString())
          .not('category', 'in', '("spam","acknowledgment")')
          .eq('messages.direction', 'outbound')

      const repliedQuery =
        selectedShopId === 'all'
          ? repliedBaseQuery().in('shop_id', effectiveShopIds)
          : repliedBaseQuery().eq('shop_id', selectedShopId)

      const [receivedResult, repliedResult] = await Promise.all([
        receivedQuery,
        repliedQuery,
      ])

      if (receivedResult.error) throw receivedResult.error
      if (repliedResult.error) throw repliedResult.error

      return {
        conversationsReceived: receivedResult.count ?? 0,
        conversationsReplied: repliedResult.count ?? 0,
      }
    }

    const loadMessages = async () => {
      // Carregar mensagens para o gráfico de volume (limite reduzido para performance)
      const query = supabase
        .from('messages')
        .select('created_at, direction, was_auto_replied, category, conversation_id, conversations!inner(shop_id, category)')
        .gte('created_at', dateStart.toISOString())
        .lte('created_at', dateEnd.toISOString())
        .limit(2000)

      const { data, error } =
        selectedShopId === 'all'
          ? await query.in('conversations.shop_id', effectiveShopIds)
          : await query.eq('conversations.shop_id', selectedShopId)

      if (error) throw error
      return (data || []) as MessageRow[]
    }

    const loadConversationsList = async () => {
      // Lista de conversas para exibição (limite de 200 mais recentes)
      const query = supabase
        .from('conversations')
        .select('id, shop_id, customer_email, customer_name, subject, category, status, created_at, shops(name)')
        .not('category', 'is', null) // Excluir conversas ainda em processamento
        .gte('created_at', dateStart.toISOString())
        .lte('created_at', dateEnd.toISOString())
        .order('created_at', { ascending: false })
        .limit(200)

      const { data, error } =
        selectedShopId === 'all'
          ? await query.in('shop_id', effectiveShopIds)
          : await query.eq('shop_id', selectedShopId)

      if (error) throw error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data || []).map((row: any) => ({
        id: row.id,
        shop_id: row.shop_id,
        customer_email: row.customer_email,
        customer_name: row.customer_name,
        subject: row.subject,
        category: row.category,
        status: row.status,
        created_at: row.created_at,
        shop_name: row.shops?.name || (Array.isArray(row.shops) ? row.shops[0]?.name : null) || null,
      })) as ConversationRow[]
    }

    // OTIMIZAÇÃO: Carregar em 2 etapas para mostrar dados mais rápido
    // Etapa 1: Métricas e Inbox (rápido)
    // Etapa 2: Gráfico (mais lento, carrega depois)
    const loadFastData = async () => {
      try {
        const [pendingHuman, conversationCounts, conversationRows] = await Promise.all([
          loadPendingHuman(),
          cacheFetch(
            `conversation-counts:${user.id}:${selectedShopId}:${effectiveShopIds.join(',')}:${dateStart.toISOString()}:${dateEnd.toISOString()}`,
            loadConversationCounts
          ),
          cacheFetch(
            `conversations:${user.id}:${selectedShopId}:${effectiveShopIds.join(',')}:${dateStart.toISOString()}:${dateEnd.toISOString()}`,
            loadConversationsList
          ),
        ])

        if (!isActive) return

        // Métricas usando count de CONVERSAS (não mensagens individuais)
        const { conversationsReceived, conversationsReplied } = conversationCounts

        const automationRate = conversationsReceived > 0
          ? (conversationsReplied / conversationsReceived) * 100
          : 0

        const successRate = conversationsReplied > 0
          ? ((conversationsReplied - pendingHuman) / conversationsReplied) * 100
          : 0

        setMetrics({
          conversationsReceived,
          conversationsReplied,
          automationRate,
          successRate,
          pendingHuman,
        })
        setConversations(conversationRows)
        setLoadingMetrics(false)
        setLoadingConversations(false)
      } catch (err) {
        console.error('Erro ao carregar métricas:', err)
        setError('Não foi possível carregar os dados do dashboard.')
        setLoadingMetrics(false)
        setLoadingConversations(false)
      }
    }

    const loadChartData = async () => {
      try {
        const messageRows = await cacheFetch(
          `messages:${user.id}:${selectedShopId}:${effectiveShopIds.join(',')}:${dateStart.toISOString()}:${dateEnd.toISOString()}`,
          loadMessages
        )

        if (!isActive) return

        const getConversationCategory = (message: MessageRow) => {
          const conv = message.conversations?.[0] || (message.conversations as unknown as { category: string | null })
          return conv?.category || message.category
        }
        const inboundMessages = messageRows.filter((message) => {
          const category = getConversationCategory(message)
          return message.direction === 'inbound' && category !== 'spam' && category !== 'acknowledgment'
        })
        const inboundConversationIds = new Set(inboundMessages.map((m) => m.conversation_id))

        setVolumeData(buildVolumeSeries(messageRows, granularity, inboundConversationIds))
      } catch (err) {
        console.error('Erro ao carregar gráfico:', err)
      } finally {
        if (isActive) setLoadingChart(false)
      }
    }

    // Executar carregamentos: métricas primeiro, gráfico depois
    loadFastData().then(() => {
      if (isActive) loadChartData()
    })

    // Real-time subscription para novas conversas
    const channel = supabase
      .channel('dashboard-conversations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          const newConversation = payload.new as ConversationRow
          // Verificar se a conversa pertence a uma das lojas do usuário
          if (effectiveShopIds.includes(newConversation.shop_id)) {
            // Invalidar cache
            cacheRef.current.delete(
              `conversations:${user.id}:${selectedShopId}:${effectiveShopIds.join(',')}:${dateStart.toISOString()}:${dateEnd.toISOString()}`
            )
            cacheRef.current.delete(
              `conversation-counts:${user.id}:${selectedShopId}:${effectiveShopIds.join(',')}:${dateStart.toISOString()}:${dateEnd.toISOString()}`
            )
            cacheRef.current.delete(
              `messages:${user.id}:${selectedShopId}:${effectiveShopIds.join(',')}:${dateStart.toISOString()}:${dateEnd.toISOString()}`
            )
            // Adicionar nova conversa no topo da lista
            setConversations((prev) => {
              const updated = [newConversation, ...prev.filter((c) => c.id !== newConversation.id)]
              return updated
            })
            // Incrementar conversas recebidas (nova conversa = novo cliente)
            setMetrics((prev) => ({
              ...prev,
              conversationsReceived: prev.conversationsReceived + 1,
            }))
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          const updatedConversation = payload.new as ConversationRow
          // Atualizar conversa existente na lista
          setConversations((prev) =>
            prev.map((c) => (c.id === updatedConversation.id ? updatedConversation : c))
          )
        }
      )
      .subscribe()

    return () => {
      isActive = false
      supabase.removeChannel(channel)
    }
  }, [cacheFetch, dateEnd, dateStart, effectiveShopIds, granularity, selectedShopId, user])

  // Calcular categorias a partir das conversas (excluindo spam e processando)
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {}
    conversations
      .filter(c => c.category && c.category !== 'spam' && c.category !== 'acknowledgment')
      .forEach(conv => {
        if (conv.category) {
          stats[conv.category] = (stats[conv.category] || 0) + 1
        }
      })
    return stats
  }, [conversations])

  const totalCategorized = useMemo(() =>
    Object.values(categoryStats).reduce((a, b) => a + b, 0),
    [categoryStats]
  )

  const renewalDate = useMemo(() => calculateRenewalDate(profile?.created_at ?? null), [profile?.created_at])
  const emailsLimit = profile?.emails_limit  // null = ilimitado
  const emailsUsed = profile?.emails_used ?? 0
  const extraEmailsPurchased = profile?.extra_emails_purchased ?? 0
  // Total = limite do plano + extras comprados
  const totalCreditsAvailable = (emailsLimit ?? 0) + extraEmailsPurchased
  const isUnlimited = emailsLimit === null
  const usagePercent = totalCreditsAvailable > 0 ? Math.min((emailsUsed / totalCreditsAvailable) * 100, 100) : 0
  const shopsLimit = profile?.shops_limit  // null = ilimitado
  const isShopsUnlimited = shopsLimit === null

  const shopName = profile?.name || user?.user_metadata?.name || 'Cliente'

  const handleShopChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedShopId(event.target.value)
  }

  const handleConversationClick = (id: string) => {
    setSelectedConversationId(id)
  }

  const renderValue = (value: number, suffix?: string) => {
    if (suffix === 'percent') return formatPercent(value)
    return formatNumber(value)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px' }}>
      {/* Modal de conversa */}
      <ConversationModal
        conversationId={selectedConversationId}
        onClose={() => setSelectedConversationId(null)}
        onCategoryChange={(conversationId, newCategory) => {
          // Atualizar a lista de conversas localmente
          setConversations((prev) =>
            prev.map((c) => (c.id === conversationId ? { ...c, category: newCategory } : c))
          )
          // Invalidar cache
          if (user && dateStart && dateEnd) {
            cacheRef.current.delete(
              `conversations:${user.id}:${selectedShopId}:${effectiveShopIds.join(',')}:${dateStart.toISOString()}:${dateEnd.toISOString()}`
            )
          }
        }}
      />

      {/* Banner de Shopify offline */}
      {activeShopIds.length > 0 && (
        <ShopifyErrorBanner shopIds={activeShopIds} />
      )}

      {/* Banner de créditos - não mostrar para planos ilimitados (emails_limit === null) */}
      {profile && profile.emails_limit !== null && profile.emails_used !== null && (
        <CreditsWarningBanner
          emailsUsed={profile.emails_used ?? 0}
          emailsLimit={profile.emails_limit}
          extraEmailsPurchased={profile.extra_emails_purchased ?? 0}
        />
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '12px' : '16px',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {loadingProfile ? <Skeleton width={180} height={24} /> : `Olá, ${shopName}`}
          </div>
          {!isMobile && (
            <div style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '14px' }}>
              Acompanhe o desempenho do seu atendimento automatizado
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={selectedShopId}
            onChange={handleShopChange}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: isMobile ? '8px 24px 8px 12px' : '10px 24px 10px 14px',
              fontSize: isMobile ? '13px' : '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              minWidth: isMobile ? '120px' : '180px',
              flex: isMobile ? 1 : 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
              appearance: 'none',
              WebkitAppearance: 'none',
              cursor: 'pointer',
            }}
            disabled={loadingShops}
          >
            <option value="all">Todas as lojas</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.name}
              </option>
            ))}
          </select>

          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            color: '#b91c1c',
            padding: '12px 16px',
            borderRadius: '10px',
            border: '1px solid rgba(185, 28, 28, 0.2)',
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: isMobile ? '10px' : '16px' }}>
        {loadingMetrics ? (
          <>
            <Skeleton height={isMobile ? 80 : 110} />
            <Skeleton height={isMobile ? 80 : 110} />
            <Skeleton height={isMobile ? 80 : 110} />
            <Skeleton height={isMobile ? 80 : 110} />
            <Skeleton height={isMobile ? 80 : 110} />
          </>
        ) : (
          <>
            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: isMobile ? '12px' : '16px', padding: isMobile ? '12px' : '20px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'flex-start', gap: isMobile ? '8px' : '12px' }}>
              <div style={{ ...iconBoxStyle('#06b6d4'), width: isMobile ? '36px' : '48px', height: isMobile ? '36px' : '48px', borderRadius: isMobile ? '10px' : '12px' }}>
                <Mail size={isMobile ? 18 : 24} style={{ color: '#06b6d4' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? '11px' : '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px' }}>Recebidas</div>
                <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {renderValue(metrics.conversationsReceived)}
                </div>
                {!isMobile && <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>clientes que entraram em contato</div>}
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: isMobile ? '12px' : '16px', padding: isMobile ? '12px' : '20px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'flex-start', gap: isMobile ? '8px' : '12px' }}>
              <div style={{ ...iconBoxStyle('#10b981'), width: isMobile ? '36px' : '48px', height: isMobile ? '36px' : '48px', borderRadius: isMobile ? '10px' : '12px' }}>
                <CheckCircle size={isMobile ? 18 : 24} style={{ color: '#10b981' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? '11px' : '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px' }}>Atendidas</div>
                <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {renderValue(metrics.conversationsReplied)}
                </div>
                {!isMobile && <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>clientes que receberam resposta</div>}
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: isMobile ? '12px' : '16px', padding: isMobile ? '12px' : '20px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'flex-start', gap: isMobile ? '8px' : '12px' }}>
              <div style={{ ...iconBoxStyle('#8b5cf6'), width: isMobile ? '36px' : '48px', height: isMobile ? '36px' : '48px', borderRadius: isMobile ? '10px' : '12px' }}>
                <TrendingUp size={isMobile ? 18 : 24} style={{ color: '#8b5cf6' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? '11px' : '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px' }}>Automação</div>
                <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {renderValue(metrics.automationRate, 'percent')}
                </div>
                {!isMobile && <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>atendidas / recebidas</div>}
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: isMobile ? '12px' : '16px', padding: isMobile ? '12px' : '20px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'flex-start', gap: isMobile ? '8px' : '12px' }}>
              <div style={{ ...iconBoxStyle('#22c55e'), width: isMobile ? '36px' : '48px', height: isMobile ? '36px' : '48px', borderRadius: isMobile ? '10px' : '12px' }}>
                <CheckCircle size={isMobile ? 18 : 24} style={{ color: '#22c55e' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? '11px' : '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px' }}>Sucesso</div>
                <div style={{
                  fontSize: isMobile ? '20px' : '28px',
                  fontWeight: 700,
                  color: metrics.successRate >= 90
                    ? '#16a34a'
                    : metrics.successRate >= 70
                      ? '#d97706'
                      : '#dc2626'
                }}>
                  {renderValue(metrics.successRate, 'percent')}
                </div>
                {!isMobile && <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>resolvidos sem humano</div>}
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: isMobile ? '12px' : '16px', padding: isMobile ? '12px' : '20px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'flex-start', gap: isMobile ? '8px' : '12px' }}>
              <div style={{ ...iconBoxStyle('#f59e0b'), width: isMobile ? '36px' : '48px', height: isMobile ? '36px' : '48px', borderRadius: isMobile ? '10px' : '12px' }}>
                <Headphones size={isMobile ? 18 : 24} style={{ color: '#f59e0b' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? '11px' : '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px' }}>Humano</div>
                <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {renderValue(metrics.pendingHuman)}
                </div>
                {!isMobile && <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>aguardando atendimento</div>}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Gráfico */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: isMobile ? '12px' : '16px', padding: isMobile ? '16px' : '20px', border: '1px solid var(--border-color)' }}>
        <div>
          <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Volume de Emails</div>
          <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Recebidos x Respondidos</div>
        </div>
        <div style={{ marginTop: isMobile ? '12px' : '20px', minHeight: isMobile ? '200px' : '320px' }}>
          {loadingChart ? (
            <Skeleton height={isMobile ? 200 : 320} />
          ) : volumeData.length === 0 ? (
            <div style={{ padding: isMobile ? '20px' : '32px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600, fontSize: isMobile ? '13px' : '14px' }}>
              Nenhum dado encontrado para o período selecionado
            </div>
          ) : (
            <Suspense fallback={<Skeleton height={isMobile ? 200 : 320} />}>
              <div style={{ height: isMobile ? '200px' : '320px' }}>
                <VolumeChart data={volumeData} />
              </div>
            </Suspense>
          )}
        </div>
      </div>

      {/* Bottom */}
      <div className="replyna-dashboard-bottom">
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: isMobile ? '12px' : '16px', padding: isMobile ? '14px' : '20px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', marginBottom: isMobile ? '12px' : '16px', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Inbox
              </div>
              {/* Toggle Spam / Conversas */}
              <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => setCategoryFilter(categoryFilter === 'spam' ? 'all' : categoryFilter)}
                  style={{
                    padding: isMobile ? '5px 10px' : '6px 12px',
                    fontSize: isMobile ? '12px' : '13px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: categoryFilter !== 'spam' ? 'var(--accent)' : 'var(--bg-card)',
                    color: categoryFilter !== 'spam' ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Conversas
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('spam')}
                  style={{
                    padding: isMobile ? '5px 10px' : '6px 12px',
                    fontSize: isMobile ? '12px' : '13px',
                    fontWeight: 600,
                    border: 'none',
                    borderLeft: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    backgroundColor: categoryFilter === 'spam' ? 'rgba(220, 38, 38, 0.15)' : 'var(--bg-card)',
                    color: categoryFilter === 'spam' ? '#b91c1c' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Spam ({conversations.filter(c => c.category === 'spam' && c.category).length})
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px', flexWrap: 'wrap' }}>
              {/* Filtro por categoria (só aparece quando não está em Spam) */}
              {categoryFilter !== 'spam' && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: isMobile ? '8px 24px 8px 10px' : '10px 28px 10px 14px',
                    fontSize: isMobile ? '12px' : '14px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    flex: isMobile ? 1 : 'none',
                    minWidth: isMobile ? '0' : 'auto',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 10px center',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="all">Todas categorias</option>
                  <option value="duvidas_gerais">Dúvidas gerais</option>
                  <option value="rastreio">Rastreio</option>
                  <option value="troca_devolucao_reembolso">Troca/Devolução</option>
                  <option value="edicao_pedido">Edição de pedido</option>
                  <option value="suporte_humano">Suporte humano</option>
                </select>
              )}
              {!loadingConversations && conversations.length > 0 && !isMobile && (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {categoryFilter === 'spam'
                    ? `${conversations.filter(c => c.category === 'spam').length} spam`
                    : categoryFilter === 'all'
                      ? `${conversations.filter(c => c.category !== 'spam').length} emails`
                      : `${conversations.filter(c => c.category === categoryFilter).length} de ${conversations.filter(c => c.category !== 'spam').length}`}
                </div>
              )}
            </div>
          </div>
          {loadingConversations ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              <Skeleton height={36} />
              <Skeleton height={36} />
              <Skeleton height={36} />
            </div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Nenhum dado encontrado para o período selecionado
            </div>
          ) : (
            <div className="replyna-scrollbar" style={{ maxHeight: isMobile ? '300px' : '400px', overflowY: 'auto', overflowX: 'auto', scrollBehavior: 'smooth' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? '280px' : '520px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ textAlign: 'left', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: isMobile ? '11px' : '12px' }}>
                    {!isMobile && <th style={{ padding: '10px 12px', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>Loja</th>}
                    <th style={{ padding: isMobile ? '8px 10px' : '10px 12px', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>Cliente</th>
                    {!isMobile && <th style={{ padding: '10px 12px', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>Assunto</th>}
                    <th style={{ padding: isMobile ? '8px 10px' : '10px 12px', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>Categoria</th>
                    <th style={{ padding: isMobile ? '8px 10px' : '10px 12px', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {conversations
                    .filter((c) => {
                      // Filtrar por spam
                      if (categoryFilter === 'spam') return c.category === 'spam'
                      // Mostrar todos exceto spam (incluindo sem categoria = processando)
                      if (categoryFilter === 'all') return c.category !== 'spam'
                      // Filtro específico de categoria
                      return c.category === categoryFilter
                    })
                    .map((conversation) => (
                    <tr
                      key={conversation.id}
                      onClick={() => handleConversationClick(conversation.id)}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {!isMobile && (
                        <td style={{ padding: '12px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              maxWidth: '120px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: 'var(--text-secondary)',
                              fontWeight: 600,
                            }}
                          >
                            {conversation.shop_name || 'Loja'}
                          </span>
                        </td>
                      )}
                      <td style={{ padding: isMobile ? '10px' : '12px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            maxWidth: isMobile ? '100px' : '140px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'var(--text-primary)',
                            fontWeight: 600,
                            fontSize: isMobile ? '12px' : '14px',
                          }}
                        >
                          {conversation.customer_name || conversation.customer_email}
                        </span>
                      </td>
                      {!isMobile && (
                        <td style={{ padding: '12px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              maxWidth: '200px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {conversation.subject || 'Sem assunto'}
                          </span>
                        </td>
                      )}
                      <td style={{ padding: isMobile ? '10px' : '12px' }}>
                        <span style={{ ...getCategoryBadgeStyle(conversation.category), fontSize: isMobile ? '10px' : '12px', padding: isMobile ? '3px 6px' : '4px 8px' }}>{getCategoryLabel(conversation.category)}</span>
                      </td>
                      <td style={{ padding: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', fontSize: isMobile ? '11px' : '13px', whiteSpace: 'nowrap' }}>
                        {formatDateTime(new Date(conversation.created_at))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: isMobile ? '12px' : '16px', padding: isMobile ? '14px' : '20px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: isMobile ? '12px' : '16px' }}>
            Consumo do Plano
          </div>

          {loadingProfile ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              <Skeleton height={48} />
              <Skeleton height={48} />
              <Skeleton height={48} />
            </div>
          ) : (
            <div style={{ display: 'grid', gap: isMobile ? '12px' : '16px' }}>
              <div>
                <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Plano atual</div>
                <div style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {profile?.plan || 'Starter'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Emails respondidos</div>
                <div style={{ fontSize: isMobile ? '14px' : '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {isUnlimited ? (
                    <>
                      {formatNumber(emailsUsed)} de <span style={{ color: '#22c55e' }}>Ilimitado</span>
                    </>
                  ) : (
                    <>
                      {formatNumber(emailsUsed)} de {formatNumber(totalCreditsAvailable)}
                      {extraEmailsPurchased > 0 && !isMobile && (
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, marginLeft: '6px' }}>
                          ({formatNumber(emailsLimit ?? 0)} + {formatNumber(extraEmailsPurchased)} extras)
                        </span>
                      )}
                    </>
                  )}
                </div>
                {!isUnlimited && (
                  <>
                    <div style={{ marginTop: '8px', backgroundColor: 'var(--border-color)', borderRadius: '999px', height: '8px' }}>
                      <div
                        style={{
                          width: `${usagePercent}%`,
                          backgroundColor: 'var(--accent)',
                          height: '8px',
                          borderRadius: '999px',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', fontWeight: 600 }}>
                      {formatPercent(usagePercent)} utilizado
                    </div>
                  </>
                )}
              </div>
              <div>
                <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Renovação do plano</div>
                <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {renewalDate ? formatDate(renewalDate) : 'Sem data'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Lojas ativas</div>
                <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {isShopsUnlimited ? (
                    <>
                      {formatNumber(shops.length)} de <span style={{ color: '#22c55e' }}>Ilimitado</span>
                    </>
                  ) : (
                    <>{formatNumber(shops.length)} de {formatNumber(shopsLimit ?? 0)}</>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Categorias por Conversa */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: isMobile ? '12px' : '16px', padding: isMobile ? '14px' : '20px', border: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: isMobile ? '12px' : '16px' }}>
          Conversas por Categoria
        </div>
        {loadingConversations ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            <Skeleton height={36} />
            <Skeleton height={36} />
            <Skeleton height={36} />
          </div>
        ) : totalCategorized === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '13px' : '14px', textAlign: 'center', padding: isMobile ? '16px' : '24px' }}>
            Nenhuma conversa no período selecionado
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '10px' : '12px' }}>
            {Object.entries(categoryStats)
              .sort(([, a], [, b]) => b - a)
              .map(([category, count]) => {
                const Icon = categoryIcons[category] || HelpCircle
                const color = CATEGORY_COLORS[category] || '#6b7280'
                const percentage = totalCategorized ? Math.round((count / totalCategorized) * 100) : 0
                return (
                  <div key={category} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '12px' }}>
                    <div
                      style={{
                        width: isMobile ? '28px' : '32px',
                        height: isMobile ? '28px' : '32px',
                        borderRadius: '8px',
                        backgroundColor: `${color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={isMobile ? 14 : 16} style={{ color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', gap: '8px' }}>
                        <span style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {CATEGORY_LABELS[category] || category}
                        </span>
                        <span style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', flexShrink: 0 }}>
                          {count} ({percentage}%)
                        </span>
                      </div>
                      <div
                        style={{
                          height: isMobile ? '5px' : '6px',
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
  )
}
