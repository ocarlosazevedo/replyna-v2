import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ForgotPassword() {
  const { resetPassword } = useAuth()
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

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
        <div style={{ maxWidth: '400px', width: '100%', backgroundColor: 'white', borderRadius: '12px', padding: '32px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>Email enviado!</h2>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>
            Enviamos um link para <strong>{email}</strong>. 
            Clique no link para redefinir sua senha.
          </p>
          <Link
            to="/login"
            style={{ display: 'inline-block', backgroundColor: '#2563eb', color: 'white', padding: '12px 24px', borderRadius: '8px', fontWeight: '500', textDecoration: 'none' }}
          >
            Voltar para login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
      <div style={{ maxWidth: '400px', width: '100%', backgroundColor: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: '#2563eb' }}>Replyna</h1>
          <p style={{ color: '#6b7280', marginTop: '8px' }}>Recuperar senha</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
            Digite seu email e enviaremos um link para você criar uma nova senha.
          </p>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }}
              placeholder="seu@email.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ 
              width: '100%', 
              backgroundColor: loading ? '#93c5fd' : '#2563eb', 
              color: 'white', 
              padding: '12px', 
              borderRadius: '8px', 
              fontWeight: '500', 
              fontSize: '16px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Enviando...' : 'Enviar link'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: '#6b7280' }}>
          <Link to="/login" style={{ color: '#2563eb', textDecoration: 'none' }}>
            ← Voltar para login
          </Link>
        </div>
      </div>
    </div>
  )
}
