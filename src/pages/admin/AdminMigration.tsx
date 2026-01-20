import { useEffect, useState } from 'react'
import { Plus, Trash2, Calendar, Copy, Check, RefreshCw, Mail, User, CreditCard } from 'lucide-react'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isMobile
}

interface Plan {
  id: string
  name: string
  price_monthly: number
  shops_limit: number
}

interface MigrationInvite {
  id: string
  code: string
  customer_email: string
  customer_name: string | null
  plan_id: string
  billing_start_date: string
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  expires_at: string
  created_at: string
  accepted_at: string | null
  plan: Plan | null
  admin: { name: string; email: string } | null
}

export default function AdminMigration() {
  const isMobile = useIsMobile()
  const [invites, setInvites] = useState<MigrationInvite[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    customer_email: '',
    customer_name: '',
    plan_id: '',
    billing_start_date: '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null)

  useEffect(() => {
    loadInvites()
  }, [])

  const loadInvites = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-migration-invites`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar convites')
      }

      setInvites(data.invites || [])
      setPlans(data.plans || [])
    } catch (err) {
      console.error('Erro ao carregar convites:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = () => {
    setFormData({
      customer_email: '',
      customer_name: '',
      plan_id: plans[0]?.id || '',
      billing_start_date: new Date().toISOString().split('T')[0],
    })
    setCreatedInviteUrl(null)
    setShowModal(true)
  }

  const handleCreateInvite = async () => {
    if (!formData.customer_email || !formData.plan_id || !formData.billing_start_date) {
      alert('Preencha todos os campos obrigatórios')
      return
    }

    setSaving(true)

    try {
      // Pegar admin_id do localStorage
      const adminData = localStorage.getItem('admin_session')
      const adminId = adminData ? JSON.parse(adminData).admin?.id : null

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-migration-invites`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            ...formData,
            admin_id: adminId,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar convite')
      }

      setCreatedInviteUrl(data.invite_url)
      loadInvites()
    } catch (err) {
      console.error('Erro ao criar convite:', err)
      alert(err instanceof Error ? err.message : 'Erro ao criar convite')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelInvite = async (inviteId: string) => {
    if (!confirm('Tem certeza que deseja cancelar este convite?')) return

    setDeleting(inviteId)

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-migration-invites?id=${inviteId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Erro ao cancelar convite')
      }

      // Remove o convite da lista imediatamente
      setInvites(prev => prev.filter(invite => invite.id !== inviteId))
    } catch (err) {
      console.error('Erro ao cancelar convite:', err)
      // Em caso de erro, recarrega a lista para garantir consistência
      loadInvites()
    } finally {
      setDeleting(null)
    }
  }

  const copyToClipboard = (text: string, code: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(date))

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      pending: { bg: 'rgba(245, 158, 11, 0.16)', color: '#f59e0b', label: 'Pendente' },
      accepted: { bg: 'rgba(34, 197, 94, 0.16)', color: '#22c55e', label: 'Aceito' },
      expired: { bg: 'rgba(107, 114, 128, 0.16)', color: '#6b7280', label: 'Expirado' },
      cancelled: { bg: 'rgba(239, 68, 68, 0.16)', color: '#ef4444', label: 'Cancelado' },
    }
    const style = styles[status] || styles.pending

    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        backgroundColor: style.bg,
        color: style.color,
      }}>
        {style.label}
      </span>
    )
  }

  const getInviteUrl = (code: string) => {
    const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin
    return `${siteUrl}/migrate/${code}`
  }

  const cardStyle = {
    backgroundColor: 'var(--bg-card)',
    borderRadius: '16px',
    padding: isMobile ? '16px' : '24px',
    border: '1px solid var(--border-color)',
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
  }

  const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 600,
    fontSize: '14px',
    color: 'var(--text-primary)',
  }

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{
          height: '32px',
          width: '200px',
          backgroundColor: 'var(--border-color)',
          borderRadius: '8px',
          marginBottom: '32px',
          animation: 'replyna-pulse 1.6s ease-in-out infinite',
        }} />
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', marginBottom: isMobile ? '24px' : '32px', gap: isMobile ? '16px' : '0' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Migração V1
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '14px' : '15px' }}>
            Gerencie convites para clientes da versão anterior
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          style={{
            padding: '12px 20px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: 'var(--accent)',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: isMobile ? '100%' : 'auto',
          }}
        >
          <Plus size={18} />
          Novo Convite
        </button>
      </div>

      {/* Info Card */}
      <div style={{
        ...cardStyle,
        marginBottom: '24px',
        backgroundColor: 'rgba(70, 114, 236, 0.06)',
        borderColor: 'rgba(70, 114, 236, 0.2)',
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)', marginBottom: '8px' }}>
          Como funciona a migração?
        </h3>
        <ol style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.8' }}>
          <li>Crie um convite com o email do cliente e a data de início da cobrança</li>
          <li>Copie e envie o link de convite para o cliente</li>
          <li>O cliente acessa o link, cria a conta e adiciona o cartão</li>
          <li>O cliente usa o sistema normalmente até a data de início da cobrança</li>
          <li>Na data definida, o Stripe cobra automaticamente</li>
        </ol>
      </div>

      <div style={cardStyle}>
        {isMobile ? (
          /* Mobile: Card Layout */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {invites.map((invite) => (
              <div key={invite.id} style={{
                backgroundColor: 'var(--bg-primary)',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid var(--border-color)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {invite.customer_name || invite.customer_email}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {invite.customer_email}
                    </div>
                  </div>
                  {getStatusBadge(invite.status)}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Plano</div>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '13px' }}>
                      {invite.plan?.name || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Início Cobrança</div>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '13px' }}>
                      {formatDate(invite.billing_start_date)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <code style={{
                    flex: 1,
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {invite.code}
                  </code>
                  <button
                    onClick={() => copyToClipboard(getInviteUrl(invite.code), invite.code)}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: copiedCode === invite.code ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                      color: copiedCode === invite.code ? '#22c55e' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {copiedCode === invite.code ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>

                {invite.status === 'pending' && (
                  <button
                    onClick={() => handleCancelInvite(invite.id)}
                    disabled={deleting === invite.id}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: deleting === invite.id ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                      color: '#ef4444',
                      cursor: deleting === invite.id ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    {deleting === invite.id ? 'Cancelando...' : 'Cancelar Convite'}
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Desktop: Table Layout */
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
                <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Cliente</th>
                <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Plano</th>
                <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Início Cobrança</th>
                <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Código</th>
                <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Status</th>
                <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}></th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(70, 114, 236, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <User size={18} style={{ color: 'var(--accent)' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {invite.customer_name || 'Sem nome'}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {invite.customer_email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CreditCard size={14} style={{ color: 'var(--text-secondary)' }} />
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {invite.plan?.name || 'N/A'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {invite.plan?.shops_limit || 1} loja(s)
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                      <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                      {formatDate(invite.billing_start_date)}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code style={{
                        padding: '6px 10px',
                        backgroundColor: 'var(--bg-primary)',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        color: 'var(--text-primary)',
                      }}>
                        {invite.code}
                      </code>
                      <button
                        onClick={() => copyToClipboard(getInviteUrl(invite.code), invite.code)}
                        title="Copiar link do convite"
                        style={{
                          padding: '6px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: copiedCode === invite.code ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                          color: copiedCode === invite.code ? '#22c55e' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {copiedCode === invite.code ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    {getStatusBadge(invite.status)}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {invite.status === 'pending' && (
                      <button
                        onClick={() => handleCancelInvite(invite.id)}
                        disabled={deleting === invite.id}
                        style={{
                          padding: '8px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: deleting === invite.id ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                          color: '#ef4444',
                          cursor: deleting === invite.id ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {deleting === invite.id ? (
                          <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {invites.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
            Nenhum convite de migração criado ainda
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => !createdInviteUrl && setShowModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '500px',
              border: '1px solid var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {createdInviteUrl ? (
              /* Success State */
              <>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}>
                    <Check size={32} style={{ color: '#22c55e' }} />
                  </div>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Convite Criado!
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                    Envie o link abaixo para o cliente
                  </p>
                </div>

                <div style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '12px',
                  marginBottom: '16px',
                }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Link do convite:
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <code style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: 'var(--bg-card)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      color: 'var(--accent)',
                      wordBreak: 'break-all',
                    }}>
                      {createdInviteUrl}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(createdInviteUrl)
                        setCopiedCode('new')
                        setTimeout(() => setCopiedCode(null), 2000)
                      }}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: copiedCode === 'new' ? '#22c55e' : 'var(--accent)',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {copiedCode === 'new' ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowModal(false)
                    setCreatedInviteUrl(null)
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 24px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: 'var(--accent)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Fechar
                </button>
              </>
            ) : (
              /* Form State */
              <>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '24px' }}>
                  Novo Convite de Migração
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>
                      <Mail size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                      Email do Cliente *
                    </label>
                    <input
                      type="email"
                      value={formData.customer_email}
                      onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                      style={inputStyle}
                      placeholder="cliente@email.com"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      <User size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                      Nome do Cliente (opcional)
                    </label>
                    <input
                      type="text"
                      value={formData.customer_name}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                      style={inputStyle}
                      placeholder="João Silva"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      <CreditCard size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                      Plano *
                    </label>
                    <select
                      value={formData.plan_id}
                      onChange={(e) => setFormData({ ...formData, plan_id: e.target.value })}
                      style={inputStyle}
                    >
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} - R$ {plan.price_monthly}/mês ({plan.shops_limit} loja{plan.shops_limit > 1 ? 's' : ''})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>
                      <Calendar size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                      Data de Início da Cobrança *
                    </label>
                    <input
                      type="date"
                      value={formData.billing_start_date}
                      onChange={(e) => setFormData({ ...formData, billing_start_date: e.target.value })}
                      style={inputStyle}
                      min={new Date().toISOString().split('T')[0]}
                    />
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      O cliente não será cobrado até esta data
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'row', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowModal(false)}
                    disabled={saving}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'transparent',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.5 : 1,
                      width: isMobile ? '100%' : 'auto',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateInvite}
                    disabled={saving || !formData.customer_email || !formData.plan_id || !formData.billing_start_date}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: 'var(--accent)',
                      color: '#fff',
                      fontWeight: 600,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      width: isMobile ? '100%' : 'auto',
                    }}
                  >
                    {saving ? (
                      <>
                        <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        Criando...
                      </>
                    ) : (
                      'Criar Convite'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
