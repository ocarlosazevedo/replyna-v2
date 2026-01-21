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
  category: string | null
}

interface ConversationModalProps {
  conversationId: string | null
  onClose: () => void
  onCategoryChange?: (conversationId: string, newCategory: string) => void
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
  troca: 'Troca',
  spam: 'Spam',
  outros: 'Outros',
}

// Categorias disponíveis para seleção (exceto spam que pode ser trocado)
const availableCategories = [
  { value: 'rastreio', label: 'Rastreio' },
  { value: 'duvidas_gerais', label: 'Dúvidas gerais' },
  { value: 'produto', label: 'Produto' },
  { value: 'pagamento', label: 'Pagamento' },
  { value: 'entrega', label: 'Entrega' },
  { value: 'reembolso', label: 'Reembolso' },
  { value: 'troca', label: 'Troca' },
  { value: 'institucional', label: 'Institucional' },
  { value: 'suporte_humano', label: 'Suporte humano' },
  { value: 'outros', label: 'Outros' },
]

const getCategoryBadge = (category: string | null) => {
  const base = { padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }
  switch (category) {
    case 'rastreio':
      return { ...base, backgroundColor: 'rgba(34, 197, 94, 0.16)', color: '#16a34a' }
    case 'duvidas_gerais':
      return { ...base, backgroundColor: 'rgba(59, 130, 246, 0.16)', color: '#2563eb' }
    case 'produto':
      return { ...base, backgroundColor: 'rgba(168, 85, 247, 0.16)', color: '#9333ea' }
    case 'pagamento':
      return { ...base, backgroundColor: 'rgba(236, 72, 153, 0.16)', color: '#db2777' }
    case 'entrega':
      return { ...base, backgroundColor: 'rgba(14, 165, 233, 0.16)', color: '#0284c7' }
    case 'reembolso':
      return { ...base, backgroundColor: 'rgba(245, 158, 11, 0.18)', color: '#b45309' }
    case 'troca':
      return { ...base, backgroundColor: 'rgba(251, 146, 60, 0.16)', color: '#ea580c' }
    case 'institucional':
      return { ...base, backgroundColor: 'rgba(107, 114, 128, 0.16)', color: '#6b7280' }
    case 'suporte_humano':
      return { ...base, backgroundColor: 'rgba(239, 68, 68, 0.16)', color: '#dc2626' }
    case 'spam':
      return { ...base, backgroundColor: 'rgba(220, 38, 38, 0.20)', color: '#b91c1c' }
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

export default function ConversationModal({ conversationId, onClose, onCategoryChange }: ConversationModalProps) {
  const [conversation, setConversation] = useState<{
    id: string
    customer_email: string
    customer_name: string | null
    subject: string | null
    category: string | null
    created_at: string
    shop_id: string
  } | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [changingCategory, setChangingCategory] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
  const [reprocessError, setReprocessError] = useState<string | null>(null)
  const [reprocessSuccess, setReprocessSuccess] = useState(false)

  const loadConversation = useCallback(async () => {
    if (!conversationId) return

    setLoading(true)
    setReprocessError(null)
    setReprocessSuccess(false)

    try {
      // Carregar conversa
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('id, customer_email, customer_name, subject, category, created_at, shop_id')
        .eq('id', conversationId)
        .single()

      if (convError) throw convError
      setConversation(convData)

      // Carregar mensagens
      const { data: msgData, error: msgError } = await supabase
        .from('messages')
        .select('id, direction, from_email, to_email, subject, body_text, status, was_auto_replied, created_at, category')
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
      setShowCategoryDropdown(false)
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
      if (e.key === 'Escape') {
        if (showCategoryDropdown) {
          setShowCategoryDropdown(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, showCategoryDropdown])

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    if (!showCategoryDropdown) return
    const handleClickOutside = () => setShowCategoryDropdown(false)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showCategoryDropdown])

  const handleCategoryChange = async (newCategory: string) => {
    if (!conversation || changingCategory) return

    setChangingCategory(true)
    setReprocessError(null)
    setReprocessSuccess(false)

    try {
      // Atualizar categoria da conversa
      const { error: convError } = await supabase
        .from('conversations')
        .update({ category: newCategory })
        .eq('id', conversation.id)

      if (convError) throw convError

      // Atualizar categoria da última mensagem inbound
      const lastInboundMessage = [...messages].reverse().find(m => m.direction === 'inbound')
      if (lastInboundMessage) {
        const { error: msgError } = await supabase
          .from('messages')
          .update({
            category: newCategory,
            status: 'pending' // Voltar para pending para ser reprocessado
          })
          .eq('id', lastInboundMessage.id)

        if (msgError) throw msgError
      }

      // Atualizar estado local
      setConversation(prev => prev ? { ...prev, category: newCategory } : null)
      setShowCategoryDropdown(false)

      // Notificar parent component
      if (onCategoryChange) {
        onCategoryChange(conversation.id, newCategory)
      }

      // Se mudou de spam para outra categoria, mostrar opção de reprocessar
      if (conversation.category === 'spam' && newCategory !== 'spam') {
        setReprocessSuccess(true)
      }
    } catch (err) {
      console.error('Erro ao alterar categoria:', err)
      setReprocessError('Erro ao alterar categoria. Tente novamente.')
    } finally {
      setChangingCategory(false)
    }
  }

  const handleReprocess = async () => {
    if (!conversation || reprocessing) return

    setReprocessing(true)
    setReprocessError(null)

    try {
      // Chamar a Edge Function para reprocessar o email
      const { data, error } = await supabase.functions.invoke('reprocess-message', {
        body: {
          conversation_id: conversation.id,
          shop_id: conversation.shop_id,
        },
      })

      if (error) throw error

      if (data?.success) {
        setReprocessSuccess(true)
        // Recarregar mensagens para mostrar a nova resposta
        await loadConversation()
      } else {
        throw new Error(data?.error || 'Erro desconhecido')
      }
    } catch (err) {
      console.error('Erro ao reprocessar:', err)
      setReprocessError(err instanceof Error ? err.message : 'Erro ao reprocessar email. Tente novamente.')
    } finally {
      setReprocessing(false)
    }
  }

  if (!conversationId) return null

  const isSpam = conversation?.category === 'spam'
  const wasSpam = conversation?.category !== 'spam' && messages.some(m => m.category === 'spam')

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
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowCategoryDropdown(!showCategoryDropdown)
                  }}
                  disabled={changingCategory}
                  style={{
                    ...getCategoryBadge(conversation.category),
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'opacity 0.15s ease',
                    opacity: changingCategory ? 0.6 : 1,
                  }}
                >
                  {categoryLabelMap[conversation.category || 'outros'] || 'Outros'}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Dropdown de categorias */}
                {showCategoryDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '4px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                      zIndex: 1001,
                      minWidth: '180px',
                      maxHeight: '300px',
                      overflowY: 'auto',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {availableCategories.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => handleCategoryChange(cat.value)}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '10px 14px',
                          border: 'none',
                          backgroundColor: conversation.category === cat.value ? 'var(--bg-primary)' : 'transparent',
                          color: 'var(--text-primary)',
                          textAlign: 'left',
                          fontSize: '14px',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = conversation.category === cat.value ? 'var(--bg-primary)' : 'transparent'}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: getCategoryBadge(cat.value).color,
                            }}
                          />
                          {cat.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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

        {/* Aviso de Spam */}
        {!loading && isSpam && (
          <div
            style={{
              padding: '12px 20px',
              backgroundColor: 'rgba(220, 38, 38, 0.08)',
              borderBottom: '1px solid rgba(220, 38, 38, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span style={{ fontSize: '14px', color: '#b91c1c', fontWeight: 600 }}>
                Este email foi classificado como SPAM e não foi respondido.
              </span>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Clique na tag acima para alterar a categoria
            </span>
          </div>
        )}

        {/* Mensagem de sucesso ao mudar categoria */}
        {reprocessSuccess && !isSpam && (
          <div
            style={{
              padding: '12px 20px',
              backgroundColor: 'rgba(34, 197, 94, 0.08)',
              borderBottom: '1px solid rgba(34, 197, 94, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span style={{ fontSize: '14px', color: '#15803d', fontWeight: 600 }}>
                Categoria alterada com sucesso!
              </span>
            </div>
            <button
              type="button"
              onClick={handleReprocess}
              disabled={reprocessing}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#15803d',
                color: 'white',
                fontSize: '13px',
                fontWeight: 600,
                cursor: reprocessing ? 'not-allowed' : 'pointer',
                opacity: reprocessing ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {reprocessing ? (
                <>
                  <span style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  Processando...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-9-9" />
                    <polyline points="21 3 21 9 15 9" />
                  </svg>
                  Gerar resposta agora
                </>
              )}
            </button>
          </div>
        )}

        {/* Erro ao reprocessar */}
        {reprocessError && (
          <div
            style={{
              padding: '12px 20px',
              backgroundColor: 'rgba(220, 38, 38, 0.08)',
              borderBottom: '1px solid rgba(220, 38, 38, 0.2)',
            }}
          >
            <span style={{ fontSize: '14px', color: '#b91c1c' }}>
              {reprocessError}
            </span>
          </div>
        )}

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

      {/* CSS para animação do spinner */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
