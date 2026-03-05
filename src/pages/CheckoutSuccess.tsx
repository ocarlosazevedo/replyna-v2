import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle, ArrowRight, Loader2, AlertCircle } from 'lucide-react'

export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')

  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const confirmRegistration = async () => {
      try {
        const pendingData = localStorage.getItem('pending_registration')
        if (!pendingData) {
          // Sem dados pendentes - pode ser reload ou acesso direto
          setStatus('success')
          return
        }

        const parsed = JSON.parse(pendingData)
        localStorage.removeItem('pending_registration')

        // Google Ads conversion tracking
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'conversion', {
            'send_to': 'AW-17979181556/6bTqCK72oIIcEPSTkv1C',
            'value': 450.0,
            'currency': 'BRL'
          })
        }

        // Chamar confirm-registration para criar a conta
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confirm-registration`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            email: parsed.email,
            name: parsed.name,
            whatsapp_number: parsed.whatsapp_number || undefined,
            plan_id: parsed.plan_id,
            asaas_customer_id: parsed.asaas_customer_id,
            asaas_subscription_id: parsed.asaas_subscription_id,
            coupon_id: parsed.coupon_id || undefined,
            discount_applied: parsed.discount_applied || undefined,
            is_trial: parsed.is_trial || false,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao criar conta')
        }

        // Login automatico via magic link
        if (data.magic_link) {
          window.location.href = data.magic_link
          return
        }

        setStatus('success')
      } catch (err) {
        console.error('Erro ao confirmar registro:', err)
        setErrorMessage(err instanceof Error ? err.message : 'Erro ao criar conta')
        setStatus('error')
      }
    }

    confirmRegistration()
  }, [])

  if (status === 'processing') {
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
          maxWidth: '400px',
          width: '100%',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '32px',
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
            Configurando sua conta...
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Aguarde um momento
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
        padding: '20px',
      }}>
        <div style={{
          maxWidth: '400px',
          width: '100%',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '32px',
          textAlign: 'center',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <AlertCircle size={40} style={{ color: '#ef4444' }} />
          </div>

          <h2 style={{
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '8px',
          }}>
            Erro ao criar conta
          </h2>

          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '15px',
            marginBottom: '24px',
            lineHeight: 1.6,
          }}>
            {errorMessage || 'Ocorreu um erro ao configurar sua conta. Entre em contato com o suporte.'}
          </p>

          <Link
            to="/register"
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
            Tentar novamente
            <ArrowRight size={18} />
          </Link>
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
      padding: '20px',
    }}>
      <div style={{
        maxWidth: '400px',
        width: '100%',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '32px',
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
          Conta criada com sucesso!
        </h2>

        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '15px',
          marginBottom: '24px',
          lineHeight: 1.6,
        }}>
          Seu periodo de teste gratuito foi ativado com 30 emails.
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
