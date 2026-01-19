import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Edit2, Trash2, Star, Check } from 'lucide-react'

interface Plan {
  id: string
  name: string
  description: string | null
  price_monthly: number
  price_yearly: number | null
  emails_limit: number
  shops_limit: number
  features: string[]
  stripe_product_id: string | null
  stripe_price_monthly_id: string | null
  stripe_price_yearly_id: string | null
  extra_email_price: number | null
  extra_email_package_size: number | null
  stripe_extra_email_price_id: string | null
  is_active: boolean
  is_popular: boolean
  sort_order: number
  created_at: string
}

export default function AdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_monthly: 0,
    price_yearly: 0,
    emails_limit: 100,
    shops_limit: 1,
    features: [] as string[],
    stripe_product_id: '',
    stripe_price_monthly_id: '',
    stripe_price_yearly_id: '',
    extra_email_price: 1.0,
    extra_email_package_size: 100,
    stripe_extra_email_price_id: '',
    is_active: true,
    is_popular: false,
    sort_order: 0,
  })
  const [newFeature, setNewFeature] = useState('')

  useEffect(() => {
    loadPlans()
  }, [])

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw error
      setPlans((data || []) as Plan[])
    } catch (err) {
      console.error('Erro ao carregar planos:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (plan?: Plan) => {
    if (plan) {
      setEditingPlan(plan)
      setFormData({
        name: plan.name,
        description: plan.description || '',
        price_monthly: plan.price_monthly,
        price_yearly: plan.price_yearly || 0,
        emails_limit: plan.emails_limit,
        shops_limit: plan.shops_limit,
        features: plan.features || [],
        stripe_product_id: plan.stripe_product_id || '',
        stripe_price_monthly_id: plan.stripe_price_monthly_id || '',
        stripe_price_yearly_id: plan.stripe_price_yearly_id || '',
        extra_email_price: plan.extra_email_price || 1.0,
        extra_email_package_size: plan.extra_email_package_size || 100,
        stripe_extra_email_price_id: plan.stripe_extra_email_price_id || '',
        is_active: plan.is_active,
        is_popular: plan.is_popular,
        sort_order: plan.sort_order,
      })
    } else {
      setEditingPlan(null)
      setFormData({
        name: '',
        description: '',
        price_monthly: 0,
        price_yearly: 0,
        emails_limit: 100,
        shops_limit: 1,
        features: [],
        stripe_product_id: '',
        stripe_price_monthly_id: '',
        stripe_price_yearly_id: '',
        extra_email_price: 1.0,
        extra_email_package_size: 100,
        stripe_extra_email_price_id: '',
        is_active: true,
        is_popular: false,
        sort_order: plans.length,
      })
    }
    setShowModal(true)
  }

  const handleSavePlan = async () => {
    try {
      const planData = {
        name: formData.name,
        description: formData.description || null,
        price_monthly: formData.price_monthly,
        price_yearly: formData.price_yearly || null,
        emails_limit: formData.emails_limit,
        shops_limit: formData.shops_limit,
        features: formData.features,
        stripe_product_id: formData.stripe_product_id || null,
        stripe_price_monthly_id: formData.stripe_price_monthly_id || null,
        stripe_price_yearly_id: formData.stripe_price_yearly_id || null,
        extra_email_price: formData.extra_email_price || null,
        extra_email_package_size: formData.extra_email_package_size || null,
        stripe_extra_email_price_id: formData.stripe_extra_email_price_id || null,
        is_active: formData.is_active,
        is_popular: formData.is_popular,
        sort_order: formData.sort_order,
      }

      if (editingPlan) {
        const { error } = await supabase
          .from('plans')
          .update(planData)
          .eq('id', editingPlan.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from('plans').insert(planData)
        if (error) throw error
      }

      setShowModal(false)
      loadPlans()
    } catch (err) {
      console.error('Erro ao salvar plano:', err)
    }
  }

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Tem certeza que deseja excluir este plano?')) return

    try {
      const { error } = await supabase.from('plans').delete().eq('id', planId)
      if (error) throw error
      loadPlans()
    } catch (err) {
      console.error('Erro ao excluir plano:', err)
    }
  }

  const addFeature = () => {
    if (newFeature.trim()) {
      setFormData({ ...formData, features: [...formData.features, newFeature.trim()] })
      setNewFeature('')
    }
  }

  const removeFeature = (index: number) => {
    setFormData({
      ...formData,
      features: formData.features.filter((_, i) => i !== index),
    })
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
            Planos
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            Gerencie os planos de assinatura
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
          Novo Plano
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {plans.map((plan) => (
          <div key={plan.id} style={{ ...cardStyle, position: 'relative' }}>
            {plan.is_popular && (
              <div style={{
                position: 'absolute',
                top: '-12px',
                right: '16px',
                backgroundColor: '#f59e0b',
                color: '#fff',
                padding: '4px 12px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <Star size={12} />
                Popular
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {plan.name}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {plan.description || 'Sem descricao'}
                </p>
              </div>
              <span style={{
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: plan.is_active ? 'rgba(34, 197, 94, 0.16)' : 'rgba(107, 114, 128, 0.16)',
                color: plan.is_active ? '#22c55e' : '#6b7280',
              }}>
                {plan.is_active ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
                R$ {plan.price_monthly.toFixed(2)}
                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>/mes</span>
              </div>
              {plan.price_yearly && (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  ou R$ {plan.price_yearly.toFixed(2)}/ano
                </div>
              )}
            </div>

            <div style={{
              padding: '12px',
              backgroundColor: 'rgba(70, 114, 236, 0.06)',
              borderRadius: '10px',
              marginBottom: '16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Emails/mes</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{plan.emails_limit.toLocaleString('pt-BR')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Lojas</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{plan.shops_limit}</span>
              </div>
              {plan.extra_email_price && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Email extra</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b' }}>
                    R$ {plan.extra_email_price.toFixed(2)} ({plan.extra_email_package_size || 100}/pacote)
                  </span>
                </div>
              )}
            </div>

            {plan.features && plan.features.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                {plan.features.map((feature, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <Check size={14} style={{ color: '#22c55e' }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{feature}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleOpenModal(plan)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                <Edit2 size={14} />
                Editar
              </button>
              <button
                onClick={() => handleDeletePlan(plan.id)}
                style={{
                  padding: '10px',
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
          </div>
        ))}
      </div>

      {plans.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '48px' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Nenhum plano cadastrado ainda
          </p>
          <button
            onClick={() => handleOpenModal()}
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
            Criar primeiro plano
          </button>
        </div>
      )}

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
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '24px' }}>
              {editingPlan ? 'Editar Plano' : 'Novo Plano'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Nome do Plano</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={inputStyle}
                    placeholder="Ex: Pro"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Ordem de Exibicao</label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Descricao</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={inputStyle}
                  placeholder="Descricao breve do plano"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Preco Mensal (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price_monthly}
                    onChange={(e) => setFormData({ ...formData, price_monthly: parseFloat(e.target.value) })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Preco Anual (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price_yearly}
                    onChange={(e) => setFormData({ ...formData, price_yearly: parseFloat(e.target.value) })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Limite de Emails/mes</label>
                  <input
                    type="number"
                    value={formData.emails_limit}
                    onChange={(e) => setFormData({ ...formData, emails_limit: parseInt(e.target.value) })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Limite de Lojas</label>
                  <input
                    type="number"
                    value={formData.shops_limit}
                    onChange={(e) => setFormData({ ...formData, shops_limit: parseInt(e.target.value) })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Features</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="Ex: Suporte prioritario"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                  />
                  <button
                    type="button"
                    onClick={addFeature}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: 'var(--accent)',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {formData.features.map((feature, index) => (
                    <span
                      key={index}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'rgba(70, 114, 236, 0.1)',
                        color: 'var(--accent)',
                        borderRadius: '999px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {feature}
                      <button
                        type="button"
                        onClick={() => removeFeature(index)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent)',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '16px',
                          lineHeight: 1,
                        }}
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <label style={{ ...labelStyle, marginBottom: '12px' }}>Emails Extras</label>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Configure a cobranca automatica quando o usuario exceder o limite do plano
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '12px', color: 'var(--text-secondary)' }}>Preco por Email Extra (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.extra_email_price}
                      onChange={(e) => setFormData({ ...formData, extra_email_price: parseFloat(e.target.value) })}
                      style={inputStyle}
                      placeholder="1.00"
                    />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '12px', color: 'var(--text-secondary)' }}>Tamanho do Pacote</label>
                    <input
                      type="number"
                      value={formData.extra_email_package_size}
                      onChange={(e) => setFormData({ ...formData, extra_email_package_size: parseInt(e.target.value) })}
                      style={inputStyle}
                      placeholder="100"
                    />
                  </div>
                </div>
                <div style={{ marginTop: '12px' }}>
                  <label style={{ ...labelStyle, fontSize: '12px', color: 'var(--text-secondary)' }}>Stripe Price ID (Pacote Extra)</label>
                  <input
                    type="text"
                    value={formData.stripe_extra_email_price_id}
                    onChange={(e) => setFormData({ ...formData, stripe_extra_email_price_id: e.target.value })}
                    style={inputStyle}
                    placeholder="price_..."
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <label style={labelStyle}>Stripe IDs - Assinatura (opcional)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <input
                    type="text"
                    value={formData.stripe_product_id}
                    onChange={(e) => setFormData({ ...formData, stripe_product_id: e.target.value })}
                    style={inputStyle}
                    placeholder="Product ID"
                  />
                  <input
                    type="text"
                    value={formData.stripe_price_monthly_id}
                    onChange={(e) => setFormData({ ...formData, stripe_price_monthly_id: e.target.value })}
                    style={inputStyle}
                    placeholder="Price Mensal ID"
                  />
                  <input
                    type="text"
                    value={formData.stripe_price_yearly_id}
                    onChange={(e) => setFormData({ ...formData, stripe_price_yearly_id: e.target.value })}
                    style={inputStyle}
                    placeholder="Price Anual ID"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Plano ativo</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_popular}
                    onChange={(e) => setFormData({ ...formData, is_popular: e.target.checked })}
                  />
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Destacar como popular</span>
                </label>
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
                onClick={handleSavePlan}
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
                {editingPlan ? 'Salvar' : 'Criar Plano'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
