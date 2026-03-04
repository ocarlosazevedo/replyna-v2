import ProgressBar from './ProgressBar'
import type { Order, FormFields } from './types'
import type { TFunction } from './i18n'
import { inputStyle, primaryBtnStyle, secondaryBtnStyle, errorBoxStyle } from './constants'

interface Props {
  order: Order
  fields: FormFields
  updateField: <K extends keyof FormFields>(key: K, value: FormFields[K]) => void
  onNext: () => void
  onBack: () => void
  error: string | null
  t: TFunction
}

export default function StepOrderConfirmation({ order, fields, updateField, onNext, onBack, error, t }: Props) {
  const orderDate = new Date(order.order_date).toLocaleDateString()

  // Convert internal YYYY-MM-DD to display DD/MM/YYYY
  const displayDate = fields.receiveDate
    ? fields.receiveDate.split('-').reverse().join('/')
    : ''

  const handleDateChange = (value: string) => {
    // Auto-format: add slashes as user types
    const digits = value.replace(/\D/g, '').slice(0, 8)
    let formatted = digits
    if (digits.length > 2) formatted = digits.slice(0, 2) + '/' + digits.slice(2)
    if (digits.length > 4) formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4)

    // When complete (DD/MM/YYYY), store as YYYY-MM-DD internally
    if (digits.length === 8) {
      const day = digits.slice(0, 2)
      const month = digits.slice(2, 4)
      const year = digits.slice(4, 8)
      updateField('receiveDate', `${year}-${month}-${day}`)
    } else {
      // Clear internal value while typing
      updateField('receiveDate', formatted)
    }
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <ProgressBar step={3} t={t} />

      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
        {t('orderConfirm.title')}
      </div>
      <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '28px', lineHeight: '1.5' }}>
        {t('orderConfirm.desc')}
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      {/* Order details card */}
      <div style={{
        padding: '20px',
        backgroundColor: 'rgba(70, 114, 236, 0.06)',
        border: '2px solid var(--accent)',
        borderRadius: '12px',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {order.order_number}
          </span>
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{orderDate}</span>
        </div>

        <div style={{ marginTop: '12px' }}>
          {order.line_items.map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 0',
              borderBottom: i < order.line_items.length - 1 ? '1px solid var(--border-color)' : 'none',
            }}>
              {item.image && (
                <img
                  src={item.image}
                  alt={item.title}
                  style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '6px' }}
                />
              )}
              <div>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.title}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {t('orderConfirm.qty')}: {item.quantity} - {order.currency} {item.price}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '12px' }}>
          {t('orderConfirm.total')}: {order.currency} {parseFloat(order.total).toFixed(2)}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          {t('orderConfirm.receiveDate')} <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="text"
          value={displayDate}
          onChange={e => handleDateChange(e.target.value)}
          placeholder={t('orderConfirm.datePlaceholder')}
          maxLength={10}
          style={inputStyle}
        />
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '16px',
        borderRadius: '10px',
        backgroundColor: 'var(--bg-primary)',
        border: '1.5px solid var(--border-color)',
        marginBottom: '20px',
      }}>
        <input
          type="checkbox"
          id="confirmOrder"
          checked={fields.confirmOrder}
          onChange={e => updateField('confirmOrder', e.target.checked)}
          style={{ marginTop: '2px', width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--accent)' }}
        />
        <label htmlFor="confirmOrder" style={{ flex: 1, fontSize: '14px', lineHeight: '1.5', color: 'var(--text-primary)', cursor: 'pointer' }}>
          {t('orderConfirm.confirmOrder')}
        </label>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '32px' }}>
        <button onClick={onBack} style={secondaryBtnStyle}>{t('common.back')}</button>
        <button onClick={onNext} style={primaryBtnStyle}>{t('common.continue')}</button>
      </div>
    </div>
  )
}
