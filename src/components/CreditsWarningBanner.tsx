import { Link } from 'react-router-dom'
import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'

interface CreditsWarningBannerProps {
  emailsUsed: number
  emailsLimit: number | null  // null = ilimitado
  extraEmailsPurchased?: number  // Emails extras comprados
}

export default function CreditsWarningBanner({
  emailsUsed,
  emailsLimit,
  extraEmailsPurchased = 0,
}: CreditsWarningBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  // Não mostrar para planos ilimitados (emailsLimit === null)
  if (emailsLimit === null) return null

  // Total de créditos = limite do plano + extras comprados
  const totalCreditsAvailable = emailsLimit + extraEmailsPurchased

  // Só está "exausto" se usou TODOS os créditos (plano + extras)
  const isExhausted = emailsUsed >= totalCreditsAvailable

  // Só mostrar quando acabar completamente
  if (!isExhausted) return null

  const backgroundColor = 'rgba(239, 68, 68, 0.1)' // Vermelho
  const borderColor = 'rgba(239, 68, 68, 0.3)'
  const iconColor = '#ef4444'
  const textColor = '#dc2626'

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
            }}
          >
            Seus créditos acabaram!
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
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '13px',
            margin: 0,
            lineHeight: '1.4',
          }}
        >
          Você usou todos os seus créditos. Novos emails não estão sendo respondidos automaticamente.
        </p>
      </div>

      {/* Action button */}
      <div style={{ paddingLeft: '32px' }}>
        <Link
          to="/account"
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
          }}
        >
          Fazer upgrade
        </Link>
      </div>
    </div>
  )
}
