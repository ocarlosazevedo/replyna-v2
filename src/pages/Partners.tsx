import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  fontSize: '14px',
  outline: 'none',
} as const

const labelStyle = {
  display: 'block',
  marginBottom: '8px',
  fontWeight: 600,
  fontSize: '14px',
  color: 'var(--text-primary)',
} as const

export default function Partners() {
  const [planId, setPlanId] = useState<string | null>(null)
  const [loadingPlan, setLoadingPlan] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '' })

  useEffect(() => {
    const loadPlan = async () => {
      setLoadingPlan(true)
      setError(null)

      const { data, error: planError } = await supabase
        .from('plans')
        .select('id, slug')
        .eq('slug', 'partners')
        .maybeSingle()

      if (planError || !data?.id) {
        setError('Plano Partners não encontrado. Tente novamente mais tarde.')
      } else {
        setPlanId(data.id)
      }

      setLoadingPlan(false)
    }

    loadPlan()
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting || loadingPlan) return

    const name = form.name.trim()
    const email = form.email.trim()
    const whatsapp = form.whatsapp.trim()

    if (!name || !email || !whatsapp) {
      setError('Preencha todos os campos.')
      return
    }

    if (!planId) {
      setError('Plano Partners não disponível no momento.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-client`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            email,
            whatsapp_number: whatsapp,
            plan_id: planId,
            plan_slug: 'partners',
          }),
        }
      )

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar conta')
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '18px',
        border: '1px solid var(--border-color)',
        padding: '32px',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
      }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Programa de Partners
          </h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
            Crie sua conta de influenciador e receba o acesso gratuito ao Replyna.
          </p>
        </div>

        {success ? (
          <div style={{
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: 'rgba(34, 197, 94, 0.12)',
            border: '1px solid rgba(34, 197, 94, 0.35)',
            color: '#22c55e',
            fontSize: '14px',
            fontWeight: 600,
          }}>
            Conta criada! Verifique seu email para acessar.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Nome</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Seu nome completo"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@exemplo.com"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Celular / WhatsApp</label>
              <input
                type="tel"
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                placeholder="(00) 00000-0000"
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{
                padding: '12px',
                borderRadius: '10px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#ef4444',
                fontSize: '13px',
                fontWeight: 600,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || loadingPlan}
              style={{
                marginTop: '8px',
                padding: '12px 16px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: 'var(--accent)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '14px',
                cursor: submitting || loadingPlan ? 'not-allowed' : 'pointer',
                opacity: submitting || loadingPlan ? 0.7 : 1,
              }}
            >
              {submitting ? 'Criando conta...' : 'Criar conta grátis'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
