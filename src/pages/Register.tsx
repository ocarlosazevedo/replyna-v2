import { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Sun, Moon, Star, ArrowRight, ArrowLeft, MessageCircle, Check } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'

interface Plan {
  id: string
  name: string
  description: string | null
  price_monthly: number
  emails_limit: number | null  // null = ilimitado
  shops_limit: number | null   // null = ilimitado
  features: string[]
  is_popular: boolean
  is_active: boolean
}

export default function Register() {
  const { theme, setTheme } = useTheme()
  const [searchParams] = useSearchParams()
  const preselectedPlan = searchParams.get('plan')
  const navigate = useNavigate()

  // Step management - now only 'plan' step, account goes to /checkout
  const [step] = useState<'plan'>('plan')

  // Plans
  const [plans, setPlans] = useState<Plan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)

  useEffect(() => {
    loadPlans()
    // Google Ads conversion tracking
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', {
        'send_to': 'AW-17979181556/EkcYCPKZrIIcEPSTkv1C'
      })
    }
  }, [])

  useEffect(() => {
    if (preselectedPlan && plans.length > 0) {
      const normalizedPreselected = preselectedPlan.toLowerCase().replace(/[-\s]/g, '')
      const plan = plans.find(p => p.name.toLowerCase().replace(/[-\s]/g, '') === normalizedPreselected)
      if (plan) {
        if (isEnterprisePlan(plan)) return
        navigate('/checkout', { state: { plan, isTrialFlow: false } })
      }
    }
  }, [preselectedPlan, plans, navigate])

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('id, name, description, price_monthly, emails_limit, shops_limit, features, is_popular, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error
      setPlans(data || [])
    } catch (err) {
      console.error('Erro ao carregar planos:', err)
    } finally {
      setLoadingPlans(false)
    }
  }

  const isEnterprisePlan = (plan: Plan) => {
    return !plan.is_active || plan.price_monthly === 0
  }

  const handleSelectPlan = (plan: Plan) => {
    if (isEnterprisePlan(plan)) {
      window.open('https://wa.me/5531973210191?text=Olá! Tenho interesse no plano Enterprise da Replyna.', '_blank')
      return
    }
    navigate('/checkout', { state: { plan, isTrialFlow: false } })
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(price)
  }

  // Loading state
  if (loadingPlans) {
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
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
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
      <div style={{ padding: '0 20px 40px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '8px',
          }}>
            Escolha seu plano
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
            Comece com 30 emails gratis. Adicione seu cartao para garantir continuidade.
          </p>
        </div>

      {/* Step: Select Plan */}
      {step === 'plan' && (
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div className="plans-grid-wrapper" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '20px',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollSnapType: 'x mandatory',
            paddingBottom: '4px',
          }}>
          <style>{`
            @media (max-width: 900px) {
              .plans-grid-wrapper { grid-template-columns: repeat(6, 260px) !important; }
            }
            .plans-grid-wrapper > div { scroll-snap-align: start; }
            .plans-grid-wrapper::-webkit-scrollbar { height: 6px; }
            .plans-grid-wrapper::-webkit-scrollbar-track { background: transparent; }
            .plans-grid-wrapper::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
          `}</style>
            {/* Free Trial card */}
            <div
              onClick={() => {
                const basePlan = plans.find(p => p.is_active && p.price_monthly > 0)
                if (basePlan) {
                  navigate('/checkout', { state: { plan: basePlan, isTrialFlow: true } })
                }
              }}
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '16px',
                padding: '24px',
                border: '2px solid #22c55e',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{
                position: 'absolute',
                top: '-12px',
                right: '16px',
                backgroundColor: '#22c55e',
                color: '#fff',
                padding: '4px 12px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 600,
              }}>
                Gratis
              </div>

              <h3 style={{
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '8px',
              }}>
                Free Trial
              </h3>

              <p style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                marginBottom: '20px',
              }}>
                Teste a plataforma sem compromisso
              </p>

              <div style={{ marginBottom: '20px' }}>
                <span style={{
                  fontSize: '36px',
                  fontWeight: 700,
                  color: '#22c55e',
                }}>
                  R$ 0
                </span>
                <span style={{
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  marginLeft: '4px',
                }}>
                  /mes
                </span>
              </div>

              <div style={{
                padding: '12px',
                backgroundColor: 'rgba(34, 197, 94, 0.06)',
                borderRadius: '10px',
                marginBottom: '20px',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Emails/mes
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    30
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Lojas
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    1
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: '20px', flex: 1 }}>
                {['Sem cartao de credito', '30 emails inclusos', 'Integracao com 1 loja'].map((feature, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px',
                    }}
                  >
                    <Check size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              <button
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#22c55e',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: 'auto',
                }}
              >
                Comecar gratis
                <ArrowRight size={16} />
              </button>
            </div>

            {plans.map((plan) => (
              <div
                key={plan.id}
                onClick={() => handleSelectPlan(plan)}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '16px',
                  padding: '24px',
                  border: plan.is_popular
                    ? '2px solid var(--accent)'
                    : '1px solid var(--border-color)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {plan.is_popular && (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    right: '16px',
                    backgroundColor: '#f59e0b',
                    color: '#fff',
                    padding: '4px 12px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <Star size={12} />
                    Popular
                  </div>
                )}

                <h3 style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '8px',
                }}>
                  {plan.name}
                </h3>

                {plan.description && (
                  <p style={{
                    fontSize: '14px',
                    color: 'var(--text-secondary)',
                    marginBottom: '20px',
                  }}>
                    {plan.description}
                  </p>
                )}

                <div style={{ marginBottom: '20px' }}>
                  {isEnterprisePlan(plan) ? (
                    <span style={{
                      fontSize: '28px',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                    }}>
                      Personalizado
                    </span>
                  ) : (
                    <>
                      <span style={{
                        fontSize: '36px',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                      }}>
                        {formatPrice(plan.price_monthly)}
                      </span>
                      <span style={{
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                        marginLeft: '4px',
                      }}>
                        /mes
                      </span>
                    </>
                  )}
                </div>

                <div style={{
                  padding: '12px',
                  backgroundColor: 'rgba(70, 114, 236, 0.06)',
                  borderRadius: '10px',
                  marginBottom: '20px',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Emails/mes
                    </span>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: plan.emails_limit === null ? '#22c55e' : 'var(--text-primary)',
                    }}>
                      {isEnterprisePlan(plan) || plan.emails_limit === null ? 'Ilimitado' : plan.emails_limit.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Lojas
                    </span>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: plan.shops_limit === null ? '#22c55e' : 'var(--text-primary)',
                    }}>
                      {isEnterprisePlan(plan) || plan.shops_limit === null ? 'Ilimitado' : plan.shops_limit}
                    </span>
                  </div>
                </div>

                {plan.features && plan.features.length > 0 && (
                  <div style={{ marginBottom: '20px', flex: 1 }}>
                    {plan.features.slice(0, 4).map((feature, index) => (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '8px',
                        }}
                      >
                        <Check size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: isEnterprisePlan(plan)
                      ? '#25D366'
                      : plan.is_popular
                        ? 'var(--accent)'
                        : 'var(--bg-primary)',
                    color: isEnterprisePlan(plan) || plan.is_popular ? '#fff' : 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: 'auto',
                  }}
                >
                  {isEnterprisePlan(plan) ? (
                    <>
                      <MessageCircle size={16} />
                      Fale conosco
                    </>
                  ) : (
                    <>
                      Selecionar
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: '32px',
            textAlign: 'center',
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
      )}

      </div>
    </div>
  )
}
