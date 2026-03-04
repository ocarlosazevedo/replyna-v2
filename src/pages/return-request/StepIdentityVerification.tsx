import ProgressBar from './ProgressBar'
import type { FormFields, UploadsMap, UploadKey } from './types'
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
}

export default function StepIdentityVerification({ fields, updateField, onNext, onBack, error }: Props) {
  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <ProgressBar step={2} />

      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
        Verificação de Identidade
      </div>
      <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '28px', lineHeight: '1.5' }}>
        Confirme sua identidade para prosseguir com a solicitação de devolução.
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Nome Completo <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="text"
          value={fields.fullName}
          onChange={e => updateField('fullName', e.target.value)}
          placeholder="Seu nome completo"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Número de Telefone <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="tel"
          value={fields.customerPhone}
          onChange={e => updateField('customerPhone', e.target.value)}
          placeholder="+55 (11) 99999-0000"
          style={inputStyle}
        />
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          Deve corresponder ao telefone cadastrado no seu pedido
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '32px' }}>
        <button onClick={onBack} style={secondaryBtnStyle}>Voltar</button>
        <button onClick={onNext} style={primaryBtnStyle}>Continuar</button>
      </div>
    </div>
  )
}
