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

export default function StepProblemDetails({ fields, updateField, onNext, onBack, error, t }: Props) {
  const whenNoticedOptions = [
    { value: '', label: t('common.select') },
    { value: 'upon_delivery', label: t('whenNoticed.uponDelivery') },
    { value: 'opening_package', label: t('whenNoticed.openingPackage') },
    { value: 'first_use', label: t('whenNoticed.firstUse') },
    { value: 'after_few_uses', label: t('whenNoticed.afterFewUses') },
    { value: 'after_week', label: t('whenNoticed.afterWeek') },
  ]
  const triedResolveOptions = [
    { value: '', label: t('common.select') },
    { value: 'no', label: t('triedResolve.no') },
    { value: 'yes_failed', label: t('triedResolve.yesFailed') },
    { value: 'yes_partial', label: t('triedResolve.yesPartial') },
    { value: 'contacted_support', label: t('triedResolve.contactedSupport') },
  ]
  const productUsedOptions = [
    { value: '', label: t('common.select') },
    { value: 'no_sealed', label: t('productUsed.noSealed') },
    { value: 'no_opened', label: t('productUsed.noOpened') },
    { value: 'yes_once', label: t('productUsed.yesOnce') },
    { value: 'yes_few_times', label: t('productUsed.yesFewTimes') },
    { value: 'yes_regularly', label: t('productUsed.yesRegularly') },
  ]

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <ProgressBar step={5} t={t} />

      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
        {t('details.title')}
      </div>
      <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '28px', lineHeight: '1.5' }}>
        {t('details.desc')}
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          {t('details.whenNoticed')} <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <select
          value={fields.whenNoticed}
          onChange={e => updateField('whenNoticed', e.target.value)}
          style={selectStyle}
        >
          {whenNoticedOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          {t('details.triedResolve')} <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <select
          value={fields.triedResolve}
          onChange={e => updateField('triedResolve', e.target.value)}
          style={selectStyle}
        >
          {triedResolveOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          {t('details.ifYesDescribe')}
        </label>
        <textarea
          value={fields.resolutionAttempts}
          onChange={e => updateField('resolutionAttempts', e.target.value)}
          placeholder={t('details.resolutionPlaceholder')}
          style={textareaStyle}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          {t('details.productUsed')} <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <select
          value={fields.productUsed}
          onChange={e => updateField('productUsed', e.target.value)}
          style={selectStyle}
        >
          {productUsedOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '32px' }}>
        <button onClick={onBack} style={secondaryBtnStyle}>{t('common.back')}</button>
        <button onClick={onNext} style={primaryBtnStyle}>{t('common.continue')}</button>
      </div>
    </div>
  )
}
