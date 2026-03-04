import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { FileText, Store, ClipboardList, Link2, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { useUserProfile } from '../hooks/useUserProfile'
import { supabase } from '../lib/supabase'
import FormDetailModal from '../components/FormDetailModal'

const FORMS_ALLOWED_USERS = new Set([
  '115571d2-78af-4213-a01b-8a5e3ccf1714', // Carlos Azevedo
])

interface FormRow {
  id: string
  shop_id: string
  customer_email: string
  customer_name: string | null
  subject: string | null
  category: string | null
  status: string | null
  ticket_status: string | null
  shopify_order_id: string | null
  archived: boolean
  created_at: string
  shop_name?: string
}

const FORM_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  pending:  { label: 'Pendente',   bg: 'rgba(245,158,11,0.15)', color: '#d97706' },
  answered: { label: 'Respondido', bg: 'rgba(34,197,94,0.15)',  color: '#16a34a' },
  closed:   { label: 'Fechado',    bg: 'rgba(107,114,128,0.15)',color: '#6b7280' },
  approved: { label: 'Aprovado',   bg: 'rgba(34,197,94,0.15)',  color: '#16a34a' },
  rejected: { label: 'Rejeitado',  bg: 'rgba(239,68,68,0.15)',  color: '#ef4444' },
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

export default function Formularios() {
  const { user } = useAuth()
  const { shops, loading: loadingShops } = useUserProfile()
  const isMobile = useIsMobile()
  const [forms, setForms] = useState<FormRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [selectedShopId, setSelectedShopId] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [showLinks, setShowLinks] = useState(false)
  const [copiedShopId, setCopiedShopId] = useState<string | null>(null)

  const shopIds = useMemo(() => shops.map((s) => s.id), [shops])

  const shopNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    shops.forEach((s) => { map[s.id] = s.name })
    return map
  }, [shops])

  // Ref para acessar shopNameMap atualizado nos callbacks de real-time
  // sem recriar a subscription toda vez que o mapa muda
  const shopNameMapRef = useRef(shopNameMap)
  useEffect(() => { shopNameMapRef.current = shopNameMap }, [shopNameMap])

  const loadForms = useCallback(async () => {
    if (!user || shopIds.length === 0) {
      setForms([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, shop_id, customer_email, customer_name, subject, category, status, ticket_status, shopify_order_id, archived, created_at')
        .eq('archived', false)
        .in('shop_id', shopIds)
        .eq('category', 'troca_devolucao_reembolso')
        .order('created_at', { ascending: false })

      if (error) throw error

      const rows: FormRow[] = (data || []).map((c) => ({
        ...c,
        shop_name: shopNameMap[c.shop_id] || 'Loja',
      }))

      setForms(rows)
    } catch (err) {
      console.error('Erro ao carregar formulários:', err)
    } finally {
      setLoading(false)
    }
  }, [user, shopIds, shopNameMap])

  useEffect(() => {
    if (!loadingShops && shopIds.length > 0) {
      loadForms()
    }
  }, [loadingShops, shopIds, loadForms])

  // Real-time subscription
  useEffect(() => {
    if (!user || shopIds.length === 0) return

    const channel = supabase
      .channel('forms-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        (payload) => {
          const newConv = payload.new as FormRow
          if (newConv.category === 'troca_devolucao_reembolso' && shopIds.includes(newConv.shop_id)) {
            setForms((prev) => [
              { ...newConv, shop_name: shopNameMapRef.current[newConv.shop_id] || 'Loja' },
              ...prev.filter((f) => f.id !== newConv.id),
            ])
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        (payload) => {
          const updated = payload.new as FormRow
          if (!shopIds.includes(updated.shop_id)) return

          if (updated.category === 'troca_devolucao_reembolso' && !updated.archived) {
            setForms((prev) => {
              const exists = prev.find((f) => f.id === updated.id)
              if (exists) {
                return prev.map((f) => f.id === updated.id ? { ...updated, shop_name: shopNameMapRef.current[updated.shop_id] || 'Loja' } : f)
              }
              return [{ ...updated, shop_name: shopNameMapRef.current[updated.shop_id] || 'Loja' }, ...prev]
            })
          } else {
            setForms((prev) => prev.filter((f) => f.id !== updated.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, shopIds])

  const getFormStatus = (row: FormRow): string => {
    return row.ticket_status || 'pending'
  }

  const filteredForms = useMemo(() => {
    let result = forms
    if (selectedShopId !== 'all') {
      result = result.filter((f) => f.shop_id === selectedShopId)
    }
    if (selectedStatus !== 'all') {
      result = result.filter((f) => getFormStatus(f) === selectedStatus)
    }
    return result
  }, [forms, selectedShopId, selectedStatus])

  const statusCounts = useMemo(() => {
    const base = selectedShopId === 'all' ? forms : forms.filter((f) => f.shop_id === selectedShopId)
    return {
      all: base.length,
      pending: base.filter((f) => getFormStatus(f) === 'pending').length,
      answered: base.filter((f) => getFormStatus(f) === 'answered').length,
      closed: base.filter((f) => getFormStatus(f) === 'closed').length,
      approved: base.filter((f) => getFormStatus(f) === 'approved').length,
      rejected: base.filter((f) => getFormStatus(f) === 'rejected').length,
    }
  }, [forms, selectedShopId])

  const handleFormClick = useCallback((id: string) => {
    setSelectedConversationId(id)
  }, [])

  const handleCopyLink = useCallback((shopId: string) => {
    const baseUrl = window.location.origin
    const link = `${baseUrl}/return-request?shop=${shopId}`
    navigator.clipboard.writeText(link).then(() => {
      setCopiedShopId(shopId)
      setTimeout(() => setCopiedShopId(null), 2000)
    })
  }, [])

  if (user && !FORMS_ALLOWED_USERS.has(user.id)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px' }}>
      {/* Modal */}
      <FormDetailModal
        conversationId={selectedConversationId}
        onClose={() => setSelectedConversationId(null)}
        onStatusChange={(conversationId, newStatus) => {
          setForms((prev) =>
            prev.map((f) => (f.id === conversationId ? { ...f, ticket_status: newStatus } : f))
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
              Formulários
            </div>
            {!loading && (
              <span style={{
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#d97706',
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
              Formulários de devolução e reembolso enviados pelos clientes
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
            <option value="approved">Aprovados ({statusCounts.approved})</option>
            <option value="rejected">Rejeitados ({statusCounts.rejected})</option>
            <option value="answered">Respondidos ({statusCounts.answered})</option>
            <option value="closed">Fechados ({statusCounts.closed})</option>
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

      {/* Info box */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: isMobile ? '12px' : '16px',
        padding: isMobile ? '14px' : '18px 20px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        gap: isMobile ? '12px' : '16px',
        flexDirection: isMobile ? 'column' : 'row',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <FileText size={20} style={{ color: '#f59e0b' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
            O que são formulários?
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Formulários são solicitações de troca, devolução ou reembolso enviadas pelos clientes da sua loja. Clique em um formulário para visualizar os detalhes e responder.
          </div>
        </div>
      </div>

      {/* Links dos formulários */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: isMobile ? '12px' : '16px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}>
        <button
          onClick={() => setShowLinks(!showLinks)}
          style={{
            width: '100%',
            padding: isMobile ? '14px' : '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-primary)',
          }}
        >
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Link2 size={18} style={{ color: '#6366f1' }} />
          </div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>
              Links dos formulários
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Copie e envie o link para o cliente preencher o formulário de devolução
            </div>
          </div>
          {showLinks ? <ChevronUp size={18} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-secondary)' }} />}
        </button>

        {showLinks && (
          <div style={{
            borderTop: '1px solid var(--border-color)',
            padding: isMobile ? '12px' : '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            maxHeight: '320px',
            overflowY: 'auto',
          }}>
            {shops.map((shop) => {
              const isCopied = copiedShopId === shop.id
              return (
                <div
                  key={shop.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: isMobile ? '10px 12px' : '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: isCopied ? 'rgba(34, 197, 94, 0.06)' : 'transparent',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <Store size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {shop.name}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {shop.name.toLowerCase().replace(/\s+/g, '')}.com/formulario-devolucao
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopyLink(shop.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: isCopied ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border-color)',
                      backgroundColor: isCopied ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-primary)',
                      color: isCopied ? '#16a34a' : 'var(--text-secondary)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      flexShrink: 0,
                    }}
                  >
                    {isCopied ? <Check size={14} /> : <Copy size={14} />}
                    {isCopied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Table card */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: isMobile ? '12px' : '16px',
        padding: isMobile ? '14px' : '20px',
        border: '1px solid var(--border-color)',
      }}>
        {/* Subheader */}
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
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <ClipboardList size={isMobile ? 16 : 18} style={{ color: '#f59e0b' }} />
            </div>
            <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Formulários de devolução
            </div>
          </div>
          {!loading && !isMobile && filteredForms.length > 0 && (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {filteredForms.length} {filteredForms.length === 1 ? 'formulário' : 'formulários'}
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
        ) : filteredForms.length === 0 ? (
          <div style={{
            padding: isMobile ? '40px 16px' : '56px 24px',
            textAlign: 'center',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <FileText size={28} style={{ color: '#f59e0b', opacity: 0.6 }} />
            </div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)', marginBottom: '6px' }}>
              {selectedStatus === 'pending'
                ? 'Nenhum formulário pendente'
                : selectedStatus === 'approved'
                  ? 'Nenhum formulário aprovado'
                  : selectedStatus === 'rejected'
                    ? 'Nenhum formulário rejeitado'
                    : selectedStatus === 'answered'
                      ? 'Nenhum formulário respondido'
                      : selectedStatus === 'closed'
                        ? 'Nenhum formulário fechado'
                        : 'Nenhum formulário encontrado'}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '380px', margin: '0 auto', lineHeight: '1.5' }}>
              {selectedStatus === 'all'
                ? 'Quando um cliente enviar um formulário de devolução, ele aparecerá aqui automaticamente.'
                : selectedStatus === 'pending'
                  ? 'Não há formulários aguardando resposta no momento.'
                  : selectedStatus === 'answered'
                    ? 'Não há formulários respondidos no momento.'
                    : 'Não há formulários fechados no momento.'}
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
                  <th style={{ padding: isMobile ? '8px 10px' : '10px 12px', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>Status</th>
                  <th style={{ padding: isMobile ? '8px 10px' : '10px 12px', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>Data</th>
                </tr>
              </thead>
              <tbody>
                {filteredForms.map((form) => {
                  const status = getFormStatus(form)
                  const statusInfo = FORM_STATUS[status] || FORM_STATUS.pending
                  return (
                    <tr
                      key={form.id}
                      onClick={() => handleFormClick(form.id)}
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
                              {form.shop_name || 'Loja'}
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
                          {form.customer_name || form.customer_email}
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
                            {form.subject || 'Solicitação de devolução'}
                          </span>
                        </td>
                      )}
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
                        {formatDateTime(new Date(form.created_at))}
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
