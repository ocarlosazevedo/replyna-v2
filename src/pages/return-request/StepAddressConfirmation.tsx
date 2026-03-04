import ProgressBar from './ProgressBar'
import type { FormFields, UploadsMap, UploadKey } from './types'
import type { TFunction } from './i18n'
import { inputStyle, primaryBtnStyle, secondaryBtnStyle, errorBoxStyle } from './constants'

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

export default function StepAddressConfirmation({ fields, updateField, onNext, onBack, error, t }: Props) {
  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <ProgressBar step={7} t={t} />

      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
        {t('address.title')}
      </div>
      <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '28px', lineHeight: '1.5' }}>
        {t('address.desc')}
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          {t('address.line1')} <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="text"
          value={fields.addressLine1}
          onChange={e => updateField('addressLine1', e.target.value)}
          placeholder={t('address.line1Placeholder')}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          {t('address.line2')}
        </label>
        <input
          type="text"
          value={fields.addressLine2}
          onChange={e => updateField('addressLine2', e.target.value)}
          placeholder={t('address.line2Placeholder')}
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
            {t('address.city')} <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            value={fields.city}
            onChange={e => updateField('city', e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
            {t('address.state')} <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            value={fields.state}
            onChange={e => updateField('state', e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
            {t('address.zipCode')} <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            value={fields.zipCode}
            onChange={e => updateField('zipCode', e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
            {t('address.country')} <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            value={fields.country}
            onChange={e => updateField('country', e.target.value)}
            style={inputStyle}
          />
        </div>
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
          id="confirmAddress"
          checked={fields.confirmAddress}
          onChange={e => updateField('confirmAddress', e.target.checked)}
          style={{ marginTop: '2px', width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--accent)' }}
        />
        <label htmlFor="confirmAddress" style={{ flex: 1, fontSize: '14px', lineHeight: '1.5', color: 'var(--text-primary)', cursor: 'pointer' }}>
          {t('address.confirmAddress')}
        </label>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '32px' }}>
        <button onClick={onBack} style={secondaryBtnStyle}>{t('common.back')}</button>
        <button onClick={onNext} style={primaryBtnStyle}>{t('common.continue')}</button>
      </div>
    </div>
  )
}
