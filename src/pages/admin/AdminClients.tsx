import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, Edit2, Mail, Store, Calendar } from 'lucide-react'

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
  shops_count: number
}

export default function AdminClients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    loadClients()
  }, [])

  const loadClients = async () => {
    try {
      // Buscar usuários e lojas em paralelo
      const [usersResult, shopsResult] = await Promise.all([
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        supabase.from('shops').select('user_id')
      ])

      if (usersResult.error) throw usersResult.error

      // Contar lojas por usuário
      const shopCountByUser: Record<string, number> = {}
      ;(shopsResult.data || []).forEach((shop) => {
        shopCountByUser[shop.user_id] = (shopCountByUser[shop.user_id] || 0) + 1
      })

      // Combinar dados
      const clientsWithShops = (usersResult.data || []).map((client) => ({
        ...client,
        shops_count: shopCountByUser[client.id] || 0,
      }))

      setClients(clientsWithShops as Client[])
    } catch (err) {
      console.error('Erro ao carregar clientes:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEditClient = (client: Client) => {
    setEditingClient(client)
    setShowModal(true)
  }

  const handleSaveClient = async () => {
    if (!editingClient) return

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: editingClient.name,
          plan: editingClient.plan,
          emails_limit: editingClient.emails_limit,
          shops_limit: editingClient.shops_limit,
          status: editingClient.status,
        })
        .eq('id', editingClient.id)

      if (error) throw error

      setShowModal(false)
      loadClients()
    } catch (err) {
      console.error('Erro ao salvar cliente:', err)
    }
  }

  const filteredClients = clients.filter(
    (client) =>
      client.email.toLowerCase().includes(search.toLowerCase()) ||
      (client.name && client.name.toLowerCase().includes(search.toLowerCase()))
  )

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(date))

  const getStatusBadge = (status: string | null) => {
    const base = { padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }
    switch (status) {
      case 'active':
        return { ...base, backgroundColor: 'rgba(34, 197, 94, 0.16)', color: '#22c55e' }
      case 'inactive':
        return { ...base, backgroundColor: 'rgba(107, 114, 128, 0.16)', color: '#6b7280' }
      case 'suspended':
        return { ...base, backgroundColor: 'rgba(239, 68, 68, 0.16)', color: '#ef4444' }
      default:
        return { ...base, backgroundColor: 'rgba(34, 197, 94, 0.16)', color: '#22c55e' }
    }
  }

  const cardStyle = {
    backgroundColor: 'var(--bg-card)',
    borderRadius: '16px',
    padding: '24px',
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Clientes
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            Gerencie todos os usuarios da plataforma
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
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
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                ...inputStyle,
                paddingLeft: '40px',
                width: '280px',
              }}
            />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Cliente</th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Plano</th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Emails</th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Lojas</th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Status</th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Cadastro</th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map((client) => (
              <tr key={client.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
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
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    color: '#8b5cf6',
                    fontSize: '13px',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                  }}>
                    {client.plan || 'free'}
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
                      {client.shops_count} / {client.shops_limit}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={getStatusBadge(client.status)}>
                    {client.status === 'active' ? 'Ativo' : client.status === 'inactive' ? 'Inativo' : client.status === 'suspended' ? 'Suspenso' : 'Ativo'}
                  </span>
                </td>
                <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} />
                    {formatDate(client.created_at)}
                  </div>
                </td>
                <td style={{ padding: '16px' }}>
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
                  >
                    <Edit2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredClients.length === 0 && (
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
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Limite de Emails</label>
                  <input
                    type="number"
                    value={editingClient.emails_limit}
                    onChange={(e) => setEditingClient({ ...editingClient, emails_limit: parseInt(e.target.value) })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Limite de Lojas</label>
                  <input
                    type="number"
                    value={editingClient.shops_limit}
                    onChange={(e) => setEditingClient({ ...editingClient, shops_limit: parseInt(e.target.value) })}
                    style={inputStyle}
                  />
                </div>
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
    </div>
  )
}
