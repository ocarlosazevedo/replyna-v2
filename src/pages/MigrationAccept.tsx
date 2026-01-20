import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Check, AlertCircle, Calendar, CreditCard, Store, RefreshCw } from 'lucide-react'

interface InviteData {
  code: string
  customer_email: string
  customer_name: string | null
  plan: {
    id: string
    name: string
    price_monthly: number
    shops_limit: number
    emails_limit: number
  }
  billing_start_date: string
  trial_days: number
}

export default function MigrationAccept() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState<InviteData | null>(null)

  const [formData, setFormData] = useState({
    email: '',
    name: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (code) {
      validateInvite(code)
    }
  }, [code])

  const validateInvite = async (inviteCode: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-migration-invite?code=${inviteCode}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      )

      const data = await response.json()

      if (!response.ok || !data.valid) {
        setError(data.error || 'Convite inválido')
        return
      }

      setInvite(data.invite)
      setFormData({
        email: data.invite.customer_email,
        name: data.invite.customer_name || '',
      })
    } catch (err) {
      console.error('Erro ao validar convite:', err)
      setError('Erro ao validar convite')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!invite || !formData.email) return

    setSubmitting(true)

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-migration-invite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            code: invite.code,
            user_email: formData.email,
            user_name: formData.name,
            success_url: `${window.location.origin}/checkout/success`,
            cancel_url: window.location.href,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao aceitar convite')
      }

      // Salvar dados pendentes no localStorage (igual ao Register.tsx)
      localStorage.setItem('pending_registration', JSON.stringify({
        email: formData.email,
        name: formData.name,
        plan_id: invite.plan.id,
        plan_name: invite.plan.name,
        emails_limit: invite.plan.emails_limit,
        shops_limit: invite.plan.shops_limit,
        migration_invite_code: invite.code,
      }))

      // Redirecionar para o Stripe Checkout
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error('Erro ao aceitar convite:', err)
      setError(err instanceof Error ? err.message : 'Erro ao processar convite')
      setSubmitting(false)
    }
  }

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date))

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--text-primary)',
    fontSize: '15px',
    outline: 'none',
  }

  const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 600,
    fontSize: '14px',
    color: 'var(--text-primary)',
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid var(--border-color)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
      </div>
    )
  }

  if (error) {
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
          padding: '48px 32px',
          textAlign: 'center',
          maxWidth: '400px',
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
            <AlertCircle size={32} style={{ color: '#ef4444' }} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
            Convite Inválido
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.6' }}>
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
        </div>
      </div>
    )
  }

  if (!invite) return null

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img
            src="/replyna-logo.webp"
            alt="Replyna"
            style={{ height: '48px', marginBottom: '24px', display: 'block', margin: '0 auto 24px' }}
          />
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Bem-vindo de volta!
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            Você foi convidado para migrar para a nova versão da Replyna
          </p>
        </div>

        {/* Invite Details Card */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid var(--border-color)',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>
            Detalhes do seu plano
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(70, 114, 236, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <CreditCard size={20} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Plano</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {invite.plan.name} - R$ {invite.plan.price_monthly}/mês
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Store size={20} style={{ color: '#22c55e' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Limite de lojas</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {invite.plan.shops_limit} loja{invite.plan.shops_limit > 1 ? 's' : ''}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Calendar size={20} style={{ color: '#f59e0b' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Início da cobrança</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {formatDate(invite.billing_start_date)}
                </div>
              </div>
            </div>
          </div>

          {/* Trial info */}
          {invite.trial_days > 0 && (
            <div style={{
              marginTop: '20px',
              padding: '16px',
              backgroundColor: 'rgba(34, 197, 94, 0.06)',
              borderRadius: '12px',
              border: '1px solid rgba(34, 197, 94, 0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={18} style={{ color: '#22c55e' }} />
                <span style={{ fontSize: '14px', color: '#22c55e', fontWeight: 600 }}>
                  {invite.trial_days} dias gratuitos até o início da cobrança
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', marginLeft: '26px' }}>
                Você poderá usar a Replyna normalmente sem cobrança até {formatDate(invite.billing_start_date)}
              </p>
            </div>
          )}
        </div>

        {/* Form Card */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid var(--border-color)',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>
            Confirme seus dados
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Nome</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={inputStyle}
                placeholder="Seu nome"
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={inputStyle}
                placeholder="seu@email.com"
                required
              />
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                Você receberá um email para definir sua senha após o cadastro
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '14px 24px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: 'var(--accent)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '15px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '8px',
              }}
            >
              {submitting ? (
                <>
                  <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  Processando...
                </>
              ) : (
                <>
                  <CreditCard size={18} />
                  Adicionar cartão e continuar
                </>
              )}
            </button>

            <p style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              textAlign: 'center',
              lineHeight: '1.6',
            }}>
              Ao continuar, você será redirecionado para uma página segura do Stripe para adicionar seu cartão.
              A cobrança só será realizada em {formatDate(invite.billing_start_date)}.
            </p>
          </form>
        </div>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          marginTop: '24px',
          fontSize: '13px',
          color: 'var(--text-secondary)',
        }}>
          Já tem uma conta?{' '}
          <a href="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
            Fazer login
          </a>
        </p>
      </div>
    </div>
  )
}
