import { Check } from 'lucide-react'
import { PROGRESS_MAP, STEP_LABELS } from './constants'

interface ProgressBarProps {
  step: number
}

const STEPS = [2, 3, 4, 5, 6, 7, 8, 9]

export default function ProgressBar({ step }: ProgressBarProps) {
  const percentage = PROGRESS_MAP[step] || 0

  return (
    <div style={{ marginBottom: '32px' }}>
      {/* Step circles */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        padding: '0 4px',
        marginBottom: '12px',
      }}>
        {/* Connector line (background) */}
        <div style={{
          position: 'absolute',
          top: '15px',
          left: '20px',
          right: '20px',
          height: '3px',
          backgroundColor: 'var(--border-color)',
          borderRadius: '999px',
          zIndex: 0,
        }} />
        {/* Connector line (filled) */}
        <div style={{
          position: 'absolute',
          top: '15px',
          left: '20px',
          width: `calc(${((step - 2) / (STEPS.length - 1)) * 100}% - 0px)`,
          height: '3px',
          background: 'linear-gradient(90deg, var(--accent), #6490f0)',
          borderRadius: '999px',
          zIndex: 0,
          transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        }} />

        {STEPS.map(s => {
          const isCompleted = s < step
          const isActive = s === step
          const isPending = s > step

          return (
            <div key={s} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              zIndex: 1,
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 700,
                transition: 'all 0.3s ease',
                ...(isCompleted ? {
                  background: 'linear-gradient(135deg, var(--accent), #3558c8)',
                  color: '#fff',
                  boxShadow: '0 2px 6px rgba(70, 114, 236, 0.25)',
                } : isActive ? {
                  backgroundColor: 'var(--bg-card)',
                  border: '3px solid var(--accent)',
                  color: 'var(--accent)',
                  boxShadow: '0 0 0 4px rgba(70, 114, 236, 0.12)',
                } : {
                  backgroundColor: 'var(--bg-primary)',
                  border: '2px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                }),
              }}>
                {isCompleted ? <Check size={16} strokeWidth={3} /> : (s - 1)}
              </div>
              {/* Label — hide on very small screens via CSS */}
              <span style={{
                marginTop: '6px',
                fontSize: '10px',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--accent)' : isPending ? 'var(--text-secondary)' : 'var(--text-primary)',
                whiteSpace: 'nowrap',
                transition: 'color 0.3s ease',
                letterSpacing: '0.01em',
              }}>
                {STEP_LABELS[s] || ''}
              </span>
            </div>
          )
        })}
      </div>

      {/* Thin progress bar + percentage */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{
          flex: 1,
          height: '4px',
          backgroundColor: 'rgba(70, 114, 236, 0.1)',
          borderRadius: '999px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${percentage}%`,
            background: 'linear-gradient(90deg, var(--accent), #6490f0)',
            borderRadius: '999px',
            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>
        <span style={{
          fontSize: '12px',
          fontWeight: 700,
          color: 'var(--accent)',
          minWidth: '36px',
          textAlign: 'right',
        }}>
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  )
}
