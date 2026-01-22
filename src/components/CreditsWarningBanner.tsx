import { Link } from 'react-router-dom'
import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'

interface CreditsWarningBannerProps {
  emailsUsed: number
  emailsLimit: number | null  // null = ilimitado
  plan: string
  extraEmailsPurchased?: number  // Emails extras comprados
  extraEmailsUsed?: number  // Emails extras usados
}

export default function CreditsWarningBanner({
  emailsUsed,
  emailsLimit,
  plan,
  extraEmailsPurchased = 0,
  extraEmailsUsed = 0,
}: CreditsWarningBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  // Não mostrar para planos ilimitados (emailsLimit === null)
  if (emailsLimit === null) return null

  // Calcular créditos extras disponíveis
  const extraCreditsAvailable = extraEmailsPurchased - extraEmailsUsed

  // Total de créditos disponíveis = limite do plano + extras disponíveis
  const totalCreditsAvailable = emailsLimit + extraCreditsAvailable

  const percentUsed = totalCreditsAvailable > 0 ? (emailsUsed / totalCreditsAvailable) * 100 : 0

  // Só está "exausto" se usou TODOS os créditos (plano + extras)
  const isExhausted = emailsUsed >= totalCreditsAvailable && extraCreditsAvailable <= 0

  // Está "baixo" se usou 80% do total e ainda não exauriu
  const isLow = percentUsed >= 80 && !isExhausted

  // Não mostrar se ainda tem bastante crédito
  if (!isExhausted && !isLow) return null

  const backgroundColor = isExhausted
    ? 'rgba(239, 68, 68, 0.1)' // Vermelho
    : 'rgba(245, 158, 11, 0.1)' // Amarelo

  const borderColor = isExhausted
    ? 'rgba(239, 68, 68, 0.3)'
    : 'rgba(245, 158, 11, 0.3)'

  const iconColor = isExhausted ? '#ef4444' : '#f59e0b'

  const textColor = isExhausted ? '#dc2626' : '#d97706'

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
          {isExhausted
            ? 'Seus créditos acabaram!'
            : 'Seus créditos estão acabando'}
        </p>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '14px',
            margin: 0,
          }}
        >
          {isExhausted ? (
            <>
              Você usou todos os <strong>{emailsLimit}</strong> emails do plano{' '}
              <strong>{plan}</strong>. Novos emails não estão sendo respondidos
              automaticamente.
            </>
          ) : (
            <>
              Você já usou <strong>{emailsUsed}</strong> de{' '}
              <strong>{emailsLimit}</strong> emails ({Math.round(percentUsed)}
              %).
            </>
          )}
        </p>
      </div>

      <Link
        to="/account"
        style={{
          backgroundColor: isExhausted ? '#ef4444' : '#f59e0b',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '14px',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {isExhausted ? 'Fazer upgrade' : 'Ver planos'}
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
