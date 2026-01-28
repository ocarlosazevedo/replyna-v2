import { Link } from 'react-router-dom'
import { AlertTriangle, X, Mail, ExternalLink } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface EmailErrorsBannerProps {
  userId: string
  shopIds: string[]
}

interface ErrorSummary {
  total_failed: number
  main_error: string
  main_error_count: number
  shop_name: string
  shop_id: string
}

// Erros que indicam problemas de configuração (devem ser mostrados)
const CONFIG_ERRORS = [
  'Email do remetente inválido',
  'Email do remetente inválido ou ausente',
  'Corpo e assunto do email vazios',
  'Login failed',
  'Authentication failed',
  'Connection refused',
  'IMAP',
  'SMTP',
  'timeout',
  'Timeout',
]

// Erros que NÃO devem ser mostrados (são operacionais, não de configuração)
const IGNORE_ERRORS = [
  'créditos',
  'credits',
  'Usuário não encontrado',
  'rate limit',
  'Rate limit',
]

const ERROR_SOLUTIONS: Record<string, { title: string; description: string }> = {
  'Email do remetente inválido': {
    title: 'Emails chegando sem remetente',
    description: 'Os emails estão chegando sem o endereço do remetente. Isso pode acontecer com contas Zoho gratuitas ou configuração de servidor incorreta.',
  },
  'Email do remetente inválido ou ausente': {
    title: 'Emails chegando sem remetente',
    description: 'Os emails estão chegando sem o endereço do remetente. Verifique a configuração do seu provedor de email.',
  },
  'Corpo e assunto do email vazios': {
    title: 'Emails vazios',
    description: 'Os emails estão chegando sem conteúdo. Pode ser um problema de conexão com o servidor de email.',
  },
  'Login failed': {
    title: 'Falha na autenticação',
    description: 'Não foi possível conectar ao servidor de email. Verifique seu usuário e senha.',
  },
  'Authentication failed': {
    title: 'Falha na autenticação',
    description: 'Credenciais de email inválidas. Verifique usuário e senha.',
  },
}

function isConfigError(errorMessage: string): boolean {
  // Ignorar erros operacionais
  for (const ignore of IGNORE_ERRORS) {
    if (errorMessage.toLowerCase().includes(ignore.toLowerCase())) {
      return false
    }
  }
  // Verificar se é um erro de configuração
  for (const configError of CONFIG_ERRORS) {
    if (errorMessage.toLowerCase().includes(configError.toLowerCase())) {
      return true
    }
  }
  return false
}

export default function EmailErrorsBanner({ userId, shopIds }: EmailErrorsBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [errorSummary, setErrorSummary] = useState<ErrorSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId || shopIds.length === 0) {
      setLoading(false)
      return
    }

    loadErrorSummary()
  }, [userId, shopIds])

  const loadErrorSummary = async () => {
    try {
      // Buscar emails com falha nas últimas 24 horas
      const twentyFourHoursAgo = new Date()
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

      // Primeiro, buscar as conversas das lojas do usuário
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id, shop_id')
        .in('shop_id', shopIds)

      if (convError || !conversations || conversations.length === 0) {
        setLoading(false)
        return
      }

      const conversationIds = conversations.map(c => c.id)
      const shopIdByConversation: Record<string, string> = {}
      conversations.forEach(c => {
        shopIdByConversation[c.id] = c.shop_id
      })

      // Buscar mensagens com falha (status = 'failed' apenas, não 'pending_credits')
      const { data: failedMessages, error: msgError } = await supabase
        .from('messages')
        .select('id, status, error_message, conversation_id')
        .in('conversation_id', conversationIds)
        .eq('status', 'failed')
        .gte('created_at', twentyFourHoursAgo.toISOString())
        .not('error_message', 'is', null)
        .limit(200)

      if (msgError) {
        console.error('Erro ao buscar erros de email:', msgError)
        setLoading(false)
        return
      }

      if (!failedMessages || failedMessages.length === 0) {
        setLoading(false)
        return
      }

      // Buscar nomes das lojas
      const { data: shops } = await supabase
        .from('shops')
        .select('id, name')
        .in('id', shopIds)

      const shopNames: Record<string, string> = {}
      shops?.forEach(s => {
        shopNames[s.id] = s.name
      })

      // Agrupar por erro e encontrar o mais comum (apenas erros de configuração)
      const errorCounts: Record<string, { count: number; shop_name: string; shop_id: string }> = {}
      let totalConfigErrors = 0

      for (const msg of failedMessages) {
        const errorMsg = msg.error_message || 'Erro desconhecido'

        // Só contar se for erro de configuração
        if (!isConfigError(errorMsg)) {
          continue
        }

        totalConfigErrors++
        const shopId = shopIdByConversation[msg.conversation_id] || ''
        const shopName = shopNames[shopId] || 'Loja'

        if (!errorCounts[errorMsg]) {
          errorCounts[errorMsg] = {
            count: 0,
            shop_name: shopName,
            shop_id: shopId,
          }
        }
        errorCounts[errorMsg].count++
      }

      // Se não há erros de configuração, não mostrar banner
      if (totalConfigErrors === 0) {
        setLoading(false)
        return
      }

      // Encontrar o erro mais comum
      let mainError = ''
      let mainErrorCount = 0
      let shopName = ''
      let shopId = ''

      for (const [error, data] of Object.entries(errorCounts)) {
        if (data.count > mainErrorCount) {
          mainError = error
          mainErrorCount = data.count
          shopName = data.shop_name
          shopId = data.shop_id
        }
      }

      setErrorSummary({
        total_failed: totalConfigErrors,
        main_error: mainError,
        main_error_count: mainErrorCount,
        shop_name: shopName,
        shop_id: shopId,
      })
    } catch (err) {
      console.error('Erro ao carregar resumo de erros:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading || dismissed || !errorSummary || errorSummary.total_failed === 0) {
    return null
  }

  const solution = ERROR_SOLUTIONS[errorSummary.main_error] || {
    title: 'Erros no processamento de emails',
    description: errorSummary.main_error,
  }

  const backgroundColor = 'rgba(245, 158, 11, 0.1)' // Amarelo/laranja
  const borderColor = 'rgba(245, 158, 11, 0.3)'
  const iconColor = '#f59e0b'
  const textColor = '#d97706'

  // Construir o link corretamente
  const editLink = errorSummary.shop_id ? `/shops/${errorSummary.shop_id}/edit?step=3` : '/shops'

  return (
    <div
      style={{
        backgroundColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
      }}
    >
      <AlertTriangle size={24} color={iconColor} style={{ flexShrink: 0, marginTop: '2px' }} />

      <div style={{ flex: 1 }}>
        <p
          style={{
            color: textColor,
            fontWeight: 600,
            fontSize: '15px',
            margin: 0,
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Mail size={16} />
          {errorSummary.total_failed} email{errorSummary.total_failed > 1 ? 's' : ''} com falha nas últimas 24h
        </p>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '14px',
            margin: 0,
            marginBottom: '8px',
          }}
        >
          <strong>{solution.title}</strong> na loja <strong>{errorSummary.shop_name}</strong>
        </p>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '13px',
            margin: 0,
            lineHeight: '1.5',
          }}
        >
          {solution.description}
        </p>
      </div>

      {errorSummary.shop_id && (
        <Link
          to={editLink}
          style={{
            backgroundColor: '#f59e0b',
            color: 'white',
            padding: '10px 16px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13px',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          Verificar config
          <ExternalLink size={14} />
        </Link>
      )}

      <button
        onClick={() => setDismissed(true)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Dispensar"
      >
        <X size={20} />
      </button>
    </div>
  )
}
