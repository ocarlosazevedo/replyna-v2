import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DateRange } from 'react-day-picker'
import { subDays } from 'date-fns'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import DateRangePicker from '../components/DateRangePicker'
import CreditsWarningBanner from '../components/CreditsWarningBanner'
import ConversationModal from '../components/ConversationModal'

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
}

interface ConversationRow {
  id: string
  shop_id: string
  customer_name: string | null
  subject: string | null
  category: string | null
  created_at: string
}

interface MetricSummary {
  totalConversations: number
  automationRate: number
  pendingHuman: number
  topCategoryName: string | null
  topCategoryPercent: number
}

interface MessageRow {
  created_at: string
  direction: string
  was_auto_replied: boolean | null
  conversations: { shop_id: string }[]
}

const formatNumber = (value: number) =>
  new Intl.NumberFormat('pt-BR').format(value)

const formatPercent = (value: number) =>
  `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`

const formatPercentWhole = (value: number) =>
  `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value)}%`

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)

const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

const getDefaultRange = (): DateRange => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return { from: subDays(today, 6), to: today }
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

const buildVolumeSeries = (messages: MessageRow[], granularity: 'day' | 'week' | 'month') => {
  const buckets = new Map<string, { date: Date; received: number; replied: number }>()
  messages.forEach((message) => {
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

const getCategoryBadge = (category: string | null) => {
  const base = { padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }
  switch (category) {
    case 'duvidas_gerais':
      return { ...base, backgroundColor: 'rgba(59, 130, 246, 0.16)', color: '#2563eb' }
    case 'institucional':
      return { ...base, backgroundColor: 'rgba(107, 114, 128, 0.16)', color: '#6b7280' }
    case 'reembolso':
      return { ...base, backgroundColor: 'rgba(245, 158, 11, 0.18)', color: '#b45309' }
    case 'suporte_humano':
      return { ...base, backgroundColor: 'rgba(239, 68, 68, 0.16)', color: '#dc2626' }
    default:
      return { ...base, backgroundColor: 'rgba(148, 163, 184, 0.16)', color: '#64748b' }
  }
}

const categoryLabelMap: Record<string, string> = {
  duvidas_gerais: 'Dúvidas gerais',
  rastreio: 'Rastreio',
  reembolso: 'Reembolso',
  institucional: 'Institucional',
  suporte_humano: 'Suporte humano',
  outros: 'Outros',
}

const formatCategoryLabel = (category: string | null) => {
  if (!category) return 'Outros'
  return categoryLabelMap[category] ?? 'Outros'
}

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
  const cacheRef = useRef(new Map<string, { timestamp: number; data: unknown }>())

  const [shops, setShops] = useState<ShopOption[]>([])
  const [selectedShopId, setSelectedShopId] = useState('all')
  const [range, setRange] = useState<DateRange>(getDefaultRange())

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [metrics, setMetrics] = useState<MetricSummary>({
    totalConversations: 0,
    automationRate: 0,
    pendingHuman: 0,
    topCategoryName: null,
    topCategoryPercent: 0,
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
    const storedRange = localStorage.getItem(`${storagePrefix}.range`)
    if (storedRange) {
      try {
        const parsed = JSON.parse(storedRange)
        const from = parsed?.from ? parseLocalDateString(parsed.from) : null
        const to = parsed?.to ? parseLocalDateString(parsed.to) : null
        if (from && to) {
          setRange({ from, to })
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
            .select('name, plan, emails_limit, emails_used, shops_limit, created_at')
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
    setLoadingChart(true)
    setLoadingConversations(true)

    const loadConversationMetrics = async () => {
      const baseQuery = () =>
        supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', dateStart.toISOString())
          .lte('created_at', dateEnd.toISOString())

      const totalQuery =
        selectedShopId === 'all'
          ? baseQuery().in('shop_id', effectiveShopIds)
          : baseQuery().eq('shop_id', selectedShopId)

      const pendingQuery =
        selectedShopId === 'all'
          ? baseQuery().in('shop_id', effectiveShopIds).eq('status', 'pending_human')
          : baseQuery().eq('shop_id', selectedShopId).eq('status', 'pending_human')

      const [{ count: totalConversations }, { count: pendingHuman }] = await Promise.all([
        cacheFetch(
          `conversations-total:${user.id}:${selectedShopId}:${effectiveShopIds.join(',')}:${dateStart.toISOString()}:${dateEnd.toISOString()}`,
          async () => {
          const { count, error } = await totalQuery
          if (error) throw error
          return { count }
        }
        ),
        cacheFetch(
          `conversations-pending:${user.id}:${selectedShopId}:${effectiveShopIds.join(',')}:${dateStart.toISOString()}:${dateEnd.toISOString()}`,
          async () => {
            const { count, error } = await pendingQuery
            if (error) throw error
            return { count }
          }
        ),
      ])

      return {
        totalConversations: totalConversations ?? 0,
        pendingHuman: pendingHuman ?? 0,
      }
    }

    const loadMessages = async () => {
      const query = supabase
        .from('messages')
        .select('created_at, direction, was_auto_replied, conversations!inner(shop_id)')
        .gte('created_at', dateStart.toISOString())
        .lte('created_at', dateEnd.toISOString())

      const { data, error } =
        selectedShopId === 'all'
          ? await query.in('conversations.shop_id', effectiveShopIds)
          : await query.eq('conversations.shop_id', selectedShopId)

      if (error) throw error
      return (data || []) as MessageRow[]
    }

    const loadTopCategory = async () => {
      const query = supabase
        .from('conversations')
        .select('category')
        .gte('created_at', dateStart.toISOString())
        .lte('created_at', dateEnd.toISOString())

      const { data, error } =
        selectedShopId === 'all'
          ? await query.in('shop_id', effectiveShopIds)
          : await query.eq('shop_id', selectedShopId)

      if (error) throw error

      const rows = (data || []) as Array<{ category: string | null }>
      if (rows.length === 0) {
        return { topCategoryName: null, topCategoryPercent: 0 }
      }

      const counts = rows.reduce<Record<string, number>>((acc, row) => {
        const key = row.category ?? 'outros'
        acc[key] = (acc[key] ?? 0) + 1
        return acc
      }, {})

      const [topCategory, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
      const topPercent = Math.round((topCount / rows.length) * 100)

      return { topCategoryName: topCategory, topCategoryPercent: topPercent }
    }

    const loadConversationsList = async () => {
      const query = supabase
        .from('conversations')
        .select('id, shop_id, customer_name, subject, category, created_at')
        .gte('created_at', dateStart.toISOString())
        .lte('created_at', dateEnd.toISOString())
        .order('created_at', { ascending: false })

      const { data, error } =
        selectedShopId === 'all'
          ? await query.in('shop_id', effectiveShopIds)
          : await query.eq('shop_id', selectedShopId)

      if (error) throw error
      return (data || []) as ConversationRow[]
    }

    const loadAll = async () => {
      try {
        const [conversationMetrics, messageRows, conversationRows, topCategoryData] = await Promise.all([
          loadConversationMetrics(),
          cacheFetch(
            `messages:${user.id}:${selectedShopId}:${effectiveShopIds.join(',')}:${dateStart.toISOString()}:${dateEnd.toISOString()}`,
            loadMessages
          ),
          cacheFetch(
            `conversations:${user.id}:${selectedShopId}:${effectiveShopIds.join(',')}:${dateStart.toISOString()}:${dateEnd.toISOString()}`,
            loadConversationsList
          ),
          cacheFetch(
            `top-category:${user.id}:${selectedShopId}:${effectiveShopIds.join(',')}:${dateStart.toISOString()}:${dateEnd.toISOString()}`,
            loadTopCategory
          ),
        ])

        if (!isActive) return

        const inboundMessages = messageRows.filter((message) => message.direction === 'inbound')
        const automatedInbound = inboundMessages.filter((message) => message.was_auto_replied).length
        const automationRate = inboundMessages.length
          ? (automatedInbound / inboundMessages.length) * 100
          : 0

        setMetrics({
          totalConversations: conversationMetrics.totalConversations,
          pendingHuman: conversationMetrics.pendingHuman,
          automationRate,
          topCategoryName: topCategoryData.topCategoryName,
          topCategoryPercent: topCategoryData.topCategoryPercent,
        })

        setVolumeData(buildVolumeSeries(messageRows, granularity))
        setConversations(conversationRows)
      } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err)
        setError('Não foi possível carregar os dados do dashboard.')
      } finally {
        if (!isActive) return
        setLoadingMetrics(false)
        setLoadingChart(false)
        setLoadingConversations(false)
      }
    }

    loadAll()

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
            // Adicionar nova conversa no topo da lista
            setConversations((prev) => {
              const updated = [newConversation, ...prev.filter((c) => c.id !== newConversation.id)]
              return updated
            })
            // Atualizar métricas
            setMetrics((prev) => ({
              ...prev,
              totalConversations: prev.totalConversations + 1,
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

  const renewalDate = useMemo(() => calculateRenewalDate(profile?.created_at ?? null), [profile?.created_at])
  const emailsLimit = profile?.emails_limit ?? 0
  const emailsUsed = profile?.emails_used ?? 0
  const usagePercent = emailsLimit ? Math.min((emailsUsed / emailsLimit) * 100, 100) : 0

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Modal de conversa */}
      <ConversationModal
        conversationId={selectedConversationId}
        onClose={() => setSelectedConversationId(null)}
      />

      {/* Banner de créditos */}
      {profile && profile.emails_limit && profile.emails_used !== null && (
        <CreditsWarningBanner
          emailsUsed={profile.emails_used ?? 0}
          emailsLimit={profile.emails_limit}
          plan={profile.plan ?? 'Starter'}
        />
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {loadingProfile ? <Skeleton width={180} height={24} /> : `Olá, ${shopName}`}
          </div>
          <div style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '14px' }}>
            Acompanhe o desempenho do seu atendimento automatizado
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={selectedShopId}
            onChange={handleShopChange}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '10px 24px 10px 14px',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              minWidth: '180px',
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {loadingMetrics ? (
          <>
            <Skeleton height={110} />
            <Skeleton height={110} />
            <Skeleton height={110} />
            <Skeleton height={110} />
          </>
        ) : (
          <>
            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Total de Conversas</div>
              <div style={{ marginTop: '12px', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {renderValue(metrics.totalConversations)}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>no período selecionado</div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Taxa de Automação</div>
              <div style={{ marginTop: '12px', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {renderValue(metrics.automationRate, 'percent')}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>emails respondidos automaticamente</div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Categoria mais frequente</div>
              <div style={{ marginTop: '12px', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {metrics.topCategoryName ? formatCategoryLabel(metrics.topCategoryName) : '--'}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
                {metrics.topCategoryName
                  ? `${formatPercentWhole(metrics.topCategoryPercent)} das conversas`
                  : 'Sem dados no período'}
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Aguardando Humano</div>
              <div style={{ marginTop: '12px', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {renderValue(metrics.pendingHuman)}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>conversas pendentes de atendimento</div>
            </div>
          </>
        )}
      </div>

      {/* Gráfico */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Volume de Emails</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Recebidos x Respondidos</div>
        </div>
        <div style={{ marginTop: '20px', minHeight: '320px' }}>
          {loadingChart ? (
            <Skeleton height={320} />
          ) : volumeData.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Nenhum dado encontrado para o período selecionado
            </div>
          ) : (
            <Suspense fallback={<Skeleton height={320} />}>
              <div style={{ height: '320px' }}>
                <VolumeChart data={volumeData} />
              </div>
            </Suspense>
          )}
        </div>
      </div>

      {/* Bottom */}
      <div className="replyna-dashboard-bottom">
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Conversas do Período
            </div>
            {!loadingConversations && conversations.length > 0 && (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {conversations.length} {conversations.length === 1 ? 'conversa' : 'conversas'}
              </div>
            )}
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
            <div className="replyna-scrollbar" style={{ maxHeight: '400px', overflowY: 'auto', overflowX: 'auto', scrollBehavior: 'smooth' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ textAlign: 'left', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>Cliente</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>Assunto</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>Categoria</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {conversations.map((conversation) => (
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
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            maxWidth: '160px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'var(--text-primary)',
                            fontWeight: 600,
                          }}
                        >
                          {conversation.customer_name || 'Sem nome'}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            maxWidth: '240px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {conversation.subject || 'Sem assunto'}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={getCategoryBadge(conversation.category)}>{conversation.category || 'outros'}</span>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        {formatDateTime(new Date(conversation.created_at))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
            Consumo do Plano
          </div>

          {loadingProfile ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              <Skeleton height={48} />
              <Skeleton height={48} />
              <Skeleton height={48} />
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Plano atual</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px' }}>
                  {profile?.plan || 'Starter'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Emails respondidos</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px' }}>
                  {formatNumber(emailsUsed)} de {formatNumber(emailsLimit)}
                </div>
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
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Renovação do plano</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px' }}>
                  {renewalDate ? formatDate(renewalDate) : 'Sem data'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Lojas ativas</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px' }}>
                  {formatNumber(shops.length)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
