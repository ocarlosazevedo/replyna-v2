import { Link } from 'react-router-dom'
import { AlertTriangle, X, Mail, ExternalLink } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface EmailErrorBannerProps {
  shopIds: string[]
}

interface ShopEmailError {
  shop_id: string
  shop_name: string
  email_sync_error: string
  imap_user: string
  last_email_sync_at: string | null
}

export default function EmailErrorBanner({ shopIds }: EmailErrorBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [shopsWithErrors, setShopsWithErrors] = useState<ShopEmailError[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (shopIds.length === 0) {
      setLoading(false)
      return
    }

    loadEmailErrors()
  }, [shopIds])

  const loadEmailErrors = async () => {
    try {
      // Buscar lojas com erro de sincronizacao de email
      const { data: shops, error } = await supabase
        .from('shops')
        .select('id, name, email_sync_error, imap_user, last_email_sync_at')
        .in('id', shopIds)
        .not('email_sync_error', 'is', null)
        .neq('email_sync_error', '')

      if (error || !shops || shops.length === 0) {
        setLoading(false)
        return
      }

      setShopsWithErrors(
        shops.map((s) => ({
          shop_id: s.id,
          shop_name: s.name,
          email_sync_error: s.email_sync_error,
          imap_user: s.imap_user,
          last_email_sync_at: s.last_email_sync_at,
        }))
      )
    } catch (err) {
      console.error('Erro ao verificar erros de email:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading || dismissed || shopsWithErrors.length === 0) {
    return null
  }

  const backgroundColor = 'rgba(239, 68, 68, 0.1)' // Vermelho
  const borderColor = 'rgba(239, 68, 68, 0.3)'
  const iconColor = '#ef4444'
  const textColor = '#dc2626'

  // Formatar data da ultima tentativa
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'nunca'
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Se tem mais de uma loja com erro, mostrar lista
  const firstShop = shopsWithErrors[0]
  const hasMultiple = shopsWithErrors.length > 1

  // Link para configuracao da loja (step 3 = Email)
  const editLink = `/shops/${firstShop.shop_id}/edit?step=3`

  return (
    <div
      style={{
        backgroundColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Header row with icon, title and dismiss button */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <AlertTriangle size={20} color={iconColor} style={{ flexShrink: 0, marginTop: '2px' }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              color: textColor,
              fontWeight: 600,
              fontSize: '14px',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Mail size={14} />
            {hasMultiple ? `${shopsWithErrors.length} lojas com erro de email` : 'Erro de conexao de email'}
          </p>
        </div>

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
            flexShrink: 0,
          }}
          title="Dispensar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div style={{ paddingLeft: '32px' }}>
        {hasMultiple ? (
          <>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '13px',
                margin: 0,
                marginBottom: '8px',
                lineHeight: '1.4',
              }}
            >
              As seguintes lojas estao com problemas na conexao de email:
            </p>
            <ul style={{ margin: '0 0 8px 0', padding: '0 0 0 16px' }}>
              {shopsWithErrors.map((shop) => (
                <li
                  key={shop.shop_id}
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '13px',
                    marginBottom: '4px',
                  }}
                >
                  <strong>{shop.shop_name}</strong> ({shop.imap_user})
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '13px',
                margin: 0,
                marginBottom: '4px',
                lineHeight: '1.4',
              }}
            >
              A loja <strong>{firstShop.shop_name}</strong> esta com erro na conexao de email.
            </p>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '13px',
                margin: 0,
                lineHeight: '1.4',
              }}
            >
              Os emails <strong>nao estao sendo recebidos</strong> para resposta automatica.
            </p>
          </>
        )}
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '11px',
            margin: 0,
            marginTop: '8px',
          }}
        >
          Verifique se as credenciais IMAP/SMTP estao corretas. Ultima tentativa: {formatDate(firstShop.last_email_sync_at)}
        </p>
      </div>

      {/* Action button */}
      <div style={{ paddingLeft: '32px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Link
          to={editLink}
          style={{
            backgroundColor: '#ef4444',
            color: 'white',
            padding: '8px 14px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13px',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {hasMultiple ? 'Corrigir lojas' : 'Corrigir credenciais'}
          <ExternalLink size={14} />
        </Link>
      </div>
    </div>
  )
}
