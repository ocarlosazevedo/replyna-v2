import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Settings, Trash2, Power, PowerOff } from 'lucide-react'

interface Shop {
  id: string
  name: string
  attendant_name: string
  support_email: string
  mail_status: string
  shopify_status: string
  is_active: boolean
  created_at: string
}

export default function Shops() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)

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

  const handleDeleteShop = async (shopId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta loja? Esta ação não pode ser desfeita.')) return

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

  const handleToggleActive = async (shopId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('shops')
        .update({ is_active: !currentStatus })
        .eq('id', shopId)

      if (error) throw error
      loadShops()
    } catch (err) {
      console.error('Erro ao atualizar status:', err)
    }
  }

  const getStatusBadge = (status: string) => {
    const baseStyle = { padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }
    switch (status) {
      case 'ok':
        return <span style={{ ...baseStyle, backgroundColor: '#dcfce7', color: '#15803d' }}>Conectado</span>
      case 'error':
        return <span style={{ ...baseStyle, backgroundColor: '#fef2f2', color: '#dc2626' }}>Erro</span>
      case 'pending':
        return <span style={{ ...baseStyle, backgroundColor: '#fef3c7', color: '#d97706' }}>Pendente</span>
      default:
        return <span style={{ ...baseStyle, backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>Não configurado</span>
    }
  }

  const cardStyle = {
    backgroundColor: 'var(--bg-card)',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid var(--border-color)',
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
  }

  const buttonIcon = {
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-secondary)',
    padding: '10px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Minhas Lojas
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            Gerencie suas lojas e integrações
          </p>
        </div>
        <button onClick={() => navigate('/shops/setup')} style={buttonPrimary}>
          + Integrar nova loja
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{ color: 'var(--text-secondary)' }}>Carregando...</div>
        </div>
      ) : shops.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '64px 48px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🏪</div>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
            Nenhuma loja cadastrada
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
            Crie sua primeira loja para começar a usar o atendimento automático com IA.
          </p>
          <button
            onClick={() => navigate('/shops/setup')}
            style={{ ...buttonPrimary, padding: '14px 28px', fontSize: '16px' }}
          >
            Criar minha primeira loja
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
          {shops.map((shop) => (
            <div key={shop.id} style={cardStyle}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                      {shop.name}
                    </h3>
                    {shop.is_active ? (
                      <span style={{
                        backgroundColor: '#dcfce7',
                        color: '#15803d',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        Ativa
                      </span>
                    ) : (
                      <span style={{
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-secondary)',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        Inativa
                      </span>
                    )}
                  </div>
                  {shop.attendant_name && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
                      Atendente: {shop.attendant_name}
                    </p>
                  )}
                </div>
              </div>

              {/* Email */}
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
                {shop.support_email}
              </p>

              {/* Status Badges */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Email:</span>
                  {getStatusBadge(shop.mail_status)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Shopify:</span>
                  {getStatusBadge(shop.shopify_status)}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => navigate(`/shops/setup/${shop.id}`)}
                  style={{
                    ...buttonPrimary,
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Settings size={16} />
                  Configurar
                </button>
                <button
                  onClick={() => handleToggleActive(shop.id, shop.is_active)}
                  style={{
                    ...buttonIcon,
                    color: shop.is_active ? '#22c55e' : 'var(--text-secondary)',
                  }}
                  title={shop.is_active ? 'Desativar loja' : 'Ativar loja'}
                >
                  {shop.is_active ? <Power size={18} /> : <PowerOff size={18} />}
                </button>
                <button
                  onClick={() => handleDeleteShop(shop.id)}
                  style={{ ...buttonIcon, color: '#ef4444' }}
                  title="Excluir loja"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
