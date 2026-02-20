# Asaas Migration – Remaining Files (Full Contents)

This file contains the complete contents of the remaining modified/created files in this migration.

---

## 1) src/pages/admin/AdminCoupons.tsx

```tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Edit2, Trash2, Tag, Percent, DollarSign, Calendar, RefreshCw, Check } from 'lucide-react'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isMobile
}

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
  asaas_discount_id: string | null
  is_active: boolean
  created_at: string
}

export default function AdminCoupons() {
  const isMobile = useIsMobile()
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
    asaas_discount_id: '',
    is_active: true,
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

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
        asaas_discount_id: coupon.asaas_discount_id || '',
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
        asaas_discount_id: '',
        is_active: true,
      })
    }
    setShowModal(true)
  }

  const handleSaveCoupon = async () => {
    setSaving(true)

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
        asaas_discount_id: formData.asaas_discount_id || null,
        is_active: formData.is_active,
      }

      let couponId: string

      if (editingCoupon) {
        const { error } = await supabase
          .from('coupons')
          .update(couponData)
          .eq('id', editingCoupon.id)

        if (error) throw error
        couponId = editingCoupon.id
      } else {
        const { data, error } = await supabase
          .from('coupons')
          .insert(couponData)
          .select('id')
          .single()

        if (error) throw error
        couponId = data.id
      }

      setShowModal(false)
      loadCoupons()
    } catch (err) {
      console.error('Erro ao salvar cupom:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCoupon = async (couponId: string) => {
    if (!confirm('Tem certeza que deseja excluir este cupom?')) return

    setDeleting(couponId)

    try {
      const { error } = await supabase.from('coupons').delete().eq('id', couponId)
      if (error) throw error

      // Remover da lista local imediatamente para feedback visual
      setCoupons(prev => prev.filter(c => c.id !== couponId))
    } catch (err) {
      console.error('Erro ao excluir cupom:', err)
      // Recarregar caso tenha dado erro para garantir consistência
      loadCoupons()
    } finally {
      setDeleting(null)
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
            Cupons
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '14px' : '15px' }}>
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
            justifyContent: 'center',
            gap: '8px',
            width: isMobile ? '100%' : 'auto',
          }}
        >
          <Plus size={18} />
          Novo Cupom
        </button>
      </div>

      <div style={cardStyle}>
        {isMobile ? (
          /* Mobile: Card Layout */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {coupons.map((coupon) => (
              <div key={coupon.id} style={{
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
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {coupon.description || 'Sem descricao'}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: coupon.is_active && !isExpired(coupon.valid_until)
                      ? 'rgba(34, 197, 94, 0.16)'
                      : 'rgba(107, 114, 128, 0.16)',
                    color: coupon.is_active && !isExpired(coupon.valid_until) ? '#22c55e' : '#6b7280',
                  }}>
                    {isExpired(coupon.valid_until) ? 'Expirado' : coupon.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Desconto</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Usos</div>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '14px' }}>
                      {coupon.usage_count} / {coupon.usage_limit || '∞'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '12px' }}>
                  <Calendar size={14} />
                  {coupon.valid_until ? (
                    <span style={{ color: isExpired(coupon.valid_until) ? '#ef4444' : 'var(--text-secondary)' }}>
                      Valido ate {formatDate(coupon.valid_until)}
                    </span>
                  ) : (
                    <span>Sem validade</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleToggleActive(coupon.id, coupon.is_active)}
                    style={{
                      flex: 1,
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
                    disabled={deleting === coupon.id}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: deleting === coupon.id ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                      color: '#ef4444',
                      cursor: deleting === coupon.id ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: deleting === coupon.id ? 0.7 : 1,
                    }}
                  >
                    {deleting === coupon.id ? (
                      <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop: Table Layout */
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: coupon.is_active && !isExpired(coupon.valid_until)
                          ? 'rgba(34, 197, 94, 0.16)'
                          : 'rgba(107, 114, 128, 0.16)',
                        color: coupon.is_active && !isExpired(coupon.valid_until) ? '#22c55e' : '#6b7280',
                        display: 'inline-block',
                        width: 'fit-content',
                      }}>
                        {isExpired(coupon.valid_until) ? 'Expirado' : coupon.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
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
                        disabled={deleting === coupon.id}
                        style={{
                          padding: '8px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: deleting === coupon.id ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                          color: '#ef4444',
                          cursor: deleting === coupon.id ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: deleting === coupon.id ? 0.7 : 1,
                        }}
                      >
                        {deleting === coupon.id ? (
                          <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

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

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Tipo de Desconto</label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as 'percentage' | 'fixed_amount' })}
                    className="replyna-select form-input"
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

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
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

            <div style={{
              padding: '12px',
              backgroundColor: 'rgba(70, 114, 236, 0.06)',
              borderRadius: '10px',
              marginTop: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <RefreshCw size={14} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                O cupom sera salvo localmente no Supabase
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'row', gap: '12px', marginTop: '16px', justifyContent: 'flex-end' }}>
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
                onClick={handleSaveCoupon}
                disabled={saving || !formData.code.trim()}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'var(--accent)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: saving || !formData.code.trim() ? 'not-allowed' : 'pointer',
                  opacity: saving || !formData.code.trim() ? 0.7 : 1,
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
                    Salvando...
                  </>
                ) : (
                  editingCoupon ? 'Salvar' : 'Criar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## 2) src/pages/admin/AdminFinancial.tsx

```tsx
import { useEffect, useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { subDays } from 'date-fns'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  CreditCard,
  ArrowDownRight,
  RefreshCw,
  ExternalLink,
  Receipt,
  Calendar,
  Package,
} from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import DateRangePicker from '../../components/DateRangePicker'
import { useTheme } from '../../context/ThemeContext'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isMobile
}

const getDefaultRange = (): DateRange => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return { from: subDays(today, 29), to: today } // 30 dias para carregar mais rápido
}

interface SubscriptionByPlan {
  plan_name: string
  count: number
}

interface FinancialStats {
  balance: {
    available: number
    pending: number
    currency: string
  }
  mrr: number
  arr: number
  activeSubscriptions: number
  totalCustomers: number
  revenueThisMonth: number
  revenueLastMonth: number
  revenueGrowth: number
  churnRate: number
  averageTicket: number
  recentPayments: {
    id: string
    amount: number
    currency: string
    status: string
    customer_email: string | null
    customer_name: string | null
    description: string | null
    created: number
  }[]
  recentInvoices: {
    id: string
    number: string | null
    amount_due: number
    amount_paid: number
    status: string | null
    customer_email: string | null
    customer_name: string | null
    created: number
    hosted_invoice_url: string | null
  }[]
  subscriptionsByStatus: {
    active: number
    past_due: number
    canceled: number
    trialing: number
  }
  subscriptionsByPlan?: SubscriptionByPlan[]
  monthlyRevenue: {
    month: string
    revenue: number
  }[]
  periodMetrics?: {
    revenueInPeriod: number
    newSubscriptionsInPeriod: number
    canceledSubscriptionsInPeriod: number
    chargesInPeriod: number
  }
}

export default function AdminFinancial() {
  const isMobile = useIsMobile()
  const { theme } = useTheme()
  const [stats, setStats] = useState<FinancialStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [range, setRange] = useState<DateRange>(getDefaultRange())

  useEffect(() => {
    if (range?.from && range?.to) {
      loadStats()
    }
  }, [range])

  const loadStats = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const startDate = range?.from?.toISOString().split('T')[0]
      const endDate = range?.to?.toISOString().split('T')[0]

      // Se for refresh manual, forçar bypass do cache
      const refreshParam = isRefresh ? '&refresh=true' : ''
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-financial-stats?period=custom&startDate=${startDate}&endDate=${endDate}${refreshParam}`

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao carregar dados')
      }

      const data = await response.json()
      setStats(data)
    } catch (err) {
      console.error('Erro ao carregar estatisticas:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  const formatDateShort = (timestamp: number) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    }).format(new Date(timestamp * 1000))

  const cardStyle = {
    backgroundColor: 'var(--bg-card)',
    borderRadius: '16px',
    padding: isMobile ? '16px' : '24px',
    border: '1px solid var(--border-color)',
    overflow: 'hidden' as const,
  }

  const statCardStyle = {
    ...cardStyle,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
  }

  const iconBoxStyle = (color: string) => ({
    width: isMobile ? '40px' : '48px',
    height: isMobile ? '40px' : '48px',
    borderRadius: '12px',
    backgroundColor: `${color}15`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  })

  const getStatusBadge = (status: string) => {
    const base: React.CSSProperties = { padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600 }
    switch (status) {
      case 'CONFIRMED':
      case 'RECEIVED':
      case 'RECEIVED_IN_CASH':
      case 'succeeded':
      case 'paid':
      case 'active':
        return { ...base, backgroundColor: 'rgba(34, 197, 94, 0.16)', color: '#22c55e' }
      case 'REFUNDED':
      case 'failed':
      case 'canceled':
      case 'void':
        return { ...base, backgroundColor: 'rgba(239, 68, 68, 0.16)', color: '#ef4444' }
      case 'OVERDUE':
      case 'PENDING':
      case 'AWAITING_RISK_ANALYSIS':
      case 'pending':
      case 'past_due':
      case 'open':
        return { ...base, backgroundColor: 'rgba(245, 158, 11, 0.16)', color: '#f59e0b' }
      case 'draft':
      case 'trialing':
        return { ...base, backgroundColor: 'rgba(107, 114, 128, 0.16)', color: '#6b7280' }
      default:
        return { ...base, backgroundColor: 'rgba(107, 114, 128, 0.16)', color: '#6b7280' }
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      // Stripe (legacy)
      succeeded: 'Pago',
      paid: 'Pago',
      failed: 'Falhou',
      void: 'Anulado',
      draft: 'Rascunho',
      // Asaas
      CONFIRMED: 'Pago',
      RECEIVED: 'Recebido',
      OVERDUE: 'Atrasado',
      PENDING: 'Pendente',
      REFUNDED: 'Estornado',
      RECEIVED_IN_CASH: 'Recebido',
      AWAITING_RISK_ANALYSIS: 'Analisando',
      // Compartilhados
      active: 'Ativo',
      canceled: 'Cancelado',
      pending: 'Pendente',
      past_due: 'Atrasado',
      open: 'Aberto',
      trialing: 'Trial',
    }
    return labels[status] || status
  }

  const chartColors = useMemo(() => {
    if (typeof document === 'undefined') {
      return {
        text: '#42506a',
        grid: 'rgba(215, 222, 239, 0.6)',
      }
    }
    const styles = getComputedStyle(document.documentElement)
    const text = styles.getPropertyValue('--text-secondary').trim() || '#42506a'
    const grid = styles.getPropertyValue('--border-color').trim() || 'rgba(215, 222, 239, 0.6)'
    return { text, grid }
  }, [theme])

  const maxRevenue = stats?.monthlyRevenue
    ? Math.max(...stats.monthlyRevenue.map(m => m.revenue), 1)
    : 1

  const chartData = useMemo(() => ({
    labels: stats?.monthlyRevenue.map((item) => item.month) || [],
    datasets: [
      {
        label: 'Receita',
        data: stats?.monthlyRevenue.map((item) => item.revenue) || [],
        borderColor: '#4672ec',
        backgroundColor: 'rgba(70, 114, 236, 0.18)',
        tension: 0.3,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#4672ec',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  }), [stats?.monthlyRevenue])

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#0e1729',
        titleColor: '#f5fafe',
        bodyColor: '#f5fafe',
        padding: 12,
        callbacks: {
          label: (context: { parsed: { y: number | null } }) => {
            return formatCurrency(context.parsed.y ?? 0)
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: chartColors.grid,
        },
        ticks: {
          color: chartColors.text,
        },
      },
      y: {
        grid: {
          color: chartColors.grid,
        },
        ticks: {
          color: chartColors.text,
          callback: (value: number | string) => {
            if (typeof value === 'number') {
              return formatCurrency(value)
            }
            return value
          },
        },
        min: 0,
        suggestedMax: Math.ceil(maxRevenue * 1.2),
      },
    },
  }), [chartColors, maxRevenue])

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
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '12px' : '24px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                height: isMobile ? '100px' : '120px',
                backgroundColor: 'var(--border-color)',
                borderRadius: '16px',
                animation: 'replyna-pulse 1.6s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{
          ...cardStyle,
          textAlign: 'center',
          padding: '48px',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <CreditCard size={32} style={{ color: '#ef4444' }} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Erro ao carregar dados
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            {error}
          </p>
          <button
            onClick={() => loadStats()}
            style={{
              padding: '12px 24px',
              borderRadius: '10px',
              backgroundColor: 'var(--accent)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <RefreshCw size={16} />
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? '24px' : '32px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', gap: isMobile ? '16px' : '0' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Financeiro
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '14px' : '15px' }}>
            Dados em tempo real do Asaas
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          <DateRangePicker value={range} onChange={setRange} />
          <button
            onClick={() => loadStats(true)}
            disabled={refreshing}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              fontWeight: 500,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
            }}
          >
            <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Atualizar
          </button>
            <a
            href="https://www.asaas.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              backgroundColor: '#635bff',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
            }}
          >
            Painel Asaas
            <ExternalLink size={16} />
          </a>
        </div>
      </div>

      {/* Metricas do Periodo Selecionado */}
      <div style={{ ...cardStyle, marginBottom: '24px', background: 'linear-gradient(135deg, rgba(70, 114, 236, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)' }}>
        <div style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: 600, color: 'var(--accent)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={isMobile ? 16 : 18} />
          Metricas do Periodo Selecionado
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '16px' : '24px' }}>
          <div>
            <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: '#22c55e' }}>
              {formatCurrency(stats?.periodMetrics?.revenueInPeriod || 0)}
            </div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)' }}>Faturamento</div>
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: '#3b82f6' }}>
              {stats?.periodMetrics?.newSubscriptionsInPeriod || 0}
            </div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)' }}>Novas Assinaturas</div>
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: '#ef4444' }}>
              {stats?.periodMetrics?.canceledSubscriptionsInPeriod || 0}
            </div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)' }}>Cancelamentos</div>
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: 700, color: '#8b5cf6' }}>
              {stats?.periodMetrics?.chargesInPeriod || 0}
            </div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)' }}>Cobrancas</div>
          </div>
        </div>
      </div>

      {/* Metricas principais */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '12px' : '24px', marginBottom: '24px' }}>
        <div style={statCardStyle}>
          <div style={iconBoxStyle('#22c55e')}>
            <DollarSign size={isMobile ? 20 : 24} style={{ color: '#22c55e' }} />
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              MRR
            </div>
            <div style={{ fontSize: isMobile ? '18px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(stats?.mrr || 0)}
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Receita recorrente mensal
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#3b82f6')}>
            <Calendar size={isMobile ? 20 : 24} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Receita do Mes
            </div>
            <div style={{ fontSize: isMobile ? '18px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(stats?.revenueThisMonth || 0)}
            </div>
            <div style={{
              fontSize: isMobile ? '10px' : '12px',
              color: (stats?.revenueGrowth || 0) >= 0 ? '#22c55e' : '#ef4444',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              {(stats?.revenueGrowth || 0) >= 0 ? <TrendingUp size={isMobile ? 12 : 14} /> : <TrendingDown size={isMobile ? 12 : 14} />}
              {(stats?.revenueGrowth || 0).toFixed(1)}% vs mes anterior
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#8b5cf6')}>
            <Users size={isMobile ? 20 : 24} style={{ color: '#8b5cf6' }} />
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Assinaturas Ativas
            </div>
            <div style={{ fontSize: isMobile ? '18px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.activeSubscriptions || 0}
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {stats?.totalCustomers || 0} clientes no total
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#f59e0b')}>
            <Receipt size={isMobile ? 20 : 24} style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Ticket Medio
            </div>
            <div style={{ fontSize: isMobile ? '18px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(stats?.averageTicket || 0)}
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              por transacao
            </div>
          </div>
        </div>
      </div>

      {/* Segunda linha de metricas */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '12px' : '24px', marginBottom: '24px' }}>
        <div style={statCardStyle}>
          <div style={iconBoxStyle('#3b82f6')}>
            <TrendingUp size={isMobile ? 20 : 24} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              ARR
            </div>
            <div style={{ fontSize: isMobile ? '18px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(stats?.arr || 0)}
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Receita recorrente anual
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#ef4444')}>
            <ArrowDownRight size={isMobile ? 20 : 24} style={{ color: '#ef4444' }} />
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Churn Rate
            </div>
            <div style={{ fontSize: isMobile ? '18px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {(stats?.churnRate || 0).toFixed(1)}%
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              no período selecionado
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#6b7280')}>
            <CreditCard size={isMobile ? 20 : 24} style={{ color: '#6b7280' }} />
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Mes Anterior
            </div>
            <div style={{ fontSize: isMobile ? '18px' : '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(stats?.revenueLastMonth || 0)}
            </div>
            <div style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              receita total
            </div>
          </div>
        </div>

        {/* Card de Assinaturas por Status */}
        <div style={statCardStyle}>
          <div style={iconBoxStyle('#22c55e')}>
            <Users size={isMobile ? 20 : 24} style={{ color: '#22c55e' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Assinaturas por Status
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>Ativos</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {(stats?.subscriptionsByStatus.active || 0) + (stats?.subscriptionsByStatus.trialing || 0)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600 }}>Cancelados</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {stats?.subscriptionsByStatus.canceled || 0}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 600 }}>Inadimplência</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {stats?.subscriptionsByStatus.past_due || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bloco de Assinaturas por Plano - Linha inteira */}
      <div style={{ ...cardStyle, marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Package size={isMobile ? 18 : 20} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Clientes Ativos por Plano
          </h2>
        </div>
        {stats?.subscriptionsByPlan && stats.subscriptionsByPlan.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {stats.subscriptionsByPlan.map((plan, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '12px',
                  padding: '16px 24px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  minWidth: isMobile ? '100%' : '180px',
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(70, 114, 236, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)' }}>{plan.count}</span>
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {plan.plan_name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {plan.count === 1 ? 'cliente ativo' : 'clientes ativos'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '12px',
              padding: '16px 24px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(70, 114, 236, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)' }}>{stats?.activeSubscriptions || 0}</span>
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Starter
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  clientes ativos
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grafico de receita - Linha inteira */}
      <div style={{ ...cardStyle, marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <TrendingUp size={isMobile ? 18 : 20} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Receita no Periodo
          </h2>
        </div>
        <div style={{ height: isMobile ? '250px' : '320px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* Faturas recentes */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Receipt size={isMobile ? 18 : 20} style={{ color: '#f59e0b' }} />
          <h2 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Faturas Recentes
          </h2>
        </div>
        {stats?.recentInvoices && stats.recentInvoices.length > 0 ? (
          isMobile ? (
            <div className="replyna-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
              {stats.recentInvoices.map((invoice) => (
                <div key={invoice.id} style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '10px',
                  padding: '12px',
                  border: '1px solid var(--border-color)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {invoice.number || invoice.id.slice(-8)}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {invoice.customer_name || invoice.customer_email || 'N/A'}
                      </div>
                    </div>
                    <span style={getStatusBadge(invoice.status || 'draft')}>
                      {getStatusLabel(invoice.status || 'draft')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatCurrency(invoice.amount_due)}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {formatDateShort(invoice.created)}
                      </div>
                    </div>
                    {invoice.hosted_invoice_url && (
                      <a
                        href={invoice.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--accent)',
                          textDecoration: 'none',
                          fontSize: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        Ver <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="replyna-scrollbar" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ textAlign: 'left', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>Fatura</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>Cliente</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>Valor</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>Status</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>Data</th>
                    <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentInvoices.map((invoice) => (
                    <tr key={invoice.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {invoice.number || invoice.id.slice(-8)}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)' }}>
                        {invoice.customer_name || invoice.customer_email || 'N/A'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatCurrency(invoice.amount_due)}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={getStatusBadge(invoice.status || 'draft')}>
                          {getStatusLabel(invoice.status || 'draft')}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {formatDateShort(invoice.created)}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {invoice.hosted_invoice_url && (
                          <a
                            href={invoice.hosted_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              backgroundColor: 'var(--bg-primary)',
                              color: 'var(--accent)',
                              textDecoration: 'none',
                              fontSize: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            Ver <ExternalLink size={12} />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
            Nenhuma fatura registrada
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
```

---

## 3) src/pages/admin/AdminMigration.tsx

```tsx
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted'>('all')

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

  const filteredInvites = invites.filter((invite) => {
    if (statusFilter === 'all') return true
    return invite.status === statusFilter
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
          <li>Na data definida, o Asaas cobra automaticamente</li>
        </ol>
      </div>

      {/* Filtros de Status */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { value: 'all', label: 'Todos', count: invites.length },
          { value: 'pending', label: 'Pendentes', count: invites.filter(i => i.status === 'pending').length },
          { value: 'accepted', label: 'Aceitos', count: invites.filter(i => i.status === 'accepted').length },
        ].map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatusFilter(filter.value as 'all' | 'pending' | 'accepted')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: statusFilter === filter.value ? 'var(--accent)' : 'var(--border-color)',
              backgroundColor: statusFilter === filter.value ? 'rgba(70, 114, 236, 0.1)' : 'transparent',
              color: statusFilter === filter.value ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: 500,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            {filter.label}
            <span style={{
              padding: '2px 8px',
              borderRadius: '999px',
              backgroundColor: statusFilter === filter.value ? 'var(--accent)' : 'var(--border-color)',
              color: statusFilter === filter.value ? '#fff' : 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 600,
            }}>
              {filter.count}
            </span>
          </button>
        ))}
      </div>

      <div style={cardStyle}>
        {isMobile ? (
          /* Mobile: Card Layout */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredInvites.map((invite) => (
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
              {filteredInvites.map((invite) => (
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

        {filteredInvites.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
            {invites.length === 0
              ? 'Nenhum convite de migração criado ainda'
              : `Nenhum convite ${statusFilter === 'pending' ? 'pendente' : 'aceito'} encontrado`
            }
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
                      className="replyna-select form-input"
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
```

---

## 4) src/pages/MigrationAccept.tsx

```tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Check, AlertCircle, Calendar, CreditCard, Store, RefreshCw } from 'lucide-react'

interface InviteData {
  code: string
  customer_email: string
  customer_name: string | null
  plan: {
    id: string
    name: string
    price_monthly: number
    shops_limit: number
    emails_limit: number
  }
  billing_start_date: string
  trial_days: number
}

export default function MigrationAccept() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState<InviteData | null>(null)

  const [formData, setFormData] = useState({
    email: '',
    name: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (code) {
      validateInvite(code)
    }
  }, [code])

  const validateInvite = async (inviteCode: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-migration-invite?code=${inviteCode}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      )

      const data = await response.json()

      if (!response.ok || !data.valid) {
        setError(data.error || 'Convite inválido')
        return
      }

      setInvite(data.invite)
      setFormData({
        email: data.invite.customer_email,
        name: data.invite.customer_name || '',
      })
    } catch (err) {
      console.error('Erro ao validar convite:', err)
      setError('Erro ao validar convite')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!invite || !formData.email) return

    setSubmitting(true)

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-migration-invite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            code: invite.code,
            user_email: formData.email,
            user_name: formData.name,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao aceitar convite')
      }

      // Salvar dados pendentes no localStorage (igual ao Register.tsx)
      localStorage.setItem('pending_registration', JSON.stringify({
        email: formData.email,
        name: formData.name,
        plan_id: invite.plan.id,
        plan_name: invite.plan.name,
        emails_limit: invite.plan.emails_limit,
        shops_limit: invite.plan.shops_limit,
        migration_invite_code: invite.code,
      }))

      // Redirecionar para o pagamento do Asaas
      if (data.url) {
        window.location.href = data.url
      } else {
        // Pagamento confirmado instantaneamente
        window.location.href = '/login?registered=true'
      }
    } catch (err) {
      console.error('Erro ao aceitar convite:', err)
      setError(err instanceof Error ? err.message : 'Erro ao processar convite')
      setSubmitting(false)
    }
  }

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date))

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--text-primary)',
    fontSize: '15px',
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
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid var(--border-color)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        padding: '20px',
      }}>
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '48px 32px',
          textAlign: 'center',
          maxWidth: '400px',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <AlertCircle size={32} style={{ color: '#ef4444' }} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
            Convite Inválido
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.6' }}>
            {error}
          </p>
          <button
            onClick={() => navigate('/login')}
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
            Ir para Login
          </button>
        </div>
      </div>
    )
  }

  if (!invite) return null

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img
            src="/replyna-logo.webp"
            alt="Replyna"
            style={{ height: '48px', marginBottom: '24px', display: 'block', margin: '0 auto 24px' }}
          />
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Bem-vindo de volta!
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            Você foi convidado para migrar para a nova versão da Replyna
          </p>
        </div>

        {/* Invite Details Card */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid var(--border-color)',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>
            Detalhes do seu plano
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                <CreditCard size={20} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Plano</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {invite.plan.name} - R$ {invite.plan.price_monthly}/mês
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Store size={20} style={{ color: '#22c55e' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Limite de lojas</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {invite.plan.shops_limit} loja{invite.plan.shops_limit > 1 ? 's' : ''}
                </div>
              </div>
            </div>

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
                <Calendar size={20} style={{ color: '#f59e0b' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Início da cobrança</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {formatDate(invite.billing_start_date)}
                </div>
              </div>
            </div>
          </div>

          {/* Trial info */}
          {invite.trial_days > 0 && (
            <div style={{
              marginTop: '20px',
              padding: '16px',
              backgroundColor: 'rgba(34, 197, 94, 0.06)',
              borderRadius: '12px',
              border: '1px solid rgba(34, 197, 94, 0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={18} style={{ color: '#22c55e' }} />
                <span style={{ fontSize: '14px', color: '#22c55e', fontWeight: 600 }}>
                  {invite.trial_days} dias gratuitos até o início da cobrança
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', marginLeft: '26px' }}>
                Você poderá usar a Replyna normalmente sem cobrança até {formatDate(invite.billing_start_date)}
              </p>
            </div>
          )}
        </div>

        {/* Form Card */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid var(--border-color)',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>
            Confirme seus dados
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Nome</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={inputStyle}
                placeholder="Seu nome"
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={inputStyle}
                placeholder="seu@email.com"
                required
              />
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                Você receberá um email para definir sua senha após o cadastro
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '14px 24px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: 'var(--accent)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '15px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '8px',
              }}
            >
              {submitting ? (
                <>
                  <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  Processando...
                </>
              ) : (
                <>
                  <CreditCard size={18} />
                  Adicionar cartão e continuar
                </>
              )}
            </button>

            <p style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              textAlign: 'center',
              lineHeight: '1.6',
            }}>
              Ao continuar, você será redirecionado para uma página segura do Asaas para adicionar seu cartão.
              A cobrança só será realizada em {formatDate(invite.billing_start_date)}.
            </p>
          </form>
        </div>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          marginTop: '24px',
          fontSize: '13px',
          color: 'var(--text-secondary)',
        }}>
          Já tem uma conta?{' '}
          <a href="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
            Fazer login
          </a>
        </p>
      </div>
    </div>
  )
}
```

---

## 5) src/pages/ChargebackPage.tsx

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  FileText,
  Image as ImageIcon,
  MapPin,
  Menu,
  PhoneCall,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'

const glossaryItems = [
  {
    id: 'glossario-settlement',
    term: 'Settlement',
    definition:
      'Tempo de processamento do repasse. É o prazo entre a venda acontecer e o dinheiro cair na sua conta. Na Shopify, esse prazo varia de 2 a 7 dias úteis dependendo do país e do histórico da conta.',
  },
  {
    id: 'glossario-merchant',
    term: 'Merchant',
    definition:
      'Lojista ou comerciante online. É quem vende o produto e recebe o pagamento. No contexto de chargebacks, o merchant é quem sofre o prejuízo quando uma disputa é aberta.',
  },
  {
    id: 'glossario-gateway',
    term: 'Gateway de pagamento',
    definition:
      'Processador que faz a intermediação entre a loja, o banco do cliente e o banco do lojista. Exemplos: Shopify Payments, Stripe, Asaas, PayPal. É o gateway que debita o valor do chargeback da conta do lojista.',
  },
  {
    id: 'glossario-friendly-fraud',
    term: 'Friendly fraud',
    definition:
      'Fraude amigável. Quando o próprio dono do cartão fez a compra mas contesta como se não reconhecesse. Pode ser por esquecimento, arrependimento ou má-fé. Representa a maioria dos chargebacks no e-commerce.',
  },
  {
    id: 'glossario-chargeback-ratio',
    term: 'Chargeback ratio',
    definition:
      'Taxa de chargeback. É a porcentagem de chargebacks em relação ao total de transações processadas num período. Exemplo: 10 chargebacks em 1.000 pedidos = 1% de chargeback ratio. As bandeiras monitoram esse número para decidir se a loja entra em programa de penalidade.',
  },
  {
    id: 'glossario-rolling-reserve',
    term: 'Rolling reserve',
    definition:
      'Reserva rolante. Uma porcentagem de cada venda que o gateway retém como garantia por um período (geralmente 30 a 90 dias). Se houver chargebacks, o gateway usa essa reserva para cobrir. É aplicada em contas consideradas de alto risco.',
  },
  {
    id: 'glossario-vamp',
    term: 'VAMP',
    definition:
      'Visa Acquirer Monitoring Program. Programa da Visa que monitora a taxa de fraudes e disputas dos merchants. Substituiu os antigos VDMP e VFMP em abril de 2025. Merchants que ultrapassam o limite de 1.5% (caindo para 0.9% em 2026) são classificados como "Excessive" e pagam multa de $10 USD por disputa.',
  },
  {
    id: 'glossario-ecm',
    term: 'ECM',
    definition:
      'Excessive Chargeback Merchant. Programa da Mastercard que monitora merchants com taxa de chargeback acima de 1.5% ou mais de 100 chargebacks por mês. Multas podem chegar a $200.000 USD.',
  },
  {
    id: 'glossario-ticket-medio',
    term: 'Ticket médio',
    definition:
      'Valor médio por pedido na sua loja. Calculado dividindo o faturamento total pelo número de pedidos. Exemplo: R$30.000 em vendas ÷ 200 pedidos = ticket médio de R$150.',
  },
  {
    id: 'glossario-d3',
    term: 'D+3',
    definition:
      'Modelo de recebimento onde o lojista recebe o dinheiro da venda 3 dias úteis depois da transação. O "D" significa o dia da venda (dia zero) e o "+3" os dias úteis até o repasse. Na Shopify Payments, o settlement varia por país: EUA/Austrália recebem em D+2, Europa/Canadá em D+3, Hong Kong/Singapura em D+4. Merchants novos podem começar com D+7.',
  },
]

const faqItems = [
  {
    question: 'O que é chargeback?',
    answer:
      'Chargeback é quando o cliente contesta uma compra diretamente com o banco ou a operadora do cartão, pedindo o dinheiro de volta sem falar com a loja.',
  },
  {
    question: 'Qual a diferença entre chargeback, estorno e reembolso?',
    answer:
      'Reembolso é devolução voluntária feita pela loja. Estorno é reversão por erro técnico do gateway ou banco. Chargeback é disputa iniciada pelo cliente junto ao banco, com taxa e impacto na conta do lojista.',
  },
  {
    question: 'Qual o limite aceitável de taxa de chargeback?',
    answer:
      'Recomendamos manter a taxa abaixo de 0.5% do total de transações. Acima disso, a loja pode entrar em programas de monitoramento e sofrer retenções ou multas.',
  },
  {
    question: 'Quanto custa um chargeback para a loja?',
    answer:
      'Além do valor da venda, o lojista perde o custo do produto, paga a taxa do gateway e gasta tempo operacional para responder a disputa.',
  },
  {
    question: 'Como prevenir chargebacks no e-commerce?',
    answer:
      'Responder rápido, oferecer rastreio visível, ter política de devolução clara, descrição precisa e atendimento proativo são as ações mais eficazes.',
  },
]

type CurrencyOption = {
  code: string
  symbol: string
  flag: string
  countryName: string
  currencyName: string
  searchValue: string
}

const currencyRegionOverrides: Record<string, string> = {
  EUR: 'EU',
}

const ISO_CURRENCY_CODES = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CUC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD',
  'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP',
  'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG', 'HUF', 'IDR',
  'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS',
  'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR',
  'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP',
  'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO',
  'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN',
  'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG',
  'SEK', 'SGD', 'SHP', 'SLE', 'SLL', 'SOS', 'SRD', 'SSP', 'STN', 'SVC',
  'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD',
  'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST',
  'XAF', 'XCD', 'XCG', 'XDR', 'XOF', 'XPF', 'XSU', 'YER', 'ZAR', 'ZMW',
  'ZWG', 'ZWL',
]

const getRegionForCurrency = (code: string) => {
  const override = currencyRegionOverrides[code]
  if (override) return override
  if (code.startsWith('X')) return 'UN'
  const region = code.slice(0, 2).toUpperCase()
  if (/^[A-Z]{2}$/.test(region)) return region
  return 'UN'
}

const getFlagEmoji = (regionCode: string) => {
  if (!regionCode) return '🏳️'
  const base = 0x1f1e6
  const chars = regionCode.toUpperCase().split('')
  if (chars.length !== 2) return '🏳️'
  return String.fromCodePoint(base + chars[0].charCodeAt(0) - 65, base + chars[1].charCodeAt(0) - 65)
}

const getCurrencySymbol = (code: string) => {
  try {
    const formatter = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    })
    const parts = formatter.formatToParts(1)
    const currencyPart = parts.find((part) => part.type === 'currency')
    return currencyPart?.value ?? code
  } catch {
    return code
  }
}

const getSupportedCurrencyCodes = () => {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (type: string) => string[] }
  const supported = intl.supportedValuesOf ? intl.supportedValuesOf('currency') : []
  if (supported.length) {
    return Array.from(new Set([...supported, ...ISO_CURRENCY_CODES]))
  }
  return ISO_CURRENCY_CODES
}

const formatCount = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
  }).format(value)

const formatRatio = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
  }).format(value)

const formatPercent = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)

const parseNumber = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return 0
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed
  const number = Number(normalized.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(number) ? number : 0
}

const getAppUrl = (path: string) => {
  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return path
  }
  return `https://app.replyna.me${path}`
}

const getLandingUrl = (path: string) => {
  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return path
  }
  return `https://www.replyna.me${path}`
}

function GlossaryLink({ id, children }: { id: string; children: ReactNode }) {
  return (
    <a
      href={`#${id}`}
      className="lp-glossary-link"
    >
      {children}
    </a>
  )
}

export default function ChargebackPage() {
  const [ticketMedioInput, setTicketMedioInput] = useState('')
  const [pedidosInput, setPedidosInput] = useState('')
  const [taxaInput, setTaxaInput] = useState('')
  const [custoInput, setCustoInput] = useState('25')
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedCurrency, setSelectedCurrency] = useState('BRL')
  const [currencyQuery, setCurrencyQuery] = useState('')
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const currencyDropdownRef = useRef<HTMLDivElement>(null)

  const currencyOptions = useMemo<CurrencyOption[]>(() => {
    const codes = getSupportedCurrencyCodes()
    const currencyNames = typeof Intl.DisplayNames === 'function'
      ? new Intl.DisplayNames(['pt-BR'], { type: 'currency' })
      : null
    const regionNames = typeof Intl.DisplayNames === 'function'
      ? new Intl.DisplayNames(['pt-BR'], { type: 'region' })
      : null

    return codes
      .map((code) => {
        const region = getRegionForCurrency(code)
        const flag = getFlagEmoji(region)
        const currencyName = currencyNames?.of(code) ?? code
        const countryName = regionNames?.of(region) ?? region
        const symbol = getCurrencySymbol(code)
        const searchValue = `${code} ${currencyName} ${countryName}`.toLowerCase()
        return {
          code,
          symbol,
          flag,
          countryName,
          currencyName,
          searchValue,
        }
      })
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [])

  const selectedCurrencyOption = useMemo(() => {
    return (
      currencyOptions.find((option) => option.code === selectedCurrency) ?? {
        code: selectedCurrency,
        symbol: selectedCurrency,
        flag: '🏳️',
        countryName: '',
        currencyName: selectedCurrency,
        searchValue: selectedCurrency.toLowerCase(),
      }
    )
  }, [currencyOptions, selectedCurrency])

  const filteredCurrencies = useMemo(() => {
    const query = currencyQuery.trim().toLowerCase()
    if (!query) return currencyOptions
    return currencyOptions.filter((option) => option.searchValue.includes(query))
  }, [currencyOptions, currencyQuery])

  const formatCurrency = (value: number, currencyCode = selectedCurrency, options?: Intl.NumberFormatOptions) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0,
      ...options,
    }).format(value)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    if (!currencyOptions.length) return
    const hasSelected = currencyOptions.some((option) => option.code === selectedCurrency)
    if (!hasSelected) {
      setSelectedCurrency(currencyOptions[0].code)
    }
  }, [currencyOptions, selectedCurrency])

  useEffect(() => {
    if (!currencyMenuOpen) return
    const handleClick = (event: MouseEvent) => {
      if (!currencyDropdownRef.current) return
      const target = event.target as Node
      if (!currencyDropdownRef.current.contains(target)) {
        setCurrencyMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [currencyMenuOpen])

  useEffect(() => {
    const previousTitle = document.title
    const previousDescription = document
      .querySelector('meta[name="description"]')
      ?.getAttribute('content')
    const previousCanonical = document
      .querySelector('link[rel="canonical"]')
      ?.getAttribute('href')

    document.title = 'Chargeback: O Que É, Como Prevenir e Calculadora Gratuita | Replyna'

    let metaDescription = document.querySelector('meta[name="description"]') as
      | HTMLMetaElement
      | null
    if (!metaDescription) {
      metaDescription = document.createElement('meta')
      metaDescription.name = 'description'
      document.head.appendChild(metaDescription)
    }
    metaDescription.setAttribute(
      'content',
      'Descubra o que é chargeback, quanto custa para sua loja e como reduzir em até 91%. Use nossa calculadora gratuita e proteja sua operação de e-commerce.',
    )
    metaDescription.dataset.chargeback = 'true'

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = 'https://www.replyna.me/chargeback'
    canonical.dataset.chargeback = 'true'

    return () => {
      document.title = previousTitle
      if (metaDescription) {
        if (previousDescription !== null && previousDescription !== undefined) {
          metaDescription.setAttribute('content', previousDescription)
        } else if (metaDescription.dataset.chargeback === 'true') {
          metaDescription.remove()
        }
      }
      if (canonical) {
        if (previousCanonical) {
          canonical.href = previousCanonical
        } else if (canonical.dataset.chargeback === 'true') {
          canonical.remove()
        }
      }
    }
  }, [])

  useEffect(() => {
    const scriptId = 'chargeback-faq-jsonld'
    const existingScript = document.getElementById(scriptId)
    if (existingScript) {
      existingScript.remove()
    }

    const faqJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.type = 'application/ld+json'
    script.text = JSON.stringify(faqJsonLd)
    document.head.appendChild(script)

    return () => {
      script.remove()
    }
  }, [])

  const calculatorData = useMemo(() => {
    const isReady =
      ticketMedioInput.trim() !== '' &&
      pedidosInput.trim() !== '' &&
      taxaInput.trim() !== ''

    if (!isReady) {
      return {
        isReady: false,
        chargebacksPorMes: 0,
        prejuizoMensal: 0,
        prejuizoAnual: 0,
        chargebacksEvitados: 0,
        economiaMensal: 0,
        economiaAnual: 0,
        roiReplyna: 0,
        receitaMensal: 0,
        percentualReceitaComprometida: 0,
      }
    }

    const ticketMedio = parseNumber(ticketMedioInput)
    const pedidosPorMes = parseNumber(pedidosInput)
    const taxaChargeback = parseNumber(taxaInput)
    const custoMedioPorChargeback = custoInput.trim() === '' ? 25 : parseNumber(custoInput)

    const chargebacksPorMes = (pedidosPorMes * taxaChargeback) / 100
    const prejuizoMensal = chargebacksPorMes * (ticketMedio + custoMedioPorChargeback)
    const prejuizoAnual = prejuizoMensal * 12
    const chargebacksEvitados = chargebacksPorMes * 0.91
    const economiaMensal = chargebacksEvitados * (ticketMedio + custoMedioPorChargeback)
    const economiaAnual = economiaMensal * 12
    const roiReplyna = economiaMensal / 197
    const receitaMensal = ticketMedio * pedidosPorMes
    const percentualReceitaComprometida =
      receitaMensal > 0 ? (prejuizoMensal / receitaMensal) * 100 : 0

    return {
      isReady: true,
      chargebacksPorMes,
      prejuizoMensal,
      prejuizoAnual,
      chargebacksEvitados,
      economiaMensal,
      economiaAnual,
      roiReplyna,
      receitaMensal,
      percentualReceitaComprometida,
    }
  }, [ticketMedioInput, pedidosInput, taxaInput, custoInput])

  const handleAnchorClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.defaultPrevented) return
    const target = event.target as HTMLElement | null
    const anchor = target?.closest('a')
    if (!anchor) return
    const href = anchor.getAttribute('href')
    if (!href || !href.startsWith('#')) return

    const id = href.replace('#', '')
    const element = document.getElementById(id)
    if (!element) return

    event.preventDefault()
    const headerOffset = 96
    const elementTop = element.getBoundingClientRect().top + window.scrollY
    window.scrollTo({
      top: elementTop - headerOffset,
      behavior: 'smooth',
    })
  }

  const handlePricingClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    try {
      localStorage.setItem('lp-scroll-target', 'precos')
    } catch (error) {
      // Ignore storage issues and continue with the redirect.
    }
    window.location.href = getLandingUrl('/#precos')
  }

  const shouldShowResults = calculatorData.isReady
  const rawSliderValue = taxaInput === '' ? 0 : parseNumber(taxaInput)
  const sliderValue = Math.min(10, Math.max(0, rawSliderValue))
  const sliderPercent = (sliderValue / 10) * 100
  const sliderBackground = `linear-gradient(90deg, #06b6d4 0%, #3b82f6 ${sliderPercent}%, rgba(255,255,255, 0.08) ${sliderPercent}%, rgba(255,255,255, 0.08) 100%)`
  const mesesReplyna = Math.floor(calculatorData.prejuizoAnual / 197)
  return (
    <div className="lp-container" onClick={handleAnchorClick}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

        html {
          scroll-behavior: smooth;
        }

        .lp-container {
          min-height: 100vh;
          background-color: #050508;
          color: #ffffff;
          font-family: "Inter", "Manrope", "Segoe UI", sans-serif;
          overflow-x: hidden;
        }

        section[id], div[id] {
          scroll-margin-top: 110px;
        }

        .lp-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.6;
          pointer-events: none;
        }
        .lp-orb-1 {
          width: 520px;
          height: 520px;
          background: radial-gradient(circle, rgba(70, 114, 236, 0.35) 0%, transparent 70%);
          top: -200px;
          left: -160px;
        }
        .lp-orb-2 {
          width: 420px;
          height: 420px;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.28) 0%, transparent 70%);
          top: 20%;
          right: -140px;
        }

        .lp-noise {
          position: fixed;
          inset: 0;
          opacity: 0.03;
          pointer-events: none;
          z-index: 1000;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }

        .lp-grid-pattern {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 80px 80px;
          mask-image: linear-gradient(to bottom, black 0%, black 85%, transparent 100%);
          z-index: 0;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(32px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .lp-fade-in {
          animation: fadeInUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .lp-fade-in-delay-1 { animation-delay: 0.1s; opacity: 0; }
        .lp-fade-in-delay-2 { animation-delay: 0.2s; opacity: 0; }
        .lp-fade-in-delay-3 { animation-delay: 0.35s; opacity: 0; }

        .lp-glass {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .lp-card-shine {
          position: relative;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lp-card-shine::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent);
          transition: left 0.6s ease;
        }
        .lp-card-shine:hover::before {
          left: 100%;
        }
        .lp-card-shine:hover {
          transform: translateY(-6px);
          border-color: rgba(70, 114, 236, 0.3);
          box-shadow: 0 25px 50px rgba(0,0,0,0.4), 0 0 60px rgba(70, 114, 236, 0.12);
        }

        .lp-gradient-border {
          position: relative;
          background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%);
          border-radius: 20px;
        }
        .lp-gradient-border::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 20px;
          padding: 1px;
          background: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.02) 100%);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: exclude;
          -webkit-mask-composite: xor;
          pointer-events: none;
        }

        .lp-btn-primary {
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          background: linear-gradient(135deg, #4672ec 0%, #3b5fd9 100%);
        }
        .lp-btn-primary::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .lp-btn-primary:hover::before {
          opacity: 1;
        }
        .lp-btn-primary:hover {
          transform: translateY(-3px);
          box-shadow: 0 15px 40px rgba(70, 114, 236, 0.4), 0 0 20px rgba(70, 114, 236, 0.3);
        }

        .lp-btn-secondary {
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .lp-btn-secondary:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.2);
          transform: translateY(-2px);
        }

        .lp-badge {
          position: relative;
          overflow: hidden;
        }
        .lp-badge::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%);
          animation: badgeShine 3s ease-in-out infinite;
        }
        @keyframes badgeShine {
          0%, 100% { transform: translateX(-100%) rotate(45deg); }
          50% { transform: translateX(100%) rotate(45deg); }
        }

        .lp-number {
          background: linear-gradient(135deg, #4672ec 0%, #8b5cf6 50%, #06b6d4 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .lp-section-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          margin: 0 auto;
          max-width: 1200px;
        }

        .lp-nav-desktop {
          display: flex;
          gap: 32px;
          align-items: center;
        }
        .lp-nav-mobile-toggle {
          display: none;
          background: none;
          border: none;
          color: #fff;
          cursor: pointer;
          padding: 8px;
        }
        .lp-nav-link {
          color: rgba(255,255,255,0.6);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s ease;
          position: relative;
        }
        .lp-nav-link:hover {
          color: #fff;
        }
        .lp-nav-link::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 0;
          height: 2px;
          background: linear-gradient(90deg, #4672ec, #8b5cf6);
          transition: width 0.3s ease;
        }
        .lp-nav-link:hover::after {
          width: 100%;
        }

        .lp-glossary-link {
          color: inherit;
          text-decoration: none;
          border-bottom: 1px dashed rgba(255,255,255,0.4);
          cursor: pointer;
          position: relative;
        }

        .cb-input {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 14px 16px;
          color: #fff;
          font-size: 15px;
          outline: none;
          width: 100%;
        }
        .cb-input:focus {
          border-color: rgba(70, 114, 236, 0.5);
          box-shadow: 0 0 0 3px rgba(70, 114, 236, 0.15);
        }

        .cb-currency-select {
          position: relative;
          max-width: none;
          width: 100%;
        }
        .cb-currency-label {
          font-size: 12px;
          color: rgba(255,255,255,0.45);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 10px;
          display: block;
        }
        .cb-currency-button {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .cb-currency-button:hover {
          border-color: rgba(255,255,255,0.25);
          background: rgba(255,255,255,0.07);
        }
        .cb-currency-info {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 600;
        }
        .cb-currency-flag {
          font-size: 18px;
        }
        .cb-currency-menu {
          position: absolute;
          top: calc(100% + 10px);
          left: 0;
          right: 0;
          background: rgba(8, 8, 14, 0.98);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 16px;
          padding: 12px;
          z-index: 40;
          box-shadow: 0 20px 50px rgba(0,0,0,0.4);
        }
        .cb-currency-search {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 12px;
          padding: 10px 12px;
          color: #fff;
          font-size: 14px;
          outline: none;
        }
        .cb-currency-list {
          margin-top: 12px;
          max-height: 280px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .cb-currency-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          background: transparent;
          border: 1px solid transparent;
          color: #fff;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s ease;
        }
        .cb-currency-option:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.12);
        }
        .cb-currency-option.active {
          background: rgba(70, 114, 236, 0.16);
          border-color: rgba(70, 114, 236, 0.4);
        }
        .cb-currency-meta {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .cb-currency-country {
          font-size: 12px;
          color: rgba(255,255,255,0.45);
        }

        .cb-calculator-card {
          --cb-card-pad-x: 44px;
          --cb-card-pad-y: 48px;
          background: rgba(255,255,255, 0.02);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          border: 1px solid rgba(255,255,255, 0.06);
          border-radius: 20px;
          padding: var(--cb-card-pad-y) var(--cb-card-pad-x);
          position: relative;
          overflow: hidden;
        }
        .cb-card-glow-line {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, #3b82f6, #8b5cf6, #06b6d4, transparent);
          opacity: 0.8;
          z-index: 1;
        }
        .cb-card-glow-blur {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 80px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.12), rgba(139,92,246,0.14), rgba(6,182,212,0.12), transparent);
          filter: blur(30px);
          opacity: 1;
          z-index: 1;
        }
        .cb-card-noise {
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          mix-blend-mode: overlay;
          opacity: 0.4;
          pointer-events: none;
          z-index: 1;
        }
        .cb-card-content {
          position: relative;
          z-index: 2;
        }
        .cb-card-header {
          margin-bottom: 40px;
        }
        .cb-card-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: rgba(6,182,212, 0.7);
          margin-bottom: 8px;
        }
        .cb-card-title {
          font-size: 18px;
          font-weight: 600;
          color: rgba(255,255,255, 0.9);
        }

        .cb-input-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
        }
        .cb-field-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .cb-field-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255,255,255, 0.40);
        }
        .cb-helper-text {
          font-size: 11px;
          color: rgba(255,255,255, 0.25);
          line-height: 1.4;
        }
        .cb-slider-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .cb-slider-badge {
          min-width: 56px;
          padding: 5px 10px;
          border-radius: 8px;
          background: rgba(6,182,212, 0.1);
          border: 1px solid rgba(6,182,212, 0.2);
          color: #06b6d4;
          font-weight: 600;
          font-size: 12px;
          text-align: center;
        }
        .cb-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255, 0.06), transparent);
          margin: 32px 0;
        }
        .cb-cost-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
          align-items: start;
        }
        .cb-info-badge {
          font-size: 9px;
          font-weight: 600;
          padding: 3px 6px;
          border-radius: 4px;
          border: 1px solid rgba(255,255,255, 0.12);
          color: rgba(255,255,255,0.5);
          cursor: help;
        }
        .cb-mini-card {
          padding: 20px 24px;
          border-radius: 14px;
          background: rgba(6,182,212, 0.04);
          border: 1px solid rgba(6,182,212, 0.08);
          display: grid;
          gap: 12px;
          font-variant-numeric: tabular-nums;
        }
        .cb-mini-title {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(6,182,212, 0.5);
        }
        .cb-mini-proof {
          display: flex;
          align-items: baseline;
          gap: 8px;
          font-size: 32px;
          font-weight: 800;
          line-height: 1;
        }
        .cb-mini-proof-arrow {
          font-size: 20px;
          color: rgba(255,255,255, 0.25);
          font-weight: 600;
        }
        .cb-mini-subtitle {
          font-size: 12px;
          color: rgba(255,255,255, 0.35);
          margin-top: 8px;
          line-height: 1.4;
        }
        .cb-mini-metric {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .cb-mini-label {
          font-size: 11px;
          color: rgba(255,255,255, 0.35);
        }
        .cb-mini-value {
          font-size: 20px;
          font-weight: 700;
          color: #06b6d4;
        }
        .cb-mini-divider {
          height: 1px;
          background: rgba(6,182,212, 0.12);
        }
        .cb-icon-box {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(70, 114, 236, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          color: #4672ec;
        }
        .cb-cost-cards-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }
        .cb-prevent-grid {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 20px;
        }
        .cb-prevent-card {
          flex: 0 1 calc(33.33% - 14px);
        }

        .cb-results {
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.4s ease;
          pointer-events: none;
          height: 0;
          overflow: hidden;
        }
        .cb-results.cb-results-visible {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
          height: auto;
          overflow: visible;
        }
        .cb-results-panel {
          position: relative;
          margin-top: 32px;
          margin-left: calc(var(--cb-card-pad-x) * -1);
          margin-right: calc(var(--cb-card-pad-x) * -1);
          margin-bottom: calc(var(--cb-card-pad-y) * -1);
          padding: 32px var(--cb-card-pad-x) 44px;
          border-radius: 0 0 20px 20px;
          z-index: 2;
        }
        .cb-results-panel::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255, 0.12), transparent);
        }
        .cb-results-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
        }
        .cb-result-card {
          position: relative;
          border-radius: 16px;
          padding: 24px;
          overflow: hidden;
        }
        .cb-result-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          opacity: 0.6;
        }
        .cb-result-card--loss {
          background: rgba(239,68,68, 0.03);
          border: 1px solid rgba(239,68,68, 0.08);
          opacity: 0.95;
        }
        .cb-result-card--loss::before {
          background: linear-gradient(90deg, transparent, rgba(239,68,68, 0.4), transparent);
        }
        .cb-result-card--gain {
          background: rgba(16,185,129, 0.04);
          border: 1px solid rgba(16,185,129, 0.15);
        }
        .cb-result-card--gain::before {
          background: linear-gradient(90deg, transparent, rgba(16,185,129, 0.5), transparent);
        }
        .cb-result-badge {
          position: absolute;
          top: 16px;
          right: 16px;
          padding: 3px 10px;
          border-radius: 100px;
          background: rgba(16,185,129, 0.12);
          border: 1px solid rgba(16,185,129, 0.2);
          color: #34d399;
          font-size: 10px;
          font-weight: 700;
        }
        .cb-result-hero-line {
          position: absolute;
          top: -1px;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(16,185,129, 0.5), transparent);
          pointer-events: none;
        }
        .cb-result-hero-blur {
          position: absolute;
          top: -30px;
          left: 0;
          right: 0;
          height: 60px;
          background: rgba(16,185,129, 0.08);
          filter: blur(25px);
          pointer-events: none;
        }
        .cb-result-content {
          position: relative;
          z-index: 1;
        }
        .cb-result-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        .cb-result-icon {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cb-result-icon--loss {
          background: rgba(239,68,68, 0.1);
          color: #f87171;
        }
        .cb-result-icon--gain {
          background: rgba(16,185,129, 0.12);
          color: #34d399;
        }
        .cb-result-title {
          font-size: 15px;
          font-weight: 700;
        }
        .cb-result-title--loss {
          color: #f87171;
        }
        .cb-result-title--gain {
          color: #34d399;
        }
        .cb-result-metrics {
          display: grid;
          gap: 20px;
        }
        .cb-result-label {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.6);
        }
        .cb-result-number-large {
          font-size: 24px;
          font-weight: 800;
          line-height: 1.1;
        }
        .cb-result-number-small {
          font-size: 20px;
          font-weight: 700;
          line-height: 1.1;
        }
        .cb-result-months {
          font-size: 28px;
          font-weight: 800;
          color: #f87171;
          line-height: 1.1;
        }
        .cb-result-months-note {
          font-size: 13px;
          font-weight: 400;
          color: rgba(255,255,255, 0.35);
          margin-top: 4px;
        }
        .cb-result-value {
          font-size: 28px;
          font-weight: 700;
        }
        .cb-result-value--loss {
          color: #f87171;
        }
        .cb-result-value--gain {
          color: #34d399;
        }
        .cb-result-divider {
          height: 1px;
          background: rgba(239,68,68, 0.08);
        }
        .cb-result-divider--gain {
          background: rgba(16,185,129, 0.12);
        }
        .cb-result-total {
          font-size: 32px;
          font-weight: 800;
        }
        .cb-result-total--loss {
          color: #f87171;
        }
        .cb-result-total--gain {
          color: #34d399;
        }
        .cb-roi-card {
          margin-top: 24px;
          padding: 16px 20px;
          border-radius: 12px;
          background: rgba(16,185,129, 0.06);
          border: 1px solid rgba(16,185,129, 0.1);
          display: grid;
          gap: 6px;
          text-align: center;
        }
        .cb-roi-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(16,185,129, 0.5);
        }
        .cb-roi-value {
          font-size: 28px;
          font-weight: 800;
          color: #34d399;
        }
        .cb-roi-subtitle {
          font-size: 11px;
          color: rgba(16,185,129, 0.6);
        }

        .cb-cta-primary {
          flex: 1;
          padding: 16px 28px;
          border-radius: 14px;
          background: linear-gradient(135deg, #10b981, #059669);
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          text-align: center;
          box-shadow: 0 4px 20px rgba(16,185,129, 0.25), 0 0 40px rgba(16,185,129, 0.1);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .cb-cta-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(16,185,129, 0.35), 0 0 50px rgba(16,185,129, 0.2);
        }
        .cb-cta-secondary {
          padding: 16px 28px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255, 0.1);
          background: rgba(255,255,255, 0.03);
          color: rgba(255,255,255, 0.7);
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s ease;
        }
        .cb-cta-secondary:hover {
          border-color: rgba(255,255,255, 0.3);
          color: #fff;
        }
        .cb-disclaimer {
          font-size: 11px;
          color: rgba(255,255,255, 0.2);
        }

        .cb-glossary-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .cb-three-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        .cb-steps-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 18px;
        }

        .cb-inline-link {
          color: #fff;
          text-decoration: none;
          border-bottom: 1px dashed rgba(255,255,255,0.4);
        }
        .cb-inline-link:hover {
          color: #06b6d4;
        }

        .cb-range {
          width: 100%;
          height: 6px;
          border-radius: 999px;
          background: rgba(255,255,255, 0.08);
          flex: 1;
          outline: none;
          appearance: none;
          -webkit-appearance: none;
        }
        .cb-range::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, #67e8f9, #06b6d4);
          border: 1px solid rgba(6,182,212, 0.4);
          box-shadow: 0 0 12px rgba(6,182,212, 0.6);
          cursor: pointer;
        }
        .cb-range::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, #67e8f9, #06b6d4);
          border: 1px solid rgba(6,182,212, 0.4);
          box-shadow: 0 0 12px rgba(6,182,212, 0.6);
          cursor: pointer;
        }

        .lp-whatsapp-btn {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 60px;
          height: 60px;
          background: #25D366;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 25px rgba(37, 211, 102, 0.3);
          z-index: 100;
          transition: all 0.3s ease;
          text-decoration: none;
        }
        .lp-whatsapp-btn:hover {
          transform: scale(1.08);
          box-shadow: 0 15px 35px rgba(37, 211, 102, 0.4);
        }
        .lp-whatsapp-btn::before,
        .lp-whatsapp-btn::after {
          content: '';
          position: absolute;
          border: 1px solid rgba(37, 211, 102, 0.3);
          border-radius: 50%;
          animation: pulse 2s linear infinite;
        }
        .lp-whatsapp-btn::after {
          animation-delay: 1s;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        .lp-whatsapp-tooltip {
          position: absolute;
          right: 75px;
          background: #fff;
          color: #333;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 13px;
          white-space: nowrap;
          opacity: 0;
          transform: translateX(10px);
          transition: all 0.3s ease;
        }
        .lp-whatsapp-tooltip::after {
          content: '';
          position: absolute;
          right: -6px;
          top: 50%;
          transform: translateY(-50%);
          border: 6px solid transparent;
          border-left-color: #fff;
          border-right: none;
        }
        .lp-whatsapp-btn:hover .lp-whatsapp-tooltip {
          opacity: 1;
          transform: translateX(0);
        }

        @media (max-width: 1280px) {
          .cb-steps-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 1024px) {
          .lp-nav-desktop {
            gap: 20px;
          }
          .cb-cost-cards-grid {
            grid-template-columns: 1fr;
          }
          .cb-prevent-card {
            flex-basis: 100%;
          }
          .cb-input-grid {
            grid-template-columns: 1fr;
          }
          .cb-cost-grid {
            grid-template-columns: 1fr;
          }
          .cb-results-grid {
            grid-template-columns: 1fr;
          }
          .cb-three-grid {
            grid-template-columns: 1fr;
          }
          .cb-steps-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .lp-nav-desktop {
            display: none;
          }
          .lp-nav-mobile-toggle {
            display: block;
          }
          .cb-calculator-card {
            --cb-card-pad-x: 24px;
            --cb-card-pad-y: 32px;
          }
          .cb-glossary-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .cb-steps-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="lp-noise" />

      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          backgroundColor: scrolled ? 'rgba(5, 5, 8, 0.85)' : 'transparent',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.05)' : 'none',
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img src="/replyna-logo.webp" alt="Replyna" style={{ height: '32px', width: 'auto' }} />
          </a>

          <nav className="lp-nav-desktop">
            <a href="/chargeback" className="lp-nav-link">
              Calculadora
            </a>
            <a href="/#como-funciona" className="lp-nav-link">
              Como funciona
            </a>
            <a href="/#precos" className="lp-nav-link">
              Preços
            </a>
            <a href="/#faq" className="lp-nav-link">
              FAQ
            </a>
            <a href="https://app.replyna.me/login" className="lp-nav-link">
              Entrar
            </a>
            <a
              href="https://www.replyna.me/#precos"
              className="lp-btn-primary"
              style={{
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '10px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Começar agora
            </a>
          </nav>

          <button
            className="lp-nav-mobile-toggle"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 5, 8, 0.98)',
            backdropFilter: 'blur(20px)',
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '48px',
            }}
          >
            <img src="/replyna-logo.webp" alt="Replyna" style={{ height: '32px', width: 'auto' }} />
            <button
              onClick={() => setMobileMenuOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                color: '#fff',
                cursor: 'pointer',
                padding: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Fechar menu"
            >
              <X size={20} />
            </button>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            <a
              href="/chargeback"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: '#fff',
                textDecoration: 'none',
                fontSize: '20px',
                fontWeight: 500,
                padding: '20px 16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s ease',
              }}
            >
              Calculadora
            </a>
            <a
              href="/#como-funciona"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: '#fff',
                textDecoration: 'none',
                fontSize: '20px',
                fontWeight: 500,
                padding: '20px 16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s ease',
              }}
            >
              Como funciona
            </a>
            <a
              href="/#precos"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: '#fff',
                textDecoration: 'none',
                fontSize: '20px',
                fontWeight: 500,
                padding: '20px 16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s ease',
              }}
            >
              Preços
            </a>
            <a
              href="/#faq"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: '#fff',
                textDecoration: 'none',
                fontSize: '20px',
                fontWeight: 500,
                padding: '20px 16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s ease',
              }}
            >
              FAQ
            </a>
            <a
              href="https://app.replyna.me/login"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: '#fff',
                textDecoration: 'none',
                fontSize: '20px',
                fontWeight: 500,
                padding: '20px 16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s ease',
              }}
            >
              Entrar
            </a>
          </nav>

          <a
            href="https://www.replyna.me/#precos"
            className="lp-btn-primary"
            style={{
              color: '#ffffff',
              padding: '18px 24px',
              borderRadius: '14px',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 600,
              textAlign: 'center',
              marginTop: '24px',
            }}
          >
            Começar agora
          </a>
        </div>
      )}

      <section
        id="calculadora"
        style={{
          position: 'relative',
          paddingTop: '140px',
          paddingBottom: '80px',
          overflow: 'hidden',
          background: 'linear-gradient(to bottom, #0c1220 0%, #050508 100%)',
        }}
      >
        <div className="lp-orb lp-orb-1" />
        <div className="lp-orb lp-orb-2" />
        <div className="lp-grid-pattern" />

        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h1
              className="lp-fade-in lp-fade-in-delay-2"
              style={{
                fontSize: 'clamp(32px, 4.5vw, 52px)',
                fontWeight: 800,
                marginBottom: '16px',
                letterSpacing: '-0.02em',
              }}
            >
              Quanto sua loja está perdendo com chargebacks?
            </h1>
            <p
              className="lp-fade-in lp-fade-in-delay-3"
              style={{
                fontSize: '18px',
                color: 'rgba(255,255,255,0.5)',
                maxWidth: '680px',
                margin: '0 auto',
                lineHeight: 1.6,
              }}
            >
              Descubra em segundos o impacto real dos chargebacks na sua operação.
            </p>
          </div>

          <div className="lp-glass" style={{ padding: '32px', borderRadius: '24px' }}>
            <div className="cb-input-grid">
              <div className="cb-field-group cb-currency-select" ref={currencyDropdownRef}>
                <span className="cb-field-label">Moeda</span>
                <button
                  type="button"
                  className="cb-currency-button"
                  onClick={() => setCurrencyMenuOpen((open) => !open)}
                >
                  <span className="cb-currency-info">
                    <span className="cb-currency-flag">{selectedCurrencyOption.flag}</span>
                    <span>
                      {selectedCurrencyOption.code} ({selectedCurrencyOption.symbol})
                    </span>
                  </span>
                  <ChevronDown size={16} />
                </button>
                {currencyMenuOpen && (
                  <div className="cb-currency-menu">
                    <input
                      className="cb-currency-search"
                      type="text"
                      placeholder="Buscar país ou moeda"
                      value={currencyQuery}
                      onChange={(event) => setCurrencyQuery(event.target.value)}
                      autoFocus
                    />
                    <div className="cb-currency-list">
                      {filteredCurrencies.length === 0 && (
                        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', padding: '8px 4px' }}>
                          Nenhuma moeda encontrada.
                        </div>
                      )}
                      {filteredCurrencies.map((option) => (
                        <button
                          type="button"
                          key={option.code}
                          className={`cb-currency-option ${option.code === selectedCurrency ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedCurrency(option.code)
                            setCurrencyMenuOpen(false)
                            setCurrencyQuery('')
                          }}
                        >
                          <span className="cb-currency-flag">{option.flag}</span>
                          <div className="cb-currency-meta">
                            <span>
                              {option.code} ({option.symbol})
                            </span>
                            <span className="cb-currency-country">{option.countryName}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="cb-field-group">
                <span className="cb-field-label">
                  <GlossaryLink id="glossario-ticket-medio">Ticket médio</GlossaryLink> ({selectedCurrencyOption.symbol})
                </span>
                <input
                  className="cb-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 150"
                  value={ticketMedioInput}
                  onChange={(event) => setTicketMedioInput(event.target.value)}
                />
              </div>

              <div className="cb-field-group">
                <span className="cb-field-label">Pedidos por mês</span>
                <input
                  className="cb-input"
                  type="number"
                  inputMode="numeric"
                  placeholder="Ex: 500"
                  value={pedidosInput}
                  onChange={(event) => setPedidosInput(event.target.value)}
                />
              </div>

              <div className="cb-field-group">
                <span className="cb-field-label">Taxa de chargeback atual</span>
                <div className="cb-slider-row">
                  <input
                    className="cb-range"
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={sliderValue}
                    onChange={(event) => setTaxaInput(event.target.value)}
                    style={{ background: sliderBackground }}
                  />
                  <span className="cb-slider-badge">{formatPercent(sliderValue)}%</span>
                </div>
                <p className="cb-helper-text">Shopify → Configurações → Payments → Ver repasses</p>
              </div>
            </div>

            <div className="cb-divider" />

            <div className="cb-cost-grid">
              <div className="cb-field-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="cb-field-label">
                    Custo médio por chargeback ({selectedCurrencyOption.symbol})
                  </span>
                  <span
                    className="cb-info-badge"
                    title="Inclui taxa do gateway (geralmente $15-25 USD) + custo do produto perdido + tempo operacional"
                  >
                    info
                  </span>
                </div>
                <input
                  className="cb-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 25"
                  value={custoInput}
                  onChange={(event) => setCustoInput(event.target.value)}
                />
                <p className="cb-helper-text">
                  Inclui taxa do <GlossaryLink id="glossario-gateway">gateway</GlossaryLink> + custo do produto + tempo
                  operacional. Se não souber, {formatCurrency(25)} é estimativa conservadora.
                </p>
              </div>

            </div>

            <div className={`cb-results ${shouldShowResults ? 'cb-results-visible' : ''}`}>
              <div style={{ marginTop: '36px' }}>
                <div className="cb-results-grid">
                  <div className="lp-card-shine cb-result-card cb-result-card--loss">
                    <div className="cb-result-content">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <TrendingDown size={20} color="#ef4444" />
                        <span className="cb-result-title" style={{ color: '#ef4444' }}>
                          Seu prejuízo atual
                        </span>
                      </div>
                      <div style={{ display: 'grid', gap: '12px' }}>
                        <div>
                          <div className="cb-result-label">Chargebacks estimados/mês</div>
                          <div className="cb-result-number-large" style={{ color: '#f87171' }}>
                            {formatCount(calculatorData.chargebacksPorMes)}
                          </div>
                        </div>
                        <div>
                          <div className="cb-result-label">Prejuízo mensal</div>
                          <div className="cb-result-number-large" style={{ color: '#ef4444' }}>
                            {formatCurrency(calculatorData.prejuizoMensal)}
                          </div>
                        </div>
                      <div>
                        <div className="cb-result-label">Prejuízo anual</div>
                        <div className="cb-result-number-small" style={{ color: '#fca5a5' }}>
                          {formatCurrency(calculatorData.prejuizoAnual)}
                        </div>
                      </div>
                      <div className="cb-result-divider" style={{ marginTop: '20px' }} />
                      <div style={{ marginTop: '20px' }}>
                        <div className="cb-result-label">Com esse valor você pagaria</div>
                        <div className="cb-result-months">{mesesReplyna}</div>
                        <div className="cb-result-months-note">meses de Replyna</div>
                      </div>
                    </div>
                  </div>
                  </div>

                  <div className="lp-card-shine cb-result-card cb-result-card--gain">
                    <div className="cb-result-hero-line" />
                    <div className="cb-result-hero-blur" />
                    <div className="cb-result-badge">até 91% redução</div>
                    <div className="cb-result-content">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <TrendingUp size={20} color="#22c55e" />
                        <span className="cb-result-title" style={{ color: '#22c55e' }}>
                          Com pós-venda automatizado
                        </span>
                      </div>
                      <div style={{ display: 'grid', gap: '12px' }}>
                        <div>
                          <div className="cb-result-label">Chargebacks evitados/mês</div>
                          <div className="cb-result-number-large" style={{ color: '#22c55e' }}>
                            {formatCount(calculatorData.chargebacksEvitados)}
                          </div>
                        </div>
                        <div>
                          <div className="cb-result-label">Economia mensal</div>
                          <div className="cb-result-number-large" style={{ color: '#22c55e' }}>
                            {formatCurrency(calculatorData.economiaMensal)}
                          </div>
                        </div>
                        <div>
                          <div className="cb-result-label">Economia anual</div>
                          <div className="cb-result-number-small" style={{ color: '#86efac' }}>
                            {formatCurrency(calculatorData.economiaAnual)}
                          </div>
                        </div>
                      </div>
                      <div className="cb-roi-card">
                        <div className="cb-roi-label">ROI</div>
                        <div className="cb-roi-value">{formatRatio(calculatorData.roiReplyna)}x</div>
                        <div className="cb-roi-subtitle">Lucro líquido desde o primeiro mês</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '28px',
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <a
                    href="https://www.replyna.me/#como-funciona"
                    className="lp-btn-secondary"
                    style={{
                      color: '#fff',
                      padding: '12px 20px',
                      borderRadius: '12px',
                      textDecoration: 'none',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    Ver como funciona →
                  </a>
                </div>
                <p
                  style={{
                    marginTop: '12px',
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.45)',
                    textAlign: 'center',
                  }}
                >
                  * Baseado em caso real. Resultados podem variar de acordo com o volume e tipo de operação.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="lp-section-divider" />

      <article style={{ padding: '80px 24px' }}>
        <section id="o-que-e" style={{ maxWidth: '1100px', margin: '0 auto 80px' }}>
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px' }}>O que é chargeback?</h2>
            <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
              Chargeback é quando o cliente contesta uma compra diretamente com o banco ou operadora do cartão, pedindo o
              dinheiro de volta. Em vez de falar com a loja, ele liga para o banco e diz que não reconhece a cobrança — ou
              que o produto não chegou, veio errado ou não era o que esperava.
            </p>
          </div>

          <div id="como-funciona" style={{ marginBottom: '40px' }}>
            <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px' }}>
              Como acontece um chargeback (passo a passo)
            </h3>
            <div className="cb-steps-grid">
              {[
                {
                  title: 'Cliente aciona o banco',
                  desc: 'O cliente entra em contato com o banco e pede a contestação da compra.',
                  icon: <PhoneCall size={24} />,
                },
                {
                  title: 'Disputa é aberta',
                  desc: (
                    <>
                      O banco abre a disputa e notifica o <GlossaryLink id="glossario-gateway">gateway</GlossaryLink>{' '}
                      de pagamento.
                    </>
                  ),
                  icon: <Bell size={24} />,
                },
                {
                  title: 'Valor é debitado',
                  desc: (
                    <>
                      O <GlossaryLink id="glossario-gateway">gateway</GlossaryLink> debita automaticamente o valor da venda
                      + taxa.
                    </>
                  ),
                  icon: <CreditCard size={24} />,
                },
                {
                  title: 'Lojista envia provas',
                  desc: 'Você tem de 7 a 21 dias para comprovar a venda legítima.',
                  icon: <FileText size={24} />,
                },
                {
                  title: 'Bandeira decide',
                  desc: 'A operadora analisa as provas e decide em até 75 dias.',
                  icon: <Clock size={24} />,
                },
              ].map((step, index) => (
                <div key={step.title} style={{ position: 'relative', paddingTop: '12px' }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #4672ec 0%, #8b5cf6 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      boxShadow: '0 4px 15px rgba(70, 114, 236, 0.4)',
                      zIndex: 10,
                    }}
                  >
                    {index + 1}
                  </div>
                  <div className="lp-card-shine lp-gradient-border" style={{ padding: '26px 20px', height: '100%' }}>
                    <div
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, rgba(70, 114, 236, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '8px auto 16px',
                        color: '#4672ec',
                      }}
                    >
                      {step.icon}
                    </div>
                    <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>
                      {step.title}
                    </h4>
                    <p
                      style={{
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.45)',
                        lineHeight: 1.5,
                        textAlign: 'center',
                      }}
                    >
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px' }}>
              Chargeback, estorno e reembolso: qual a diferença?
            </h3>
            <div className="cb-three-grid">
              <div className="lp-card-shine lp-gradient-border" style={{ padding: '28px' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    padding: '8px 14px',
                    borderRadius: '50px',
                    marginBottom: '18px',
                  }}
                >
                  <CheckCircle2 size={14} color="#22c55e" />
                  <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>REEMBOLSO</span>
                </div>
                <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                  A loja devolve o dinheiro voluntariamente. O cliente pediu, a loja concordou e processou. Sem taxa extra,
                  sem disputa, sem dor de cabeça. É o cenário ideal.
                </p>
              </div>

              <div className="lp-card-shine lp-gradient-border" style={{ padding: '28px' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'rgba(234, 179, 8, 0.12)',
                    padding: '8px 14px',
                    borderRadius: '50px',
                    marginBottom: '18px',
                  }}
                >
                  <RefreshCcw size={14} color="#eab308" />
                  <span style={{ fontSize: '12px', color: '#eab308', fontWeight: 600 }}>ESTORNO</span>
                </div>
                <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                O <GlossaryLink id="glossario-gateway">gateway</GlossaryLink> ou o banco reverte a transação por erro
                técnico. Cobrança duplicada, valor errado ou falha no processamento. Não foi iniciado pelo cliente como
                reclamação — foi um problema do sistema.
                </p>
              </div>

              <div className="lp-card-shine lp-gradient-border" style={{ padding: '28px' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    padding: '8px 14px',
                    borderRadius: '50px',
                    marginBottom: '18px',
                  }}
                >
                  <AlertTriangle size={14} color="#ef4444" />
                  <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600 }}>CHARGEBACK</span>
                </div>
                <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                  O cliente vai direto ao banco sem falar com a loja. O banco força a devolução, cobra uma taxa do lojista
                  ($15 USD na Shopify Payments) e o episódio fica registrado no histórico da loja. Mesmo que a disputa seja
                  vencida, ela conta na taxa de chargebacks.
                </p>
              </div>
            </div>

            <p style={{ marginTop: '20px', fontSize: '15px', color: 'rgba(255,255,255,0.5)' }}>
              O cliente tem até 120 dias depois da compra para abrir um chargeback na maioria dos casos. Ou seja, uma venda
              que você fez há 4 meses pode virar chargeback hoje.
            </p>
          </div>
        </section>

        <section id="tipos" style={{ maxWidth: '1100px', margin: '0 auto 80px' }}>
          <h2 style={{ fontSize: '30px', fontWeight: 800, marginBottom: '12px' }}>Tipos de chargeback</h2>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: '24px' }}>
            Existem 3 tipos principais:
          </p>
          <div style={{ display: 'grid', gap: '16px' }}>
            <div className="lp-glass" style={{ padding: '18px 22px', borderRadius: '16px' }}>
              <strong style={{ fontSize: '16px' }}>Fraude real</strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                O cartão foi roubado ou clonado e alguém fez uma compra sem o dono saber. Esse é o caso mais óbvio, mas
                representa a minoria dos chargebacks no e-commerce.
              </p>
            </div>
            <div className="lp-glass" style={{ padding: '18px 22px', borderRadius: '16px' }}>
              <strong style={{ fontSize: '16px' }}>
                Fraude amigável (<GlossaryLink id="glossario-friendly-fraud">friendly fraud</GlossaryLink>)
              </strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                O próprio dono do cartão fez a compra, recebeu o produto, mas contesta dizendo que não reconhece a cobrança.
                Às vezes é esquecimento, às vezes má-fé, e em muitos casos é falta de contato com a loja a tempo.
              </p>
            </div>
            <div className="lp-glass" style={{ padding: '18px 22px', borderRadius: '16px' }}>
              <strong style={{ fontSize: '16px' }}>Erro do lojista</strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                Cobrança duplicada, produto diferente do anunciado, entrega que não aconteceu sem comunicação ou política de
                devolução confusa.
              </p>
            </div>
          </div>

          <p style={{ marginTop: '18px', fontSize: '15px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
            O dado mais importante: 71% dos chargebacks não são fraude verdadeira. São falhas de comunicação entre a loja e
            o cliente. Quando você responde em poucas horas, o cliente resolve com você — quando não, ele liga para o banco.
          </p>
        </section>

        <section id="custos" style={{ maxWidth: '1100px', margin: '0 auto 80px' }}>
          <h2 style={{ fontSize: '30px', fontWeight: 800, marginBottom: '12px' }}>
            Quanto custa um chargeback para sua loja?
          </h2>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: '24px' }}>
            O prejuízo de um chargeback vai muito além do valor da venda. Quando um chargeback acontece, o lojista perde em
            quatro frentes ao mesmo tempo:
          </p>

          <div className="cb-cost-cards-grid">
            <div className="lp-card-shine lp-gradient-border" style={{ padding: '26px 24px' }}>
              <div className="cb-icon-box">
                <CreditCard size={22} />
              </div>
              <strong>O valor da venda + custo do produto</strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                O banco devolve o dinheiro para o cliente. Você já pagou o fornecedor e já despachou. Então perdeu duas
                vezes: o que pagou pelo produto e o que o cliente pagou por ele. Se o ticket era R$150 e o custo foi R$40,
                você não perdeu R$150 — perdeu R$190.
              </p>
              <p style={{ marginTop: '10px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                O seu <GlossaryLink id="glossario-ticket-medio">ticket médio</GlossaryLink> ajuda a dimensionar esse
                prejuízo com precisão.
              </p>
            </div>
            <div className="lp-card-shine lp-gradient-border" style={{ padding: '26px 24px' }}>
              <div className="cb-icon-box">
                <FileText size={22} />
              </div>
              <strong>A taxa do <GlossaryLink id="glossario-gateway">gateway</GlossaryLink></strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                A Shopify Payments cobra $15 USD por cada chargeback disputado. Se você ganhar a disputa, a taxa é devolvida
                junto com o valor no próximo repasse. Se perder, fica com o prejuízo da taxa + venda + custo do produto.
                Outros <GlossaryLink id="glossario-gateway">gateways</GlossaryLink> cobram entre $15 e $25 USD com regras
                similares.{' '}
                <a
                  className="cb-inline-link"
                  href="https://help.shopify.com/en/manual/payments/chargebacks"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Fonte
                </a>
              </p>
            </div>
            <div className="lp-card-shine lp-gradient-border" style={{ padding: '26px 24px' }}>
              <div className="cb-icon-box">
                <Clock size={22} />
              </div>
              <strong>Custo operacional</strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                Cada disputa exige tempo: reunir comprovantes, montar argumentação, enviar para o{' '}
                <GlossaryLink id="glossario-gateway">gateway</GlossaryLink>, acompanhar prazo. Uma disputa pode levar de 30
                minutos a 2 horas de trabalho.
              </p>
            </div>
            <div className="lp-card-shine lp-gradient-border" style={{ padding: '26px 24px' }}>
              <div className="cb-icon-box">
                <AlertTriangle size={22} />
              </div>
              <strong>Dano acumulativo na conta Shopify Payments</strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                Este é o prejuízo invisível e mais perigoso. A Shopify monitora a porcentagem de chargebacks em relação ao
                total de pedidos da sua loja. Quando essa porcentagem sobe, começa uma escada de consequências.
              </p>
              <ul style={{ marginTop: '12px', paddingLeft: '18px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
                <li>
                  Primeiro, a conta entra em restrição e a Shopify passa a reter parte dos repasses como reserva de
                  segurança.
                </li>
                <li>
                  Depois, seus repasses podem ser congelados. Se a operação depende desse fluxo para pagar fornecedor,
                  anúncio e estoque, tudo trava.
                </li>
                <li>
                  Em casos graves, a Shopify desativa o Shopify Payments. Você perde o processamento nativo e precisa
                  migrar para <GlossaryLink id="glossario-gateway">gateways</GlossaryLink> alternativos com taxas maiores.
                </li>
              </ul>
              <p style={{ marginTop: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                Para <GlossaryLink id="glossario-merchant">merchants</GlossaryLink> novos, o{' '}
                <GlossaryLink id="glossario-settlement">settlement</GlossaryLink> pode começar em até 7 dias úteis. Contas
                em risco podem entrar em <GlossaryLink id="glossario-rolling-reserve">rolling reserve</GlossaryLink>, onde
                uma porcentagem de cada venda fica retida por 30 a 90 dias. Em alguns países o repasse padrão já é em{' '}
                <GlossaryLink id="glossario-d3">D+3</GlossaryLink>.
              </p>
            </div>
          </div>

          <div
            className="lp-glass"
            style={{
              padding: '24px 28px',
              borderRadius: '16px',
              marginTop: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <p
              style={{
                fontSize: '15px',
                color: 'rgba(255,255,255,0.7)',
                lineHeight: 1.6,
                margin: 0,
                flex: 1,
                minWidth: '280px',
              }}
            >
              Na prática: chargeback não é só perder R$150 de uma venda. É um problema que se acumula silenciosamente até o
              dia em que sua conta trava. Se quer saber exatamente quanto sua loja está perdendo, use a calculadora
              gratuita no topo desta página.
            </p>
            <a
              href="#calculadora"
              className="lp-btn-primary"
              style={{
                color: '#fff',
                padding: '12px 24px',
                borderRadius: '12px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
              }}
            >
              Calcular meu prejuízo
              <ArrowRight size={16} />
            </a>
          </div>
        </section>

        <section id="limite" style={{ maxWidth: '1100px', margin: '0 auto 80px' }}>
          <h2 style={{ fontSize: '30px', fontWeight: 800, marginBottom: '12px' }}>
            Taxa de chargeback: qual o limite aceitável?
          </h2>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: '24px' }}>
            Cada bandeira e <GlossaryLink id="glossario-gateway">gateway</GlossaryLink> monitora a porcentagem de
            chargebacks em relação ao total de transações da sua loja. Se você processou 1.000 pedidos e recebeu 10
            chargebacks, sua <GlossaryLink id="glossario-chargeback-ratio">chargeback ratio</GlossaryLink> é de 1%. Passar
            do limite de cada bandeira coloca o <GlossaryLink id="glossario-merchant">merchant</GlossaryLink> em programas
            de monitoramento
            com multas progressivas — e em casos graves, sua conta é encerrada.
          </p>

          <div className="cb-three-grid">
            <div className="lp-card-shine lp-gradient-border" style={{ padding: '26px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
                Visa (<GlossaryLink id="glossario-vamp">VAMP</GlossaryLink>)
              </h3>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                Desde abril de 2025, a Visa unificou seus programas de monitoramento (VDMP e VFMP) em um único programa
                chamado <GlossaryLink id="glossario-vamp">VAMP</GlossaryLink>. Um{' '}
                <GlossaryLink id="glossario-merchant">merchant</GlossaryLink> é classificado como "Excessive" quando a VAMP
                Ratio ultrapassa 1.5%, com mínimo de 1.500 disputas no mês. A partir de abril de 2026, esse limite cai para
                0.9% nos EUA, Canadá e Europa. Multa: $10 USD por disputa para{' '}
                <GlossaryLink id="glossario-merchant">merchants</GlossaryLink> na categoria Excessive.{' '}
                <a
                  className="cb-inline-link"
                  href="https://corporate.visa.com/content/dam/VCOM/corporate/visa-perspectives/security-and-trust/documents/visa-acquirer-monitoring-program-fact-sheet-2025.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Fonte
                </a>
              </p>
            </div>
            <div className="lp-card-shine lp-gradient-border" style={{ padding: '26px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
                Mastercard (<GlossaryLink id="glossario-ecm">ECM</GlossaryLink>)
              </h3>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                Entra no Excessive Chargeback <GlossaryLink id="glossario-merchant">Merchant</GlossaryLink> quando a taxa
                de chargebacks ultrapassa 1.5% do total de transações ou quando ultrapassa 100 chargebacks no mês (o que
                vier primeiro). Multas começam em $1.000 e podem chegar a $200.000 USD dependendo de quanto tempo o{' '}
                <GlossaryLink id="glossario-merchant">merchant</GlossaryLink> fica no programa sem resolver.{' '}
                <a
                  className="cb-inline-link"
                  href="https://developer.paypal.com/braintree/articles/risk-and-security/card-brand-monitoring-programs/mastercard-programs/excessive-chargeback-program"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Fonte
                </a>
              </p>
            </div>
            <div className="lp-card-shine lp-gradient-border" style={{ padding: '26px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Shopify Payments</h3>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                A Shopify é a mais restritiva na prática para lojistas brasileiros. Ela monitora a porcentagem de
                chargebacks sobre o total de pedidos e pode colocar a conta em restrição quando essa porcentagem fica
                elevada por um período continuado. As consequências incluem retenção de repasses, análise manual de
                transações e desativação completa do Shopify Payments.{' '}
                <a
                  className="cb-inline-link"
                  href="https://help.shopify.com/en/manual/payments/chargebacks"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Fonte
                </a>
              </p>
            </div>
          </div>

          <p style={{ marginTop: '20px', fontSize: '15px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
            <strong>Qual taxa manter?</strong> Recomendamos ficar abaixo de 0.5% do total de transações. Isso significa: se
            você processa 1.000 pedidos no mês, no máximo 5 chargebacks. Essa margem mantém sua conta saudável com todas as
            bandeiras e longe de qualquer programa de monitoramento.
          </p>
        </section>

        <section id="prevenir" style={{ maxWidth: '1100px', margin: '0 auto 80px' }}>
          <h2 style={{ fontSize: '30px', fontWeight: 800, marginBottom: '12px' }}>
            Como prevenir chargebacks no e-commerce
          </h2>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: '24px' }}>
            A maioria dos chargebacks pode ser evitada antes de acontecer. As 5 práticas mais eficazes:
          </p>
          <div className="cb-prevent-grid">
            <div className="lp-card-shine lp-gradient-border cb-prevent-card" style={{ padding: '26px 24px' }}>
              <div className="cb-icon-box">
                <Clock size={22} />
              </div>
              <strong>Responder rápido:</strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                lojas que respondem emails em menos de 2 horas reduzem chargebacks em até 40%. Quem recebe resposta rápida
                resolve com a loja.
              </p>
            </div>
            <div className="lp-card-shine lp-gradient-border cb-prevent-card" style={{ padding: '26px 24px' }}>
              <div className="cb-icon-box">
                <MapPin size={22} />
              </div>
              <strong>Rastreamento visível:</strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                envie código de rastreio atualizado de forma proativa. A maioria dos chargebacks por “produto não recebido”
                acontece por falta de informação.
              </p>
            </div>
            <div className="lp-card-shine lp-gradient-border cb-prevent-card" style={{ padding: '26px 24px' }}>
              <div className="cb-icon-box">
                <RefreshCcw size={22} />
              </div>
              <strong>Política de devolução clara:</strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                quando o cliente sabe que pode devolver fácil, ele devolve pela loja. Se não sabe, abre chargeback.
              </p>
            </div>
            <div className="lp-card-shine lp-gradient-border cb-prevent-card" style={{ padding: '26px 24px' }}>
              <div className="cb-icon-box">
                <ImageIcon size={22} />
              </div>
              <strong>Descrição de produto precisa:</strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                fotos reais, medidas corretas e especificações detalhadas. Chargeback por “produto diferente” é 100%
                evitável.
              </p>
            </div>
            <div className="lp-card-shine lp-gradient-border cb-prevent-card" style={{ padding: '26px 24px' }}>
              <div className="cb-icon-box">
                <Zap size={22} />
              </div>
              <strong>Pós-venda automatizado com IA:</strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                ferramentas como a Replyna respondem emails em menos de 2 minutos com dados reais do pedido, 24 horas por
                dia. Esse pós-venda automatizado ajuda a prevenir chargebacks antes que o cliente abra uma disputa.
              </p>
            </div>
          </div>
        </section>

        <section id="caso-real" style={{ maxWidth: '1100px', margin: '0 auto 80px' }}>
          <h2 style={{ fontSize: '30px', fontWeight: 800, marginBottom: '12px' }}>
            Caso real: de 47 para 4 chargebacks em 30 dias
          </h2>
          <div className="lp-glass" style={{ padding: '28px', borderRadius: '20px' }}>
            <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
              Uma operação de e-commerce com múltiplas lojas Shopify estava recebendo 47 chargebacks por mês. A conta
              Shopify Payments estava em risco de desativação. O tempo médio de resposta aos emails era de 8 a 12 horas —
              tempo suficiente para o cliente desistir e ligar para o banco.
            </p>
            <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginTop: '16px' }}>
              Depois de implementar a Replyna como pós-venda automatizado, o tempo de resposta caiu para menos de 2 minutos.
              A IA passou a responder 100% dos emails automaticamente, em qualquer idioma, consultando dados reais do
              pedido na Shopify (status, rastreio e prazo de entrega).
            </p>
            <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginTop: '16px' }}>
              Em 30 dias, neste caso real, os chargebacks caíram de 47 para 4. Redução de 91%. A conta Shopify Payments
              saiu da zona de risco e permaneceu ativa. O custo do pós-venda automatizado foi R$197/mês no plano Starter,
              evitando mais de R$15.000/mês em prejuízo.
            </p>
            <a
              href={getAppUrl('/register?plan=starter')}
              className="lp-btn-primary"
              style={{
                marginTop: '20px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                borderRadius: '12px',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Quer o mesmo resultado? Comece agora por R$197/mês
              <ArrowRight size={16} />
            </a>
          </div>
        </section>

        <section id="glossario" style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '10px' }}>
              Termos utilizados nesta página
            </h2>
            <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)' }}>
              Explicamos cada termo técnico para você não ficar com dúvida
            </p>
          </div>

          <div className="lp-glass" style={{ padding: '24px', borderRadius: '24px' }}>
            <div className="cb-glossary-grid">
              {glossaryItems.map((item) => (
                <div
                  key={item.id}
                  id={item.id}
                  className="lp-gradient-border"
                  style={{ padding: '18px 20px' }}
                >
                  <strong style={{ fontSize: '15px' }}>{item.term}</strong>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '8px', lineHeight: 1.6 }}>
                    {item.definition}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="precos" style={{ maxWidth: '1100px', margin: '80px auto 0', textAlign: 'center' }}>
          <h2 style={{ fontSize: '34px', fontWeight: 800, marginBottom: '16px' }}>
            Reduza chargebacks ainda este mês
          </h2>
          <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.5)', marginBottom: '32px' }}>
            Comece agora e veja seus chargebacks despencarem com atendimento imediato e inteligente.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href={getLandingUrl('/#precos')}
              onClick={handlePricingClick}
              className="lp-btn-primary"
              style={{
                color: '#fff',
                padding: '16px 32px',
                borderRadius: '14px',
                textDecoration: 'none',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              Ver planos
              <ArrowRight size={16} />
            </a>
          </div>
        </section>

        <section id="faq-chargeback" style={{ maxWidth: '1100px', margin: '80px auto 0' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '10px' }}>
              Perguntas frequentes sobre chargeback
            </h2>
            <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)' }}>
              As dúvidas mais comuns respondidas de forma direta
            </p>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            {faqItems.map((item, index) => (
              <div
                key={index}
                className="lp-glass"
                style={{
                  borderRadius: '16px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s ease',
                  borderColor: openFaq === index ? 'rgba(70, 114, 236, 0.3)' : undefined,
                }}
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
              >
                <div
                  style={{
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                  }}
                >
                  <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
                    {item.question}
                  </h3>
                  <ChevronDown
                    size={20}
                    style={{
                      color: 'rgba(255,255,255,0.4)',
                      transition: 'transform 0.3s ease',
                      transform: openFaq === index ? 'rotate(180deg)' : 'rotate(0deg)',
                      flexShrink: 0,
                    }}
                  />
                </div>
                <div
                  style={{
                    maxHeight: openFaq === index ? '200px' : '0px',
                    overflow: 'hidden',
                    transition: 'max-height 0.3s ease',
                  }}
                >
                  <p
                    style={{
                      padding: '0 24px 20px',
                      fontSize: '15px',
                      color: 'rgba(255,255,255,0.5)',
                      lineHeight: 1.7,
                      margin: 0,
                    }}
                  >
                    {item.answer}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </article>

      <footer
        style={{
          padding: '40px 24px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          marginTop: '80px',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <img src="/replyna-logo.webp" alt="Replyna" style={{ height: '28px', width: 'auto', opacity: 0.6 }} />
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.3)' }}>
            © {new Date().getFullYear()} Replyna. Todos os direitos reservados.
          </div>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <a
              href="/"
              style={{
                color: 'rgba(255,255,255,0.3)',
                textDecoration: 'none',
                fontSize: '14px',
                transition: 'color 0.2s',
              }}
            >
              Home
            </a>
            <a
              href="/privacidade"
              style={{
                color: 'rgba(255,255,255,0.3)',
                textDecoration: 'none',
                fontSize: '14px',
                transition: 'color 0.2s',
              }}
            >
              Privacidade
            </a>
          </div>
        </div>
      </footer>

      <a
        href={`https://wa.me/5531973210191?text=${encodeURIComponent('Olá! Gostaria de saber mais sobre a Replyna.')}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Fale conosco pelo WhatsApp"
        className="lp-whatsapp-btn"
      >
        <span className="lp-whatsapp-tooltip">Fale conosco</span>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>
    </div>
  )
}
```

---

## 6) src/pages/admin/AdminClients.tsx

```tsx
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
```

---

## 7) src/pages/Account.tsx

```tsx
import { useMemo, useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { supabase } from '../lib/supabase'
import { useTheme } from '../context/ThemeContext'

interface UserProfile {
  name: string | null
  email: string | null
  plan: string | null
  emails_limit: number | null
  emails_used: number | null
  shops_limit: number | null
  created_at: string | null
  extra_emails_purchased: number | null // Total de emails extras comprados
  extra_emails_used: number | null // Total de emails extras usados
  extra_email_price: number | null // Preço por email extra (do plano)
  extra_email_package_size: number | null // Tamanho do pacote de emails extras (do plano)
  whatsapp_number: string | null
}

interface Plan {
  id: string
  name: string
  description: string | null
  price_monthly: number
  price_yearly: number | null
  emails_limit: number | null  // null = ilimitado
  shops_limit: number | null   // null = ilimitado
  features: string[]
  is_popular: boolean
}

interface PendingInvoice {
  id: string
  asaas_invoice_url: string | null
  package_size: number
  total_amount: number
  status: string
  created_at: string
}

interface SubscriptionInfo {
  current_period_end: string | null
  status: string | null
}

const formatNumber = (value: number) =>
  new Intl.NumberFormat('pt-BR').format(value)

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)

const calculateRenewalDate = (createdAt: string | null) => {
  if (!createdAt) return null
  const created = new Date(createdAt)
  const today = new Date()
  const renewal = new Date(created)
  while (renewal <= today) {
    renewal.setMonth(renewal.getMonth() + 1)
  }
  return renewal
}

const Skeleton = ({ height = 16, width = '100%' }: { height?: number | string; width?: number | string }) => (
  <div
    style={{
      width,
      height,
      backgroundColor: 'var(--border-color)',
      borderRadius: 8,
      animation: 'replyna-pulse 1.6s ease-in-out infinite',
    }}
  />
)

export default function Account() {
  console.log('🔄 Account.tsx carregado - versão 3 (com sync fix)')
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const isMobile = useIsMobile()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [emailChangeLoading, setEmailChangeLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [countryCode, setCountryCode] = useState('+55')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [shopsCount, setShopsCount] = useState<number>(0)

  const countryCodes = [
    { code: '+55', label: 'BR +55' },
    { code: '+1', label: 'US +1' },
    { code: '+351', label: 'PT +351' },
    { code: '+44', label: 'UK +44' },
    { code: '+49', label: 'DE +49' },
    { code: '+33', label: 'FR +33' },
    { code: '+39', label: 'IT +39' },
    { code: '+34', label: 'ES +34' },
    { code: '+31', label: 'NL +31' },
    { code: '+48', label: 'PL +48' },
    { code: '+420', label: 'CZ +420' },
    { code: '+43', label: 'AT +43' },
    { code: '+41', label: 'CH +41' },
    { code: '+32', label: 'BE +32' },
    { code: '+46', label: 'SE +46' },
    { code: '+47', label: 'NO +47' },
    { code: '+45', label: 'DK +45' },
    { code: '+358', label: 'FI +358' },
    { code: '+353', label: 'IE +353' },
    { code: '+61', label: 'AU +61' },
    { code: '+64', label: 'NZ +64' },
    { code: '+91', label: 'IN +91' },
    { code: '+81', label: 'JP +81' },
    { code: '+82', label: 'KR +82' },
    { code: '+86', label: 'CN +86' },
    { code: '+971', label: 'AE +971' },
    { code: '+52', label: 'MX +52' },
    { code: '+54', label: 'AR +54' },
    { code: '+56', label: 'CL +56' },
    { code: '+57', label: 'CO +57' },
    { code: '+507', label: 'PA +507' },
    { code: '+598', label: 'UY +598' },
    { code: '+595', label: 'PY +595' },
    { code: '+27', label: 'ZA +27' },
    { code: '+234', label: 'NG +234' },
    { code: '+90', label: 'TR +90' },
    { code: '+7', label: 'RU +7' },
    { code: '+380', label: 'UA +380' },
    { code: '+30', label: 'GR +30' },
    { code: '+36', label: 'HU +36' },
    { code: '+40', label: 'RO +40' },
    { code: '+359', label: 'BG +359' },
    { code: '+385', label: 'HR +385' },
    { code: '+65', label: 'SG +65' },
    { code: '+60', label: 'MY +60' },
    { code: '+66', label: 'TH +66' },
    { code: '+63', label: 'PH +63' },
    { code: '+62', label: 'ID +62' },
    { code: '+84', label: 'VN +84' },
    { code: '+20', label: 'EG +20' },
    { code: '+212', label: 'MA +212' },
    { code: '+972', label: 'IL +972' },
  ]

  const parsePhoneNumber = (fullNumber: string) => {
    if (!fullNumber) return { code: '+55', number: '' }
    const match = fullNumber.match(/^(\+\d{1,4})\s*(.*)$/)
    if (match) {
      const matchedCode = countryCodes.find(c => c.code === match[1])
      if (matchedCode) return { code: match[1], number: match[2] }
    }
    // Tentar match por códigos mais longos primeiro
    const sorted = [...countryCodes].sort((a, b) => b.code.length - a.code.length)
    for (const c of sorted) {
      if (fullNumber.startsWith(c.code)) {
        return { code: c.code, number: fullNumber.slice(c.code.length).trim() }
      }
    }
    return { code: '+55', number: fullNumber.replace(/^\+/, '') }
  }

  const getFullPhoneNumber = () => {
    const num = phoneNumber.trim()
    if (!num) return ''
    return `${countryCode} ${num}`
  }

  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [plansLoading, setPlansLoading] = useState(false)
  const [changingPlanId, setChangingPlanId] = useState<string | null>(null)

  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([])
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null)
  const [buyingExtras, setBuyingExtras] = useState(false)
  const [openingBillingPortal, setOpeningBillingPortal] = useState(false)
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null)

  // Função para abrir a ultima fatura do Asaas
  const handleOpenBillingPortal = async () => {
    if (!user || openingBillingPortal) return

    setOpeningBillingPortal(true)
    setNotice(null)

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-billing-portal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ user_id: user.id }),
        }
      )

      const data = await response.json()

      if (data.success && data.url) {
        // Abrir ultima fatura
        window.location.href = data.url
      } else {
        throw new Error(data.error || 'Nenhuma fatura encontrada')
      }
    } catch (err) {
      console.error('Erro ao abrir fatura:', err)
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao abrir fatura. Tente novamente.',
      })
    } finally {
      setOpeningBillingPortal(false)
    }
  }

  // Função para comprar emails extras manualmente
  const handleBuyExtraEmails = async () => {
    if (!user || buyingExtras) return

    setBuyingExtras(true)
    setNotice(null)

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/charge-extra-emails`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ user_id: user.id }),
        }
      )

      const data = await response.json()

      if (data.success) {
        setNotice({ type: 'success', message: `Pacote de emails extras comprado com sucesso!` })
        // Recarregar perfil para atualizar créditos
        loadProfile()
      } else if (data.invoice_url) {
        // Invoice criada mas precisa de pagamento manual
        setNotice({ type: 'info', message: 'Fatura criada. Redirecionando para pagamento...' })
        window.open(data.invoice_url, '_blank')
        // Recarregar invoices pendentes
        loadPendingInvoices()
      } else if (data.error) {
        // Traduzir erros comuns para mensagens amigáveis
        const errorMessages: Record<string, string> = {
          'Usuario nao encontrado': 'Não foi possível encontrar sua conta. Faça login novamente.',
          'Usuario nao possui customer_id no Asaas': 'Você precisa ter uma assinatura ativa para comprar emails extras. Entre em contato com o suporte.',
          'Plano nao encontrado': 'Não foi possível identificar seu plano. Entre em contato com o suporte.',
          'Plano nao possui cobranca de emails extras': 'Seu plano não permite compra de emails extras.',
        }

        // Verificar se o erro corresponde a alguma mensagem conhecida
        let friendlyMessage = data.error
        for (const [key, message] of Object.entries(errorMessages)) {
          if (data.error.includes(key)) {
            friendlyMessage = message
            break
          }
        }

        throw new Error(friendlyMessage)
      } else {
        throw new Error('Erro ao processar compra. Tente novamente.')
      }
    } catch (err) {
      console.error('Erro ao comprar emails extras:', err)
      setNotice({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao comprar emails extras. Tente novamente.' })
    } finally {
      setBuyingExtras(false)
    }
  }

  // Detectar retorno do Asaas após adicionar método de pagamento
  useEffect(() => {
    if (!user) return

    const urlParams = new URLSearchParams(window.location.search)
    const upgradePending = urlParams.get('upgrade_pending')
    const planId = urlParams.get('plan_id')
    const billingCycle = urlParams.get('billing_cycle')
    const upgradeCancelled = urlParams.get('upgrade_cancelled')

    // Limpar parâmetros da URL
    if (upgradePending || upgradeCancelled) {
      window.history.replaceState({}, '', window.location.pathname)
    }

    if (upgradeCancelled) {
      setNotice({ type: 'info', message: 'Upgrade cancelado.' })
      return
    }

    if (upgradePending && planId) {
      // Continuar o upgrade após adicionar método de pagamento
      const continueUpgrade = async () => {
        setNotice({ type: 'info', message: 'Continuando o upgrade...' })

        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-subscription`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                user_id: user.id,
                new_plan_id: planId,
                billing_cycle: billingCycle || 'monthly',
              }),
            }
          )

          const result = await response.json()

          if (!response.ok) {
            throw new Error(result.error || 'Erro ao completar upgrade')
          }

          if (result.payment_required && result.payment_url) {
            window.location.href = result.payment_url
            return
          }

          setNotice({ type: 'success', message: 'Upgrade realizado com sucesso!' })

          // Recarregar a página para atualizar os dados
          setTimeout(() => window.location.reload(), 1500)
        } catch (err) {
          console.error('Erro ao continuar upgrade:', err)
          const message = err instanceof Error ? err.message : 'Erro ao completar upgrade'
          setNotice({ type: 'error', message })
        }
      }

      continueUpgrade()
    }
  }, [user])

  const loadProfile = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('name, email, plan, emails_limit, emails_used, shops_limit, created_at, extra_emails_purchased, extra_emails_used, whatsapp_number')
        .eq('id', user.id)
        .maybeSingle()

      if (error) throw error

      // Se não existir registro na tabela users, criar um
      if (!data) {
        const newUserData = {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || null,
          plan: 'Starter',
          emails_limit: 500,
          emails_used: 0,
          shops_limit: 1,
          extra_emails_purchased: 0,
          extra_emails_used: 0,
        }

        const { error: insertError } = await supabase
          .from('users')
          .insert(newUserData)

        if (insertError) {
          console.error('Erro ao criar perfil:', insertError)
        }

        setProfile({
          name: newUserData.name,
          email: newUserData.email || null,
          plan: newUserData.plan,
          emails_limit: newUserData.emails_limit,
          emails_used: newUserData.emails_used,
          shops_limit: newUserData.shops_limit,
          created_at: new Date().toISOString(),
          extra_emails_purchased: newUserData.extra_emails_purchased,
          extra_emails_used: newUserData.extra_emails_used,
          extra_email_price: null,
          extra_email_package_size: null,
          whatsapp_number: null,
        })
        setName(newUserData.name || '')
        setEmail(newUserData.email || '')
      } else {
        setProfile({
          ...data,
          extra_email_price: null,
          extra_email_package_size: null,
          whatsapp_number: data.whatsapp_number || null,
        })
        setName(data.name || user.user_metadata?.name || '')
        setEmail(data.email || user.email || '')
        const parsed = parsePhoneNumber(data.whatsapp_number || '')
        setCountryCode(parsed.code)
        setPhoneNumber(parsed.number)
      }

      // Buscar quantidade de lojas integradas
      const { count: shopsIntegrated } = await supabase
        .from('shops')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      setShopsCount(shopsIntegrated || 0)

      // Buscar preço de email extra do plano atual
      const planName = data?.plan || 'Starter'
      const { data: planData, error: planError } = await supabase
        .from('plans')
        .select('extra_email_price, extra_email_package_size')
        .eq('name', planName)
        .single()

      console.log('Plan lookup:', { planName, planData, planError })

      if (data) {
        setProfile({
          ...data,
          extra_email_price: planData?.extra_email_price ?? 1,
          extra_email_package_size: planData?.extra_email_package_size ?? 100,
          whatsapp_number: data.whatsapp_number || null,
        })
      }
    } catch (err) {
      console.error('Erro ao carregar perfil:', err)
      setNotice({ type: 'error', message: 'Não foi possível carregar suas informações.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    loadProfile()
  }, [user])

  const loadSubscription = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('current_period_end, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      if (data) {
        setSubscriptionInfo({
          current_period_end: data.current_period_end,
          status: data.status,
        })
      }
    } catch (err) {
      console.error('Erro ao carregar assinatura:', err)
    }
  }

  useEffect(() => {
    if (!user) return
    loadSubscription()
  }, [user])

  // Função para carregar invoices pendentes de emails extras
  const loadPendingInvoices = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('email_extra_purchases')
        .select('id, asaas_invoice_url, package_size, total_amount, status, created_at')
        .eq('user_id', user.id)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })

      if (error) throw error
      setPendingInvoices(data || [])
    } catch (err) {
      console.error('Erro ao carregar invoices pendentes:', err)
    }
  }

  useEffect(() => {
    loadPendingInvoices()
  }, [user])

  const renewalDate = useMemo(() => {
    if (subscriptionInfo?.current_period_end) {
      return new Date(subscriptionInfo.current_period_end)
    }
    return calculateRenewalDate(profile?.created_at ?? user?.created_at ?? null)
  }, [subscriptionInfo?.current_period_end, profile?.created_at, user?.created_at])

  const planName = profile?.plan ?? '--'
  const emailsLimit = profile?.emails_limit
  const shopsLimit = profile?.shops_limit

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user) return
    if (!isEditing) return

    setSaving(true)
    setNotice(null)

    try {
      const { error: profileError } = await supabase
        .from('users')
        .update({
          name: name.trim(),
          whatsapp_number: getFullPhoneNumber() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      const { error: metaError } = await supabase.auth.updateUser({
        data: { name: name.trim() },
      })
      if (metaError) throw metaError

      setNotice({ type: 'success', message: 'Informações atualizadas com sucesso.' })
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              name: name.trim(),
              whatsapp_number: getFullPhoneNumber() || null,
            }
          : prev
      )
      setIsEditing(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar alterações.'
      setNotice({ type: 'error', message })
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async () => {
    const targetEmail = email.trim() || user?.email
    if (!targetEmail) return
    setResetLoading(true)
    setNotice(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setNotice({ type: 'success', message: 'Link de redefinição enviado para seu email!' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar link. Tente novamente.'
      setNotice({ type: 'error', message })
    } finally {
      setResetLoading(false)
    }
  }

  const handleEmailChange = async () => {
    const currentEmail = profile?.email || user?.email || ''
    const nextEmail = email.trim()
    if (!nextEmail) {
      setNotice({ type: 'error', message: 'Não encontramos um email cadastrado.' })
      return
    }
    if (currentEmail && nextEmail === currentEmail) {
      setNotice({ type: 'info', message: 'Edite o email acima para enviar o link de confirmação.' })
      return
    }
    setEmailChangeLoading(true)
    setNotice(null)
    try {
      const { error } = await supabase.auth.updateUser({ email: nextEmail })
      if (error) throw error
      setNotice({ type: 'success', message: `Link de confirmação enviado para ${nextEmail}.` })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar email.'
      setNotice({ type: 'error', message })
    } finally {
      setEmailChangeLoading(false)
    }
  }

  const handleToggleEdit = () => {
    if (isEditing) {
      setName(profile?.name || user?.user_metadata?.name || '')
      setEmail(profile?.email || user?.email || '')
      const parsed = parsePhoneNumber(profile?.whatsapp_number || '')
      setCountryCode(parsed.code)
      setPhoneNumber(parsed.number)
      setNotice(null)
    }
    setIsEditing((prev) => !prev)
  }

  const handleCancelPlan = async () => {
    if (!user) return
    setNotice(null)
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ user_id: user.id, reason: cancelReason || null }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao cancelar assinatura')
      }

      setNotice({ type: 'success', message: 'Assinatura cancelada com sucesso.' })
      setShowCancelModal(false)
      setCancelReason('')
      loadProfile()
      loadSubscription()
    } catch (err) {
      console.error('Erro ao cancelar assinatura:', err)
      setNotice({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao cancelar assinatura.' })
    }
  }

  const handleOpenPlanModal = async () => {
    setShowPlanModal(true)
    setPlansLoading(true)
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('id, name, description, price_monthly, price_yearly, emails_limit, shops_limit, features, is_popular')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error
      setPlans(data || [])
    } catch (err) {
      console.error('Erro ao carregar planos:', err)
      setNotice({ type: 'error', message: 'Não foi possível carregar os planos disponíveis.' })
    } finally {
      setPlansLoading(false)
    }
  }

  const handlePayInvoice = async (invoice: PendingInvoice) => {
    if (!user) return
    setPayingInvoiceId(invoice.id)
    setNotice(null)

    try {
      const session = await supabase.auth.getSession()
      const accessToken = session.data.session?.access_token

      if (!accessToken) {
        throw new Error('Sessão expirada. Por favor, faça login novamente.')
      }

      console.log('Pagando invoice:', { purchase_id: invoice.id })

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pay-pending-invoice`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            user_id: user.id,
            purchase_id: invoice.id,
          }),
        }
      )

      console.log('Response status:', response.status)
      const result = await response.json()
      console.log('Response body:', result)

      if (!response.ok) {
        throw new Error(result.error || `Erro ${response.status}: ${response.statusText}`)
      }

      if (result.url) {
        window.location.href = result.url
      } else {
        throw new Error(result.error || 'Erro ao processar pagamento')
      }
    } catch (err: unknown) {
      console.error('Erro ao pagar invoice:', err)
      const message = err instanceof Error ? err.message : 'Erro ao processar pagamento.'

      // Se a fatura não foi encontrada ou já foi paga, recarregar a lista
      if (message.includes('não encontrada') || message.includes('já foi paga')) {
        setNotice({ type: 'success', message: 'Esta fatura já foi paga! Atualizando lista...' })
        await loadPendingInvoices()
        // Recarregar profile para atualizar créditos
        const { data: newProfile } = await supabase
          .from('users')
          .select('name, email, plan, emails_limit, emails_used, shops_limit, created_at, extra_emails_purchased, extra_emails_used, whatsapp_number')
          .eq('id', user.id)
          .single()
        if (newProfile) setProfile({
          ...newProfile,
          extra_email_price: profile?.extra_email_price ?? null,
          extra_email_package_size: profile?.extra_email_package_size ?? null,
        })
      } else {
        setNotice({ type: 'error', message })
      }
    } finally {
      setPayingInvoiceId(null)
    }
  }

  const handleChangePlan = async (plan: Plan) => {
    if (!user) return

    console.log('handleChangePlan chamado:', { planId: plan.id, planName: plan.name, userId: user.id })
    setChangingPlanId(plan.id)
    setNotice(null)

    try {
      console.log('Enviando requisição para update-subscription...')
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            user_id: user.id,
            new_plan_id: plan.id,
          }),
        }
      )

      console.log('Response status:', response.status, response.statusText)
      const result = await response.json()
      console.log('Resposta update-subscription:', result)

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao alterar plano')
      }

      // Se precisa adicionar método de pagamento, redirecionar para checkout
      if (result.requires_payment_method && result.checkout_url) {
        setNotice({
          type: 'info',
          message: 'Redirecionando para adicionar método de pagamento...',
        })
        window.location.href = result.checkout_url
        return
      }

      // Se pagamento está pendente, redirecionar para página de pagamento
      if (result.payment_required && result.payment_url) {
        setNotice({
          type: 'info',
          message: 'Redirecionando para completar o pagamento...',
        })
        window.location.href = result.payment_url
        return
      }

      // Aguardar um pouco para garantir que o banco foi sincronizado
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Recarregar profile do banco para garantir dados sincronizados
      const { data: updatedProfile, error: profileError } = await supabase
        .from('users')
        .select('name, email, plan, emails_limit, emails_used, shops_limit, created_at, extra_emails_purchased, extra_emails_used, whatsapp_number')
        .eq('id', user.id)
        .single()

      console.log('Profile recarregado:', { updatedProfile, profileError })

      if (updatedProfile) {
        setProfile({
          ...updatedProfile,
          extra_email_price: profile?.extra_email_price ?? null,
          extra_email_package_size: profile?.extra_email_package_size ?? null,
        })
      } else if (result.new_plan) {
        // Fallback: atualizar localmente se não conseguir recarregar
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                plan: result.new_plan.name,
                emails_limit: result.new_plan.emails_limit,
                shops_limit: result.new_plan.shops_limit,
              }
            : prev
        )
      }

      setShowPlanModal(false)

      // Verificar se houve erro parcial (gateway atualizado mas banco falhou)
      if (result.partial_error) {
        setNotice({
          type: 'info',
          message: result.message || 'Plano atualizado parcialmente. Por favor recarregue a página.',
        })
        return
      }

      // Verificar se foi uma sincronização (gateway já estava no plano, banco foi atualizado)
      if (result.synced) {
        setNotice({
          type: 'success',
          message: `Seu plano ${plan.name} foi sincronizado com sucesso!`,
        })
        return
      }

      // Mensagem de sucesso diferenciada para upgrade e downgrade
      const priceFormatted = result.new_plan?.price_monthly
        ? `R$ ${result.new_plan.price_monthly.toFixed(2).replace('.', ',')}/mês`
        : ''

      let successMessage = `Plano alterado para ${plan.name} com sucesso!`

      if (result.is_upgrade && result.price_difference > 0) {
        // Upgrade: cobrança imediata
        const diffFormatted = `R$ ${(result.price_difference || 0).toFixed(2).replace('.', ',')}`
        successMessage = `Upgrade para ${plan.name} realizado! A diferença de ${diffFormatted} foi cobrada.`
      } else if (result.is_downgrade) {
        // Downgrade: novo valor na próxima fatura
        successMessage = `Downgrade para ${plan.name} realizado! ${priceFormatted ? `O novo valor de ${priceFormatted} será aplicado na próxima fatura.` : ''}`
      }

      setNotice({
        type: 'success',
        message: successMessage,
      })
    } catch (err: unknown) {
      console.error('Erro no handleChangePlan:', err)
      const message = err instanceof Error ? err.message : 'Erro ao alterar plano. Tente novamente.'
      setNotice({ type: 'error', message })
    } finally {
      setChangingPlanId(null)
    }
  }

  // Encontrar plano atual para calcular diferença
  const currentPlanData = useMemo(() => {
    return plans.find(p => p.name.toLowerCase().trim() === planName.toLowerCase().trim()) || null
  }, [plans, planName])

  // Skeleton loading completo da página
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px' }}>
        {/* Header skeleton */}
        <div>
          <Skeleton height={isMobile ? 28 : 32} width={180} />
          <div style={{ marginTop: 8 }}><Skeleton height={16} width={240} /></div>
        </div>

        {/* Grid skeleton */}
        <div className="replyna-account-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '24px' }}>
          {/* Coluna esquerda - Informações da conta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <section style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)' }}>
              <div style={{ marginBottom: '16px' }}>
                <Skeleton height={20} width="50%" />
                <div style={{ marginTop: 6 }}><Skeleton height={14} width="70%" /></div>
              </div>
              <div style={{ display: 'grid', gap: '16px' }}>
                <Skeleton height={44} />
                <Skeleton height={44} />
                <div style={{ marginTop: 8 }}><Skeleton height={1} /></div>
                <Skeleton height={44} />
                <div style={{ marginTop: 8 }}><Skeleton height={1} /></div>
                <Skeleton height={44} />
              </div>
            </section>
          </div>

          {/* Coluna direita - Plano e Aparência */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Plano e Cobrança */}
            <section style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)' }}>
              <div style={{ marginBottom: '16px' }}>
                <Skeleton height={20} width="60%" />
                <div style={{ marginTop: 6 }}><Skeleton height={14} width="50%" /></div>
              </div>
              <div style={{ display: 'grid', gap: '16px' }}>
                <Skeleton height={120} />
                <Skeleton height={100} />
              </div>
            </section>

            {/* Aparência */}
            <section style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)' }}>
              <div style={{ marginBottom: '16px' }}>
                <Skeleton height={20} width="40%" />
                <div style={{ marginTop: 6 }}><Skeleton height={14} width="60%" /></div>
              </div>
              <Skeleton height={48} />
            </section>
          </div>
        </div>

        <style>
          {`
            @media (max-width: 1024px) {
              .replyna-account-grid {
                grid-template-columns: 1fr !important;
              }
            }
          `}
        </style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px' }}>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? '22px' : '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Minha Conta</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>Gerencie suas informações pessoais</p>
        </div>
        <button
          type="submit"
          form="account-profile-form"
          disabled={!isEditing || saving || loading}
          style={{
            backgroundColor: 'var(--accent)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: !isEditing || saving ? 0.6 : 1,
            display: isEditing ? 'inline-flex' : 'none',
            width: isMobile ? '100%' : 'auto',
            justifyContent: 'center',
          }}
        >
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>

      {notice && (
        <div
          style={{
            backgroundColor:
              notice.type === 'success' ? '#dcfce7' : notice.type === 'error' ? '#fef2f2' : '#e0e7ff',
            color: notice.type === 'success' ? '#166534' : notice.type === 'error' ? '#b91c1c' : '#1e3a8a',
            padding: '12px 16px',
            borderRadius: '10px',
            fontWeight: 600,
          }}
        >
          {notice.message}
        </div>
      )}

      <div className="replyna-account-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <section style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Informações da conta</h2>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>Seus dados e configurações de segurança</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {isEditing && (
                    <button
                      type="submit"
                      form="account-profile-form"
                      disabled={saving}
                      style={{
                        borderRadius: '10px',
                        border: 'none',
                        background: 'var(--accent)',
                        color: '#ffffff',
                        padding: '8px 14px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.7 : 1,
                      }}
                    >
                      {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleToggleEdit}
                    disabled={loading}
                    style={{
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      padding: '8px 14px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isEditing ? 'Cancelar' : 'Editar'}
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                <Skeleton height={44} />
                <Skeleton height={44} />
                <Skeleton height={44} />
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '20px' }}>
                <form id="account-profile-form" onSubmit={handleSave} style={{ display: 'grid', gap: '16px' }}>
                  <label style={{ display: 'grid', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Nome completo</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      disabled={!isEditing}
                      style={{
                        border: `1px solid ${isEditing ? 'var(--input-border)' : 'var(--border-color)'}`,
                        borderRadius: '10px',
                        padding: '12px',
                        fontSize: '14px',
                        backgroundColor: isEditing ? 'var(--input-bg)' : 'var(--bg-primary)',
                        color: isEditing ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: isEditing ? 'text' : 'not-allowed',
                      }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={!isEditing}
                      style={{
                        border: `1px solid ${isEditing ? 'var(--input-border)' : 'var(--border-color)'}`,
                        borderRadius: '10px',
                        padding: '12px',
                        fontSize: '14px',
                        backgroundColor: isEditing ? 'var(--input-bg)' : 'var(--bg-primary)',
                        color: isEditing ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: isEditing ? 'text' : 'not-allowed',
                      }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Número de Celular</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        disabled={!isEditing}
                        style={{
                          border: `1px solid ${isEditing ? 'var(--input-border)' : 'var(--border-color)'}`,
                          borderRadius: '10px',
                          padding: '12px 8px',
                          fontSize: '14px',
                          backgroundColor: isEditing ? 'var(--input-bg)' : 'var(--bg-primary)',
                          color: isEditing ? 'var(--text-primary)' : 'var(--text-secondary)',
                          cursor: isEditing ? 'pointer' : 'not-allowed',
                          minWidth: '110px',
                          appearance: isEditing ? undefined : 'none' as React.CSSProperties['appearance'],
                        }}
                      >
                        {countryCodes.map((c) => (
                          <option key={c.code} value={c.code}>{c.label}</option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        disabled={!isEditing}
                        placeholder="11 99999-9999"
                        style={{
                          flex: 1,
                          border: `1px solid ${isEditing ? 'var(--input-border)' : 'var(--border-color)'}`,
                          borderRadius: '10px',
                          padding: '12px',
                          fontSize: '14px',
                          backgroundColor: isEditing ? 'var(--input-bg)' : 'var(--bg-primary)',
                          color: isEditing ? 'var(--text-primary)' : 'var(--text-secondary)',
                          cursor: isEditing ? 'text' : 'not-allowed',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Para receber notificações sobre falhas de pagamento</span>
                  </label>
                </form>

                <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />

                <div style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Alterar email</span>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
                      Edite o campo de email acima e clique para enviar o link de confirmação ao novo endereço.
                    </p>
                    <button
                      type="button"
                      onClick={handleEmailChange}
                      disabled={emailChangeLoading}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--accent)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '12px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: emailChangeLoading ? 'not-allowed' : 'pointer',
                        opacity: emailChangeLoading ? 0.7 : 1,
                      }}
                    >
                      {emailChangeLoading ? 'Enviando...' : 'Enviar link de confirmação'}
                    </button>
                  </div>

                  <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />

                  <div style={{ display: 'grid', gap: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Alterar senha</span>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
                      Para alterar sua senha, enviaremos um link de redefinição para seu email cadastrado.
                    </p>
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={resetLoading}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--accent)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '12px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: resetLoading ? 'not-allowed' : 'pointer',
                        opacity: resetLoading ? 0.7 : 1,
                      }}
                    >
                      {resetLoading ? 'Enviando...' : 'Enviar link de redefinição'}
                    </button>
                  </div>
                </div>
              </div>
            )}</section>

        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <section style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)', height: 'fit-content' }}>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Plano e Cobrança</h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>Gerencie sua assinatura</p>
            </div>

            {loading ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                <Skeleton height={120} />
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{ borderRadius: '14px', border: '1px solid var(--border-color)', padding: '16px', backgroundColor: 'var(--bg-primary)' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                    Plano {planName}
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Renova em {renewalDate ? formatDate(renewalDate) : '--'}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
                    <button
                      type="button"
                      onClick={handleOpenPlanModal}
                      style={{
                        borderRadius: '10px',
                        border: '1px solid var(--accent)',
                        color: 'var(--accent)',
                        padding: '10px',
                        fontSize: '13px',
                        fontWeight: 600,
                        background: 'var(--bg-card)',
                        cursor: 'pointer',
                      }}
                    >
                      Alterar plano
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCancelModal(true)}
                      style={{
                        borderRadius: '10px',
                        border: '1px solid #ef4444',
                        color: '#ef4444',
                        padding: '10px',
                        fontSize: '13px',
                        fontWeight: 600,
                        background: 'var(--bg-card)',
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar plano
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenBillingPortal}
                    disabled={openingBillingPortal}
                    style={{
                      marginTop: '10px',
                      width: '100%',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      padding: '10px',
                      fontSize: '13px',
                      fontWeight: 600,
                      background: 'var(--bg-card)',
                      cursor: openingBillingPortal ? 'not-allowed' : 'pointer',
                      opacity: openingBillingPortal ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    {openingBillingPortal ? (
                      'Abrindo...'
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                          <line x1="1" y1="10" x2="23" y2="10"/>
                        </svg>
                        Ver última fatura
                      </>
                    )}
                  </button>
                </div>

                <div style={{ borderRadius: '14px', border: '1px solid var(--border-color)', padding: '16px', backgroundColor: 'var(--bg-primary)' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
                    Uso do plano
                  </div>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Lojas integradas</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: shopsLimit === null ? '#22c55e' : 'var(--text-primary)' }}>
                          {shopsCount} / {shopsLimit === null ? 'Ilimitado' : formatNumber(shopsLimit ?? 0)}
                        </span>
                      </div>
                      {shopsLimit !== null && (
                        <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${shopsLimit ? Math.min((shopsCount / shopsLimit) * 100, 100) : 0}%`,
                              backgroundColor: shopsLimit && shopsCount >= shopsLimit ? '#ef4444' : 'var(--accent)',
                              borderRadius: '4px',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Emails enviados</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: emailsLimit === null ? '#22c55e' : 'var(--text-primary)' }}>
                          {profile?.emails_used !== null && profile?.emails_used !== undefined ? formatNumber(profile.emails_used) : '0'} / {emailsLimit === null ? 'Ilimitado' : formatNumber(emailsLimit ?? 0)}
                        </span>
                      </div>
                      {emailsLimit !== null && (
                        <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${emailsLimit && profile?.emails_used !== null && profile?.emails_used !== undefined ? Math.min((profile.emails_used / emailsLimit) * 100, 100) : 0}%`,
                              backgroundColor: emailsLimit && profile?.emails_used !== null && profile.emails_used >= emailsLimit ? '#ef4444' : 'var(--accent)',
                              borderRadius: '4px',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Seção de Emails Extras - aparece apenas quando excedeu o limite do plano */}
                {emailsLimit !== null && emailsLimit !== undefined && profile?.emails_used !== null && profile?.emails_used !== undefined && profile.emails_used >= emailsLimit && (
                  <div style={{
                    borderRadius: '14px',
                    border: '1px solid #f59e0b',
                    padding: '16px',
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="12" y1="8" x2="12" y2="12"/>
                          <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#f59e0b' }}>
                          Emails Extras
                        </span>
                      </div>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: '1.5' }}>
                      Você atingiu o limite do seu plano. Emails adicionais são cobrados em pacotes de {profile?.extra_email_package_size ?? 100} emails por R$ {((profile?.extra_email_price ?? 1) * (profile?.extra_email_package_size ?? 100)).toFixed(2).replace('.', ',')}.
                    </p>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Créditos extras disponíveis</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: (profile?.extra_emails_purchased ?? 0) - (profile?.extra_emails_used ?? 0) <= 0 ? '#ef4444' : '#f59e0b' }}>
                          {((profile?.extra_emails_purchased ?? 0) - (profile?.extra_emails_used ?? 0))} emails
                        </span>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '8px 0 0 0' }}>
                        Quando seus créditos extras acabarem, um novo pacote será cobrado automaticamente no cartão da sua assinatura.
                      </p>

                      {/* Botão para comprar emails extras */}
                      <button
                        onClick={handleBuyExtraEmails}
                        disabled={buyingExtras}
                        style={{
                          marginTop: '16px',
                          width: '100%',
                          padding: '12px 16px',
                          backgroundColor: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: buyingExtras ? 'not-allowed' : 'pointer',
                          opacity: buyingExtras ? 0.7 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {buyingExtras ? (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                            </svg>
                            Processando...
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="9" cy="21" r="1"/>
                              <circle cx="20" cy="21" r="1"/>
                              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                            </svg>
                            Comprar +{profile?.extra_email_package_size ?? 100} emails por R$ {((profile?.extra_email_price ?? 1) * (profile?.extra_email_package_size ?? 100)).toFixed(2).replace('.', ',')}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Seção de Pagamentos Pendentes */}
                {pendingInvoices.length > 0 && (
                  <div style={{
                    borderRadius: '14px',
                    border: '1px solid #ef4444',
                    padding: '16px',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#ef4444' }}>
                        Pagamento Pendente
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: '1.5' }}>
                      Você possui faturas de emails extras aguardando pagamento. Regularize para continuar respondendo automaticamente.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {pendingInvoices.map((invoice) => (
                        <div
                          key={invoice.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px',
                            backgroundColor: 'var(--bg-card)',
                            borderRadius: '10px',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              Pacote de {invoice.package_size} emails
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              R$ {invoice.total_amount.toFixed(2).replace('.', ',')}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePayInvoice(invoice)}
                            disabled={payingInvoiceId === invoice.id}
                            style={{
                              borderRadius: '8px',
                              border: 'none',
                              backgroundColor: '#ef4444',
                              color: '#ffffff',
                              padding: '8px 16px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: payingInvoiceId === invoice.id ? 'not-allowed' : 'pointer',
                              opacity: payingInvoiceId === invoice.id ? 0.7 : 1,
                            }}
                          >
                            {payingInvoiceId === invoice.id ? 'Processando...' : 'Pagar agora'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)', height: 'fit-content' }}>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Aparência</h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>Personalize a interface do sistema</p>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Tema</span>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px',
                    border: 'none',
                    backgroundColor: theme === 'light' ? 'var(--accent)' : 'transparent',
                    color: theme === 'light' ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Sun size={16} />
                  Claro
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px',
                    border: 'none',
                    backgroundColor: theme === 'dark' ? 'var(--accent)' : 'transparent',
                    color: theme === 'dark' ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Moon size={16} />
                  Escuro
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {showPlanModal && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div
            className="replyna-scrollbar"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid var(--border-color)',
              width: 'min(600px, 94vw)',
              maxHeight: '90vh',
              overflowY: 'auto',
              zIndex: 61,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '8px', color: 'var(--text-primary)' }}>Alterar plano</h3>
            <p style={{ marginTop: 0, marginBottom: '20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
              Selecione o novo plano. A diferença será ajustada automaticamente na sua próxima fatura.
            </p>

            {plansLoading ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                <Skeleton height={120} />
                <Skeleton height={120} />
              </div>
            ) : plans.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
                Nenhum plano disponível no momento.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {plans.map((plan) => {
                  const isCurrentPlan = plan.name.toLowerCase().trim() === planName.toLowerCase().trim()
                  const isEnterprise = plan.name.toLowerCase().includes('enterprise')
                  return (
                    <div
                      key={plan.id}
                      style={{
                        borderRadius: '12px',
                        border: isCurrentPlan
                          ? '2px solid var(--accent)'
                          : `1px solid ${plan.is_popular ? 'var(--accent)' : 'var(--border-color)'}`,
                        padding: '16px',
                        backgroundColor: isCurrentPlan ? 'rgba(70, 114, 236, 0.08)' : 'var(--bg-primary)',
                        position: 'relative',
                      }}
                    >
                      {isCurrentPlan && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '-10px',
                            left: '16px',
                            backgroundColor: 'var(--accent)',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: '6px',
                          }}
                        >
                          Seu plano
                        </span>
                      )}
                      {plan.is_popular && !isCurrentPlan && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '-10px',
                            right: '16px',
                            backgroundColor: 'var(--accent)',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: '6px',
                          }}
                        >
                          Popular
                        </span>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                            {plan.name}
                            {isCurrentPlan && (
                              <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 500, color: 'var(--accent)' }}>
                                (Atual)
                              </span>
                            )}
                          </div>
                          <ul style={{ paddingLeft: '16px', margin: 0, color: 'var(--text-secondary)', fontSize: '12px', display: 'grid', gap: '2px' }}>
                            <li style={{ color: isEnterprise || plan.emails_limit === null ? '#22c55e' : 'inherit' }}>
                              {isEnterprise || plan.emails_limit === null ? 'Emails ilimitados' : `${formatNumber(plan.emails_limit)} emails/mês`}
                            </li>
                            <li style={{ color: isEnterprise || plan.shops_limit === null ? '#22c55e' : 'inherit' }}>
                              {isEnterprise || plan.shops_limit === null ? 'Lojas ilimitadas' : `${formatNumber(plan.shops_limit)} ${plan.shops_limit === 1 ? 'loja' : 'lojas'}`}
                            </li>
                            {Array.isArray(plan.features) && plan.features
                              .filter((f) => {
                                const lower = f.toLowerCase()
                                // Filtra features que mencionam emails ou lojas (já exibidos acima)
                                return !lower.includes('email') && !lower.includes('e-mail') && !lower.includes('loja')
                              })
                              .slice(0, 3)
                              .map((feature, idx) => (
                                <li key={idx}>{feature}</li>
                              ))}
                          </ul>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                          <div style={{ textAlign: 'right' }}>
                            {isEnterprise ? (
                              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                Sob consulta
                              </div>
                            ) : (
                              <>
                                {/* Se não é o plano atual e tem diferença, mostra preço cortado + diferença */}
                                {!isCurrentPlan && currentPlanData && plan.price_monthly !== currentPlanData.price_monthly ? (
                                  <>
                                    <div style={{
                                      fontSize: '14px',
                                      color: 'var(--text-secondary)',
                                      textDecoration: 'line-through',
                                      opacity: 0.7,
                                    }}>
                                      R$ {plan.price_monthly.toFixed(2).replace('.', ',')}
                                    </div>
                                    <div style={{
                                      fontSize: '18px',
                                      fontWeight: 700,
                                      color: plan.price_monthly > currentPlanData.price_monthly ? '#22c55e' : 'var(--accent)',
                                    }}>
                                      {plan.price_monthly > currentPlanData.price_monthly
                                        ? `+R$ ${(plan.price_monthly - currentPlanData.price_monthly).toFixed(2).replace('.', ',')}`
                                        : `-R$ ${(currentPlanData.price_monthly - plan.price_monthly).toFixed(2).replace('.', ',')}`}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                      {plan.price_monthly > currentPlanData.price_monthly ? 'a mais por mês' : 'de economia por mês'}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                      R$ {plan.price_monthly.toFixed(2).replace('.', ',')}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>por mês</div>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                          {isEnterprise ? (
                            <a
                              href="https://wa.me/5511999999999?text=Olá!%20Tenho%20interesse%20no%20plano%20Enterprise%20da%20Replyna."
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: '#25D366',
                                color: '#fff',
                                padding: '8px 16px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                              Falar com vendas
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleChangePlan(plan)}
                              disabled={isCurrentPlan || changingPlanId !== null}
                              style={{
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: isCurrentPlan ? 'var(--border-color)' : 'var(--accent)',
                                color: isCurrentPlan ? 'var(--text-secondary)' : '#fff',
                                padding: '8px 16px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: isCurrentPlan || changingPlanId !== null ? 'not-allowed' : 'pointer',
                                opacity: changingPlanId !== null && changingPlanId !== plan.id ? 0.6 : 1,
                              }}
                            >
                              {isCurrentPlan
                                ? 'Plano atual'
                                : changingPlanId === plan.id
                                ? 'Alterando...'
                                : 'Selecionar'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowPlanModal(false)}
              style={{
                marginTop: '16px',
                width: '100%',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                padding: '10px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Fechar
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowPlanModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(14, 23, 41, 0.35)', border: 'none', zIndex: 60 }}
          />
        </div>
      )}

      {showCancelModal && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid var(--border-color)',
              width: 'min(480px, 92vw)',
              zIndex: 61,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '8px', color: 'var(--text-primary)' }}>Cancelar plano</h3>
            <p style={{ marginTop: 0, color: 'var(--text-secondary)' }}>
              Seu acesso continua até {renewalDate ? formatDate(renewalDate) : 'a data de renovação'}.
            </p>
            <label style={{ display: 'grid', gap: '6px', marginTop: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Motivo (opcional)</span>
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={3}
                style={{
                  border: '1px solid var(--input-border)',
                  borderRadius: '10px',
                  padding: '10px',
                  fontSize: '14px',
                  resize: 'vertical',
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                }}
              />
            </label>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                style={{
                  flex: 1,
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  padding: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleCancelPlan}
                style={{
                  flex: 1,
                  borderRadius: '10px',
                  border: '1px solid #ef4444',
                  background: '#ef4444',
                  color: '#ffffff',
                  padding: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Confirmar cancelamento
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCancelModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(14, 23, 41, 0.35)', border: 'none', zIndex: 60 }}
          />
        </div>
      )}

      <style>
        {`
          @media (max-width: 1024px) {
            .replyna-account-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </div>
  )
}
```

---

## 8) supabase/functions/process-emails/index.ts

```ts
/**
 * Edge Function: process-emails (Orquestrador com Workers Internos)
 *
 * Função principal que processa emails de todas as lojas ativas em paralelo.
 * Processa múltiplas lojas simultaneamente para maximizar throughput.
 *
 * Deve ser chamada via cron a cada 5 minutos.
 *
 * Fluxo:
 * 1. Busca lojas ativas com email configurado
 * 2. Processa lojas em paralelo (até MAX_CONCURRENT_SHOPS)
 * 3. Cada loja tem processamento independente com timeout próprio
 * 4. Agrega resultados e retorna estatísticas
 */

// deno-lint-ignore-file no-explicit-any
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

import {
  getSupabaseClient,
  getActiveShopsWithEmail,
  getUserById,
  tryReserveCredit,
  releaseCredit,
  incrementEmailsUsed,  // Mantido para compatibilidade
  getOrCreateConversation,
  saveMessage,
  updateMessage,
  getPendingMessages,
  getConversationHistory,
  updateConversation,
  logProcessingEvent,
  updateShopEmailSync,
  updateCreditsWarning,
  type Shop,
  type Message,
  type Conversation,
} from '../_shared/supabase.ts';

import {
  decryptEmailCredentials,
  fetchUnreadEmails,
  markEmailsAsSeen,
  sendEmail,
  buildReplyHeaders,
  buildReplySubject,
  cleanEmailBody,
  extractNameFromEmail,
  type IncomingEmail,
} from '../_shared/email.ts';

import {
  decryptShopifyCredentials,
  getOrderDataForAI,
  extractOrderNumber,
  type OrderSummary,
} from '../_shared/shopify.ts';

import {
  classifyEmail,
  generateResponse,
  generateDataRequestMessage,
  generateHumanFallbackMessage,
  isSpamByPattern,
} from '../_shared/anthropic.ts';

// Constantes - ESCALA AUMENTADA
const MAX_CONCURRENT_SHOPS = 5; // Reduzido de 10 para 5 para evitar WORKER_LIMIT
const MAX_EMAILS_PER_SHOP = 10; // Emails IMAP por loja
const MAX_MESSAGES_PER_SHOP = 10; // Reduzido de 15 para 10
const MAX_CONCURRENT_MESSAGES = 3; // Mensagens em paralelo por loja
const MAX_DATA_REQUESTS = 3;
const MAX_EXECUTION_TIME_MS = 110000; // 110 segundos (limite real é 120s)

/**
 * Extrai email do cliente do corpo de um formulário de contato do Shopify
 * Lida com diferentes formatos: texto puro e HTML com tags entre "Email:" e o endereço
 */
function extractEmailFromShopifyContactForm(bodyText: string, bodyHtml?: string): { email: string; name: string | null } | null {
  if (!bodyText && !bodyHtml) return null;

  // Padrões para extrair email - do mais específico ao mais genérico
  const emailPatterns = [
    // Padrão 1: "Email:" seguido diretamente pelo email (texto puro)
    /(?:E-?mail|email):\s*\n?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    // Padrão 2: "Email:" com tags HTML no meio (ex: <b>Email:</b><pre>email@test.com</pre>)
    /(?:E-?mail|email):<\/b>\s*(?:<[^>]*>)*\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    // Padrão 3: Qualquer formato com "Email:" e email na mesma região
    /(?:E-?mail|email):[^@]*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
  ];

  // Padrões para extrair nome
  const namePatterns = [
    /(?:Name|Nome):\s*\n?\s*([^\n<]+)/i,
    /(?:Name|Nome):<\/b>\s*(?:<[^>]*>)*\s*([^<\n]+)/i,
  ];

  let email: string | null = null;
  let name: string | null = null;

  // Tentar extrair do texto primeiro
  if (bodyText) {
    for (const pattern of emailPatterns) {
      const match = bodyText.match(pattern);
      if (match && match[1]) {
        email = match[1].toLowerCase().trim();
        break;
      }
    }

    for (const pattern of namePatterns) {
      const match = bodyText.match(pattern);
      if (match && match[1] && match[1].trim()) {
        name = match[1].trim();
        break;
      }
    }
  }

  // Se não encontrou no texto, tentar no HTML
  if (!email && bodyHtml) {
    for (const pattern of emailPatterns) {
      const match = bodyHtml.match(pattern);
      if (match && match[1]) {
        email = match[1].toLowerCase().trim();
        break;
      }
    }

    if (!name) {
      for (const pattern of namePatterns) {
        const match = bodyHtml.match(pattern);
        if (match && match[1] && match[1].trim()) {
          name = match[1].trim();
          break;
        }
      }
    }
  }

  if (!email) return null;

  // Limpar nome de possíveis tags HTML residuais
  if (name) {
    name = name.replace(/<[^>]*>/g, '').trim();
  }

  return { email, name };
}

/**
 * Verifica se a mensagem é um auto-responder (out-of-office, férias, etc.)
 */
function isAutoResponder(body: string, subject: string): boolean {
  const cleanBody = (body || '').toLowerCase();
  const cleanSubject = (subject || '').toLowerCase();

  // Padrões de auto-responder no ASSUNTO
  const autoReplySubjectPatterns = [
    /out of office/i,
    /automatic reply/i,
    /auto[- ]?reply/i,
    /fora do escrit[oó]rio/i,
    /resposta autom[aá]tica/i,
    /abwesenheitsnotiz/i,  // Alemão: out of office
    /automatische antwort/i,  // Alemão: automatic reply
    /absence/i,
    /vacation/i,
    /holiday/i,
  ];

  for (const pattern of autoReplySubjectPatterns) {
    if (pattern.test(cleanSubject)) {
      console.log('[AutoResponder] Detectado por assunto:', cleanSubject);
      return true;
    }
  }

  // Padrões de auto-responder no CONTEÚDO (férias, ausência, etc.)
  const autoReplyBodyPatterns = [
    // Português
    /estou (de|em) f[eé]rias/i,
    /estarei dispon[ií]vel (novamente |)a partir de/i,
    /retorno (em|no dia|dia)/i,
    /durante minha aus[eê]ncia/i,
    /n[aã]o (ser[aã]o|serão) lidos? (nem |ou |)encaminhados?/i,
    /responderei .{0,30} ap[oó]s meu retorno/i,
    /aus[eê]ncia programada/i,
    // Inglês
    /i('m| am) (currently )?(on |out of |away |on )vacation/i,
    /i('ll| will) be (back|available|returning) on/i,
    /during my absence/i,
    /will not be (read|monitored|checked)/i,
    /out of (the )?office/i,
    /away from (the )?office/i,
    /i('m| am) away/i,
    // Alemão
    /bin (derzeit |aktuell |)im urlaub/i,  // estou de férias
    /bin (ab |wieder |)(dem |).*? wieder erreichbar/i,  // estarei disponível novamente
    /w[aä]hrend meiner abwesenheit/i,  // durante minha ausência
    /e-?mails? werden? nicht (gelesen|weitergeleitet)/i,  // emails não serão lidos
    /nach meiner r[uü]ckkehr/i,  // após meu retorno
    // Padrões genéricos de assinatura de auto-reply
    /this is an auto(matic)?[- ]?(generated )?reply/i,
    /esta [eé] uma resposta autom[aá]tica/i,
    /dies ist eine automatische/i,
  ];

  for (const pattern of autoReplyBodyPatterns) {
    if (pattern.test(cleanBody)) {
      console.log('[AutoResponder] Detectado por conteúdo, padrão:', pattern.toString());
      return true;
    }
  }

  return false;
}

/**
 * Verifica se a mensagem é apenas um agradecimento/confirmação que não precisa de resposta
 */
function isAcknowledgmentMessage(body: string, subject: string): boolean {
  // Primeiro verificar se é auto-responder
  if (isAutoResponder(body, subject)) {
    return true;
  }

  const cleanBody = (body || '').toLowerCase().trim();
  const cleanSubject = (subject || '').toLowerCase().trim();

  // Remover saudações e assinaturas comuns para analisar apenas o conteúdo principal
  const bodyWithoutGreetings = cleanBody
    .replace(/^(ol[aá]|oi|bom dia|boa tarde|boa noite|hi|hello|hey)[,!.\s]*/gi, '')
    .replace(/(obrigad[oa]|valeu|grat[oa]|thanks|thank you|thx)[,!.\s]*$/gi, '')
    .replace(/^(atenciosamente|att|abraços?|regards)[,.\s]*.*/gim, '')
    .trim();

  // Remover assinaturas/nomes curtos do final (ex: "Wendy-", "- João", "Maria")
  const bodyWithoutSignature = cleanBody
    .replace(/[\r\n]+-+\s*$/g, '')
    .replace(/[\r\n]+[a-záàãéêíóôúç\s.\-]{2,30}[\r\n]*$/gi, '')
    .trim();

  // Se o corpo ficar muito curto após remover saudações, provavelmente é só agradecimento
  if (bodyWithoutGreetings.length < 20) {
    // Padrões de mensagens que são apenas agradecimento/confirmação
    const acknowledgmentPatterns = [
      /^(ok|okay|certo|entendi|perfeito|beleza|blz|show|top|massa|legal)\.?!?$/i,
      /^(obrigad[oa]|muito obrigad[oa]|valeu|grat[oa])\.?!?$/i,
      /^(thanks|thank you|thx|ty)\.?!?$/i,
      /^(recebi|recebido)\.?!?$/i,
      /^(sim|n[aã]o)\.?!?$/i,
      /^[\.\!\?\s]*$/,  // Mensagens vazias ou só pontuação
    ];

    for (const pattern of acknowledgmentPatterns) {
      if (pattern.test(cleanBody) || pattern.test(bodyWithoutGreetings)) {
        return true;
      }
    }
  }

  // Padrões de agradecimento com complemento (mensagem curta, < 100 chars)
  const textToCheck = bodyWithoutSignature.length < cleanBody.length ? bodyWithoutSignature : cleanBody;
  if (textToCheck.length < 100) {
    const shortAckPatterns = [
      /^obrigad[oa]\s+(pelo|pela|por|pelo retorno|pela resposta|pela ajuda|por responder)/i,
      /^thanks?\s+(for|for getting back|for your|for the)/i,
      /^thank you\s+(for|so much|very much|for getting back|for your|for the)/i,
      /^gracias\s+(por|por responder|por la|por su)/i,
      /^merci\s+(pour|beaucoup|de)/i,
      /^danke\s+(für|schön|sehr)/i,
      /^(muito obrigad[oa]|thanks a lot|many thanks|muchísimas gracias)/i,
      /^(valeu|vlw|thx|tks|ty)\b/i,
      // Padrões compostos: "ok" + agradecimento/espera
      /^ok[,.\s]+(obrigad|thanks|merci|danke|gracias)/i,
      /^(ok|okay|certo|entendi|perfeito)[,.\s]+(vou|i'?ll|i will)\s+(esperar|aguardar|wait)/i,
    ];

    for (const pattern of shortAckPatterns) {
      if (pattern.test(textToCheck) || pattern.test(cleanBody)) {
        console.log(`[isAcknowledgment] Detected short ack: "${textToCheck.substring(0, 50)}"`);
        return true;
      }
    }

    // Detecção de mensagem de "espera" / "I'll wait" (acknowledgment implícito)
    if (/\b(vou|irei)\s+(esperar|aguardar)\b/i.test(textToCheck) ||
        /\b(i'?ll|i will)\s+wait\b/i.test(textToCheck) ||
        /\b(werde)\s+(warten|abwarten)\b/i.test(textToCheck) ||
        /\b(voy a|vamos a)\s+esperar\b/i.test(textToCheck)) {
      console.log(`[isAcknowledgment] Detected waiting message: "${textToCheck.substring(0, 50)}"`);
      return true;
    }
  }

  return false;
}

/**
 * Verifica se a mensagem é uma notificação de sistema do Shopify (NÃO é uma mensagem de cliente)
 * Ex: chargebacks, disputas, alertas de pedido, notificações administrativas
 */
function isShopifySystemNotification(body: string): boolean {
  if (!body) return false;
  const lower = body.toLowerCase();

  const shopifyNotificationPatterns = [
    'abriu um estorno',
    'opened a chargeback',
    'filed a chargeback',
    'new order inquiry',
    'nova consulta de pedido',
    'dispute_evidences',
    'o banco devolveu',
    'the bank returned',
    'charged a fee for the chargeback',
    'taxa de estorno',
    'enviar resposta ao banco',
    'send response to bank',
    'coletamos evidências',
    'we collected evidence',
    'order risk analysis',
    'análise de risco do pedido',
    'high risk order',
    'pedido de alto risco',
    'payment was voided',
    'pagamento foi cancelado',
    'payout has been sent',
    'pagamento foi enviado',
  ];

  for (const pattern of shopifyNotificationPatterns) {
    if (lower.includes(pattern)) {
      console.log(`[isShopifySystemNotification] Matched pattern: "${pattern}"`);
      return true;
    }
  }

  return false;
}

// Set para controlar conversas em processamento (evitar duplicatas)
const conversationsInProcessing = new Set<string>();

// Map para armazenar imagens de emails por message_id durante o processamento
// Imagens são grandes demais para salvar no banco, então mantemos em memória
// IMPORTANTE: Cache é limitado para evitar memory leak em ambiente serverless
const MAX_CACHE_SIZE = 50; // Máximo de 50 emails com imagens em cache
const MAX_CACHE_AGE_MS = 5 * 60 * 1000; // 5 minutos de idade máxima

interface CachedImages {
  images: Array<{
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string;
    filename?: string;
  }>;
  timestamp: number;
}

const emailImagesCache = new Map<string, CachedImages>();

/**
 * Limpa entradas antigas do cache de imagens
 */
function cleanupImageCache(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of emailImagesCache.entries()) {
    if (now - value.timestamp > MAX_CACHE_AGE_MS) {
      emailImagesCache.delete(key);
      cleaned++;
    }
  }

  // Se ainda estiver acima do limite, remover os mais antigos
  if (emailImagesCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(emailImagesCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = entries.slice(0, emailImagesCache.size - MAX_CACHE_SIZE);
    for (const [key] of toRemove) {
      emailImagesCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[ImageCache] Limpeza: ${cleaned} entradas removidas, ${emailImagesCache.size} restantes`);
  }
}

// Tipos
interface ProcessingStats {
  shops_total: number;
  shops_processed: number;
  shops_failed: number;
  emails_received: number;
  emails_replied: number;
  emails_pending_credits: number;
  emails_forwarded_human: number;
  emails_spam: number;
  errors: number;
}

interface ShopStats {
  shop_id: string;
  shop_name: string;
  emails_received: number;
  emails_replied: number;
  emails_pending_credits: number;
  emails_forwarded_human: number;
  emails_spam: number;
  errors: number;
}

/**
 * Verifica se ainda há tempo disponível para processamento
 */
function hasTimeRemaining(startTime: number): boolean {
  return Date.now() - startTime < MAX_EXECUTION_TIME_MS;
}

/**
 * Processa itens em paralelo com limite de concorrência
 */
async function processInBatches<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number,
  startTime: number
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    // Verificar timeout antes de cada batch
    if (!hasTimeRemaining(startTime)) {
      console.log(`[Orchestrator] Timeout! Processados ${i} de ${items.length} items.`);
      break;
    }

    const batch = items.slice(i, i + concurrency);
    console.log(`[Orchestrator] Batch ${Math.floor(i / concurrency) + 1}: processando ${batch.length} items em paralelo`);

    const batchResults = await Promise.allSettled(batch.map(processor));

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    }
  }

  return results;
}

/**
 * Handler principal da Edge Function
 */
Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const stats: ProcessingStats = {
    shops_total: 0,
    shops_processed: 0,
    shops_failed: 0,
    emails_received: 0,
    emails_replied: 0,
    emails_pending_credits: 0,
    emails_forwarded_human: 0,
    emails_spam: 0,
    errors: 0,
  };

  try {
    // Limpar cache de imagens antigas para evitar memory leak
    cleanupImageCache();

    console.log('[Orchestrator] Iniciando processamento de emails em escala...');

    // 1. Buscar lojas ativas
    const shops = await getActiveShopsWithEmail();
    stats.shops_total = shops.length;
    console.log(`[Orchestrator] Encontradas ${shops.length} lojas ativas`);

    if (shops.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhuma loja ativa encontrada',
          stats,
          duration_ms: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1.5 Ordenar lojas por quantidade de mensagens pendentes (menos primeiro)
    // Isso garante que lojas menores sejam processadas rapidamente
    try {
      const supabase = getSupabaseClient();
      const { data: pendingCounts, error: rpcError } = await supabase.rpc('get_pending_message_counts_by_shop');

      if (!rpcError && pendingCounts) {
        // Criar mapa de contagem por loja
        const countByShop: Record<string, number> = {};
        for (const row of pendingCounts as Array<{ shop_id: string; count: number }>) {
          countByShop[row.shop_id] = row.count;
        }

        // Ordenar lojas: menos pendentes primeiro
        shops.sort((a, b) => {
          const countA = countByShop[a.id] || 0;
          const countB = countByShop[b.id] || 0;
          return countA - countB;
        });

        console.log('[Orchestrator] Lojas ordenadas por mensagens pendentes (menos primeiro):');
        shops.slice(0, 5).forEach(s => {
          console.log(`  - ${s.name}: ${countByShop[s.id] || 0} pendentes`);
        });
      } else {
        console.log('[Orchestrator] Não foi possível ordenar lojas por pendentes, usando ordem padrão');
      }
    } catch (sortError) {
      console.log('[Orchestrator] Erro ao ordenar lojas:', sortError);
    }

    // 2. Processar lojas em paralelo
    console.log(`[Orchestrator] Processando até ${MAX_CONCURRENT_SHOPS} lojas em paralelo`);

    const results = await processInBatches(
      shops,
      async (shop) => {
        try {
          const shopStats = await processShop(shop, startTime);
          return { success: true, stats: shopStats };
        } catch (error) {
          console.error(`[Orchestrator] Erro na loja ${shop.name}:`, error);
          await logProcessingEvent({
            shop_id: shop.id,
            event_type: 'error',
            error_type: 'shop_processing',
            error_message: error instanceof Error ? error.message : 'Erro desconhecido',
          });
          return { success: false, error: error instanceof Error ? error.message : 'Erro' };
        }
      },
      MAX_CONCURRENT_SHOPS,
      startTime
    );

    // 3. Agregar resultados
    for (const result of results) {
      if (result.success && result.stats) {
        stats.shops_processed++;
        stats.emails_received += result.stats.emails_received;
        stats.emails_replied += result.stats.emails_replied;
        stats.emails_pending_credits += result.stats.emails_pending_credits;
        stats.emails_forwarded_human += result.stats.emails_forwarded_human;
        stats.emails_spam += result.stats.emails_spam;
        stats.errors += result.stats.errors;
      } else {
        stats.shops_failed++;
        stats.errors++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Orchestrator] Processamento concluído em ${duration}ms:`, stats);

    // Log de conclusão removido - event_type 'orchestrator_completed' não existe na tabela

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        duration_ms: duration,
        config: {
          max_concurrent_shops: MAX_CONCURRENT_SHOPS,
          max_emails_per_shop: MAX_EMAILS_PER_SHOP,
          max_messages_per_shop: MAX_MESSAGES_PER_SHOP,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Orchestrator] Erro fatal:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stats,
        duration_ms: Date.now() - startTime,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Processa uma loja específica
 */
async function processShop(shop: Shop, globalStartTime: number): Promise<ShopStats> {
  const stats: ShopStats = {
    shop_id: shop.id,
    shop_name: shop.name,
    emails_received: 0,
    emails_replied: 0,
    emails_pending_credits: 0,
    emails_forwarded_human: 0,
    emails_spam: 0,
    errors: 0,
  };

  console.log(`[Shop ${shop.name}] Iniciando processamento`);

  // 1. Decriptar credenciais de email
  const emailCredentials = await decryptEmailCredentials(shop);
  if (!emailCredentials) {
    console.log(`[Shop ${shop.name}] Sem credenciais de email válidas`);
    return stats;
  }

  // 2. Buscar emails não lidos via IMAP
  let emailStartDate: Date | null = null;
  if (shop.email_start_mode === 'from_integration_date' && shop.email_start_date) {
    emailStartDate = new Date(shop.email_start_date);
  }

  let incomingEmails: IncomingEmail[] = [];
  try {
    incomingEmails = await fetchUnreadEmails(emailCredentials, MAX_EMAILS_PER_SHOP, emailStartDate);
    console.log(`[Shop ${shop.name}] ${incomingEmails.length} emails não lidos`);
    stats.emails_received = incomingEmails.length;
  } catch (error) {
    console.error(`[Shop ${shop.name}] Erro IMAP:`, error);
    await updateShopEmailSync(shop.id, error instanceof Error ? error.message : 'Erro IMAP');
    throw error;
  }

  // 3. Salvar emails no banco e marcar como lidos no IMAP após salvar
  const shopEmail = emailCredentials.smtp_user.toLowerCase();
  const savedUids: number[] = [];
  for (const email of incomingEmails) {
    if (email.from_email.toLowerCase() === shopEmail) continue;
    try {
      await saveIncomingEmail(shop.id, email);
      if (email.imap_uid) savedUids.push(email.imap_uid);
    } catch (error) {
      console.error(`[Shop ${shop.name}] Erro ao salvar email:`, error);
      stats.errors++;
    }
  }

  // Marcar como lidos apenas emails salvos com sucesso
  if (savedUids.length > 0) {
    try {
      await markEmailsAsSeen(emailCredentials, savedUids);
    } catch (error) {
      console.error(`[Shop ${shop.name}] Erro ao marcar emails como lidos:`, error);
    }
  }

  // 4. Processar emails pendentes
  const allPendingMessages = await getPendingMessages(shop.id);
  const pendingMessages = allPendingMessages.slice(0, MAX_MESSAGES_PER_SHOP);
  console.log(`[Shop ${shop.name}] ${allPendingMessages.length} pendentes, processando ${pendingMessages.length}`);

  // Processar mensagens em paralelo
  for (let i = 0; i < pendingMessages.length; i += MAX_CONCURRENT_MESSAGES) {
    if (!hasTimeRemaining(globalStartTime)) {
      console.log(`[Shop ${shop.name}] Timeout global, parando`);
      break;
    }

    const batch = pendingMessages.slice(i, i + MAX_CONCURRENT_MESSAGES);

    const batchResults = await Promise.allSettled(
      batch.map(async (message) => {
        try {
          return await processMessage(shop, message, emailCredentials);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Erro';
          console.error(`[Shop ${shop.name}] Erro ao processar msg ${message.id}:`, error);
          // Erros permanentes: email inválido, spam, vazio, sistema - marcar como failed
          // Erros transitórios: timeout, rede, API - resetar para pending para reprocessar
          const isPermanentError = /invalid|invalido|spam|vazio|sistema|remetente|forwarding notification/i.test(errorMsg);
          await updateMessage(message.id, {
            status: isPermanentError ? 'failed' : 'pending',
            error_message: errorMsg,
          });
          throw error;
        }
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        const outcome = result.value;
        if (outcome === 'replied') stats.emails_replied++;
        else if (outcome === 'pending_credits') stats.emails_pending_credits++;
        else if (outcome === 'forwarded_human') stats.emails_forwarded_human++;
        else if (outcome === 'spam') stats.emails_spam++;
      } else {
        stats.errors++;
      }
    }
  }

  // 5. Atualizar timestamp de sync
  await updateShopEmailSync(shop.id);

  console.log(`[Shop ${shop.name}] Concluído:`, stats);
  return stats;
}

/**
 * Salva um email recebido no banco
 */
async function saveIncomingEmail(shopId: string, email: IncomingEmail): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from('messages')
    .select('id')
    .eq('message_id', email.message_id)
    .single();

  if (existing) return;

  let finalFromEmail = email.from_email;
  let finalFromName = email.from_name;

  // Verificar se é email de sistema Shopify (formulário de contato)
  const isShopifySystemEmail = finalFromEmail &&
    (finalFromEmail.toLowerCase().includes('mailer@shopify') ||
     finalFromEmail.toLowerCase().includes('@shopify.com'));

  // Se email é inválido OU é do sistema Shopify, tentar extrair email real do cliente
  if (!finalFromEmail || !finalFromEmail.includes('@') || isShopifySystemEmail) {
    // Tentar usar Reply-To como fallback
    if (email.reply_to && email.reply_to.includes('@') && !email.reply_to.toLowerCase().includes('@shopify')) {
      console.log(`[saveIncomingEmail] Usando Reply-To (${email.reply_to}) como fallback para from_email`);
      finalFromEmail = email.reply_to;
    } else {
      // Tentar extrair do corpo do email (formulários Shopify)
      // Passar tanto body_text quanto body_html para melhor extração
      const extracted = extractEmailFromShopifyContactForm(email.body_text || '', email.body_html || '');

      if (extracted) {
        console.log(`[saveIncomingEmail] Email extraído do formulário Shopify: ${extracted.email}, Nome: ${extracted.name}`);
        finalFromEmail = extracted.email;
        finalFromName = extracted.name || finalFromName;
      } else if (isShopifySystemEmail) {
        // Se é email do Shopify mas não conseguiu extrair, logar para debug
        console.log(`[saveIncomingEmail] AVISO: Email do Shopify (${email.from_email}) mas não conseguiu extrair email do cliente do corpo`);
      }
    }
  }

  // Se ainda não encontrou email válido, marcar como falha
  if (!finalFromEmail || !finalFromEmail.includes('@')) {
    const conversationId = await getOrCreateConversation(
      shopId,
      'unknown@invalid.local',
      email.subject || '',
      email.in_reply_to || undefined
    );

    await saveMessage({
      conversation_id: conversationId,
      from_email: '',
      from_name: email.from_name,
      to_email: email.to_email,
      subject: email.subject,
      body_text: email.body_text,
      body_html: email.body_html,
      message_id: email.message_id,
      in_reply_to: email.in_reply_to,
      references_header: email.references,
      has_attachments: email.has_attachments,
      attachment_count: email.attachment_count,
      direction: 'inbound',
      status: 'failed',
      error_message: 'Email do remetente inválido ou ausente',
      received_at: email.received_at.toISOString(),
    });

    return;
  }

  const conversationId = await getOrCreateConversation(
    shopId,
    finalFromEmail,
    email.subject || '',
    email.in_reply_to || undefined
  );

  // Usar nome do email se disponível, senão tentar extrair do endereço de email
  const customerName = finalFromName || extractNameFromEmail(finalFromEmail);
  if (customerName) {
    // Buscar conversa para verificar se já tem nome
    const supabase = getSupabaseClient();
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('customer_name')
      .eq('id', conversationId)
      .single();

    // Atualizar se não tiver nome ou se o nome atual for vazio
    if (!existingConv?.customer_name) {
      await updateConversation(conversationId, { customer_name: customerName });
    }
  }

  await saveMessage({
    conversation_id: conversationId,
    from_email: finalFromEmail,
    from_name: finalFromName,
    to_email: email.to_email,
    subject: email.subject,
    body_text: email.body_text,
    body_html: email.body_html,
    message_id: email.message_id,
    in_reply_to: email.in_reply_to,
    references_header: email.references,
    has_attachments: email.has_attachments,
    attachment_count: email.attachment_count,
    direction: 'inbound',
    status: 'pending',
    received_at: email.received_at.toISOString(),
  });

  await logProcessingEvent({
    shop_id: shopId,
    conversation_id: conversationId,
    event_type: 'email_received',
    event_data: {
      from: finalFromEmail,
      subject: email.subject,
      has_attachments: email.has_attachments,
      extracted_from_body: email.from_email !== finalFromEmail,
    },
  });

  // Armazenar imagens em cache para uso durante o processamento
  // Usamos message_id como chave pois é único
  if (email.images && email.images.length > 0) {
    emailImagesCache.set(email.message_id, {
      images: email.images,
      timestamp: Date.now(),
    });
    console.log(`[saveIncomingEmail] ${email.images.length} imagem(s) armazenada(s) em cache para message_id ${email.message_id}`);
  }
}

/**
 * Processa uma mensagem pendente
 */
async function processMessage(
  shop: Shop,
  message: Message & { conversation?: Conversation },
  emailCredentials: Awaited<ReturnType<typeof decryptEmailCredentials>>
): Promise<'replied' | 'pending_credits' | 'forwarded_human' | 'spam' | 'skipped' | 'acknowledgment'> {
  if (!emailCredentials) return 'skipped';

  const conversation = message.conversation as Conversation | undefined;
  if (!conversation) return 'skipped';

  // CONTROLE DE CONCORRÊNCIA: Verificar se já está processando esta conversa
  if (conversationsInProcessing.has(conversation.id)) {
    console.log(`[Shop ${shop.name}] Conversa ${conversation.id} já está sendo processada, pulando msg ${message.id}`);
    return 'skipped';
  }

  // Marcar conversa como em processamento
  conversationsInProcessing.add(conversation.id);

  try {
    return await processMessageInternal(shop, message, conversation, emailCredentials);
  } finally {
    // Sempre remover da lista ao terminar
    conversationsInProcessing.delete(conversation.id);
  }
}

/**
 * Lógica interna de processamento de mensagem (separada para controle de concorrência)
 */
async function processMessageInternal(
  shop: Shop,
  message: Message & { conversation?: Conversation },
  conversation: Conversation,
  emailCredentials: NonNullable<Awaited<ReturnType<typeof decryptEmailCredentials>>>
): Promise<'replied' | 'pending_credits' | 'forwarded_human' | 'spam' | 'skipped' | 'acknowledgment'> {
  // Skip Replyna forwarding notifications (emails that were forwarded to human support)
  const messageBody = message.body_text || '';
  const messageSubject = message.subject || '';
  const isForwardingNotification =
    messageBody.includes('Este email foi encaminhado automaticamente pelo Replyna') ||
    messageBody.includes('This email was automatically forwarded by Replyna') ||
    messageSubject.startsWith('[ENCAMINHADO]') ||
    messageSubject.startsWith('[FORWARDED]');

  if (isForwardingNotification) {
    console.log(`[processMessage] Message ${message.id} is a Replyna forwarding notification, skipping`);
    await updateMessage(message.id, {
      status: 'replied',
      error_message: 'Skipped - Replyna forwarding notification',
      processed_at: new Date().toISOString(),
    });
    return 'skipped';
  }

  // PRIMEIRO: Tentar extrair email de formulários Shopify se from_email está vazio ou é do sistema Shopify
  const fromLower = (message.from_email || '').toLowerCase();
  const isEmptyOrInvalid = !message.from_email || !message.from_email.includes('@');
  const isShopifySystem = fromLower.includes('mailer@shopify') || fromLower.includes('@shopify.com');

  if (isEmptyOrInvalid || isShopifySystem) {
    // Tentar extrair email do cliente do corpo da mensagem (formulários Shopify)
    const extracted = extractEmailFromShopifyContactForm(message.body_text || '', message.body_html || '');

    if (extracted && extracted.email) {
      console.log(`[processMessage] Email extraído do formulário: ${extracted.email}, Nome: ${extracted.name}`);
      message.from_email = extracted.email;
      if (extracted.name && !message.from_name) {
        message.from_name = extracted.name;
      }

      // Atualizar no banco
      await updateMessage(message.id, {
        from_email: extracted.email,
        from_name: extracted.name || message.from_name,
      });

      // Atualizar email do cliente na conversa
      if (!conversation.customer_email || conversation.customer_email === 'mailer@shopify.com' ||
          conversation.customer_email.includes('@shopify.com') || conversation.customer_email === 'unknown@invalid.local') {
        await updateConversation(conversation.id, {
          customer_email: extracted.email,
          customer_name: extracted.name || conversation.customer_name,
        });
      }
    } else if (isEmptyOrInvalid) {
      // Email inválido e não conseguiu extrair de formulário
      await updateMessage(message.id, {
        status: 'failed',
        category: 'spam',
        error_message: 'Email do remetente inválido',
      });
      return 'skipped';
    } else {
      // É email Shopify mas não conseguiu extrair - marcar como falha
      await updateMessage(message.id, {
        status: 'failed',
        category: 'spam',
        error_message: 'Formulário Shopify: não foi possível extrair email do cliente',
      });
      return 'skipped';
    }
  }

  // Outros padrões de emails de sistema que devem ser ignorados
  const systemEmailPatterns = [
    'mailer-daemon@',
    'postmaster@',
    'mail-delivery-subsystem@',
    'noreply@',
    'no-reply@',
    'donotreply@',
    'auto-reply',
    'autoreply',
    'automated',
    'notification',
    'bounce',
    'failure',
    'undeliverable',
    'support@shopify',
    'notifications@shopify',
    // Outros sistemas
    '@paypal.com',
    '@stripe.com',
    '@asaas.com.br',
  ];

  // Verificar se é outro tipo de email de sistema (não Shopify, já tratado acima)
  const updatedFromLower = message.from_email.toLowerCase();
  if (systemEmailPatterns.some(pattern => updatedFromLower.includes(pattern))) {
    // Outros emails de sistema - ignorar
    await updateMessage(message.id, {
      status: 'failed',
      category: 'spam',
      error_message: 'Email de sistema ignorado',
    });
    return 'skipped';
  }

  await updateMessage(message.id, { status: 'processing' });

  const startTime = Date.now();

  // 1. Limpar corpo do email (movido para antes do crédito para permitir spam check)
  let cleanBody = cleanEmailBody(message.body_text || '', message.body_html || '');

  if ((!cleanBody || cleanBody.trim().length < 3) && message.subject && message.subject.trim().length > 3) {
    cleanBody = message.subject;
  }

  if (!cleanBody || cleanBody.trim().length < 3) {
    await updateMessage(message.id, {
      status: 'failed',
      category: 'spam', // Emails vazios são tratados como spam
      error_message: 'Corpo e assunto do email vazios',
    });
    return 'skipped';
  }

  // 1.05 Detectar notificações de sistema do Shopify (chargeback, disputa, alertas admin)
  // NÃO são mensagens de cliente - ignorar sem enviar resposta
  const originalBodyText = message.body_text || message.body_html || '';
  if (isShopifySystemNotification(originalBodyText)) {
    console.log(`[Shop ${shop.name}] Msg ${message.id} is Shopify system notification, skipping`);
    await updateMessage(message.id, {
      status: 'replied',
      error_message: 'Skipped - Shopify system notification (not a customer message)',
      processed_at: new Date().toISOString(),
    });
    return 'skipped';
  }

  // 1.1 PRÉ-CLASSIFICAÇÃO: Detectar spam por padrões ANTES de gastar créditos
  if (isSpamByPattern(message.subject || '', cleanBody)) {
    console.log(`[Shop ${shop.name}] Msg ${message.id} detectada como spam por padrão (pré-AI)`);
    await updateMessage(message.id, {
      status: 'failed',
      category: 'spam',
      category_confidence: 0.98,
      error_message: 'Spam detectado por padrão (cold outreach/template)',
      processed_at: new Date().toISOString(),
    });

    await updateConversation(conversation.id, {
      category: 'spam',
      status: 'closed',
    });

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'spam_pattern_detected',
      event_data: {
        subject: message.subject,
        body_preview: cleanBody.substring(0, 150),
        reason: 'Pre-AI pattern-based spam detection',
      },
    });

    return 'spam';
  }

  // 2. Verificar créditos
  const user = await getUserById(shop.user_id);
  if (!user) {
    await updateMessage(message.id, {
      status: 'failed',
      category: 'duvidas_gerais', // Categoria padrão para erros de sistema
      error_message: 'Usuário não encontrado',
    });
    return 'skipped';
  }

  // Verificar se o usuário tem assinatura ativa
  if (user.status !== 'active') {
    console.log(`[Shop ${shop.name}] Usuário ${user.id} com status '${user.status}' - pagamento pendente/inativo, pulando msg ${message.id}`);
    await updateMessage(message.id, {
      status: 'pending_credits',
      error_message: user.status === 'suspended'
        ? 'Pagamento pendente - aguardando regularização'
        : `Assinatura inativa (status: ${user.status})`,
    });
    return 'skipped';
  }

  // 2.1 Verificar se é apenas uma mensagem de agradecimento/confirmação (ANTES de gastar créditos)
  if (isAcknowledgmentMessage(cleanBody, message.subject || '')) {
    console.log(`[Shop ${shop.name}] Msg ${message.id} é agradecimento, marcando como replied sem responder`);
    await updateMessage(message.id, {
      status: 'replied',
      category: 'acknowledgment',
      error_message: 'Mensagem de agradecimento - não requer resposta',
      processed_at: new Date().toISOString(),
    });

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'acknowledgment_skipped',
      event_data: {
        body_preview: cleanBody.substring(0, 100),
        reason: 'Mensagem de agradecimento/confirmação',
      },
    });

    return 'acknowledgment';
  }

  // 2.2 Verificar se há loop de auto-responder (ANTES de gastar créditos)
  const supabase = getSupabaseClient();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data: recentOutboundMessages, error: loopCheckError } = await supabase
    .from('messages')
    .select('id, created_at')
    .eq('conversation_id', conversation.id)
    .eq('direction', 'outbound')
    .gte('created_at', twoHoursAgo)
    .order('created_at', { ascending: false });

  if (!loopCheckError && recentOutboundMessages && recentOutboundMessages.length >= 5) {
    console.log(`[Shop ${shop.name}] LOOP DETECTADO: ${recentOutboundMessages.length} respostas nas últimas 2h para conversa ${conversation.id}`);
    await updateMessage(message.id, {
      status: 'replied',
      category: 'auto-responder-loop',
      error_message: `Loop detectado: ${recentOutboundMessages.length} respostas em 2h - não respondendo para evitar spam`,
      processed_at: new Date().toISOString(),
    });

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'loop_detected',
      event_data: {
        recent_outbound_count: recentOutboundMessages.length,
        reason: 'Possível loop de auto-responder detectado',
      },
    });

    return 'loop_detected';
  }

  // 2.3 Reservar crédito (apenas após verificações gratuitas confirmarem que precisa processar)
  const creditReserved = await tryReserveCredit(user.id);
  if (!creditReserved) {
    await updateMessage(message.id, {
      status: 'pending_credits',
      category: 'duvidas_gerais', // Categoria padrão temporária até ter créditos
    });
    await handleCreditsExhausted(shop, user, message);
    return 'pending_credits';
  }

  // Envolver processamento pós-crédito em try/catch para rollback em caso de falha
  try {

  // 3. Buscar histórico da conversa
  const history = await getConversationHistory(conversation.id, 10);
  const conversationHistory = history.map((m) => ({
    role: m.direction === 'inbound' ? ('customer' as const) : ('assistant' as const),
    content: cleanEmailBody(m.body_text || '', m.body_html || ''),
  }));

  // 4. Classificar email
  const classification = await classifyEmail(
    message.subject || '',
    cleanBody,
    conversationHistory.slice(0, -1),
    message.body_text || '', // rawEmailBody para fallback de idioma
  );

  await updateMessage(message.id, {
    category: classification.category,
    category_confidence: classification.confidence,
  });

  await updateConversation(conversation.id, {
    category: classification.category,
    language: classification.language,
  });

  await logProcessingEvent({
    shop_id: shop.id,
    message_id: message.id,
    conversation_id: conversation.id,
    event_type: 'email_classified',
    event_data: classification,
  });

  // 4.1 Se for spam
  if (classification.category === 'spam') {
    await updateMessage(message.id, {
      status: 'failed',
      category: 'spam',
      category_confidence: classification.confidence,
      error_message: 'Email classificado como spam',
    });

    await updateConversation(conversation.id, {
      category: 'spam',
      status: 'closed',
    });

    return 'spam';
  }

  // 5. Buscar dados do Shopify
  let shopifyData: OrderSummary | null = null;
  const shopifyCredentials = await decryptShopifyCredentials(shop);

  if (shopifyCredentials) {
    const orderNumber =
      extractOrderNumber(message.subject || '') ||
      extractOrderNumber(cleanBody) ||
      conversation.shopify_order_id;

    // Tentar buscar com email do remetente primeiro
    shopifyData = await getOrderDataForAI(
      shopifyCredentials,
      message.from_email,
      orderNumber
    );

    // Se não encontrou, tentar com emails alternativos mencionados no corpo
    if (!shopifyData) {
      // Extrair emails mencionados no corpo da mensagem (cliente pode ter usado outro email)
      const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
      const mentionedEmails = cleanBody.match(emailPattern) || [];

      // Filtrar emails que são diferentes do remetente
      const alternativeEmails = mentionedEmails
        .filter(email => email.toLowerCase() !== message.from_email.toLowerCase())
        .filter((email, index, self) => self.indexOf(email) === index); // Remover duplicados

      for (const altEmail of alternativeEmails) {
        console.log(`[Shop ${shop.name}] Tentando email alternativo: ${altEmail}`);
        shopifyData = await getOrderDataForAI(
          shopifyCredentials,
          altEmail,
          orderNumber
        );
        if (shopifyData) {
          console.log(`[Shop ${shop.name}] Pedido encontrado com email alternativo: ${altEmail}`);
          break;
        }
      }
    }

    if (shopifyData) {
      await updateConversation(conversation.id, {
        shopify_order_id: shopifyData.order_number,
        customer_name: shopifyData.customer_name,
      });
    }
  }

  // 6. Gerar resposta
  let responseResult: { response: string; tokens_input: number; tokens_output: number };
  let finalStatus: 'replied' | 'pending_human' = 'replied';

  // Categorias que precisam de dados do pedido: rastreio e troca_devolucao_reembolso
  // Categorias que NÃO precisam: duvidas_gerais (perguntas gerais sem pedido)
  const categoriesWithoutOrderData = ['duvidas_gerais'];
  const needsOrderData = !categoriesWithoutOrderData.includes(classification.category);

  if (classification.category === 'suporte_humano') {
    responseResult = await generateHumanFallbackMessage(
      {
        name: shop.name,
        attendant_name: shop.attendant_name,
        support_email: shop.support_email,
        tone_of_voice: shop.tone_of_voice,
        fallback_message_template: shop.fallback_message_template,
      },
      shopifyData?.customer_name || conversation.customer_name,
      classification.language
    );
    finalStatus = 'pending_human';
    try {
      await forwardToHuman(shop, message, emailCredentials);
    } catch (fwdError) {
      console.error(`[processMessage] Erro ao encaminhar para humano (msg ${message.id}), mas resposta ao cliente será enviada:`, fwdError);
    }
  } else if (!shopifyData && needsOrderData) {
    // CORREÇÃO: Verificar se já temos número de pedido antes de pedir ao cliente
    const knownOrderNumber = conversation.shopify_order_id
      || extractOrderNumber(message.subject || '')
      || extractOrderNumber(cleanBody)
      || extractOrderNumber(message.body_text || '');

    if (knownOrderNumber) {
      // Temos número de pedido mas Shopify não retornou dados - criar contexto mínimo
      // para que a IA responda com o que temos (NUNCA pedir tracking ao cliente)
      shopifyData = {
        order_number: knownOrderNumber.startsWith('#') ? knownOrderNumber : `#${knownOrderNumber}`,
        order_date: '',
        order_status: '',
        order_total: '',
        tracking_number: null,
        tracking_url: null,
        fulfillment_status: null,
        items: [],
        customer_name: conversation.customer_name || message.from_name || null,
      };
      console.log(`[process-emails] Order number ${knownOrderNumber} found but Shopify data unavailable, using minimal context`);

      if (!conversation.shopify_order_id) {
        await updateConversation(conversation.id, {
          shopify_order_id: knownOrderNumber,
        });
      }
      // NÃO set responseResult - vai cair no else abaixo para generateResponse
    } else if (conversation.data_request_count < MAX_DATA_REQUESTS) {
      // CORREÇÃO: Se já pedimos dados antes e o cliente respondeu com email mas não encontramos
      // pedido, NÃO pedir de novo — deixar cair no generateResponse() que vai informar ao cliente.
      const customerProvidedEmail = (cleanBody.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || []).length > 0;
      const alreadyAskedOnce = (conversation.data_request_count || 0) >= 1;

      if (alreadyAskedOnce && customerProvidedEmail) {
        console.log(`[process-emails] Customer provided email but order not found in Shopify. Skipping data request, proceeding to generateResponse.`);
        // NÃO set responseResult — vai cair no generateResponse() abaixo
      } else {
      // Sem número de pedido - pedir APENAS número do pedido (nunca tracking)
      responseResult = await generateDataRequestMessage(
        {
          name: shop.name,
          attendant_name: shop.attendant_name,
          tone_of_voice: shop.tone_of_voice,
        },
        message.subject || '',
        cleanBody,
        conversation.data_request_count + 1,
        classification.language
      );

      await updateConversation(conversation.id, {
        data_request_count: conversation.data_request_count + 1,
      });
      }
    } else {
      // MAX_DATA_REQUESTS excedido sem número de pedido - escalar para humano
      responseResult = await generateHumanFallbackMessage(
        {
          name: shop.name,
          attendant_name: shop.attendant_name,
          support_email: shop.support_email,
          tone_of_voice: shop.tone_of_voice,
          fallback_message_template: shop.fallback_message_template,
        },
        null,
        classification.language
      );
      finalStatus = 'pending_human';
      try {
        await forwardToHuman(shop, message, emailCredentials);
      } catch (fwdError) {
        console.error(`[processMessage] Erro ao encaminhar para humano (msg ${message.id}), mas resposta ao cliente será enviada:`, fwdError);
      }
    }
  }

  // @ts-ignore - responseResult pode não estar inicializado se caiu nos branches de shopifyData
  if (!responseResult) {
    // Buscar imagens do cache se disponíveis
    const cachedEntry = message.message_id ? emailImagesCache.get(message.message_id) : undefined;
    const cachedImages = cachedEntry?.images;
    if (cachedImages && cachedImages.length > 0) {
      console.log(`[processMessage] ${cachedImages.length} imagem(s) encontrada(s) no cache para análise visual`);
    }

    // Lógica de retenção: incrementar contador se for cancelamento/devolução
    let retentionContactCount = conversation.retention_contact_count || 0;
    if (classification.category === 'troca_devolucao_reembolso') {
      retentionContactCount += 1;
      await updateConversation(conversation.id, {
        retention_contact_count: retentionContactCount,
      });
      console.log(`[processMessage] Retenção: contato #${retentionContactCount} para conversa ${conversation.id}`);
    }

    responseResult = await generateResponse(
      {
        name: shop.name,
        attendant_name: shop.attendant_name,
        tone_of_voice: shop.tone_of_voice,
        store_description: shop.store_description,
        delivery_time: shop.delivery_time,
        dispatch_time: shop.dispatch_time,
        warranty_info: shop.warranty_info,
        signature_html: shop.signature_html,
        is_cod: shop.is_cod,
        store_email: shop.imap_user || shop.support_email,
        support_email: shop.support_email,
        retention_coupon_code: shop.retention_coupon_code,
        retention_coupon_type: shop.retention_coupon_type,
        retention_coupon_value: shop.retention_coupon_value,
      },
      message.subject || '',
      cleanBody,
      classification.category,
      conversationHistory,
      shopifyData,
      classification.language,
      retentionContactCount,
      [], // additionalOrders
      cachedImages || [], // imagens do email para análise visual
      classification.sentiment || 'calm',
      conversation.status, // para loop detection pular exchange_count se pending_human
    );

    // Se a IA detectou que é terceiro contato de cancelamento, encaminhar para humano
    if (responseResult.forward_to_human) {
      finalStatus = 'pending_human';
      try {
        await forwardToHuman(shop, message, emailCredentials);
      } catch (fwdError) {
        console.error(`[processMessage] Erro ao encaminhar para humano (msg ${message.id}), mas resposta ao cliente será enviada:`, fwdError);
      }
    }

    // Limpar imagens do cache após processamento
    if (message.message_id) {
      emailImagesCache.delete(message.message_id);
    }
  }

  await logProcessingEvent({
    shop_id: shop.id,
    message_id: message.id,
    event_type: 'response_generated',
    tokens_input: responseResult.tokens_input,
    tokens_output: responseResult.tokens_output,
    processing_time_ms: Date.now() - startTime,
  });

  // 7. Enviar resposta
  const replyHeaders = buildReplyHeaders(message.message_id || '', message.references_header);

  const sendResult = await sendEmail(emailCredentials, {
    to: message.from_email,
    subject: buildReplySubject(message.subject),
    body_text: responseResult.response,
    from_name: shop.attendant_name,
    in_reply_to: replyHeaders.in_reply_to,
    references: replyHeaders.references,
  });

  if (!sendResult.success) {
    await updateMessage(message.id, {
      status: 'failed',
      error_message: sendResult.error || 'Erro ao enviar email',
    });
    throw new Error(sendResult.error || 'Erro ao enviar email');
  }

  // 8. Salvar resposta enviada
  await saveMessage({
    conversation_id: conversation.id,
    from_email: emailCredentials.smtp_user,
    from_name: shop.attendant_name,
    to_email: message.from_email,
    subject: buildReplySubject(message.subject),
    body_text: responseResult.response,
    message_id: sendResult.message_id,
    in_reply_to: replyHeaders.in_reply_to,
    references_header: replyHeaders.references,
    direction: 'outbound',
    status: 'replied',
    was_auto_replied: true,
    tokens_input: responseResult.tokens_input,
    tokens_output: responseResult.tokens_output,
    replied_at: new Date().toISOString(),
  });

  // 9. Atualizar mensagem original
  await updateMessage(message.id, {
    status: finalStatus === 'pending_human' ? 'pending_human' : 'replied',
    was_auto_replied: true,
    auto_reply_message_id: sendResult.message_id,
    tokens_input: responseResult.tokens_input,
    tokens_output: responseResult.tokens_output,
    processed_at: new Date().toISOString(),
    replied_at: new Date().toISOString(),
  });

  // 10. Crédito já foi reservado atomicamente no início (tryReserveCredit)
  // Não precisa mais chamar incrementEmailsUsed aqui

  // 10.1 Cobrança automática de extras DESATIVADA
  // Quando o usuário atingir o limite, o sistema para de processar (pending_credits).
  // Não cobra extras automaticamente.
  // await checkAndChargeExtraEmails(user.id, shop.id);

  // 11. Atualizar status da conversation
  await updateConversation(conversation.id, {
    status: finalStatus === 'pending_human' ? 'pending_human' : 'replied',
  });

  await logProcessingEvent({
    shop_id: shop.id,
    message_id: message.id,
    event_type: 'response_sent',
    event_data: {
      message_id_sent: sendResult.message_id,
      status: finalStatus,
    },
    processing_time_ms: Date.now() - startTime,
  });

  return finalStatus === 'pending_human' ? 'forwarded_human' : 'replied';

  } catch (creditError) {
    // Rollback do crédito reservado que não foi utilizado com sucesso
    console.error(`[processMessage] Erro após reserva de crédito, fazendo rollback:`, creditError);
    try {
      const released = await releaseCredit(user.id);
      if (released) {
        console.log(`[processMessage] Crédito devolvido com sucesso para user ${user.id}`);
      }
    } catch (rollbackError) {
      console.error(`[processMessage] Falha ao devolver crédito para user ${user.id}:`, rollbackError);
    }
    throw creditError; // Re-throw para o error handler externo tratar o status da mensagem
  }
}

/**
 * Encaminha email para suporte humano
 */
async function forwardToHuman(
  shop: Shop,
  message: Message,
  emailCredentials: NonNullable<Awaited<ReturnType<typeof decryptEmailCredentials>>>
): Promise<void> {
  if (!shop.support_email) {
    console.warn(`[forwardToHuman] Shop ${shop.name} não tem support_email configurado, não é possível encaminhar msg ${message.id}`);
    return;
  }

  const forwardSubject = `[ENCAMINHADO] ${message.subject || 'Sem assunto'} - De: ${message.from_email}`;

  const forwardBody = `
Este email foi encaminhado automaticamente pelo Replyna porque requer atendimento humano.

═══════════════════════════════════════
DADOS DO CLIENTE
═══════════════════════════════════════
Email: ${message.from_email}
Nome: ${message.from_name || 'Não informado'}

═══════════════════════════════════════
MENSAGEM ORIGINAL
═══════════════════════════════════════
Assunto: ${message.subject || 'Sem assunto'}
Data: ${message.received_at || message.created_at}

${message.body_text || message.body_html || '(Sem conteúdo)'}

═══════════════════════════════════════
Responda diretamente ao cliente em: ${message.from_email}
`;

  await sendEmail(emailCredentials, {
    to: shop.support_email,
    subject: forwardSubject,
    body_text: forwardBody,
    from_name: 'Replyna Bot',
  });

  await logProcessingEvent({
    shop_id: shop.id,
    message_id: message.id,
    event_type: 'forwarded_to_human',
    event_data: {
      forwarded_to: shop.support_email,
      reason: 'suporte_humano',
    },
  });
}

/**
 * Lida com créditos esgotados
 */
async function handleCreditsExhausted(
  shop: Shop,
  user: Awaited<ReturnType<typeof getUserById>>,
  message: Message
): Promise<void> {
  if (!user) return;

  const lastWarning = user.last_credits_warning_at ? new Date(user.last_credits_warning_at) : null;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  if (lastWarning && lastWarning > oneHourAgo) return;

  const emailCredentials = await decryptEmailCredentials(shop);
  if (!emailCredentials) return;

  const notificationSubject = '⚠️ Replyna: Email não respondido - Créditos esgotados';
  const notificationBody = `
Olá ${user.name || 'Admin'},

Sua loja ${shop.name} recebeu um novo email de cliente, mas não foi possível responder porque seus créditos acabaram.

═══════════════════════════════════════
📧 EMAIL NÃO RESPONDIDO
═══════════════════════════════════════
De: ${message.from_email}
Assunto: ${message.subject || 'Sem assunto'}
Recebido em: ${message.received_at || message.created_at}

═══════════════════════════════════════
📊 SEU USO ATUAL
═══════════════════════════════════════
Emails usados: ${user.emails_used} / ${user.emails_limit}
Plano: ${user.plan}

═══════════════════════════════════════
🔄 PARA VOLTAR A RESPONDER
═══════════════════════════════════════
• Faça upgrade do seu plano
• Compre créditos avulsos

Acesse: https://app.replyna.me/account

—
Replyna - Atendimento Inteligente
`;

  await sendEmail(emailCredentials, {
    to: user.email,
    subject: notificationSubject,
    body_text: notificationBody,
    from_name: 'Replyna',
  });

  await updateCreditsWarning(user.id);

  await logProcessingEvent({
    shop_id: shop.id,
    message_id: message.id,
    event_type: 'credits_exhausted',
    event_data: {
      user_email: user.email,
      emails_used: user.emails_used,
      emails_limit: user.emails_limit,
    },
  });
}

/**
 * Verifica se o usuário excedeu o limite e precisa cobrar pacote de emails extras
 */
async function checkAndChargeExtraEmails(userId: string, shopId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: user } = await supabase
    .from('users')
    .select('id, emails_used, emails_limit, extra_emails_purchased, extra_emails_used, pending_extra_emails')
    .eq('id', userId)
    .single();

  if (!user) return;

  if (user.emails_used <= user.emails_limit) return;

  const { data: billingCheck } = await supabase.rpc('increment_pending_extra_email', {
    p_user_id: userId,
  });

  if (!billingCheck || billingCheck.length === 0) return;

  const result = billingCheck[0];

  if (result.needs_billing) {
    console.log(`[Billing] Usuário ${userId} atingiu ${result.new_pending_count} emails extras - cobrando pacote`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    try {
      const chargeResponse = await fetch(
        `${supabaseUrl}/functions/v1/charge-extra-emails`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ user_id: userId }),
        }
      );

      const chargeResult = await chargeResponse.json();

      if (chargeResult.success) {
        console.log(`[Billing] Pacote de emails extras cobrado: ${chargeResult.invoice_id}`);

        await logProcessingEvent({
          shop_id: shopId,
          event_type: 'extra_emails_charged',
          event_data: {
            user_id: userId,
            package_size: result.package_size,
            amount: result.total_amount,
            invoice_id: chargeResult.invoice_id,
          },
        });
      } else {
        console.error('[Billing] Erro ao cobrar emails extras:', chargeResult.error);

        await logProcessingEvent({
          shop_id: shopId,
          event_type: 'extra_emails_charge_failed',
          error_message: chargeResult.error,
          event_data: {
            user_id: userId,
            package_size: result.package_size,
            amount: result.total_amount,
          },
        });
      }
    } catch (error) {
      console.error('[Billing] Erro ao chamar charge-extra-emails:', error);

      await logProcessingEvent({
        shop_id: shopId,
        event_type: 'extra_emails_charge_error',
        error_message: error instanceof Error ? error.message : 'Erro desconhecido',
        event_data: { user_id: userId },
      });
    }
  }
}
```

---

## 9) supabase/functions/process-shop-emails/index.ts

```ts
/**
 * Edge Function: process-shop-emails (Worker)
 *
 * Processa emails de UMA loja específica.
 * Chamada pelo orquestrador (process-emails) para cada loja ativa.
 *
 * Input: { shop_id: string, max_emails?: number, max_messages?: number }
 * Output: ShopStats
 */

// deno-lint-ignore-file no-explicit-any
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

import {
  getSupabaseClient,
  getUserById,
  tryReserveCredit,
  checkCreditsAvailable,  // Mantido para verificações não-atômicas
  incrementEmailsUsed,  // Mantido para compatibilidade
  getOrCreateConversation,
  saveMessage,
  updateMessage,
  getPendingMessages,
  getConversationHistory,
  updateConversation,
  logProcessingEvent,
  updateShopEmailSync,
  updateCreditsWarning,
  type Shop,
  type Message,
  type Conversation,
} from '../_shared/supabase.ts';

import {
  decryptEmailCredentials,
  fetchUnreadEmails,
  markEmailsAsSeen,
  sendEmail,
  buildReplyHeaders,
  buildReplySubject,
  cleanEmailBody,
  extractNameFromEmail,
  type IncomingEmail,
} from '../_shared/email.ts';

import {
  decryptShopifyCredentials,
  getOrderDataForAI,
  extractOrderNumber,
  type OrderSummary,
} from '../_shared/shopify.ts';

import {
  classifyEmail,
  generateResponse,
  generateDataRequestMessage,
  generateHumanFallbackMessage,
  isSpamByPattern,
} from '../_shared/anthropic.ts';

// Constantes
const DEFAULT_MAX_EMAILS = 10;
const DEFAULT_MAX_MESSAGES = 15;
const MAX_DATA_REQUESTS = 3;
const MAX_CONCURRENT_MESSAGES = 3; // Mais paralelo já que é apenas 1 loja
const MAX_EXECUTION_TIME_MS = 110000; // 110 segundos (limite real é 120s)

/**
 * Extrai email do cliente do corpo de um formulário de contato do Shopify
 */
function extractEmailFromShopifyContactForm(bodyText: string): { email: string; name: string | null } | null {
  if (!bodyText) return null;

  const emailLinePattern = /(?:E-?mail|email):\s*\n?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
  const emailMatch = bodyText.match(emailLinePattern);

  if (!emailMatch) return null;

  const email = emailMatch[1].toLowerCase();

  const namePattern = /(?:Name|Nome):\s*\n?\s*([^\n]+)/i;
  const nameMatch = bodyText.match(namePattern);
  const name = nameMatch ? nameMatch[1].trim() : null;

  return { email, name };
}

// Tipos
interface ShopStats {
  shop_id: string;
  shop_name: string;
  emails_received: number;
  emails_replied: number;
  emails_pending_credits: number;
  emails_forwarded_human: number;
  emails_spam: number;
  errors: number;
  duration_ms: number;
}

interface WorkerInput {
  shop_id: string;
  max_emails?: number;
  max_messages?: number;
}

/**
 * Verifica se ainda há tempo disponível para processamento
 */
function hasTimeRemaining(startTime: number): boolean {
  return Date.now() - startTime < MAX_EXECUTION_TIME_MS;
}

/**
 * Handler principal da Edge Function (Worker)
 */
Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const input: WorkerInput = await req.json();
    const { shop_id, max_emails = DEFAULT_MAX_EMAILS, max_messages = DEFAULT_MAX_MESSAGES } = input;

    if (!shop_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'shop_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Worker] Iniciando processamento da loja ${shop_id}`);

    // Buscar loja pelo ID
    const supabase = getSupabaseClient();
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shop_id)
      .eq('is_active', true)
      .single();

    if (shopError || !shop) {
      console.error(`[Worker] Loja ${shop_id} não encontrada ou inativa:`, shopError);
      return new Response(
        JSON.stringify({ success: false, error: 'Loja não encontrada ou inativa' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Processar a loja
    const stats = await processShop(shop as Shop, startTime, max_emails, max_messages);

    const duration = Date.now() - startTime;
    console.log(`[Worker] Loja ${shop.name} concluída em ${duration}ms:`, stats);

    return new Response(
      JSON.stringify({
        success: true,
        stats: { ...stats, duration_ms: duration },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Worker] Erro fatal:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Processa uma loja específica
 */
async function processShop(
  shop: Shop,
  startTime: number,
  maxEmails: number,
  maxMessages: number
): Promise<Omit<ShopStats, 'duration_ms'>> {
  const stats: Omit<ShopStats, 'duration_ms'> = {
    shop_id: shop.id,
    shop_name: shop.name,
    emails_received: 0,
    emails_replied: 0,
    emails_pending_credits: 0,
    emails_forwarded_human: 0,
    emails_spam: 0,
    errors: 0,
  };

  console.log(`[Worker] Processando loja: ${shop.name} (${shop.id})`);

  // 1. Decriptar credenciais de email
  const emailCredentials = await decryptEmailCredentials(shop);
  if (!emailCredentials) {
    console.log(`[Worker] Loja ${shop.id} sem credenciais de email válidas`);
    return stats;
  }

  // 2. Buscar emails não lidos via IMAP
  let emailStartDate: Date | null = null;
  if (shop.email_start_mode === 'from_integration_date' && shop.email_start_date) {
    emailStartDate = new Date(shop.email_start_date);
    console.log(`[Worker] Loja ${shop.id}: Modo from_integration_date, ignorando emails anteriores a ${emailStartDate.toISOString()}`);
  }

  let incomingEmails: IncomingEmail[] = [];
  try {
    incomingEmails = await fetchUnreadEmails(emailCredentials, maxEmails, emailStartDate);
    console.log(`[Worker] Loja ${shop.id}: ${incomingEmails.length} emails não lidos`);
    stats.emails_received = incomingEmails.length;
  } catch (error) {
    console.error(`[Worker] Erro ao buscar emails da loja ${shop.id}:`, error);
    await updateShopEmailSync(shop.id, error instanceof Error ? error.message : 'Erro ao conectar IMAP');
    throw error;
  }

  // 3. Salvar emails no banco e marcar como lidos no IMAP após salvar
  const shopEmail = emailCredentials.smtp_user.toLowerCase();
  const savedUids: number[] = [];
  for (const email of incomingEmails) {
    if (email.from_email.toLowerCase() === shopEmail) {
      console.log(`[Worker] Ignorando email de ${email.from_email} (própria loja)`);
      if (email.imap_uid) savedUids.push(email.imap_uid); // Marcar próprios emails como lidos também
      continue;
    }
    try {
      await saveIncomingEmail(shop.id, email);
      if (email.imap_uid) savedUids.push(email.imap_uid);
    } catch (error) {
      console.error(`[Worker] Erro ao salvar email ${email.message_id}:`, error);
      stats.errors++;
    }
  }

  // Marcar como lidos apenas emails salvos com sucesso
  if (savedUids.length > 0) {
    try {
      await markEmailsAsSeen(emailCredentials, savedUids);
    } catch (error) {
      console.error(`[Worker] Erro ao marcar emails como lidos:`, error);
    }
  }

  // 4. Processar emails pendentes
  const allPendingMessages = await getPendingMessages(shop.id);
  const pendingMessages = allPendingMessages.slice(0, maxMessages);
  console.log(`[Worker] Loja ${shop.id}: ${allPendingMessages.length} pendentes, processando ${pendingMessages.length}`);

  // Processar mensagens em paralelo
  for (let i = 0; i < pendingMessages.length; i += MAX_CONCURRENT_MESSAGES) {
    if (!hasTimeRemaining(startTime)) {
      console.log(`[Worker] Loja ${shop.id}: Timeout, ${pendingMessages.length - i} msgs restantes`);
      break;
    }

    const batch = pendingMessages.slice(i, i + MAX_CONCURRENT_MESSAGES);
    console.log(`[Worker] Loja ${shop.id}: Batch de ${batch.length} mensagens`);

    const batchResults = await Promise.allSettled(
      batch.map(async (message) => {
        try {
          return await processMessage(shop, message, emailCredentials);
        } catch (error) {
          console.error(`[Worker] Erro ao processar mensagem ${message.id}:`, error);
          await updateMessage(message.id, {
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Erro desconhecido',
          });
          throw error;
        }
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        const outcome = result.value;
        if (outcome === 'replied') stats.emails_replied++;
        else if (outcome === 'pending_credits') stats.emails_pending_credits++;
        else if (outcome === 'forwarded_human') stats.emails_forwarded_human++;
        else if (outcome === 'spam') stats.emails_spam++;
      } else {
        stats.errors++;
      }
    }
  }

  // 5. Atualizar timestamp de sync
  await updateShopEmailSync(shop.id);

  return stats;
}

/**
 * Salva um email recebido no banco
 */
async function saveIncomingEmail(shopId: string, email: IncomingEmail): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from('messages')
    .select('id')
    .eq('message_id', email.message_id)
    .single();

  if (existing) {
    console.log(`[Worker] Email ${email.message_id} já existe, ignorando`);
    return;
  }

  let finalFromEmail = email.from_email;
  let finalFromName = email.from_name;

  if (!finalFromEmail || !finalFromEmail.includes('@')) {
    const bodyContent = email.body_text || email.body_html || '';
    const extracted = extractEmailFromShopifyContactForm(bodyContent);

    if (extracted) {
      console.log(`[Worker] Email extraído do formulário Shopify: ${extracted.email}`);
      finalFromEmail = extracted.email;
      finalFromName = extracted.name || finalFromName;
    } else {
      console.log(`[Worker] Email ${email.message_id}: from_email vazio e não extraído do corpo`);

      const conversationId = await getOrCreateConversation(
        shopId,
        'unknown@invalid.local',
        email.subject || '',
        email.in_reply_to || undefined
      );

      await saveMessage({
        conversation_id: conversationId,
        from_email: '',
        from_name: email.from_name,
        to_email: email.to_email,
        subject: email.subject,
        body_text: email.body_text,
        body_html: email.body_html,
        message_id: email.message_id,
        in_reply_to: email.in_reply_to,
        references_header: email.references,
        has_attachments: email.has_attachments,
        attachment_count: email.attachment_count,
        direction: 'inbound',
        status: 'failed',
        error_message: 'Email do remetente inválido ou ausente (não extraído do corpo)',
        received_at: email.received_at.toISOString(),
      });

      return;
    }
  }

  const conversationId = await getOrCreateConversation(
    shopId,
    finalFromEmail,
    email.subject || '',
    email.in_reply_to || undefined
  );

  // Usar nome do email se disponível, senão tentar extrair do endereço de email
  const customerName = finalFromName || extractNameFromEmail(finalFromEmail);
  if (customerName) {
    // Buscar conversa para verificar se já tem nome
    const supabase = getSupabaseClient();
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('customer_name')
      .eq('id', conversationId)
      .single();

    // Atualizar se não tiver nome ou se o nome atual for vazio
    if (!existingConv?.customer_name) {
      await updateConversation(conversationId, { customer_name: customerName });
    }
  }

  await saveMessage({
    conversation_id: conversationId,
    from_email: finalFromEmail,
    from_name: finalFromName,
    to_email: email.to_email,
    subject: email.subject,
    body_text: email.body_text,
    body_html: email.body_html,
    message_id: email.message_id,
    in_reply_to: email.in_reply_to,
    references_header: email.references,
    has_attachments: email.has_attachments,
    attachment_count: email.attachment_count,
    direction: 'inbound',
    status: 'pending',
    received_at: email.received_at.toISOString(),
  });

  await logProcessingEvent({
    shop_id: shopId,
    conversation_id: conversationId,
    event_type: 'email_received',
    event_data: {
      from: finalFromEmail,
      subject: email.subject,
      has_attachments: email.has_attachments,
      extracted_from_body: email.from_email !== finalFromEmail,
    },
  });
}

/**
 * Processa uma mensagem pendente
 */
async function processMessage(
  shop: Shop,
  message: Message & { conversation?: Conversation },
  emailCredentials: Awaited<ReturnType<typeof decryptEmailCredentials>>
): Promise<'replied' | 'pending_credits' | 'forwarded_human' | 'spam' | 'skipped'> {
  if (!emailCredentials) return 'skipped';

  const conversation = message.conversation as Conversation | undefined;
  if (!conversation) return 'skipped';

  if (!message.from_email || !message.from_email.includes('@')) {
    console.log(`[Worker] Pulando mensagem ${message.id}: from_email inválido`);
    await updateMessage(message.id, {
      status: 'failed',
      error_message: 'Email do remetente inválido ou ausente',
    });
    return 'skipped';
  }

  const systemEmailPatterns = [
    'mailer-daemon@',
    'postmaster@',
    'mail-delivery-subsystem@',
    'noreply@',
    'no-reply@',
    'donotreply@',
    'auto-reply',
    'autoreply',
    'automated',
    'notification',
    'bounce',
    'failure',
    'undeliverable',
    // Shopify system emails - NUNCA responder
    '@shopify.com',
    'mailer@shopify',
    'support@shopify',
    'notifications@shopify',
    // Outros sistemas
    '@paypal.com',
    '@stripe.com',
    '@asaas.com.br',
  ];
  const fromLower = message.from_email.toLowerCase();
  if (systemEmailPatterns.some(pattern => fromLower.includes(pattern))) {
    console.log(`[Worker] Pulando mensagem ${message.id}: email de sistema`);
    await updateMessage(message.id, {
      status: 'failed',
      error_message: 'Email de sistema ignorado',
    });
    return 'skipped';
  }

  // Skip Replyna forwarding notifications (emails that were forwarded to human support)
  const messageBody = message.body_text || '';
  const messageSubject = message.subject || '';
  const isForwardingNotification =
    messageBody.includes('Este email foi encaminhado automaticamente pelo Replyna') ||
    messageBody.includes('This email was automatically forwarded by Replyna') ||
    messageSubject.startsWith('[ENCAMINHADO]') ||
    messageSubject.startsWith('[FORWARDED]');

  if (isForwardingNotification) {
    console.log(`[Worker] Message ${message.id} is a Replyna forwarding notification, skipping`);
    await updateMessage(message.id, {
      status: 'replied',
      error_message: 'Skipped - Replyna forwarding notification',
      processed_at: new Date().toISOString(),
    });
    return 'skipped';
  }

  await updateMessage(message.id, { status: 'processing' });

  const startTime = Date.now();

  // 0.5 PRÉ-CLASSIFICAÇÃO: Detectar spam por padrões ANTES de gastar créditos
  const preCleanBody = cleanEmailBody(message.body_text || '', message.body_html || '');
  if (isSpamByPattern(message.subject || '', preCleanBody || message.body_text || '')) {
    console.log(`[Worker] Msg ${message.id} detectada como spam por padrão (pré-AI)`);
    await updateMessage(message.id, {
      status: 'failed',
      category: 'spam',
      category_confidence: 0.98,
      error_message: 'Spam detectado por padrão (cold outreach/template)',
      processed_at: new Date().toISOString(),
    });

    await updateConversation(conversation.id, {
      category: 'spam',
      status: 'closed',
    });

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'spam_pattern_detected',
      event_data: {
        subject: message.subject,
        body_preview: (preCleanBody || message.body_text || '').substring(0, 150),
        reason: 'Pre-AI pattern-based spam detection',
      },
    });

    return 'spam';
  }

  // 1. Verificar créditos
  const user = await getUserById(shop.user_id);
  if (!user) {
    await updateMessage(message.id, { status: 'failed', error_message: 'Usuário não encontrado' });
    return 'skipped';
  }

  // Verificar se o usuário tem assinatura ativa
  if (user.status !== 'active') {
    console.log(`[Worker] Usuário ${user.id} com status '${user.status}' - pagamento pendente/inativo, pulando msg ${message.id}`);
    await updateMessage(message.id, {
      status: 'pending_credits',
      error_message: user.status === 'suspended'
        ? 'Pagamento pendente - aguardando regularização'
        : `Assinatura inativa (status: ${user.status})`,
    });
    return 'skipped';
  }

  // 2. Verificar corpo do email (ANTES de gastar créditos - reutiliza preCleanBody)
  let cleanBody = preCleanBody;

  if ((!cleanBody || cleanBody.trim().length < 3) && message.subject && message.subject.trim().length > 3) {
    console.log(`[Worker] Corpo vazio, usando assunto: "${message.subject}"`);
    cleanBody = message.subject;
  }

  if (!cleanBody || cleanBody.trim().length < 3) {
    console.log(`[Worker] Pulando mensagem ${message.id}: corpo e assunto vazios`);
    await updateMessage(message.id, {
      status: 'failed',
      error_message: 'Corpo e assunto do email vazios',
    });
    return 'skipped';
  }

  // 2.1 Reservar crédito (apenas após verificações gratuitas confirmarem que precisa processar)
  const creditReserved = await tryReserveCredit(user.id);
  if (!creditReserved) {
    await updateMessage(message.id, { status: 'pending_credits' });
    await handleCreditsExhausted(shop, user, message);
    return 'pending_credits';
  }

  // 3. Buscar histórico da conversa
  const history = await getConversationHistory(conversation.id, 10);
  const conversationHistory = history.map((m) => ({
    role: m.direction === 'inbound' ? ('customer' as const) : ('assistant' as const),
    content: cleanEmailBody(m.body_text || '', m.body_html || ''),
  }));

  // 4. Classificar email
  const classification = await classifyEmail(
    message.subject || '',
    cleanBody,
    conversationHistory.slice(0, -1),
    message.body_text || '', // rawEmailBody para fallback de idioma
  );

  await updateMessage(message.id, {
    category: classification.category,
    category_confidence: classification.confidence,
  });

  await updateConversation(conversation.id, {
    category: classification.category,
    language: classification.language,
  });

  await logProcessingEvent({
    shop_id: shop.id,
    message_id: message.id,
    conversation_id: conversation.id,
    event_type: 'email_classified',
    event_data: classification,
  });

  // 4.1 Se for spam, marcar e não responder
  if (classification.category === 'spam') {
    console.log(`[Worker] Email ${message.id} classificado como SPAM`);

    await updateMessage(message.id, {
      status: 'failed',
      category: 'spam',
      category_confidence: classification.confidence,
      error_message: 'Email classificado como spam',
    });

    await updateConversation(conversation.id, {
      category: 'spam',
      status: 'closed',
    });

    return 'spam';
  }

  // 5. Buscar dados do Shopify
  let shopifyData: OrderSummary | null = null;
  const shopifyCredentials = await decryptShopifyCredentials(shop);

  if (shopifyCredentials) {
    const orderNumber =
      extractOrderNumber(message.subject || '') ||
      extractOrderNumber(cleanBody) ||
      conversation.shopify_order_id;

    shopifyData = await getOrderDataForAI(
      shopifyCredentials,
      message.from_email,
      orderNumber
    );

    if (shopifyData) {
      await updateConversation(conversation.id, {
        shopify_order_id: shopifyData.order_number,
        customer_name: shopifyData.customer_name,
      });
    }
  }

  // 6. Gerar resposta
  let responseResult: { response: string; tokens_input: number; tokens_output: number };
  let finalStatus: 'replied' | 'pending_human' = 'replied';

  // Categorias que precisam de dados do pedido: rastreio e troca_devolucao_reembolso
  // Categorias que NÃO precisam: duvidas_gerais (perguntas gerais sem pedido)
  const categoriesWithoutOrderData = ['duvidas_gerais'];
  const needsOrderData = !categoriesWithoutOrderData.includes(classification.category);

  if (classification.category === 'suporte_humano') {
    responseResult = await generateHumanFallbackMessage(
      {
        name: shop.name,
        attendant_name: shop.attendant_name,
        support_email: shop.support_email,
        tone_of_voice: shop.tone_of_voice,
        fallback_message_template: shop.fallback_message_template,
      },
      shopifyData?.customer_name || conversation.customer_name,
      classification.language
    );
    finalStatus = 'pending_human';
    await forwardToHuman(shop, message, emailCredentials);
  } else if (!shopifyData && needsOrderData && conversation.data_request_count < MAX_DATA_REQUESTS) {
    responseResult = await generateDataRequestMessage(
      {
        name: shop.name,
        attendant_name: shop.attendant_name,
        tone_of_voice: shop.tone_of_voice,
      },
      message.subject || '',
      cleanBody,
      conversation.data_request_count + 1,
      classification.language
    );

    await updateConversation(conversation.id, {
      data_request_count: conversation.data_request_count + 1,
    });
  } else if (!shopifyData && needsOrderData && conversation.data_request_count >= MAX_DATA_REQUESTS) {
    responseResult = await generateHumanFallbackMessage(
      {
        name: shop.name,
        attendant_name: shop.attendant_name,
        support_email: shop.support_email,
        tone_of_voice: shop.tone_of_voice,
        fallback_message_template: shop.fallback_message_template,
      },
      null,
      classification.language
    );
    finalStatus = 'pending_human';
    await forwardToHuman(shop, message, emailCredentials);
  } else {
    responseResult = await generateResponse(
      {
        name: shop.name,
        attendant_name: shop.attendant_name,
        tone_of_voice: shop.tone_of_voice,
        store_description: shop.store_description,
        delivery_time: shop.delivery_time,
        dispatch_time: shop.dispatch_time,
        warranty_info: shop.warranty_info,
        signature_html: shop.signature_html,
        is_cod: shop.is_cod,
        store_email: shop.imap_user || shop.support_email,
      },
      message.subject || '',
      cleanBody,
      classification.category,
      conversationHistory,
      shopifyData,
      classification.language,
      0, // retentionContactCount
      [], // additionalOrders
      [], // emailImages
      classification.sentiment || 'calm',
      conversation.status, // para loop detection pular exchange_count se pending_human
    );

    // Se a IA detectou que é terceiro contato de cancelamento, encaminhar para humano
    if (responseResult.forward_to_human) {
      finalStatus = 'pending_human';
      await forwardToHuman(shop, message, emailCredentials);
    }
  }

  await logProcessingEvent({
    shop_id: shop.id,
    message_id: message.id,
    event_type: 'response_generated',
    tokens_input: responseResult.tokens_input,
    tokens_output: responseResult.tokens_output,
    processing_time_ms: Date.now() - startTime,
  });

  // 7. Enviar resposta
  const replyHeaders = buildReplyHeaders(message.message_id || '', message.references_header);

  const sendResult = await sendEmail(emailCredentials, {
    to: message.from_email,
    subject: buildReplySubject(message.subject),
    body_text: responseResult.response,
    from_name: shop.attendant_name,
    in_reply_to: replyHeaders.in_reply_to,
    references: replyHeaders.references,
  });

  if (!sendResult.success) {
    await updateMessage(message.id, {
      status: 'failed',
      error_message: sendResult.error || 'Erro ao enviar email',
    });
    throw new Error(sendResult.error || 'Erro ao enviar email');
  }

  // 8. Salvar resposta enviada
  await saveMessage({
    conversation_id: conversation.id,
    from_email: emailCredentials.smtp_user,
    from_name: shop.attendant_name,
    to_email: message.from_email,
    subject: buildReplySubject(message.subject),
    body_text: responseResult.response,
    message_id: sendResult.message_id,
    in_reply_to: replyHeaders.in_reply_to,
    references_header: replyHeaders.references,
    direction: 'outbound',
    status: 'replied',
    was_auto_replied: true,
    tokens_input: responseResult.tokens_input,
    tokens_output: responseResult.tokens_output,
    replied_at: new Date().toISOString(),
  });

  // 9. Atualizar mensagem original
  await updateMessage(message.id, {
    status: finalStatus === 'pending_human' ? 'pending_human' : 'replied',
    was_auto_replied: true,
    auto_reply_message_id: sendResult.message_id,
    tokens_input: responseResult.tokens_input,
    tokens_output: responseResult.tokens_output,
    processed_at: new Date().toISOString(),
    replied_at: new Date().toISOString(),
  });

  // 10. Crédito já foi reservado atomicamente no início (tryReserveCredit)
  // Não precisa mais chamar incrementEmailsUsed aqui

  // 10.1 Cobrança automática de extras DESATIVADA
  // Quando o usuário atingir o limite, o sistema para de processar (pending_credits).
  // Não cobra extras automaticamente.
  // await checkAndChargeExtraEmails(user.id, shop.id);

  // 11. Atualizar status da conversation
  await updateConversation(conversation.id, {
    status: finalStatus === 'pending_human' ? 'pending_human' : 'replied',
  });

  await logProcessingEvent({
    shop_id: shop.id,
    message_id: message.id,
    event_type: 'response_sent',
    event_data: {
      message_id_sent: sendResult.message_id,
      status: finalStatus,
    },
    processing_time_ms: Date.now() - startTime,
  });

  return finalStatus === 'pending_human' ? 'forwarded_human' : 'replied';
}

/**
 * Encaminha email para suporte humano
 */
async function forwardToHuman(
  shop: Shop,
  message: Message,
  emailCredentials: NonNullable<Awaited<ReturnType<typeof decryptEmailCredentials>>>
): Promise<void> {
  const forwardSubject = `[ENCAMINHADO] ${message.subject || 'Sem assunto'} - De: ${message.from_email}`;

  const forwardBody = `
Este email foi encaminhado automaticamente pelo Replyna porque requer atendimento humano.

═══════════════════════════════════════
DADOS DO CLIENTE
═══════════════════════════════════════
Email: ${message.from_email}
Nome: ${message.from_name || 'Não informado'}

═══════════════════════════════════════
MENSAGEM ORIGINAL
═══════════════════════════════════════
Assunto: ${message.subject || 'Sem assunto'}
Data: ${message.received_at || message.created_at}

${message.body_text || message.body_html || '(Sem conteúdo)'}

═══════════════════════════════════════
Responda diretamente ao cliente em: ${message.from_email}
`;

  await sendEmail(emailCredentials, {
    to: shop.support_email,
    subject: forwardSubject,
    body_text: forwardBody,
    from_name: 'Replyna Bot',
  });

  await logProcessingEvent({
    shop_id: shop.id,
    message_id: message.id,
    event_type: 'forwarded_to_human',
    event_data: {
      forwarded_to: shop.support_email,
      reason: 'suporte_humano',
    },
  });
}

/**
 * Lida com créditos esgotados
 */
async function handleCreditsExhausted(
  shop: Shop,
  user: Awaited<ReturnType<typeof getUserById>>,
  message: Message
): Promise<void> {
  if (!user) return;

  const lastWarning = user.last_credits_warning_at ? new Date(user.last_credits_warning_at) : null;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  if (lastWarning && lastWarning > oneHourAgo) return;

  const emailCredentials = await decryptEmailCredentials(shop);
  if (!emailCredentials) return;

  const notificationSubject = '⚠️ Replyna: Email não respondido - Créditos esgotados';
  const notificationBody = `
Olá ${user.name || 'Admin'},

Sua loja ${shop.name} recebeu um novo email de cliente, mas não foi possível responder porque seus créditos acabaram.

═══════════════════════════════════════
📧 EMAIL NÃO RESPONDIDO
═══════════════════════════════════════
De: ${message.from_email}
Assunto: ${message.subject || 'Sem assunto'}
Recebido em: ${message.received_at || message.created_at}

═══════════════════════════════════════
📊 SEU USO ATUAL
═══════════════════════════════════════
Emails usados: ${user.emails_used} / ${user.emails_limit}
Plano: ${user.plan}

═══════════════════════════════════════
🔄 PARA VOLTAR A RESPONDER
═══════════════════════════════════════
• Faça upgrade do seu plano
• Compre créditos avulsos

Acesse: https://app.replyna.me/account

—
Replyna - Atendimento Inteligente
`;

  await sendEmail(emailCredentials, {
    to: user.email,
    subject: notificationSubject,
    body_text: notificationBody,
    from_name: 'Replyna',
  });

  await updateCreditsWarning(user.id);

  await logProcessingEvent({
    shop_id: shop.id,
    message_id: message.id,
    event_type: 'credits_exhausted',
    event_data: {
      user_email: user.email,
      emails_used: user.emails_used,
      emails_limit: user.emails_limit,
    },
  });
}

/**
 * Verifica se o usuário excedeu o limite e precisa cobrar pacote de emails extras
 */
async function checkAndChargeExtraEmails(userId: string, shopId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: user } = await supabase
    .from('users')
    .select('id, emails_used, emails_limit, extra_emails_purchased, extra_emails_used, pending_extra_emails')
    .eq('id', userId)
    .single();

  if (!user) return;

  if (user.emails_used <= user.emails_limit) return;

  const { data: billingCheck } = await supabase.rpc('increment_pending_extra_email', {
    p_user_id: userId,
  });

  if (!billingCheck || billingCheck.length === 0) return;

  const result = billingCheck[0];

  if (result.needs_billing) {
    console.log(`[Worker] Usuário ${userId} atingiu ${result.new_pending_count} emails extras - cobrando pacote`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    try {
      const chargeResponse = await fetch(
        `${supabaseUrl}/functions/v1/charge-extra-emails`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ user_id: userId }),
        }
      );

      const chargeResult = await chargeResponse.json();

      if (chargeResult.success) {
        console.log(`[Worker] Pacote de emails extras cobrado: ${chargeResult.invoice_id}`);

        await logProcessingEvent({
          shop_id: shopId,
          event_type: 'extra_emails_charged',
          event_data: {
            user_id: userId,
            package_size: result.package_size,
            amount: result.total_amount,
            invoice_id: chargeResult.invoice_id,
          },
        });
      } else {
        console.error('[Worker] Erro ao cobrar emails extras:', chargeResult.error);

        await logProcessingEvent({
          shop_id: shopId,
          event_type: 'extra_emails_charge_failed',
          error_message: chargeResult.error,
          event_data: {
            user_id: userId,
            package_size: result.package_size,
            amount: result.total_amount,
          },
        });
      }
    } catch (error) {
      console.error('[Worker] Erro ao chamar charge-extra-emails:', error);

      await logProcessingEvent({
        shop_id: shopId,
        event_type: 'extra_emails_charge_error',
        error_message: error instanceof Error ? error.message : 'Erro desconhecido',
        event_data: { user_id: userId },
      });
    }
  }
}
```

---

## 10) supabase/functions/process-queue/processor.ts

```ts
/**
 * Email Processing Logic
 *
 * Extração e adaptação da lógica de processamento de process-emails/index.ts
 * para trabalhar com a arquitetura de filas.
 *
 * CORRIGIDO: Todas as chamadas de função agora usam as assinaturas corretas
 * dos módulos _shared.
 */

// deno-lint-ignore-file no-explicit-any

import {
  getUserById,
  tryReserveCredit,
  releaseCredit,
  incrementEmailsUsed,  // Mantido para compatibilidade
  updateMessage,
  getConversationHistory,
  updateConversation,
  logProcessingEvent,
  saveMessage,
  notifyCreditsExhausted,
  type Message,
  type Conversation,
  type Shop,
} from '../_shared/supabase.ts';

import {
  sendEmail,
  buildReplyHeaders,
  buildReplySubject,
  cleanEmailBody,
  decryptEmailCredentials,
} from '../_shared/email.ts';

import {
  decryptShopifyCredentials,
  getOrderDataForAI,
  getMultipleOrdersDataForAI,
  extractOrderNumber,
  extractAllOrderNumbers,
  isShopifyCircuitOpen,
  recordShopifyFailure,
  recordShopifySuccess,
  type OrderSummary,
} from '../_shared/shopify.ts';

import {
  classifyEmail,
  generateResponse,
  generateDataRequestMessage,
  generateHumanFallbackMessage,
} from '../_shared/anthropic.ts';

const MAX_DATA_REQUESTS = 3;

// System email patterns to ignore (expanded list)
const systemEmailPatterns = [
  'no-reply',
  'noreply',
  'mailer-daemon',
  'postmaster',
  'bounce',
  'do-not-reply',
  'donotreply',
  'daemon',
  'auto-reply',
  'autoreply',
  'automated',
  'notification',
  'notifications',
  'alert@',
  'alerts@',
  'system@',
  'admin@',
  'mail-daemon',
  'failure',
  'undeliverable',
  'returned',
  // Shopify system emails - NUNCA responder
  '@shopify.com',
  'mailer@shopify',
  'support@shopify',
  'notifications@shopify',
  'help@shopify',
  'noreply@shopify',
  // Outros sistemas de e-commerce
  '@paypal.com',
  '@stripe.com',
  '@asaas.com.br',
  '@mailchimp.com',
  '@klaviyo.com',
  '@sendgrid.com',
];

// Padrões específicos de email do Shopify que podem conter email do cliente no corpo
const shopifyContactFormPatterns = [
  'mailer@shopify',
  '@shopify.com',
];

/**
 * Extrai email do cliente do corpo de um formulário de contato do Shopify
 * Lida com diferentes formatos: texto puro e HTML com tags entre "Email:" e o endereço
 */
function extractEmailFromShopifyContactForm(bodyText: string, bodyHtml?: string): { email: string; name: string | null } | null {
  if (!bodyText && !bodyHtml) return null;

  // Padrões para extrair email - do mais específico ao mais genérico
  const emailPatterns = [
    // Padrão 1: "Email:" seguido diretamente pelo email (texto puro)
    /(?:E-?mail|email):\s*\n?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    // Padrão 2: "Email:" com tags HTML no meio (ex: <b>Email:</b><pre>email@test.com</pre>)
    /(?:E-?mail|email):<\/b>\s*(?:<[^>]*>)*\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    // Padrão 3: Qualquer formato com "Email:" e email na mesma região
    /(?:E-?mail|email):[^@]*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
  ];

  // Padrões para extrair nome
  const namePatterns = [
    /(?:Name|Nome):\s*\n?\s*([^\n<]+)/i,
    /(?:Name|Nome):<\/b>\s*(?:<[^>]*>)*\s*([^<\n]+)/i,
  ];

  let email: string | null = null;
  let name: string | null = null;

  // Tentar extrair do texto primeiro
  if (bodyText) {
    for (const pattern of emailPatterns) {
      const match = bodyText.match(pattern);
      if (match && match[1]) {
        email = match[1].toLowerCase().trim();
        break;
      }
    }

    for (const pattern of namePatterns) {
      const match = bodyText.match(pattern);
      if (match && match[1] && match[1].trim()) {
        name = match[1].trim();
        break;
      }
    }
  }

  // Se não encontrou no texto, tentar no HTML
  if (!email && bodyHtml) {
    for (const pattern of emailPatterns) {
      const match = bodyHtml.match(pattern);
      if (match && match[1]) {
        email = match[1].toLowerCase().trim();
        break;
      }
    }

    if (!name) {
      for (const pattern of namePatterns) {
        const match = bodyHtml.match(pattern);
        if (match && match[1] && match[1].trim()) {
          name = match[1].trim();
          break;
        }
      }
    }
  }

  if (!email) return null;

  // Limpar nome de possíveis tags HTML residuais
  if (name) {
    name = name.replace(/<[^>]*>/g, '').trim();
  }

  return { email, name };
}

/**
 * Verifica se o email é de um formulário de contato do Shopify
 */
function isShopifyContactFormEmail(fromEmail: string): boolean {
  const fromLower = (fromEmail || '').toLowerCase();
  return shopifyContactFormPatterns.some(pattern => fromLower.includes(pattern));
}

/**
 * Processa um job de email da fila
 *
 * IMPORTANTE: Se ocorrer erro APÓS marcar mensagem como 'processing',
 * a mensagem é resetada para 'pending' para evitar ficar presa.
 */
export async function processMessageFromQueue(job: any, supabase: any): Promise<void> {
  const { message_id, shop_id } = job;

  // Load message from database
  const { data: message, error: messageError } = await supabase
    .from('messages')
    .select('*')
    .eq('id', message_id)
    .single();

  if (messageError || !message) {
    throw new Error(`Message not found: ${message_id}`);
  }

  // Load shop
  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .select('*')
    .eq('id', shop_id)
    .single();

  if (shopError || !shop) {
    throw new Error(`Shop not found: ${shop_id}`);
  }

  // Load conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', message.conversation_id)
    .single();

  if (convError || !conversation) {
    throw new Error(`Conversation not found: ${message.conversation_id}`);
  }

  // Try to acquire advisory lock for conversation (prevent duplicate processing)
  const { data: lockAcquired } = await supabase.rpc('try_lock_conversation', {
    p_conversation_id: conversation.id,
  });

  if (!lockAcquired) {
    console.log(`[Processor] Conversation ${conversation.id} is locked by another worker, skipping`);
    throw new Error('Conversation locked'); // Will retry later
  }

  // Track if we set status to 'processing' so we can reset on error
  let markedAsProcessing = false;

  try {
    // Process the message
    markedAsProcessing = await processMessage(message, conversation, shop, supabase);
  } catch (error: any) {
    // Se a mensagem foi marcada como 'processing' e ocorreu erro,
    // resetar para 'pending' para que o cleanup não precise intervir
    if (markedAsProcessing) {
      console.log(`[Processor] Error after marking as processing, resetting message ${message_id} to pending`);
      try {
        await updateMessage(message_id, { status: 'pending' });
      } catch (resetError: any) {
        console.error(`[Processor] Failed to reset message status:`, resetError.message);
      }
    }
    // Re-throw para o process-queue tratar (retry ou DLQ)
    throw error;
  }
}

/**
 * Lógica principal de processamento de email
 * Adaptado de process-emails/index.ts
 *
 * @returns boolean - true se a mensagem foi marcada como 'processing', false caso contrário
 */
async function processMessage(
  message: Message,
  conversation: Conversation,
  shop: Shop,
  _supabase: any
): Promise<boolean> {
  console.log(`[Processor] Processing message ${message.id} from ${message.from_email}`);

  // Check if message was already successfully processed (prevent duplicate processing)
  // NOTA: Não verificamos 'processing' aqui porque mensagens em 'processing' podem ter sido
  // resetadas pelo cleanup e precisam ser reprocessadas
  if (message.status === 'replied') {
    console.log(`[Processor] Message ${message.id} already replied, skipping`);
    return false;
  }

  // Skip Replyna forwarding notifications (emails that were forwarded to human support)
  const messageBody = message.body_text || '';
  const messageSubject = message.subject || '';
  const isForwardingNotification =
    messageBody.includes('Este email foi encaminhado automaticamente pelo Replyna') ||
    messageBody.includes('This email was automatically forwarded by Replyna') ||
    messageSubject.startsWith('[ENCAMINHADO]') ||
    messageSubject.startsWith('[FORWARDED]');

  if (isForwardingNotification) {
    console.log(`[Processor] Message ${message.id} is a Replyna forwarding notification, skipping`);
    await updateMessage(message.id, {
      status: 'replied',
      error_message: 'Skipped - Replyna forwarding notification',
      processed_at: new Date().toISOString(),
    });
    return false;
  }

  // Skip Shopify system notifications (chargeback, dispute, order alerts, etc.)
  // Estes são emails administrativos do Shopify, NÃO mensagens de clientes.
  // Marcamos como 'replied' SEM enviar resposta para que a próxima mensagem real do cliente seja processada.
  if (isShopifySystemNotification(messageBody)) {
    console.log(`[Processor] Message ${message.id} is a Shopify system notification (chargeback/dispute/alert), skipping`);
    await updateMessage(message.id, {
      status: 'replied',
      error_message: 'Skipped - Shopify system notification (not a customer message)',
      processed_at: new Date().toISOString(),
    });
    return false; // false = não conta como 'processing', não envia resposta
  }

  // Check if there's a recent reply to this conversation (prevent duplicate responses)
  // Reduced from 30 min to 3 min - 30 min was too aggressive and caused legitimate follow-up messages to be skipped
  const recentReplyCheck = await getConversationHistory(conversation.id, 5);
  const recentOutbound = (recentReplyCheck || []).filter((msg: Message) =>
    msg.direction === 'outbound' &&
    msg.was_auto_replied === true &&
    msg.created_at > new Date(Date.now() - 3 * 60 * 1000).toISOString() // Last 3 minutes
  );

  if (recentOutbound.length > 0) {
    console.log(`[Processor] Conversation ${conversation.id} already has recent auto-reply (${recentOutbound.length} in last 3min), skipping to avoid duplicate`);
    await updateMessage(message.id, {
      status: 'replied',
      error_message: 'Skipped - recent auto-reply exists',
      processed_at: new Date().toISOString(),
    });
    return false;
  }

  // Mark as processing
  await updateMessage(message.id, { status: 'processing' });

  // 1. Tentar extrair email de formulários Shopify ANTES de validar
  const isEmptyOrInvalid = !message.from_email || !message.from_email.includes('@');
  const isShopifySystem = isShopifyContactFormEmail(message.from_email || '');

  if (isEmptyOrInvalid || isShopifySystem) {
    // Tentar extrair email do cliente do corpo da mensagem (formulários Shopify)
    const extracted = extractEmailFromShopifyContactForm(message.body_text || '', message.body_html || '');

    if (extracted && extracted.email) {
      console.log(`[Processor] Email extraído do formulário Shopify: ${extracted.email}, Nome: ${extracted.name}`);
      message.from_email = extracted.email;
      if (extracted.name && !message.from_name) {
        message.from_name = extracted.name;
      }

      // Atualizar no banco
      await updateMessage(message.id, {
        from_email: extracted.email,
        from_name: extracted.name || message.from_name,
      });

      // Atualizar email do cliente na conversa se necessário
      if (!conversation.customer_email ||
          conversation.customer_email === 'unknown@invalid.local' ||
          isShopifyContactFormEmail(conversation.customer_email)) {
        await updateConversation(conversation.id, {
          customer_email: extracted.email,
          customer_name: extracted.name || conversation.customer_name,
        });
      }
    } else if (isEmptyOrInvalid) {
      // Email inválido e não conseguiu extrair de formulário
      await updateMessage(message.id, {
        status: 'failed',
        error_message: 'Email do remetente inválido',
      });
      throw new Error('Email do remetente inválido');
    } else {
      // É email Shopify mas não conseguiu extrair - marcar como falha
      await updateMessage(message.id, {
        status: 'failed',
        error_message: 'Formulário Shopify: não foi possível extrair email do cliente',
      });
      console.log(`[Processor] Shopify contact form but could not extract customer email from body`);
      throw new Error('Formulário Shopify: não foi possível extrair email do cliente');
    }
  }

  // 2. Ignorar outros emails de sistema (não Shopify, já tratado acima)
  const fromLower = message.from_email.toLowerCase();
  const nonShopifySystemPatterns = systemEmailPatterns.filter(
    pattern => !shopifyContactFormPatterns.some(sp => pattern.includes(sp.replace('@', '')))
  );
  if (nonShopifySystemPatterns.some((pattern) => fromLower.includes(pattern))) {
    await updateMessage(message.id, {
      status: 'failed',
      error_message: 'Email de sistema ignorado',
    });
    console.log(`[Processor] System email ignored: ${message.from_email}`);
    throw new Error('Email de sistema ignorado');
  }

  // 3. Limpar corpo do email
  const cleanBody = cleanEmailBody(message.body_text || '', message.body_html || '');
  if (!cleanBody || cleanBody.trim().length < 3) {
    await updateMessage(message.id, {
      status: 'failed',
      error_message: 'Corpo do email vazio',
      // NÃO salva categoria para emails vazios
    });
    throw new Error('Corpo do email vazio');
  }

  // 4. Verificar agradecimentos (não responder)
  if (isAcknowledgmentMessage(cleanBody, message.subject || '')) {
    await updateMessage(message.id, {
      status: 'replied',
      category: 'acknowledgment',
      error_message: 'Mensagem de agradecimento - não requer resposta',
      processed_at: new Date().toISOString(),
    });
    return true; // Success without replying - marked as processing before
  }

  // 5. Buscar usuário (dono da loja)
  const user = await getUserById(shop.user_id);
  if (!user) {
    await updateMessage(message.id, {
      status: 'failed',
      error_message: 'Usuário não encontrado',
    });
    throw new Error('Usuário não encontrado');
  }

  // 5.1 Verificar se usuário está com pagamento em dia
  if (user.status === 'suspended' || user.status === 'inactive') {
    console.log(`[Processor] User ${user.id} com status ${user.status} - pagamento pendente`);

    await updateMessage(message.id, {
      status: 'pending_credits',
      error_message: user.status === 'suspended'
        ? 'Pagamento pendente - aguardando regularização'
        : 'Conta inativa - assinatura cancelada',
    });

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'payment_pending',
      event_data: {
        user_status: user.status,
        reason: user.status === 'suspended' ? 'payment_failed' : 'subscription_canceled',
      },
    });

    throw new Error(`Usuário com status ${user.status} - processamento bloqueado`);
  }

  // 6. Buscar histórico da conversa ANTES de classificar
  const rawHistory = await getConversationHistory(conversation.id, 10);
  const conversationHistory = (rawHistory || []).map((msg: Message) => ({
    role: msg.direction === 'inbound' ? ('customer' as const) : ('assistant' as const),
    content: cleanEmailBody(msg.body_text || '', msg.body_html || ''),
  }));

  // 7. Classificar email PRIMEIRO (antes de verificar créditos)
  // Isso garante que a categoria seja salva mesmo sem créditos
  const classification = await classifyEmail(
    message.subject || '',
    cleanBody,
    conversationHistory.slice(0, -1), // Excluir a mensagem atual
    message.body_text || '', // rawEmailBody para fallback de idioma (country code, etc.)
  );

  // 8. Reservar crédito atomicamente (verifica E reserva em uma única transação)
  // Isso evita race condition quando múltiplos emails são processados em paralelo
  const creditReserved = await tryReserveCredit(user.id);
  if (!creditReserved) {
    // Notificar usuário que os créditos acabaram (não cobra automaticamente)
    console.log(`[Processor] User ${user.id} sem créditos - enviando notificação`);
    const notifyResult = await notifyCreditsExhausted(user.id);

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'credits_exhausted_notification',
      event_data: {
        notified: notifyResult.notified,
        error: notifyResult.error,
      },
    });

    // Salvar categoria mesmo sem créditos
    await updateMessage(message.id, {
      status: 'pending_credits',
      category: classification.category,
      category_confidence: classification.confidence,
    });

    // Atualizar conversa com categoria se não tiver
    if (!conversation.category && classification.category !== 'spam') {
      await updateConversation(conversation.id, {
        category: classification.category,
        language: classification.language,
      });
    }

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'pending_credits',
      event_data: {
        category: classification.category,
        confidence: classification.confidence,
        userNotified: notifyResult.notified,
      },
    });

    console.log(`[Processor] Message ${message.id} classified as ${classification.category}, no credits available. User notified: ${notifyResult.notified}`);
    throw new Error('Créditos insuficientes');
  }

  // Envolver processamento pós-crédito em try/catch para rollback em caso de falha
  try {

  // 9. Se for spam, salvar categoria na MENSAGEM (para aparecer no painel), mas NÃO atualizar CONVERSA
  if (classification.category === 'spam') {
    // Salvar categoria 'spam' na MENSAGEM para aparecer no filtro do painel
    await updateMessage(message.id, {
      status: 'failed',
      category: 'spam',
      category_confidence: classification.confidence,
      error_message: 'Email classificado como spam',
      processed_at: new Date().toISOString(),
    });

    // Atualizar a CONVERSA com categoria spam apenas se não tiver categoria ainda
    // Isso permite que o spam apareça no filtro de spam do painel
    if (!conversation.category) {
      await updateConversation(conversation.id, {
        category: 'spam',
      });
    }

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'spam_detected',
      event_data: {
        confidence: classification.confidence,
        summary: classification.summary,
      },
    });

    console.log(`[Processor] Message ${message.id} classified as SPAM, ignoring`);
    return true; // Success without replying - marked as processing before
  }

  // 10. Salvar categoria apenas para emails NÃO-spam
  await updateMessage(message.id, {
    category: classification.category,
    category_confidence: classification.confidence,
  });

  await logProcessingEvent({
    shop_id: shop.id,
    message_id: message.id,
    conversation_id: conversation.id,
    event_type: 'email_classified',
    event_data: {
      category: classification.category,
      confidence: classification.confidence,
      language: classification.language,
    },
  });

  // Update conversation category (apenas para NÃO-spam)
  if (!conversation.category) {
    await updateConversation(conversation.id, {
      category: classification.category,
      language: classification.language,
    });
  } else if (
    classification.category === 'troca_devolucao_reembolso' &&
    conversation.category !== 'troca_devolucao_reembolso'
  ) {
    // Atualizar categoria se escalou para cancelamento/reembolso
    // Isso garante que a categoria da conversa fique consistente com o retention_contact_count
    await updateConversation(conversation.id, {
      category: classification.category,
    });
    console.log(`[Processor] Conversation ${conversation.id} category updated: ${conversation.category} -> troca_devolucao_reembolso`);
  }

  // 10. Buscar dados do Shopify se necessário
  let shopifyData: OrderSummary | null = null;
  let needsOrderData = false;

  const categoriasQueNeedShopify = [
    'rastreio',
    'edicao_pedido',
    'troca_devolucao_reembolso',
  ];

  // Variável para armazenar pedidos adicionais (quando cliente menciona múltiplos)
  let additionalOrders: OrderSummary[] = [];

  if (categoriasQueNeedShopify.includes(classification.category)) {
    needsOrderData = true;

    // CHECK CIRCUIT BREAKER - but continue processing even if open
    const shopifyCircuitOpen = await isShopifyCircuitOpen(shop.id);
    if (shopifyCircuitOpen) {
      console.log(`[Processor] Shopify circuit breaker is OPEN for shop ${shop.id}, continuing without Shopify data`);

      await logProcessingEvent({
        shop_id: shop.id,
        message_id: message.id,
        conversation_id: conversation.id,
        event_type: 'shopify_circuit_open',
        event_data: {
          category: classification.category,
          action: 'continuing_without_shopify',
        },
      });

      // Continue processing - AI will respond without Shopify data
    }

    // Only try Shopify lookup if circuit is not open
    if (!shopifyCircuitOpen) {
    // NOVO: Extrair TODOS os números de pedido de todas as fontes
    const originalBody = message.body_text || message.body_html || '';
    const allOrderNumbers = new Set<string>();

    // Extrair de todas as fontes
    extractAllOrderNumbers(message.subject || '').forEach(n => allOrderNumbers.add(n));
    extractAllOrderNumbers(cleanBody).forEach(n => allOrderNumbers.add(n));
    extractAllOrderNumbers(originalBody).forEach(n => allOrderNumbers.add(n));

    // Também buscar no histórico de mensagens da conversa
    for (const historyMsg of rawHistory || []) {
      extractAllOrderNumbers(historyMsg.subject || '').forEach(n => allOrderNumbers.add(n));
      extractAllOrderNumbers(historyMsg.body_text || '').forEach(n => allOrderNumbers.add(n));
    }

    // Adicionar o número salvo na conversa, se existir
    if (conversation.shopify_order_id) {
      allOrderNumbers.add(conversation.shopify_order_id);
    }

    const orderNumbersArray = Array.from(allOrderNumbers);
    const orderNumber = orderNumbersArray[0] || null; // Primeiro número para compatibilidade

    console.log(`[Processor] Order numbers found: ${orderNumbersArray.join(', ')} (total: ${orderNumbersArray.length})`);

    const shopifyCredentials = await decryptShopifyCredentials(shop);

    if (shopifyCredentials) {
      try {
        // Se houver múltiplos pedidos, buscar todos
        if (orderNumbersArray.length > 1) {
          console.log(`[Processor] Multiple orders detected, fetching all...`);
          const allOrders = await getMultipleOrdersDataForAI(
            shopifyCredentials,
            message.from_email,
            orderNumbersArray
          );

          if (allOrders.length > 0) {
            shopifyData = allOrders[0]; // Primeiro pedido como principal
            additionalOrders = allOrders.slice(1); // Restante como adicionais
            console.log(`[Processor] Found ${allOrders.length} orders: primary=${shopifyData?.order_number}, additional=${additionalOrders.map(o => o.order_number).join(', ')}`);
          }
        } else {
          // Comportamento original para único pedido
          shopifyData = await getOrderDataForAI(
            shopifyCredentials,
            message.from_email,
            orderNumber
          );
        }

        // Se não encontrou com from_email, tentar com emails mencionados no body
        if (!shopifyData) {
          const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
          const mentionedEmails = (cleanBody.match(emailPattern) || [])
            .map((e: string) => e.toLowerCase())
            .filter((e: string) => e !== message.from_email.toLowerCase())
            .filter((e: string, i: number, self: string[]) => self.indexOf(e) === i);

          for (const altEmail of mentionedEmails) {
            console.log(`[Processor] Trying alternative email from body: ${altEmail}`);
            shopifyData = await getOrderDataForAI(shopifyCredentials, altEmail, orderNumber);
            if (shopifyData) {
              console.log(`[Processor] Found order with alternative email: ${altEmail}`);
              break;
            }
          }
        }

        // RECORD SHOPIFY SUCCESS - circuit breaker will close if in half_open
        await recordShopifySuccess(shop.id);

        await logProcessingEvent({
          shop_id: shop.id,
          message_id: message.id,
          conversation_id: conversation.id,
          event_type: 'shopify_lookup',
          event_data: {
            order_numbers: orderNumbersArray,
            found: !!shopifyData,
            additional_orders_count: additionalOrders.length
          },
        });

        if (shopifyData) {
          await updateConversation(conversation.id, {
            shopify_order_id: shopifyData.order_number,
            customer_name: shopifyData.customer_name,
          });
        } else if (orderNumber) {
          // IMPORTANTE: Salvar o número do pedido mesmo se Shopify não encontrou
          console.log(`[Processor] Saving customer-provided order number to conversation: ${orderNumber}`);
          await updateConversation(conversation.id, {
            shopify_order_id: orderNumber,
          });
        }
      } catch (error: any) {
        console.error(`[Processor] Shopify lookup failed:`, error.message);

        // RECORD SHOPIFY FAILURE - may open circuit breaker after 3 failures
        const circuitState = await recordShopifyFailure(shop.id, error.message);
        console.log(`[Processor] Shopify circuit state after failure: ${circuitState}`);

        await logProcessingEvent({
          shop_id: shop.id,
          message_id: message.id,
          conversation_id: conversation.id,
          event_type: 'shopify_lookup_failed',
          event_data: {
            error: error.message,
            circuit_state: circuitState,
            category: classification.category,
          },
        });

        // Save order number and continue without Shopify data - AI will respond with available info
        if (orderNumber && !conversation.shopify_order_id) {
          await updateConversation(conversation.id, {
            shopify_order_id: orderNumber,
          });
        }

        console.log(`[Processor] Continuing without Shopify data, AI will respond with available info`);
      }
    }
    } // end if (!shopifyCircuitOpen)
  }

  // 11. Fluxo de solicitação de dados (se não tiver número do pedido)
  // CORREÇÃO: Se já temos número de pedido (da conversa, do subject, ou do body),
  // NÃO pedir dados ao cliente. Criar contexto mínimo para a IA responder.
  const knownOrderNumber = conversation.shopify_order_id
    || extractOrderNumber(message.subject || '')
    || extractOrderNumber(cleanBody)
    || extractOrderNumber(message.body_text || '');

  // Se temos número de pedido mas Shopify não retornou dados, criar contexto mínimo
  // para que a IA responda com o que temos (NUNCA pedir tracking ao cliente)
  if (needsOrderData && !shopifyData && knownOrderNumber) {
    shopifyData = {
      order_number: knownOrderNumber.startsWith('#') ? knownOrderNumber : `#${knownOrderNumber}`,
      order_date: '',
      order_status: '',
      order_total: '',
      tracking_number: null,
      tracking_url: null,
      fulfillment_status: null,
      items: [],
      customer_name: conversation.customer_name || message.from_name || null,
    };

    console.log(`[Processor] Order number ${knownOrderNumber} found but Shopify data unavailable, using minimal context`);

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'shopify_data_unavailable_with_order',
      event_data: {
        order_number: knownOrderNumber,
        reason: 'shopify_lookup_failed_or_circuit_open',
        action: 'proceeding_with_minimal_context',
      },
    });

    // Salvar order number na conversa se ainda não tiver
    if (!conversation.shopify_order_id) {
      await updateConversation(conversation.id, {
        shopify_order_id: knownOrderNumber,
      });
    }
  }

  // Só pedir dados ao cliente se NÃO temos número de pedido de NENHUMA fonte
  // CORREÇÃO: Se já pedimos dados antes (data_request_count >= 1) e o cliente respondeu
  // com email mas não encontramos pedido, NÃO pedir de novo — informar que não encontrou.
  const customerProvidedEmail = (cleanBody.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || []).length > 0;
  const alreadyAskedOnce = (conversation.data_request_count || 0) >= 1;

  if (alreadyAskedOnce && customerProvidedEmail && needsOrderData && !shopifyData && !knownOrderNumber) {
    console.log(`[Processor] Customer provided email but order not found in Shopify. Skipping data request, proceeding to generateResponse.`);
  }

  if (needsOrderData && !shopifyData && !knownOrderNumber && conversation.data_request_count < MAX_DATA_REQUESTS && !(alreadyAskedOnce && customerProvidedEmail)) {
    // generateDataRequestMessage: (shopContext, emailSubject, emailBody, attemptNumber, language)
    const dataRequestResult = await generateDataRequestMessage(
      {
        name: shop.name,
        attendant_name: shop.attendant_name,
        tone_of_voice: shop.tone_of_voice || 'friendly',
      },
      message.subject || '',
      cleanBody,
      (conversation.data_request_count || 0) + 1,
      classification.language || 'en'
    );

    await sendReply(message, conversation, shop, dataRequestResult.response, 'data_requested');

    await updateConversation(conversation.id, {
      data_request_count: (conversation.data_request_count || 0) + 1,
    });

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'data_requested',
      event_data: { request_count: (conversation.data_request_count || 0) + 1 },
    });

    return true; // Success - marked as processing before
  }

  // 12. Escalate para humano se MAX_DATA_REQUESTS excedido ou categoria suporte_humano
  if (
    classification.category === 'suporte_humano' ||
    (needsOrderData && !shopifyData && !knownOrderNumber && conversation.data_request_count >= MAX_DATA_REQUESTS)
  ) {
    // generateHumanFallbackMessage: (shopContext, customerName, language)
    const humanFallbackResult = await generateHumanFallbackMessage(
      {
        name: shop.name,
        attendant_name: shop.attendant_name,
        support_email: shop.support_email,
        tone_of_voice: shop.tone_of_voice || 'friendly',
        fallback_message_template: shop.fallback_message_template,
      },
      shopifyData?.customer_name || conversation.customer_name || message.from_name || null,
      classification.language || 'en'
    );

    await sendReply(message, conversation, shop, humanFallbackResult.response, 'forwarded_to_human', 'pending_human');

    // Forward to human support
    try {
      await forwardToHuman(shop, message);
    } catch (fwdError) {
      console.error(`[Processor] Erro ao encaminhar para humano (msg ${message.id}), resposta já enviada ao cliente:`, fwdError);
    }

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'forwarded_to_human',
      event_data: {
        reason: classification.category === 'suporte_humano'
          ? 'suporte_humano_category'
          : 'max_data_requests_exceeded'
      },
    });

    return true; // Success - marked as processing before
  }

  // 12.5 Incrementar contador de retenção se for cancelamento/reembolso
  let currentRetentionCount = conversation.retention_contact_count || 0;
  if (classification.category === 'troca_devolucao_reembolso') {
    currentRetentionCount += 1;
    await updateConversation(conversation.id, {
      retention_contact_count: currentRetentionCount,
    });
    console.log(`[Processor] Retention contact #${currentRetentionCount} for conversation ${conversation.id}`);
  }

  // 13. Gerar resposta com IA
  const aiResponse = await generateResponse(
    {
      name: shop.name,
      attendant_name: shop.attendant_name,
      tone_of_voice: shop.tone_of_voice || 'friendly',
      store_description: shop.store_description,
      delivery_time: shop.delivery_time,
      dispatch_time: shop.dispatch_time,
      warranty_info: shop.warranty_info,
      signature_html: shop.signature_html,
      is_cod: shop.is_cod,
      store_email: shop.imap_user || shop.support_email,
      support_email: shop.support_email,
      retention_coupon_code: shop.retention_coupon_code,
      retention_coupon_type: shop.retention_coupon_type,
      retention_coupon_value: shop.retention_coupon_value,
    },
    message.subject || '',
    cleanBody,
    classification.category,
    conversationHistory,
    shopifyData ? {
      order_number: shopifyData.order_number,
      order_date: shopifyData.order_date,
      order_status: shopifyData.order_status,
      order_total: shopifyData.order_total,
      tracking_number: shopifyData.tracking_number,
      tracking_url: shopifyData.tracking_url,
      fulfillment_status: shopifyData.fulfillment_status,
      items: shopifyData.items || [],
      customer_name: shopifyData.customer_name,
    } : null,
    classification.language || 'en',
    currentRetentionCount,
    // Passar pedidos adicionais se houver
    additionalOrders.map(order => ({
      order_number: order.order_number,
      order_date: order.order_date,
      order_status: order.order_status,
      order_total: order.order_total,
      tracking_number: order.tracking_number,
      tracking_url: order.tracking_url,
      fulfillment_status: order.fulfillment_status,
      items: order.items || [],
      customer_name: order.customer_name,
    })),
    [], // emailImages
    classification.sentiment || 'calm',
    conversation.status, // para loop detection pular exchange_count se pending_human
  );

  await logProcessingEvent({
    shop_id: shop.id,
    message_id: message.id,
    conversation_id: conversation.id,
    event_type: 'response_generated',
    event_data: {
      tokens_input: aiResponse.tokens_input,
      tokens_output: aiResponse.tokens_output,
    },
    tokens_input: aiResponse.tokens_input,
    tokens_output: aiResponse.tokens_output,
  });

  // Check if AI wants to forward to human
  // Note: troca_devolucao_reembolso is handled by the AI directing customer to support email
  let finalStatus: 'replied' | 'pending_human' = 'replied';

  if (aiResponse.forward_to_human) {
    finalStatus = 'pending_human';
    try {
      await forwardToHuman(shop, message);
    } catch (fwdError) {
      console.error(`[Processor] Erro ao encaminhar para humano (msg ${message.id}), resposta já será enviada ao cliente:`, fwdError);
    }
    console.log(`[Processor] Forwarding to human - ai_forward: true`);
  } else if (classification.category === 'troca_devolucao_reembolso' && currentRetentionCount >= 3) {
    // Só marca como pending_human APÓS 3 contatos de retenção
    // Nos contatos 1 e 2, a IA tenta reter o cliente
    finalStatus = 'pending_human';
    console.log(`[Processor] Marked as pending_human - category: troca_devolucao_reembolso after ${currentRetentionCount} retention contacts`);
  }

  // 14. Enviar resposta por email (com status correto para evitar race condition)
  await sendReply(message, conversation, shop, aiResponse.response, 'response_sent', finalStatus);

  // 15. Atualizar tokens na mensagem (status já definido pelo sendReply)
  await updateMessage(message.id, {
    tokens_input: aiResponse.tokens_input,
    tokens_output: aiResponse.tokens_output,
  });

  if (finalStatus === 'pending_human') {
    // Conversation status já definido pelo sendReply, apenas logar

    // Log event - different reasons for different scenarios
    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: classification.category === 'troca_devolucao_reembolso'
        ? 'directed_to_support'  // Customer directed to contact support email
        : 'forwarded_to_human',  // Email actually forwarded to human
      event_data: {
        reason: classification.category === 'troca_devolucao_reembolso'
          ? 'customer_directed_to_support_email'
          : 'ai_requested_forward',
        category: classification.category,
      },
    });
  }

  // 16. Crédito já foi reservado atomicamente no passo 8 (tryReserveCredit)
  // Não precisa mais chamar incrementEmailsUsed aqui

  console.log(`[Processor] Message ${message.id} processed successfully`);
  return true; // Marked as processing at the beginning

  } catch (creditError) {
    // Rollback do crédito reservado que não foi utilizado com sucesso
    console.error(`[Processor] Erro após reserva de crédito para msg ${message.id}, fazendo rollback:`, creditError);
    try {
      const released = await releaseCredit(user.id);
      if (released) {
        console.log(`[Processor] Crédito devolvido com sucesso para user ${user.id}`);
      }
    } catch (rollbackError) {
      console.error(`[Processor] Falha ao devolver crédito para user ${user.id}:`, rollbackError);
    }
    throw creditError;
  }
}

/**
 * Envia resposta por email e salva na base
 */
async function sendReply(
  message: Message,
  conversation: Conversation,
  shop: Shop,
  replyText: string,
  eventType: string,
  statusOverride?: 'replied' | 'pending_human'
): Promise<void> {
  const messageStatus = statusOverride || 'replied';
  // Build reply headers
  const replyHeaders = buildReplyHeaders(message.message_id, message.references_header);
  const replySubject = buildReplySubject(message.subject || '');

  // Decrypt email credentials properly
  const emailCredentials = await decryptEmailCredentials(shop);

  if (!emailCredentials) {
    console.error(`[Processor] Failed to decrypt email credentials for shop ${shop.id}`);
    throw new Error('Failed to decrypt email credentials');
  }

  try {
    await sendEmail(emailCredentials, {
      to: message.from_email,
      subject: replySubject,
      body_text: replyText,
      in_reply_to: message.message_id || undefined,
      references: replyHeaders.references,
      from_name: shop.attendant_name || shop.name,
    });
  } catch (error: any) {
    console.error(`[Processor] SMTP send failed:`, error.message);
    throw new Error(`SMTP error: ${error.message}`);
  }

  // Save outbound message
  await saveMessage({
    conversation_id: conversation.id,
    from_email: emailCredentials.smtp_user || shop.imap_user || '',
    from_name: shop.attendant_name || shop.name,
    to_email: message.from_email,
    subject: replySubject,
    body_text: replyText,
    direction: 'outbound',
    status: 'replied',
    was_auto_replied: true,
    in_reply_to: message.message_id,
    references_header: replyHeaders.references,
    processed_at: new Date().toISOString(),
    replied_at: new Date().toISOString(),
  });

  // Update original message status
  await updateMessage(message.id, {
    status: messageStatus,
    processed_at: new Date().toISOString(),
    replied_at: new Date().toISOString(),
  });

  // Update conversation
  await updateConversation(conversation.id, {
    status: messageStatus,
    last_message_at: new Date().toISOString(),
  });

  // Log event
  await logProcessingEvent({
    shop_id: shop.id,
    message_id: message.id,
    conversation_id: conversation.id,
    event_type: eventType as any,
    event_data: { reply_length: replyText.length },
  });
}

/**
 * Encaminha email para suporte humano
 */
async function forwardToHuman(shop: Shop, message: Message): Promise<void> {
  if (!shop.support_email) {
    console.warn(`[Processor] Shop ${shop.name || shop.id} não tem support_email configurado, não é possível encaminhar msg ${message.id}`);
    return;
  }

  const emailCredentials = await decryptEmailCredentials(shop);
  if (!emailCredentials) return;

  const forwardSubject = `[ENCAMINHADO] ${message.subject || 'Sem assunto'} - De: ${message.from_email}`;

  const forwardBody = `
Este email foi encaminhado automaticamente pelo Replyna porque requer atendimento humano.

═══════════════════════════════════════
DADOS DO CLIENTE
═══════════════════════════════════════
Email: ${message.from_email}
Nome: ${message.from_name || 'Não informado'}

═══════════════════════════════════════
MENSAGEM ORIGINAL
═══════════════════════════════════════
Assunto: ${message.subject || 'Sem assunto'}
Data: ${message.received_at || message.created_at}

${message.body_text || message.body_html || '(Sem conteúdo)'}

═══════════════════════════════════════
Responda diretamente ao cliente em: ${message.from_email}
`;

  try {
    await sendEmail(emailCredentials, {
      to: shop.support_email,
      subject: forwardSubject,
      body_text: forwardBody,
      from_name: 'Replyna Bot',
    });

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      event_type: 'forwarded_to_human',
      event_data: {
        forwarded_to: shop.support_email,
        reason: 'email_forwarded',
      },
    });
  } catch (error: any) {
    console.error(`[Processor] Failed to forward to human:`, error.message);
    // Don't throw - this is not critical
  }
}

/**
 * Verifica se mensagem é apenas agradecimento
 */
function isAcknowledgmentMessage(body: string, subject: string): boolean {
  const cleanBody = (body || '').toLowerCase().trim();
  const cleanSubject = (subject || '').toLowerCase().trim();

  // Remover assinaturas comuns do final (nome do cliente, traços, etc.)
  const bodyWithoutSignature = cleanBody
    .replace(/[\r\n]+-+\s*$/g, '') // Remove "---" no final
    .replace(/[\r\n]+[a-záàãéêíóôúç\s]{2,30}[\r\n]*$/gi, '') // Remove nome curto no final
    .trim();

  // Padrões exatos (mensagem inteira é agradecimento)
  const exactPatterns = [
    /^(ok|okay|obrigad[oa]|thanks?|thank you|gracias|grazie|merci|danke)\s*[!.]*$/,
    /^(entendido|perfeito|perfect|perfetto|excelente|excellent)\s*[!.]*$/,
    /^(recebido|received|reçu|ricevuto)\s*[!.]*$/,
  ];

  // Padrões de agradecimento com complemento (mensagem curta, < 100 chars)
  const shortAckPatterns = [
    /^obrigad[oa]\s+(pelo|pela|por|pelo retorno|pela resposta|pela ajuda|por responder)/,
    /^thanks?\s+(for|for getting back|for your|for the)/,
    /^thank you\s+(for|so much|very much|for getting back|for your|for the)/,
    /^gracias\s+(por|por responder|por la|por su)/,
    /^merci\s+(pour|beaucoup|de)/,
    /^danke\s+(für|schön|sehr)/,
    /^(muito obrigad[oa]|thanks a lot|many thanks|muchísimas gracias)/,
    /^(valeu|vlw|thx|tks|ty)\b/,
    // Padrões compostos: "ok" + agradecimento/espera
    /^ok[,.\s]+(obrigad|thanks|merci|danke|gracias)/i,
    /^(ok|okay|certo|entendi|perfeito)[,.\s]+(vou|i'?ll|i will)\s+(esperar|aguardar|wait)/i,
  ];

  for (const pattern of exactPatterns) {
    if (pattern.test(cleanBody) || pattern.test(cleanSubject) ||
        pattern.test(bodyWithoutSignature)) {
      return true;
    }
  }

  // Para padrões curtos, só considerar se a mensagem é realmente curta (< 100 chars)
  if (bodyWithoutSignature.length < 100) {
    for (const pattern of shortAckPatterns) {
      if (pattern.test(bodyWithoutSignature)) {
        console.log(`[isAcknowledgment] Detected short ack: "${bodyWithoutSignature.substring(0, 50)}"`);
        return true;
      }
    }

    // Detecção de mensagem de "espera" / "I'll wait" (acknowledgment implícito)
    if (/\b(vou|irei)\s+(esperar|aguardar)\b/i.test(bodyWithoutSignature) ||
        /\b(i'?ll|i will)\s+wait\b/i.test(bodyWithoutSignature) ||
        /\b(werde)\s+(warten|abwarten)\b/i.test(bodyWithoutSignature) ||
        /\b(voy a|vamos a)\s+esperar\b/i.test(bodyWithoutSignature)) {
      console.log(`[isAcknowledgment] Detected waiting message: "${bodyWithoutSignature.substring(0, 50)}"`);
      return true;
    }
  }

  return false;
}

/**
 * Verifica se a mensagem é uma notificação de sistema do Shopify (NÃO é uma mensagem de cliente)
 * Ex: chargebacks, disputas, alertas de pedido, notificações administrativas
 */
function isShopifySystemNotification(body: string): boolean {
  if (!body) return false;
  const lower = body.toLowerCase();

  // Padrões de notificações de chargeback/disputa do Shopify
  const shopifyNotificationPatterns = [
    // Chargebacks e disputas (PT e EN)
    'abriu um estorno',
    'opened a chargeback',
    'filed a chargeback',
    'new order inquiry',
    'nova consulta de pedido',
    'dispute_evidences',
    'o banco devolveu',
    'the bank returned',
    'charged a fee for the chargeback',
    'taxa de estorno',
    'enviar resposta ao banco',
    'send response to bank',
    'coletamos evidências',
    'we collected evidence',
    // Alertas de risco/fraude do Shopify
    'order risk analysis',
    'análise de risco do pedido',
    'high risk order',
    'pedido de alto risco',
    // Notificações de pagamento do Shopify
    'payment was voided',
    'pagamento foi cancelado',
    'payout has been sent',
    'pagamento foi enviado',
  ];

  for (const pattern of shopifyNotificationPatterns) {
    if (lower.includes(pattern)) {
      console.log(`[isShopifySystemNotification] Matched pattern: "${pattern}"`);
      return true;
    }
  }

  return false;
}
```

---
