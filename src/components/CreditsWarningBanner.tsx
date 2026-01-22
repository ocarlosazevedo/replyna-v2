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
        padding: '16px 20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}
    >
      <AlertTriangle size={24} color={iconColor} style={{ flexShrink: 0 }} />

      <div style={{ flex: 1 }}>
        <p
          style={{
            color: textColor,
            fontWeight: 600,
            fontSize: '15px',
            margin: 0,
            marginBottom: '4px',
          }}
        >
          Seus créditos acabaram!
        </p>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '14px',
            margin: 0,
          }}
        >
          Você usou todos os seus créditos. Novos emails não estão sendo respondidos
          automaticamente.
        </p>
      </div>

      <Link
        to="/account"
        style={{
          backgroundColor: '#ef4444',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '14px',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Fazer upgrade
      </Link>

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
