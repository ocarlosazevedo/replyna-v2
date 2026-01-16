import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Message {
  id: string
  direction: 'inbound' | 'outbound'
  from_email: string | null
  to_email: string | null
  subject: string | null
  body_text: string | null
  status: string | null
  was_auto_replied: boolean | null
  created_at: string
}

interface ConversationModalProps {
  conversationId: string | null
  onClose: () => void
}

const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

const categoryLabelMap: Record<string, string> = {
  duvidas_gerais: 'Duvidas gerais',
  rastreio: 'Rastreio',
  reembolso: 'Reembolso',
  institucional: 'Institucional',
  suporte_humano: 'Suporte humano',
  produto: 'Produto',
  pagamento: 'Pagamento',
  entrega: 'Entrega',
  outros: 'Outros',
}

const statusLabelMap: Record<string, string> = {
  open: 'Aberta',
  resolved: 'Resolvida',
  pending_human: 'Aguardando humano',
  closed: 'Fechada',
}

const getCategoryBadge = (category: string | null) => {
  const base = { padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }
  switch (category) {
    case 'rastreio':
      return { ...base, backgroundColor: 'rgba(59, 130, 246, 0.16)', color: '#2563eb' }
    case 'reembolso':
      return { ...base, backgroundColor: 'rgba(245, 158, 11, 0.18)', color: '#b45309' }
    case 'suporte_humano':
      return { ...base, backgroundColor: 'rgba(239, 68, 68, 0.16)', color: '#dc2626' }
    default:
      return { ...base, backgroundColor: 'rgba(148, 163, 184, 0.16)', color: '#64748b' }
  }
}

const getStatusBadge = (status: string | null) => {
  const base = { padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }
  switch (status) {
    case 'open':
      return { ...base, backgroundColor: 'rgba(59, 130, 246, 0.16)', color: '#2563eb' }
    case 'resolved':
      return { ...base, backgroundColor: 'rgba(34, 197, 94, 0.16)', color: '#15803d' }
    case 'pending_human':
      return { ...base, backgroundColor: 'rgba(245, 158, 11, 0.18)', color: '#b45309' }
    case 'closed':
      return { ...base, backgroundColor: 'rgba(107, 114, 128, 0.16)', color: '#6b7280' }
    default:
      return { ...base, backgroundColor: 'rgba(148, 163, 184, 0.16)', color: '#64748b' }
  }
}

/**
 * Limpa o corpo da mensagem removendo MIME boundaries e headers
 */
function cleanMessageBody(body: string | null): string {
  if (!body) return '(Sem conteudo)'

  let cleaned = body

  // Verificar se tem MIME boundary
  const boundaryMatch = cleaned.match(/--([0-9a-f]+)/i)
  if (boundaryMatch) {
    const boundary = boundaryMatch[1]
    // Dividir por boundary e pegar a primeira parte text/plain
    const parts = cleaned.split(new RegExp(`--${boundary}(?:--)?`, 'g'))

    for (const part of parts) {
      // Procurar parte text/plain
      if (part.includes('Content-Type: text/plain') || part.includes('content-type: text/plain')) {
        // Extrair conteudo apos headers (linha vazia)
        const contentMatch = part.match(/\r?\n\r?\n([\s\S]*)/);
        if (contentMatch) {
          cleaned = contentMatch[1].trim()
          break
        }
      }
    }
  }

  // Remover headers MIME restantes
  cleaned = cleaned
    .replace(/^Content-Type:.*$/gim, '')
    .replace(/^Content-Transfer-Encoding:.*$/gim, '')
    .replace(/^--[0-9a-f]+--?$/gim, '')
    .replace(/<div[^>]*>(.*?)<\/div>/gi, '$1')
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .trim()

  // Remover linhas vazias multiplas
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()

  return cleaned || '(Sem conteudo)'
}

export default function ConversationModal({ conversationId, onClose }: ConversationModalProps) {
  const [conversation, setConversation] = useState<{
    id: string
    customer_email: string
    customer_name: string | null
    subject: string | null
    category: string | null
    status: string | null
    created_at: string
  } | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  const loadConversation = useCallback(async () => {
    if (!conversationId) return

    setLoading(true)

    try {
      // Carregar conversa
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('id, customer_email, customer_name, subject, category, status, created_at')
        .eq('id', conversationId)
        .single()

      if (convError) throw convError
      setConversation(convData)

      // Carregar mensagens
      const { data: msgData, error: msgError } = await supabase
        .from('messages')
        .select('id, direction, from_email, to_email, subject, body_text, status, was_auto_replied, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (msgError) throw msgError
      setMessages((msgData || []) as Message[])
    } catch (err) {
      console.error('Erro ao carregar conversa:', err)
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    if (conversationId) {
      loadConversation()
    }
  }, [conversationId, loadConversation])

  // Real-time subscription
  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  // Fechar com ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!conversationId) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          width: '100%',
          maxWidth: '700px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {loading ? 'Carregando...' : conversation?.subject || 'Sem assunto'}
            </h2>
            {conversation && (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {conversation.customer_name || conversation.customer_email}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {conversation && (
              <>
                <span style={getCategoryBadge(conversation.category)}>
                  {categoryLabelMap[conversation.category || 'outros'] || 'Outros'}
                </span>
                <span style={getStatusBadge(conversation.status)}>
                  {statusLabelMap[conversation.status || 'open'] || 'Aberta'}
                </span>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                marginLeft: '8px',
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Carregando mensagens...
            </div>
          ) : messages.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Nenhuma mensagem nesta conversa
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: message.direction === 'outbound' ? 'rgba(59, 130, 246, 0.04)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        backgroundColor: message.direction === 'inbound' ? 'rgba(107, 114, 128, 0.16)' : 'rgba(59, 130, 246, 0.16)',
                        color: message.direction === 'inbound' ? '#6b7280' : '#2563eb',
                      }}
                    >
                      {message.direction === 'inbound' ? 'Cliente' : 'Resposta'}
                    </span>
                    {message.was_auto_replied && (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(34, 197, 94, 0.16)',
                          color: '#15803d',
                        }}
                      >
                        Automatica
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {formatDateTime(new Date(message.created_at))}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {cleanMessageBody(message.body_text)}
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  {message.direction === 'inbound' ? `De: ${message.from_email}` : `Para: ${message.to_email}`}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
