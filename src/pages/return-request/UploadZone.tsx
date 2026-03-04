import { useRef, useState, useCallback } from 'react'
import { Upload, FileText, X } from 'lucide-react'
import type { UploadKey, UploadState } from './types'
import type { TFunction } from './i18n'

interface UploadZoneProps {
  uploadKey: UploadKey
  state: UploadState
  onFileSelect: (key: UploadKey, file: File) => void
  onRemove: (key: UploadKey) => void
  acceptPdf?: boolean
  label: string
  t: TFunction
}

export default function UploadZone({ uploadKey, state, onFileSelect, onRemove, acceptPdf, label, t }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const accept = acceptPdf ? 'image/*,application/pdf' : 'image/*'

  const handleClick = () => inputRef.current?.click()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFileSelect(uploadKey, file)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFileSelect(uploadKey, file)
  }, [uploadKey, onFileSelect])

  const isPdf = state.file?.type === 'application/pdf'

  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={{
        display: 'block',
        fontSize: '14px',
        fontWeight: 500,
        color: 'var(--text-secondary)',
        marginBottom: '8px',
      }}>
        {label} <span style={{ color: '#ef4444' }}>*</span>
      </label>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: 'none' }}
      />

      {!state.file ? (
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border-color)'}`,
            borderRadius: '10px',
            padding: '32px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            backgroundColor: isDragging ? 'rgba(70, 114, 236, 0.06)' : 'var(--bg-primary)',
          }}
        >
          <Upload size={32} color="var(--text-secondary)" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
            {t('upload.dragOrClick')}
          </div>
        </div>
      ) : (
        <div style={{
          position: 'relative',
          display: 'inline-block',
          marginTop: '8px',
        }}>
          {isPdf ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
            }}>
              <FileText size={28} color="var(--accent)" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                  {state.file.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {(state.file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
              <button
                onClick={() => onRemove(uploadKey)}
                style={{
                  marginLeft: '12px',
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <img
                src={state.previewUrl || ''}
                alt={t('upload.preview')}
                style={{
                  width: '120px',
                  height: '120px',
                  objectFit: 'cover',
                  borderRadius: '10px',
                  border: '2px solid var(--border-color)',
                }}
              />
              <button
                onClick={() => onRemove(uploadKey)}
                style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  color: '#fff',
                  border: '2px solid var(--bg-card)',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={14} />
              </button>
            </>
          )}
          {state.uploading && (
            <div style={{
              fontSize: '12px',
              color: 'var(--accent)',
              marginTop: '4px',
            }}>
              {t('upload.uploading')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
