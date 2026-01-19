import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const { signUp } = useAuth()

  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    completeRegistration()
  }, [])

  const completeRegistration = async () => {
    try {
      // Recuperar dados do registro pendente
      const pendingData = localStorage.getItem('pending_registration')

      if (!pendingData) {
        // Sem dados pendentes - usuário provavelmente já completou o registro
        // ou veio de outra sessão. O webhook já deve ter criado a conta.
        setStatus('success')
        return
      }

      const { email, password, name } = JSON.parse(pendingData)

      // Criar conta no Supabase Auth
      await signUp(email, password, name)

      // Limpar dados temporários
      localStorage.removeItem('pending_registration')

      setStatus('success')
    } catch (err: unknown) {
      console.error('Erro ao completar registro:', err)

      // Se o erro for "User already registered", significa que o webhook já criou
      const errorMsg = err instanceof Error ? err.message : ''
      if (errorMsg.includes('already registered') || errorMsg.includes('already exists')) {
        // Usuário já existe - isso é esperado se o webhook rodou primeiro
        localStorage.removeItem('pending_registration')
        setStatus('success')
        return
      }

      setErrorMessage(errorMsg || 'Erro ao finalizar cadastro')
      setStatus('error')
    }
  }

  if (status === 'processing') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
      }}>
        <div style={{
          maxWidth: '400px',
          width: '100%',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '40px',
          textAlign: 'center',
          border: '1px solid var(--border-color)',
        }}>
          <Loader2
            size={48}
            style={{
              color: 'var(--accent)',
              animation: 'spin 1s linear infinite',
              marginBottom: '24px',
            }}
          />
          <h2 style={{
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '8px',
          }}>
            Finalizando seu cadastro...
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Aguarde enquanto confirmamos seu pagamento
          </p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
      }}>
        <div style={{
          maxWidth: '400px',
          width: '100%',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '40px',
          textAlign: 'center',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <span style={{ fontSize: '32px' }}>!</span>
          </div>

          <h2 style={{
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '8px',
          }}>
            Ocorreu um problema
          </h2>

          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '14px',
            marginBottom: '24px',
          }}>
            {errorMessage || 'Nao foi possivel finalizar seu cadastro. Seu pagamento foi processado com sucesso, entre em contato com o suporte.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Link
              to="/login"
              style={{
                backgroundColor: 'var(--accent)',
                color: '#fff',
                padding: '12px 24px',
                borderRadius: '10px',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              Tentar fazer login
              <ArrowRight size={18} />
            </Link>

            <a
              href="mailto:suporte@replyna.com"
              style={{
                color: 'var(--text-secondary)',
                fontSize: '14px',
                textDecoration: 'none',
              }}
            >
              Precisa de ajuda? Entre em contato
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-primary)',
    }}>
      <div style={{
        maxWidth: '400px',
        width: '100%',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '40px',
        textAlign: 'center',
        border: '1px solid var(--border-color)',
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <CheckCircle size={40} style={{ color: '#22c55e' }} />
        </div>

        <h2 style={{
          fontSize: '24px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '8px',
        }}>
          Pagamento confirmado!
        </h2>

        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '15px',
          marginBottom: '24px',
          lineHeight: 1.6,
        }}>
          Sua assinatura foi ativada com sucesso.
        </p>

        <div style={{
          padding: '20px',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderRadius: '12px',
          marginBottom: '20px',
          border: '1px solid rgba(245, 158, 11, 0.2)',
        }}>
          <p style={{
            fontSize: '15px',
            color: '#b45309',
            fontWeight: 600,
            marginBottom: '8px',
          }}>
            Importante: Defina sua senha
          </p>
          <p style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}>
            Enviamos um email para voce definir sua senha de acesso. Verifique sua caixa de entrada (e spam) e clique no link para criar sua senha.
          </p>
        </div>

        <div style={{
          padding: '16px',
          backgroundColor: 'rgba(70, 114, 236, 0.06)',
          borderRadius: '12px',
          marginBottom: '24px',
        }}>
          <p style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
          }}>
            Nao recebeu o email? Acesse a pagina de login e clique em "Esqueci minha senha" para receber um novo link.
          </p>
        </div>

        <Link
          to="/login"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            backgroundColor: 'var(--accent)',
            color: '#fff',
            padding: '14px 24px',
            borderRadius: '10px',
            fontWeight: 600,
            textDecoration: 'none',
            fontSize: '15px',
          }}
        >
          Ir para login
          <ArrowRight size={18} />
        </Link>

        {sessionId && (
          <p style={{
            marginTop: '24px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}>
            ID da transacao: {sessionId.slice(0, 20)}...
          </p>
        )}
      </div>
    </div>
  )
}
