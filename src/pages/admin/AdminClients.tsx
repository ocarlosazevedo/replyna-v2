import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, Edit2, Mail, Store, Calendar, ChevronDown, ChevronUp, ExternalLink, Trash2, Key, RefreshCw, ArrowUpDown, LogIn, UserPlus } from 'lucide-react'

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
  asaas_subscription_id: string
  status: string
  current_period_end: string
}

interface Client {
  id: string
  email: string
  name: string | null
  plan: string
  emails_limit: number | null  // null = ilimitado
  emails_used: number
  shops_limit: number | null   // null = ilimitado
  status: string | null
  created_at: string
  last_login_at: string | null
  shops: Shop[]
  subscription: Subscription | null
}

interface Plan {
  id: string
  name: string
  emails_limit: number | null   // null = ilimitado
  shops_limit: number | null    // null = ilimitado
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
  const [savingClient, setSavingClient] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [originalClient, setOriginalClient] = useState<Client | null>(null)
  const [impersonating, setImpersonating] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creatingClient, setCreatingClient] = useState(false)
  const [newClient, setNewClient] = useState({ email: '', name: '', plan_id: '' })
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)

  // Encontrar o plano Enterprise para pré-selecionar
  const enterprisePlan = plans.find(p => p.name.toLowerCase() === 'enterprise')
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
    setOriginalClient(client)
    setShowModal(true)
    setActionMessage(null)
  }

  const handleSaveClient = async () => {
    if (!editingClient || !originalClient) return

    setSavingClient(true)
    setActionMessage(null)

    try {
      const selectedPlan = plans.find(p => p.name.toLowerCase() === editingClient.plan)
      const planChanged = editingClient.plan !== originalClient.plan

      // Se o plano mudou e o cliente tem assinatura ativa, usar Edge Function para atualizar Asaas
      if (planChanged && selectedPlan && editingClient.subscription) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-subscription`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: editingClient.id,
              new_plan_id: selectedPlan.id,
            }),
          }
        )

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Erro ao atualizar plano no Asaas')
        }

        // Atualizar também nome e status no banco
        const { error: updateError } = await supabase
          .from('users')
          .update({
            name: editingClient.name,
            status: editingClient.status,
          })
          .eq('id', editingClient.id)

        if (updateError) {
          console.error('Erro ao atualizar nome/status:', updateError)
        }

        setActionMessage({
          type: 'success',
          text: result.is_upgrade
            ? `Upgrade realizado! Novo plano: ${result.new_plan?.name}`
            : `Plano alterado para: ${result.new_plan?.name}`
        })

        // Aguardar um pouco para mostrar a mensagem antes de fechar
        setTimeout(() => {
          setShowModal(false)
          loadData()
        }, 1500)
      } else {
        // Sem mudança de plano ou sem assinatura ativa - atualizar apenas localmente
        const updateData: Record<string, unknown> = {
          name: editingClient.name,
          status: editingClient.status,
        }

        // Se mudou o plano mas não tem assinatura (cliente free), atualizar manualmente
        if (planChanged && selectedPlan) {
          updateData.plan = editingClient.plan
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
      }
    } catch (err) {
      console.error('Erro ao salvar cliente:', err)
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao salvar alterações'
      })
    } finally {
      setSavingClient(false)
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

  const handleCreateClient = async () => {
    if (!newClient.email || !newClient.name || !newClient.plan_id) {
      setCreateError('Preencha todos os campos')
      return
    }

    setCreatingClient(true)
    setCreateError(null)
    setCreateSuccess(null)

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-client`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newClient),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar cliente')
      }

      setCreateSuccess(`Cliente ${result.name} criado com sucesso! Email de definição de senha enviado para ${result.email}`)
      setNewClient({ email: '', name: '', plan_id: '' })

      // Recarregar lista após 2 segundos
      setTimeout(() => {
        setShowCreateModal(false)
        setCreateSuccess(null)
        loadData()
      }, 2000)
    } catch (err) {
      console.error('Erro ao criar cliente:', err)
      setCreateError(err instanceof Error ? err.message : 'Erro ao criar cliente')
    } finally {
      setCreatingClient(false)
    }
  }

  const handleImpersonate = async (client: Client) => {
    setImpersonating(client.id)

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-impersonate-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: client.id }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao gerar link de acesso')
      }

      // Abrir o magic link em uma nova aba
      if (result.link) {
        window.open(result.link, '_blank')
      }
    } catch (err) {
      console.error('Erro ao acessar como cliente:', err)
      alert('Erro ao acessar como cliente: ' + (err instanceof Error ? err.message : 'Erro desconhecido'))
    } finally {
      setImpersonating(null)
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
          // Ordenar por prioridade do plano: Starter, Business, Scale, High Scale, Enterprise
          const getPlanOrderLocal = (slug: string | null): number => {
            const s = slug?.toLowerCase() || 'free'
            switch (s) {
              case 'starter': return 1
              case 'business': return 2
              case 'scale': return 3
              case 'high scale': return 4
              case 'enterprise': return 5
              default: return 0
            }
          }
          comparison = getPlanOrderLocal(a.plan) - getPlanOrderLocal(b.plan)
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
        return { bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' } // Verde
      case 'business':
        return { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' } // Azul
      case 'scale':
        return { bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' } // Roxo
      case 'high scale':
        return { bg: 'rgba(236, 72, 153, 0.1)', color: '#ec4899' } // Rosa
      case 'enterprise':
        return { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' } // Laranja
      case 'free':
        return { bg: 'rgba(107, 114, 128, 0.1)', color: '#6b7280' } // Cinza
      default:
        // Para qualquer outro plano não mapeado, usar cyan
        return { bg: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }
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
    overflow: 'hidden' as const,
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
        <button
          onClick={() => {
            setShowCreateModal(true)
            setCreateError(null)
            setCreateSuccess(null)
            setNewClient({ email: '', name: '', plan_id: enterprisePlan?.id || '' })
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: 'var(--accent)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          <UserPlus size={18} />
          Criar Cliente VIP
        </button>
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
          className="replyna-select"
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
          className="replyna-select"
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
            className="replyna-select"
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
                        onClick={() => handleImpersonate(client)}
                        disabled={impersonating === client.id}
                        style={{
                          padding: '8px',
                          borderRadius: '8px',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          backgroundColor: 'transparent',
                          color: '#3b82f6',
                          cursor: impersonating === client.id ? 'not-allowed' : 'pointer',
                          flexShrink: 0,
                          opacity: impersonating === client.id ? 0.6 : 1,
                        }}
                      >
                        <LogIn size={14} />
                      </button>
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
                    <span style={{ fontSize: '11px', color: client.shops_limit === null ? '#22c55e' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Store size={12} /> {client.shops.length}/{client.shops_limit === null ? '∞' : client.shops_limit}
                    </span>
                    <span style={{ fontSize: '11px', color: client.emails_limit === null ? '#22c55e' : 'var(--text-secondary)' }}>
                      {client.emails_used}/{client.emails_limit === null ? '∞' : client.emails_limit} emails
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
                      <div style={{ fontSize: '14px', color: client.emails_limit === null ? '#22c55e' : 'var(--text-primary)' }}>
                        {client.emails_used} / {client.emails_limit === null ? '∞' : client.emails_limit}
                      </div>
                      {client.emails_limit !== null && (
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
                      )}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Store size={14} style={{ color: 'var(--text-secondary)' }} />
                        <span style={{ color: client.shops_limit === null ? '#22c55e' : 'var(--text-primary)' }}>
                          {client.shops.length} / {client.shops_limit === null ? '∞' : client.shops_limit}
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
                          onClick={() => handleImpersonate(client)}
                          disabled={impersonating === client.id}
                          style={{
                            padding: '8px',
                            borderRadius: '8px',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            backgroundColor: 'transparent',
                            color: '#3b82f6',
                            cursor: impersonating === client.id ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: impersonating === client.id ? 0.6 : 1,
                          }}
                          title="Acessar como cliente"
                        >
                          <LogIn size={16} />
                        </button>
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
                  className="replyna-select form-input"
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
                  className="replyna-select form-input"
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
                disabled={savingClient}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  cursor: savingClient ? 'not-allowed' : 'pointer',
                  opacity: savingClient ? 0.6 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveClient}
                disabled={savingClient}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'var(--accent)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: savingClient ? 'not-allowed' : 'pointer',
                  opacity: savingClient ? 0.6 : 1,
                }}
              >
                {savingClient ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criar Cliente VIP */}
      {showCreateModal && (
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
          onClick={() => setShowCreateModal(false)}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'rgba(70, 114, 236, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <UserPlus size={24} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Criar Cliente VIP
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                  Plano Enterprise gratuito (influenciador/parceiro)
                </p>
              </div>
            </div>

            {createSuccess && (
              <div style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                color: '#22c55e',
                fontSize: '14px',
                marginBottom: '16px',
              }}>
                {createSuccess}
              </div>
            )}

            {createError && (
              <div style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                fontSize: '14px',
                marginBottom: '16px',
              }}>
                {createError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Nome completo</label>
                <input
                  type="text"
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  placeholder="Nome do cliente"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Plano</label>
                <select
                  value={newClient.plan_id}
                  onChange={(e) => setNewClient({ ...newClient, plan_id: e.target.value })}
                  className="replyna-select form-input"
                >
                  <option value="">Selecione um plano</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} ({plan.emails_limit === null ? 'ilimitado' : `${plan.emails_limit} emails`})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{
                padding: '12px',
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                borderRadius: '8px',
                border: '1px solid rgba(245, 158, 11, 0.2)',
              }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  O cliente receberá um email para definir sua senha e poderá usar a plataforma imediatamente, sem necessidade de pagamento.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={creatingClient}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  cursor: creatingClient ? 'not-allowed' : 'pointer',
                  opacity: creatingClient ? 0.6 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateClient}
                disabled={creatingClient || !newClient.email || !newClient.name || !newClient.plan_id}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'var(--accent)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: creatingClient || !newClient.email || !newClient.name || !newClient.plan_id ? 'not-allowed' : 'pointer',
                  opacity: creatingClient || !newClient.email || !newClient.name || !newClient.plan_id ? 0.6 : 1,
                }}
              >
                {creatingClient ? 'Criando...' : 'Criar Cliente'}
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
              Isso irá remover permanentemente o cliente, cancelar sua assinatura no Asaas, deletar todas as lojas, conversas e dados associados.
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
