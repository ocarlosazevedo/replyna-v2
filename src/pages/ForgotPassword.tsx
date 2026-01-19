import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sun, Moon, Mail } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../context/ThemeContext'

export default function ForgotPassword() {
  const { resetPassword } = useAuth()
  const { theme, setTheme } = useTheme()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await resetPassword(email)
      setSuccess(true)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao enviar email'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)', position: 'relative' }}>
        {/* Toggle de tema */}
        <button
          onClick={toggleTheme}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
          }}
          title={theme === 'light' ? 'Mudar para tema escuro' : 'Mudar para tema claro'}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        <div style={{ maxWidth: '400px', width: '100%', backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '32px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid var(--border-color)' }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            backgroundColor: 'rgba(70, 114, 236, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Mail size={36} style={{ color: 'var(--accent)' }} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>Email enviado!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Enviamos um link para <strong>{email}</strong>.
            Clique no link para redefinir sua senha.
          </p>
          <Link
            to="/login"
            style={{ display: 'inline-block', backgroundColor: 'var(--accent)', color: 'white', padding: '12px 24px', borderRadius: '10px', fontWeight: '600', textDecoration: 'none' }}
          >
            Voltar para login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)', position: 'relative' }}>
      {/* Toggle de tema */}
      <button
        onClick={toggleTheme}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
        }}
        title={theme === 'light' ? 'Mudar para tema escuro' : 'Mudar para tema claro'}
      >
        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
      </button>

      <div style={{ maxWidth: '400px', width: '100%', backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid var(--border-color)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img
            src="/replyna-logo.webp"
            alt="Replyna"
            style={{ width: '180px', height: 'auto', display: 'block', margin: '0 auto 16px' }}
          />
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Recuperar senha</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '10px', fontSize: '14px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
            Digite seu email e enviaremos um link para você criar uma nova senha.
          </p>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', border: '1px solid var(--input-border)', borderRadius: '10px', fontSize: '16px', boxSizing: 'border-box', backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)' }}
              placeholder="seu@email.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: loading ? 'var(--accent-hover)' : 'var(--accent)',
              color: 'white',
              padding: '12px',
              borderRadius: '10px',
              fontWeight: '600',
              fontSize: '16px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Enviando...' : 'Enviar link'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)' }}>
          <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            ← Voltar para login
          </Link>
        </div>
      </div>
    </div>
  )
}
