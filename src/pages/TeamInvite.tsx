import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Users, Shield, Store, Check, X, Loader2, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const roleLabels: Record<string, string> = {
  viewer: 'Visualizador',
  operator: 'Operador',
  manager: 'Gerente',
}

const roleDescriptions: Record<string, string> = {
  viewer: 'Pode visualizar dados das lojas permitidas',
  operator: 'Pode ver e responder conversas, tickets e gerenciar formulários',
  manager: 'Acesso total às lojas permitidas',
}

interface InviteData {
  invite: {
    code: string
    invited_name: string | null
    role: string
    status: string
    expires_at: string
  }
  owner: {
    name: string
  }
  shops: string[]
}

export default function TeamInvite() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading, signIn } = useAuth()
  const [inviteData, setInviteData] = useState<InviteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Auth form states
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authLoading2, setAuthLoading2] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // Buscar dados do convite
  useEffect(() => {
    if (!code) return

    const fetchInvite = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/team-accept-invite?code=${code}`,
          { method: 'GET' }
        )

        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Convite não encontrado')
          return
        }

        const data = await res.json()
        setInviteData(data)
      } catch {
        setError('Erro ao carregar convite')
      } finally {
        setLoading(false)
      }
    }

    fetchInvite()
  }, [code])

  // Não redirecionar automaticamente - mostrar os detalhes do convite primeiro
  const isAuthenticated = !authLoading && !!user

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    setAuthLoading2(true)

    try {
      if (authMode === 'register') {
        if (!authName.trim()) {
          setAuthError('Preencha seu nome')
          setAuthLoading2(false)
          return
        }
        if (authPassword.length < 6) {
          setAuthError('A senha deve ter pelo menos 6 caracteres')
          setAuthLoading2(false)
          return
        }

        // Registrar via Edge Function (auto-confirmação, sem email)
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/team-register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authEmail, password: authPassword, name: authName }),
        })

        const data = await res.json()
        if (!res.ok) {
          setAuthError(data.error || 'Erro ao criar conta')
          setAuthLoading2(false)
          return
        }

        // Conta criada com sucesso, agora faz login automático
        await signIn(authEmail, authPassword)
      } else {
        await signIn(authEmail, authPassword)
      }
      // Após login, o useAuth atualiza o user e mostra o botão "Aceitar convite"
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro na autenticação'
      setAuthError(
        msg.includes('Invalid login') ? 'Email ou senha incorretos' :
        msg.includes('already registered') ? 'Este email já possui conta. Faça login.' :
        msg
      )
    } finally {
      setAuthLoading2(false)
    }
  }

  const handleAccept = async () => {
    if (!code) return

    setAccepting(true)
    setError(null)

    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/team-accept-invite`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao aceitar convite')
        return
      }

      setSuccess(true)
      // Redirecionar para dashboard após 2 segundos
      setTimeout(() => navigate('/dashboard'), 2000)
    } catch {
      setError('Erro ao aceitar convite')
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
      }}>
        <div className="animate-spin" style={{
          width: '32px', height: '32px',
          border: '3px solid var(--border-color)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
        }} />
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--bg-primary)', padding: '20px',
    }}>
      <div style={{
        maxWidth: '480px', width: '100%',
        backgroundColor: 'var(--bg-card)', borderRadius: '16px',
        border: '1px solid var(--border-color)', padding: '40px',
        textAlign: 'center',
      }}>
        {/* Logo */}
        <img
          src="/replyna-logo.webp"
          alt="Replyna"
          style={{ width: '120px', marginBottom: '32px', display: 'block', margin: '0 auto 32px' }}
        />

        {/* Erro */}
        {error && !inviteData && (
          <div>
            <X size={48} style={{ color: '#ef4444', marginBottom: '16px' }} />
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              Convite indisponível
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 24px', fontSize: '14px' }}>
              {error}
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '12px 24px', borderRadius: '10px',
                backgroundColor: 'var(--accent)', color: '#fff',
                border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
              }}
            >
              Ir para o painel
            </button>
          </div>
        )}

        {/* Sucesso */}
        {success && (
          <div>
            <Check size={48} style={{ color: '#22c55e', marginBottom: '16px' }} />
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              Convite aceito!
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>
              Você agora faz parte da equipe. Redirecionando...
            </p>
          </div>
        )}

        {/* Dados do convite */}
        {inviteData && !success && (
          <div>
            <Users size={48} style={{ color: 'var(--accent)', marginBottom: '16px' }} />

            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              Convite para equipe
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 28px', fontSize: '14px' }}>
              <strong>{inviteData.owner.name}</strong> convidou você para fazer parte da equipe
            </p>

            {/* Detalhes */}
            <div style={{
              backgroundColor: 'var(--bg-primary)', borderRadius: '12px',
              padding: '20px', marginBottom: '24px', textAlign: 'left',
            }}>
              {/* Role */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Shield size={16} style={{ color: 'var(--text-secondary)' }} />
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Permissão</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {roleLabels[inviteData.invite.role] || inviteData.invite.role}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                    {roleDescriptions[inviteData.invite.role] || ''}
                  </div>
                </div>
              </div>

              {/* Lojas */}
              {inviteData.shops.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <Store size={16} style={{ color: 'var(--text-secondary)', marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Lojas com acesso</div>
                    {inviteData.shops.map((shop, i) => (
                      <div key={i} style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                        {shop}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Erro inline */}
            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: '10px', marginBottom: '16px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                fontSize: '13px', textAlign: 'left',
              }}>
                {error}
              </div>
            )}

            {/* Se não autenticado: formulário de login/registro inline */}
            {!isAuthenticated ? (
              <div>
                <div style={{
                  padding: '14px 16px', borderRadius: '10px', marginBottom: '20px',
                  backgroundColor: 'rgba(70, 114, 236, 0.06)',
                  border: '1px solid rgba(70, 114, 236, 0.15)',
                  textAlign: 'left',
                }}>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    {authMode === 'register'
                      ? 'Crie sua conta para aceitar o convite. É gratuito — os custos são cobertos pelo dono da equipe.'
                      : 'Entre na sua conta para aceitar este convite.'}
                  </p>
                </div>

                {authError && (
                  <div style={{
                    padding: '10px 14px', borderRadius: '10px', marginBottom: '16px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                    fontSize: '13px', textAlign: 'left',
                  }}>
                    {authError}
                  </div>
                )}

                <form onSubmit={handleAuthSubmit} style={{ textAlign: 'left' }}>
                  {authMode === 'register' && (
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        Nome
                      </label>
                      <input
                        type="text"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        placeholder="Seu nome"
                        required
                        style={{
                          width: '100%', padding: '11px 14px', borderRadius: '10px',
                          border: '1px solid var(--border-color)', fontSize: '14px',
                          backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)',
                          boxSizing: 'border-box', outline: 'none',
                        }}
                      />
                    </div>
                  )}

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      style={{
                        width: '100%', padding: '11px 14px', borderRadius: '10px',
                        border: '1px solid var(--border-color)', fontSize: '14px',
                        backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)',
                        boxSizing: 'border-box', outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Senha
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder={authMode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
                        required
                        style={{
                          width: '100%', padding: '11px 40px 11px 14px', borderRadius: '10px',
                          border: '1px solid var(--border-color)', fontSize: '14px',
                          backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)',
                          boxSizing: 'border-box', outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                          color: 'var(--text-tertiary)', display: 'flex',
                        }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading2}
                    style={{
                      width: '100%', padding: '12px', borderRadius: '10px',
                      border: 'none', backgroundColor: 'var(--accent)',
                      color: '#fff', cursor: authLoading2 ? 'not-allowed' : 'pointer',
                      fontSize: '14px', fontWeight: 600,
                      opacity: authLoading2 ? 0.7 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    }}
                  >
                    {authLoading2 ? (
                      <><Loader2 size={16} className="animate-spin" /> {authMode === 'register' ? 'Criando conta...' : 'Entrando...'}</>
                    ) : (
                      authMode === 'register' ? 'Criar conta e aceitar' : 'Entrar e aceitar'
                    )}
                  </button>
                </form>

                <p style={{ margin: '14px 0 0', fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                  {authMode === 'register' ? (
                    <>Já tem conta? <button onClick={() => { setAuthMode('login'); setAuthError(null) }} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '12px', padding: 0 }}>Fazer login</button></>
                  ) : (
                    <>Não tem conta? <button onClick={() => { setAuthMode('register'); setAuthError(null) }} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '12px', padding: 0 }}>Criar conta grátis</button></>
                  )}
                </p>
              </div>
            ) : (
              /* Se autenticado: botões Recusar / Aceitar */
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => navigate('/dashboard')}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '10px',
                    border: '1px solid var(--border-color)', backgroundColor: 'transparent',
                    color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px',
                  }}
                >
                  Recusar
                </button>
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '10px',
                    border: 'none', backgroundColor: 'var(--accent)',
                    color: '#fff', cursor: accepting ? 'not-allowed' : 'pointer',
                    fontSize: '14px', fontWeight: 600,
                    opacity: accepting ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  {accepting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Aceitando...
                    </>
                  ) : (
                    'Aceitar convite'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
