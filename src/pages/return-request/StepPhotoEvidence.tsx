import { Shield } from 'lucide-react'
import ProgressBar from './ProgressBar'
import UploadZone from './UploadZone'
import type { UploadsMap, UploadKey } from './types'
import { primaryBtnStyle, secondaryBtnStyle, errorBoxStyle } from './constants'
import type { TFunction } from './i18n'

interface Props {
  uploads: UploadsMap
  onFileUpload: (key: UploadKey, file: File) => void
  onRemoveUpload: (key: UploadKey) => void
  onNext: () => void
  onBack: () => void
  error: string | null
  t: TFunction
}

const PHOTO_KEYS: UploadKey[] = ['product_front', 'product_back', 'defect', 'packaging', 'label']

export default function StepPhotoEvidence({ uploads, onFileUpload, onRemoveUpload, onNext, onBack, error, t }: Props) {
  const uploadLabels: Record<string, string> = {
    product_front: t('upload.productFront'),
    product_back: t('upload.productBack'),
    defect: t('upload.defect'),
    packaging: t('upload.packaging'),
    label: t('upload.label'),
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <ProgressBar step={6} t={t} />

      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
        {t('photos.title')}
      </div>
      <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.5' }}>
        {t('photos.desc')}
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
        {t('photos.securityTip')}
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      {PHOTO_KEYS.map(key => (
        <UploadZone
          key={key}
          uploadKey={key}
          state={uploads[key]}
          onFileSelect={onFileUpload}
          onRemove={onRemoveUpload}
          label={uploadLabels[key]}
          t={t}
        />
      ))}

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '32px' }}>
        <button onClick={onBack} style={secondaryBtnStyle}>{t('common.back')}</button>
        <button onClick={onNext} style={primaryBtnStyle}>{t('common.continue')}</button>
      </div>
    </div>
  )
}
