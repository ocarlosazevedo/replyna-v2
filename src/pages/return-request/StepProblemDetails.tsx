import ProgressBar from './ProgressBar'
import type { FormFields } from './types'
import { WHEN_NOTICED_OPTIONS, TRIED_RESOLVE_OPTIONS, PRODUCT_USED_OPTIONS, selectStyle, textareaStyle, primaryBtnStyle, secondaryBtnStyle, errorBoxStyle } from './constants'

interface Props {
  fields: FormFields
  updateField: <K extends keyof FormFields>(key: K, value: FormFields[K]) => void
  onNext: () => void
  onBack: () => void
  error: string | null
}

export default function StepProblemDetails({ fields, updateField, onNext, onBack, error }: Props) {
  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <ProgressBar step={5} />

      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
        Detalhes do Problema
      </div>
      <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '28px', lineHeight: '1.5' }}>
        Forneça mais informações sobre o problema.
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Quando você notou o problema pela primeira vez? <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <select
          value={fields.whenNoticed}
          onChange={e => updateField('whenNoticed', e.target.value)}
          style={selectStyle}
        >
          {WHEN_NOTICED_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Você tentou resolver o problema por conta própria? <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <select
          value={fields.triedResolve}
          onChange={e => updateField('triedResolve', e.target.value)}
          style={selectStyle}
        >
          {TRIED_RESOLVE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Se sim, descreva o que você tentou:
        </label>
        <textarea
          value={fields.resolutionAttempts}
          onChange={e => updateField('resolutionAttempts', e.target.value)}
          placeholder="Descreva as medidas que você tomou para resolver o problema..."
          style={textareaStyle}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          O produto foi utilizado? <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <select
          value={fields.productUsed}
          onChange={e => updateField('productUsed', e.target.value)}
          style={selectStyle}
        >
          {PRODUCT_USED_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '32px' }}>
        <button onClick={onBack} style={secondaryBtnStyle}>Voltar</button>
        <button onClick={onNext} style={primaryBtnStyle}>Continuar</button>
      </div>
    </div>
  )
}
