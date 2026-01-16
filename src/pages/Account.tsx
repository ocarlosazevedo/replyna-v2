import { useMemo, useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
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

const Skeleton = ({ height = 16 }: { height?: number }) => (
  <div
    style={{
      width: '100%',
      height,
      backgroundColor: 'var(--border-color)',
      borderRadius: 8,
      animation: 'replyna-pulse 1.6s ease-in-out infinite',
    }}
  />
)

export default function Account() {
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [emailChangeLoading, setEmailChangeLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showPlanModal, setShowPlanModal] = useState(false)

  useEffect(() => {
    if (!user) return
    const loadProfile = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('users')
          .select('name, email, plan, emails_limit, emails_used, shops_limit, created_at')
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
          })
          setName(newUserData.name || '')
          setEmail(newUserData.email || '')
          setPhone((user.user_metadata?.phone as string | undefined) || '')
        } else {
          setProfile(data)
          setName(data.name || user.user_metadata?.name || '')
          setEmail(data.email || user.email || '')
          setPhone((user.user_metadata?.phone as string | undefined) || '')
        }
      } catch (err) {
        console.error('Erro ao carregar perfil:', err)
        setNotice({ type: 'error', message: 'Não foi possível carregar suas informações.' })
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [user])

  const renewalDate = useMemo(
    () => calculateRenewalDate(profile?.created_at ?? user?.created_at ?? null),
    [profile?.created_at, user?.created_at]
  )

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
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      const { error: metaError } = await supabase.auth.updateUser({
        data: { name: name.trim(), phone: phone.trim() || null },
      })
      if (metaError) throw metaError

      setNotice({ type: 'success', message: 'Informações atualizadas com sucesso.' })
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              name: name.trim(),
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
      setPhone((user?.user_metadata?.phone as string | undefined) || '')
      setNotice(null)
    }
    setIsEditing((prev) => !prev)
  }

  const handleCancelPlan = () => {
    setShowCancelModal(false)
    setCancelReason('')
    setNotice({ type: 'info', message: 'Solicitação de cancelamento registrada.' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Minha Conta</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Gerencie suas informações pessoais</p>
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
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Informações pessoais</h2>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>Seus dados básicos de cadastro</p>
                </div>
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

            {loading ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                <Skeleton height={44} />
                <Skeleton height={44} />
                <Skeleton height={44} />
              </div>
            ) : (
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
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Telefone</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="(00) 00000-0000"
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
              </form>
            )}
          </section>

          <section style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)' }}>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Segurança</h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>Mantenha sua conta protegida</p>
            </div>

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
          </section>

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
              <div style={{ borderRadius: '14px', border: '1px solid var(--border-color)', padding: '16px', backgroundColor: 'var(--bg-primary)' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                  Plano {planName}
                </div>
                <ul style={{ paddingLeft: '16px', margin: 0, color: 'var(--text-secondary)', fontSize: '13px', display: 'grid', gap: '6px' }}>
                  <li>
                    Até {emailsLimit !== null && emailsLimit !== undefined ? formatNumber(emailsLimit) : '--'} emails mensais
                  </li>
                  <li>
                    Até {shopsLimit !== null && shopsLimit !== undefined ? formatNumber(shopsLimit) : '--'} lojas
                  </li>
                </ul>
                <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Renova em {renewalDate ? formatDate(renewalDate) : '--'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setShowPlanModal(true)}
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
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid var(--border-color)',
              width: 'min(420px, 90vw)',
              zIndex: 61,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '8px', color: 'var(--text-primary)' }}>Alterar plano</h3>
            <p style={{ marginTop: 0, color: 'var(--text-secondary)' }}>
              Em breve você poderá comparar e escolher novos planos.
            </p>
            <button
              type="button"
              onClick={() => setShowPlanModal(false)}
              style={{
                marginTop: '12px',
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
