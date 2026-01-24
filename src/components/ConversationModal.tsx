import type React from 'react'
import { useCallback, useEffect, useState } from 'react'
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
  category: string | null
}

interface ConversationModalProps {
  conversationId: string | null
  onClose: () => void
  onCategoryChange?: (conversationId: string, newCategory: string) => void
  isAdmin?: boolean
}

const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(date)

const categoryLabelMap: Record<string, string> = {
  spam: 'Spam',
  duvidas_gerais: 'Dúvidas gerais',
  rastreio: 'Rastreio',
  troca_devolucao_reembolso: 'Troca/Devolução/Reembolso',
  edicao_pedido: 'Edição de pedido',
  suporte_humano: 'Suporte humano',
}

// Categorias disponíveis para seleção
const availableCategories = [
  { value: 'duvidas_gerais', label: 'Dúvidas gerais' },
  { value: 'rastreio', label: 'Rastreio' },
  { value: 'troca_devolucao_reembolso', label: 'Troca/Devolução/Reembolso' },
  { value: 'edicao_pedido', label: 'Edição de pedido' },
  { value: 'suporte_humano', label: 'Suporte humano' },
  { value: 'spam', label: 'Spam' },
]

const getCategoryBadge = (category: string | null): React.CSSProperties => {
  const base: React.CSSProperties = {
    padding: '4px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  }
  switch (category) {
    case 'spam':
      return { ...base, backgroundColor: 'rgba(220, 38, 38, 0.20)', color: '#b91c1c' }
    case 'duvidas_gerais':
      return { ...base, backgroundColor: 'rgba(96, 165, 250, 0.16)', color: '#60a5fa' }
    case 'rastreio':
      return { ...base, backgroundColor: 'rgba(34, 197, 94, 0.16)', color: '#16a34a' }
    case 'troca_devolucao_reembolso':
      return { ...base, backgroundColor: 'rgba(245, 158, 11, 0.18)', color: '#b45309' }
    case 'edicao_pedido':
      return { ...base, backgroundColor: 'rgba(168, 85, 247, 0.18)', color: '#9333ea' }
    case 'suporte_humano':
      return { ...base, backgroundColor: 'rgba(239, 68, 68, 0.16)', color: '#dc2626' }
    default:
      return { ...base, backgroundColor: 'rgba(148, 163, 184, 0.16)', color: '#64748b' }
  }
}

/**
 * Decodifica quoted-printable para texto
 */
function decodeQuotedPrintable(text: string): string {
  // Remover soft line breaks
  const withoutSoftBreaks = text.replace(/=\r?\n/g, '')

  // Converter =XX para caracteres
  return withoutSoftBreaks.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16))
  })
}

/**
 * Decodifica base64 para texto
 */
function decodeBase64(text: string): string {
  try {
    // Remover whitespace e decodificar
    const cleaned = text.replace(/\s/g, '')
    return atob(cleaned)
  } catch {
    return text
  }
}

/**
 * Converte HTML para texto simples
 */
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Sanitiza HTML de email para exibição segura
 * Remove scripts, eventos inline, e limita estilos problemáticos
 */
function sanitizeEmailHtml(html: string): string {
  if (!html) return ''

  let sanitized = html
    // Remover scripts e conteúdo perigoso
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<base[^>]*>/gi, '')
    // Remover eventos inline (onclick, onload, onerror, etc.)
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '')
    // Remover javascript: URLs
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
    .replace(/src\s*=\s*["']javascript:[^"']*["']/gi, '')
    // Remover data: URLs em src (podem conter código malicioso, mas manter em imagens)
    // Manter data:image mas remover outros
    .replace(/src\s*=\s*["']data:(?!image\/)[^"']*["']/gi, '')
    // Remover iframes
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<iframe[^>]*\/>/gi, '')
    // Remover object/embed
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    // Remover form elements
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
    .replace(/<input[^>]*>/gi, '')
    .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '')
    // Converter imagens CID para placeholder (cid:xxx não funciona no browser)
    .replace(/src\s*=\s*["']cid:[^"']+["']/gi, 'src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\'%3E%3Crect fill=\'%23ddd\' width=\'100\' height=\'100\'/%3E%3Ctext x=\'50\' y=\'50\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23999\' font-size=\'12\'%3EImagem%3C/text%3E%3C/svg%3E" alt="[Imagem incorporada]"')

  return sanitized
}

/**
 * Verifica se o HTML parece ser válido/seguro para renderizar
 * Retorna false se parecer ser MIME raw ou conteúdo quebrado
 */
function isValidEmailHtml(html: string | null): boolean {
  if (!html) return false

  // Se contém headers MIME, não é HTML válido
  if (/Content-Type:/i.test(html) || /Content-Transfer-Encoding:/i.test(html)) {
    return false
  }

  // Se contém boundary MIME, não é HTML válido
  if (/^--[A-Za-z0-9_-]+$/m.test(html)) {
    return false
  }

  // Se tem muito base64, provavelmente não é HTML renderizável
  const base64Ratio = (html.match(/[A-Za-z0-9+/=]{50,}/g) || []).join('').length / html.length
  if (base64Ratio > 0.3) {
    return false
  }

  // Verificar se parece ter tags HTML básicas
  return /<[a-z][a-z0-9]*[^>]*>/i.test(html)
}

/**
 * Trunca URLs muito longas (como tracking links do Shopify)
 */
function truncateLongUrls(text: string, maxLength: number = 80): string {
  // Regex para encontrar URLs
  const urlRegex = /(https?:\/\/[^\s\)>\]"']+)/gi

  return text.replace(urlRegex, (url) => {
    if (url.length > maxLength) {
      // Extrair dominio e truncar o resto
      try {
        const urlObj = new URL(url)
        const domain = urlObj.hostname
        return `${urlObj.protocol}//${domain}/... [link truncado]`
      } catch {
        return url.substring(0, maxLength) + '... [link truncado]'
      }
    }
    return url
  })
}

/**
 * Remove ou colapsa conteudo de email encaminhado/citado
 */
function cleanForwardedContent(text: string): string {
  // Detectar separadores de email encaminhado em varios idiomas
  const forwardSeparators = [
    /^-{3,}\s*(Forwarded|Original|Původní|Oorspronkelijk|Originale|Original-Nachricht|Mensaje original|Message original|Mensagem original)[^-]*-{3,}.*$/gim,
    /^>{1,}\s*.*$/gm, // Linhas citadas com >
    /^On\s+.+wrote:$/gim, // "On ... wrote:"
    /^Em\s+.+escreveu:$/gim, // Portugues
    /^Le\s+.+a écrit\s*:$/gim, // Frances
    /^Am\s+.+schrieb.*:$/gim, // Alemao
    /^El\s+.+escribió:$/gim, // Espanhol
    /^Dne\s+.+napsal.*:$/gim, // Tcheco
  ]

  let result = text

  // Encontrar o primeiro separador de encaminhamento e manter apenas o texto antes dele
  for (const separator of forwardSeparators) {
    const match = result.match(separator)
    if (match && match.index !== undefined) {
      // Manter apenas o texto antes do separador + indicacao de que ha mais
      const beforeForward = result.substring(0, match.index).trim()
      if (beforeForward.length > 0) {
        result = beforeForward + '\n\n[... email original/encaminhado omitido ...]'
        break
      }
    }
  }

  return result
}

/**
 * Limpa o corpo da mensagem removendo MIME boundaries e headers
 */
function cleanMessageBody(body: string | null): string {
  if (!body) return '(Sem conteudo)'

  let cleaned = body.trim()

  // Verificar se é MIME multipart buscando boundary no header ou diretamente
  const boundaryHeaderMatch = cleaned.match(/Content-Type:\s*multipart\/[^;]+;\s*boundary=["']?([^"'\r\n;]+)/i)
  let boundary = ''

  if (boundaryHeaderMatch) {
    boundary = boundaryHeaderMatch[1].trim()
  } else {
    // Fallback: tentar encontrar boundary diretamente
    const boundaryMatch = cleaned.match(/^--([^\r\n]+)/m)
    if (boundaryMatch) {
      boundary = boundaryMatch[1].trim()
    }
  }

  if (boundary) {
    // Dividir por boundary e procurar partes
    const escapedBoundary = boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const parts = cleaned.split(new RegExp(`--${escapedBoundary}(?:--)?`))

    let textContent = ''
    let htmlContent = ''

    for (const part of parts) {
      if (!part.trim()) continue

      const contentTypeMatch = part.match(/Content-Type:\s*([^;\r\n]+)/i)
      if (!contentTypeMatch) continue

      const contentType = contentTypeMatch[1].toLowerCase().trim()

      // Verificar encoding
      const isQuotedPrintable = /Content-Transfer-Encoding:\s*quoted-printable/i.test(part)
      const isBase64 = /Content-Transfer-Encoding:\s*base64/i.test(part)

      // Extrair conteudo apos headers (linha vazia dupla)
      const contentMatch = part.match(/\r?\n\r?\n([\s\S]*)/)
      if (!contentMatch) continue

      let content = contentMatch[1].trim()

      // Decodificar se necessário
      if (isQuotedPrintable) {
        content = decodeQuotedPrintable(content)
      } else if (isBase64) {
        content = decodeBase64(content)
      }

      // Guardar por tipo
      if (contentType.includes('text/plain')) {
        textContent = content
      } else if (contentType.includes('text/html') && !textContent) {
        htmlContent = content
      }
    }

    // Preferir text/plain, fallback para HTML convertido
    if (textContent) {
      cleaned = textContent
    } else if (htmlContent) {
      cleaned = htmlToText(htmlContent)
    }
  }

  // Se ainda tem headers MIME, tentar limpar
  if (cleaned.includes('Content-Type:') || cleaned.includes('Content-Transfer-Encoding:')) {
    // Verificar se é quoted-printable standalone
    const isQP = /Content-Transfer-Encoding:\s*quoted-printable/i.test(cleaned)
    const isB64 = /Content-Transfer-Encoding:\s*base64/i.test(cleaned)

    // Extrair conteúdo após headers
    const contentAfterHeaders = cleaned.match(/\r?\n\r?\n([\s\S]*)/)
    if (contentAfterHeaders) {
      let content = contentAfterHeaders[1].trim()
      if (isQP) {
        content = decodeQuotedPrintable(content)
      } else if (isB64) {
        content = decodeBase64(content)
      }
      cleaned = content
    }

    // Limpar headers residuais
    cleaned = cleaned
      .replace(/^Content-Type:.*$/gim, '')
      .replace(/^Content-Transfer-Encoding:.*$/gim, '')
      .replace(/^MIME-Version:.*$/gim, '')
      .replace(/^--[^\r\n]+--?$/gim, '')
      .trim()
  }

  // Remover linhas vazias multiplas
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()

  // Limpar conteudo de email encaminhado/citado
  cleaned = cleanForwardedContent(cleaned)

  // Truncar URLs muito longas (como tracking links do Shopify)
  cleaned = truncateLongUrls(cleaned)

  return cleaned || '(Sem conteudo)'
}

export default function ConversationModal({ conversationId, onClose, onCategoryChange, isAdmin = false }: ConversationModalProps) {
  const [conversation, setConversation] = useState<{
    id: string
    customer_email: string
    customer_name: string | null
    subject: string | null
    category: string | null
    created_at: string
    shop_id: string
    shop_email?: string | null
    shop_name?: string | null
  } | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [changingCategory, setChangingCategory] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
  const [reprocessError, setReprocessError] = useState<string | null>(null)
  const [reprocessSuccess, setReprocessSuccess] = useState(false)
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [translatingId, setTranslatingId] = useState<string | null>(null)

  const loadConversation = useCallback(async () => {
    if (!conversationId) return

    setLoading(true)
    setReprocessError(null)
    setReprocessSuccess(false)

    try {
      if (isAdmin) {
        // Admin: usar edge function para bypassar RLS
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-conversation-details?conversation_id=${conversationId}`,
          {
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Erro ao carregar conversa')
        }

        const data = await response.json()
        setConversation(data.conversation)
        setMessages((data.messages || []) as Message[])
      } else {
        // Usuário normal: usar cliente supabase com RLS
        // Carregar conversa com dados da loja
        const { data: convData, error: convError } = await supabase
          .from('conversations')
          .select('id, customer_email, customer_name, subject, category, created_at, shop_id, shops(name, imap_user)')
          .eq('id', conversationId)
          .single()

        if (convError) throw convError

        // Extrair dados da loja do join
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shopData = (convData as any)?.shops
        setConversation({
          id: convData.id,
          customer_email: convData.customer_email,
          customer_name: convData.customer_name,
          subject: convData.subject,
          category: convData.category,
          created_at: convData.created_at,
          shop_id: convData.shop_id,
          shop_email: shopData?.imap_user || (Array.isArray(shopData) ? shopData[0]?.imap_user : null),
          shop_name: shopData?.name || (Array.isArray(shopData) ? shopData[0]?.name : null),
        })

        // Carregar mensagens
        const { data: msgData, error: msgError } = await supabase
          .from('messages')
          .select('id, direction, from_email, to_email, subject, body_text, body_html, status, was_auto_replied, created_at, category')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })

        if (msgError) throw msgError
        setMessages((msgData || []) as Message[])
      }
    } catch (err) {
      console.error('Erro ao carregar conversa:', err)
    } finally {
      setLoading(false)
    }
  }, [conversationId, isAdmin])

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

  const handleTranslate = async (messageId: string, text: string) => {
    if (translatingId || translations[messageId]) return

    setTranslatingId(messageId)
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-message`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao traduzir')
      }

      const data = await response.json()
      setTranslations(prev => ({ ...prev, [messageId]: data.translated }))
    } catch (err) {
      console.error('Erro ao traduzir:', err)
      alert('Erro ao traduzir mensagem. Tente novamente.')
    } finally {
      setTranslatingId(null)
    }
  }

  if (!conversationId) return null

  const isSpam = conversation?.category === 'spam'

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
                <span>{conversation.customer_name || conversation.customer_email}</span>
                {conversation.shop_email && (
                  <span style={{ marginLeft: '8px', opacity: 0.7 }}>
                    → {conversation.shop_email}
                  </span>
                )}
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
                  {conversation.category ? categoryLabelMap[conversation.category] : 'Sem categoria'}
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
        <div className="replyna-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
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
                  backgroundColor: message.direction === 'outbound' ? 'rgba(139, 92, 246, 0.06)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        backgroundColor: message.direction === 'inbound' ? 'rgba(107, 114, 128, 0.16)' : 'rgba(139, 92, 246, 0.16)',
                        color: message.direction === 'inbound' ? '#6b7280' : '#a78bfa',
                      }}
                    >
                      {message.direction === 'inbound' ? 'Cliente' : 'Resposta'}
                    </span>
                    {message.direction === 'outbound' && message.was_auto_replied && (
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
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

                {/* Conteúdo original ou traduzido */}
                {translations[message.id] ? (
                  <div>
                    <div
                      style={{
                        fontSize: '14px',
                        color: 'var(--text-primary)',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        padding: '12px',
                        backgroundColor: 'rgba(59, 130, 246, 0.08)',
                        borderRadius: '8px',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>
                        Traduzido para Portugues
                      </div>
                      {translations[message.id]}
                    </div>
                    <details style={{ marginTop: '8px' }}>
                      <summary style={{ fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        Ver original
                      </summary>
                      <div
                        style={{
                          fontSize: '13px',
                          color: 'var(--text-secondary)',
                          lineHeight: '1.5',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          marginTop: '8px',
                          padding: '8px',
                          backgroundColor: 'var(--bg-primary)',
                          borderRadius: '6px',
                        }}
                      >
                        {message.body_html && isValidEmailHtml(message.body_html)
                          ? htmlToText(message.body_html)
                          : cleanMessageBody(message.body_text)}
                      </div>
                    </details>
                  </div>
                ) : message.body_html && isValidEmailHtml(message.body_html) ? (
                  <div
                    style={{
                      fontSize: '14px',
                      color: 'var(--text-primary)',
                      lineHeight: '1.6',
                      wordBreak: 'break-word',
                    }}
                    className="email-html-content"
                    dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(message.body_html) }}
                  />
                ) : (
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
                )}

                {/* Botao de traduzir e info do email */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {message.direction === 'inbound' ? `De: ${message.from_email}` : `Para: ${message.to_email}`}
                  </div>
                  {!translations[message.id] && (
                    <button
                      type="button"
                      onClick={() => {
                        const text = message.body_html && isValidEmailHtml(message.body_html)
                          ? htmlToText(message.body_html)
                          : cleanMessageBody(message.body_text)
                        handleTranslate(message.id, text)
                      }}
                      disabled={translatingId === message.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-secondary)',
                        fontSize: '12px',
                        cursor: translatingId === message.id ? 'not-allowed' : 'pointer',
                        opacity: translatingId === message.id ? 0.7 : 1,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {translatingId === message.id ? (
                        <>
                          <span style={{
                            width: '10px',
                            height: '10px',
                            border: '2px solid var(--border-color)',
                            borderTopColor: 'var(--text-secondary)',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                          }} />
                          Traduzindo...
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 8l6 6" />
                            <path d="M4 14l6-6 2-3" />
                            <path d="M2 5h12" />
                            <path d="M7 2h1" />
                            <path d="M22 22l-5-10-5 10" />
                            <path d="M14 18h6" />
                          </svg>
                          Traduzir
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* CSS para animação do spinner e conteúdo HTML de email */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .email-html-content {
          max-width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
        }
        .email-html-content * {
          max-width: 100% !important;
          box-sizing: border-box;
        }
        /* Forçar cor do texto para o tema atual - evita texto preto em fundo escuro */
        .email-html-content,
        .email-html-content * {
          color: var(--text-primary) !important;
        }
        .email-html-content a {
          color: var(--accent) !important;
        }
        .email-html-content img {
          max-width: 100% !important;
          height: auto !important;
          border-radius: 8px;
          margin: 8px 0;
          display: block;
        }
        .email-html-content a {
          color: var(--accent);
          text-decoration: underline;
          word-break: break-all;
        }
        .email-html-content table {
          max-width: 100% !important;
          width: auto !important;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .email-html-content td, .email-html-content th {
          padding: 4px 8px;
          word-break: break-word;
          overflow-wrap: break-word;
        }
        .email-html-content p {
          margin: 8px 0;
        }
        .email-html-content br + br {
          display: none;
        }
        .email-html-content div {
          max-width: 100% !important;
        }
        .email-html-content pre, .email-html-content code {
          white-space: pre-wrap;
          word-break: break-word;
          max-width: 100%;
          overflow-x: auto;
        }
        /* Prevenir que estilos inline do email quebrem o layout */
        .email-html-content [style*="width"] {
          max-width: 100% !important;
        }
        .email-html-content [style*="position: fixed"],
        .email-html-content [style*="position:fixed"] {
          position: relative !important;
        }
      `}</style>
    </div>
  )
}
