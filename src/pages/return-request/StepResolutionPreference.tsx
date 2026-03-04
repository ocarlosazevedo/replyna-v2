import ProgressBar from './ProgressBar'
import type { FormFields } from './types'
import { RESOLUTION_OPTIONS, selectStyle, textareaStyle, primaryBtnStyle, secondaryBtnStyle, errorBoxStyle } from './constants'

interface Props {
  fields: FormFields
  updateField: <K extends keyof FormFields>(key: K, value: FormFields[K]) => void
  onNext: () => void
  onBack: () => void
  error: string | null
}

export default function StepResolutionPreference({ fields, updateField, onNext, onBack, error }: Props) {
  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <ProgressBar step={8} />

      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
        Preferência de Resolução
      </div>
      <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '28px', lineHeight: '1.5' }}>
        Como você gostaria que resolvêssemos esta questão?
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Resolução Preferida <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <select
          value={fields.resolutionType}
          onChange={e => updateField('resolutionType', e.target.value)}
          style={selectStyle}
        >
          {RESOLUTION_OPTIONS.map(opt => (
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
          <strong>Informação sobre Reembolso:</strong><br />
          Se aprovado, o reembolso será processado diretamente no seu método de pagamento original dentro de 5 a 10 dias úteis. Não é necessário informar dados bancários.
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Comentários Adicionais
        </label>
        <textarea
          value={fields.additionalComments}
          onChange={e => updateField('additionalComments', e.target.value)}
          placeholder="Alguma informação adicional que gostaria de compartilhar..."
          style={textareaStyle}
        />
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '32px' }}>
        <button onClick={onBack} style={secondaryBtnStyle}>Voltar</button>
        <button onClick={onNext} style={primaryBtnStyle}>Continuar</button>
      </div>
    </div>
  )
}
