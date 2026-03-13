import { useMemo, useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { supabase } from '../lib/supabase'
import { useTeamContext } from '../hooks/useTeamContext'
import { getPlanDisplayName, normalizePlanSlug } from '../utils/plan'

interface UserProfile {
  name: string | null
  email: string | null
  plan: string | null
  emails_limit: number | null
  emails_used: number | null
  shops_limit: number | null
  created_at: string | null
  extra_emails_purchased: number | null
  extra_emails_used: number | null
  extra_email_price: number | null
  extra_email_package_size: number | null
  whatsapp_number: string | null
  is_trial: boolean | null
  trial_started_at: string | null
  trial_ends_at: string | null
}

interface PendingInvoice {
  id: string
  asaas_invoice_url: string | null
  package_size: number
  total_amount: number
  status: string
  created_at: string
}

interface SubscriptionInfo {
  current_period_end: string | null
  status: string | null
  cancel_at_period_end?: boolean | null
}

const formatNumber = (value: number) =>
  new Intl.NumberFormat('pt-BR').format(value)

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)

const calculateRenewalDate = (createdAt: string | null) => {
  if (!createdAt) return null
  const created = new Date(createdAt)
  const today = new Date()
  const renewal = new Date(created)
  while (renewal <= today) {
    renewal.setMonth(renewal.getMonth() + 1)
  }
  return renewal
}

const Skeleton = ({ height = 16, width = '100%' }: { height?: number | string; width?: number | string }) => (
  <div
    style={{
      width,
      height,
      backgroundColor: 'var(--border-color)',
      borderRadius: 8,
      animation: 'replyna-pulse 1.6s ease-in-out infinite',
    }}
  />
)

export default function Account() {
  console.log('🔄 Account.tsx carregado - versão 4 (checkout upgrade)')
  const { user } = useAuth()
  const { isTeamContext, hasPermission } = useTeamContext()
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const canSeeBilling = !isTeamContext || hasPermission('billing', 'read')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [emailChangeLoading, setEmailChangeLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [countryCode, setCountryCode] = useState('+55')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [shopsCount, setShopsCount] = useState<number>(0)

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

  const parsePhoneNumber = (fullNumber: string) => {
    if (!fullNumber) return { code: '+55', number: '' }
    const match = fullNumber.match(/^(\+\d{1,4})\s*(.*)$/)
    if (match) {
      const matchedCode = countryCodes.find(c => c.code === match[1])
      if (matchedCode) return { code: match[1], number: match[2] }
    }
    // Tentar match por códigos mais longos primeiro
    const sorted = [...countryCodes].sort((a, b) => b.code.length - a.code.length)
    for (const c of sorted) {
      if (fullNumber.startsWith(c.code)) {
        return { code: c.code, number: fullNumber.slice(c.code.length).trim() }
      }
    }
    return { code: '+55', number: fullNumber.replace(/^\+/, '') }
  }

  const getFullPhoneNumber = () => {
    const num = phoneNumber.trim()
    if (!num) return ''
    return `${countryCode} ${num}`
  }

  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([])
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null)
  const [buyingExtras, setBuyingExtras] = useState(false)
  const [openingBillingPortal, setOpeningBillingPortal] = useState(false)
  const [updatingPaymentMethod, setUpdatingPaymentMethod] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [cardForm, setCardForm] = useState({
    holderName: '',
    number: '',
    expiryMonth: '',
    expiryYear: '',
    ccv: '',
    cpfCnpj: '',
    postalCode: '',
    addressNumber: '',
    phone: '',
  })
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null)

  // Mostrar mensagem de sucesso se veio do checkout de upgrade
  useEffect(() => {
    const state = location.state as { upgradeSuccess?: boolean; planName?: string } | null
    if (state?.upgradeSuccess) {
      setNotice({
        type: 'success',
        message: `Upgrade para o plano ${state.planName || ''} realizado com sucesso!`,
      })
      // Limpar o state para nao mostrar novamente
      window.history.replaceState({}, '')
    }
  }, [location.state])

  // Função para abrir a ultima fatura do Asaas
  const handleOpenBillingPortal = async () => {
    if (!user || openingBillingPortal) return

    setOpeningBillingPortal(true)
    setNotice(null)

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-billing-portal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ user_id: user.id }),
        }
      )

      const data = await response.json()

      if (data.success && data.url) {
        // Abrir ultima fatura
        window.location.href = data.url
      } else {
        throw new Error(data.error || 'Nenhuma fatura encontrada')
      }
    } catch (err) {
      console.error('Erro ao abrir fatura:', err)
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao abrir fatura. Tente novamente.',
      })
    } finally {
      setOpeningBillingPortal(false)
    }
  }

  // Função para atualizar método de pagamento via API do Asaas
  const handleUpdatePaymentMethod = async () => {
    if (!user || updatingPaymentMethod) return

    // Validar campos obrigatórios
    if (!cardForm.holderName || !cardForm.number || !cardForm.expiryMonth || !cardForm.expiryYear || !cardForm.ccv) {
      setNotice({ type: 'error', message: 'Preencha todos os dados do cartão.' })
      return
    }
    if (!cardForm.cpfCnpj || !cardForm.postalCode || !cardForm.addressNumber || !cardForm.phone) {
      setNotice({ type: 'error', message: 'Preencha todos os dados do titular.' })
      return
    }

    setUpdatingPaymentMethod(true)
    setNotice(null)

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-payment-method`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            user_id: user.id,
            credit_card: {
              holderName: cardForm.holderName,
              number: cardForm.number,
              expiryMonth: cardForm.expiryMonth,
              expiryYear: cardForm.expiryYear,
              ccv: cardForm.ccv,
            },
            credit_card_holder_info: {
              cpfCnpj: cardForm.cpfCnpj,
              postalCode: cardForm.postalCode,
              addressNumber: cardForm.addressNumber,
              phone: cardForm.phone,
            },
          }),
        }
      )

      const data = await response.json()

      if (data.success) {
        setShowPaymentModal(false)
        setCardForm({ holderName: '', number: '', expiryMonth: '', expiryYear: '', ccv: '', cpfCnpj: '', postalCode: '', addressNumber: '', phone: '' })
        setNotice({
          type: 'success',
          message: 'Cartão atualizado com sucesso! O novo cartão será usado nas próximas cobranças.',
        })
      } else if (data.no_subscription) {
        // Usuario sem assinatura ativa - direcionar para selecionar um plano
        setShowPaymentModal(false)
        setCardForm({ holderName: '', number: '', expiryMonth: '', expiryYear: '', ccv: '', cpfCnpj: '', postalCode: '', addressNumber: '', phone: '' })
        navigate('/plans')
      } else {
        throw new Error(data.error || 'Erro ao atualizar cartão.')
      }
    } catch (err) {
      console.error('Erro ao atualizar método de pagamento:', err)
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao atualizar cartão. Verifique os dados e tente novamente.',
      })
    } finally {
      setUpdatingPaymentMethod(false)
    }
  }

  // Função para comprar emails extras manualmente
  const handleBuyExtraEmails = async () => {
    if (!user || buyingExtras) return

    setBuyingExtras(true)
    setNotice(null)

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/charge-extra-emails`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ user_id: user.id }),
        }
      )

      const data = await response.json()

      if (data.success) {
        setNotice({ type: 'success', message: `Pacote de emails extras comprado com sucesso!` })
        // Recarregar perfil para atualizar créditos
        loadProfile()
      } else if (data.invoice_url) {
        // Invoice criada mas precisa de pagamento manual
        setNotice({ type: 'info', message: 'Fatura criada. Redirecionando para pagamento...' })
        window.open(data.invoice_url, '_blank')
        // Recarregar invoices pendentes
        loadPendingInvoices()
      } else if (data.error) {
        // Traduzir erros comuns para mensagens amigáveis
        const errorMessages: Record<string, string> = {
          'Usuario nao encontrado': 'Não foi possível encontrar sua conta. Faça login novamente.',
          'Usuario nao possui customer_id no Asaas': 'Você precisa ter uma assinatura ativa para comprar emails extras. Entre em contato com o suporte.',
          'Plano nao encontrado': 'Não foi possível identificar seu plano. Entre em contato com o suporte.',
          'Plano nao possui cobranca de emails extras': 'Seu plano não permite compra de emails extras.',
        }

        // Verificar se o erro corresponde a alguma mensagem conhecida
        let friendlyMessage = data.error
        for (const [key, message] of Object.entries(errorMessages)) {
          if (data.error.includes(key)) {
            friendlyMessage = message
            break
          }
        }

        throw new Error(friendlyMessage)
      } else {
        throw new Error('Erro ao processar compra. Tente novamente.')
      }
    } catch (err) {
      console.error('Erro ao comprar emails extras:', err)
      setNotice({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao comprar emails extras. Tente novamente.' })
    } finally {
      setBuyingExtras(false)
    }
  }

  // Detectar retorno do Asaas após adicionar método de pagamento
  useEffect(() => {
    if (!user) return

    const urlParams = new URLSearchParams(window.location.search)
    const upgradePending = urlParams.get('upgrade_pending')
    const planId = urlParams.get('plan_id')
    const billingCycle = urlParams.get('billing_cycle')
    const upgradeCancelled = urlParams.get('upgrade_cancelled')

    // Limpar parâmetros da URL
    if (upgradePending || upgradeCancelled) {
      window.history.replaceState({}, '', window.location.pathname)
    }

    if (upgradeCancelled) {
      setNotice({ type: 'info', message: 'Upgrade cancelado.' })
      return
    }

    if (upgradePending && planId) {
      // Continuar o upgrade após adicionar método de pagamento
      const continueUpgrade = async () => {
        setNotice({ type: 'info', message: 'Continuando o upgrade...' })

        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-subscription`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                user_id: user.id,
                new_plan_id: planId,
                billing_cycle: billingCycle || 'monthly',
              }),
            }
          )

          const result = await response.json()

          if (!response.ok) {
            throw new Error(result.error || 'Erro ao completar upgrade')
          }

          if (result.payment_required && result.payment_url) {
            window.location.href = result.payment_url
            return
          }

          setNotice({ type: 'success', message: 'Upgrade realizado com sucesso!' })

          // Recarregar a página para atualizar os dados
          setTimeout(() => window.location.reload(), 1500)
        } catch (err) {
          console.error('Erro ao continuar upgrade:', err)
          const message = err instanceof Error ? err.message : 'Erro ao completar upgrade'
          setNotice({ type: 'error', message })
        }
      }

      continueUpgrade()
    }
  }, [user])

  const loadProfile = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('name, email, plan, emails_limit, emails_used, shops_limit, created_at, extra_emails_purchased, extra_emails_used, whatsapp_number, is_trial, trial_started_at, trial_ends_at')
        .eq('id', user.id)
        .maybeSingle()

      if (error) throw error

      // Se não existir registro na tabela users, criar um (free trial)
      if (!data) {
        const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        const newUserData = {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || null,
          plan: 'Free Trial',
          emails_limit: 30,
          emails_used: 0,
          shops_limit: 1,
          extra_emails_purchased: 0,
          extra_emails_used: 0,
          is_trial: true,
          trial_started_at: new Date().toISOString(),
          trial_ends_at: trialEndsAt,
        }

        const { error: insertError } = await supabase
          .from('users')
          .insert(newUserData)

        if (insertError) {
          console.error('Erro ao criar perfil:', insertError)
        }

        setProfile({
          name: newUserData.name,
          email: newUserData.email || null,
          plan: newUserData.plan,
          emails_limit: newUserData.emails_limit,
          emails_used: newUserData.emails_used,
          shops_limit: newUserData.shops_limit,
          created_at: new Date().toISOString(),
          extra_emails_purchased: newUserData.extra_emails_purchased,
          extra_emails_used: newUserData.extra_emails_used,
          extra_email_price: null,
          extra_email_package_size: null,
          whatsapp_number: null,
          is_trial: true,
          trial_started_at: newUserData.trial_started_at,
          trial_ends_at: newUserData.trial_ends_at,
        })
        setName(newUserData.name || '')
        setEmail(newUserData.email || '')
      } else {
        setProfile({
          ...data,
          extra_email_price: null,
          extra_email_package_size: null,
          whatsapp_number: data.whatsapp_number || null,
          is_trial: data.is_trial ?? false,
          trial_started_at: data.trial_started_at || null,
          trial_ends_at: data.trial_ends_at || null,
        })
        setName(data.name || user.user_metadata?.name || '')
        setEmail(data.email || user.email || '')
        const parsed = parsePhoneNumber(data.whatsapp_number || '')
        setCountryCode(parsed.code)
        setPhoneNumber(parsed.number)
      }

      // Buscar quantidade de lojas integradas
      const { count: shopsIntegrated } = await supabase
        .from('shops')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      setShopsCount(shopsIntegrated || 0)

      // Buscar preço de email extra do plano atual
      const planSlug = normalizePlanSlug(data?.plan || 'starter')
      const { data: planData, error: planError } = await supabase
        .from('plans')
        .select('extra_email_price, extra_email_package_size')
        .eq('slug', planSlug)
        .single()

      console.log('Plan lookup:', { planSlug, planData, planError })

      if (data) {
        setProfile({
          ...data,
          extra_email_price: planData?.extra_email_price ?? 1,
          extra_email_package_size: planData?.extra_email_package_size ?? 100,
          whatsapp_number: data.whatsapp_number || null,
          is_trial: data.is_trial ?? false,
          trial_started_at: data.trial_started_at || null,
          trial_ends_at: data.trial_ends_at || null,
        })
      }
    } catch (err) {
      console.error('Erro ao carregar perfil:', err)
      setNotice({ type: 'error', message: 'Não foi possível carregar suas informações.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    loadProfile()
  }, [user])

  const loadSubscription = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('current_period_end, status, cancel_at_period_end')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      if (data) {
        setSubscriptionInfo({
          current_period_end: data.current_period_end,
          status: data.status,
          cancel_at_period_end: data.cancel_at_period_end,
        })
      }
    } catch (err) {
      console.error('Erro ao carregar assinatura:', err)
    }
  }

  useEffect(() => {
    if (!user) return
    loadSubscription()
  }, [user])

  // Função para carregar invoices pendentes de emails extras
  const loadPendingInvoices = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('email_extra_purchases')
        .select('id, asaas_invoice_url, package_size, total_amount, status, created_at')
        .eq('user_id', user.id)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })

      if (error) throw error
      setPendingInvoices(data || [])
    } catch (err) {
      console.error('Erro ao carregar invoices pendentes:', err)
    }
  }

  useEffect(() => {
    loadPendingInvoices()
  }, [user])

  const renewalDate = useMemo(() => {
    if (subscriptionInfo?.current_period_end) {
      return new Date(subscriptionInfo.current_period_end)
    }
    return calculateRenewalDate(profile?.created_at ?? user?.created_at ?? null)
  }, [subscriptionInfo?.current_period_end, profile?.created_at, user?.created_at])

  const planName = getPlanDisplayName(profile?.plan)
  const emailsLimit = profile?.emails_limit
  const shopsLimit = profile?.shops_limit

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user) return
    if (!isEditing) return

    setSaving(true)
    setNotice(null)

    try {
      const { error: profileError } = await supabase
        .from('users')
        .update({
          name: name.trim(),
          whatsapp_number: getFullPhoneNumber() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      const { error: metaError } = await supabase.auth.updateUser({
        data: { name: name.trim() },
      })
      if (metaError) throw metaError

      setNotice({ type: 'success', message: 'Informações atualizadas com sucesso.' })
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              name: name.trim(),
              whatsapp_number: getFullPhoneNumber() || null,
            }
          : prev
      )
      setIsEditing(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar alterações.'
      setNotice({ type: 'error', message })
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async () => {
    const targetEmail = email.trim() || user?.email
    if (!targetEmail) return
    setResetLoading(true)
    setNotice(null)
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/request-password-reset`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: targetEmail }),
        }
      )
      if (!response.ok) throw new Error('Erro ao enviar email')
      setNotice({ type: 'success', message: 'Link de redefinição enviado para seu email!' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar link. Tente novamente.'
      setNotice({ type: 'error', message })
    } finally {
      setResetLoading(false)
    }
  }

  const handleEmailChange = async () => {
    const currentEmail = profile?.email || user?.email || ''
    const nextEmail = email.trim()
    if (!nextEmail) {
      setNotice({ type: 'error', message: 'Não encontramos um email cadastrado.' })
      return
    }
    if (currentEmail && nextEmail === currentEmail) {
      setNotice({ type: 'info', message: 'Edite o email acima para enviar o link de confirmação.' })
      return
    }
    setEmailChangeLoading(true)
    setNotice(null)
    try {
      const { error } = await supabase.auth.updateUser({ email: nextEmail })
      if (error) throw error
      setNotice({ type: 'success', message: `Link de confirmação enviado para ${nextEmail}.` })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar email.'
      setNotice({ type: 'error', message })
    } finally {
      setEmailChangeLoading(false)
    }
  }

  const handleToggleEdit = () => {
    if (isEditing) {
      setName(profile?.name || user?.user_metadata?.name || '')
      setEmail(profile?.email || user?.email || '')
      const parsed = parsePhoneNumber(profile?.whatsapp_number || '')
      setCountryCode(parsed.code)
      setPhoneNumber(parsed.number)
      setNotice(null)
    }
    setIsEditing((prev) => !prev)
  }

  const handleOpenPlanModal = () => {
    navigate('/plans')
  }

  const handlePayInvoice = async (invoice: PendingInvoice) => {
    if (!user) return
    setPayingInvoiceId(invoice.id)
    setNotice(null)

    try {
      const session = await supabase.auth.getSession()
      const accessToken = session.data.session?.access_token

      if (!accessToken) {
        throw new Error('Sessão expirada. Por favor, faça login novamente.')
      }

      console.log('Pagando invoice:', { purchase_id: invoice.id })

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pay-pending-invoice`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            user_id: user.id,
            purchase_id: invoice.id,
          }),
        }
      )

      console.log('Response status:', response.status)
      const result = await response.json()
      console.log('Response body:', result)

      if (!response.ok) {
        throw new Error(result.error || `Erro ${response.status}: ${response.statusText}`)
      }

      if (result.url) {
        window.location.href = result.url
      } else {
        throw new Error(result.error || 'Erro ao processar pagamento')
      }
    } catch (err: unknown) {
      console.error('Erro ao pagar invoice:', err)
      const message = err instanceof Error ? err.message : 'Erro ao processar pagamento.'

      // Se a fatura não foi encontrada ou já foi paga, recarregar a lista
      if (message.includes('não encontrada') || message.includes('já foi paga')) {
        setNotice({ type: 'success', message: 'Esta fatura já foi paga! Atualizando lista...' })
        await loadPendingInvoices()
        // Recarregar profile para atualizar créditos
        const { data: newProfile } = await supabase
          .from('users')
          .select('name, email, plan, emails_limit, emails_used, shops_limit, created_at, extra_emails_purchased, extra_emails_used, whatsapp_number, is_trial, trial_started_at, trial_ends_at')
          .eq('id', user.id)
          .single()
        if (newProfile) setProfile({
          ...newProfile,
          extra_email_price: profile?.extra_email_price ?? null,
          extra_email_package_size: profile?.extra_email_package_size ?? null,
          is_trial: newProfile.is_trial ?? false,
          trial_started_at: newProfile.trial_started_at || null,
          trial_ends_at: newProfile.trial_ends_at || null,
        })
      } else {
        setNotice({ type: 'error', message })
      }
    } finally {
      setPayingInvoiceId(null)
    }
  }

  // Skeleton loading completo da página
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px' }}>
        {/* Header skeleton */}
        <div>
          <Skeleton height={isMobile ? 28 : 32} width={180} />
          <div style={{ marginTop: 8 }}><Skeleton height={16} width={240} /></div>
        </div>

        {/* Grid skeleton */}
        <div className="replyna-account-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '24px' }}>
          {/* Coluna esquerda - Informações da conta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <section style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)' }}>
              <div style={{ marginBottom: '16px' }}>
                <Skeleton height={20} width="50%" />
                <div style={{ marginTop: 6 }}><Skeleton height={14} width="70%" /></div>
              </div>
              <div style={{ display: 'grid', gap: '16px' }}>
                <Skeleton height={44} />
                <Skeleton height={44} />
                <div style={{ marginTop: 8 }}><Skeleton height={1} /></div>
                <Skeleton height={44} />
                <div style={{ marginTop: 8 }}><Skeleton height={1} /></div>
                <Skeleton height={44} />
              </div>
            </section>
          </div>

          {/* Coluna direita - Plano e Aparência */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Plano e Cobrança */}
            <section style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)' }}>
              <div style={{ marginBottom: '16px' }}>
                <Skeleton height={20} width="60%" />
                <div style={{ marginTop: 6 }}><Skeleton height={14} width="50%" /></div>
              </div>
              <div style={{ display: 'grid', gap: '16px' }}>
                <Skeleton height={120} />
                <Skeleton height={100} />
              </div>
            </section>

            {/* Aparência */}
            <section style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)' }}>
              <div style={{ marginBottom: '16px' }}>
                <Skeleton height={20} width="40%" />
                <div style={{ marginTop: 6 }}><Skeleton height={14} width="60%" /></div>
              </div>
              <Skeleton height={48} />
            </section>
          </div>
        </div>

        <style>
          {`
            @media (max-width: 1024px) {
              .replyna-account-grid {
                grid-template-columns: 1fr !important;
              }
            }
          `}
        </style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px' }}>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? '22px' : '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Minha Conta</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>Gerencie suas informações pessoais</p>
        </div>
        <button
          type="submit"
          form="account-profile-form"
          disabled={!isEditing || saving || loading}
          style={{
            backgroundColor: 'var(--accent)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: !isEditing || saving ? 0.6 : 1,
            display: isEditing ? 'inline-flex' : 'none',
            width: isMobile ? '100%' : 'auto',
            justifyContent: 'center',
          }}
        >
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>

      {notice && (
        <div
          style={{
            backgroundColor:
              notice.type === 'success' ? '#dcfce7' : notice.type === 'error' ? '#fef2f2' : '#e0e7ff',
            color: notice.type === 'success' ? '#166534' : notice.type === 'error' ? '#b91c1c' : '#1e3a8a',
            padding: '12px 16px',
            borderRadius: '10px',
            fontWeight: 600,
          }}
        >
          {notice.message}
        </div>
      )}

      <div className="replyna-account-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <section style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Informações da conta</h2>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>Seus dados e configurações de segurança</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {isEditing && (
                    <button
                      type="submit"
                      form="account-profile-form"
                      disabled={saving}
                      style={{
                        borderRadius: '10px',
                        border: 'none',
                        background: 'var(--accent)',
                        color: '#ffffff',
                        padding: '8px 14px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.7 : 1,
                      }}
                    >
                      {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleToggleEdit}
                    disabled={loading}
                    style={{
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      padding: '8px 14px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isEditing ? 'Cancelar' : 'Editar'}
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                <Skeleton height={44} />
                <Skeleton height={44} />
                <Skeleton height={44} />
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '20px' }}>
                <form id="account-profile-form" onSubmit={handleSave} style={{ display: 'grid', gap: '16px' }}>
                  <label style={{ display: 'grid', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Nome completo</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      disabled={!isEditing}
                      style={{
                        border: `1px solid ${isEditing ? 'var(--input-border)' : 'var(--border-color)'}`,
                        borderRadius: '10px',
                        padding: '12px',
                        fontSize: '14px',
                        backgroundColor: isEditing ? 'var(--input-bg)' : 'var(--bg-primary)',
                        color: isEditing ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: isEditing ? 'text' : 'not-allowed',
                      }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={!isEditing}
                      style={{
                        border: `1px solid ${isEditing ? 'var(--input-border)' : 'var(--border-color)'}`,
                        borderRadius: '10px',
                        padding: '12px',
                        fontSize: '14px',
                        backgroundColor: isEditing ? 'var(--input-bg)' : 'var(--bg-primary)',
                        color: isEditing ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: isEditing ? 'text' : 'not-allowed',
                      }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Número de Celular</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        disabled={!isEditing}
                        style={{
                          border: `1px solid ${isEditing ? 'var(--input-border)' : 'var(--border-color)'}`,
                          borderRadius: '10px',
                          padding: '12px 8px',
                          fontSize: '14px',
                          backgroundColor: isEditing ? 'var(--input-bg)' : 'var(--bg-primary)',
                          color: isEditing ? 'var(--text-primary)' : 'var(--text-secondary)',
                          cursor: isEditing ? 'pointer' : 'not-allowed',
                          minWidth: '110px',
                          appearance: isEditing ? undefined : 'none' as React.CSSProperties['appearance'],
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
                        disabled={!isEditing}
                        placeholder="11 99999-9999"
                        style={{
                          flex: 1,
                          border: `1px solid ${isEditing ? 'var(--input-border)' : 'var(--border-color)'}`,
                          borderRadius: '10px',
                          padding: '12px',
                          fontSize: '14px',
                          backgroundColor: isEditing ? 'var(--input-bg)' : 'var(--bg-primary)',
                          color: isEditing ? 'var(--text-primary)' : 'var(--text-secondary)',
                          cursor: isEditing ? 'text' : 'not-allowed',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Para receber notificações sobre falhas de pagamento</span>
                  </label>
                </form>

                <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />

                <div style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Alterar email</span>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
                      Edite o campo de email acima e clique para enviar o link de confirmação ao novo endereço.
                    </p>
                    <button
                      type="button"
                      onClick={handleEmailChange}
                      disabled={emailChangeLoading}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--accent)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '12px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: emailChangeLoading ? 'not-allowed' : 'pointer',
                        opacity: emailChangeLoading ? 0.7 : 1,
                      }}
                    >
                      {emailChangeLoading ? 'Enviando...' : 'Enviar link de confirmação'}
                    </button>
                  </div>

                  <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />

                  <div style={{ display: 'grid', gap: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Alterar senha</span>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
                      Para alterar sua senha, enviaremos um link de redefinição para seu email cadastrado.
                    </p>
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={resetLoading}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--accent)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '12px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: resetLoading ? 'not-allowed' : 'pointer',
                        opacity: resetLoading ? 0.7 : 1,
                      }}
                    >
                      {resetLoading ? 'Enviando...' : 'Enviar link de redefinição'}
                    </button>
                  </div>
                </div>
              </div>
            )}</section>

        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {canSeeBilling && <section style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)', height: 'fit-content' }}>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Plano e Cobrança</h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>Gerencie sua assinatura</p>
            </div>

            {loading ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                <Skeleton height={120} />
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {profile?.is_trial ? (
                <div style={{ borderRadius: '14px', border: '1px solid #f59e0b', padding: '16px', backgroundColor: 'rgba(245, 158, 11, 0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 700,
                      backgroundColor: '#f59e0b',
                      color: '#ffffff',
                    }}>
                      Período de Teste
                    </span>
                  </div>
                  <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Você possui <strong style={{ color: 'var(--text-primary)' }}>{30 - (profile?.emails_used ?? 0)}</strong> emails restantes no seu período de teste gratuito.
                  </p>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Emails utilizados</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: (profile?.emails_used ?? 0) >= 30 ? '#ef4444' : '#f59e0b' }}>
                        {profile?.emails_used ?? 0} / 30
                      </span>
                    </div>
                    <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(((profile?.emails_used ?? 0) / 30) * 100, 100)}%`,
                          backgroundColor: (profile?.emails_used ?? 0) >= 30 ? '#ef4444' : '#f59e0b',
                          borderRadius: '4px',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                  {(profile?.emails_used ?? 0) >= 30 && (
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      marginBottom: '12px',
                    }}>
                      <p style={{ margin: 0, fontSize: '12px', color: '#ef4444', fontWeight: 600 }}>
                        Seu período de teste acabou. Assine um plano para continuar respondendo emails automaticamente.
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleOpenPlanModal}
                    style={{
                      width: '100%',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: 'var(--accent)',
                      color: '#ffffff',
                      padding: '12px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Assinar um plano
                  </button>
                </div>
              ) : (
                <div style={{ borderRadius: '14px', border: '1px solid var(--border-color)', padding: '16px', backgroundColor: 'var(--bg-primary)' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                    Plano {planName}
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Renova em {renewalDate ? formatDate(renewalDate) : '--'}
                  </div>

                  {!profile?.is_trial && subscriptionInfo?.cancel_at_period_end && (
                    <div style={{
                      marginTop: '10px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(251, 191, 36, 0.12)',
                      border: '1px solid rgba(251, 191, 36, 0.35)',
                      color: '#d97706',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}>
                      Seu plano será cancelado em {renewalDate ? formatDate(renewalDate) : 'breve'}. Você mantém acesso até essa data.
                    </div>
                  )}

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: subscriptionInfo?.cancel_at_period_end ? '1fr' : '1fr 1fr',
                    gap: '10px',
                    marginTop: '16px',
                  }}>
                    <button
                      type="button"
                      onClick={handleOpenPlanModal}
                      style={{
                        borderRadius: '10px',
                        border: '1px solid var(--accent)',
                        color: 'var(--accent)',
                        padding: '10px',
                        fontSize: '13px',
                        fontWeight: 600,
                        background: 'var(--bg-card)',
                        cursor: 'pointer',
                      }}
                    >
                      Alterar plano
                    </button>
                    {!subscriptionInfo?.cancel_at_period_end && (
                      <button
                        type="button"
                        onClick={() => {
                          const message = encodeURIComponent('Olá, gostaria de cancelar meu plano na Replyna.')
                          window.open(`https://wa.me/5531973210191?text=${message}`, '_blank', 'noopener')
                        }}
                        style={{
                          borderRadius: '10px',
                          border: '1px solid #ef4444',
                          color: '#ef4444',
                          padding: '10px',
                          fontSize: '13px',
                          fontWeight: 600,
                          background: 'var(--bg-card)',
                          cursor: 'pointer',
                        }}
                      >
                        Cancelar plano
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenBillingPortal}
                    disabled={openingBillingPortal}
                    style={{
                      marginTop: '10px',
                      width: '100%',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      padding: '10px',
                      fontSize: '13px',
                      fontWeight: 600,
                      background: 'var(--bg-card)',
                      cursor: openingBillingPortal ? 'not-allowed' : 'pointer',
                      opacity: openingBillingPortal ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    {openingBillingPortal ? (
                      'Abrindo...'
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                          <line x1="1" y1="10" x2="23" y2="10"/>
                        </svg>
                        Ver última fatura
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(true)}
                    style={{
                      marginTop: '6px',
                      width: '100%',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      padding: '10px',
                      fontSize: '13px',
                      fontWeight: 600,
                      background: 'var(--bg-card)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                    </svg>
                    Atualizar método de pagamento
                  </button>
                </div>
              )}

                <div style={{ borderRadius: '14px', border: '1px solid var(--border-color)', padding: '16px', backgroundColor: 'var(--bg-primary)' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
                    Uso do plano
                  </div>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Lojas integradas</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: shopsLimit === null ? '#22c55e' : 'var(--text-primary)' }}>
                          {shopsCount} / {shopsLimit === null ? 'Ilimitado' : formatNumber(shopsLimit ?? 0)}
                        </span>
                      </div>
                      {shopsLimit !== null && (
                        <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${shopsLimit ? Math.min((shopsCount / shopsLimit) * 100, 100) : 0}%`,
                              backgroundColor: shopsLimit && shopsCount >= shopsLimit ? '#ef4444' : 'var(--accent)',
                              borderRadius: '4px',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Emails enviados</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: emailsLimit === null ? '#22c55e' : 'var(--text-primary)' }}>
                          {profile?.emails_used !== null && profile?.emails_used !== undefined ? formatNumber(profile.emails_used) : '0'} / {emailsLimit === null ? 'Ilimitado' : formatNumber(emailsLimit ?? 0)}
                        </span>
                      </div>
                      {emailsLimit !== null && (
                        <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${emailsLimit && profile?.emails_used !== null && profile?.emails_used !== undefined ? Math.min((profile.emails_used / emailsLimit) * 100, 100) : 0}%`,
                              backgroundColor: emailsLimit && profile?.emails_used !== null && profile.emails_used >= emailsLimit ? '#ef4444' : 'var(--accent)',
                              borderRadius: '4px',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Seção de Emails Extras - aparece apenas quando excedeu o limite do plano (não para trial) */}
                {!profile?.is_trial && emailsLimit !== null && emailsLimit !== undefined && profile?.emails_used !== null && profile?.emails_used !== undefined && profile.emails_used >= emailsLimit && (
                  <div style={{
                    borderRadius: '14px',
                    border: '1px solid #f59e0b',
                    padding: '16px',
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="12" y1="8" x2="12" y2="12"/>
                          <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#f59e0b' }}>
                          Emails Extras
                        </span>
                      </div>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: '1.5' }}>
                      Você atingiu o limite do seu plano. Emails adicionais são cobrados em pacotes de {profile?.extra_email_package_size ?? 100} emails por R$ {((profile?.extra_email_price ?? 1) * (profile?.extra_email_package_size ?? 100)).toFixed(2).replace('.', ',')}.
                    </p>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Créditos extras disponíveis</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: (profile?.extra_emails_purchased ?? 0) - (profile?.extra_emails_used ?? 0) <= 0 ? '#ef4444' : '#f59e0b' }}>
                          {((profile?.extra_emails_purchased ?? 0) - (profile?.extra_emails_used ?? 0))} emails
                        </span>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '8px 0 0 0' }}>
                        Quando seus créditos extras acabarem, um novo pacote será cobrado automaticamente no cartão da sua assinatura.
                      </p>

                      {/* Botão para comprar emails extras */}
                      <button
                        onClick={handleBuyExtraEmails}
                        disabled={buyingExtras}
                        style={{
                          marginTop: '16px',
                          width: '100%',
                          padding: '12px 16px',
                          backgroundColor: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: buyingExtras ? 'not-allowed' : 'pointer',
                          opacity: buyingExtras ? 0.7 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {buyingExtras ? (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                            </svg>
                            Processando...
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="9" cy="21" r="1"/>
                              <circle cx="20" cy="21" r="1"/>
                              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                            </svg>
                            Comprar +{profile?.extra_email_package_size ?? 100} emails por R$ {((profile?.extra_email_price ?? 1) * (profile?.extra_email_package_size ?? 100)).toFixed(2).replace('.', ',')}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Seção de Pagamentos Pendentes */}
                {pendingInvoices.length > 0 && (
                  <div style={{
                    borderRadius: '14px',
                    border: '1px solid #ef4444',
                    padding: '16px',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#ef4444' }}>
                        Pagamento Pendente
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: '1.5' }}>
                      Você possui faturas de emails extras aguardando pagamento. Regularize para continuar respondendo automaticamente.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {pendingInvoices.map((invoice) => (
                        <div
                          key={invoice.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px',
                            backgroundColor: 'var(--bg-card)',
                            borderRadius: '10px',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              Pacote de {invoice.package_size} emails
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              R$ {invoice.total_amount.toFixed(2).replace('.', ',')}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePayInvoice(invoice)}
                            disabled={payingInvoiceId === invoice.id}
                            style={{
                              borderRadius: '8px',
                              border: 'none',
                              backgroundColor: '#ef4444',
                              color: '#ffffff',
                              padding: '8px 16px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: payingInvoiceId === invoice.id ? 'not-allowed' : 'pointer',
                              opacity: payingInvoiceId === invoice.id ? 0.7 : 1,
                            }}
                          >
                            {payingInvoiceId === invoice.id ? 'Processando...' : 'Pagar agora'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>}

        </div>
      </div>

      {showPaymentModal && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div
            className="replyna-scrollbar"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid var(--border-color)',
              width: 'min(480px, 94vw)',
              maxHeight: '90vh',
              overflowY: 'auto',
              zIndex: 61,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '8px', color: 'var(--text-primary)' }}>Atualizar cartão de crédito</h3>
            <p style={{ marginTop: 0, marginBottom: '20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
              Insira os dados do novo cartão. Nenhuma cobrança será feita agora — o cartão será usado apenas nas próximas renovações.
            </p>

            <div style={{ display: 'grid', gap: '14px' }}>
              <label style={{ display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Nome no cartão</span>
                <input
                  type="text"
                  value={cardForm.holderName}
                  onChange={(e) => setCardForm(prev => ({ ...prev, holderName: e.target.value }))}
                  placeholder="NOME COMO ESTÁ NO CARTÃO"
                  style={{
                    border: '1px solid var(--input-border)',
                    borderRadius: '10px',
                    padding: '12px',
                    fontSize: '14px',
                    backgroundColor: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    textTransform: 'uppercase',
                  }}
                />
              </label>

              <label style={{ display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Número do cartão</span>
                <input
                  type="text"
                  value={cardForm.number}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 16)
                    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ')
                    setCardForm(prev => ({ ...prev, number: formatted }))
                  }}
                  placeholder="0000 0000 0000 0000"
                  maxLength={19}
                  style={{
                    border: '1px solid var(--input-border)',
                    borderRadius: '10px',
                    padding: '12px',
                    fontSize: '14px',
                    backgroundColor: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    letterSpacing: '1px',
                  }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <label style={{ display: 'grid', gap: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Mês</span>
                  <select
                    value={cardForm.expiryMonth}
                    onChange={(e) => setCardForm(prev => ({ ...prev, expiryMonth: e.target.value }))}
                    style={{
                      border: '1px solid var(--input-border)',
                      borderRadius: '10px',
                      padding: '12px',
                      fontSize: '14px',
                      backgroundColor: 'var(--input-bg)',
                      color: cardForm.expiryMonth ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    <option value="">MM</option>
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Ano</span>
                  <select
                    value={cardForm.expiryYear}
                    onChange={(e) => setCardForm(prev => ({ ...prev, expiryYear: e.target.value }))}
                    style={{
                      border: '1px solid var(--input-border)',
                      borderRadius: '10px',
                      padding: '12px',
                      fontSize: '14px',
                      backgroundColor: 'var(--input-bg)',
                      color: cardForm.expiryYear ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    <option value="">AAAA</option>
                    {Array.from({ length: 15 }, (_, i) => String(new Date().getFullYear() + i)).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>CVV</span>
                  <input
                    type="text"
                    value={cardForm.ccv}
                    onChange={(e) => setCardForm(prev => ({ ...prev, ccv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                    placeholder="000"
                    maxLength={4}
                    style={{
                      border: '1px solid var(--input-border)',
                      borderRadius: '10px',
                      padding: '12px',
                      fontSize: '14px',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      letterSpacing: '2px',
                    }}
                  />
                </label>
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />

              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Dados do titular</p>

              <label style={{ display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>CPF/CNPJ</span>
                <input
                  type="text"
                  value={cardForm.cpfCnpj}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 14)
                    let formatted = raw
                    if (raw.length <= 11) {
                      formatted = raw.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
                    } else {
                      formatted = raw.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2')
                    }
                    setCardForm(prev => ({ ...prev, cpfCnpj: formatted }))
                  }}
                  placeholder="000.000.000-00"
                  style={{
                    border: '1px solid var(--input-border)',
                    borderRadius: '10px',
                    padding: '12px',
                    fontSize: '14px',
                    backgroundColor: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                  }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label style={{ display: 'grid', gap: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>CEP</span>
                  <input
                    type="text"
                    value={cardForm.postalCode}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '').slice(0, 8)
                      const formatted = raw.replace(/(\d{5})(\d)/, '$1-$2')
                      setCardForm(prev => ({ ...prev, postalCode: formatted }))
                    }}
                    placeholder="00000-000"
                    maxLength={9}
                    style={{
                      border: '1px solid var(--input-border)',
                      borderRadius: '10px',
                      padding: '12px',
                      fontSize: '14px',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </label>
                <label style={{ display: 'grid', gap: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Número</span>
                  <input
                    type="text"
                    value={cardForm.addressNumber}
                    onChange={(e) => setCardForm(prev => ({ ...prev, addressNumber: e.target.value }))}
                    placeholder="123"
                    style={{
                      border: '1px solid var(--input-border)',
                      borderRadius: '10px',
                      padding: '12px',
                      fontSize: '14px',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </label>
              </div>

              <label style={{ display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Telefone</span>
                <input
                  type="tel"
                  value={cardForm.phone}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 11)
                    let formatted = raw
                    if (raw.length > 6) {
                      formatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`
                    } else if (raw.length > 2) {
                      formatted = `(${raw.slice(0, 2)}) ${raw.slice(2)}`
                    }
                    setCardForm(prev => ({ ...prev, phone: formatted }))
                  }}
                  placeholder="(11) 99999-9999"
                  style={{
                    border: '1px solid var(--input-border)',
                    borderRadius: '10px',
                    padding: '12px',
                    fontSize: '14px',
                    backgroundColor: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                  }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowPaymentModal(false)
                  setCardForm({ holderName: '', number: '', expiryMonth: '', expiryYear: '', ccv: '', cpfCnpj: '', postalCode: '', addressNumber: '', phone: '' })
                }}
                style={{
                  flex: 1,
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  padding: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUpdatePaymentMethod}
                disabled={updatingPaymentMethod}
                style={{
                  flex: 1,
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#ffffff',
                  padding: '12px',
                  fontWeight: 600,
                  cursor: updatingPaymentMethod ? 'not-allowed' : 'pointer',
                  opacity: updatingPaymentMethod ? 0.7 : 1,
                }}
              >
                {updatingPaymentMethod ? 'Atualizando...' : 'Salvar cartão'}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowPaymentModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(14, 23, 41, 0.35)', border: 'none', zIndex: 60 }}
          />
        </div>
      )}

      <style>
        {`
          @media (max-width: 1024px) {
            .replyna-account-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </div>
  )
}
