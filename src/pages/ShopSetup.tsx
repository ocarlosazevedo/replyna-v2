import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Check, ChevronLeft, ChevronRight, Store, ShoppingBag, Mail, Settings, Rocket, Eye, EyeOff } from 'lucide-react'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isMobile
}

interface ShopData {
  // Step 1 - Basic Info
  name: string
  attendant_name: string
  support_email: string
  is_cod: boolean

  // Step 2 - Shopify
  shopify_domain: string
  shopify_client_id: string
  shopify_client_secret: string

  // Step 3 - Email IMAP/SMTP
  imap_host: string
  imap_port: string
  imap_user: string
  imap_password: string
  smtp_host: string
  smtp_port: string
  smtp_user: string
  smtp_password: string
  email_start_mode: 'all_unread' | 'from_integration_date'
  email_start_date: string

  // Step 4 - Customizations
  delivery_time: string
  dispatch_time: string
  warranty_info: string
  store_description: string
  tone_of_voice: string
  retention_coupon_code: string
}

const initialShopData: ShopData = {
  name: '',
  attendant_name: '',
  support_email: '',
  is_cod: false,
  shopify_domain: '',
  shopify_client_id: '',
  shopify_client_secret: '',
  imap_host: '',
  imap_port: '993',
  imap_user: '',
  imap_password: '',
  smtp_host: '',
  smtp_port: '587',
  smtp_user: '',
  smtp_password: '',
  email_start_mode: 'all_unread',
  email_start_date: '',
  delivery_time: '',
  dispatch_time: '',
  warranty_info: '',
  store_description: '',
  tone_of_voice: 'professional',
  retention_coupon_code: '',
}

const steps = [
  { id: 1, title: 'Informações Básicas', icon: Store },
  { id: 2, title: 'Shopify', icon: ShoppingBag },
  { id: 3, title: 'Email', icon: Mail },
  { id: 4, title: 'Customizações', icon: Settings },
  { id: 5, title: 'Revisão', icon: Rocket },
]

const toneOptions = [
  { value: 'professional', label: 'Profissional', description: 'Formal e direto ao ponto' },
  { value: 'friendly', label: 'Amigável', description: 'Caloroso e acolhedor' },
  { value: 'casual', label: 'Casual', description: 'Descontraído e informal' },
  { value: 'enthusiastic', label: 'Entusiasmado', description: 'Energético e positivo' },
]

export default function ShopSetup() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { shopId } = useParams()
  const [searchParams] = useSearchParams()
  const isEditing = !!shopId
  const isMobile = useIsMobile()

  const [currentStep, setCurrentStep] = useState(1)
  const [shopData, setShopData] = useState<ShopData>(initialShopData)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showImapPassword, setShowImapPassword] = useState(false)
  const [showShopifyToken, setShowShopifyToken] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [emailTestResult, setEmailTestResult] = useState<'success' | 'error' | null>(null)
  const [testingShopify, setTestingShopify] = useState(false)
  const [shopifyTestResult, setShopifyTestResult] = useState<'success' | 'error' | null>(null)
  const [emailProvider, setEmailProvider] = useState('')

  // Email providers configuration
  const emailProviders = [
    { value: '', label: 'Selecione um provedor...', imap_host: '', imap_port: '', smtp_host: '', smtp_port: '' },
    { value: 'gmail', label: 'Gmail (Google Workspace)', imap_host: 'imap.gmail.com', imap_port: '993', smtp_host: 'smtp.gmail.com', smtp_port: '465' },
    { value: 'outlook', label: 'Outlook (Microsoft 365)', imap_host: 'outlook.office365.com', imap_port: '993', smtp_host: 'smtp.office365.com', smtp_port: '587' },
    { value: 'zoho', label: 'Zoho Mail (EUA)', imap_host: 'imap.zoho.com', imap_port: '993', smtp_host: 'smtp.zoho.com', smtp_port: '465' },
    { value: 'zoho-eu', label: 'Zoho Mail (Europa)', imap_host: 'imap.zoho.eu', imap_port: '993', smtp_host: 'smtp.zoho.eu', smtp_port: '465' },
    { value: 'zoho-in', label: 'Zoho Mail (Índia)', imap_host: 'imap.zoho.in', imap_port: '993', smtp_host: 'smtp.zoho.in', smtp_port: '465' },
    { value: 'titan', label: 'Titan Mail', imap_host: 'imap.titan.email', imap_port: '993', smtp_host: 'smtp.titan.email', smtp_port: '465' },
    { value: 'locaweb', label: 'Locaweb', imap_host: 'email-ssl.com.br', imap_port: '993', smtp_host: 'email-ssl.com.br', smtp_port: '465' },
    { value: 'hostinger', label: 'Hostinger', imap_host: 'imap.hostinger.com', imap_port: '993', smtp_host: 'smtp.hostinger.com', smtp_port: '465' },
    { value: 'hostgator', label: 'HostGator', imap_host: 'mail.seudominio.com.br', imap_port: '993', smtp_host: 'mail.seudominio.com.br', smtp_port: '465' },
    { value: 'godaddy', label: 'GoDaddy', imap_host: 'imap.secureserver.net', imap_port: '993', smtp_host: 'smtpout.secureserver.net', smtp_port: '465' },
    { value: 'kinghost', label: 'KingHost', imap_host: 'imap.kinghost.net', imap_port: '993', smtp_host: 'smtp.kinghost.net', smtp_port: '587' },
    { value: 'migadu', label: 'Migadu', imap_host: 'imap.migadu.com', imap_port: '993', smtp_host: 'smtp.migadu.com', smtp_port: '465' },
    { value: 'outro', label: 'Outro (manual)', imap_host: '', imap_port: '993', smtp_host: '', smtp_port: '465' },
  ]

  const handleProviderChange = (providerValue: string) => {
    setEmailProvider(providerValue)
    const provider = emailProviders.find(p => p.value === providerValue)
    if (provider && providerValue !== 'outro') {
      updateField('imap_host', provider.imap_host)
      updateField('imap_port', provider.imap_port)
      updateField('smtp_host', provider.smtp_host)
      updateField('smtp_port', provider.smtp_port)
    }
  }

  useEffect(() => {
    if (isEditing) {
      loadShopData()
    }
  }, [shopId])

  useEffect(() => {
    const step = searchParams.get('step')
    if (step) {
      const stepNum = parseInt(step)
      if (stepNum >= 1 && stepNum <= 5) {
        setCurrentStep(stepNum)
      }
    }
  }, [searchParams])

  const loadShopData = async () => {
    if (!shopId) return

    try {
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .single()

      if (shopError) throw shopError

      if (shop) {
        setShopData({
          name: shop.name || '',
          attendant_name: shop.attendant_name || '',
          support_email: shop.support_email || '',
          is_cod: shop.is_cod || false,
          shopify_domain: shop.shopify_domain || '',
          shopify_client_id: shop.shopify_client_id || '',
          shopify_client_secret: shop.shopify_client_secret || '',
          imap_host: shop.imap_host || '',
          imap_port: shop.imap_port || '993',
          imap_user: shop.imap_user || '',
          imap_password: shop.imap_password || '',
          smtp_host: shop.smtp_host || '',
          smtp_port: shop.smtp_port || '587',
          smtp_user: shop.smtp_user || '',
          smtp_password: shop.smtp_password || '',
          email_start_mode: shop.email_start_mode || 'from_integration_date',
          email_start_date: shop.email_start_date || '',
          delivery_time: shop.delivery_time || '',
          dispatch_time: shop.dispatch_time || '',
          warranty_info: shop.warranty_info || '',
          store_description: shop.store_description || '',
          tone_of_voice: shop.tone_of_voice || 'professional',
          retention_coupon_code: shop.retention_coupon_code || '',
        })
      }
    } catch (err) {
      console.error('Erro ao carregar loja:', err)
      setError('Erro ao carregar dados da loja')
    }
  }

  const updateField = (field: keyof ShopData, value: string | boolean) => {
    setShopData(prev => ({ ...prev, [field]: value }))
  }

  const validateStep = (step: number): boolean => {
    setError('')

    switch (step) {
      case 1:
        if (!shopData.name.trim()) {
          setError('Nome da loja é obrigatório')
          return false
        }
        if (!shopData.attendant_name.trim()) {
          setError('Nome do atendente é obrigatório')
          return false
        }
        if (!shopData.support_email.trim()) {
          setError('Email de suporte é obrigatório')
          return false
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shopData.support_email)) {
          setError('Email inválido')
          return false
        }
        return true
      case 2:
        // Shopify is optional, but if provided, must be tested and validated
        if (shopData.shopify_domain || shopData.shopify_client_id || shopData.shopify_client_secret) {
          if (!shopData.shopify_domain) {
            setError('Domínio da loja Shopify é obrigatório')
            return false
          }
          if (!shopData.shopify_client_id) {
            setError('Client ID é obrigatório')
            return false
          }
          if (!shopData.shopify_client_secret) {
            setError('Client Secret é obrigatório')
            return false
          }
          // Require successful connection test
          if (shopifyTestResult !== 'success') {
            setError('Você precisa testar e validar a conexão com o Shopify antes de continuar.')
            return false
          }
        }
        return true
      case 3:
        // Email is optional, but if provided, must be tested and validated
        if (shopData.imap_user || shopData.imap_password || emailProvider) {
          if (!shopData.imap_host || !shopData.imap_user || !shopData.imap_password) {
            setError('Todos os campos de email são obrigatórios')
            return false
          }
          if (!shopData.smtp_host || !shopData.smtp_user || !shopData.smtp_password) {
            setError('Todos os campos de email são obrigatórios')
            return false
          }
          // Require successful connection test
          if (emailTestResult !== 'success') {
            setError('Você precisa testar e validar a conexão de email antes de continuar.')
            return false
          }
        }
        return true
      case 4:
        // Customizations are optional
        return true
      default:
        return true
    }
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 5))
    }
  }

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const handleSave = async (activate: boolean = false) => {
    if (!user) return
    setSaving(true)
    setError('')

    // Verificar limite de lojas do plano (apenas para criação, não edição)
    if (!isEditing) {
      try {
        // Buscar limite do usuário
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('shops_limit')
          .eq('id', user.id)
          .single()

        if (userError) throw userError

        // Contar lojas atuais
        const { count: currentShops, error: countError } = await supabase
          .from('shops')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        if (countError) throw countError

        const shopsLimit = userData?.shops_limit // null = ilimitado
        const shopsCount = currentShops ?? 0

        // Se shopsLimit é null, significa ilimitado - pode adicionar
        // Se shopsLimit tem valor, verificar se atingiu o limite
        if (shopsLimit !== null && shopsCount >= shopsLimit) {
          setError(`Você atingiu o limite de ${shopsLimit} loja${shopsLimit > 1 ? 's' : ''} do seu plano. Faça upgrade para adicionar mais lojas.`)
          setSaving(false)
          return
        }
      } catch (err) {
        console.error('Erro ao verificar limite de lojas:', err)
        setError('Erro ao verificar limite de lojas. Tente novamente.')
        setSaving(false)
        return
      }
    }

    // Verificar se as conexões foram validadas
    const hasShopifyConfig = shopData.shopify_domain && shopData.shopify_client_id && shopData.shopify_client_secret
    const hasEmailConfig = shopData.imap_host && shopData.smtp_host

    if (hasShopifyConfig && shopifyTestResult !== 'success') {
      setError('Você precisa testar e validar a conexão com o Shopify antes de salvar.')
      setSaving(false)
      return
    }

    if (hasEmailConfig && emailTestResult !== 'success') {
      setError('Você precisa testar e validar a conexão de email antes de salvar.')
      setSaving(false)
      return
    }

    try {
      const shopPayload = {
        user_id: user.id,
        name: shopData.name,
        attendant_name: shopData.attendant_name,
        support_email: shopData.support_email,
        is_cod: shopData.is_cod,
        shopify_domain: shopData.shopify_domain || null,
        shopify_client_id: shopData.shopify_client_id || null,
        shopify_client_secret: shopData.shopify_client_secret || null,
        shopify_status: hasShopifyConfig && shopifyTestResult === 'success' ? 'ok' : null,
        imap_host: shopData.imap_host || null,
        imap_port: shopData.imap_port || null,
        imap_user: shopData.imap_user || null,
        imap_password: shopData.imap_password || null,
        smtp_host: shopData.smtp_host || null,
        smtp_port: shopData.smtp_port || null,
        smtp_user: shopData.smtp_user || null,
        smtp_password: shopData.smtp_password || null,
        mail_status: hasEmailConfig && emailTestResult === 'success' ? 'ok' : null,
        email_start_mode: shopData.email_start_mode,
        email_start_date: shopData.email_start_mode === 'from_integration_date' ? new Date().toISOString() : null,
        delivery_time: shopData.delivery_time || null,
        dispatch_time: shopData.dispatch_time || null,
        warranty_info: shopData.warranty_info || null,
        store_description: shopData.store_description || null,
        tone_of_voice: shopData.tone_of_voice,
        retention_coupon_code: shopData.retention_coupon_code || null,
        is_active: activate,
      }

      if (isEditing) {
        const { error } = await supabase
          .from('shops')
          .update(shopPayload)
          .eq('id', shopId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('shops')
          .insert(shopPayload)

        if (error) throw error
      }

      navigate('/shops')
    } catch (err: unknown) {
      console.error('Erro ao salvar loja:', err)
      // Handle Supabase error format
      const supabaseError = err as { message?: string; details?: string; hint?: string; code?: string }
      const errorMessage = supabaseError?.message || (err instanceof Error ? err.message : 'Erro ao salvar loja')
      setError(`${errorMessage}${supabaseError?.details ? ` - ${supabaseError.details}` : ''}`)
    } finally {
      setSaving(false)
    }
  }

  const [emailTestError, setEmailTestError] = useState('')
  const [shopifyTestError, setShopifyTestError] = useState('')

  const testEmailConnection = async () => {
    setTestingEmail(true)
    setEmailTestResult(null)
    setEmailTestError('')

    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imap_host: shopData.imap_host,
          imap_port: shopData.imap_port,
          imap_user: shopData.imap_user,
          imap_password: shopData.imap_password,
          smtp_host: shopData.smtp_host,
          smtp_port: shopData.smtp_port,
          smtp_user: shopData.smtp_user,
          smtp_password: shopData.smtp_password,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setEmailTestResult('success')
      } else {
        setEmailTestResult('error')
        setEmailTestError(data.error || 'Falha na conexão')
      }
    } catch (err) {
      setEmailTestResult('error')
      setEmailTestError(err instanceof Error ? err.message : 'Erro ao testar conexão')
    }

    setTestingEmail(false)
  }

  const testShopifyConnection = async () => {
    setTestingShopify(true)
    setShopifyTestResult(null)
    setShopifyTestError('')

    try {
      const response = await fetch('/api/test-shopify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopify_domain: shopData.shopify_domain,
          shopify_client_id: shopData.shopify_client_id,
          shopify_client_secret: shopData.shopify_client_secret,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setShopifyTestResult('success')
      } else {
        setShopifyTestResult('error')
        setShopifyTestError(data.error || 'Falha na conexão')
      }
    } catch (err) {
      setShopifyTestResult('error')
      setShopifyTestError(err instanceof Error ? err.message : 'Erro ao testar conexão')
    }

    setTestingShopify(false)
  }

  // Styles
  const cardStyle = {
    backgroundColor: 'var(--bg-card)',
    borderRadius: '16px',
    border: '1px solid var(--border-color)',
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid var(--input-border)',
    borderRadius: '10px',
    fontSize: '15px',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--text-primary)',
    boxSizing: 'border-box' as const,
  }

  const labelStyle = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600' as const,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  }

  const buttonPrimary = {
    backgroundColor: 'var(--accent)',
    color: '#ffffff',
    padding: '12px 24px',
    borderRadius: '10px',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    fontSize: '15px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  const buttonSecondary = {
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    padding: '12px 24px',
    borderRadius: '10px',
    fontWeight: '600',
    border: '1px solid var(--border-color)',
    cursor: 'pointer',
    fontSize: '15px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  const renderStepIndicator = () => (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: isMobile ? '24px' : '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '8px' }}>
        {steps.map((step, index) => (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => {
                if (step.id < currentStep || validateStep(currentStep)) {
                  setCurrentStep(step.id)
                }
              }}
              style={{
                width: isMobile ? '36px' : '44px',
                height: isMobile ? '36px' : '44px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: currentStep === step.id ? '2px solid var(--accent)' : '2px solid var(--border-color)',
                backgroundColor: currentStep > step.id ? 'var(--accent)' : currentStep === step.id ? 'var(--bg-card)' : 'var(--bg-primary)',
                color: currentStep > step.id ? '#ffffff' : currentStep === step.id ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {currentStep > step.id ? (
                <Check size={isMobile ? 16 : 20} />
              ) : (
                <step.icon size={isMobile ? 16 : 20} />
              )}
            </button>
            {index < steps.length - 1 && (
              <div
                style={{
                  width: isMobile ? '20px' : '60px',
                  height: '2px',
                  backgroundColor: currentStep > step.id ? 'var(--accent)' : 'var(--border-color)',
                  margin: '0 4px',
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )

  const TutorialLink = () => (
    <a
      href="https://youtu.be/PpoJjvGz0AY"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        borderRadius: '10px',
        padding: '12px 16px',
        marginTop: '16px',
        textDecoration: 'none',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.12)'
        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.08)'
        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.2)'
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <svg width="40" height="28" viewBox="0 0 28 20">
          <rect width="28" height="20" rx="5" fill="#FF0000"/>
          <polygon points="11,5 11,15 20,10" fill="white"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
          Precisa de ajuda? Assista o tutorial
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Vídeo passo a passo de como integrar sua loja
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" style={{ marginLeft: 'auto', flexShrink: 0 }}>
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  )

  const renderStep1 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Informações Básicas
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Configure as informações principais da sua loja
        </p>
        <TutorialLink />
      </div>

      <div>
        <label style={labelStyle}>Nome da loja *</label>
        <input
          type="text"
          value={shopData.name}
          onChange={(e) => updateField('name', e.target.value)}
          style={inputStyle}
          placeholder="Ex: Minha Loja Online"
        />
      </div>

      <div>
        <label style={labelStyle}>Nome do atendente *</label>
        <input
          type="text"
          value={shopData.attendant_name}
          onChange={(e) => updateField('attendant_name', e.target.value)}
          style={inputStyle}
          placeholder="Ex: Ana, Suporte, Atendimento"
        />
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          Este nome será usado nas respostas automáticas aos clientes
        </p>
      </div>

      <div>
        <label style={labelStyle}>Email para escalonamento humano *</label>
        <input
          type="email"
          value={shopData.support_email}
          onChange={(e) => updateField('support_email', e.target.value)}
          style={inputStyle}
          placeholder="suporte@minhaloja.com"
        />
        <div style={{
          backgroundColor: 'rgba(70, 114, 236, 0.08)',
          padding: '12px 16px',
          borderRadius: '10px',
          marginTop: '10px',
          border: '1px solid rgba(70, 114, 236, 0.15)'
        }}>
          <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0, lineHeight: '1.5' }}>
            <strong>Quando a IA não conseguir resolver</strong> uma solicitação do cliente
            (casos complexos, reclamações graves, pedidos especiais), o email será
            automaticamente encaminhado para este endereço para atendimento humano.
          </p>
        </div>
      </div>

      {/* Cash on Delivery Option */}
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)'
      }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={shopData.is_cod}
            onChange={(e) => updateField('is_cod', e.target.checked)}
            style={{
              width: '20px',
              height: '20px',
              marginTop: '2px',
              accentColor: 'var(--accent)',
              cursor: 'pointer',
            }}
          />
          <div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
              Modelo Cash on Delivery (COD)
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
              Marque esta opção se sua loja opera no modelo de pagamento na entrega.
              A Replyna irá adaptar as respostas para o contexto COD, considerando
              confirmações de pedido, tentativas de entrega e recusas.
            </p>
          </div>
        </label>
      </div>
    </div>
  )

  const copyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text)
    // Visual feedback without alert
    const toast = document.createElement('div')
    toast.textContent = message
    toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#22c55e;color:#fff;padding:12px 24px;border-radius:8px;font-weight:600;z-index:9999;'
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 2000)
  }

  const renderStep2 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Integração Shopify
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Conecte sua loja Shopify via Custom App (Dev Dashboard)
        </p>
        <TutorialLink />
      </div>

      {/* How to get credentials - estilo do print */}
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            border: '2px solid var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: 'var(--accent)',
            fontWeight: '700'
          }}>i</div>
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--accent)' }}>
            Como obter as credenciais
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', color: 'var(--text-primary)' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ color: 'var(--accent)' }}>→</span>
            <span>Acesse o <a href="https://admin.shopify.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: '600' }}>Admin da Shopify</a> e vá em <strong>Settings</strong> → <strong>Apps and sales channels</strong> → <strong>Develop apps</strong></span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ color: 'var(--accent)' }}>→</span>
            <span>Clique em <strong>Create an app</strong></span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--accent)' }}>→</span>
            <span>Em <strong>App URL</strong>, adicione: <code
              onClick={() => copyToClipboard('https://app.replyna.me', 'URL copiada!')}
              style={{
                backgroundColor: 'rgba(70, 114, 236, 0.15)',
                padding: '2px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px'
              }}>https://app.replyna.me</code></span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginLeft: '20px' }}>
            <span style={{ color: '#ef4444' }}>⚠</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              <strong>Não</strong> marque a opção "Embed app in Shopify admin" abaixo de App URL
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--accent)' }}>→</span>
            <div>
              <span>Em <strong>Scopes</strong>, adicione: </span>
              <code
                onClick={() => copyToClipboard('read_orders, read_products, read_customers, read_inventory, read_fulfillments', 'Escopos copiados!')}
                style={{
                  backgroundColor: 'rgba(70, 114, 236, 0.15)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  display: 'inline-block',
                  marginTop: '4px'
                }}>read_orders, read_products, read_customers, read_inventory, read_fulfillments</code>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--accent)' }}>→</span>
            <span>Em <strong>Redirect URLs</strong>, adicione: <code
              onClick={() => copyToClipboard('https://app.replyna.me/api/shopify-callback', 'URL copiada!')}
              style={{
                backgroundColor: 'rgba(70, 114, 236, 0.15)',
                padding: '2px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px'
              }}>https://app.replyna.me/api/shopify-callback</code></span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ color: 'var(--accent)' }}>→</span>
            <span>Clique em <strong>Save</strong> e depois <strong>Install app</strong></span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ color: 'var(--accent)' }}>→</span>
            <span>Copie o <strong>Client ID</strong> e <strong>Client Secret</strong> em Settings</span>
          </div>
        </div>
      </div>

      {/* Store Domain */}
      <div>
        <label style={labelStyle}>Store Domain *</label>
        <input
          type="text"
          value={shopData.shopify_domain}
          onChange={(e) => updateField('shopify_domain', e.target.value)}
          style={inputStyle}
          placeholder="mystore.myshopify.com"
        />
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          Seu domínio .myshopify.com completo
        </p>
      </div>

      {/* Client ID */}
      <div>
        <label style={labelStyle}>Client ID *</label>
        <input
          type="text"
          value={shopData.shopify_client_id}
          onChange={(e) => updateField('shopify_client_id', e.target.value)}
          style={inputStyle}
          placeholder="Ex: 6ad456138185c8e4038116b809ac870e"
        />
      </div>

      {/* Client Secret */}
      <div>
        <label style={labelStyle}>Client Secret *</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showShopifyToken ? 'text' : 'password'}
            value={shopData.shopify_client_secret}
            onChange={(e) => updateField('shopify_client_secret', e.target.value)}
            style={{ ...inputStyle, paddingRight: '48px' }}
            placeholder="Ex: shpss_xxxxxxxxxxxxxxxxxxxxx"
          />
          <button
            type="button"
            onClick={() => setShowShopifyToken(!showShopifyToken)}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
          >
            {showShopifyToken ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          Começa com shpss_
        </p>
      </div>

      {shopData.shopify_domain && shopData.shopify_client_id && shopData.shopify_client_secret && (
        <div>
          <button
            onClick={testShopifyConnection}
            disabled={testingShopify}
            style={{
              ...buttonSecondary,
              opacity: testingShopify ? 0.7 : 1,
            }}
          >
            {testingShopify ? 'Testando...' : 'Testar conexão'}
          </button>
          {shopifyTestResult === 'success' && (
            <p style={{ color: '#22c55e', fontSize: '14px', marginTop: '8px' }}>
              Conexão estabelecida com sucesso!
            </p>
          )}
          {shopifyTestResult === 'error' && (
            <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '8px' }}>
              {shopifyTestError || 'Falha na conexão. Verifique as credenciais.'}
            </p>
          )}
        </div>
      )}
    </div>
  )

  const renderStep3 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Integração com e-mail
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Configure suas integrações com seu provedor de e-mail
        </p>
        <TutorialLink />
      </div>

      {/* Provider Select */}
      <div>
        <label style={labelStyle}>Provedor de e-mail:</label>
        <select
          value={emailProvider}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="replyna-select form-input"
        >
          {emailProviders.map((provider) => (
            <option key={provider.value} value={provider.value}>
              {provider.label}
            </option>
          ))}
        </select>
      </div>

      {/* Aviso específico para Zoho - apenas ao adicionar nova loja */}
      {!isEditing && emailProvider.startsWith('zoho') && (
        <div style={{
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          border: '2px solid rgba(220, 38, 38, 0.4)',
          borderRadius: '12px',
          padding: '16px',
        }}>
          <p style={{
            color: '#dc2626',
            fontWeight: 700,
            fontSize: '15px',
            margin: 0,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            IMPORTANTE: Zoho Mail requer plano PAGO
          </p>
          <div style={{
            backgroundColor: 'rgba(220, 38, 38, 0.08)',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '12px',
          }}>
            <p style={{ color: '#dc2626', fontSize: '14px', fontWeight: 600, margin: 0 }}>
              Contas gratuitas do Zoho Mail NÃO funcionam com a Replyna.
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '8px 0 0 0' }}>
              O plano gratuito do Zoho não suporta acesso IMAP/SMTP, que é necessário para a integração funcionar.
              Se você usa o plano gratuito, os emails chegarão sem remetente e com erros.
            </p>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
            <p style={{ margin: '0 0 8px 0' }}>
              <strong>Servidor por região:</strong> Use o servidor correto:
            </p>
            <ul style={{ margin: '0 0 8px 0', paddingLeft: '20px' }}>
              <li><strong>EUA:</strong> imap.zoho.com / smtp.zoho.com</li>
              <li><strong>Europa:</strong> imap.zoho.eu / smtp.zoho.eu</li>
              <li><strong>Índia:</strong> imap.zoho.in / smtp.zoho.in</li>
            </ul>
            <p style={{ margin: 0 }}>
              <strong>Verifique sua região:</strong> Acesse{' '}
              <a href="https://mail.zoho.com" target="_blank" rel="noopener noreferrer" style={{ color: '#dc2626' }}>
                mail.zoho.com
              </a>{' '}
              ou{' '}
              <a href="https://mail.zoho.eu" target="_blank" rel="noopener noreferrer" style={{ color: '#dc2626' }}>
                mail.zoho.eu
              </a>{' '}
              para descobrir em qual datacenter sua conta está.
            </p>
          </div>
        </div>
      )}

      {/* Show fields only after selecting a provider */}
      {emailProvider && (
        <>
          {/* Email and Password */}
          <div>
            <label style={labelStyle}>Usuário do e-mail</label>
            <input
              type="email"
              value={shopData.imap_user}
              onChange={(e) => {
                updateField('imap_user', e.target.value)
                updateField('smtp_user', e.target.value)
              }}
              style={inputStyle}
              placeholder="seuemail@exemplo.com"
            />
          </div>

          <div>
            <label style={labelStyle}>Senha do e-mail</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showImapPassword ? 'text' : 'password'}
                value={shopData.imap_password}
                onChange={(e) => {
                  updateField('imap_password', e.target.value)
                  updateField('smtp_password', e.target.value)
                }}
                style={{ ...inputStyle, paddingRight: '48px' }}
                placeholder="••••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowImapPassword(!showImapPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                {showImapPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Manual fields for "Outro" */}
          {emailProvider === 'outro' && (
            <>
              <div>
                <label style={labelStyle}>Host SMTP</label>
                <input
                  type="text"
                  value={shopData.smtp_host}
                  onChange={(e) => updateField('smtp_host', e.target.value)}
                  style={inputStyle}
                  placeholder="smtp.seudominio.com"
                />
              </div>

              <div>
                <label style={labelStyle}>Porta SMTP</label>
                <input
                  type="text"
                  value={shopData.smtp_port}
                  onChange={(e) => updateField('smtp_port', e.target.value)}
                  style={inputStyle}
                  placeholder="465"
                />
              </div>

              <div>
                <label style={labelStyle}>Host IMAP</label>
                <input
                  type="text"
                  value={shopData.imap_host}
                  onChange={(e) => updateField('imap_host', e.target.value)}
                  style={inputStyle}
                  placeholder="imap.seudominio.com"
                />
              </div>

              <div>
                <label style={labelStyle}>Porta IMAP</label>
                <input
                  type="text"
                  value={shopData.imap_port}
                  onChange={(e) => updateField('imap_port', e.target.value)}
                  style={inputStyle}
                  placeholder="993"
                />
              </div>
            </>
          )}

          {/* Show configured hosts for non-manual providers */}
          {emailProvider !== 'outro' && shopData.imap_host && (
            <div style={{
              backgroundColor: 'var(--bg-primary)',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)'
            }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Configuração automática:</strong><br />
                SMTP: {shopData.smtp_host}:{shopData.smtp_port}<br />
                IMAP: {shopData.imap_host}:{shopData.imap_port}
              </p>
            </div>
          )}

          {/* Test connection button */}
          {shopData.imap_user && shopData.imap_password && shopData.imap_host && (
            <div>
              <button
                onClick={testEmailConnection}
                disabled={testingEmail}
                style={{
                  ...buttonSecondary,
                  opacity: testingEmail ? 0.7 : 1,
                }}
              >
                {testingEmail ? 'Testando...' : 'Testar conexão'}
              </button>
              {emailTestResult === 'success' && (
                <p style={{ color: '#22c55e', fontSize: '14px', marginTop: '8px' }}>
                  Conexão estabelecida com sucesso!
                </p>
              )}
              {emailTestResult === 'error' && (
                <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '8px' }}>
                  {emailTestError || 'Falha na conexão. Verifique as credenciais.'}
                </p>
              )}
            </div>
          )}

          {/* Email Start Mode Option */}
          {emailTestResult === 'success' && (
            <div style={{
              backgroundColor: 'var(--bg-primary)',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)'
            }}>
              <label style={{ ...labelStyle, marginBottom: '16px' }}>
                Quando a Replyna deve começar a responder?
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    cursor: 'pointer',
                    padding: '12px',
                    borderRadius: '10px',
                    backgroundColor: shopData.email_start_mode === 'all_unread' ? 'rgba(70, 114, 236, 0.08)' : 'transparent',
                    border: shopData.email_start_mode === 'all_unread' ? '1px solid var(--accent)' : '1px solid var(--border-color)',
                  }}
                >
                  <input
                    type="radio"
                    name="email_start_mode"
                    value="all_unread"
                    checked={shopData.email_start_mode === 'all_unread'}
                    onChange={() => updateField('email_start_mode', 'all_unread')}
                    style={{ marginTop: '3px', accentColor: 'var(--accent)' }}
                  />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>
                      Responder todos os emails não lidos (Recomendado)
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                      A Replyna processará e responderá todos os emails não lidos na caixa de entrada.
                      Garante que nenhum cliente fique sem resposta.
                    </p>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    cursor: 'pointer',
                    padding: '12px',
                    borderRadius: '10px',
                    backgroundColor: shopData.email_start_mode === 'from_integration_date' ? 'rgba(70, 114, 236, 0.08)' : 'transparent',
                    border: shopData.email_start_mode === 'from_integration_date' ? '1px solid var(--accent)' : '1px solid var(--border-color)',
                  }}
                >
                  <input
                    type="radio"
                    name="email_start_mode"
                    value="from_integration_date"
                    checked={shopData.email_start_mode === 'from_integration_date'}
                    onChange={() => updateField('email_start_mode', 'from_integration_date')}
                    style={{ marginTop: '3px', accentColor: 'var(--accent)' }}
                  />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>
                      A partir da data de integração
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                      A Replyna só responderá emails recebidos após a ativação da loja.
                      Emails antigos não serão processados.
                    </p>
                  </div>
                </label>
              </div>

              {shopData.email_start_mode === 'from_integration_date' && (
                <div style={{
                  marginTop: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.2)'
                }}>
                  <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>
                    <strong style={{ color: '#ef4444' }}>⚠️ Atenção:</strong> Com esta opção, emails anteriores à integração
                    não serão respondidos. Clientes que já enviaram mensagens podem ficar sem resposta,
                    aumentando o risco de reclamações e chargebacks.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Gmail tip */}
      {emailProvider === 'gmail' && (
        <div style={{
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid rgba(245, 158, 11, 0.2)'
        }}>
          <p style={{ fontSize: '14px', color: 'var(--text-primary)', margin: 0 }}>
            <strong>Dica para Gmail:</strong> Use uma "Senha de app" em vez da sua senha normal.
            Acesse Conta Google → Segurança → Senhas de app para gerar uma.
          </p>
        </div>
      )}
    </div>
  )

  const renderStep4 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Customizações
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Personalize as informações que a IA usará nas respostas
        </p>
        <TutorialLink />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
        <div>
          <label style={labelStyle}>Tempo de entrega</label>
          <input
            type="text"
            value={shopData.delivery_time}
            onChange={(e) => updateField('delivery_time', e.target.value)}
            style={inputStyle}
            placeholder="Ex: 3 a 7 dias úteis"
          />
        </div>
        <div>
          <label style={labelStyle}>Tempo de despacho</label>
          <input
            type="text"
            value={shopData.dispatch_time}
            onChange={(e) => updateField('dispatch_time', e.target.value)}
            style={inputStyle}
            placeholder="Ex: 1 a 2 dias úteis"
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Informações de garantia</label>
        <textarea
          value={shopData.warranty_info}
          onChange={(e) => updateField('warranty_info', e.target.value)}
          style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
          placeholder="Ex: Garantia de 90 dias contra defeitos de fabricação..."
        />
      </div>

      <div>
        <label style={labelStyle}>Descrição da loja</label>
        <textarea
          value={shopData.store_description}
          onChange={(e) => updateField('store_description', e.target.value)}
          style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
          placeholder="Descreva sua loja, produtos, diferenciais... A IA usará isso para contextualizar as respostas."
        />
      </div>

      <div>
        <label style={labelStyle}>Tom de voz</label>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '12px' }}>
          {toneOptions.map((tone) => (
            <button
              key={tone.value}
              onClick={() => updateField('tone_of_voice', tone.value)}
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: shopData.tone_of_voice === tone.value
                  ? '2px solid var(--accent)'
                  : '1px solid var(--border-color)',
                backgroundColor: shopData.tone_of_voice === tone.value
                  ? 'rgba(70, 114, 236, 0.08)'
                  : 'var(--bg-card)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
                {tone.label}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {tone.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cupom de Retenção */}
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)'
      }}>
        <label style={labelStyle}>Cupom de retenção (cancelamento/devolução)</label>
        <input
          type="text"
          value={shopData.retention_coupon_code}
          onChange={(e) => updateField('retention_coupon_code', e.target.value.toUpperCase())}
          style={inputStyle}
          placeholder="Ex: FICA10, DESC20"
        />
        <div style={{
          backgroundColor: 'rgba(70, 114, 236, 0.08)',
          padding: '12px 16px',
          borderRadius: '10px',
          marginTop: '12px',
          border: '1px solid rgba(70, 114, 236, 0.15)'
        }}>
          <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0, lineHeight: '1.5' }}>
            <strong>Como funciona:</strong> Quando um cliente solicitar cancelamento ou devolução,
            a IA oferecerá este cupom como incentivo para manter a compra.
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '8px 0 0 0', lineHeight: '1.5' }}>
            <strong style={{ color: '#d97706' }}>Importante:</strong> Crie este cupom na sua loja (Shopify, etc.) antes de cadastrar aqui.
            Se não configurar, a IA não oferecerá cupom de retenção.
          </p>
        </div>
      </div>
    </div>
  )

  const renderStep5 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Revisão Final
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Revise as informações antes de ativar sua loja
        </p>
      </div>

      {/* Basic Info Summary */}
      <div style={{ ...cardStyle, padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
            Informações Básicas
          </h3>
          <button
            onClick={() => setCurrentStep(1)}
            style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}
          >
            Editar
          </button>
        </div>
        <div style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Nome da loja</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{shopData.name || '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Atendente</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{shopData.attendant_name || '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Email suporte</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{shopData.support_email || '—'}</span>
          </div>
        </div>
      </div>

      {/* Shopify Summary */}
      <div style={{ ...cardStyle, padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
            Shopify
          </h3>
          <button
            onClick={() => setCurrentStep(2)}
            style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}
          >
            Editar
          </button>
        </div>
        {shopData.shopify_domain ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#22c55e'
            }} />
            <span style={{ color: 'var(--text-primary)' }}>{shopData.shopify_domain}</span>
          </div>
        ) : (
          <span style={{ color: 'var(--text-secondary)' }}>Não configurado</span>
        )}
      </div>

      {/* Email Summary */}
      <div style={{ ...cardStyle, padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
            Email
          </h3>
          <button
            onClick={() => setCurrentStep(3)}
            style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}
          >
            Editar
          </button>
        </div>
        {shopData.imap_host && shopData.smtp_host ? (
          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#22c55e'
              }} />
              <span style={{ color: 'var(--text-primary)' }}>IMAP: {shopData.imap_host}:{shopData.imap_port}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#22c55e'
              }} />
              <span style={{ color: 'var(--text-primary)' }}>SMTP: {shopData.smtp_host}:{shopData.smtp_port}</span>
            </div>
          </div>
        ) : (
          <span style={{ color: 'var(--text-secondary)' }}>Não configurado</span>
        )}
      </div>

      {/* Customizations Summary */}
      <div style={{ ...cardStyle, padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
            Customizações
          </h3>
          <button
            onClick={() => setCurrentStep(4)}
            style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}
          >
            Editar
          </button>
        </div>
        <div style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Tempo de entrega</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{shopData.delivery_time || '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Tempo de despacho</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{shopData.dispatch_time || '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Tom de voz</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
              {toneOptions.find(t => t.value === shopData.tone_of_voice)?.label || '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Cupom de retenção</span>
            {shopData.retention_coupon_code ? (
              <span style={{
                backgroundColor: 'var(--accent)',
                color: '#fff',
                padding: '2px 10px',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontWeight: '600',
                fontSize: '14px'
              }}>
                {shopData.retention_coupon_code}
              </span>
            ) : (
              <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Não configurado</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1()
      case 2: return renderStep2()
      case 3: return renderStep3()
      case 4: return renderStep4()
      case 5: return renderStep5()
      default: return null
    }
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? '20px' : '32px' }}>
        <button
          onClick={() => navigate('/shops')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--text-secondary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            marginBottom: '12px',
          }}
        >
          <ChevronLeft size={18} />
          Voltar para Minhas Lojas
        </button>
        <h1 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '700', color: 'var(--text-primary)' }}>
          {isEditing ? 'Configurar Loja' : 'Integrar Nova Loja'}
        </h1>
      </div>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Step Content */}
      <div style={{ ...cardStyle, padding: isMobile ? '20px' : '32px', marginBottom: '20px' }}>
        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '14px',
            marginBottom: '24px'
          }}>
            {error}
          </div>
        )}

        {renderCurrentStep()}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', flexDirection: isMobile && currentStep === 5 ? 'column' : 'row', justifyContent: 'space-between', gap: isMobile ? '12px' : '0' }}>
        <button
          onClick={handlePrevious}
          disabled={currentStep === 1}
          style={{
            ...buttonSecondary,
            opacity: currentStep === 1 ? 0.5 : 1,
            cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
            order: isMobile && currentStep === 5 ? 3 : 0,
          }}
        >
          <ChevronLeft size={18} />
          Anterior
        </button>

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
          {currentStep === 5 ? (
            <>
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                style={{
                  ...buttonSecondary,
                  opacity: saving ? 0.7 : 1,
                  width: isMobile ? '100%' : 'auto',
                  justifyContent: 'center',
                }}
              >
                {saving ? 'Salvando...' : 'Salvar rascunho'}
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                style={{
                  ...buttonPrimary,
                  opacity: saving ? 0.7 : 1,
                  width: isMobile ? '100%' : 'auto',
                  justifyContent: 'center',
                }}
              >
                <Rocket size={18} />
                {saving ? 'Ativando...' : 'Ativar loja'}
              </button>
            </>
          ) : (
            <button
              onClick={handleNext}
              style={{ ...buttonPrimary, width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}
            >
              Próximo
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
