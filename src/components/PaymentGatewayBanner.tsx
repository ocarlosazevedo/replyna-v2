import { Link } from 'react-router-dom'
import { AlertTriangle, X, CreditCard } from 'lucide-react'
import { useState } from 'react'

export default function PaymentGatewayBanner() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const backgroundColor = 'rgba(245, 158, 11, 0.1)'
  const borderColor = 'rgba(245, 158, 11, 0.3)'
  const iconColor = '#f59e0b'
  const textColor = '#d97706'

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
            Ação necessária: atualize seu método de pagamento
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
            lineHeight: '1.5',
          }}
        >
          Alteramos nosso gateway de pagamento para melhorar sua experiência. Para que sua Replyna continue funcionando normalmente, é necessário adicionar seu cartão novamente na página da sua conta.
        </p>
      </div>

      {/* Action button */}
      <div style={{ paddingLeft: '32px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <Link
          to="/account"
          style={{
            backgroundColor: '#f59e0b',
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
          <CreditCard size={14} />
          Atualizar cartão
        </Link>
      </div>
    </div>
  )
}
