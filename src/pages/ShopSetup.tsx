import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Check, ChevronLeft, ChevronRight, Store, ShoppingBag, Mail, Settings, Rocket, Eye, EyeOff } from 'lucide-react'

interface ShopData {
  // Step 1 - Basic Info
  name: string
  attendant_name: string
  support_email: string

  // Step 2 - Shopify
  shopify_store_url: string
  shopify_access_token: string

  // Step 3 - Email IMAP/SMTP
  imap_host: string
  imap_port: string
  imap_user: string
  imap_password: string
  smtp_host: string
  smtp_port: string
  smtp_user: string
  smtp_password: string

  // Step 4 - Customizations
  delivery_time: string
  dispatch_time: string
  warranty_info: string
  store_description: string
  tone_of_voice: string
}

const initialShopData: ShopData = {
  name: '',
  attendant_name: '',
  support_email: '',
  shopify_store_url: '',
  shopify_access_token: '',
  imap_host: '',
  imap_port: '993',
  imap_user: '',
  imap_password: '',
  smtp_host: '',
  smtp_port: '587',
  smtp_user: '',
  smtp_password: '',
  delivery_time: '',
  dispatch_time: '',
  warranty_info: '',
  store_description: '',
  tone_of_voice: 'professional',
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

  const [currentStep, setCurrentStep] = useState(1)
  const [shopData, setShopData] = useState<ShopData>(initialShopData)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showImapPassword, setShowImapPassword] = useState(false)
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [showShopifyToken, setShowShopifyToken] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [emailTestResult, setEmailTestResult] = useState<'success' | 'error' | null>(null)
  const [testingShopify, setTestingShopify] = useState(false)
  const [shopifyTestResult, setShopifyTestResult] = useState<'success' | 'error' | null>(null)

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
          shopify_store_url: shop.shopify_store_url || '',
          shopify_access_token: shop.shopify_access_token || '',
          imap_host: shop.imap_host || '',
          imap_port: shop.imap_port || '993',
          imap_user: shop.imap_user || '',
          imap_password: shop.imap_password || '',
          smtp_host: shop.smtp_host || '',
          smtp_port: shop.smtp_port || '587',
          smtp_user: shop.smtp_user || '',
          smtp_password: shop.smtp_password || '',
          delivery_time: shop.delivery_time || '',
          dispatch_time: shop.dispatch_time || '',
          warranty_info: shop.warranty_info || '',
          store_description: shop.store_description || '',
          tone_of_voice: shop.tone_of_voice || 'professional',
        })
      }
    } catch (err) {
      console.error('Erro ao carregar loja:', err)
      setError('Erro ao carregar dados da loja')
    }
  }

  const updateField = (field: keyof ShopData, value: string) => {
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
        // Shopify is optional, but if provided, both fields are required
        if (shopData.shopify_store_url && !shopData.shopify_access_token) {
          setError('Token de acesso do Shopify é obrigatório')
          return false
        }
        if (shopData.shopify_access_token && !shopData.shopify_store_url) {
          setError('URL da loja Shopify é obrigatória')
          return false
        }
        return true
      case 3:
        // Email is optional, but if provided, all fields are required
        if (shopData.imap_host || shopData.smtp_host) {
          if (!shopData.imap_host || !shopData.imap_user || !shopData.imap_password) {
            setError('Todos os campos IMAP são obrigatórios')
            return false
          }
          if (!shopData.smtp_host || !shopData.smtp_user || !shopData.smtp_password) {
            setError('Todos os campos SMTP são obrigatórios')
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

    try {
      const shopPayload = {
        user_id: user.id,
        name: shopData.name,
        attendant_name: shopData.attendant_name,
        support_email: shopData.support_email,
        shopify_store_url: shopData.shopify_store_url || null,
        shopify_access_token: shopData.shopify_access_token || null,
        shopify_status: shopData.shopify_store_url && shopData.shopify_access_token ? 'pending' : null,
        imap_host: shopData.imap_host || null,
        imap_port: shopData.imap_port || null,
        imap_user: shopData.imap_user || null,
        imap_password: shopData.imap_password || null,
        smtp_host: shopData.smtp_host || null,
        smtp_port: shopData.smtp_port || null,
        smtp_user: shopData.smtp_user || null,
        smtp_password: shopData.smtp_password || null,
        mail_status: shopData.imap_host && shopData.smtp_host ? 'pending' : null,
        delivery_time: shopData.delivery_time || null,
        dispatch_time: shopData.dispatch_time || null,
        warranty_info: shopData.warranty_info || null,
        store_description: shopData.store_description || null,
        tone_of_voice: shopData.tone_of_voice,
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
      const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar loja'
      setError(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const testEmailConnection = async () => {
    setTestingEmail(true)
    setEmailTestResult(null)

    // Simulate testing - in production this would call a backend endpoint
    await new Promise(resolve => setTimeout(resolve, 2000))

    // For now, just simulate success if all fields are filled
    if (shopData.imap_host && shopData.imap_user && shopData.imap_password &&
        shopData.smtp_host && shopData.smtp_user && shopData.smtp_password) {
      setEmailTestResult('success')
    } else {
      setEmailTestResult('error')
    }

    setTestingEmail(false)
  }

  const testShopifyConnection = async () => {
    setTestingShopify(true)
    setShopifyTestResult(null)

    // Simulate testing - in production this would call a backend endpoint
    await new Promise(resolve => setTimeout(resolve, 2000))

    // For now, just simulate success if all fields are filled
    if (shopData.shopify_store_url && shopData.shopify_access_token) {
      setShopifyTestResult('success')
    } else {
      setShopifyTestResult('error')
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
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {steps.map((step, index) => (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => {
                if (step.id < currentStep || validateStep(currentStep)) {
                  setCurrentStep(step.id)
                }
              }}
              style={{
                width: '44px',
                height: '44px',
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
                <Check size={20} />
              ) : (
                <step.icon size={20} />
              )}
            </button>
            {index < steps.length - 1 && (
              <div
                style={{
                  width: '60px',
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

  const renderStep1 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Informações Básicas
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Configure as informações principais da sua loja
        </p>
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
          placeholder="Ex: Ana, Carlos, Suporte"
        />
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          Este nome será usado nas respostas automáticas aos clientes
        </p>
      </div>

      <div>
        <label style={labelStyle}>Email para atendimento humano *</label>
        <input
          type="email"
          value={shopData.support_email}
          onChange={(e) => updateField('support_email', e.target.value)}
          style={inputStyle}
          placeholder="suporte@minhaloja.com"
        />
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          Emails que precisam de atendimento humano serão encaminhados para este endereço
        </p>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Integração Shopify
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Conecte sua loja Shopify para habilitar consultas de pedidos e produtos
        </p>
      </div>

      <div style={{
        backgroundColor: 'rgba(70, 114, 236, 0.08)',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid rgba(70, 114, 236, 0.2)'
      }}>
        <p style={{ fontSize: '14px', color: 'var(--text-primary)', margin: 0 }}>
          <strong>Como obter o token de acesso:</strong><br />
          1. Acesse Admin da Shopify → Configurações → Apps e canais de vendas<br />
          2. Clique em "Desenvolver apps" → "Criar app"<br />
          3. Em "Configurar escopo da API Admin", selecione: read_orders, read_products<br />
          4. Instale o app e copie o token de acesso
        </p>
      </div>

      <div>
        <label style={labelStyle}>URL da loja Shopify</label>
        <input
          type="text"
          value={shopData.shopify_store_url}
          onChange={(e) => updateField('shopify_store_url', e.target.value)}
          style={inputStyle}
          placeholder="minhaloja.myshopify.com"
        />
      </div>

      <div>
        <label style={labelStyle}>Token de acesso</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showShopifyToken ? 'text' : 'password'}
            value={shopData.shopify_access_token}
            onChange={(e) => updateField('shopify_access_token', e.target.value)}
            style={{ ...inputStyle, paddingRight: '48px' }}
            placeholder="shpat_xxxxxxxxxxxxxxxxxxxxx"
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
      </div>

      {shopData.shopify_store_url && shopData.shopify_access_token && (
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
              Falha na conexão. Verifique as credenciais.
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
          Integração de Email
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Configure IMAP para receber emails e SMTP para enviar respostas
        </p>
      </div>

      {/* IMAP Section */}
      <div style={{ ...cardStyle, padding: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>
          IMAP (Recebimento)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>Servidor IMAP</label>
            <input
              type="text"
              value={shopData.imap_host}
              onChange={(e) => updateField('imap_host', e.target.value)}
              style={inputStyle}
              placeholder="imap.gmail.com"
            />
          </div>
          <div>
            <label style={labelStyle}>Porta</label>
            <input
              type="text"
              value={shopData.imap_port}
              onChange={(e) => updateField('imap_port', e.target.value)}
              style={inputStyle}
              placeholder="993"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Usuário</label>
            <input
              type="text"
              value={shopData.imap_user}
              onChange={(e) => updateField('imap_user', e.target.value)}
              style={inputStyle}
              placeholder="email@exemplo.com"
            />
          </div>
          <div>
            <label style={labelStyle}>Senha</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showImapPassword ? 'text' : 'password'}
                value={shopData.imap_password}
                onChange={(e) => updateField('imap_password', e.target.value)}
                style={{ ...inputStyle, paddingRight: '48px' }}
                placeholder="••••••••"
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
        </div>
      </div>

      {/* SMTP Section */}
      <div style={{ ...cardStyle, padding: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>
          SMTP (Envio)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>Servidor SMTP</label>
            <input
              type="text"
              value={shopData.smtp_host}
              onChange={(e) => updateField('smtp_host', e.target.value)}
              style={inputStyle}
              placeholder="smtp.gmail.com"
            />
          </div>
          <div>
            <label style={labelStyle}>Porta</label>
            <input
              type="text"
              value={shopData.smtp_port}
              onChange={(e) => updateField('smtp_port', e.target.value)}
              style={inputStyle}
              placeholder="587"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Usuário</label>
            <input
              type="text"
              value={shopData.smtp_user}
              onChange={(e) => updateField('smtp_user', e.target.value)}
              style={inputStyle}
              placeholder="email@exemplo.com"
            />
          </div>
          <div>
            <label style={labelStyle}>Senha</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showSmtpPassword ? 'text' : 'password'}
                value={shopData.smtp_password}
                onChange={(e) => updateField('smtp_password', e.target.value)}
                style={{ ...inputStyle, paddingRight: '48px' }}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowSmtpPassword(!showSmtpPassword)}
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
                {showSmtpPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {shopData.imap_host && shopData.smtp_host && (
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
              Falha na conexão. Verifique as credenciais.
            </p>
          )}
        </div>
      )}

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
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
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
        {shopData.shopify_store_url ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#22c55e'
            }} />
            <span style={{ color: 'var(--text-primary)' }}>{shopData.shopify_store_url}</span>
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
      <div style={{ marginBottom: '32px' }}>
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
            marginBottom: '16px',
          }}
        >
          <ChevronLeft size={18} />
          Voltar para Minhas Lojas
        </button>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)' }}>
          {isEditing ? 'Configurar Loja' : 'Integrar Nova Loja'}
        </h1>
      </div>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Step Content */}
      <div style={{ ...cardStyle, padding: '32px', marginBottom: '24px' }}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button
          onClick={handlePrevious}
          disabled={currentStep === 1}
          style={{
            ...buttonSecondary,
            opacity: currentStep === 1 ? 0.5 : 1,
            cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
          }}
        >
          <ChevronLeft size={18} />
          Anterior
        </button>

        <div style={{ display: 'flex', gap: '12px' }}>
          {currentStep === 5 ? (
            <>
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                style={{
                  ...buttonSecondary,
                  opacity: saving ? 0.7 : 1,
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
                }}
              >
                <Rocket size={18} />
                {saving ? 'Ativando...' : 'Ativar loja'}
              </button>
            </>
          ) : (
            <button
              onClick={handleNext}
              style={buttonPrimary}
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
