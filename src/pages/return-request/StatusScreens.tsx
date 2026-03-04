import { CheckCircle, XCircle, Download } from 'lucide-react'
import { primaryBtnStyle, secondaryBtnStyle } from './constants'
import type { TFunction } from './i18n'
import type { FormFields, Order } from './types'
import { generateReturnPDF } from './generateReturnPDF'

// ===================== Loading Screen =====================
interface LoadingProps {
  t: TFunction
}

export function LoadingScreen({ t }: LoadingProps) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 32px', animation: 'fadeIn 0.4s ease' }}>
      <div style={{
        width: '56px',
        height: '56px',
        border: '4px solid rgba(70, 114, 236, 0.2)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 24px',
      }} />
      <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
        {t('status.loading.title')}
      </div>
      <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
        {t('status.loading.desc')}
      </div>
    </div>
  )
}

// ===================== Success Screen =====================
interface SuccessProps {
  returnId: string | null
  customerEmail: string
  t: TFunction
  fields?: FormFields
  selectedOrder?: Order | null
  signature?: string | null
  shopName?: string | null
  locale?: string
}

export function SuccessScreen({ returnId, customerEmail, t, fields, selectedOrder, signature, shopName, locale }: SuccessProps) {
  const refNumber = returnId ? returnId.substring(0, 8).toUpperCase() : '--------'

  const handleDownloadPDF = () => {
    if (!returnId || !fields || !selectedOrder) return
    generateReturnPDF({
      returnId,
      customerEmail,
      fields,
      selectedOrder,
      signature: signature ?? null,
      shopName: shopName ?? null,
      locale: locale ?? 'pt',
    })
  }

  return (
    <div style={{ textAlign: 'center', padding: '48px 32px', animation: 'fadeIn 0.4s ease' }}>
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        backgroundColor: '#22c55e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
        boxShadow: '0 8px 24px rgba(34, 197, 94, 0.3)',
      }}>
        <CheckCircle size={44} color="#fff" />
      </div>

      <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
        {t('status.success.title')}
      </div>
      <div style={{
        fontSize: '15px',
        color: 'var(--text-secondary)',
        lineHeight: '1.6',
        maxWidth: '480px',
        margin: '0 auto',
      }}>
        {t('status.success.desc')}
      </div>

      <div style={{
        marginTop: '24px',
        padding: '16px',
        backgroundColor: 'var(--bg-primary)',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        display: 'inline-block',
      }}>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('status.success.refNumber')}</div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
          {refNumber}
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <button onClick={handleDownloadPDF} style={{ ...primaryBtnStyle, gap: '8px' }}>
          <Download size={18} />
          {t('status.success.downloadPdf')}
        </button>
      </div>
    </div>
  )
}

// ===================== Out of Period Screen =====================
interface OutOfPeriodProps {
  onReset: () => void
  t: TFunction
}

export function OutOfPeriodScreen({ onReset, t }: OutOfPeriodProps) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 32px', animation: 'fadeIn 0.4s ease' }}>
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        backgroundColor: '#ef4444',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
        boxShadow: '0 8px 24px rgba(239, 68, 68, 0.3)',
      }}>
        <XCircle size={44} color="#fff" />
      </div>

      <div style={{ fontSize: '28px', fontWeight: 700, color: '#ef4444', marginBottom: '16px' }}>
        {t('status.outOfPeriod.title')}
      </div>
      <div style={{
        fontSize: '15px',
        color: 'var(--text-secondary)',
        lineHeight: '1.6',
        maxWidth: '480px',
        margin: '0 auto',
      }}>
        {t('status.outOfPeriod.desc')}
      </div>

      <div style={{
        marginTop: '24px',
        padding: '16px',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderRadius: '10px',
        borderLeft: '4px solid #f59e0b',
        textAlign: 'left',
      }}>
        <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.6' }}>
          <strong>{t('status.outOfPeriod.policyTitle')}</strong><br />
          {t('status.outOfPeriod.policyDesc')}
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <button onClick={onReset} style={secondaryBtnStyle}>
          {t('status.outOfPeriod.backToStart')}
        </button>
      </div>
    </div>
  )
}
