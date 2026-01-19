import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Settings, Trash2, Power, PowerOff, Mail, ShoppingBag, User } from 'lucide-react'

interface Shop {
  id: string
  name: string
  attendant_name: string
  support_email: string
  imap_user: string
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return { color: '#22c55e', label: 'Conectado' }
      case 'error':
        return { color: '#ef4444', label: 'Erro' }
      case 'pending':
        return { color: '#f59e0b', label: 'Pendente' }
      default:
        return { color: 'var(--text-secondary)', label: 'Não configurado' }
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
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    padding: '10px 20px',
    borderRadius: '10px',
    fontWeight: '600',
    border: '1px solid var(--border-color)',
    cursor: 'pointer',
    fontSize: '14px',
  }

  const buttonIcon = {
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    padding: '10px',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px' }}>
          {shops.map((shop) => {
            const emailStatus = getStatusIcon(shop.mail_status)
            const shopifyStatus = getStatusIcon(shop.shopify_status)

            return (
              <div key={shop.id} style={cardStyle}>
                {/* Header com nome e status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                    {shop.name}
                  </h3>
                  <span style={{
                    backgroundColor: shop.is_active ? 'rgba(34, 197, 94, 0.16)' : 'rgba(107, 114, 128, 0.16)',
                    color: shop.is_active ? '#22c55e' : 'var(--text-secondary)',
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {shop.is_active ? 'Ativa' : 'Inativa'}
                  </span>
                </div>

                {/* Informações organizadas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                  {/* Email da IA (Replyna) */}
                  {shop.imap_user && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(70, 114, 236, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Mail size={18} style={{ color: 'var(--accent)' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                          Email da IA (Replyna responde)
                        </div>
                        <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '500' }}>
                          {shop.imap_user}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Email Humano (Escalonamento) */}
                  {shop.support_email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <User size={18} style={{ color: '#f59e0b' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                          Email humano (escalonamento)
                        </div>
                        <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '500' }}>
                          {shop.support_email}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status das integrações */}
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  padding: '16px',
                  backgroundColor: 'rgba(70, 114, 236, 0.06)',
                  borderRadius: '12px',
                  marginBottom: '20px',
                  border: '1px solid var(--border-color)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <Mail size={16} style={{ color: emailStatus.color }} />
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Email
                      </div>
                      <div style={{ fontSize: '13px', color: emailStatus.color, fontWeight: '600' }}>
                        {emailStatus.label}
                      </div>
                    </div>
                  </div>
                  <div style={{ width: '1px', backgroundColor: 'var(--border-color)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <ShoppingBag size={16} style={{ color: shopifyStatus.color }} />
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Shopify
                      </div>
                      <div style={{ fontSize: '13px', color: shopifyStatus.color, fontWeight: '600' }}>
                        {shopifyStatus.label}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => navigate(`/shops/${shop.id}`)}
                    style={{
                      ...buttonPrimary,
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <Settings size={16} />
                    Gerenciar
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
            )
          })}
        </div>
      )}
    </div>
  )
}
