import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function Account() {
  const { user } = useAuth()
  const [name, setName] = useState(user?.user_metadata?.name || '')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setSaving(true)

    try {
      const { error } = await supabase.auth.updateUser({
        data: { name }
      })

      if (error) throw error

      // Atualiza também na tabela users
      await supabase
        .from('users')
        .update({ name })
        .eq('id', user?.id)

      setSuccess(true)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar'
      setError(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '16px',
    boxSizing: 'border-box' as const,
  }

  const buttonPrimary = {
    backgroundColor: '#2563eb',
    color: 'white',
    padding: '12px 24px',
    borderRadius: '8px',
    fontWeight: '500',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
  }

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginBottom: '24px' }}>Minha Conta</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        {/* Dados pessoais */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px' }}>Dados pessoais</h2>
          
          <form onSubmit={handleSave}>
            {error && (
              <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '12px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>
                Dados salvos com sucesso!
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Nome
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                style={{ ...inputStyle, backgroundColor: '#f9fafb', color: '#6b7280' }}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{ ...buttonPrimary, opacity: saving ? 0.5 : 1 }}
            >
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </form>
        </div>

        {/* Meu plano */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px' }}>Meu Plano</h2>
          
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: '#eff6ff', borderRadius: '8px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontWeight: 'bold', color: '#1d4ed8' }}>Plano Starter</div>
                <div style={{ fontSize: '14px', color: '#2563eb' }}>R$ 197,00/mês</div>
              </div>
              <span style={{ fontSize: '24px' }}>⭐</span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
                <span style={{ color: '#6b7280' }}>Emails usados</span>
                <span style={{ color: '#1f2937', fontWeight: '500' }}>0 de 300</span>
              </div>
              <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '8px' }}>
                <div style={{ backgroundColor: '#2563eb', height: '8px', borderRadius: '9999px', width: '0%' }}></div>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
                <span style={{ color: '#6b7280' }}>Lojas</span>
                <span style={{ color: '#1f2937', fontWeight: '500' }}>0 de 1</span>
              </div>
              <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '8px' }}>
                <div style={{ backgroundColor: '#2563eb', height: '8px', borderRadius: '9999px', width: '0%' }}></div>
              </div>
            </div>

            <button style={{ width: '100%', backgroundColor: '#f3f4f6', color: '#374151', padding: '12px', borderRadius: '8px', fontWeight: '500', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
              Fazer upgrade
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
