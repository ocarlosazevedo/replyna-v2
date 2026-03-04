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

export default function StepReturnReason({ fields, updateField, onNext, onBack, error, t }: Props) {
  const charCount = fields.returnDescription.length

  const returnReasons = [
    { value: '', label: t('reason.select') },
    { value: 'defective', label: t('reason.defective') },
    { value: 'not_as_described', label: t('reason.notAsDescribed') },
    { value: 'wrong_item', label: t('reason.wrongItem') },
    { value: 'quality', label: t('reason.quality') },
    { value: 'size_fit', label: t('reason.sizeFit') },
    { value: 'changed_mind', label: t('reason.changedMind') },
    { value: 'late_delivery', label: t('reason.lateDelivery') },
    { value: 'missing_parts', label: t('reason.missingParts') },
    { value: 'packaging_damaged', label: t('reason.packagingDamaged') },
    { value: 'other', label: t('reason.other') },
  ]

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <ProgressBar step={4} t={t} />

      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
        {t('reason.title')}
      </div>
      <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '28px', lineHeight: '1.5' }}>
        {t('reason.desc')}
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          {t('reason.mainReason')} <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <select
          value={fields.returnReason}
          onChange={e => updateField('returnReason', e.target.value)}
          style={selectStyle}
        >
          {returnReasons.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          {t('reason.detailedDesc')} <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <textarea
          translate="no"
          value={fields.returnDescription}
          onChange={e => updateField('returnDescription', e.target.value)}
          placeholder={t('reason.descPlaceholder')}
          style={textareaStyle}
        />
        <div style={{
          fontSize: '12px',
          textAlign: 'right',
          marginTop: '6px',
          color: charCount < 100 ? '#ef4444' : 'var(--text-secondary)',
        }}>
          {charCount}/100 {t('reason.minChars')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '32px' }}>
        <button onClick={onBack} style={secondaryBtnStyle}>{t('common.back')}</button>
        <button onClick={onNext} style={primaryBtnStyle}>{t('common.continue')}</button>
      </div>
    </div>
  )
}
