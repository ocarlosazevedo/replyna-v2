import { Shield } from 'lucide-react'
import ProgressBar from './ProgressBar'
import UploadZone from './UploadZone'
import type { UploadsMap, UploadKey } from './types'
import { UPLOAD_LABELS, primaryBtnStyle, secondaryBtnStyle, errorBoxStyle } from './constants'

interface Props {
  uploads: UploadsMap
  onFileUpload: (key: UploadKey, file: File) => void
  onRemoveUpload: (key: UploadKey) => void
  onNext: () => void
  onBack: () => void
  error: string | null
}

const PHOTO_KEYS: UploadKey[] = ['product_front', 'product_back', 'defect', 'packaging', 'label']

export default function StepPhotoEvidence({ uploads, onFileUpload, onRemoveUpload, onNext, onBack, error }: Props) {
  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <ProgressBar step={6} />

      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
        Evidências Fotográficas
      </div>
      <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.5' }}>
        Envie fotos nítidas para apoiar sua solicitação de devolução.
      </div>

      {/* Security tip */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 14px',
        backgroundColor: 'rgba(16, 185, 129, 0.06)',
        border: '1px solid rgba(16, 185, 129, 0.15)',
        borderRadius: '8px',
        marginBottom: '24px',
        fontSize: '12px',
        color: 'var(--text-secondary)',
      }}>
        <Shield size={14} color="#10b981" style={{ flexShrink: 0 }} />
        Suas fotos são armazenadas com segurança e utilizadas exclusivamente para análise da solicitação.
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      {PHOTO_KEYS.map(key => (
        <UploadZone
          key={key}
          uploadKey={key}
          state={uploads[key]}
          onFileSelect={onFileUpload}
          onRemove={onRemoveUpload}
          label={UPLOAD_LABELS[key]}
        />
      ))}

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '32px' }}>
        <button onClick={onBack} style={secondaryBtnStyle}>Voltar</button>
        <button onClick={onNext} style={primaryBtnStyle}>Continuar</button>
      </div>
    </div>
  )
}
