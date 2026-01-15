import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface Shop {
  id: string
  name: string
  support_email: string
  mail_status: string
  shopify_status: string
  created_at: string
}

export default function Shops() {
  const { user } = useAuth()
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newShopName, setNewShopName] = useState('')
  const [newShopEmail, setNewShopEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadShops()
  }, [user])

  const loadShops = async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setShops(data || [])
    } catch (err) {
      console.error('Erro ao carregar lojas:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const { error } = await supabase.from('shops').insert({
        user_id: user?.id,
        name: newShopName,
        support_email: newShopEmail
      })

      if (error) throw error

      setShowModal(false)
      setNewShopName('')
      setNewShopEmail('')
      loadShops()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar loja'
      setError(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteShop = async (shopId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta loja?')) return

    try {
      const { error } = await supabase
        .from('shops')
        .delete()
        .eq('id', shopId)

      if (error) throw error
      loadShops()
    } catch (err) {
      console.error('Erro ao excluir loja:', err)
    }
  }

  const getStatusBadge = (status: string) => {
    const baseStyle = { padding: '4px 8px', borderRadius: '9999px', fontSize: '12px' }
    switch (status) {
      case 'ok':
        return <span style={{ ...baseStyle, backgroundColor: '#dcfce7', color: '#15803d' }}>Conectado</span>
      case 'error':
        return <span style={{ ...baseStyle, backgroundColor: '#fef2f2', color: '#dc2626' }}>Erro</span>
      default:
        return <span style={{ ...baseStyle, backgroundColor: '#f3f4f6', color: '#4b5563' }}>Não configurado</span>
    }
  }

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  }

  const buttonPrimary = {
    backgroundColor: '#2563eb',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '8px',
    fontWeight: '500',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
  }

  const buttonSecondary = {
    backgroundColor: '#f3f4f6',
    color: '#374151',
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>Minhas Lojas</h1>
        <button onClick={() => setShowModal(true)} style={buttonPrimary}>
          + Nova Loja
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <div>Carregando...</div>
        </div>
      ) : shops.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🏪</div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>Nenhuma loja cadastrada</h2>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>Crie sua primeira loja para começar a usar o atendimento automático.</p>
          <button onClick={() => setShowModal(true)} style={{ ...buttonPrimary, padding: '12px 24px', fontSize: '16px' }}>
            Criar minha primeira loja
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {shops.map((shop) => (
            <div key={shop.id} style={cardStyle}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>{shop.name}</h3>
              <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>{shop.support_email}</p>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>Email:</span>
                  {getStatusBadge(shop.mail_status)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>Shopify:</span>
                  {getStatusBadge(shop.shopify_status)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={{ ...buttonSecondary, flex: 1 }}>
                  Configurar
                </button>
                <button
                  onClick={() => handleDeleteShop(shop.id)}
                  style={{ ...buttonSecondary, color: '#dc2626' }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nova Loja */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px' }}>Nova Loja</h2>
            
            <form onSubmit={handleCreateShop}>
              {error && (
                <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                  Nome da loja
                </label>
                <input
                  type="text"
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }}
                  placeholder="Minha Loja"
                  required
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                  Email de suporte
                </label>
                <input
                  type="email"
                  value={newShopEmail}
                  onChange={(e) => setNewShopEmail(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }}
                  placeholder="suporte@minhaloja.com"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ ...buttonSecondary, flex: 1, padding: '12px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ ...buttonPrimary, flex: 1, padding: '12px', opacity: saving ? 0.5 : 1 }}
                >
                  {saving ? 'Salvando...' : 'Criar loja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
