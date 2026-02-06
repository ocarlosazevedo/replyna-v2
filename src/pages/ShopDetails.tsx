import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { ChevronLeft, Eye, EyeOff, Save, Store, ShoppingBag, Mail, Settings, Check, X, Edit3 } from 'lucide-react'
import { markRetentionCouponTipAsSeen } from '../components/FeatureTipBanner'

interface ShopData {
  id: string
  name: string
  attendant_name: string
  support_email: string
  shopify_domain: string
  shopify_client_id: string
  shopify_client_secret: string
  shopify_status: string
  imap_host: string
  imap_port: string
  imap_user: string
  imap_password: string
  smtp_host: string
  smtp_port: string
  smtp_user: string
  smtp_password: string
  mail_status: string
  email_sync_error: string | null
  delivery_time: string
  dispatch_time: string
  warranty_info: string
  store_description: string
  tone_of_voice: string
  retention_coupon_code: string
  retention_coupon_type: 'percentage' | 'fixed'
  retention_coupon_value: number | null
  is_active: boolean
}

const toneOptions = [
  { value: 'professional', label: 'Profissional' },
  { value: 'friendly', label: 'Amigável' },
  { value: 'casual', label: 'Casual' },
  { value: 'enthusiastic', label: 'Entusiasmado' },
]

// Componente Skeleton para loading animado
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

export default function ShopDetails() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { shopId } = useParams()
  const isMobile = useIsMobile()

  const [shop, setShop] = useState<ShopData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<ShopData>>({})
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})

  // Test connection states
  const [testingEmail, setTestingEmail] = useState(false)
  const [testingShopify, setTestingShopify] = useState(false)

  useEffect(() => {
    if (shopId) {
      loadShop()
    }
    // Marcar dica de cupom de retenção como vista
    if (user?.id) {
      markRetentionCouponTipAsSeen(user.id)
    }
  }, [shopId, user?.id])

  const loadShop = async () => {
    if (!shopId) return

    try {
      const { data, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .single()

      if (shopError) throw shopError
      setShop(data)
    } catch (err) {
      console.error('Erro ao carregar loja:', err)
      setError('Erro ao carregar dados da loja')
    } finally {
      setLoading(false)
    }
  }

  const startEditing = (section: string) => {
    if (!shop) return
    setEditingSection(section)
    setEditData({ ...shop })
    setError('')
    setSuccess('')
  }

  const cancelEditing = () => {
    setEditingSection(null)
    setEditData({})
    setError('')
  }

  const updateEditField = (field: keyof ShopData, value: string | boolean | number | null) => {
    setEditData(prev => ({ ...prev, [field]: value }))
  }

  const saveSection = async () => {
    if (!shop || !editingSection) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const { error: updateError } = await supabase
        .from('shops')
        .update(editData)
        .eq('id', shop.id)

      if (updateError) throw updateError

      setShop({ ...shop, ...editData } as ShopData)
      setEditingSection(null)
      setEditData({})
      setSuccess('Alterações salvas com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Erro ao salvar:', err)
      setError('Erro ao salvar alterações')
    } finally {
      setSaving(false)
    }
  }

  const testEmailConnection = async () => {
    if (!editData.imap_host) return
    setTestingEmail(true)
    setError('')

    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imap_host: editData.imap_host,
          imap_port: editData.imap_port,
          imap_user: editData.imap_user,
          imap_password: editData.imap_password,
          smtp_host: editData.smtp_host,
          smtp_port: editData.smtp_port,
          smtp_user: editData.smtp_user,
          smtp_password: editData.smtp_password,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setEditData(prev => ({ ...prev, mail_status: 'ok', email_sync_error: null }))
        setShop(prev => prev ? { ...prev, email_sync_error: null } : prev)
        setSuccess('Conexão de email testada com sucesso!')
      } else {
        setError(data.error || 'Falha na conexão de email')
      }
    } catch (err) {
      setError('Erro ao testar conexão de email')
    } finally {
      setTestingEmail(false)
    }
  }

  const testShopifyConnection = async () => {
    if (!editData.shopify_domain) return
    setTestingShopify(true)
    setError('')

    try {
      const response = await fetch('/api/test-shopify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopify_domain: editData.shopify_domain,
          shopify_client_id: editData.shopify_client_id,
          shopify_client_secret: editData.shopify_client_secret,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setEditData(prev => ({ ...prev, shopify_status: 'ok' }))
        setSuccess('Conexão Shopify testada com sucesso!')
      } else {
        setError(data.error || 'Falha na conexão Shopify')
      }
    } catch (err) {
      setError('Erro ao testar conexão Shopify')
    } finally {
      setTestingShopify(false)
    }
  }

  const togglePassword = (field: string) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }))
  }

  // Styles
  const cardStyle = {
    backgroundColor: 'var(--bg-card)',
    borderRadius: '16px',
    border: '1px solid var(--border-color)',
    padding: isMobile ? '16px' : '24px',
    marginBottom: '20px',
  }

  const sectionHeaderStyle = {
    display: 'flex',
    flexDirection: isMobile ? 'column' as const : 'row' as const,
    justifyContent: 'space-between',
    alignItems: isMobile ? 'flex-start' : 'center',
    marginBottom: '20px',
    gap: isMobile ? '12px' : '0',
  }

  const sectionTitleStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '18px',
    fontWeight: '600' as const,
    color: 'var(--text-primary)',
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
    fontWeight: '500' as const,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
  }

  const valueStyle = {
    fontSize: '15px',
    color: 'var(--text-primary)',
    padding: '12px 0',
  }

  const buttonPrimary = {
    backgroundColor: 'var(--accent)',
    color: '#ffffff',
    padding: '10px 20px',
    borderRadius: '10px',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  const buttonSecondary = {
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    padding: '10px 20px',
    borderRadius: '10px',
    fontWeight: '600',
    border: '1px solid var(--border-color)',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  const statusBadge = (status: string) => {
    const isOk = status === 'ok'
    return (
      <span style={{
        backgroundColor: isOk ? '#dcfce7' : '#fef3c7',
        color: isOk ? '#15803d' : '#d97706',
        padding: '4px 12px',
        borderRadius: '9999px',
        fontSize: '13px',
        fontWeight: '500',
      }}>
        {isOk ? 'Conectado' : 'Pendente'}
      </span>
    )
  }

  const emailStatusBadge = () => {
    const hasError = shop?.email_sync_error && shop.email_sync_error.trim() !== ''
    if (hasError) {
      return (
        <span style={{
          backgroundColor: '#fef2f2',
          color: '#dc2626',
          padding: '4px 12px',
          borderRadius: '9999px',
          fontSize: '13px',
          fontWeight: '500',
        }}>
          Erro de conexão
        </span>
      )
    }
    return statusBadge(shop?.mail_status || '')
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header skeleton */}
        <div style={{ marginBottom: isMobile ? '20px' : '32px' }}>
          <Skeleton height={18} width={100} />
          <div style={{ marginTop: 16 }}>
            <Skeleton height={isMobile ? 24 : 28} width="60%" />
            <div style={{ marginTop: 8 }}><Skeleton height={14} width="40%" /></div>
          </div>
        </div>

        {/* Cards skeleton */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Configurações da Loja */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '16px',
            padding: isMobile ? '16px' : '24px',
            border: '1px solid var(--border-color)',
          }}>
            <Skeleton height={20} width="40%" />
            <div style={{ marginTop: 6 }}><Skeleton height={14} width="60%" /></div>
            <div style={{ display: 'grid', gap: '16px', marginTop: '20px' }}>
              <Skeleton height={44} />
              <Skeleton height={44} />
              <Skeleton height={80} />
            </div>
          </div>

          {/* Integrações */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '16px',
            padding: isMobile ? '16px' : '24px',
            border: '1px solid var(--border-color)',
          }}>
            <Skeleton height={20} width="30%" />
            <div style={{ marginTop: 6 }}><Skeleton height={14} width="50%" /></div>
            <div style={{ display: 'grid', gap: '16px', marginTop: '20px' }}>
              <Skeleton height={100} />
              <Skeleton height={100} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!shop) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loja não encontrada</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
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
            padding: 0,
          }}
        >
          <ChevronLeft size={18} />
          Voltar para Minhas Lojas
        </button>

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '12px' : '0' }}>
          <div>
            <h1 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
              {shop.name}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Gerencie as configurações da sua loja
            </p>
          </div>
          <span style={{
            backgroundColor: shop.is_active ? '#dcfce7' : 'var(--bg-primary)',
            color: shop.is_active ? '#15803d' : 'var(--text-secondary)',
            padding: '6px 16px',
            borderRadius: '9999px',
            fontSize: '14px',
            fontWeight: '600',
          }}>
            {shop.is_active ? 'Ativa' : 'Inativa'}
          </span>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div style={{
          backgroundColor: '#dcfce7',
          color: '#15803d',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <Check size={20} />
          {success}
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          color: '#dc2626',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '24px',
          whiteSpace: 'pre-line',
        }}>
          {error}
        </div>
      )}

      {/* Basic Info Section */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div style={sectionTitleStyle}>
            <Store size={22} style={{ color: 'var(--accent)' }} />
            Informações Básicas
          </div>
          {editingSection !== 'basic' ? (
            <button onClick={() => startEditing('basic')} style={buttonSecondary}>
              <Edit3 size={16} />
              Editar
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={cancelEditing} style={buttonSecondary}>
                <X size={16} />
                Cancelar
              </button>
              <button onClick={saveSection} disabled={saving} style={buttonPrimary}>
                <Save size={16} />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Nome da loja</label>
            {editingSection === 'basic' ? (
              <input
                type="text"
                value={editData.name || ''}
                onChange={(e) => updateEditField('name', e.target.value)}
                style={inputStyle}
              />
            ) : (
              <div style={valueStyle}>{shop.name}</div>
            )}
          </div>
          <div>
            <label style={labelStyle}>Nome do atendente</label>
            {editingSection === 'basic' ? (
              <input
                type="text"
                value={editData.attendant_name || ''}
                onChange={(e) => updateEditField('attendant_name', e.target.value)}
                style={inputStyle}
              />
            ) : (
              <div style={valueStyle}>{shop.attendant_name || '-'}</div>
            )}
          </div>
          <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}>
            <label style={labelStyle}>Email para escalonamento humano</label>
            {editingSection === 'basic' ? (
              <input
                type="email"
                value={editData.support_email || ''}
                onChange={(e) => updateEditField('support_email', e.target.value)}
                style={inputStyle}
              />
            ) : (
              <div style={valueStyle}>{shop.support_email || '-'}</div>
            )}
          </div>
        </div>
      </div>

      {/* Shopify Section */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div style={sectionTitleStyle}>
            <ShoppingBag size={22} style={{ color: 'var(--accent)' }} />
            Integração Shopify
            <div style={{ marginLeft: '8px' }}>{statusBadge(shop.shopify_status)}</div>
          </div>
          {editingSection !== 'shopify' ? (
            <button onClick={() => startEditing('shopify')} style={buttonSecondary}>
              <Edit3 size={16} />
              Editar
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={cancelEditing} style={buttonSecondary}>
                <X size={16} />
                Cancelar
              </button>
              <button onClick={saveSection} disabled={saving} style={buttonPrimary}>
                <Save size={16} />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          )}
        </div>

        {editingSection === 'shopify' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Store Domain</label>
              <input
                type="text"
                value={editData.shopify_domain || ''}
                onChange={(e) => updateEditField('shopify_domain', e.target.value)}
                style={inputStyle}
                placeholder="mystore.myshopify.com"
              />
            </div>
            <div>
              <label style={labelStyle}>Client ID</label>
              <input
                type="text"
                value={editData.shopify_client_id || ''}
                onChange={(e) => updateEditField('shopify_client_id', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Client Secret</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPasswords.shopify_secret ? 'text' : 'password'}
                  value={editData.shopify_client_secret || ''}
                  onChange={(e) => updateEditField('shopify_client_secret', e.target.value)}
                  style={{ ...inputStyle, paddingRight: '48px' }}
                />
                <button
                  type="button"
                  onClick={() => togglePassword('shopify_secret')}
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
                  {showPasswords.shopify_secret ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <button
              onClick={testShopifyConnection}
              disabled={testingShopify}
              style={{ ...buttonSecondary, alignSelf: 'flex-start' }}
            >
              {testingShopify ? 'Testando...' : 'Testar conexão'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Store Domain</label>
              <div style={valueStyle}>{shop.shopify_domain || '-'}</div>
            </div>
            <div>
              <label style={labelStyle}>Client ID</label>
              <div style={valueStyle}>{shop.shopify_client_id || '-'}</div>
            </div>
            <div>
              <label style={labelStyle}>Client Secret</label>
              <div style={valueStyle}>{shop.shopify_client_secret ? '••••••••••••' : '-'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Email Section */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div style={sectionTitleStyle}>
            <Mail size={22} style={{ color: 'var(--accent)' }} />
            Integração de Email
            <div style={{ marginLeft: '8px' }}>{emailStatusBadge()}</div>
          </div>
          {editingSection !== 'email' ? (
            <button onClick={() => startEditing('email')} style={buttonSecondary}>
              <Edit3 size={16} />
              Editar
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={cancelEditing} style={buttonSecondary}>
                <X size={16} />
                Cancelar
              </button>
              <button onClick={saveSection} disabled={saving} style={buttonPrimary}>
                <Save size={16} />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          )}
        </div>

        {/* Mensagem de erro de sincronização */}
        {shop.email_sync_error && shop.email_sync_error.trim() !== '' && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '16px',
            color: '#dc2626',
            fontSize: '13px',
            lineHeight: '1.4',
          }}>
            <strong>Erro na última sincronização:</strong> {shop.email_sync_error.trim()}
            <br />
            <span style={{ color: '#6b7280', fontSize: '12px' }}>
              Os emails não estão sendo recebidos. Por favor, verifique as credenciais e teste a conexão novamente.
            </span>
          </div>
        )}

        {editingSection === 'email' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Usuário do email</label>
                <input
                  type="email"
                  value={editData.imap_user || ''}
                  onChange={(e) => {
                    updateEditField('imap_user', e.target.value)
                    updateEditField('smtp_user', e.target.value)
                  }}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Senha do email</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPasswords.email_password ? 'text' : 'password'}
                    value={editData.imap_password || ''}
                    onChange={(e) => {
                      updateEditField('imap_password', e.target.value)
                      updateEditField('smtp_password', e.target.value)
                    }}
                    style={{ ...inputStyle, paddingRight: '48px' }}
                  />
                  <button
                    type="button"
                    onClick={() => togglePassword('email_password')}
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
                    {showPasswords.email_password ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 120px', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Host IMAP</label>
                <input
                  type="text"
                  value={editData.imap_host || ''}
                  onChange={(e) => updateEditField('imap_host', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Porta IMAP</label>
                <input
                  type="text"
                  value={editData.imap_port || ''}
                  onChange={(e) => updateEditField('imap_port', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 120px', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Host SMTP</label>
                <input
                  type="text"
                  value={editData.smtp_host || ''}
                  onChange={(e) => updateEditField('smtp_host', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Porta SMTP</label>
                <input
                  type="text"
                  value={editData.smtp_port || ''}
                  onChange={(e) => updateEditField('smtp_port', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
            <button
              onClick={testEmailConnection}
              disabled={testingEmail}
              style={{ ...buttonSecondary, alignSelf: 'flex-start' }}
            >
              {testingEmail ? 'Testando...' : 'Testar conexão'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Usuário</label>
              <div style={valueStyle}>{shop.imap_user || '-'}</div>
            </div>
            <div>
              <label style={labelStyle}>Senha</label>
              <div style={valueStyle}>{shop.imap_password ? '••••••••••••' : '-'}</div>
            </div>
            <div>
              <label style={labelStyle}>IMAP</label>
              <div style={valueStyle}>{shop.imap_host ? `${shop.imap_host}:${shop.imap_port}` : '-'}</div>
            </div>
            <div>
              <label style={labelStyle}>SMTP</label>
              <div style={valueStyle}>{shop.smtp_host ? `${shop.smtp_host}:${shop.smtp_port}` : '-'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Customizations Section */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div style={sectionTitleStyle}>
            <Settings size={22} style={{ color: 'var(--accent)' }} />
            Customizações
          </div>
          {editingSection !== 'custom' ? (
            <button onClick={() => startEditing('custom')} style={buttonSecondary}>
              <Edit3 size={16} />
              Editar
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={cancelEditing} style={buttonSecondary}>
                <X size={16} />
                Cancelar
              </button>
              <button onClick={saveSection} disabled={saving} style={buttonPrimary}>
                <Save size={16} />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          )}
        </div>

        {editingSection === 'custom' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Prazo de entrega</label>
                <input
                  type="text"
                  value={editData.delivery_time || ''}
                  onChange={(e) => updateEditField('delivery_time', e.target.value)}
                  style={inputStyle}
                  placeholder="Ex: 5 a 10 dias úteis"
                />
              </div>
              <div>
                <label style={labelStyle}>Prazo de despacho</label>
                <input
                  type="text"
                  value={editData.dispatch_time || ''}
                  onChange={(e) => updateEditField('dispatch_time', e.target.value)}
                  style={inputStyle}
                  placeholder="Ex: 1 a 2 dias úteis"
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Informações de garantia</label>
              <input
                type="text"
                value={editData.warranty_info || ''}
                onChange={(e) => updateEditField('warranty_info', e.target.value)}
                style={inputStyle}
                placeholder="Ex: 30 dias de garantia"
              />
            </div>
            <div>
              <label style={labelStyle}>Descrição da loja</label>
              <textarea
                value={editData.store_description || ''}
                onChange={(e) => updateEditField('store_description', e.target.value)}
                style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                placeholder="Descreva sua loja e adicione instruções para a IA..."
              />
              <div style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                marginTop: '8px',
                lineHeight: '1.5',
                backgroundColor: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: '8px',
                padding: '12px'
              }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Dica:</strong> Descreva sua loja e inclua instruções específicas para a IA.
                </div>
                <div style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  fontStyle: 'italic',
                  marginBottom: '8px'
                }}>
                  Exemplo: "Vendemos produtos artesanais feitos sob encomenda. Quando o cliente perguntar sobre prazo, explique que cada peça é única e pode levar até 15 dias para produção."
                </div>
                <div style={{ color: 'var(--accent-purple)', fontWeight: 500 }}>
                  Importante: A IA usará essas informações de forma natural, sem revelar que são instruções internas.
                </div>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Tom de voz</label>
              <select
                value={editData.tone_of_voice || 'professional'}
                onChange={(e) => updateEditField('tone_of_voice', e.target.value)}
                className="replyna-select form-input"
              >
                {toneOptions.map(tone => (
                  <option key={tone.value} value={tone.value}>{tone.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Cupom de retenção (cancelamento/devolução)</label>
              <input
                type="text"
                value={editData.retention_coupon_code || ''}
                onChange={(e) => updateEditField('retention_coupon_code', e.target.value.toUpperCase())}
                style={inputStyle}
                placeholder="Ex: FICA10, DESC20"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Tipo de desconto</label>
                <select
                  value={editData.retention_coupon_type || 'percentage'}
                  onChange={(e) => updateEditField('retention_coupon_type', e.target.value as 'percentage' | 'fixed')}
                  className="replyna-select form-input"
                >
                  <option value="percentage">Porcentagem (%)</option>
                  <option value="fixed">Valor fixo (R$)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Valor do desconto</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editData.retention_coupon_value || ''}
                  onChange={(e) => updateEditField('retention_coupon_value', e.target.value ? parseFloat(e.target.value) : null)}
                  style={inputStyle}
                  placeholder={editData.retention_coupon_type === 'fixed' ? 'Ex: 15.00' : 'Ex: 10'}
                />
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              A IA oferecerá este cupom com o valor configurado para clientes que desejam cancelar ou devolver.
              <br />
              <strong style={{ color: 'var(--warning, #d97706)' }}>Importante:</strong> Crie este cupom na sua loja (Shopify, etc.) antes de cadastrar aqui.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Prazo de entrega</label>
              <div style={valueStyle}>{shop.delivery_time || '-'}</div>
            </div>
            <div>
              <label style={labelStyle}>Prazo de despacho</label>
              <div style={valueStyle}>{shop.dispatch_time || '-'}</div>
            </div>
            <div>
              <label style={labelStyle}>Garantia</label>
              <div style={valueStyle}>{shop.warranty_info || '-'}</div>
            </div>
            <div>
              <label style={labelStyle}>Tom de voz</label>
              <div style={valueStyle}>
                {toneOptions.find(t => t.value === shop.tone_of_voice)?.label || 'Profissional'}
              </div>
            </div>
            <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}>
              <label style={labelStyle}>Descrição da loja</label>
              <div style={valueStyle}>{shop.store_description || '-'}</div>
            </div>
            <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}>
              <label style={labelStyle}>Cupom de retenção</label>
              <div style={valueStyle}>
                {shop.retention_coupon_code ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{
                      backgroundColor: 'var(--accent)',
                      color: '#fff',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontWeight: 600
                    }}>
                      {shop.retention_coupon_code}
                    </span>
                    {shop.retention_coupon_value && (
                      <span style={{
                        backgroundColor: 'rgba(34, 197, 94, 0.16)',
                        color: '#15803d',
                        padding: '2px 10px',
                        borderRadius: '4px',
                        fontSize: '14px',
                        fontWeight: 600
                      }}>
                        {shop.retention_coupon_type === 'fixed'
                          ? `R$ ${shop.retention_coupon_value.toFixed(2).replace('.', ',')} de desconto`
                          : `${shop.retention_coupon_value}% de desconto`
                        }
                      </span>
                    )}
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-secondary)' }}>Não configurado</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
