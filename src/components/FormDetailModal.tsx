import { useState, useEffect, useCallback, useRef } from 'react'
import {
  X, User, Package, AlertCircle, HelpCircle, Camera, MapPin,
  RefreshCw, MessageSquare, PenTool, ExternalLink, Check, XCircle,
  Clock, ChevronLeft, ChevronRight, Send, Mail, Paperclip, FileText, Trash2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useIsMobile } from '../hooks/useIsMobile'
import {
  RETURN_REASONS, WHEN_NOTICED_OPTIONS, TRIED_RESOLVE_OPTIONS,
  PRODUCT_USED_OPTIONS, RESOLUTION_OPTIONS, UPLOAD_LABELS,
} from '../pages/return-request/constants'

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormDetailModalProps {
  conversationId: string | null
  onClose: () => void
  onStatusChange?: (conversationId: string, newStatus: string) => void
}

interface FormData {
  full_name?: string
  document?: string
  phone?: string
  order_number?: string
  order_date?: string
  order_total?: string
  order_currency?: string
  receive_date?: string
  line_items?: Array<{ title: string; quantity: number; price: string }>
  reason?: string
  description?: string
  when_noticed?: string
  tried_resolve?: string
  resolution_attempts?: string
  product_used?: string
  photos?: Record<string, string | null>
  address?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    zip?: string
    country?: string
  }
  resolution_type?: string
  additional_comments?: string
  signature?: string
  time_spent_seconds?: number
  submitted_at?: string
}

interface ConversationWithForm {
  id: string
  shop_id: string
  customer_email: string
  customer_name: string | null
  subject: string | null
  ticket_status: string | null
  shopify_order_id: string | null
  created_at: string
  form_data: FormData | null
  shops: { name: string; shopify_domain: string } | null
}

interface MessageAttachment {
  filename: string
  content_type: string
  url: string
}

interface Message {
  id: string
  direction: 'inbound' | 'outbound'
  from_email: string | null
  to_email: string | null
  body_text: string | null
  status: string | null
  was_auto_replied: boolean | null
  created_at: string
  has_attachments?: boolean
  attachment_count?: number
  attachments_metadata?: MessageAttachment[] | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  pending:  { label: 'Pendente',   bg: 'rgba(245,158,11,0.15)', color: '#d97706' },
  answered: { label: 'Respondido', bg: 'rgba(34,197,94,0.15)',  color: '#16a34a' },
  closed:   { label: 'Fechado',    bg: 'rgba(107,114,128,0.15)',color: '#6b7280' },
  approved: { label: 'Aprovado',   bg: 'rgba(34,197,94,0.15)',  color: '#16a34a' },
  rejected: { label: 'Rejeitado',  bg: 'rgba(239,68,68,0.15)',  color: '#ef4444' },
}

function getLabel(options: Array<{ value: string; label: string }>, value: string | undefined): string {
  if (!value) return '-'
  return options.find(o => o.value === value)?.label || value
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '-'
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
    }).format(new Date(iso))
  } catch { return iso }
}

function formatDateShort(iso: string | undefined): string {
  if (!iso) return '-'
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const [y, m, d] = iso.split('-')
      return `${d}/${m}/${y}`
    }
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(iso))
  } catch { return iso }
}

function formatCurrency(value: string | undefined, currency: string | undefined): string {
  if (!value) return '-'
  const num = parseFloat(value)
  if (isNaN(num)) return value
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(num)
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-primary)',
      borderRadius: '12px',
      border: '1px solid var(--border-color)',
      padding: '16px 20px',
      marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        {icon}
        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', fontSize: '14px', flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--text-secondary)', minWidth: '140px', fontWeight: 500 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', flex: 1, wordBreak: 'break-word', overflowWrap: 'break-word' }}>{value || '-'}</span>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function FormDetailModal({ conversationId, onClose, onStatusChange }: FormDetailModalProps) {
  const isMobile = useIsMobile()
  const [conversation, setConversation] = useState<ConversationWithForm | null>(null)
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState<'approved' | 'rejected' | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // Messages & reply state
  const [messages, setMessages] = useState<Message[]>([])
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  const [replySuccess, setReplySuccess] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Attachments state
  const [attachments, setAttachments] = useState<Array<{ file: File; uploading: boolean; url: string | null; error: boolean }>>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load conversation with form_data + messages
  const loadData = useCallback(async () => {
    if (!conversationId) return
    setLoading(true)
    try {
      // Load conversation
      const { data, error } = await supabase
        .from('conversations')
        .select('id, shop_id, customer_email, customer_name, subject, ticket_status, shopify_order_id, created_at, form_data, shops(name, shopify_domain)')
        .eq('id', conversationId)
        .maybeSingle()

      if (error) throw error
      if (!data) {
        console.warn('Formulário não encontrado:', conversationId)
        setLoading(false)
        return
      }
      const raw = data as Record<string, unknown>
      const shopsArr = raw.shops as Array<{ name: string; shopify_domain: string }> | null
      const normalized = { ...raw, shops: shopsArr?.[0] || null } as ConversationWithForm
      setConversation(normalized)

      // Load messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, direction, from_email, to_email, body_text, status, was_auto_replied, created_at, has_attachments, attachment_count, attachments_metadata')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      setMessages(msgs || [])
    } catch (err) {
      console.error('Erro ao carregar formulário:', err)
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => { loadData() }, [loadData])

  // Real-time subscription for new messages
  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`form-messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages(prev => {
            // Se já existe com esse ID, ignora
            if (prev.some(m => m.id === newMsg.id)) return prev
            // Substitui mensagem otimista (mesmo texto e direção) pela real do banco
            const hasOptimistic = prev.some(
              m => m.id.startsWith('optimistic-') &&
                   m.direction === newMsg.direction &&
                   m.body_text === newMsg.body_text
            )
            if (hasOptimistic) {
              return prev.map(m =>
                m.id.startsWith('optimistic-') &&
                m.direction === newMsg.direction &&
                m.body_text === newMsg.body_text
                  ? newMsg
                  : m
              )
            }
            return [...prev, newMsg]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ESC key handler
  useEffect(() => {
    if (!conversationId) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxPhoto) setLightboxPhoto(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [conversationId, onClose, lightboxPhoto])

  // Update status (approve/reject)
  const updateStatus = useCallback(async (newStatus: 'approved' | 'rejected') => {
    if (!conversationId || updating) return
    setUpdating(newStatus)
    setUpdateError(null)
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ ticket_status: newStatus })
        .eq('id', conversationId)

      if (error) throw error

      setConversation(prev => prev ? { ...prev, ticket_status: newStatus } : null)
      onStatusChange?.(conversationId, newStatus)
    } catch (err) {
      console.error('Erro ao atualizar status:', err)
      setUpdateError(`Erro ao ${newStatus === 'approved' ? 'aprovar' : 'rejeitar'}. Tente novamente.`)
    } finally {
      setUpdating(null)
    }
  }, [conversationId, updating, onStatusChange])

  // Handle file selection for attachments
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB per file
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
    // Same service key used in useReturnForm.ts for Storage uploads (temporary until Edge Function)
    const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbGRqYW14ZHNhcXF5dXJjbWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ3OTA1NywiZXhwIjoyMDg0MDU1MDU3fQ.M3ib-i9Y_YBopQWM5wEkVK2Oi2Ssf511vWgXeUlrfgs'

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        setReplyError(`Arquivo "${file.name}" excede o limite de 10MB.`)
        continue
      }

      // Use file reference to track this specific attachment across async updates
      const fileRef = file
      setAttachments(prev => [...prev, { file: fileRef, uploading: true, url: null, error: false }])

      try {
        const ext = file.name.split('.').pop() || 'bin'
        const safeName = `reply_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
        const path = `attachments/${safeName}`

        const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/return-forms/${path}`, {
          method: 'POST',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': file.type,
          },
          body: file,
        })

        if (uploadRes.ok) {
          const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/return-forms/${path}`
          setAttachments(prev => prev.map(a =>
            a.file === fileRef ? { ...a, uploading: false, url: publicUrl } : a
          ))
        } else {
          const errBody = await uploadRes.text().catch(() => '')
          console.error('Upload error:', uploadRes.status, errBody)
          setAttachments(prev => prev.map(a =>
            a.file === fileRef ? { ...a, uploading: false, error: true } : a
          ))
        }
      } catch (err) {
        console.error('Upload exception:', err)
        setAttachments(prev => prev.map(a =>
          a.file === fileRef ? { ...a, uploading: false, error: true } : a
        ))
      }
    }

    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const removeAttachment = useCallback((idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx))
  }, [])

  // Send email reply
  const handleSendReply = useCallback(async () => {
    if (!conversation || !replyText.trim() || sendingReply) return

    // Check if any attachments are still uploading
    if (attachments.some(a => a.uploading)) {
      setReplyError('Aguarde o upload dos anexos terminar.')
      return
    }

    setSendingReply(true)
    setReplyError(null)
    setReplySuccess(false)

    try {
      // Build attachments array for the Edge Function
      const uploadedAttachments = attachments
        .filter(a => a.url && !a.error)
        .map(a => ({
          filename: a.file.name,
          content_type: a.file.type || 'application/octet-stream',
          url: a.url!,
        }))

      // Use AbortController with 60s timeout (attachments can take time)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-reply`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversation_id: conversation.id,
            shop_id: conversation.shop_id,
            reply_text: replyText.trim(),
            attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
          }),
          signal: controller.signal,
        }
      )

      clearTimeout(timeoutId)
      const data = await response.json()

      if (data?.success) {
        // Atualização otimista: adiciona mensagem enviada imediatamente no thread
        const optimisticMsg: Message = {
          id: `optimistic-${Date.now()}`,
          direction: 'outbound',
          from_email: null,
          to_email: conversation.customer_email,
          body_text: replyText.trim(),
          status: 'replied',
          was_auto_replied: false,
          created_at: new Date().toISOString(),
          has_attachments: uploadedAttachments.length > 0,
          attachment_count: uploadedAttachments.length,
          attachments_metadata: uploadedAttachments.length > 0 ? uploadedAttachments : null,
        }
        setMessages(prev => [...prev, optimisticMsg])

        setReplyText('')
        setAttachments([])
        // Update local status
        setConversation(prev => prev ? { ...prev, ticket_status: 'answered' } : null)
        onStatusChange?.(conversation.id, 'answered')

        // Verificar se algum anexo falhou
        if (data.attachments_requested && data.attachments_sent < data.attachments_requested) {
          const failed = data.attachments_requested - data.attachments_sent
          setReplyError(`E-mail enviado, mas ${failed} anexo(s) não puderam ser incluídos.`)
          setTimeout(() => setReplyError(null), 6000)
        } else {
          setReplySuccess(true)
          setTimeout(() => setReplySuccess(false), 4000)
        }
      } else {
        throw new Error(data?.error || `Erro ${response.status}: ${response.statusText}`)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setReplyError('O envio demorou demais. O email pode ter sido enviado — verifique sua caixa de saída.')
      } else {
        setReplyError(err instanceof Error ? err.message : 'Erro ao enviar resposta.')
      }
    } finally {
      setSendingReply(false)
    }
  }, [conversation, replyText, sendingReply, onStatusChange, attachments])

  // Ctrl+Enter to send
  const handleReplyKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSendReply()
    }
  }, [handleSendReply])

  if (!conversationId) return null

  const fd = conversation?.form_data
  const status = conversation?.ticket_status || 'pending'
  const statusInfo = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const shortId = conversation?.id?.slice(0, 8).toUpperCase() || ''

  // Shopify admin URL
  const shopifyDomain = conversation?.shops?.shopify_domain
  const shopifyOrderId = conversation?.shopify_order_id
  const shopifyUrl = shopifyDomain && shopifyOrderId
    ? `https://${shopifyDomain}/admin/orders/${shopifyOrderId}`
    : null

  // Photo list for lightbox navigation
  const photoEntries = fd?.photos
    ? Object.entries(fd.photos).filter(([, url]) => url)
    : []

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingTop: isMobile ? '0' : '40px',
          overflowY: 'auto',
        }}
      >
        {/* Modal panel */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: isMobile ? '100%' : '800px',
            maxWidth: '100%',
            minHeight: isMobile ? '100vh' : 'auto',
            maxHeight: isMobile ? '100vh' : '85vh',
            backgroundColor: 'var(--bg-card)',
            borderRadius: isMobile ? '0' : '16px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: isMobile ? '16px' : '20px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
              <span style={{
                padding: '4px 12px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: statusInfo.bg,
                color: statusInfo.color,
                flexShrink: 0,
              }}>
                {statusInfo.label}
              </span>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                #{shortId}
              </span>
              {conversation && (
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {formatDate(conversation.created_at)}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', padding: '4px', display: 'flex',
                borderRadius: '8px', flexShrink: 0,
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="replyna-scrollbar" style={{
            flex: 1,
            overflowY: 'auto',
            padding: isMobile ? '16px' : '24px',
          }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                Carregando...
              </div>
            ) : !conversation ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                Formulário não encontrado.
              </div>
            ) : !fd ? (
              /* Fallback for forms without form_data */
              <div>
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  marginBottom: '20px',
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.5',
                }}>
                  Este formulário foi enviado antes do sistema de detalhes. Apenas informações básicas estão disponíveis.
                </div>
                <SectionCard title="Informações Básicas" icon={<User size={18} color="#4672ec" />}>
                  <InfoRow label="Nome" value={conversation.customer_name} />
                  <InfoRow label="E-mail" value={conversation.customer_email} />
                  <InfoRow label="Assunto" value={conversation.subject} />
                  <InfoRow label="Pedido Shopify" value={conversation.shopify_order_id} />
                  <InfoRow label="Loja" value={conversation.shops?.name} />
                </SectionCard>
              </div>
            ) : (
              /* Full form data */
              <>
                {/* Customer Info */}
                <SectionCard title="Informações do Cliente" icon={<User size={18} color="#4672ec" />}>
                  <InfoRow label="Nome completo" value={fd.full_name} />
                  <InfoRow label="E-mail" value={conversation.customer_email} />
                  <InfoRow label="Telefone" value={fd.phone} />
                </SectionCard>

                {/* Order Info */}
                <SectionCard title="Dados do Pedido" icon={<Package size={18} color="#8b5cf6" />}>
                  <InfoRow label="Nº do pedido" value={fd.order_number} />
                  <InfoRow label="Data do pedido" value={formatDateShort(fd.order_date)} />
                  <InfoRow label="Valor total" value={formatCurrency(fd.order_total, fd.order_currency)} />
                  <InfoRow label="Data de recebimento" value={formatDateShort(fd.receive_date)} />
                  <InfoRow label="Loja" value={conversation.shops?.name} />
                  {fd.line_items && fd.line_items.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                        Itens do pedido:
                      </span>
                      {fd.line_items.map((item, i) => (
                        <div key={i} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          backgroundColor: 'var(--bg-card)',
                          borderRadius: '8px',
                          marginBottom: '4px',
                          fontSize: '13px',
                        }}>
                          <span style={{ color: 'var(--text-primary)' }}>
                            {item.quantity}x {item.title}
                          </span>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {formatCurrency(item.price, fd.order_currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {shopifyUrl && (
                    <div style={{ marginTop: '12px' }}>
                      <a
                        href={shopifyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          backgroundColor: 'rgba(139,92,246,0.1)',
                          color: '#8b5cf6',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        <ExternalLink size={14} />
                        Ver pedido no Shopify
                      </a>
                    </div>
                  )}
                </SectionCard>

                {/* Return Reason */}
                <SectionCard title="Motivo da Devolução" icon={<AlertCircle size={18} color="#ef4444" />}>
                  <InfoRow label="Motivo" value={getLabel(RETURN_REASONS, fd.reason)} />
                  {fd.description && (
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Descrição detalhada:
                      </span>
                      <div style={{
                        padding: '12px 16px',
                        backgroundColor: 'var(--bg-card)',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: 'var(--text-primary)',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                      }}>
                        {fd.description}
                      </div>
                    </div>
                  )}
                </SectionCard>

                {/* Problem Details */}
                <SectionCard title="Detalhes do Problema" icon={<HelpCircle size={18} color="#f59e0b" />}>
                  <InfoRow label="Quando notou" value={getLabel(WHEN_NOTICED_OPTIONS, fd.when_noticed)} />
                  <InfoRow label="Tentou resolver" value={getLabel(TRIED_RESOLVE_OPTIONS, fd.tried_resolve)} />
                  {fd.resolution_attempts && (
                    <InfoRow label="O que tentou" value={fd.resolution_attempts} />
                  )}
                  <InfoRow label="Produto utilizado" value={getLabel(PRODUCT_USED_OPTIONS, fd.product_used)} />
                </SectionCard>

                {/* Photo Evidence */}
                {photoEntries.length > 0 && (
                  <SectionCard title="Evidências Fotográficas" icon={<Camera size={18} color="#06b6d4" />}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                      gap: '12px',
                    }}>
                      {photoEntries.map(([key, url], idx) => (
                        <div key={key} style={{ textAlign: 'center' }}>
                          <div
                            onClick={() => { setLightboxPhoto(url!); setLightboxIndex(idx) }}
                            style={{
                              width: '100%',
                              aspectRatio: '1',
                              borderRadius: '10px',
                              overflow: 'hidden',
                              border: '2px solid var(--border-color)',
                              cursor: 'pointer',
                              transition: 'border-color 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-color)')}
                          >
                            <img
                              src={url!}
                              alt={UPLOAD_LABELS[key] || key}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                            {UPLOAD_LABELS[key] || key}
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {photoEntries.length === 0 && (
                  <SectionCard title="Evidências Fotográficas" icon={<Camera size={18} color="#06b6d4" />}>
                    <div style={{
                      textAlign: 'center',
                      padding: '20px',
                      color: 'var(--text-secondary)',
                      fontSize: '14px',
                    }}>
                      Nenhuma foto enviada
                    </div>
                  </SectionCard>
                )}

                {/* Address */}
                {fd.address && (
                  <SectionCard title="Endereço de Devolução" icon={<MapPin size={18} color="#22c55e" />}>
                    <InfoRow label="Endereço" value={fd.address.line1} />
                    {fd.address.line2 && <InfoRow label="Complemento" value={fd.address.line2} />}
                    <InfoRow label="Cidade" value={fd.address.city} />
                    <InfoRow label="Estado" value={fd.address.state} />
                    <InfoRow label="CEP" value={fd.address.zip} />
                    <InfoRow label="País" value={fd.address.country} />
                  </SectionCard>
                )}

                {/* Resolution Preference */}
                <SectionCard title="Preferência de Resolução" icon={<RefreshCw size={18} color="#a855f7" />}>
                  <InfoRow label="Resolução desejada" value={getLabel(RESOLUTION_OPTIONS, fd.resolution_type)} />
                </SectionCard>

                {/* Additional Comments */}
                {fd.additional_comments && (
                  <SectionCard title="Comentários Adicionais" icon={<MessageSquare size={18} color="#64748b" />}>
                    <div style={{
                      padding: '12px 16px',
                      backgroundColor: 'var(--bg-card)',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: 'var(--text-primary)',
                      lineHeight: '1.6',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                    }}>
                      {fd.additional_comments}
                    </div>
                  </SectionCard>
                )}

                {/* Digital Signature */}
                {fd.signature && (
                  <SectionCard title="Assinatura Digital" icon={<PenTool size={18} color="#0ea5e9" />}>
                    <div style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '10px',
                      border: '2px solid var(--border-color)',
                      padding: '12px',
                      textAlign: 'center',
                    }}>
                      <img
                        src={fd.signature}
                        alt="Assinatura digital"
                        style={{ maxWidth: '100%', maxHeight: '150px' }}
                      />
                    </div>
                  </SectionCard>
                )}

                {/* Metadata */}
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  flexWrap: 'wrap',
                  padding: '12px 0',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                }}>
                  {fd.time_spent_seconds != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} />
                      Tempo de preenchimento: {Math.floor(fd.time_spent_seconds / 60)}min {fd.time_spent_seconds % 60}s
                    </div>
                  )}
                  {fd.submitted_at && (
                    <div>
                      Enviado em: {formatDate(fd.submitted_at)}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ─── Messages Thread ─── */}
            {conversation && messages.length > 0 && (
              <SectionCard title={`Mensagens (${messages.length})`} icon={<Mail size={18} color="#4672ec" />}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {messages.map(msg => {
                    const isOutbound = msg.direction === 'outbound'
                    return (
                      <div key={msg.id} style={{
                        padding: '12px 16px',
                        borderRadius: '10px',
                        backgroundColor: isOutbound ? 'rgba(70, 114, 236, 0.06)' : 'var(--bg-card)',
                        border: `1px solid ${isOutbound ? 'rgba(70, 114, 236, 0.15)' : 'var(--border-color)'}`,
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: isOutbound ? 'rgba(70, 114, 236, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                              color: isOutbound ? 'var(--accent)' : '#d97706',
                            }}>
                              {isOutbound ? 'Você' : 'Cliente'}
                            </span>
                            {msg.was_auto_replied && (
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 600,
                                backgroundColor: 'rgba(139,92,246,0.1)',
                                color: '#8b5cf6',
                              }}>
                                IA
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {formatDate(msg.created_at)}
                          </span>
                        </div>
                        {msg.body_text && (
                          <div style={{
                            fontSize: '13px',
                            color: 'var(--text-primary)',
                            lineHeight: '1.6',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}>
                            {msg.body_text}
                          </div>
                        )}
                        {/* Anexos da mensagem */}
                        {msg.attachments_metadata && msg.attachments_metadata.length > 0 && (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            marginTop: '8px',
                            paddingTop: '8px',
                            borderTop: '1px solid var(--border-color)',
                          }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Paperclip size={12} />
                              {msg.attachments_metadata.length} anexo{msg.attachments_metadata.length > 1 ? 's' : ''}
                            </div>
                            {msg.attachments_metadata.map((att, i) => (
                              <a
                                key={i}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  backgroundColor: 'var(--bg-secondary)',
                                  border: '1px solid var(--border-color)',
                                  textDecoration: 'none',
                                  color: 'var(--accent)',
                                  fontSize: '12px',
                                  transition: 'background-color 0.15s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                              >
                                <FileText size={14} />
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {att.filename}
                                </span>
                                <ExternalLink size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
                              </a>
                            ))}
                          </div>
                        )}
                        {/* Indicador de anexos sem metadados (mensagens antigas) */}
                        {(!msg.attachments_metadata || msg.attachments_metadata.length === 0) && msg.has_attachments && msg.attachment_count && msg.attachment_count > 0 && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginTop: '8px',
                            paddingTop: '8px',
                            borderTop: '1px solid var(--border-color)',
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                          }}>
                            <Paperclip size={12} />
                            {msg.attachment_count} anexo{msg.attachment_count > 1 ? 's' : ''} enviado{msg.attachment_count > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </SectionCard>
            )}

            {/* ─── Reply Form ─── */}
            {conversation && (
              <SectionCard title="Responder por E-mail" icon={<Send size={18} color="#4672ec" />}>
                <div style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <Mail size={12} />
                  Para: {conversation.customer_email}
                </div>

                {replySuccess && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    color: '#16a34a',
                    fontSize: '13px',
                    fontWeight: 500,
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <Check size={16} />
                    E-mail enviado com sucesso!
                  </div>
                )}

                {replyError && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    fontSize: '13px',
                    fontWeight: 500,
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <XCircle size={16} />
                    {replyError}
                  </div>
                )}

                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={handleReplyKeyDown}
                  maxLength={10000}
                  placeholder="Digite sua resposta ao cliente sobre esta solicitação..."
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    maxHeight: '200px',
                    padding: '12px 16px',
                    border: '1.5px solid var(--input-border)',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box' as const,
                    backgroundColor: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    resize: 'vertical' as const,
                    outline: 'none',
                    lineHeight: '1.6',
                    transition: 'border-color 0.2s ease',
                  }}
                />

                {/* Attachments list */}
                {attachments.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    marginTop: '10px',
                  }}>
                    {attachments.map((att, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: att.error ? 'rgba(239,68,68,0.06)' : 'rgba(70, 114, 236, 0.04)',
                        border: `1px solid ${att.error ? 'rgba(239,68,68,0.2)' : 'var(--border-color)'}`,
                      }}>
                        <FileText size={16} color={att.error ? '#ef4444' : 'var(--accent)'} style={{ flexShrink: 0 }} />
                        <span style={{
                          flex: 1,
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {att.file.name}
                          <span style={{ color: 'var(--text-secondary)', marginLeft: '6px', fontSize: '11px' }}>
                            ({(att.file.size / 1024).toFixed(0)} KB)
                          </span>
                        </span>
                        {att.uploading && (
                          <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 500 }}>
                            Enviando...
                          </span>
                        )}
                        {att.error && (
                          <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 500 }}>
                            Erro
                          </span>
                        )}
                        {att.url && !att.error && (
                          <Check size={14} color="#16a34a" />
                        )}
                        <button
                          onClick={() => removeAttachment(idx)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '24px',
                            height: '24px',
                            border: 'none',
                            borderRadius: '6px',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            flexShrink: 0,
                            padding: 0,
                          }}
                          title="Remover anexo"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.zip"
                />

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sendingReply}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        fontSize: '13px',
                        fontWeight: 500,
                        fontFamily: 'inherit',
                        border: '1.5px solid var(--border-color)',
                        borderRadius: '8px',
                        backgroundColor: 'transparent',
                        color: 'var(--text-secondary)',
                        cursor: sendingReply ? 'not-allowed' : 'pointer',
                        opacity: sendingReply ? 0.5 : 1,
                        transition: 'all 0.2s ease',
                      }}
                      title="Anexar arquivo"
                    >
                      <Paperclip size={14} />
                      Anexar
                    </button>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Ctrl+Enter para enviar
                    </span>
                  </div>
                  <button
                    onClick={handleSendReply}
                    disabled={sendingReply || !replyText.trim()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: sendingReply || !replyText.trim() ? 'not-allowed' : 'pointer',
                      background: 'linear-gradient(135deg, var(--accent), #3558c8)',
                      color: '#ffffff',
                      opacity: sendingReply || !replyText.trim() ? 0.5 : 1,
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 8px rgba(70, 114, 236, 0.25)',
                    }}
                  >
                    <Send size={16} />
                    {sendingReply
                      ? (attachments.some(a => a.url) ? 'Enviando com anexos...' : 'Enviando...')
                      : attachments.some(a => a.url) ? 'Enviar com Anexos' : 'Enviar E-mail'}
                  </button>
                </div>
              </SectionCard>
            )}
          </div>

          {/* Actions bar */}
          {conversation && !loading && (
            <div style={{
              padding: isMobile ? '16px' : '16px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: '10px',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'flex-end',
              alignItems: isMobile ? 'stretch' : 'center',
              flexShrink: 0,
            }}>
              {shopifyUrl && (
                <a
                  href={shopifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 600,
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                  }}
                >
                  <ExternalLink size={16} />
                  Ver no Shopify
                </a>
              )}

              {(status === 'pending' || status === 'answered') && (
                <>
                  {updateError && (
                    <div style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      color: '#ef4444',
                      fontSize: '13px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flex: 1,
                    }}>
                      <XCircle size={14} />
                      {updateError}
                    </div>
                  )}
                  <button
                    onClick={() => updateStatus('rejected')}
                    disabled={!!updating}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: '10px',
                      cursor: updating ? 'not-allowed' : 'pointer',
                      backgroundColor: 'rgba(239,68,68,0.08)',
                      color: '#ef4444',
                      opacity: updating ? 0.6 : 1,
                    }}
                  >
                    <XCircle size={16} />
                    {updating === 'rejected' ? 'Rejeitando...' : 'Rejeitar'}
                  </button>
                  <button
                    onClick={() => updateStatus('approved')}
                    disabled={!!updating}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: updating ? 'not-allowed' : 'pointer',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      opacity: updating ? 0.6 : 1,
                    }}
                  >
                    <Check size={16} />
                    {updating === 'approved' ? 'Aprovando...' : 'Aprovar'}
                  </button>
                </>
              )}

              {status === 'approved' && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 20px', fontSize: '14px', fontWeight: 600,
                  color: '#16a34a',
                }}>
                  <Check size={18} />
                  Solicitação aprovada
                </div>
              )}

              {status === 'rejected' && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 20px', fontSize: '14px', fontWeight: 600,
                  color: '#ef4444',
                }}>
                  <XCircle size={18} />
                  Solicitação rejeitada
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          onClick={() => setLightboxPhoto(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.9)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxPhoto(null) }}
            style={{
              position: 'absolute', top: '16px', right: '16px',
              background: 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: '50%', width: '40px', height: '40px',
              cursor: 'pointer', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={24} />
          </button>

          {photoEntries.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const prev = (lightboxIndex - 1 + photoEntries.length) % photoEntries.length
                  setLightboxIndex(prev)
                  setLightboxPhoto(photoEntries[prev][1]!)
                }}
                style={{
                  position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.1)', border: 'none',
                  borderRadius: '50%', width: '40px', height: '40px',
                  cursor: 'pointer', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const next = (lightboxIndex + 1) % photoEntries.length
                  setLightboxIndex(next)
                  setLightboxPhoto(photoEntries[next][1]!)
                }}
                style={{
                  position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.1)', border: 'none',
                  borderRadius: '50%', width: '40px', height: '40px',
                  cursor: 'pointer', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          <img
            src={lightboxPhoto}
            alt="Foto ampliada"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '90%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }}
          />

          <div style={{
            position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
            color: '#fff', fontSize: '14px', fontWeight: 500,
            backgroundColor: 'rgba(0,0,0,0.6)', padding: '6px 16px', borderRadius: '999px',
          }}>
            {UPLOAD_LABELS[photoEntries[lightboxIndex]?.[0]] || ''} ({lightboxIndex + 1}/{photoEntries.length})
          </div>
        </div>
      )}
    </>
  )
}
