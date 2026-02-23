import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ticket, Store, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { useUserProfile } from '../hooks/useUserProfile'
import { supabase } from '../lib/supabase'
import ConversationModal from '../components/ConversationModal'
import { getCategoryBadgeStyle, getCategoryLabel } from '../constants/categories'

interface TicketRow {
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

const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(date)

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

export default function Tickets() {
  const { user } = useAuth()
  const { shops, loading: loadingShops } = useUserProfile()
  const isMobile = useIsMobile()

  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [privacyMode, setPrivacyMode] = useState(false)
  const [selectedShopId, setSelectedShopId] = useState<string>('all')

  const shopIds = useMemo(() => shops.map((s) => s.id), [shops])

  // Map shop_id -> shop name for display
  const shopNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    shops.forEach((s) => { map[s.id] = s.name })
    return map
  }, [shops])

  const loadTickets = useCallback(async () => {
    if (!user || shopIds.length === 0) {
      setTickets([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, shop_id, customer_email, customer_name, subject, category, status, created_at')
        .eq('status', 'pending_human')
        .in('shop_id', shopIds)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error

      const rows: TicketRow[] = (data || []).map((c) => ({
        ...c,
        shop_name: shopNameMap[c.shop_id] || 'Loja',
      }))

      setTickets(rows)
    } catch (err) {
      console.error('Erro ao carregar tickets:', err)
    } finally {
      setLoading(false)
    }
  }, [user, shopIds, shopNameMap])

  // Load tickets when shops are ready
  useEffect(() => {
    if (!loadingShops && shopIds.length > 0) {
      loadTickets()
    }
  }, [loadingShops, shopIds, loadTickets])

  // Real-time subscription
  useEffect(() => {
    if (!user || shopIds.length === 0) return

    const channel = supabase
      .channel('tickets-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        (payload) => {
          const newConv = payload.new as TicketRow
          if (newConv.status === 'pending_human' && shopIds.includes(newConv.shop_id)) {
            setTickets((prev) => [
              { ...newConv, shop_name: shopNameMap[newConv.shop_id] || 'Loja' },
              ...prev.filter((t) => t.id !== newConv.id),
            ])
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        (payload) => {
          const updated = payload.new as TicketRow
          if (!shopIds.includes(updated.shop_id)) return

          if (updated.status === 'pending_human') {
            // Add or update
            setTickets((prev) => {
              const exists = prev.find((t) => t.id === updated.id)
              if (exists) {
                return prev.map((t) => t.id === updated.id ? { ...updated, shop_name: shopNameMap[updated.shop_id] || 'Loja' } : t)
              }
              return [{ ...updated, shop_name: shopNameMap[updated.shop_id] || 'Loja' }, ...prev]
            })
          } else {
            // Remove from tickets if status changed away from pending_human
            setTickets((prev) => prev.filter((t) => t.id !== updated.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, shopIds, shopNameMap])

  // Filter by selected shop
  const filteredTickets = useMemo(() => {
    if (selectedShopId === 'all') return tickets
    return tickets.filter((t) => t.shop_id === selectedShopId)
  }, [tickets, selectedShopId])

  const handleConversationClick = useCallback((id: string) => {
    setSelectedConversationId(id)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px' }}>
      {/* Modal */}
      <ConversationModal
        conversationId={selectedConversationId}
        onClose={() => setSelectedConversationId(null)}
        onCategoryChange={(conversationId, newCategory) => {
          setTickets((prev) =>
            prev.map((t) => (t.id === conversationId ? { ...t, category: newCategory } : t))
          )
        }}
      />

      {/* Card principal */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: isMobile ? '12px' : '16px',
        padding: isMobile ? '14px' : '20px',
        border: '1px solid var(--border-color)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          marginBottom: isMobile ? '12px' : '16px',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '12px' : '0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: isMobile ? '32px' : '36px',
              height: isMobile ? '32px' : '36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(236, 72, 153, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ticket size={isMobile ? 16 : 18} style={{ color: '#ec4899' }} />
            </div>
            <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Tickets
            </div>
            {!loading && (
              <span style={{
                backgroundColor: 'rgba(236, 72, 153, 0.15)',
                color: '#be185d',
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 700,
              }}>
                {filteredTickets.length}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Filtro por loja */}
            <select
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
              className="replyna-select"
              style={{ flex: isMobile ? 1 : 'none', minWidth: isMobile ? '0' : 'auto' }}
            >
              <option value="all">Todas as lojas</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>

            {/* Toggle Privacidade */}
            <button
              type="button"
              onClick={() => setPrivacyMode(!privacyMode)}
              title={privacyMode ? 'Mostrar dados' : 'Ocultar dados para screenshot'}
              style={{
                padding: isMobile ? '5px 8px' : '6px 10px',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: privacyMode ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-card)',
                color: privacyMode ? '#8b5cf6' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
                fontSize: isMobile ? '12px' : '13px',
                fontWeight: 600,
              }}
            >
              {privacyMode ? <EyeOff size={isMobile ? 14 : 16} /> : <Eye size={isMobile ? 14 : 16} />}
              {!isMobile && (privacyMode ? 'Oculto' : 'Ocultar')}
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            <Skeleton height={36} />
            <Skeleton height={36} />
            <Skeleton height={36} />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div style={{
            padding: isMobile ? '32px 16px' : '48px 24px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}>
            <Ticket size={40} style={{ color: 'var(--border-color)', marginBottom: '12px' }} />
            <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>
              Nenhum ticket pendente
            </div>
            <div style={{ fontSize: '13px' }}>
              Conversas que precisam de atendimento humano aparecerão aqui.
            </div>
          </div>
        ) : (
          <div className="replyna-scrollbar" style={{ maxHeight: isMobile ? '500px' : '600px', overflowY: 'auto', overflowX: 'auto', scrollBehavior: 'smooth' }}>
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
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => handleConversationClick(ticket.id)}
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
                          <span
                            style={{
                              maxWidth: '120px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: 'var(--text-primary)',
                              fontWeight: 500,
                              fontSize: '13px',
                            }}
                          >
                            {privacyMode ? '••••••' : (ticket.shop_name || 'Loja')}
                          </span>
                        </div>
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
                        {privacyMode ? '••••••' : (ticket.customer_name || ticket.customer_email)}
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
                          {privacyMode ? '••••••' : (ticket.subject || 'Sem assunto')}
                        </span>
                      </td>
                    )}
                    <td style={{ padding: isMobile ? '10px' : '12px' }}>
                      <span style={{ ...getCategoryBadgeStyle(ticket.category), fontSize: isMobile ? '10px' : '12px', padding: isMobile ? '3px 6px' : '4px 8px' }}>
                        {getCategoryLabel(ticket.category)}
                      </span>
                    </td>
                    <td style={{ padding: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', fontSize: isMobile ? '11px' : '13px', whiteSpace: 'nowrap' }}>
                      {formatDateTime(new Date(ticket.created_at))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
