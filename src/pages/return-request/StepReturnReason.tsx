import ProgressBar from './ProgressBar'
import type { FormFields } from './types'
import { RETURN_REASONS, selectStyle, textareaStyle, primaryBtnStyle, secondaryBtnStyle, errorBoxStyle } from './constants'

interface Props {
  fields: FormFields
  updateField: <K extends keyof FormFields>(key: K, value: FormFields[K]) => void
  onNext: () => void
  onBack: () => void
  error: string | null
}

export default function StepReturnReason({ fields, updateField, onNext, onBack, error }: Props) {
  const charCount = fields.returnDescription.length

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <ProgressBar step={4} />

      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
        Motivo da Devolução
      </div>
      <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '28px', lineHeight: '1.5' }}>
        Nos ajude a entender por que você deseja devolver este pedido.
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Motivo Principal <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <select
          value={fields.returnReason}
          onChange={e => updateField('returnReason', e.target.value)}
          style={selectStyle}
        >
          {RETURN_REASONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Descrição Detalhada <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <textarea
          translate="no"
          value={fields.returnDescription}
          onChange={e => updateField('returnDescription', e.target.value)}
          placeholder="Descreva detalhadamente o problema que você teve..."
          style={textareaStyle}
        />
        <div style={{
          fontSize: '12px',
          textAlign: 'right',
          marginTop: '6px',
          color: charCount < 100 ? '#ef4444' : 'var(--text-secondary)',
        }}>
          {charCount}/100 mínimo
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '32px' }}>
        <button onClick={onBack} style={secondaryBtnStyle}>Voltar</button>
        <button onClick={onNext} style={primaryBtnStyle}>Continuar</button>
      </div>
    </div>
  )
}
