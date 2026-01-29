import { Link } from 'react-router-dom'
import { Lightbulb, X } from 'lucide-react'
import { useState, useEffect } from 'react'

const STORAGE_KEY_PREFIX = 'replyna_seen_retention_coupon_tip_'

interface FeatureTipBannerProps {
  shopId?: string | null
  userId?: string | null
}

export default function FeatureTipBanner({ shopId, userId }: FeatureTipBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [hasSeen, setHasSeen] = useState(true) // Start as true to avoid flash

  useEffect(() => {
    if (!userId) return
    const seen = localStorage.getItem(STORAGE_KEY_PREFIX + userId)
    setHasSeen(seen === 'true')
  }, [userId])

  if (dismissed || hasSeen || !userId) return null

  const handleDismiss = () => {
    setDismissed(true)
  }

  return (
    <div
      style={{
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <Lightbulb size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: '2px' }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              color: '#2563eb',
              fontWeight: 600,
              fontSize: '14px',
              margin: 0,
            }}
          >
            Nova funcionalidade: Cupom de retenção
          </p>
        </div>

        <button
          onClick={handleDismiss}
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

      <div style={{ paddingLeft: '32px' }}>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '13px',
            margin: 0,
            lineHeight: '1.4',
          }}
        >
          Agora você pode configurar um cupom de desconto que a IA oferecerá automaticamente para clientes que desejam cancelar ou devolver pedidos.
        </p>
      </div>

      {shopId && (
        <div style={{ paddingLeft: '32px' }}>
          <Link
            to={`/shops/${shopId}`}
            style={{
              backgroundColor: '#3b82f6',
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
            Configurar cupom
          </Link>
        </div>
      )}
    </div>
  )
}

export function markRetentionCouponTipAsSeen(userId: string) {
  if (userId) {
    localStorage.setItem(STORAGE_KEY_PREFIX + userId, 'true')
  }
}
