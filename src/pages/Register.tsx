import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sun, Moon, ArrowRight, ArrowLeft, Check } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'

export default function Register() {
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Google Ads conversion tracking
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', {
        'send_to': 'AW-17979181556/EkcYCPKZrIIcEPSTkv1C'
      })
    }
  }, [])

  const handleStartTrial = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('id, name, description, price_monthly, emails_limit, shops_limit, features, is_popular, is_active')
        .eq('is_active', true)
        .gt('price_monthly', 0)
        .order('sort_order', { ascending: true })
        .limit(1)
        .single()

      if (error) throw error
      navigate('/checkout', { state: { plan: data, isTrialFlow: true } })
    } catch (err) {
      console.error('Erro ao iniciar trial:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      position: 'relative',
    }}>
      {/* Top bar with logo and theme toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 24px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
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
            title="Voltar"
          >
            <ArrowLeft size={20} />
          </button>
          <Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
            <img
              src="/replyna-logo.webp"
              alt="Replyna"
              style={{ width: '120px', height: 'auto' }}
            />
          </Link>
        </div>
        <button
          onClick={toggleTheme}
          style={{
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
      </div>

      {/* Page content */}
      <div style={{
        padding: '0 20px 40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 80px)',
      }}>
        <div style={{
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
        }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '12px',
          }}>
            Teste a Replyna gratis
          </h1>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '16px',
            marginBottom: '32px',
            lineHeight: '1.5',
          }}>
            Comece agora sem compromisso. Sem necessidade de cartao de credito.
          </p>

          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '28px',
            border: '1px solid var(--border-color)',
            marginBottom: '24px',
            textAlign: 'left',
          }}>
            {['30 emails inclusos para teste', 'Integracao com 1 loja Shopify', 'Respostas automaticas com IA', 'Configuracao em minutos'].map((feature, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: index < 3 ? '14px' : 0,
                }}
              >
                <Check size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
                <span style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
                  {feature}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={handleStartTrial}
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px 24px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: '#22c55e',
              color: '#fff',
              fontWeight: 600,
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.2s ease',
            }}
          >
            {loading ? 'Carregando...' : 'Comecar teste gratis'}
            {!loading && <ArrowRight size={18} />}
          </button>

          <div style={{
            marginTop: '24px',
            fontSize: '14px',
            color: 'var(--text-secondary)',
          }}>
            Ja tem conta?{' '}
            <Link
              to="/login"
              style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: '500' }}
            >
              Fazer login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
