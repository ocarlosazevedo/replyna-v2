import { useMemo, useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { supabase } from '../lib/supabase'
import { useTheme } from '../context/ThemeContext'

interface UserProfile {
  name: string | null
  email: string | null
  plan: string | null
  emails_limit: number | null
  emails_used: number | null
  shops_limit: number | null
  created_at: string | null
  extra_emails_purchased: number | null // Total de emails extras comprados
  extra_emails_used: number | null // Total de emails extras usados
  extra_email_price: number | null // Preço por email extra (do plano)
  extra_email_package_size: number | null // Tamanho do pacote de emails extras (do plano)
}

interface Plan {
  id: string
  name: string
  description: string | null
  price_monthly: number
  price_yearly: number | null
  emails_limit: number | null  // null = ilimitado
  shops_limit: number | null   // null = ilimitado
  features: string[]
  is_popular: boolean
}

interface PendingInvoice {
  id: string
  stripe_invoice_id: string
  package_size: number
  total_amount: number
  status: string
  created_at: string
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
  console.log('🔄 Account.tsx carregado - versão 3 (com sync fix)')
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const isMobile = useIsMobile()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [emailChangeLoading, setEmailChangeLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [shopsCount, setShopsCount] = useState<number>(0)

  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [plansLoading, setPlansLoading] = useState(false)
  const [changingPlanId, setChangingPlanId] = useState<string | null>(null)

  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([])
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null)
  const [buyingExtras, setBuyingExtras] = useState(false)

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
          'Usuário não encontrado': 'Não foi possível encontrar sua conta. Faça login novamente.',
          'Usuário não possui customer_id no Stripe': 'Você precisa ter uma assinatura ativa para comprar emails extras. Entre em contato com o suporte.',
          'Assinatura ativa não encontrada': 'Você precisa ter uma assinatura ativa para comprar emails extras.',
          'stripe_extra_email_price_id': 'O preço de emails extras não está configurado para seu plano. Entre em contato com o suporte.',
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

  // Detectar retorno do Stripe após adicionar método de pagamento
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
        .select('name, email, plan, emails_limit, emails_used, shops_limit, created_at, extra_emails_purchased, extra_emails_used')
        .eq('id', user.id)
        .maybeSingle()

      if (error) throw error

      // Se não existir registro na tabela users, criar um
      if (!data) {
        const newUserData = {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || null,
          plan: 'Starter',
          emails_limit: 500,
          emails_used: 0,
          shops_limit: 1,
          extra_emails_purchased: 0,
          extra_emails_used: 0,
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
        })
        setName(newUserData.name || '')
        setEmail(newUserData.email || '')
      } else {
        setProfile({
          ...data,
          extra_email_price: null,
          extra_email_package_size: null,
        })
        setName(data.name || user.user_metadata?.name || '')
        setEmail(data.email || user.email || '')
      }

      // Buscar quantidade de lojas integradas
      const { count: shopsIntegrated } = await supabase
        .from('shops')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      setShopsCount(shopsIntegrated || 0)

      // Buscar preço de email extra do plano atual
      const planName = data?.plan || 'Starter'
      const { data: planData, error: planError } = await supabase
        .from('plans')
        .select('extra_email_price, extra_email_package_size')
        .eq('name', planName)
        .single()

      console.log('Plan lookup:', { planName, planData, planError })

      if (data) {
        setProfile({
          ...data,
          extra_email_price: planData?.extra_email_price ?? 1,
          extra_email_package_size: planData?.extra_email_package_size ?? 100,
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

  // Função para carregar invoices pendentes de emails extras
  const loadPendingInvoices = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('email_extra_purchases')
        .select('id, stripe_invoice_id, package_size, total_amount, status, created_at')
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

  const renewalDate = useMemo(
    () => calculateRenewalDate(profile?.created_at ?? user?.created_at ?? null),
    [profile?.created_at, user?.created_at]
  )

  const planName = profile?.plan ?? '--'
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
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
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
      setNotice(null)
    }
    setIsEditing((prev) => !prev)
  }

  const handleCancelPlan = () => {
    const whatsappNumber = '5531973210191' // Número WhatsApp da Replyna
    const message = encodeURIComponent(
      `Olá! Gostaria de solicitar o cancelamento do meu plano.\n\nEmail: ${email}\nPlano atual: ${planName}${cancelReason ? `\nMotivo: ${cancelReason}` : ''}`
    )
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank')
    setShowCancelModal(false)
    setCancelReason('')
  }

  const handleOpenPlanModal = async () => {
    setShowPlanModal(true)
    setPlansLoading(true)
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('id, name, description, price_monthly, price_yearly, emails_limit, shops_limit, features, is_popular')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error
      setPlans(data || [])
    } catch (err) {
      console.error('Erro ao carregar planos:', err)
      setNotice({ type: 'error', message: 'Não foi possível carregar os planos disponíveis.' })
    } finally {
      setPlansLoading(false)
    }
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

      console.log('Pagando invoice:', { purchase_id: invoice.id, stripe_invoice_id: invoice.stripe_invoice_id })

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pay-pending-invoice`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            purchase_id: invoice.id,
            stripe_invoice_id: invoice.stripe_invoice_id,
          }),
        }
      )

      console.log('Response status:', response.status)
      const result = await response.json()
      console.log('Response body:', result)

      if (!response.ok) {
        throw new Error(result.error || `Erro ${response.status}: ${response.statusText}`)
      }

      if (result.success) {
        setNotice({ type: 'success', message: 'Pagamento realizado com sucesso! Seus créditos extras foram liberados.' })
        // Remover invoice da lista
        setPendingInvoices(prev => prev.filter(i => i.id !== invoice.id))
        // Recarregar profile para atualizar créditos
        const { data: newProfile } = await supabase
          .from('users')
          .select('name, email, plan, emails_limit, emails_used, shops_limit, created_at, extra_emails_purchased, extra_emails_used')
          .eq('id', user.id)
          .single()
        if (newProfile) setProfile({
          ...newProfile,
          extra_email_price: profile?.extra_email_price ?? null,
          extra_email_package_size: profile?.extra_email_package_size ?? null,
        })
      } else if (result.checkout_url) {
        // Redirecionar para checkout do Stripe
        window.location.href = result.checkout_url
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
          .select('name, email, plan, emails_limit, emails_used, shops_limit, created_at, extra_emails_purchased, extra_emails_used')
          .eq('id', user.id)
          .single()
        if (newProfile) setProfile({
          ...newProfile,
          extra_email_price: profile?.extra_email_price ?? null,
          extra_email_package_size: profile?.extra_email_package_size ?? null,
        })
      } else {
        setNotice({ type: 'error', message })
      }
    } finally {
      setPayingInvoiceId(null)
    }
  }

  const handleChangePlan = async (plan: Plan) => {
    if (!user) return

    console.log('handleChangePlan chamado:', { planId: plan.id, planName: plan.name, userId: user.id })
    setChangingPlanId(plan.id)
    setNotice(null)

    try {
      console.log('Enviando requisição para update-subscription...')
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
            new_plan_id: plan.id,
          }),
        }
      )

      console.log('Response status:', response.status, response.statusText)
      const result = await response.json()
      console.log('Resposta update-subscription:', result)

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao alterar plano')
      }

      // Se precisa adicionar método de pagamento, redirecionar para checkout
      if (result.requires_payment_method && result.checkout_url) {
        setNotice({
          type: 'info',
          message: 'Redirecionando para adicionar método de pagamento...',
        })
        window.location.href = result.checkout_url
        return
      }

      // Se pagamento está pendente, redirecionar para página de pagamento
      if (result.payment_required && result.payment_url) {
        setNotice({
          type: 'info',
          message: 'Redirecionando para completar o pagamento...',
        })
        window.location.href = result.payment_url
        return
      }

      // Aguardar um pouco para garantir que o banco foi sincronizado
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Recarregar profile do banco para garantir dados sincronizados
      const { data: updatedProfile, error: profileError } = await supabase
        .from('users')
        .select('name, email, plan, emails_limit, emails_used, shops_limit, created_at, extra_emails_purchased, extra_emails_used')
        .eq('id', user.id)
        .single()

      console.log('Profile recarregado:', { updatedProfile, profileError })

      if (updatedProfile) {
        setProfile({
          ...updatedProfile,
          extra_email_price: profile?.extra_email_price ?? null,
          extra_email_package_size: profile?.extra_email_package_size ?? null,
        })
      } else if (result.new_plan) {
        // Fallback: atualizar localmente se não conseguir recarregar
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                plan: result.new_plan.name,
                emails_limit: result.new_plan.emails_limit,
                shops_limit: result.new_plan.shops_limit,
              }
            : prev
        )
      }

      setShowPlanModal(false)

      // Verificar se houve erro parcial (Stripe atualizado mas banco falhou)
      if (result.partial_error) {
        setNotice({
          type: 'info',
          message: result.message || 'Plano atualizado parcialmente. Por favor recarregue a página.',
        })
        return
      }

      // Verificar se foi uma sincronização (Stripe já estava no plano, banco foi atualizado)
      if (result.synced) {
        setNotice({
          type: 'success',
          message: `Seu plano ${plan.name} foi sincronizado com sucesso!`,
        })
        return
      }

      // Mensagem de sucesso diferenciada para upgrade e downgrade
      const priceFormatted = result.new_plan?.price_monthly
        ? `R$ ${result.new_plan.price_monthly.toFixed(2).replace('.', ',')}/mês`
        : ''

      let successMessage = `Plano alterado para ${plan.name} com sucesso!`

      if (result.is_upgrade && result.price_difference > 0) {
        // Upgrade: cobrança imediata
        const diffFormatted = `R$ ${(result.price_difference || 0).toFixed(2).replace('.', ',')}`
        successMessage = `Upgrade para ${plan.name} realizado! A diferença de ${diffFormatted} foi cobrada.`
      } else if (result.is_downgrade) {
        // Downgrade: novo valor na próxima fatura
        successMessage = `Downgrade para ${plan.name} realizado! ${priceFormatted ? `O novo valor de ${priceFormatted} será aplicado na próxima fatura.` : ''}`
      }

      setNotice({
        type: 'success',
        message: successMessage,
      })
    } catch (err: unknown) {
      console.error('Erro no handleChangePlan:', err)
      const message = err instanceof Error ? err.message : 'Erro ao alterar plano. Tente novamente.'
      setNotice({ type: 'error', message })
    } finally {
      setChangingPlanId(null)
    }
  }

  // Encontrar plano atual para calcular diferença
  const currentPlanData = useMemo(() => {
    return plans.find(p => p.name.toLowerCase().trim() === planName.toLowerCase().trim()) || null
  }, [plans, planName])

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
          <section style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)', height: 'fit-content' }}>
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
                <div style={{ borderRadius: '14px', border: '1px solid var(--border-color)', padding: '16px', backgroundColor: 'var(--bg-primary)' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                    Plano {planName}
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Renova em {renewalDate ? formatDate(renewalDate) : '--'}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
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
                    <button
                      type="button"
                      onClick={() => setShowCancelModal(true)}
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
                  </div>
                </div>

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

                {/* Seção de Emails Extras - aparece apenas quando excedeu o limite do plano */}
                {emailsLimit !== null && emailsLimit !== undefined && profile?.emails_used !== null && profile?.emails_used !== undefined && profile.emails_used >= emailsLimit && (
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
          </section>

          <section style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)', height: 'fit-content' }}>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Aparência</h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>Personalize a interface do sistema</p>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Tema</span>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px',
                    border: 'none',
                    backgroundColor: theme === 'light' ? 'var(--accent)' : 'transparent',
                    color: theme === 'light' ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Sun size={16} />
                  Claro
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px',
                    border: 'none',
                    backgroundColor: theme === 'dark' ? 'var(--accent)' : 'transparent',
                    color: theme === 'dark' ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Moon size={16} />
                  Escuro
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {showPlanModal && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div
            className="replyna-scrollbar"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid var(--border-color)',
              width: 'min(600px, 94vw)',
              maxHeight: '90vh',
              overflowY: 'auto',
              zIndex: 61,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '8px', color: 'var(--text-primary)' }}>Alterar plano</h3>
            <p style={{ marginTop: 0, marginBottom: '20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
              Selecione o novo plano. A diferença será ajustada automaticamente na sua próxima fatura.
            </p>

            {plansLoading ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                <Skeleton height={120} />
                <Skeleton height={120} />
              </div>
            ) : plans.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
                Nenhum plano disponível no momento.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {plans.map((plan) => {
                  const isCurrentPlan = plan.name.toLowerCase().trim() === planName.toLowerCase().trim()
                  const isEnterprise = plan.name.toLowerCase().includes('enterprise')
                  return (
                    <div
                      key={plan.id}
                      style={{
                        borderRadius: '12px',
                        border: isCurrentPlan
                          ? '2px solid var(--accent)'
                          : `1px solid ${plan.is_popular ? 'var(--accent)' : 'var(--border-color)'}`,
                        padding: '16px',
                        backgroundColor: isCurrentPlan ? 'rgba(70, 114, 236, 0.08)' : 'var(--bg-primary)',
                        position: 'relative',
                      }}
                    >
                      {isCurrentPlan && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '-10px',
                            left: '16px',
                            backgroundColor: 'var(--accent)',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: '6px',
                          }}
                        >
                          Seu plano
                        </span>
                      )}
                      {plan.is_popular && !isCurrentPlan && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '-10px',
                            right: '16px',
                            backgroundColor: 'var(--accent)',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: '6px',
                          }}
                        >
                          Popular
                        </span>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                            {plan.name}
                            {isCurrentPlan && (
                              <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 500, color: 'var(--accent)' }}>
                                (Atual)
                              </span>
                            )}
                          </div>
                          <ul style={{ paddingLeft: '16px', margin: 0, color: 'var(--text-secondary)', fontSize: '12px', display: 'grid', gap: '2px' }}>
                            <li style={{ color: isEnterprise || plan.emails_limit === null ? '#22c55e' : 'inherit' }}>
                              {isEnterprise || plan.emails_limit === null ? 'Emails ilimitados' : `${formatNumber(plan.emails_limit)} emails/mês`}
                            </li>
                            <li style={{ color: isEnterprise || plan.shops_limit === null ? '#22c55e' : 'inherit' }}>
                              {isEnterprise || plan.shops_limit === null ? 'Lojas ilimitadas' : `${formatNumber(plan.shops_limit)} ${plan.shops_limit === 1 ? 'loja' : 'lojas'}`}
                            </li>
                            {Array.isArray(plan.features) && plan.features
                              .filter((f) => {
                                const lower = f.toLowerCase()
                                // Filtra features que mencionam emails ou lojas (já exibidos acima)
                                return !lower.includes('email') && !lower.includes('e-mail') && !lower.includes('loja')
                              })
                              .slice(0, 3)
                              .map((feature, idx) => (
                                <li key={idx}>{feature}</li>
                              ))}
                          </ul>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                          <div style={{ textAlign: 'right' }}>
                            {isEnterprise ? (
                              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                Sob consulta
                              </div>
                            ) : (
                              <>
                                {/* Se não é o plano atual e tem diferença, mostra preço cortado + diferença */}
                                {!isCurrentPlan && currentPlanData && plan.price_monthly !== currentPlanData.price_monthly ? (
                                  <>
                                    <div style={{
                                      fontSize: '14px',
                                      color: 'var(--text-secondary)',
                                      textDecoration: 'line-through',
                                      opacity: 0.7,
                                    }}>
                                      R$ {plan.price_monthly.toFixed(2).replace('.', ',')}
                                    </div>
                                    <div style={{
                                      fontSize: '18px',
                                      fontWeight: 700,
                                      color: plan.price_monthly > currentPlanData.price_monthly ? '#22c55e' : 'var(--accent)',
                                    }}>
                                      {plan.price_monthly > currentPlanData.price_monthly
                                        ? `+R$ ${(plan.price_monthly - currentPlanData.price_monthly).toFixed(2).replace('.', ',')}`
                                        : `-R$ ${(currentPlanData.price_monthly - plan.price_monthly).toFixed(2).replace('.', ',')}`}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                      {plan.price_monthly > currentPlanData.price_monthly ? 'a mais por mês' : 'de economia por mês'}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                      R$ {plan.price_monthly.toFixed(2).replace('.', ',')}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>por mês</div>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                          {isEnterprise ? (
                            <a
                              href="https://wa.me/5511999999999?text=Olá!%20Tenho%20interesse%20no%20plano%20Enterprise%20da%20Replyna."
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: '#25D366',
                                color: '#fff',
                                padding: '8px 16px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                              Falar com vendas
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleChangePlan(plan)}
                              disabled={isCurrentPlan || changingPlanId !== null}
                              style={{
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: isCurrentPlan ? 'var(--border-color)' : 'var(--accent)',
                                color: isCurrentPlan ? 'var(--text-secondary)' : '#fff',
                                padding: '8px 16px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: isCurrentPlan || changingPlanId !== null ? 'not-allowed' : 'pointer',
                                opacity: changingPlanId !== null && changingPlanId !== plan.id ? 0.6 : 1,
                              }}
                            >
                              {isCurrentPlan
                                ? 'Plano atual'
                                : changingPlanId === plan.id
                                ? 'Alterando...'
                                : 'Selecionar'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowPlanModal(false)}
              style={{
                marginTop: '16px',
                width: '100%',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                padding: '10px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Fechar
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowPlanModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(14, 23, 41, 0.35)', border: 'none', zIndex: 60 }}
          />
        </div>
      )}

      {showCancelModal && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid var(--border-color)',
              width: 'min(480px, 92vw)',
              zIndex: 61,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '8px', color: 'var(--text-primary)' }}>Cancelar plano</h3>
            <p style={{ marginTop: 0, color: 'var(--text-secondary)' }}>
              Seu acesso continua até {renewalDate ? formatDate(renewalDate) : 'a data de renovação'}.
            </p>
            <label style={{ display: 'grid', gap: '6px', marginTop: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Motivo (opcional)</span>
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={3}
                style={{
                  border: '1px solid var(--input-border)',
                  borderRadius: '10px',
                  padding: '10px',
                  fontSize: '14px',
                  resize: 'vertical',
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                }}
              />
            </label>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                style={{
                  flex: 1,
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  padding: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleCancelPlan}
                style={{
                  flex: 1,
                  borderRadius: '10px',
                  border: '1px solid #ef4444',
                  background: '#ef4444',
                  color: '#ffffff',
                  padding: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Confirmar cancelamento
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCancelModal(false)}
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
