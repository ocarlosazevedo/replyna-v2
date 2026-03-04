import type { Order } from './types'
import { primaryBtnStyle, secondaryBtnStyle, errorBoxStyle } from './constants'

interface Props {
  orders: Order[]
  selectedOrder: Order | null
  onSelect: (index: number) => void
  onNext: () => void
  onBack: () => void
  error: string | null
}

export default function StepOrderSelection({ orders, selectedOrder, onSelect, onNext, onBack, error }: Props) {
  const getBadgeStyle = (status: string): React.CSSProperties => {
    const map: Record<string, { bg: string; color: string }> = {
      pending: { bg: '#fef3cd', color: '#856404' },
      reviewing: { bg: '#cfe2ff', color: '#084298' },
      approved: { bg: 'rgba(34, 197, 94, 0.15)', color: '#16a34a' },
      denied: { bg: '#f8d7da', color: '#842029' },
    }
    const s = Object.entries(map).find(([k]) => status.includes(k))
    const colors = s ? s[1] : { bg: '#e5e7eb', color: '#6b7280' }
    return {
      display: 'inline-block',
      padding: '4px 10px',
      fontSize: '11px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      borderRadius: '6px',
      backgroundColor: colors.bg,
      color: colors.color,
    }
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
        Selecione seu Pedido
      </div>
      <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '28px', lineHeight: '1.5' }}>
        Escolha o pedido para o qual deseja solicitar a devolução.
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      <div>
        {orders.map((order, index) => {
          const hasReturn = order.existing_return_status !== null
          const isSelected = selectedOrder?.shopify_order_id === order.shopify_order_id
          const orderDate = new Date(order.order_date).toLocaleDateString()

          return (
            <div
              key={order.shopify_order_id}
              onClick={() => !hasReturn && onSelect(index)}
              style={{
                padding: '20px',
                backgroundColor: isSelected ? 'rgba(70, 114, 236, 0.06)' : 'var(--bg-card)',
                border: isSelected ? '2px solid var(--accent)' : '1.5px solid var(--border-color)',
                borderRadius: '12px',
                marginBottom: '12px',
                cursor: hasReturn ? 'not-allowed' : 'pointer',
                opacity: hasReturn ? 0.6 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {order.order_number}
                </span>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {orderDate}
                </span>
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                {order.line_items.slice(0, 2).map(i => i.title).join(', ')}
                {order.line_items.length > 2 && ` +${order.line_items.length - 2} mais`}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
                {order.currency} {parseFloat(order.total).toFixed(2)}
              </div>
              {hasReturn && (
                <div style={{ marginTop: '8px' }}>
                  <span style={getBadgeStyle(order.existing_return_status!)}>
                    Devolução {order.existing_return_status!.replace('_', ' ')}
                  </span>
                </div>
              )}
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                de {order.store_name}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '32px' }}>
        <button onClick={onBack} style={secondaryBtnStyle}>Voltar</button>
        <button
          onClick={onNext}
          disabled={!selectedOrder}
          style={{
            ...primaryBtnStyle,
            opacity: selectedOrder ? 1 : 0.5,
            cursor: selectedOrder ? 'pointer' : 'not-allowed',
          }}
        >
          Continuar
        </button>
      </div>
    </div>
  )
}
