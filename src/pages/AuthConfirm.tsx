import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthConfirm() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const confirmAuth = async () => {
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')

      if (!tokenHash || !type) {
        setError('Link inválido ou expirado')
        return
      }

      try {
        // Verificar o token e fazer login
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as 'magiclink' | 'email',
        })

        if (verifyError) {
          console.error('Erro ao verificar OTP:', verifyError)
          setError('Link inválido ou expirado. Tente novamente.')
          return
        }

        // Login bem sucedido, redirecionar para dashboard
        navigate('/dashboard', { replace: true })
      } catch (err) {
        console.error('Erro ao confirmar autenticação:', err)
        setError('Erro ao processar autenticação. Tente novamente.')
      }
    }

    confirmAuth()
  }, [searchParams, navigate])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-primary)',
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '40px',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center',
        border: '1px solid var(--border-color)',
      }}>
        {error ? (
          <>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <span style={{ fontSize: '32px' }}>!</span>
            </div>
            <h1 style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '12px',
            }}>
              Erro na autenticação
            </h1>
            <p style={{
              color: 'var(--text-secondary)',
              marginBottom: '24px',
            }}>
              {error}
            </p>
            <button
              onClick={() => navigate('/login')}
              style={{
                padding: '12px 24px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: 'var(--accent)',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Ir para Login
            </button>
          </>
        ) : (
          <>
            <div style={{
              width: '48px',
              height: '48px',
              border: '3px solid var(--border-color)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px',
            }} />
            <h1 style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '8px',
            }}>
              Autenticando...
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Aguarde enquanto verificamos seu acesso
            </p>
          </>
        )}
      </div>
    </div>
  )
}
