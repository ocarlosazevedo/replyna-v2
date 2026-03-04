import { Search, Lock } from 'lucide-react'
import { inputStyle, primaryBtnStyle, errorBoxStyle } from './constants'
import type { TFunction } from './i18n'

interface Props {
  email: string
  setEmail: (v: string) => void
  onSearch: () => void
  isLoading: boolean
  error: string | null
  t: TFunction
}

export default function StepEmailLookup({ email, setEmail, onSearch, isLoading, error, t }: Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch()
  }

  return (
    <form onSubmit={handleSubmit} style={{ animation: 'fadeIn 0.4s ease' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(70, 114, 236, 0.1), rgba(70, 114, 236, 0.05))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <Search size={28} color="var(--accent)" />
        </div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
          {t('email.title')}
        </div>
        <div style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          {t('email.desc')}
        </div>
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          {t('email.label')} <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder={t('email.placeholder')}
          required
          style={inputStyle}
        />
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          {t('email.hint')}
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        style={{
          ...primaryBtnStyle,
          width: '100%',
          padding: '14px 24px',
          opacity: isLoading ? 0.7 : 1,
          cursor: isLoading ? 'not-allowed' : 'pointer',
        }}
      >
        <Search size={18} />
        {isLoading ? t('email.searching') : t('email.search')}
      </button>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '5px',
        marginTop: '16px',
        fontSize: '11px',
        color: 'var(--text-secondary)',
        opacity: 0.7,
      }}>
        <Lock size={11} />
        {t('email.privacy')}
      </div>
    </form>
  )
}
