import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAdmin } from '../../context/AdminContext'
import { Search, Plus, Trash2, Shield, ShieldCheck } from 'lucide-react'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isMobile
}

interface Administrator {
  id: string
  email: string
  name: string
  role: 'admin' | 'super_admin'
  is_active: boolean
  last_login_at: string | null
  created_at: string
}

export default function AdminAdministrators() {
  const isMobile = useIsMobile()
  const { admin: currentAdmin, isSuperAdmin } = useAdmin()
  const [admins, setAdmins] = useState<Administrator[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [_editingAdmin, setEditingAdmin] = useState<Administrator | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    role: 'admin' as 'admin' | 'super_admin',
  })
  const [error, setError] = useState('')

  useEffect(() => {
    loadAdmins()
  }, [])

  const loadAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAdmins((data || []) as Administrator[])
    } catch (err) {
      console.error('Erro ao carregar administradores:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAdmin = async () => {
    if (!formData.email || !formData.name || !formData.password) {
      setError('Preencha todos os campos')
      return
    }

    try {
      const { data, error } = await supabase.rpc('create_admin', {
        p_email: formData.email,
        p_name: formData.name,
        p_password: formData.password,
        p_role: formData.role,
      })

      if (error) throw error
      if (!data.success) {
        setError(data.error)
        return
      }

      setShowModal(false)
      setFormData({ email: '', name: '', password: '', role: 'admin' })
      loadAdmins()
    } catch (err) {
      console.error('Erro ao criar admin:', err)
      setError('Erro ao criar administrador')
    }
  }

  const handleToggleActive = async (adminId: string, currentStatus: boolean) => {
    if (adminId === currentAdmin?.id) {
      alert('Voce nao pode desativar sua propria conta')
      return
    }

    try {
      const { error } = await supabase
        .from('admins')
        .update({ is_active: !currentStatus })
        .eq('id', adminId)

      if (error) throw error
      loadAdmins()
    } catch (err) {
      console.error('Erro ao atualizar status:', err)
    }
  }

  const handleDeleteAdmin = async (adminId: string) => {
    if (adminId === currentAdmin?.id) {
      alert('Voce nao pode excluir sua propria conta')
      return
    }

    if (!confirm('Tem certeza que deseja excluir este administrador?')) return

    try {
      const { error } = await supabase
        .from('admins')
        .delete()
        .eq('id', adminId)

      if (error) throw error
      loadAdmins()
    } catch (err) {
      console.error('Erro ao excluir admin:', err)
    }
  }

  const filteredAdmins = admins.filter(
    (admin) =>
      admin.email.toLowerCase().includes(search.toLowerCase()) ||
      admin.name.toLowerCase().includes(search.toLowerCase())
  )

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date))

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
            Administradores
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '14px' : '15px' }}>
            Gerencie os administradores do sistema
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: '12px' }}>
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
              placeholder="Buscar admin..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                ...inputStyle,
                paddingLeft: '40px',
                width: isMobile ? '100%' : '240px',
              }}
            />
          </div>
          {isSuperAdmin && (
            <button
              onClick={() => {
                setEditingAdmin(null)
                setFormData({ email: '', name: '', password: '', role: 'admin' })
                setError('')
                setShowModal(true)
              }}
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
              Novo Admin
            </button>
          )}
        </div>
      </div>

      <div style={cardStyle}>
        {isMobile ? (
          /* Mobile: Card Layout */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredAdmins.map((admin) => (
              <div key={admin.id} style={{
                backgroundColor: 'var(--bg-primary)',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid var(--border-color)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: admin.role === 'super_admin' ? 'rgba(70, 114, 236, 0.15)' : 'rgba(139, 92, 246, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {admin.role === 'super_admin' ? (
                        <ShieldCheck size={18} style={{ color: 'var(--accent)' }} />
                      ) : (
                        <Shield size={18} style={{ color: '#8b5cf6' }} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                        {admin.name}
                        {admin.id === currentAdmin?.id && (
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                            (voce)
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {admin.email}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: admin.is_active ? 'rgba(34, 197, 94, 0.16)' : 'rgba(107, 114, 128, 0.16)',
                    color: admin.is_active ? '#22c55e' : '#6b7280',
                  }}>
                    {admin.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: admin.role === 'super_admin' ? 'rgba(70, 114, 236, 0.15)' : 'rgba(139, 92, 246, 0.1)',
                      color: admin.role === 'super_admin' ? 'var(--accent)' : '#8b5cf6',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}>
                      {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {admin.last_login_at ? formatDate(admin.last_login_at) : 'Nunca logou'}
                    </span>
                  </div>
                  {isSuperAdmin && admin.id !== currentAdmin?.id && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleToggleActive(admin.id, admin.is_active)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'transparent',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontSize: '11px',
                        }}
                      >
                        {admin.is_active ? 'Desativar' : 'Ativar'}
                      </button>
                      <button
                        onClick={() => handleDeleteAdmin(admin.id)}
                        style={{
                          padding: '6px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'transparent',
                          color: '#ef4444',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop: Table Layout */
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
                <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Administrador</th>
                <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Funcao</th>
                <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Status</th>
                <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Ultimo Login</th>
                <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredAdmins.map((admin) => (
                <tr key={admin.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        backgroundColor: admin.role === 'super_admin' ? 'rgba(70, 114, 236, 0.15)' : 'rgba(139, 92, 246, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {admin.role === 'super_admin' ? (
                          <ShieldCheck size={18} style={{ color: 'var(--accent)' }} />
                        ) : (
                          <Shield size={18} style={{ color: '#8b5cf6' }} />
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {admin.name}
                          {admin.id === currentAdmin?.id && (
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                              (voce)
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {admin.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      backgroundColor: admin.role === 'super_admin' ? 'rgba(70, 114, 236, 0.15)' : 'rgba(139, 92, 246, 0.1)',
                      color: admin.role === 'super_admin' ? 'var(--accent)' : '#8b5cf6',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}>
                      {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: admin.is_active ? 'rgba(34, 197, 94, 0.16)' : 'rgba(107, 114, 128, 0.16)',
                      color: admin.is_active ? '#22c55e' : '#6b7280',
                    }}>
                      {admin.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {admin.last_login_at ? formatDate(admin.last_login_at) : 'Nunca'}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {isSuperAdmin && admin.id !== currentAdmin?.id && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleToggleActive(admin.id, admin.is_active)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'transparent',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          {admin.is_active ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => handleDeleteAdmin(admin.id)}
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
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Criacao */}
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
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '450px',
              border: '1px solid var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '24px' }}>
              Novo Administrador
            </h2>

            {error && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                padding: '12px 16px',
                borderRadius: '10px',
                marginBottom: '16px',
                fontSize: '14px',
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={inputStyle}
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={inputStyle}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div>
                <label style={labelStyle}>Senha</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  style={inputStyle}
                  placeholder="********"
                />
              </div>

              <div>
                <label style={labelStyle}>Funcao</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'super_admin' })}
                  style={inputStyle}
                >
                  <option value="admin">Administrador</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'row', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
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
                  width: isMobile ? '100%' : 'auto',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateAdmin}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'var(--accent)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  width: isMobile ? '100%' : 'auto',
                }}
              >
                Criar Admin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
