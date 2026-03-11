import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

interface TokenResponse {
  name?: string | null
  plan_name?: string | null
  price_monthly?: string | number | null
  used?: boolean
}

type Status = 'loading' | 'ready' | 'invalid' | 'error'

export default function Migrate() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<Status>('loading')
  const [data, setData] = useState<TokenResponse | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const token = useMemo(() => searchParams.get('token'), [searchParams])
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }

    const fetchToken = async () => {
      try {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/validate-migration-token?token=${encodeURIComponent(token)}`,
          { method: 'GET' }
        )

        if (response.status === 404) {
          setStatus('invalid')
          return
        }

        if (!response.ok) {
          throw new Error('Erro ao validar token')
        }

        const payload = (await response.json()) as TokenResponse

        if (payload.used) {
          setStatus('invalid')
          return
        }

        setData(payload)
        setStatus('ready')
      } catch (err) {
        console.error('Erro ao validar token:', err)
        setStatus('error')
      }
    }

    fetchToken()
  }, [token, supabaseUrl])

  const formattedPrice = useMemo(() => {
    if (!data?.price_monthly) return 'R$ 0,00'
    const numeric = typeof data.price_monthly === 'string'
      ? Number.parseFloat(data.price_monthly)
      : Number(data.price_monthly)
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(Number.isFinite(numeric) ? numeric : 0)
  }, [data?.price_monthly])

  const handleMigrate = async () => {
    if (!token) return
    setActionLoading(true)
    setErrorMessage('')

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/accept-migration-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData?.error || 'Erro ao iniciar migracao')
      }

      const payload = await response.json()
      if (payload?.invoiceUrl) {
        window.location.href = payload.invoiceUrl
        return
      }

      throw new Error('Invoice não encontrada. Entre em contato pelo WhatsApp.')
    } catch (err) {
      console.error('Erro ao iniciar migracao:', err)
      setErrorMessage('Erro ao processar. Entre em contato pelo WhatsApp: (31) 99771-9669')
    } finally {
      setActionLoading(false)
    }
  }

  const wrapperStyle = {
    minHeight: '100vh',
    backgroundColor: '#050508',
    color: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
  }

  const cardStyle = {
    width: '100%',
    maxWidth: '480px',
    backgroundColor: '#0b0b12',
    borderRadius: '18px',
    border: '1px solid #1f1f2e',
    padding: '32px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
    textAlign: 'center' as const,
  }

  const buttonStyle = {
    width: '100%',
    padding: '14px 18px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#2563eb',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 600,
    cursor: actionLoading ? 'not-allowed' : 'pointer',
    opacity: actionLoading ? 0.7 : 1,
    marginTop: '24px',
  }

  const renderInvalid = () => (
    <div style={cardStyle}>
      <img
        src="/replyna-logo.webp"
        alt="Replyna"
        style={{ width: '160px', margin: '0 auto 20px', display: 'block' }}
      />
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
        Este link não é válido ou já foi utilizado
      </h2>
      <p style={{ color: '#94a3b8', fontSize: '14px' }}>
        Entre em contato se precisar de ajuda.
      </p>
    </div>
  )

  const renderError = () => (
    <div style={cardStyle}>
      <img
        src="/replyna-logo.webp"
        alt="Replyna"
        style={{ width: '160px', margin: '0 auto 20px', display: 'block' }}
      />
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
        Erro ao processar
      </h2>
      <p style={{ color: '#94a3b8', fontSize: '14px' }}>
        Entre em contato pelo WhatsApp: (31) 99771-9669
      </p>
    </div>
  )

  return (
    <div style={wrapperStyle}>
      {status === 'loading' && (
        <div style={cardStyle}>
          <img
            src="/replyna-logo.webp"
            alt="Replyna"
            style={{ width: '160px', margin: '0 auto 20px', display: 'block' }}
          />
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>Validando seu link...</p>
        </div>
      )}

      {status === 'invalid' && renderInvalid()}
      {status === 'error' && renderError()}

      {status === 'ready' && (
        <div style={cardStyle}>
          <img
            src="/replyna-logo.webp"
            alt="Replyna"
            style={{ width: '160px', margin: '0 auto 20px', display: 'block' }}
          />
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>
            Olá {data?.name || 'cliente'}!
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
            Atualizamos nosso sistema de pagamento para melhorar sua experiência.
          </p>
          <div style={{
            backgroundColor: '#10101a',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid #1f1f2e',
          }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#cbd5f5' }}>Seu plano</p>
            <p style={{ margin: '6px 0 0', fontSize: '18px', fontWeight: 600 }}>
              {data?.plan_name || 'Plano'} - {formattedPrice}/mês
            </p>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '16px' }}>
            Seus emails e configurações continuam exatamente iguais.
          </p>
          {errorMessage && (
            <div style={{
              marginTop: '16px',
              backgroundColor: '#3b0f0f',
              color: '#fecaca',
              padding: '12px',
              borderRadius: '10px',
              fontSize: '13px',
            }}>
              {errorMessage}
            </div>
          )}
          <button
            type="button"
            onClick={handleMigrate}
            disabled={actionLoading}
            style={buttonStyle}
          >
            {actionLoading ? 'Processando...' : 'Atualizar forma de pagamento →'}
          </button>
        </div>
      )}
    </div>
  )
}
