import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sun, Moon, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../context/ThemeContext'

export default function Login() {
  const { signIn } = useAuth()
  const { theme, setTheme } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fazer login'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
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
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Faça login na sua conta</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '10px', fontSize: '14px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
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

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Senha
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '12px 48px 12px 16px', border: '1px solid var(--input-border)', borderRadius: '10px', fontSize: '16px', boxSizing: 'border-box', backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)' }}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                }}
                title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
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
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)' }}>
          <Link to="/forgot-password" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Esqueci minha senha
          </Link>
        </div>

        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)' }}>
          Não tem conta?{' '}
          <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: '500' }}>
            Criar conta
          </Link>
        </div>
      </div>
    </div>
  )
}
