import { Link } from 'react-router-dom'
import { AlertTriangle, X, ShoppingBag, ExternalLink } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface ShopifyErrorBannerProps {
  shopIds: string[]
}

interface CircuitBreakerInfo {
  shop_id: string
  shop_name: string
  state: 'open' | 'half_open'
  failure_count: number
  last_failure_at: string
  next_attempt_at: string | null
}

export default function ShopifyErrorBanner({ shopIds }: ShopifyErrorBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [circuitInfo, setCircuitInfo] = useState<CircuitBreakerInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (shopIds.length === 0) {
      setLoading(false)
      return
    }

    loadCircuitBreakerStatus()
  }, [shopIds])

  const loadCircuitBreakerStatus = async () => {
    try {
      // Buscar circuit breakers abertos para Shopify
      const { data: circuits, error: circuitError } = await supabase
        .from('circuit_breakers')
        .select('shop_id, state, failure_count, last_failure_at, next_attempt_at')
        .in('shop_id', shopIds)
        .eq('service', 'shopify')
        .in('state', ['open', 'half_open'])

      if (circuitError || !circuits || circuits.length === 0) {
        setLoading(false)
        return
      }

      // Buscar nomes das lojas
      const shopIdsWithIssues = circuits.map(c => c.shop_id)
      const { data: shops } = await supabase
        .from('shops')
        .select('id, name')
        .in('id', shopIdsWithIssues)

      const shopNames: Record<string, string> = {}
      shops?.forEach(s => {
        shopNames[s.id] = s.name
      })

      // Pegar o primeiro circuit breaker com problema (geralmente vai ter só um)
      const firstCircuit = circuits[0]
      setCircuitInfo({
        shop_id: firstCircuit.shop_id,
        shop_name: shopNames[firstCircuit.shop_id] || 'Sua loja',
        state: firstCircuit.state as 'open' | 'half_open',
        failure_count: firstCircuit.failure_count,
        last_failure_at: firstCircuit.last_failure_at,
        next_attempt_at: firstCircuit.next_attempt_at,
      })
    } catch (err) {
      console.error('Erro ao verificar circuit breakers:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading || dismissed || !circuitInfo) {
    return null
  }

  const backgroundColor = 'rgba(239, 68, 68, 0.1)' // Vermelho
  const borderColor = 'rgba(239, 68, 68, 0.3)'
  const iconColor = '#ef4444'
  const textColor = '#dc2626'

  // Formatar data da ultima falha
  const lastFailureDate = circuitInfo.last_failure_at
    ? new Date(circuitInfo.last_failure_at).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'recentemente'

  // Link para configuracao da loja
  const editLink = `/shops/${circuitInfo.shop_id}/edit?step=2`

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
            <ShoppingBag size={14} />
            Shopify offline
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
            marginBottom: '4px',
            lineHeight: '1.4',
          }}
        >
          A loja <strong>{circuitInfo.shop_name}</strong> está com problemas na integração Shopify.
        </p>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '13px',
            margin: 0,
            lineHeight: '1.4',
          }}
        >
          Os emails que precisam de dados de pedidos <strong>não estão sendo respondidos</strong> automaticamente.
          {circuitInfo.state === 'half_open' && ' O sistema está tentando reconectar...'}
        </p>
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '11px',
            margin: 0,
            marginTop: '8px',
          }}
        >
          Última falha: {lastFailureDate} ({circuitInfo.failure_count} tentativas)
        </p>
      </div>

      {/* Action button */}
      <div style={{ paddingLeft: '32px' }}>
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
          Verificar
          <ExternalLink size={14} />
        </Link>
      </div>
    </div>
  )
}
