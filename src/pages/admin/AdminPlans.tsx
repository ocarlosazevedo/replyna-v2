import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Edit2, Trash2, Star, Check } from 'lucide-react'

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
  description: string | null
  price_monthly: number
  price_yearly: number | null
  emails_limit: number | null  // null = ilimitado
  shops_limit: number | null   // null = ilimitado
  features: string[]
  asaas_plan_id: string | null
  extra_email_price: number | null  // null = sem cobrança extra
  extra_email_package_size: number | null
  is_active: boolean
  is_popular: boolean
  sort_order: number
  created_at: string
}

export default function AdminPlans() {
  const isMobile = useIsMobile()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_monthly: 0,
    price_yearly: 0,
    emails_limit: '' as string | number,  // vazio = ilimitado
    shops_limit: '' as string | number,   // vazio = ilimitado
    features: [] as string[],
    asaas_plan_id: '',
    extra_email_price: '' as string | number,  // vazio = sem cobrança
    extra_email_package_size: '' as string | number,
    is_active: true,
    is_popular: false,
    sort_order: 0,
  })
  const [newFeature, setNewFeature] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
        emails_limit: plan.emails_limit ?? '',  // null vira vazio (ilimitado)
        shops_limit: plan.shops_limit ?? '',    // null vira vazio (ilimitado)
        features: plan.features || [],
        asaas_plan_id: plan.asaas_plan_id || '',
        extra_email_price: plan.extra_email_price ?? '',  // null vira vazio
        extra_email_package_size: plan.extra_email_package_size ?? '',
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
        asaas_plan_id: '',
        extra_email_price: 1.0,
        extra_email_package_size: 100,
        is_active: true,
        is_popular: false,
        sort_order: plans.length,
      })
    }
    setSaveError(null)
    setShowModal(true)
  }

  const handleSavePlan = async () => {
    setSaveError(null)
    setSaving(true)

    try {
      // Converter strings vazias para null (ilimitado)
      // IMPORTANTE: 0 é um valor válido e deve ser preservado
      const parseLimit = (value: string | number): number | null => {
        if (value === '' || value === null || value === undefined) return null
        const num = typeof value === 'string' ? parseInt(value) : value
        if (isNaN(num)) return null
        return num  // 0 é válido
      }
      const parsePrice = (value: string | number): number | null => {
        if (value === '' || value === null || value === undefined) return null
        const num = typeof value === 'string' ? parseFloat(value) : value
        if (isNaN(num)) return null
        return num  // 0 é válido
      }

      const planData = {
        name: formData.name,
        description: formData.description || null,
        price_monthly: formData.price_monthly,
        price_yearly: formData.price_yearly || null,
        emails_limit: parseLimit(formData.emails_limit),  // null = ilimitado
        shops_limit: parseLimit(formData.shops_limit),    // null = ilimitado
        features: formData.features,
        asaas_plan_id: formData.asaas_plan_id || null,
        extra_email_price: parsePrice(formData.extra_email_price),  // null ou 0 = sem cobrança extra
        extra_email_package_size: parseLimit(formData.extra_email_package_size),
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
      // Capturar detalhes do erro do Supabase
      const errorMessage = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string; details?: string; hint?: string }).message
        : 'Erro desconhecido'
      const errorDetails = err && typeof err === 'object' && 'details' in err
        ? (err as { details?: string }).details
        : null
      const errorHint = err && typeof err === 'object' && 'hint' in err
        ? (err as { hint?: string }).hint
        : null

      let fullError = errorMessage
      if (errorDetails) fullError += ` - ${errorDetails}`
      if (errorHint) fullError += ` (${errorHint})`

      setSaveError(fullError)
    } finally {
      setSaving(false)
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
    padding: isMobile ? '16px' : '24px',
    border: '1px solid var(--border-color)',
    overflow: 'visible' as const,
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
            Planos
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '14px' : '15px' }}>
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
            justifyContent: 'center',
            gap: '8px',
            width: isMobile ? '100%' : 'auto',
          }}
        >
          <Plus size={18} />
          Novo Plano
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: isMobile ? '16px' : '24px', paddingTop: '16px' }}>
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
                <span style={{ fontSize: '13px', fontWeight: 600, color: plan.emails_limit === null ? '#22c55e' : 'var(--text-primary)' }}>
                  {plan.emails_limit === null ? 'Ilimitado' : plan.emails_limit.toLocaleString('pt-BR')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Lojas</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: plan.shops_limit === null ? '#22c55e' : 'var(--text-primary)' }}>
                  {plan.shops_limit === null ? 'Ilimitado' : plan.shops_limit}
                </span>
              </div>
              {plan.extra_email_price !== null && plan.extra_email_price > 0 ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Email extra</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b' }}>
                    R$ {plan.extra_email_price.toFixed(2)} ({plan.extra_email_package_size || 100}/pacote)
                  </span>
                </div>
              ) : plan.emails_limit !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Email extra</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Nao configurado
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
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Limite de Emails/mes</label>
                  <input
                    type="text"
                    value={formData.emails_limit}
                    onChange={(e) => setFormData({ ...formData, emails_limit: e.target.value })}
                    style={inputStyle}
                    placeholder="Vazio = Ilimitado"
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                    Deixe vazio para ilimitado
                  </span>
                </div>
                <div>
                  <label style={labelStyle}>Limite de Lojas</label>
                  <input
                    type="text"
                    value={formData.shops_limit}
                    onChange={(e) => setFormData({ ...formData, shops_limit: e.target.value })}
                    style={inputStyle}
                    placeholder="Vazio = Ilimitado"
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                    Deixe vazio para ilimitado
                  </span>
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
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
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
                  <label style={{ ...labelStyle, fontSize: '12px', color: 'var(--text-secondary)' }}>Asaas Plan ID (opcional)</label>
                  <input
                    type="text"
                    value={formData.asaas_plan_id}
                    onChange={(e) => setFormData({ ...formData, asaas_plan_id: e.target.value })}
                    style={inputStyle}
                    placeholder="asaas_plan_..."
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '12px' : '24px' }}>
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

            {saveError && (
              <div style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#ef4444',
                fontSize: '13px',
                marginTop: '16px',
              }}>
                {saveError}
              </div>
            )}

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
                  width: isMobile ? '100%' : 'auto',
                  opacity: saving ? 0.5 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePlan}
                disabled={saving}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'var(--accent)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  width: isMobile ? '100%' : 'auto',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Salvando...' : (editingPlan ? 'Salvar' : 'Criar Plano')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
