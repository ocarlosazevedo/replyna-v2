import ProgressBar from './ProgressBar'
import type { FormFields } from './types'
import type { TFunction } from './i18n'
import { selectStyle, textareaStyle, primaryBtnStyle, secondaryBtnStyle, errorBoxStyle } from './constants'

interface Props {
  fields: FormFields
  updateField: <K extends keyof FormFields>(key: K, value: FormFields[K]) => void
  onNext: () => void
  onBack: () => void
  error: string | null
  t: TFunction
}

export default function StepResolutionPreference({ fields, updateField, onNext, onBack, error, t }: Props) {
  const resolutionOptions = [
    { value: '', label: t('resolution.select') },
    { value: 'refund', label: t('resolution.refund') },
    { value: 'exchange', label: t('resolution.exchange') },
    { value: 'store_credit', label: t('resolution.storeCredit') },
  ]

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <ProgressBar step={8} t={t} />

      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
        {t('resolution.title')}
      </div>
      <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '28px', lineHeight: '1.5' }}>
        {t('resolution.desc')}
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          {t('resolution.preferred')} <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <select
          value={fields.resolutionType}
          onChange={e => updateField('resolutionType', e.target.value)}
          style={selectStyle}
        >
          {resolutionOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div style={{
        marginTop: '16px',
        padding: '14px 16px',
        backgroundColor: 'rgba(70, 114, 236, 0.08)',
        borderRadius: '10px',
        borderLeft: '4px solid var(--accent)',
        marginBottom: '24px',
      }}>
        <div style={{ fontSize: '13px', color: 'var(--accent)', lineHeight: '1.6' }}>
          <strong>{t('resolution.refundInfo')}</strong><br />
          {t('resolution.refundDesc')}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          {t('resolution.additionalComments')}
        </label>
        <textarea
          value={fields.additionalComments}
          onChange={e => updateField('additionalComments', e.target.value)}
          placeholder={t('resolution.commentsPlaceholder')}
          style={textareaStyle}
        />
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '32px' }}>
        <button onClick={onBack} style={secondaryBtnStyle}>{t('common.back')}</button>
        <button onClick={onNext} style={primaryBtnStyle}>{t('common.continue')}</button>
      </div>
    </div>
  )
}
