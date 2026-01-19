import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Edit2, Trash2, Tag, Percent, DollarSign, Calendar } from 'lucide-react'

interface Coupon {
  id: string
  code: string
  description: string | null
  discount_type: 'percentage' | 'fixed_amount'
  discount_value: number
  min_purchase_amount: number | null
  max_discount_amount: number | null
  usage_limit: number | null
  usage_count: number
  usage_limit_per_user: number
  valid_from: string
  valid_until: string | null
  applicable_plan_ids: string[] | null
  stripe_coupon_id: string | null
  is_active: boolean
  created_at: string
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed_amount',
    discount_value: 10,
    min_purchase_amount: '',
    max_discount_amount: '',
    usage_limit: '',
    usage_limit_per_user: 1,
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: '',
    is_active: true,
  })

  useEffect(() => {
    loadCoupons()
  }, [])

  const loadCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCoupons((data || []) as Coupon[])
    } catch (err) {
      console.error('Erro ao carregar cupons:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (coupon?: Coupon) => {
    if (coupon) {
      setEditingCoupon(coupon)
      setFormData({
        code: coupon.code,
        description: coupon.description || '',
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        min_purchase_amount: coupon.min_purchase_amount?.toString() || '',
        max_discount_amount: coupon.max_discount_amount?.toString() || '',
        usage_limit: coupon.usage_limit?.toString() || '',
        usage_limit_per_user: coupon.usage_limit_per_user,
        valid_from: coupon.valid_from.split('T')[0],
        valid_until: coupon.valid_until?.split('T')[0] || '',
        is_active: coupon.is_active,
      })
    } else {
      setEditingCoupon(null)
      setFormData({
        code: '',
        description: '',
        discount_type: 'percentage',
        discount_value: 10,
        min_purchase_amount: '',
        max_discount_amount: '',
        usage_limit: '',
        usage_limit_per_user: 1,
        valid_from: new Date().toISOString().split('T')[0],
        valid_until: '',
        is_active: true,
      })
    }
    setShowModal(true)
  }

  const handleSaveCoupon = async () => {
    try {
      const couponData = {
        code: formData.code.toUpperCase(),
        description: formData.description || null,
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        min_purchase_amount: formData.min_purchase_amount ? parseFloat(formData.min_purchase_amount) : null,
        max_discount_amount: formData.max_discount_amount ? parseFloat(formData.max_discount_amount) : null,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
        usage_limit_per_user: formData.usage_limit_per_user,
        valid_from: formData.valid_from,
        valid_until: formData.valid_until || null,
        is_active: formData.is_active,
      }

      if (editingCoupon) {
        const { error } = await supabase
          .from('coupons')
          .update(couponData)
          .eq('id', editingCoupon.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from('coupons').insert(couponData)
        if (error) throw error
      }

      setShowModal(false)
      loadCoupons()
    } catch (err) {
      console.error('Erro ao salvar cupom:', err)
    }
  }

  const handleDeleteCoupon = async (couponId: string) => {
    if (!confirm('Tem certeza que deseja excluir este cupom?')) return

    try {
      const { error } = await supabase.from('coupons').delete().eq('id', couponId)
      if (error) throw error
      loadCoupons()
    } catch (err) {
      console.error('Erro ao excluir cupom:', err)
    }
  }

  const handleToggleActive = async (couponId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('coupons')
        .update({ is_active: !currentStatus })
        .eq('id', couponId)

      if (error) throw error
      loadCoupons()
    } catch (err) {
      console.error('Erro ao atualizar status:', err)
    }
  }

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(date))

  const isExpired = (validUntil: string | null) => {
    if (!validUntil) return false
    return new Date(validUntil) < new Date()
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
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Cupons
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            Gerencie cupons de desconto
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
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
            gap: '8px',
          }}
        >
          <Plus size={18} />
          Novo Cupom
        </button>
      </div>

      <div style={cardStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Cupom</th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Desconto</th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Usos</th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Validade</th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Status</th>
              <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}></th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((coupon) => (
              <tr key={coupon.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Tag size={18} style={{ color: '#f59e0b' }} />
                    </div>
                    <div>
                      <div style={{
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace',
                        fontSize: '15px',
                      }}>
                        {coupon.code}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {coupon.description || 'Sem descricao'}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {coupon.discount_type === 'percentage' ? (
                      <>
                        <Percent size={14} style={{ color: '#22c55e' }} />
                        <span style={{ fontWeight: 600, color: '#22c55e' }}>{coupon.discount_value}%</span>
                      </>
                    ) : (
                      <>
                        <DollarSign size={14} style={{ color: '#22c55e' }} />
                        <span style={{ fontWeight: 600, color: '#22c55e' }}>R$ {coupon.discount_value.toFixed(2)}</span>
                      </>
                    )}
                  </div>
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{ color: 'var(--text-primary)' }}>
                    {coupon.usage_count} / {coupon.usage_limit || '∞'}
                  </span>
                </td>
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    <Calendar size={14} />
                    {coupon.valid_until ? (
                      <span style={{ color: isExpired(coupon.valid_until) ? '#ef4444' : 'var(--text-secondary)' }}>
                        {formatDate(coupon.valid_until)}
                      </span>
                    ) : (
                      <span>Sem validade</span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: coupon.is_active && !isExpired(coupon.valid_until)
                      ? 'rgba(34, 197, 94, 0.16)'
                      : 'rgba(107, 114, 128, 0.16)',
                    color: coupon.is_active && !isExpired(coupon.valid_until) ? '#22c55e' : '#6b7280',
                  }}>
                    {isExpired(coupon.valid_until) ? 'Expirado' : coupon.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleToggleActive(coupon.id, coupon.is_active)}
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
                      {coupon.is_active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      onClick={() => handleOpenModal(coupon)}
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
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteCoupon(coupon.id)}
                      style={{
                        padding: '8px',
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {coupons.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
            Nenhum cupom cadastrado ainda
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
              {editingCoupon ? 'Editar Cupom' : 'Novo Cupom'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Codigo do Cupom</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  style={{ ...inputStyle, textTransform: 'uppercase', fontFamily: 'monospace' }}
                  placeholder="Ex: DESCONTO20"
                />
              </div>

              <div>
                <label style={labelStyle}>Descricao (opcional)</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={inputStyle}
                  placeholder="Ex: 20% de desconto no primeiro mes"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Tipo de Desconto</label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as 'percentage' | 'fixed_amount' })}
                    style={inputStyle}
                  >
                    <option value="percentage">Porcentagem (%)</option>
                    <option value="fixed_amount">Valor Fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Valor do Desconto</label>
                  <input
                    type="number"
                    step={formData.discount_type === 'percentage' ? '1' : '0.01'}
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Limite de Usos (total)</label>
                  <input
                    type="number"
                    value={formData.usage_limit}
                    onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                    style={inputStyle}
                    placeholder="Deixe vazio para ilimitado"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Usos por Usuario</label>
                  <input
                    type="number"
                    value={formData.usage_limit_per_user}
                    onChange={(e) => setFormData({ ...formData, usage_limit_per_user: parseInt(e.target.value) })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Valido a partir de</label>
                  <input
                    type="date"
                    value={formData.valid_from}
                    onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Valido ate (opcional)</label>
                  <input
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Cupom ativo</span>
              </label>
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
                onClick={handleSaveCoupon}
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
                {editingCoupon ? 'Salvar' : 'Criar Cupom'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
