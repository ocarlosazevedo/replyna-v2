import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Moon, ArrowLeft, ArrowRight, User, Loader2, AlertCircle, Info, Check, MapPin, CreditCard, ShieldCheck, Lock } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { formatCpfCnpj, validateCPF, parseExpiryDate } from '../utils/cardUtils'
import CheckoutSidebar from '../components/checkout/CheckoutSidebar'
import AddressSection, { type AddressData } from '../components/checkout/AddressSection'
import CardInput, { type CardData } from '../components/checkout/CardInput'
import CouponSection from '../components/checkout/CouponSection'

interface Plan {
  id: string
  name: string
  description: string | null
  price_monthly: number
  emails_limit: number | null
  shops_limit: number | null
  features: string[]
  is_popular: boolean
  is_active: boolean
}

interface CouponValidation {
  is_valid: boolean
  coupon_id: string | null
  discount_type: 'percentage' | 'fixed_amount' | null
  discount_value: number | null
  error_message: string | null
}

interface LocationState {
  plan: Plan
  isTrialFlow: boolean
}

type StepId = 'personal' | 'address' | 'payment' | 'review'

interface Step {
  id: StepId
  label: string
  icon: typeof User
}

const countryCodes = [
  { code: '+55', label: 'BR +55' },
  { code: '+1', label: 'US +1' },
  { code: '+351', label: 'PT +351' },
  { code: '+44', label: 'UK +44' },
  { code: '+49', label: 'DE +49' },
  { code: '+33', label: 'FR +33' },
  { code: '+39', label: 'IT +39' },
  { code: '+34', label: 'ES +34' },
  { code: '+52', label: 'MX +52' },
  { code: '+54', label: 'AR +54' },
  { code: '+56', label: 'CL +56' },
  { code: '+57', label: 'CO +57' },
]

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 200 : -200,
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -200 : 200,
    opacity: 0,
    scale: 0.98,
  }),
}

export default function Checkout() {
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as LocationState | null

  const [plan, setPlan] = useState<Plan | null>(null)
  const [isTrialFlow, setIsTrialFlow] = useState(false)

  // Current step
  const [currentStep, setCurrentStep] = useState<StepId>('personal')
  const [direction, setDirection] = useState(1) // 1 = forward, -1 = backward

  // Personal info
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [countryCode, setCountryCode] = useState('+55')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [isInternational, setIsInternational] = useState(false)

  // Address
  const [address, setAddress] = useState<AddressData>({
    cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
  })

  // Card
  const [card, setCard] = useState<CardData>({
    number: '', holderName: '', expiry: '', cvv: '',
  })

  // Coupon
  const [couponValidation, setCouponValidation] = useState<CouponValidation | null>(null)
  const [couponCode, setCouponCode] = useState('')

  // UI
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  // Steps definition - trial also collects card (saved for later)
  const getSteps = (): Step[] => {
    const steps: Step[] = [
      { id: 'personal', label: 'Dados', icon: User },
      { id: 'address', label: 'Endereco', icon: MapPin },
      { id: 'payment', label: 'Pagamento', icon: CreditCard },
      { id: 'review', label: 'Revisao', icon: Check },
    ]
    return steps
  }

  useEffect(() => {
    if (state?.plan) {
      setPlan(state.plan)
      setIsTrialFlow(state.isTrialFlow || false)
      sessionStorage.setItem('checkout_plan', JSON.stringify(state.plan))
      sessionStorage.setItem('checkout_trial', String(state.isTrialFlow || false))
    } else {
      const savedPlan = sessionStorage.getItem('checkout_plan')
      const savedTrial = sessionStorage.getItem('checkout_trial')
      if (savedPlan) {
        setPlan(JSON.parse(savedPlan))
        setIsTrialFlow(savedTrial === 'true')
      } else {
        navigate('/register')
      }
    }
  }, [state, navigate])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const getFullPhoneNumber = () => {
    const num = phoneNumber.trim()
    if (!num) return ''
    return `${countryCode} ${num}`
  }

  const calculateFinalPrice = () => {
    if (!plan) return 0
    const basePrice = plan.price_monthly
    let discount = 0
    if (couponValidation?.is_valid && couponValidation.discount_value) {
      if (couponValidation.discount_type === 'percentage') {
        discount = basePrice * (couponValidation.discount_value / 100)
      } else {
        discount = couponValidation.discount_value
      }
    }
    return Math.max(0, basePrice - discount)
  }

  const validateStep = (stepId: StepId): string | null => {
    if (stepId === 'personal') {
      if (!name.trim()) return 'Informe seu nome completo'
      if (!email.trim() || !email.includes('@')) return 'Informe um email valido'
      if (!phoneNumber.trim()) return 'Informe seu numero de celular'
      if (!isInternational) {
        const cpfDigits = cpfCnpj.replace(/\D/g, '')
        if (cpfDigits.length === 11 && !validateCPF(cpfCnpj)) return 'CPF invalido'
        if (cpfDigits.length < 11) return 'Informe seu CPF completo'
      }
    }
    if (stepId === 'address') {
      if (!isInternational && !address.cep) return 'Informe o CEP'
      if (!address.logradouro) return 'Informe o logradouro'
      if (!address.numero) return 'Informe o numero'
      if (!address.cidade) return 'Informe a cidade'
      if (!address.estado) return 'Informe o estado'
    }
    if (stepId === 'payment') {
      const cardDigits = card.number.replace(/\D/g, '')
      if (cardDigits.length < 13) return 'Informe o numero do cartao completo'
      if (!card.holderName.trim()) return 'Informe o nome no cartao'
      if (card.expiry.length < 5) return 'Informe a validade do cartao'
      if (card.cvv.length < 3) return 'Informe o CVV'
      const { month, year } = parseExpiryDate(card.expiry)
      const expMonth = parseInt(month)
      const expYear = parseInt(year)
      if (expMonth < 1 || expMonth > 12) return 'Mes de validade invalido'
      const now = new Date()
      const expDate = new Date(expYear, expMonth - 1)
      if (expDate < now) return 'Cartao expirado'
    }
    return null
  }

  const goToStep = (stepId: StepId) => {
    const steps = getSteps()
    const currentIndex = steps.findIndex(s => s.id === currentStep)
    const targetIndex = steps.findIndex(s => s.id === stepId)
    setDirection(targetIndex > currentIndex ? 1 : -1)
    setCurrentStep(stepId)
    setError('')
  }

  const goNext = () => {
    const validationError = validateStep(currentStep)
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')

    const steps = getSteps()
    const currentIndex = steps.findIndex(s => s.id === currentStep)
    if (currentIndex < steps.length - 1) {
      setDirection(1)
      setCurrentStep(steps[currentIndex + 1].id)
    }
  }

  const goBack = () => {
    const steps = getSteps()
    const currentIndex = steps.findIndex(s => s.id === currentStep)
    if (currentIndex > 0) {
      setDirection(-1)
      setCurrentStep(steps[currentIndex - 1].id)
      setError('')
    } else {
      navigate('/register')
    }
  }

  const handleSubmit = async () => {
    if (!plan) return

    // All steps already validated via goNext

    setLoading(true)
    setError('')

    try {
      const { month: expiryMonth, year: expiryYear } = parseExpiryDate(card.expiry)
      const cpfDigits = cpfCnpj.replace(/\D/g, '')

      const body: Record<string, unknown> = {
        plan_id: plan.id,
        user_email: email,
        user_name: name,
        whatsapp_number: getFullPhoneNumber() || undefined,
        coupon_code: !isTrialFlow && couponValidation?.is_valid ? couponCode.toUpperCase() : undefined,
        is_trial: isTrialFlow || undefined,
      }

      // Always send card data (for trial it's saved for later, not charged)
      if (card.number) {
        body.creditCard = {
          holderName: card.holderName,
          number: card.number.replace(/\D/g, ''),
          expiryMonth,
          expiryYear,
          ccv: card.cvv,
        }
        body.creditCardHolderInfo = {
          name: card.holderName || name,
          email,
          cpfCnpj: cpfDigits,
          postalCode: address.cep.replace(/\D/g, ''),
          addressNumber: address.numero,
          phone: phoneNumber.replace(/\D/g, ''),
          addressComplement: address.complemento || undefined,
        }
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-asaas-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar pagamento')
      }

      localStorage.setItem('pending_registration', JSON.stringify({
        email,
        name,
        whatsapp_number: getFullPhoneNumber() || null,
        plan_id: data.plan_id || plan.id,
        plan_name: data.plan_name || plan.name,
        asaas_customer_id: data.asaas_customer_id,
        asaas_subscription_id: data.asaas_subscription_id,
        coupon_id: data.coupon_id || null,
        discount_applied: data.discount_applied || 0,
        is_trial: data.is_trial || false,
      }))

      navigate('/checkout/success')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar pagamento'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (!plan) {
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

  const steps = getSteps()
  const currentStepIndex = steps.findIndex(s => s.id === currentStep)
  const isLastStep = currentStepIndex === steps.length - 1
  const formatPrice = (price: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(price)

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid var(--input-border)',
    borderRadius: '10px',
    fontSize: '15px',
    boxSizing: 'border-box',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--text-primary)',
    outline: 'none',
    fontFamily: 'inherit',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
  }

  // Step indicator component
  const StepIndicator = () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '4px',
      marginBottom: '32px',
    }}>
      {steps.map((s, index) => {
        const isCompleted = index < currentStepIndex
        const isCurrent = s.id === currentStep
        const Icon = s.icon

        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <motion.button
              type="button"
              onClick={() => {
                if (isCompleted) goToStep(s.id)
              }}
              whileHover={isCompleted ? { scale: 1.05 } : {}}
              whileTap={isCompleted ? { scale: 0.95 } : {}}
              animate={{
                backgroundColor: isCurrent
                  ? 'var(--accent)'
                  : isCompleted
                    ? 'rgba(34, 197, 94, 0.1)'
                    : 'var(--bg-card)',
              }}
              transition={{ duration: 0.3 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '999px',
                border: 'none',
                cursor: isCompleted ? 'pointer' : 'default',
                backgroundColor: isCurrent
                  ? 'var(--accent)'
                  : isCompleted
                    ? 'rgba(34, 197, 94, 0.1)'
                    : 'var(--bg-card)',
                color: isCurrent
                  ? '#fff'
                  : isCompleted
                    ? '#22c55e'
                    : 'var(--text-secondary)',
                fontFamily: 'inherit',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'color 0.3s ease',
              }}
            >
              <AnimatePresence mode="wait">
                {isCompleted ? (
                  <motion.div
                    key="check"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    style={{ display: 'flex' }}
                  >
                    <Check size={14} />
                  </motion.div>
                ) : (
                  <motion.div key="icon" style={{ display: 'flex' }}>
                    <Icon size={14} />
                  </motion.div>
                )}
              </AnimatePresence>
              {!isMobile && s.label}
            </motion.button>
            {index < steps.length - 1 && (
              <div style={{
                width: isMobile ? '16px' : '32px',
                height: '2px',
                borderRadius: '1px',
                overflow: 'hidden',
                backgroundColor: 'var(--border-color)',
                position: 'relative',
              }}>
                <motion.div
                  initial={false}
                  animate={{ width: isCompleted ? '100%' : '0%' }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                  style={{
                    position: 'absolute', top: 0, left: 0, height: '100%',
                    backgroundColor: '#22c55e', borderRadius: '1px',
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  // Review step content
  const ReviewStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      {/* Personal info summary */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '20px 24px',
        border: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Dados pessoais</h4>
          <button
            type="button"
            onClick={() => goToStep('personal')}
            style={{
              background: 'none', border: 'none', color: 'var(--accent)',
              cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit',
            }}
          >
            Editar
          </button>
        </div>
        <div style={{ display: 'grid', gap: '6px' }}>
          <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{name}</span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{email}</span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{getFullPhoneNumber()}</span>
          {cpfCnpj && <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{cpfCnpj}</span>}
        </div>
      </div>

      {/* Address summary */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '20px 24px',
        border: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Endereco</h4>
          <button
            type="button"
            onClick={() => goToStep('address')}
            style={{
              background: 'none', border: 'none', color: 'var(--accent)',
              cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit',
            }}
          >
            Editar
          </button>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {address.logradouro}, {address.numero}
          {address.complemento && ` - ${address.complemento}`}<br />
          {address.bairro && `${address.bairro} - `}{address.cidade}/{address.estado}<br />
          CEP: {address.cep}
        </div>
      </div>

      {/* Card summary */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '20px 24px',
        border: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Cartao</h4>
          <button
            type="button"
            onClick={() => goToStep('payment')}
            style={{
              background: 'none', border: 'none', color: 'var(--accent)',
              cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit',
            }}
          >
            Editar
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CreditCard size={18} style={{ color: 'var(--text-secondary)' }} />
          <div>
            <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
              **** **** **** {card.number.replace(/\D/g, '').slice(-4)}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '12px' }}>
              {card.holderName}
            </span>
          </div>
        </div>
      </div>

      {/* Coupon - only for paid */}
      {!isTrialFlow && (
        <CouponSection
          planId={plan!.id}
          onCouponValidated={setCouponValidation}
          onCouponRemoved={() => { setCouponValidation(null); setCouponCode('') }}
          onCodeChange={setCouponCode}
          validation={couponValidation}
        />
      )}

      {/* Price summary */}
      {!isTrialFlow && (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '20px 24px',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Plano {plan!.name}</span>
            <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{formatPrice(plan!.price_monthly)}/mes</span>
          </div>
          {couponValidation?.is_valid && couponValidation.discount_value && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#22c55e' }}>Desconto</span>
              <span style={{ fontSize: '14px', color: '#22c55e', fontWeight: 600 }}>
                -{couponValidation.discount_type === 'percentage'
                  ? formatPrice(plan!.price_monthly * couponValidation.discount_value / 100)
                  : formatPrice(couponValidation.discount_value)}
              </span>
            </div>
          )}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            paddingTop: '12px', borderTop: '1px solid var(--border-color)',
          }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Total</span>
            <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatPrice(calculateFinalPrice())}/mes
            </span>
          </div>
        </div>
      )}

    </motion.div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 24px',
        maxWidth: '1100px',
        margin: '0 auto',
      }}>
        <Link to="/register" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/replyna-logo.webp" alt="Replyna" style={{ width: '120px', height: 'auto' }} />
        </Link>
        <button
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
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
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </div>

      {/* Content */}
      <div style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '0 20px 60px',
      }}>
        {/* Back button */}
        <button
          onClick={goBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            marginBottom: '24px',
            padding: 0,
            fontSize: '14px',
            fontFamily: 'inherit',
          }}
        >
          <ArrowLeft size={16} />
          {currentStepIndex === 0 ? 'Voltar para planos' : 'Voltar'}
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '8px', textAlign: 'center' }}
        >
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
            {isTrialFlow ? 'Crie sua conta gratis' : 'Finalize sua assinatura'}
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', margin: '0 0 24px' }}>
            {isTrialFlow
              ? 'Preencha seus dados para comecar a usar a Replyna.'
              : 'Preencha seus dados e finalize o pagamento.'}
          </p>
        </motion.div>

        {/* Step indicator */}
        <StepIndicator />

        {/* 2-column layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 340px',
          gap: '24px',
          alignItems: 'start',
        }}>
          {/* Sidebar on mobile (top) */}
          {isMobile && (
            <CheckoutSidebar
              plan={plan}
              isTrialFlow={isTrialFlow}
              couponValidation={couponValidation}
              isMobile
            />
          )}

          {/* Left: Step content */}
          <div>
            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '20px',
                  }}
                >
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step content with slide animation */}
            <AnimatePresence mode="wait" custom={direction}>
              {currentStep === 'personal' && (
                <motion.div
                  key="personal"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px',
                      backgroundColor: 'rgba(70, 114, 236, 0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <User size={18} style={{ color: 'var(--accent)' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        Dados pessoais
                      </h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                        Informacoes da sua conta
                      </p>
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>Nome completo</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                      style={inputStyle} placeholder="Seu nome" />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      style={inputStyle} placeholder="seu@email.com" />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>Celular / WhatsApp</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}
                        style={{
                          padding: '12px 8px', border: '1px solid var(--input-border)',
                          borderRadius: '10px', fontSize: '15px', backgroundColor: 'var(--input-bg)',
                          color: 'var(--text-primary)', minWidth: '110px', fontFamily: 'inherit',
                        }}>
                        {countryCodes.map((c) => (
                          <option key={c.code} value={c.code}>{c.label}</option>
                        ))}
                      </select>
                      <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
                        style={{ ...inputStyle, flex: 1 }} placeholder="11 99999-9999" />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>
                      {isInternational ? 'Tax ID (optional)' : 'CPF ou CNPJ'}
                    </label>
                    <input type="text" value={cpfCnpj}
                      onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
                      style={inputStyle}
                      placeholder={isInternational ? 'Tax ID' : '000.000.000-00'} />
                  </div>
                </motion.div>
              )}

              {currentStep === 'address' && (
                <motion.div
                  key="address"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                >
                  <AddressSection address={address} onChange={setAddress} isInternational={isInternational} />

                  {isInternational && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      style={{
                        padding: '14px 16px', marginTop: '16px',
                        backgroundColor: 'rgba(245, 158, 11, 0.08)',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        borderRadius: '12px', display: 'flex', alignItems: 'flex-start', gap: '10px',
                      }}
                    >
                      <Info size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '1px' }} />
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        Cartao internacional detectado. Taxas adicionais podem ser aplicadas.
                      </span>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {currentStep === 'payment' && (
                <motion.div
                  key="payment"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                >
                  <CardInput
                    card={card}
                    onChange={setCard}
                    onBrandDetected={() => {}}
                    onInternationalDetected={setIsInternational}
                  />
                </motion.div>
              )}

              {currentStep === 'review' && (
                <motion.div
                  key="review"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                >
                  <ReviewStep />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation buttons */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '24px',
            }}>
              {currentStepIndex > 0 && (
                <motion.button
                  type="button"
                  onClick={goBack}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  style={{
                    flex: '0 0 auto',
                    padding: '14px 24px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '15px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontFamily: 'inherit',
                  }}
                >
                  <ArrowLeft size={16} />
                  Voltar
                </motion.button>
              )}

              <motion.button
                type="button"
                onClick={isLastStep ? handleSubmit : goNext}
                disabled={loading}
                whileHover={!loading ? { scale: 1.015, boxShadow: isLastStep
                  ? isTrialFlow
                    ? '0 8px 24px rgba(34, 197, 94, 0.3)'
                    : '0 8px 24px rgba(70, 114, 236, 0.3)'
                  : '0 8px 24px rgba(70, 114, 236, 0.3)'
                } : {}}
                whileTap={!loading ? { scale: 0.985 } : {}}
                style={{
                  flex: 1,
                  backgroundColor: isLastStep
                    ? isTrialFlow ? '#22c55e' : 'var(--accent)'
                    : 'var(--accent)',
                  color: '#ffffff',
                  padding: '14px 24px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '15px',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.85 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontFamily: 'inherit',
                  transition: 'opacity 0.3s ease, background-color 0.3s ease',
                  boxShadow: isLastStep
                    ? isTrialFlow
                      ? '0 4px 16px rgba(34, 197, 94, 0.2)'
                      : '0 4px 16px rgba(70, 114, 236, 0.2)'
                    : '0 4px 16px rgba(70, 114, 236, 0.15)',
                }}
              >
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                      {isTrialFlow ? 'Criando conta...' : 'Processando pagamento...'}
                    </motion.div>
                  ) : isLastStep ? (
                    <motion.div
                      key="submit"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <Lock size={15} />
                      {isTrialFlow ? 'Comecar gratis' : 'Finalizar assinatura'}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="next"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      Continuar
                      <ArrowRight size={16} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>

            {/* Security trust bar */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                marginTop: '20px',
                padding: '14px',
                borderRadius: '12px',
                backgroundColor: 'rgba(34, 197, 94, 0.04)',
                border: '1px solid rgba(34, 197, 94, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Lock size={12} style={{ color: '#22c55e' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>SSL 256-bit</span>
              </div>
              <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border-color)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <ShieldCheck size={12} style={{ color: '#22c55e' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {isTrialFlow ? 'Dados protegidos' : 'Pagamento seguro'}
                </span>
              </div>
              <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border-color)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                Cancele quando quiser
              </span>
            </motion.div>
          </div>

          {/* Right: Sidebar (desktop) */}
          {!isMobile && (
            <CheckoutSidebar
              plan={plan}
              isTrialFlow={isTrialFlow}
              couponValidation={couponValidation}
            />
          )}
        </div>
      </div>
    </div>
  )
}
