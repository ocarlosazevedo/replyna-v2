import ProgressBar from './ProgressBar'
import type { FormFields, UploadsMap, UploadKey } from './types'
import { inputStyle, primaryBtnStyle, secondaryBtnStyle, errorBoxStyle } from './constants'
import type { TFunction } from './i18n'

interface Props {
  fields: FormFields
  updateField: <K extends keyof FormFields>(key: K, value: FormFields[K]) => void
  uploads: UploadsMap
  onFileUpload: (key: UploadKey, file: File) => void
  onRemoveUpload: (key: UploadKey) => void
  onNext: () => void
  onBack: () => void
  error: string | null
  t: TFunction
}

export default function StepIdentityVerification({ fields, updateField, onNext, onBack, error, t }: Props) {
  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <ProgressBar step={2} t={t} />

      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
        {t('identity.title')}
      </div>
      <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '28px', lineHeight: '1.5' }}>
        {t('identity.desc')}
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          {t('identity.fullName')} <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="text"
          value={fields.fullName}
          onChange={e => updateField('fullName', e.target.value)}
          placeholder={t('identity.fullNamePlaceholder')}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          {t('identity.phone')} <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="tel"
          value={fields.customerPhone}
          onChange={e => updateField('customerPhone', e.target.value)}
          placeholder={t('identity.phonePlaceholder')}
          style={inputStyle}
        />
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          {t('identity.phoneHint')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '32px' }}>
        <button onClick={onBack} style={secondaryBtnStyle}>{t('common.back')}</button>
        <button onClick={onNext} style={primaryBtnStyle}>{t('common.continue')}</button>
      </div>
    </div>
  )
}
