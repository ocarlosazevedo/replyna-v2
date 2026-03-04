import { useRef, useState, useCallback } from 'react'
import { Lock } from 'lucide-react'
import SignaturePad from './SignaturePad'
import ProgressBar from './ProgressBar'
import type { FormFields, SignaturePadHandle } from './types'
import { primaryBtnStyle, secondaryBtnStyle, errorBoxStyle } from './constants'
import type { TFunction } from './i18n'

interface Props {
  fields: FormFields
  updateField: <K extends keyof FormFields>(key: K, value: FormFields[K]) => void
  setSignature: (sig: string | null) => void
  onSubmit: () => void
  onBack: () => void
  error: string | null
  t: TFunction
  termsText: string
}

export default function StepTermsSignature({ fields, updateField, setSignature, onSubmit, onBack, error, t, termsText }: Props) {
  const signatureRef = useRef<SignaturePadHandle>(null)
  const [checkboxesEnabled, setCheckboxesEnabled] = useState(false)

  const handleTermsScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 20
    if (isAtBottom) setCheckboxesEnabled(true)
  }, [])

  const handleSubmit = () => {
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      setSignature(signatureRef.current.toDataURL())
    }
    onSubmit()
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <ProgressBar step={9} t={t} />

      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
        {t('terms.title')}
      </div>
      <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '28px', lineHeight: '1.5' }}>
        {t('terms.desc')}
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      {/* Terms box */}
      <div
        onScroll={handleTermsScroll}
        style={{
          maxHeight: '400px',
          overflowY: 'auto',
          padding: '24px',
          backgroundColor: 'var(--bg-primary)',
          border: '1.5px solid var(--border-color)',
          borderRadius: '10px',
          fontSize: '14px',
          lineHeight: '1.6',
          marginBottom: '24px',
          color: 'var(--text-primary)',
          whiteSpace: 'pre-wrap',
        }}
      >
        {termsText}
      </div>

      {!checkboxesEnabled && (
        <div style={{ fontSize: '13px', color: 'var(--accent)', marginBottom: '16px', textAlign: 'center' }}>
          {t('terms.scrollHint')}
        </div>
      )}

      {/* Checkboxes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {[
          { key: 'acceptTerms1' as const, label: t('terms.accept1') },
          { key: 'acceptTerms2' as const, label: t('terms.accept2') },
          { key: 'acceptTerms3' as const, label: t('terms.accept3') },
        ].map(item => (
          <div key={item.key} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '16px',
            borderRadius: '10px',
            backgroundColor: 'var(--bg-primary)',
            border: '1.5px solid var(--border-color)',
            opacity: checkboxesEnabled ? 1 : 0.5,
            transition: 'opacity 0.3s ease',
          }}>
            <input
              type="checkbox"
              checked={fields[item.key]}
              onChange={e => updateField(item.key, e.target.checked)}
              disabled={!checkboxesEnabled}
              style={{ marginTop: '2px', width: '20px', height: '20px', cursor: checkboxesEnabled ? 'pointer' : 'not-allowed', accentColor: 'var(--accent)' }}
            />
            <label style={{ flex: 1, fontSize: '14px', lineHeight: '1.5', color: 'var(--text-primary)', cursor: checkboxesEnabled ? 'pointer' : 'default' }}>
              {item.label}
            </label>
          </div>
        ))}
      </div>

      {/* Signature */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '12px' }}>
          {t('terms.signature')} <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <SignaturePad ref={signatureRef} />
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '32px' }}>
        <button onClick={onBack} style={secondaryBtnStyle}>{t('common.back')}</button>
        <button onClick={handleSubmit} style={{
          ...primaryBtnStyle,
          padding: '14px 32px',
          fontSize: '16px',
          minWidth: '220px',
        }}>
          <Lock size={16} />
          {t('terms.submitBtn')}
        </button>
      </div>
      <div style={{
        textAlign: 'center',
        marginTop: '12px',
        fontSize: '11px',
        color: 'var(--text-secondary)',
        opacity: 0.7,
      }}>
        {t('terms.submitHint')}
      </div>
    </div>
  )
}
