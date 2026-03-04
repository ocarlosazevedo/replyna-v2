import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ticket, Store, MessageSquare, Clock, CheckCircle, RefreshCw, XCircle } from 'lucide-react'
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
  ticket_status: string | null
  created_at: string
  shop_name?: string
}

const TICKET_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  pending:  { label: 'Pendente',   bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
  answered: { label: 'Respondido', bg: 'rgba(34,197,94,0.15)',   color: '#16a34a' },
  reopened: { label: 'Reaberto',   bg: 'rgba(249,115,22,0.15)',  color: '#f97316' },
  closed:   { label: 'Fechado',    bg: 'rgba(107,114,128,0.15)', color: '#6b7280' },
}

const FILTER_CARDS = [
  {
    key: 'pending',
    icon: Clock,
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.1)',
    title: 'Pendentes',
    description: 'Emails que ainda nao foram respondidos pela equipe. Precisam de atencao imediata.',
  },
  {
    key: 'answered',
    icon: CheckCircle,
    color: '#16a34a',
    bg: 'rgba(34,197,94,0.1)',
    title: 'Respondidos',
    description: 'Emails que ja receberam uma resposta manual. O cliente pode responder novamente.',
  },
  {
    key: 'reopened',
    icon: RefreshCw,
    color: '#f97316',
    bg: 'rgba(249,115,22,0.1)',
    title: 'Reabertos',
    description: 'Quando um cliente responde um email que ja foi respondido, o ticket reabre automaticamente.',
  },
  {
    key: 'close',
    icon: XCircle,
    color: '#6b7280',
    bg: 'rgba(107,114,128,0.1)',
    title: 'Encerrar ticket',
    description: 'Ao encerrar um ticket, ele desaparece da lista e o cliente entra em frozen por 7 dias (emails ignorados).',
  },
]

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
  const [selectedShopId, setSelectedShopId] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

  const shopIds = useMemo(() => shops.map((s) => s.id), [shops])

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
        .select('id, shop_id, customer_email, customer_name, subject, category, status, ticket_status, created_at')
        .eq('status', 'pending_human')
        .eq('archived', false)
        .in('shop_id', shopIds)
        .in('category', ['suporte_humano', 'edicao_pedido'])
        .order('created_at', { ascending: false })

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
          const ticketCategories = ['suporte_humano', 'edicao_pedido', 'troca_devolucao_reembolso']
          if (newConv.status === 'pending_human' && shopIds.includes(newConv.shop_id) && ticketCategories.includes(newConv.category || '')) {
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

          const ticketCats = ['suporte_humano', 'edicao_pedido', 'troca_devolucao_reembolso']
          if (updated.status === 'pending_human' && ticketCats.includes(updated.category || '')) {
            setTickets((prev) => {
              const exists = prev.find((t) => t.id === updated.id)
              if (exists) {
                return prev.map((t) => t.id === updated.id ? { ...updated, shop_name: shopNameMap[updated.shop_id] || 'Loja' } : t)
              }
              return [{ ...updated, shop_name: shopNameMap[updated.shop_id] || 'Loja' }, ...prev]
            })
          } else {
            setTickets((prev) => prev.filter((t) => t.id !== updated.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, shopIds, shopNameMap])

  const filteredTickets = useMemo(() => {
    let result = tickets
    if (selectedShopId !== 'all') {
      result = result.filter((t) => t.shop_id === selectedShopId)
    }
    if (selectedStatus !== 'all') {
      result = result.filter((t) => (t.ticket_status || 'pending') === selectedStatus)
    }
    return result
  }, [tickets, selectedShopId, selectedStatus])

  const statusCounts = useMemo(() => {
    const base = selectedShopId === 'all' ? tickets : tickets.filter((t) => t.shop_id === selectedShopId)
    return {
      all: base.length,
      pending: base.filter((t) => (t.ticket_status || 'pending') === 'pending').length,
      answered: base.filter((t) => (t.ticket_status || 'pending') === 'answered').length,
      reopened: base.filter((t) => (t.ticket_status || 'pending') === 'reopened').length,
    }
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Tickets
            </div>
            {!loading && (
              <span style={{
                backgroundColor: 'rgba(236, 72, 153, 0.15)',
                color: '#be185d',
                padding: '3px 10px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 700,
              }}>
                {statusCounts.pending}
              </span>
            )}
          </div>
          {!isMobile && (
            <div style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '14px' }}>
              Conversas que precisam de atendimento humano
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="replyna-select"
            style={{ minWidth: isMobile ? '120px' : '180px', flex: isMobile ? 1 : 'none' }}
          >
            <option value="all">Todos os status ({statusCounts.all})</option>
            <option value="pending">Pendentes ({statusCounts.pending})</option>
            <option value="answered">Respondidos ({statusCounts.answered})</option>
            <option value="reopened">Reabertos ({statusCounts.reopened})</option>
          </select>

          <select
            value={selectedShopId}
            onChange={(e) => setSelectedShopId(e.target.value)}
            className="replyna-select"
            style={{ minWidth: isMobile ? '120px' : '180px', flex: isMobile ? 1 : 'none' }}
            disabled={loadingShops}
          >
            <option value="all">Todas as lojas</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Info cards com scroll horizontal */}
      <div
        className="replyna-scrollbar"
        style={{
          display: 'flex',
          gap: isMobile ? '10px' : '14px',
          overflowX: 'auto',
          paddingBottom: '4px',
          scrollBehavior: 'smooth',
        }}
      >
        {FILTER_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.key}
              style={{
                minWidth: isMobile ? '200px' : '220px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '14px',
                padding: isMobile ? '14px' : '16px',
                border: '1px solid var(--border-color)',
                flex: '0 0 auto',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '9px',
                  backgroundColor: card.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={17} style={{ color: card.color }} />
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: card.color }}>
                  {card.title}
                </div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {card.description}
              </div>
            </div>
          )
        })}
      </div>

      {/* Card da tabela */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: isMobile ? '12px' : '16px',
        padding: isMobile ? '14px' : '20px',
        border: '1px solid var(--border-color)',
      }}>
        {/* Subheader com icone */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: isMobile ? '12px' : '16px',
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
              <MessageSquare size={isMobile ? 16 : 18} style={{ color: '#ec4899' }} />
            </div>
            <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Conversas pendentes
            </div>
          </div>
          {!loading && !isMobile && filteredTickets.length > 0 && (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {filteredTickets.length} {filteredTickets.length === 1 ? 'ticket' : 'tickets'}
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            <Skeleton height={36} />
            <Skeleton height={36} />
            <Skeleton height={36} />
            <Skeleton height={36} />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div style={{
            padding: isMobile ? '40px 16px' : '56px 24px',
            textAlign: 'center',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(236, 72, 153, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Ticket size={28} style={{ color: '#ec4899', opacity: 0.6 }} />
            </div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)', marginBottom: '6px' }}>
              {selectedStatus === 'pending'
                ? 'Nenhum ticket pendente'
                : selectedStatus === 'answered'
                  ? 'Nenhum ticket respondido'
                  : selectedStatus === 'reopened'
                    ? 'Nenhum ticket reaberto'
                    : 'Nenhum ticket encontrado'}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '380px', margin: '0 auto', lineHeight: '1.5' }}>
              {selectedStatus === 'all'
                ? 'Quando uma conversa precisar de atenção humana, ela aparecerá aqui automaticamente.'
                : selectedStatus === 'pending'
                  ? 'Não há tickets aguardando resposta no momento.'
                  : selectedStatus === 'reopened'
                    ? 'Não há tickets reabertos no momento.'
                    : 'Não há tickets respondidos no momento.'}
            </div>
          </div>
        ) : (
          <div className="replyna-scrollbar" style={{ maxHeight: isMobile ? '500px' : '600px', overflowY: 'auto', overflowX: 'auto', scrollBehavior: 'smooth' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? '280px' : '620px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ textAlign: 'left', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: isMobile ? '11px' : '12px' }}>
                  {!isMobile && <th style={{ padding: '10px 12px', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>Loja</th>}
                  <th style={{ padding: isMobile ? '8px 10px' : '10px 12px', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>Cliente</th>
                  {!isMobile && <th style={{ padding: '10px 12px', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>Assunto</th>}
                  <th style={{ padding: isMobile ? '8px 10px' : '10px 12px', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>Categoria</th>
                  <th style={{ padding: isMobile ? '8px 10px' : '10px 12px', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>Status</th>
                  <th style={{ padding: isMobile ? '8px 10px' : '10px 12px', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>Data</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => {
                  const statusInfo = TICKET_STATUS[ticket.ticket_status || 'pending'] || TICKET_STATUS.pending
                  return (
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
                              {ticket.shop_name || 'Loja'}
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
                          {ticket.customer_name || ticket.customer_email}
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
                            {ticket.subject || 'Sem assunto'}
                          </span>
                        </td>
                      )}
                      <td style={{ padding: isMobile ? '10px' : '12px' }}>
                        <span style={{ ...getCategoryBadgeStyle(ticket.category), fontSize: isMobile ? '10px' : '12px', padding: isMobile ? '3px 6px' : '4px 8px' }}>
                          {getCategoryLabel(ticket.category)}
                        </span>
                      </td>
                      <td style={{ padding: isMobile ? '10px' : '12px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: isMobile ? '3px 6px' : '4px 10px',
                          borderRadius: '999px',
                          fontSize: isMobile ? '10px' : '12px',
                          fontWeight: 600,
                          backgroundColor: statusInfo.bg,
                          color: statusInfo.color,
                        }}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td style={{ padding: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', fontSize: isMobile ? '11px' : '13px', whiteSpace: 'nowrap' }}>
                        {formatDateTime(new Date(ticket.created_at))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
