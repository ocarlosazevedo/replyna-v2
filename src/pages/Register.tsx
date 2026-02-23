import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Sun, Moon, Check, Star, ArrowRight, ArrowLeft, MessageCircle, Tag, X, Loader2 } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'

interface CouponValidation {
  is_valid: boolean
  coupon_id: string | null
  discount_type: 'percentage' | 'fixed_amount' | null
  discount_value: number | null
  error_message: string | null
}

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

  // Step management
  const [step, setStep] = useState<'plan' | 'account'>(preselectedPlan ? 'account' : 'plan')

  // Plans
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [loadingPlans, setLoadingPlans] = useState(true)

  // Form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [countryCode, setCountryCode] = useState('+55')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Coupon
  const [couponCode, setCouponCode] = useState('')
  const [couponValidation, setCouponValidation] = useState<CouponValidation | null>(null)
  const [validatingCoupon, setValidatingCoupon] = useState(false)
  const [showCouponField, setShowCouponField] = useState(false)

  const countryCodes = [
    { code: '+55', label: 'BR +55' },
    { code: '+1', label: 'US +1' },
    { code: '+351', label: 'PT +351' },
    { code: '+44', label: 'UK +44' },
    { code: '+49', label: 'DE +49' },
    { code: '+33', label: 'FR +33' },
    { code: '+39', label: 'IT +39' },
    { code: '+34', label: 'ES +34' },
    { code: '+31', label: 'NL +31' },
    { code: '+48', label: 'PL +48' },
    { code: '+420', label: 'CZ +420' },
    { code: '+43', label: 'AT +43' },
    { code: '+41', label: 'CH +41' },
    { code: '+32', label: 'BE +32' },
    { code: '+46', label: 'SE +46' },
    { code: '+47', label: 'NO +47' },
    { code: '+45', label: 'DK +45' },
    { code: '+358', label: 'FI +358' },
    { code: '+353', label: 'IE +353' },
    { code: '+61', label: 'AU +61' },
    { code: '+64', label: 'NZ +64' },
    { code: '+91', label: 'IN +91' },
    { code: '+81', label: 'JP +81' },
    { code: '+82', label: 'KR +82' },
    { code: '+86', label: 'CN +86' },
    { code: '+971', label: 'AE +971' },
    { code: '+52', label: 'MX +52' },
    { code: '+54', label: 'AR +54' },
    { code: '+56', label: 'CL +56' },
    { code: '+57', label: 'CO +57' },
    { code: '+507', label: 'PA +507' },
    { code: '+598', label: 'UY +598' },
    { code: '+595', label: 'PY +595' },
    { code: '+27', label: 'ZA +27' },
    { code: '+234', label: 'NG +234' },
    { code: '+90', label: 'TR +90' },
    { code: '+7', label: 'RU +7' },
    { code: '+380', label: 'UA +380' },
    { code: '+30', label: 'GR +30' },
    { code: '+36', label: 'HU +36' },
    { code: '+40', label: 'RO +40' },
    { code: '+359', label: 'BG +359' },
    { code: '+385', label: 'HR +385' },
    { code: '+65', label: 'SG +65' },
    { code: '+60', label: 'MY +60' },
    { code: '+66', label: 'TH +66' },
    { code: '+63', label: 'PH +63' },
    { code: '+62', label: 'ID +62' },
    { code: '+84', label: 'VN +84' },
    { code: '+20', label: 'EG +20' },
    { code: '+212', label: 'MA +212' },
    { code: '+972', label: 'IL +972' },
  ]

  const getFullPhoneNumber = () => {
    const num = phoneNumber.trim()
    if (!num) return ''
    return `${countryCode} ${num}`
  }

  useEffect(() => {
    loadPlans()
  }, [])

  useEffect(() => {
    if (preselectedPlan && plans.length > 0) {
      // Normaliza ambos os lados: remove espaços/hífens e compara em lowercase
      const normalizedPreselected = preselectedPlan.toLowerCase().replace(/[-\s]/g, '')
      const plan = plans.find(p => p.name.toLowerCase().replace(/[-\s]/g, '') === normalizedPreselected)
      if (plan) {
        setSelectedPlan(plan)
        setStep('account')
      }
    }
  }, [preselectedPlan, plans])

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
    // If Enterprise plan, open WhatsApp instead of going to account form
    if (isEnterprisePlan(plan)) {
      window.open('https://wa.me/5531973210191?text=Olá! Tenho interesse no plano Enterprise da Replyna.', '_blank')
      return
    }
    setSelectedPlan(plan)
    setStep('account')
  }

  const validateCoupon = async () => {
    if (!couponCode.trim()) return

    setValidatingCoupon(true)
    setCouponValidation(null)

    try {
      const { data, error } = await supabase.rpc('validate_coupon', {
        p_code: couponCode.toUpperCase(),
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_plan_id: selectedPlan?.id || null,
      })

      if (error) throw error

      if (data && data[0]) {
        setCouponValidation(data[0] as CouponValidation)
      }
    } catch (err) {
      console.error('Erro ao validar cupom:', err)
      setCouponValidation({
        is_valid: false,
        coupon_id: null,
        discount_type: null,
        discount_value: null,
        error_message: 'Erro ao validar cupom',
      })
    } finally {
      setValidatingCoupon(false)
    }
  }

  const clearCoupon = () => {
    setCouponCode('')
    setCouponValidation(null)
    setShowCouponField(false)
  }

  const getDiscountedPrice = () => {
    if (!selectedPlan || !couponValidation?.is_valid) return null

    if (couponValidation.discount_type === 'percentage') {
      const discount = (selectedPlan.price_monthly * (couponValidation.discount_value || 0)) / 100
      return selectedPlan.price_monthly - discount
    } else if (couponValidation.discount_type === 'fixed_amount') {
      return Math.max(0, selectedPlan.price_monthly - (couponValidation.discount_value || 0))
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!phoneNumber.trim()) {
      setError('Informe seu número de celular/WhatsApp')
      return
    }

    if (!selectedPlan) {
      setError('Selecione um plano')
      return
    }

    if (!selectedPlan.is_active || selectedPlan.price_monthly === 0) {
      setError('Este plano nao esta disponivel para pagamento. Entre em contato com o suporte.')
      return
    }

    setLoading(true)

    try {
      // Chamar Edge Function para criar assinatura no Asaas
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-asaas-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          plan_id: selectedPlan.id,
          user_email: email,
          user_name: name,
          whatsapp_number: getFullPhoneNumber() || undefined,
          coupon_code: couponValidation?.is_valid ? couponCode.toUpperCase() : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar sessao de pagamento')
      }

      // Salvar dados temporários no localStorage para recuperar após checkout
      localStorage.setItem('pending_registration', JSON.stringify({
        email,
        name,
        whatsapp_number: getFullPhoneNumber() || null,
        plan_id: selectedPlan.id,
        plan_name: selectedPlan.name,
      }))

      // Redirecionar para o pagamento do Asaas (ou login se pagamento instantaneo)
      if (data.url) {
        window.location.href = data.url
      } else {
        // Pagamento confirmado instantaneamente, redirecionar para sucesso
        window.location.href = '/checkout/success'
      }

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar'
      setError(errorMessage)
      setLoading(false)
    }
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
        <Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
          <img
            src="/replyna-logo.webp"
            alt="Replyna"
            style={{ width: '120px', height: 'auto' }}
          />
        </Link>
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
            {step === 'plan' ? 'Escolha seu plano' : 'Finalize seu cadastro'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
            {step === 'plan'
              ? 'Selecione o plano ideal para o seu negocio'
              : `Plano ${selectedPlan?.name} selecionado`}
          </p>

          {/* Step indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '24px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 600,
              }}>
                {step === 'account' ? <Check size={14} /> : '1'}
              </div>
              <span style={{
                fontSize: '14px',
                fontWeight: step === 'plan' ? 600 : 400,
                color: 'var(--text-primary)',
              }}>
                Plano
              </span>
            </div>
            <div style={{
              width: '40px',
              height: '2px',
              backgroundColor: step === 'account' ? 'var(--accent)' : 'var(--border-color)',
            }} />
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: step === 'account' ? 'var(--accent)' : 'var(--border-color)',
                color: step === 'account' ? '#fff' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 600,
              }}>
                2
              </div>
              <span style={{
                fontSize: '14px',
                fontWeight: step === 'account' ? 600 : 400,
                color: step === 'account' ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}>
                Cadastro
              </span>
            </div>
          </div>
        </div>

      {/* Step: Select Plan */}
      {step === 'plan' && (
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '20px',
          }}>
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
                  <div style={{ marginBottom: '20px' }}>
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

      {/* Step: Account Details */}
      {step === 'account' && selectedPlan && (
        <div style={{
          maxWidth: '480px',
          margin: '0 auto',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid var(--border-color)',
        }}>
          {/* Back button */}
          <button
            onClick={() => setStep('plan')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              marginBottom: '20px',
              padding: 0,
              fontSize: '14px',
            }}
          >
            <ArrowLeft size={16} />
            Voltar para planos
          </button>

          {/* Selected plan summary */}
          <div style={{
            padding: '16px',
            backgroundColor: 'rgba(70, 114, 236, 0.06)',
            borderRadius: '12px',
            marginBottom: '16px',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}>
                  Plano {selectedPlan.name}
                </div>
                <div style={{ fontSize: '13px', color: selectedPlan.emails_limit === null ? '#22c55e' : 'var(--text-secondary)' }}>
                  {selectedPlan.emails_limit === null ? 'Emails ilimitados' : `${selectedPlan.emails_limit.toLocaleString('pt-BR')} emails/mes`}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {couponValidation?.is_valid && getDiscountedPrice() !== null ? (
                  <>
                    <div style={{
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      textDecoration: 'line-through',
                    }}>
                      {formatPrice(selectedPlan.price_monthly)}
                    </div>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: 700,
                      color: '#22c55e',
                    }}>
                      {formatPrice(getDiscountedPrice()!)}/mes
                    </div>
                  </>
                ) : (
                  <div style={{
                    fontSize: '20px',
                    fontWeight: 700,
                    color: 'var(--accent)',
                  }}>
                    {formatPrice(selectedPlan.price_monthly)}/mes
                  </div>
                )}
              </div>
            </div>

            {couponValidation?.is_valid && (
              <div style={{
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-color)',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Tag size={14} style={{ color: '#22c55e' }} />
                    <span style={{ fontSize: '13px', color: '#22c55e', fontWeight: 600 }}>
                      {couponCode.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      ({couponValidation.discount_type === 'percentage'
                        ? `${couponValidation.discount_value}% off`
                        : `R$ ${couponValidation.discount_value?.toFixed(2)} off`})
                    </span>
                  </div>
                  <button
                  type="button"
                  onClick={clearCoupon}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <X size={16} />
                </button>
                </div>
                <div style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <Check size={12} style={{ color: '#22c55e' }} />
                  Cupom sera aplicado automaticamente no checkout
                </div>
              </div>
            )}
          </div>

          {/* Coupon field */}
          {!couponValidation?.is_valid && (
            <div style={{ marginBottom: '24px' }}>
              {!showCouponField ? (
                <button
                  type="button"
                  onClick={() => setShowCouponField(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '14px',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Tag size={14} />
                  Tem um cupom de desconto?
                </button>
              ) : (
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'var(--text-secondary)',
                    marginBottom: '8px',
                  }}>
                    Cupom de desconto
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase())
                        setCouponValidation(null)
                      }}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        border: couponValidation?.is_valid === false
                          ? '1px solid #ef4444'
                          : '1px solid var(--input-border)',
                        borderRadius: '10px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        backgroundColor: 'var(--input-bg)',
                        color: 'var(--text-primary)',
                        textTransform: 'uppercase',
                        fontFamily: 'monospace',
                      }}
                      placeholder="CODIGO"
                    />
                    <button
                      type="button"
                      onClick={validateCoupon}
                      disabled={validatingCoupon || !couponCode.trim()}
                      style={{
                        padding: '12px 20px',
                        borderRadius: '10px',
                        border: 'none',
                        backgroundColor: 'var(--accent)',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '14px',
                        cursor: validatingCoupon || !couponCode.trim() ? 'not-allowed' : 'pointer',
                        opacity: validatingCoupon || !couponCode.trim() ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {validatingCoupon ? (
                        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        'Aplicar'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCouponField(false)
                        setCouponCode('')
                        setCouponValidation(null)
                      }}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {couponValidation?.is_valid === false && (
                    <p style={{
                      marginTop: '8px',
                      fontSize: '13px',
                      color: '#ef4444',
                    }}>
                      {couponValidation.error_message || 'Cupom invalido'}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                padding: '12px',
                borderRadius: '10px',
                fontSize: '14px',
                marginBottom: '16px',
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--text-secondary)',
                marginBottom: '8px',
              }}>
                Nome completo
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid var(--input-border)',
                  borderRadius: '10px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                }}
                placeholder="Seu nome"
                required
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--text-secondary)',
                marginBottom: '8px',
              }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid var(--input-border)',
                  borderRadius: '10px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                }}
                placeholder="seu@email.com"
                required
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--text-secondary)',
                marginBottom: '8px',
              }}>
                Número de Celular
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  style={{
                    padding: '12px 8px',
                    border: '1px solid var(--input-border)',
                    borderRadius: '10px',
                    fontSize: '16px',
                    backgroundColor: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    minWidth: '110px',
                  }}
                >
                  {countryCodes.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: '1px solid var(--input-border)',
                    borderRadius: '10px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="11 99999-9999"
                  required
                />
              </div>
              <span style={{
                display: 'block',
                marginTop: '6px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
              }}>
                Para receber notificações sobre sua conta
              </span>
            </div>

            <div style={{
              padding: '16px',
              backgroundColor: 'rgba(70, 114, 236, 0.06)',
              borderRadius: '12px',
              marginBottom: '24px',
            }}>
              <p style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                margin: 0,
              }}>
                Apos o pagamento, enviaremos um email para voce definir sua senha de acesso.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                backgroundColor: 'var(--accent)',
                color: '#ffffff',
                padding: '14px',
                borderRadius: '10px',
                fontWeight: '600',
                fontSize: '16px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {loading ? (
                'Redirecionando para pagamento...'
              ) : (
                <>
                  Continuar para pagamento
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <p style={{
              marginTop: '16px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              textAlign: 'center',
            }}>
              Pagamento seguro processado pelo Asaas
            </p>
          </form>

          <div style={{
            marginTop: '24px',
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
