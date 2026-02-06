import { Link } from 'react-router-dom'
import { Sparkles, X } from 'lucide-react'
import { useState, useEffect } from 'react'

const STORAGE_KEY_PREFIX = 'replyna_seen_ai_instructions_tip_'

interface AIInstructionsTipBannerProps {
  shopId?: string | null
  userId?: string | null
}

export default function AIInstructionsTipBanner({ shopId, userId }: AIInstructionsTipBannerProps) {
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
    if (userId) {
      localStorage.setItem(STORAGE_KEY_PREFIX + userId, 'true')
    }
  }

  return (
    <div
      style={{
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <Sparkles size={20} color="#8b5cf6" style={{ flexShrink: 0, marginTop: '2px' }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              color: '#7c3aed',
              fontWeight: 600,
              fontSize: '14px',
              margin: 0,
            }}
          >
            Nova funcionalidade: Instruções personalizadas para IA
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
            lineHeight: '1.5',
          }}
        >
          Agora você pode adicionar instruções específicas na descrição da loja para personalizar as respostas da IA.
          Por exemplo, explique particularidades dos seus produtos ou como a IA deve lidar com situações específicas do seu negócio.
        </p>
      </div>

      {shopId && (
        <div style={{ paddingLeft: '32px' }}>
          <Link
            to={`/shops/${shopId}`}
            style={{
              backgroundColor: '#8b5cf6',
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
            Configurar instruções
          </Link>
        </div>
      )}
    </div>
  )
}

export function markAIInstructionsTipAsSeen(userId: string) {
  if (userId) {
    localStorage.setItem(STORAGE_KEY_PREFIX + userId, 'true')
  }
}
