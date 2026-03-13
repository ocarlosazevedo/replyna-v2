import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, User, Loader2, AlertCircle, Info, Check, ShieldCheck, Lock, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCpfCnpj, validateCPF, parseExpiryDate } from '../utils/cardUtils'
import { normalizePlanSlug } from '../utils/plan'
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
  isUpgrade?: boolean
  userId?: string
}

type StepId = 'personal' | 'address' | 'payment'

interface Step {
  id: StepId
  label: string
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
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useState(() => new URLSearchParams(location.search))
  const state = location.state as LocationState | null

  const [plan, setPlan] = useState<Plan | null>(null)
  const [isTrialFlow, setIsTrialFlow] = useState(false)
  const [isUpgrade, setIsUpgrade] = useState(false)
  const [upgradeUserId, setUpgradeUserId] = useState<string | null>(null)

  // Current step
  const [currentStep, setCurrentStep] = useState<StepId>('personal')
  const [direction, setDirection] = useState(1) // 1 = forward, -1 = backward

  // Personal info
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [countryCode, setCountryCode] = useState('+55')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
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
  const refCode = searchParams.get('ref') || ''

  // UI
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [isWide, setIsWide] = useState(window.innerWidth >= 1536)

  // Steps definition - payment step is always included (trial tokenizes card without charging)
  const getSteps = (): Step[] => ([
    { id: 'personal', label: 'Dados pessoais' },
    { id: 'address', label: 'Endereço' },
    { id: 'payment', label: 'Pagamento' },
  ])

  useEffect(() => {
    if (state?.plan) {
      setPlan(state.plan)
      setIsTrialFlow(state.isTrialFlow || false)
      setIsUpgrade(state.isUpgrade || false)
      setUpgradeUserId(state.userId || null)
      sessionStorage.setItem('checkout_plan', JSON.stringify(state.plan))
      sessionStorage.setItem('checkout_trial', String(state.isTrialFlow || false))
      sessionStorage.setItem('checkout_upgrade', String(state.isUpgrade || false))
      sessionStorage.setItem('checkout_upgrade_user_id', state.userId || '')
      return
    }

    const planParam = searchParams.get('plan')
    if (planParam) {
      const loadPlan = async () => {
        // Try by slug first, then by name
        const normalizedParam = normalizePlanSlug(planParam)
        if (normalizedParam === 'partners') {
          navigate('/partners/invite/invalid')
          return
        }

        let { data } = await supabase
          .from('plans')
          .select('id, name, slug, description, price_monthly, emails_limit, shops_limit, features, is_popular, is_active')
          .eq('is_active', true)
          .eq('slug', planParam)
          .maybeSingle()

        if (!data) {
          const res = await supabase
            .from('plans')
            .select('id, name, slug, description, price_monthly, emails_limit, shops_limit, features, is_popular, is_active')
            .eq('is_active', true)
            .ilike('name', planParam)
            .maybeSingle()
          data = res.data
        }

        if (data && normalizePlanSlug(data.slug || data.name) !== 'partners') {
          const isTrial = data.price_monthly === 0
          setPlan(data)
          setIsTrialFlow(isTrial)
          sessionStorage.setItem('checkout_plan', JSON.stringify(data))
          sessionStorage.setItem('checkout_trial', String(isTrial))
        } else {
          window.location.href = 'https://replyna.me'
        }
      }
      loadPlan()
      return
    }

    const savedPlan = sessionStorage.getItem('checkout_plan')
    const savedTrial = sessionStorage.getItem('checkout_trial')
    const savedUpgrade = sessionStorage.getItem('checkout_upgrade')
    const savedUserId = sessionStorage.getItem('checkout_upgrade_user_id')
    if (savedPlan) {
      setPlan(JSON.parse(savedPlan))
      setIsTrialFlow(savedTrial === 'true')
      setIsUpgrade(savedUpgrade === 'true')
      setUpgradeUserId(savedUserId || null)
    } else {
      navigate('/register')
    }
  }, [state, navigate, searchParams])

  // Auto-apply partner coupon from ref link
  useEffect(() => {
    if (!refCode || !plan || isTrialFlow || couponValidation) return
    const code = refCode.toUpperCase().trim()
    // Apply 10% partner discount immediately — backend validates on submission
    setCouponCode(code)
    setCouponValidation({
      is_valid: true,
      coupon_id: null,
      discount_type: 'percentage',
      discount_value: 10,
      error_message: null,
    })
  }, [refCode, plan, isTrialFlow])

  // Pre-fill user data when in upgrade mode
  useEffect(() => {
    if (!isUpgrade || !upgradeUserId) return

    const loadUserData = async () => {
      const { data: profile } = await supabase
        .from('users')
        .select('name, email, whatsapp_number')
        .eq('id', upgradeUserId)
        .single()

      if (profile) {
        if (profile.name) setName(profile.name)
        if (profile.email) setEmail(profile.email)
        if (profile.whatsapp_number) {
          const match = profile.whatsapp_number.match(/^(\+\d{1,4})\s*(.*)$/)
          if (match) {
            setCountryCode(match[1])
            setPhoneNumber(match[2])
          } else {
            setPhoneNumber(profile.whatsapp_number)
          }
        }
      }
    }

    loadUserData()
  }, [isUpgrade, upgradeUserId])

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
      setIsWide(window.innerWidth >= 1536)
    }
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
      if (!email.trim() || !email.includes('@')) return 'Informe um email válido'
      if (!phoneNumber.trim()) return 'Informe seu número de celular'
      const cpfDigits = cpfCnpj.replace(/\D/g, '')
      if (cpfDigits.length === 11 && !validateCPF(cpfCnpj)) return 'CPF inválido'
      if (cpfDigits.length < 11) return 'Informe seu CPF completo'
      if (isTrialFlow && !isUpgrade) {
        if (password.trim().length < 8) return 'A senha deve ter pelo menos 8 caracteres'
        if (password !== confirmPassword) return 'As senhas não coincidem'
      }
    }
    if (stepId === 'address') {
      if (!isInternational && !address.cep) return 'Informe o CEP'
      if (!address.logradouro) return 'Informe o logradouro'
      if (!address.numero) return 'Informe o número'
      if (!address.cidade) return 'Informe a cidade'
      if (!address.estado) return 'Informe o estado'
    }
    if (stepId === 'payment') {
      const cardDigits = card.number.replace(/\D/g, '')
      if (cardDigits.length < 13) return 'Informe o número do cartão completo'
      if (!card.holderName.trim()) return 'Informe o nome no cartão'
      if (card.expiry.length < 5) return 'Informe a validade do cartão'
      if (card.cvv.length < 3) return 'Informe o CVV'
      const { month, year } = parseExpiryDate(card.expiry)
      const expMonth = parseInt(month)
      const expYear = parseInt(year)
      if (expMonth < 1 || expMonth > 12) return 'Mês de validade inválido'
      const now = new Date()
      const expDate = new Date(expYear, expMonth - 1)
      if (expDate < now) return 'Cartão expirado'
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
      navigate(isUpgrade ? '/account' : '/register')
    }
  }

  const handleSubmit = async () => {
    if (!plan) return

    // All steps already validated via goNext

    setLoading(true)
    setError('')

    try {
      const cpfDigits = cpfCnpj.replace(/\D/g, '')
      const { month: expiryMonth, year: expiryYear } = parseExpiryDate(card.expiry)

      // === UPGRADE FLOW: usuario ja existe, criar assinatura com cartao ===
      if (isUpgrade && upgradeUserId) {
        const upgradeBody: Record<string, unknown> = {
          user_id: upgradeUserId,
          plan_id: plan.id,
          user_email: email,
          user_name: name,
          whatsapp_number: getFullPhoneNumber() || undefined,
          creditCard: {
            holderName: card.holderName,
            number: card.number.replace(/\D/g, ''),
            expiryMonth,
            expiryYear,
            ccv: card.cvv,
          },
          creditCardHolderInfo: {
            name: card.holderName || name,
            email,
            cpfCnpj: cpfDigits,
            postalCode: address.cep.replace(/\D/g, ''),
            addressNumber: address.numero,
            phone: phoneNumber.replace(/\D/g, ''),
            addressComplement: address.complemento || undefined,
          },
        }

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upgrade-with-checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(upgradeBody),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao processar pagamento')
        }

        // Limpar sessionStorage do checkout
        sessionStorage.removeItem('checkout_plan')
        sessionStorage.removeItem('checkout_trial')
        sessionStorage.removeItem('checkout_upgrade')
        sessionStorage.removeItem('checkout_upgrade_user_id')

        // Redirecionar para conta com mensagem de sucesso
        navigate('/account', { state: { upgradeSuccess: true, planName: plan.name } })
        return
      }

      // === FLUXO NORMAL: novo usuario ===
      const body: Record<string, unknown> = {
        plan_id: plan.id,
        user_email: email,
        user_name: name,
        whatsapp_number: getFullPhoneNumber() || undefined,
        coupon_code: !isTrialFlow && couponValidation?.is_valid ? couponCode.toUpperCase() : undefined,
        is_trial: isTrialFlow || undefined,
      }

      // Always send holder info (needed for Asaas customer creation, even for trial)
      const holderInfo = {
        name: name,
        email,
        cpfCnpj: cpfDigits,
        postalCode: address.cep.replace(/\D/g, ''),
        addressNumber: address.numero,
        phone: phoneNumber.replace(/\D/g, ''),
        addressComplement: address.complemento || undefined,
      }

      // Always send card data (trial tokenizes without charging, paid creates subscription)
      if (card.number) {
        body.creditCard = {
          holderName: card.holderName,
          number: card.number.replace(/\D/g, ''),
          expiryMonth,
          expiryYear,
          ccv: card.cvv,
        }
        holderInfo.name = card.holderName || name
      }

      body.creditCardHolderInfo = holderInfo

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
        if (data.debug_error) console.error('[Checkout] Asaas raw error:', data.debug_error)
        if (data.debug_info) console.error('[Checkout] Debug info:', JSON.stringify(data.debug_info))
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
        asaas_credit_card_token: data.asaas_credit_card_token || null,
        coupon_id: data.coupon_id || null,
        discount_applied: data.discount_applied || 0,
        partner_id: data.partner_id || null,
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
    padding: '10px 16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
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
      gap: isMobile ? '10px' : '18px',
      marginBottom: '32px',
      flexWrap: 'wrap',
    }}>
      {steps.map((s, index) => {
        const isCompleted = index < currentStepIndex
        const isCurrent = s.id === currentStep
        const circleBg = isCompleted ? '#22c55e' : isCurrent ? 'var(--accent)' : 'var(--bg-card)'
        const circleBorder = isCompleted || isCurrent ? 'transparent' : 'var(--border-color)'
        const circleColor = isCompleted || isCurrent ? '#fff' : 'var(--text-secondary)'

        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px' }}>
            <motion.button
              type="button"
              onClick={() => {
                if (isCompleted) goToStep(s.id)
              }}
              whileHover={isCompleted ? { scale: 1.05 } : {}}
              whileTap={isCompleted ? { scale: 0.95 } : {}}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'transparent',
                border: 'none',
                cursor: isCompleted ? 'pointer' : 'default',
                padding: 0,
                color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontFamily: 'inherit',
              }}
            >
              <motion.span
                initial={false}
                animate={{ backgroundColor: circleBg, borderColor: circleBorder, color: circleColor }}
                transition={{ duration: 0.2 }}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1px solid ${circleBorder}`,
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                {isCompleted ? <Check size={16} /> : index + 1}
              </motion.span>
              {!isMobile && (
                <span style={{ fontSize: '13px', fontWeight: isCurrent ? 700 : 600 }}>
                  {s.label}
                </span>
              )}
            </motion.button>
            {index < steps.length - 1 && (
              <div style={{
                width: isMobile ? '22px' : '40px',
                height: '1px',
                backgroundColor: 'var(--border-color)',
                position: 'relative',
                borderRadius: '999px',
                overflow: 'hidden',
              }}>
                <motion.div
                  initial={false}
                  animate={{ width: isCompleted ? '100%' : '0%' }}
                  transition={{ duration: 0.3 }}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    background: 'linear-gradient(90deg, rgba(70, 114, 236, 1) 0%, rgba(120, 96, 255, 1) 100%)',
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute',
        width: '520px',
        height: '520px',
        top: '-160px',
        right: '-120px',
        background: 'radial-gradient(circle, rgba(70, 114, 236, 0.35) 0%, rgba(70, 114, 236, 0) 70%)',
        filter: 'blur(100px)',
        zIndex: 0,
      }} />
      <div style={{
        position: 'absolute',
        width: '620px',
        height: '620px',
        bottom: '-220px',
        left: '-140px',
        background: 'radial-gradient(circle, rgba(120, 96, 255, 0.32) 0%, rgba(120, 96, 255, 0) 70%)',
        filter: 'blur(120px)',
        zIndex: 0,
      }} />

      <div style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: isWide ? '1400px' : '1280px',
        margin: '0 auto',
        padding: '48px 24px',
      }}>
        {/* Top bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}>
          <a href="https://replyna.me" style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/replyna-logo.webp" alt="Replyna" style={{ height: '40px', width: 'auto' }} />
          </a>
        </div>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '8px', textAlign: 'center' }}
        >
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
            {isTrialFlow ? 'Crie sua conta grátis' : 'Finalize sua assinatura'}
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', margin: '0 0 24px' }}>
            {isTrialFlow
              ? 'Preencha seus dados para começar. Nenhuma cobrança será feita.'
              : 'Preencha seus dados e finalize o pagamento.'}
          </p>
        </motion.div>

        {/* 2-column layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.2fr 0.8fr',
          gap: '32px',
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
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '24px',
            padding: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
            <StepIndicator />

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
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
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
                        Informações da sua conta
                      </p>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Nome completo</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                      style={inputStyle} placeholder="Seu nome" />
                  </div>

                  <div>
                    <label style={labelStyle}>Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      style={inputStyle} placeholder="seu@email.com" />
                  </div>

                  <div>
                    <label style={labelStyle}>Celular / WhatsApp</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}
                        style={{
                          padding: '10px 8px', border: '1px solid rgba(255, 255, 255, 0.1)',
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
                      CPF
                    </label>
                    <input type="text" value={cpfCnpj}
                      onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
                      style={inputStyle}
                      placeholder="000.000.000-00" />
                  </div>

                  {isTrialFlow && !isUpgrade && (
                    <div style={{ marginTop: '20px', display: 'grid', gap: '16px' }}>
                      <div>
                        <label style={labelStyle}>Senha</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ ...inputStyle, paddingRight: '42px' }}
                            placeholder="Mínimo 8 caracteres"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                              position: 'absolute',
                              right: '12px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--text-secondary)',
                              padding: 0,
                            }}
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Confirmar senha</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            style={{ ...inputStyle, paddingRight: '42px' }}
                            placeholder="Repita sua senha"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            style={{
                              position: 'absolute',
                              right: '12px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--text-secondary)',
                              padding: 0,
                            }}
                          >
                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
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
                  <AddressSection embedded address={address} onChange={setAddress} isInternational={isInternational} />

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
                        Cartão internacional detectado. Taxas adicionais podem ser aplicadas.
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
                  {isTrialFlow && (
                    <div style={{
                      padding: '14px 16px',
                      marginBottom: '16px',
                      backgroundColor: 'rgba(34, 197, 94, 0.08)',
                      border: '1px solid rgba(34, 197, 94, 0.2)',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                    }}>
                      <ShieldCheck size={18} style={{ color: '#22c55e', flexShrink: 0, marginTop: '1px' }} />
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        <strong style={{ color: 'var(--text-primary)' }}>Nenhuma cobrança será feita agora.</strong>{' '}
                        Precisamos do cartão apenas para salvar seus dados de pagamento. Você só será cobrado quando o período de teste terminar.
                      </span>
                    </div>
                  )}
                  <CardInput
                    embedded
                    card={card}
                    onChange={setCard}
                    onBrandDetected={() => {}}
                    onInternationalDetected={setIsInternational}
                  >
                    {!isTrialFlow && (
                      <div style={{ marginTop: '20px' }}>
                        <CouponSection
                          planId={plan!.id}
                          onCouponValidated={setCouponValidation}
                          onCouponRemoved={() => { setCouponValidation(null); setCouponCode('') }}
                          onCodeChange={setCouponCode}
                          validation={couponValidation}
                          initialCode={refCode || undefined}
                        />
                      </div>
                    )}
                  </CardInput>
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
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                    fontSize: '14px',
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
                  padding: '10px 24px',
                  borderRadius: '10px',
                  fontWeight: 500,
                  fontSize: '14px',
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
                      {isTrialFlow ? 'Criando conta...' : 'Processando...'}
                    </motion.div>
                  ) : isLastStep ? (
                    <motion.div
                      key="submit"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      {isTrialFlow ? 'Iniciar teste grátis' : `Pagar ${formatPrice(calculateFinalPrice())}/mês`}
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

        <div style={{
          marginTop: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '14px',
          color: 'var(--text-secondary)',
        }}>
          <ShieldCheck size={16} style={{ color: '#22c55e' }} />
          Pagamento seguro processado pelo Asaas · Criptografia SSL
        </div>
      </div>
    </div>
  )
}
