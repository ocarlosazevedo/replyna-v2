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
    } catch (err: any) {
      setError(err.message || 'Erro ao criar loja')
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
    switch (status) {
      case 'ok':
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Conectado</span>
      case 'error':
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">Erro</span>
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">Não configurado</span>
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Minhas Lojas</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors"
        >
          + Nova Loja
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : shops.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm text-center">
          <div className="text-6xl mb-4">🏪</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Nenhuma loja cadastrada</h2>
          <p className="text-gray-600 mb-6">Crie sua primeira loja para começar a usar o atendimento automático.</p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            Criar minha primeira loja
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shops.map((shop) => (
            <div key={shop.id} className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-2">{shop.name}</h3>
              <p className="text-gray-600 text-sm mb-4">{shop.support_email}</p>
              
              <div className="flex gap-2 mb-4">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">Email:</span>
                  {getStatusBadge(shop.mail_status)}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">Shopify:</span>
                  {getStatusBadge(shop.shopify_status)}
                </div>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors">
                  Configurar
                </button>
                <button
                  onClick={() => handleDeleteShop(shop.id)}
                  className="text-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-50 transition-colors"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Nova Loja</h2>
            
            <form onSubmit={handleCreateShop} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da loja
                </label>
                <input
                  type="text"
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Minha Loja"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email de suporte
                </label>
                <input
                  type="email"
                  value={newShopEmail}
                  onChange={(e) => setNewShopEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="suporte@minhaloja.com"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
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
