import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

interface Message {
  id: string
  direction: 'inbound' | 'outbound'
  from_email: string | null
  to_email: string | null
  subject: string | null
  body_text: string | null
  body_html: string | null
  status: string | null
  was_auto_replied: boolean | null
  created_at: string
}

interface Conversation {
  id: string
  shop_id: string
  customer_email: string
  customer_name: string | null
  subject: string | null
  category: string | null
  status: string | null
  created_at: string
  shops: {
    name: string
  }[]
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

export default function ConversationDetails() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { conversationId } = useParams<{ conversationId: string }>()

  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadConversation = useCallback(async () => {
    if (!user || !conversationId) return

    setLoading(true)
    setError(null)

    try {
      // Carregar conversa
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('id, shop_id, customer_email, customer_name, subject, category, status, created_at, shops(name)')
        .eq('id', conversationId)
        .single()

      if (convError) throw convError

      // Verificar se a conversa pertence ao usuario
      const { data: shopData } = await supabase
        .from('shops')
        .select('user_id')
        .eq('id', convData.shop_id)
        .single()

      if (!shopData || shopData.user_id !== user.id) {
        setError('Conversa nao encontrada')
        return
      }

      setConversation(convData as Conversation)

      // Carregar mensagens
      const { data: msgData, error: msgError } = await supabase
        .from('messages')
        .select('id, direction, from_email, to_email, subject, body_text, body_html, status, was_auto_replied, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (msgError) throw msgError

      setMessages((msgData || []) as Message[])
    } catch (err) {
      console.error('Erro ao carregar conversa:', err)
      setError('Erro ao carregar conversa')
    } finally {
      setLoading(false)
    }
  }, [conversationId, user])

  useEffect(() => {
    loadConversation()
  }, [loadConversation])

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

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div
            style={{
              width: '200px',
              height: '24px',
              backgroundColor: 'var(--border-color)',
              borderRadius: '8px',
              animation: 'replyna-pulse 1.6s ease-in-out infinite',
            }}
          />
        </div>
        <div
          style={{
            height: '400px',
            backgroundColor: 'var(--border-color)',
            borderRadius: '16px',
            animation: 'replyna-pulse 1.6s ease-in-out infinite',
          }}
        />
      </div>
    )
  }

  if (error || !conversation) {
    return (
      <div style={{ padding: '24px' }}>
        <div
          style={{
            backgroundColor: '#fef2f2',
            color: '#b91c1c',
            padding: '16px',
            borderRadius: '10px',
            border: '1px solid rgba(185, 28, 28, 0.2)',
            fontWeight: 600,
            marginBottom: '16px',
          }}
        >
          {error || 'Conversa nao encontrada'}
        </div>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '10px 20px',
            backgroundColor: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Voltar ao Dashboard
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '18px' }}>&larr;</span> Voltar
        </button>

        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {conversation.subject || 'Sem assunto'}
          </h1>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {conversation.customer_name || conversation.customer_email} &bull; {conversation.shops?.[0]?.name}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={getCategoryBadge(conversation.category)}>
            {categoryLabelMap[conversation.category || 'outros'] || 'Outros'}
          </span>
          <span style={getStatusBadge(conversation.status)}>
            {statusLabelMap[conversation.status || 'open'] || 'Aberta'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Mensagens ({messages.length})
          </h2>
        </div>

        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
          {messages.length === 0 ? (
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

                {message.subject && (
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    {message.subject}
                  </div>
                )}

                <div
                  style={{
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {message.body_text || '(Sem conteudo)'}
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
