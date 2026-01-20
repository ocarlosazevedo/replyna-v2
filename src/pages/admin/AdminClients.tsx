import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, Edit2, Mail, Store, Calendar, ChevronDown, ChevronUp, ExternalLink, Trash2, Key, RefreshCw, ArrowUpDown } from 'lucide-react'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isMobile
}

interface Shop {
  id: string
  name: string
  shopify_domain: string
  is_active: boolean
}

interface Subscription {
  stripe_subscription_id: string
  status: string
  current_period_end: string
}

interface Client {
  id: string
  email: string
  name: string | null
  plan: string
  emails_limit: number
  emails_used: number
  shops_limit: number
  status: string | null
  created_at: string
  last_login_at: string | null
  shops: Shop[]
  subscription: Subscription | null
}

interface Plan {
  id: string
  name: string
  emails_limit: number
  shops_limit: number
  is_active: boolean
}

type SortField = 'name' | 'created_at' | 'emails_used' | 'renewal' | 'plan'
type SortDirection = 'asc' | 'desc'

export default function AdminClients() {
  const [clients, setClients] = useState<Client[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPlan, setFilterPlan] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-clients`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao carregar clientes')
      }

      const data = await response.json()

      setClients(data.clients as Client[])
      setPlans(data.plans as Plan[])
    } catch (err) {
      console.error('Erro ao carregar clientes:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEditClient = (client: Client) => {
    setEditingClient(client)
    setShowModal(true)
    setActionMessage(null)
  }

  const handleSaveClient = async () => {
    if (!editingClient) return

    try {
      const selectedPlan = plans.find(p => p.name.toLowerCase() === editingClient.plan)

      const updateData: Record<string, unknown> = {
        name: editingClient.name,
        plan: editingClient.plan,
        status: editingClient.status,
      }

      if (selectedPlan) {
        updateData.emails_limit = selectedPlan.emails_limit
        updateData.shops_limit = selectedPlan.shops_limit
      }

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', editingClient.id)

      if (error) throw error

      setShowModal(false)
      loadData()
    } catch (err) {
      console.error('Erro ao salvar cliente:', err)
    }
  }

  const handleDeleteClient = async (clientId: string) => {
    setDeleting(true)
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-client`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: clientId }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao deletar cliente')
      }

      setDeleteConfirm(null)
      loadData()
    } catch (err) {
      console.error('Erro ao deletar cliente:', err)
      alert('Erro ao deletar cliente: ' + (err instanceof Error ? err.message : 'Erro desconhecido'))
    } finally {
      setDeleting(false)
    }
  }

  const handleSendResetPassword = async () => {
    if (!editingClient) return

    setSendingReset(true)
    setActionMessage(null)

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-send-reset-password`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: editingClient.email }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao enviar email')
      }

      setActionMessage({ type: 'success', text: 'Email de redefinição de senha enviado com sucesso!' })
    } catch (err) {
      setActionMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao enviar email' })
    } finally {
      setSendingReset(false)
    }
  }

  const toggleExpand = (clientId: string) => {
    setExpandedClient(expandedClient === clientId ? null : clientId)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const getEffectiveStatus = (client: Client): string => {
    if (client.subscription) {
      const subStatus = client.subscription.status
      if (subStatus === 'canceled') return 'canceled'
      if (subStatus === 'past_due') return 'past_due'
      if (subStatus === 'unpaid') return 'suspended'
      if (subStatus === 'active') return 'active'
      if (subStatus === 'trialing') return 'trialing'
    }
    return client.status || 'inactive'
  }

  // Filtrar e ordenar clientes
  const filteredAndSortedClients = clients
    .filter((client) => {
      // Filtro de busca
      const matchesSearch =
        client.email.toLowerCase().includes(search.toLowerCase()) ||
        (client.name && client.name.toLowerCase().includes(search.toLowerCase())) ||
        client.shops.some(shop =>
          shop.name.toLowerCase().includes(search.toLowerCase()) ||
          shop.shopify_domain.toLowerCase().includes(search.toLowerCase())
        )

      // Filtro de status
      const matchesStatus = filterStatus === 'all' || getEffectiveStatus(client) === filterStatus

      // Filtro de plano
      const matchesPlan = filterPlan === 'all' || client.plan === filterPlan

      return matchesSearch && matchesStatus && matchesPlan
    })
    .sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '')
          break
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'emails_used':
          comparison = a.emails_used - b.emails_used
          break
        case 'renewal':
          const aRenewal = a.subscription?.current_period_end ? new Date(a.subscription.current_period_end).getTime() : 0
          const bRenewal = b.subscription?.current_period_end ? new Date(b.subscription.current_period_end).getTime() : 0
          comparison = aRenewal - bRenewal
          break
        case 'plan':
          comparison = (a.plan || '').localeCompare(b.plan || '')
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(date))

  const getPlanDisplayName = (planSlug: string | null) => {
    if (!planSlug) return 'Free'
    const plan = plans.find(p => p.name.toLowerCase() === planSlug.toLowerCase())
    return plan?.name || planSlug.charAt(0).toUpperCase() + planSlug.slice(1)
  }

  // Cores por plano
  const getPlanColor = (planSlug: string | null): { bg: string; color: string } => {
    const slug = planSlug?.toLowerCase() || 'free'
    switch (slug) {
      case 'starter':
        return { bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }
      case 'growth':
        return { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }
      case 'scale':
        return { bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }
      case 'high scale':
        return { bg: 'rgba(236, 72, 153, 0.1)', color: '#ec4899' }
      case 'enterprise':
        return { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }
      case 'free':
      default:
        return { bg: 'rgba(107, 114, 128, 0.1)', color: '#6b7280' }
    }
  }

  const getStatusBadge = (status: string) => {
    const base = { padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }
    switch (status) {
      case 'active':
        return { ...base, backgroundColor: 'rgba(34, 197, 94, 0.16)', color: '#22c55e' }
      case 'trialing':
        return { ...base, backgroundColor: 'rgba(59, 130, 246, 0.16)', color: '#3b82f6' }
      case 'past_due':
        return { ...base, backgroundColor: 'rgba(245, 158, 11, 0.16)', color: '#f59e0b' }
      case 'canceled':
        return { ...base, backgroundColor: 'rgba(239, 68, 68, 0.16)', color: '#ef4444' }
      case 'inactive':
        return { ...base, backgroundColor: 'rgba(107, 114, 128, 0.16)', color: '#6b7280' }
      case 'suspended':
        return { ...base, backgroundColor: 'rgba(239, 68, 68, 0.16)', color: '#ef4444' }
      default:
        return { ...base, backgroundColor: 'rgba(107, 114, 128, 0.16)', color: '#6b7280' }
    }
  }

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'active': return 'Ativo'
      case 'trialing': return 'Trial'
      case 'past_due': return 'Pendente'
      case 'canceled': return 'Cancelado'
      case 'inactive': return 'Inativo'
      case 'suspended': return 'Suspenso'
      default: return 'Inativo'
    }
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

  const selectStyle = {
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
  }

  const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 600,
    fontSize: '14px',
    color: 'var(--text-primary)',
  }

  const sortButtonStyle = (active: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
  })

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
        <div style={{
          height: '400px',
          backgroundColor: 'var(--border-color)',
          borderRadius: '16px',
          animation: 'replyna-pulse 1.6s ease-in-out infinite',
        }} />
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', marginBottom: isMobile ? '20px' : '32px', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Clientes
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Gerencie todos os usuarios da plataforma ({filteredAndSortedClients.length} de {clients.length})
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px',
        alignItems: 'center',
      }}>
        <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : '0 0 280px' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
            }}
          />
          <input
            type="text"
            placeholder="Buscar cliente ou loja..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              ...inputStyle,
              paddingLeft: '40px',
            }}
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={selectStyle}
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="trialing">Trial</option>
          <option value="past_due">Pendentes</option>
          <option value="canceled">Cancelados</option>
          <option value="inactive">Inativos</option>
        </select>

        <select
          value={filterPlan}
          onChange={(e) => setFilterPlan(e.target.value)}
          style={selectStyle}
        >
          <option value="all">Todos os planos</option>
          <option value="free">Free</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.name.toLowerCase()}>
              {plan.name}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Ordenar:</span>
          <select
            value={`${sortField}-${sortDirection}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split('-') as [SortField, SortDirection]
              setSortField(field)
              setSortDirection(dir)
            }}
            style={selectStyle}
          >
            <option value="created_at-desc">Mais recentes</option>
            <option value="created_at-asc">Mais antigos</option>
            <option value="emails_used-desc">Mais emails</option>
            <option value="emails_used-asc">Menos emails</option>
            <option value="renewal-asc">Renovação próxima</option>
            <option value="renewal-desc">Renovação distante</option>
            <option value="name-asc">Nome A-Z</option>
            <option value="name-desc">Nome Z-A</option>
          </select>
        </div>
      </div>

      <div style={cardStyle}>
        {isMobile ? (
          /* Mobile: Card Layout */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredAndSortedClients.map((client) => {
              const planColor = getPlanColor(client.plan)
              return (
                <div
                  key={client.id}
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: '12px',
                    padding: '16px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(70, 114, 236, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Mail size={16} style={{ color: 'var(--accent)' }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                          {client.name || 'Sem nome'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {client.email}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleEditClient(client)}
                        style={{
                          padding: '8px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'transparent',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(client.id)}
                        style={{
                          padding: '8px',
                          borderRadius: '8px',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          backgroundColor: 'transparent',
                          color: '#ef4444',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: planColor.bg,
                      color: planColor.color,
                      fontSize: '11px',
                      fontWeight: 600,
                    }}>
                      {getPlanDisplayName(client.plan)}
                    </span>
                    <span style={getStatusBadge(getEffectiveStatus(client))}>
                      {getStatusLabel(getEffectiveStatus(client))}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Store size={12} /> {client.shops.length}/{client.shops_limit}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {client.emails_used}/{client.emails_limit} emails
                    </span>
                  </div>
                  {client.subscription?.current_period_end && (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                      Renova em: {formatDate(client.subscription.current_period_end)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
        /* Desktop: Table Layout */
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', width: '40px' }}></th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <button style={sortButtonStyle(sortField === 'name')} onClick={() => handleSort('name')}>
                  Cliente <ArrowUpDown size={12} />
                </button>
              </th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <button style={sortButtonStyle(sortField === 'plan')} onClick={() => handleSort('plan')}>
                  Plano <ArrowUpDown size={12} />
                </button>
              </th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <button style={sortButtonStyle(sortField === 'emails_used')} onClick={() => handleSort('emails_used')}>
                  Emails <ArrowUpDown size={12} />
                </button>
              </th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Lojas</th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Status</th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <button style={sortButtonStyle(sortField === 'created_at')} onClick={() => handleSort('created_at')}>
                  Cadastro <ArrowUpDown size={12} />
                </button>
              </th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <button style={sortButtonStyle(sortField === 'renewal')} onClick={() => handleSort('renewal')}>
                  Renovação <ArrowUpDown size={12} />
                </button>
              </th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedClients.map((client) => {
              const planColor = getPlanColor(client.plan)
              return (
                <>
                  <tr key={client.id} style={{ borderBottom: expandedClient === client.id ? 'none' : '1px solid var(--border-color)' }}>
                    <td style={{ padding: '16px 8px 16px 16px' }}>
                      {client.shops.length > 0 && (
                        <button
                          onClick={() => toggleExpand(client.id)}
                          style={{
                            padding: '4px',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {expandedClient === client.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      )}
                    </td>
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
                          <Mail size={18} style={{ color: 'var(--accent)' }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {client.name || 'Sem nome'}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {client.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        backgroundColor: planColor.bg,
                        color: planColor.color,
                        fontSize: '13px',
                        fontWeight: 600,
                      }}>
                        {getPlanDisplayName(client.plan)}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                        {client.emails_used} / {client.emails_limit}
                      </div>
                      <div style={{
                        width: '80px',
                        height: '4px',
                        backgroundColor: 'var(--border-color)',
                        borderRadius: '2px',
                        marginTop: '4px',
                      }}>
                        <div style={{
                          width: `${Math.min((client.emails_used / client.emails_limit) * 100, 100)}%`,
                          height: '100%',
                          backgroundColor: client.emails_used >= client.emails_limit ? '#ef4444' : '#22c55e',
                          borderRadius: '2px',
                        }} />
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Store size={14} style={{ color: 'var(--text-secondary)' }} />
                        <span style={{ color: 'var(--text-primary)' }}>
                          {client.shops.length} / {client.shops_limit}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={getStatusBadge(getEffectiveStatus(client))}>
                        {getStatusLabel(getEffectiveStatus(client))}
                      </span>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} />
                        {formatDate(client.created_at)}
                      </div>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {client.subscription?.current_period_end ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <RefreshCw size={14} />
                          {formatDate(client.subscription.current_period_end)}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleEditClient(client)}
                          style={{
                            padding: '8px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'transparent',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="Editar cliente"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(client.id)}
                          style={{
                            padding: '8px',
                            borderRadius: '8px',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            backgroundColor: 'transparent',
                            color: '#ef4444',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="Deletar cliente"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedClient === client.id && client.shops.length > 0 && (
                    <tr key={`${client.id}-shops`}>
                      <td colSpan={9} style={{ padding: '0 16px 16px 56px', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{
                          backgroundColor: 'var(--bg-primary)',
                          borderRadius: '10px',
                          padding: '12px',
                        }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            LOJAS CADASTRADAS
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {client.shops.map((shop) => (
                              <div
                                key={shop.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '10px 12px',
                                  backgroundColor: 'var(--bg-card)',
                                  borderRadius: '8px',
                                  border: '1px solid var(--border-color)',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    backgroundColor: shop.is_active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}>
                                    <Store size={16} style={{ color: shop.is_active ? '#22c55e' : '#6b7280' }} />
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                                      {shop.name}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                      {shop.shopify_domain}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <span style={{
                                    padding: '3px 8px',
                                    borderRadius: '999px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    backgroundColor: shop.is_active ? 'rgba(34, 197, 94, 0.16)' : 'rgba(107, 114, 128, 0.16)',
                                    color: shop.is_active ? '#22c55e' : '#6b7280',
                                  }}>
                                    {shop.is_active ? 'Ativa' : 'Inativa'}
                                  </span>
                                  <a
                                    href={`https://${shop.shopify_domain}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      padding: '6px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--border-color)',
                                      backgroundColor: 'transparent',
                                      color: 'var(--text-secondary)',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      textDecoration: 'none',
                                    }}
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
        )}

        {filteredAndSortedClients.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
            Nenhum cliente encontrado
          </div>
        )}
      </div>

      {/* Modal de Edicao */}
      {showModal && editingClient && (
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
          onClick={() => setShowModal(false)}
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
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '24px' }}>
              Editar Cliente
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="text"
                  value={editingClient.email}
                  disabled
                  style={{ ...inputStyle, backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
                />
              </div>

              <div>
                <label style={labelStyle}>Nome</label>
                <input
                  type="text"
                  value={editingClient.name || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Plano</label>
                <select
                  value={editingClient.plan}
                  onChange={(e) => setEditingClient({ ...editingClient, plan: e.target.value })}
                  style={inputStyle}
                >
                  <option value="free">Free</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.name.toLowerCase()}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Status</label>
                <select
                  value={editingClient.status || 'active'}
                  onChange={(e) => setEditingClient({ ...editingClient, status: e.target.value })}
                  style={inputStyle}
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                  <option value="suspended">Suspenso</option>
                </select>
              </div>

              {/* Ações de suporte */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '8px' }}>
                <label style={{ ...labelStyle, marginBottom: '12px' }}>Ações de Suporte</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={handleSendResetPassword}
                    disabled={sendingReset}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      cursor: sendingReset ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: sendingReset ? 0.6 : 1,
                    }}
                  >
                    <Key size={16} />
                    {sendingReset ? 'Enviando...' : 'Reenviar senha'}
                  </button>
                </div>

                {actionMessage && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: actionMessage.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: actionMessage.type === 'success' ? '#22c55e' : '#ef4444',
                    fontSize: '14px',
                  }}>
                    {actionMessage.text}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveClient}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'var(--accent)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Delete */}
      {deleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            padding: '20px',
          }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '400px',
              border: '1px solid var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Trash2 size={24} style={{ color: '#ef4444' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Deletar Cliente
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                  Esta ação não pode ser desfeita
                </p>
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
              Isso irá remover permanentemente o cliente, cancelar sua assinatura no Stripe, deletar todas as lojas, conversas e dados associados.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteClient(deleteConfirm)}
                disabled={deleting}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? 'Deletando...' : 'Deletar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
