import { useState, useEffect } from 'react'
import { Users, UserPlus, Trash2, Edit3, Mail, Store, X, Check, Copy, Link2, Clock, Shield, Eye, MessageSquare, Crown } from 'lucide-react'
import { useTeamContext } from '../hooks/useTeamContext'
import type { TeamMember } from '../hooks/useTeamContext'
import { useUserProfile } from '../hooks/useUserProfile'
import { useIsMobile } from '../hooks/useIsMobile'
import { supabase } from '../lib/supabase'

const roleLabels: Record<string, string> = {
  viewer: 'Visualizador',
  operator: 'Operador',
  manager: 'Gerente',
}

const roleDescriptions: Record<string, string> = {
  viewer: 'Acessa apenas o painel de controle e visualiza as conversas recebidas. Não pode responder, editar lojas ou realizar ações.',
  operator: 'Visualiza o painel, responde conversas/tickets e gerencia formulários. Não pode editar lojas, ver billing ou gerenciar a equipe.',
  manager: 'Acesso completo: responde conversas, edita lojas, visualiza billing e pode convidar/gerenciar membros da equipe.',
}

const roleColors: Record<string, string> = {
  viewer: '#94a3b8',
  operator: '#3b82f6',
  manager: '#8b5cf6',
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

const RoleIcon = ({ role, size = 12 }: { role: string; size?: number }) => {
  switch (role) {
    case 'viewer': return <Eye size={size} />
    case 'operator': return <MessageSquare size={size} />
    case 'manager': return <Crown size={size} />
    default: return <Shield size={size} />
  }
}

export default function Team() {
  const { members, invites, refetch, loading } = useTeamContext()
  const { shops } = useUserProfile()
  const isMobile = useIsMobile()
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<'viewer' | 'operator' | 'manager'>('viewer')
  const [selectedShops, setSelectedShops] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editingMember, setEditingMember] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<'viewer' | 'operator' | 'manager'>('viewer')
  const [editShops, setEditShops] = useState<string[]>([])
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null)
  const [lastCreatedInvite, setLastCreatedInvite] = useState<{ code: string; email: string } | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  const getInviteLink = (code: string) => {
    const baseUrl = window.location.origin
    return `${baseUrl}/team/invite/${code}`
  }

  const copyInviteLink = async (code: string, inviteId: string) => {
    try {
      await navigator.clipboard.writeText(getInviteLink(code))
      setCopiedInviteId(inviteId)
      setTimeout(() => setCopiedInviteId(null), 2000)
    } catch {
      // Fallback
      const el = document.createElement('textarea')
      el.value = getInviteLink(code)
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopiedInviteId(inviteId)
      setTimeout(() => setCopiedInviteId(null), 2000)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail || selectedShops.length === 0) {
      setMessage({ type: 'error', text: 'Preencha o email e selecione pelo menos uma loja' })
      return
    }

    setSending(true)
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token

      console.log('[Team] Enviando convite:', { inviteEmail, inviteRole, selectedShops, hasToken: !!token })

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/team-invite`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invited_email: inviteEmail,
          invited_name: inviteName || null,
          role: inviteRole,
          allowed_shop_ids: selectedShops,
        }),
      })

      console.log('[Team] Response status:', res.status)
      const data = await res.json()
      console.log('[Team] Response data:', data)

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || `Erro do servidor (${res.status})` })
        return
      }

      // Salvar dados do convite recém-criado para mostrar o link
      if (data.invite?.code) {
        setLastCreatedInvite({ code: data.invite.code, email: inviteEmail })
      }

      setMessage({ type: 'success', text: 'Convite criado com sucesso!' })
      setInviteEmail('')
      setInviteName('')
      setInviteRole('viewer')
      setSelectedShops([])
      setShowInviteForm(false)
      refetch()
    } catch (err) {
      console.error('Erro ao enviar convite:', err)
      setMessage({ type: 'error', text: 'Erro ao enviar convite' })
    } finally {
      setSending(false)
    }
  }

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token

      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/team-invite?id=${inviteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      })

      setMessage({ type: 'success', text: 'Convite cancelado' })
      setUpdating(true)
      await refetch()
      setUpdating(false)
    } catch {
      setMessage({ type: 'error', text: 'Erro ao cancelar convite' })
      setUpdating(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Tem certeza que deseja remover este membro da equipe?')) return

    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token

      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/team-members?id=${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      })

      setMessage({ type: 'success', text: 'Membro removido da equipe' })
      setUpdating(true)
      await refetch()
      setUpdating(false)
    } catch {
      setMessage({ type: 'error', text: 'Erro ao remover membro' })
      setUpdating(false)
    }
  }

  const handleUpdateMember = async (memberId: string) => {
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/team-members`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          member_id: memberId,
          role: editRole,
          allowed_shop_ids: editShops,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || 'Erro ao atualizar membro' })
        return
      }

      setMessage({ type: 'success', text: 'Membro atualizado com sucesso' })
      setEditingMember(null)
      setUpdating(true)
      await refetch()
      setUpdating(false)
    } catch {
      setMessage({ type: 'error', text: 'Erro ao atualizar membro' })
      setUpdating(false)
    }
  }

  const startEditing = (member: TeamMember) => {
    setEditingMember(member.id)
    setEditRole(member.role)
    setEditShops(member.allowed_shop_ids || [])
  }

  const toggleShop = (shopId: string, target: 'invite' | 'edit') => {
    if (target === 'invite') {
      setSelectedShops((prev) =>
        prev.includes(shopId) ? prev.filter((id) => id !== shopId) : [...prev, shopId]
      )
    } else {
      setEditShops((prev) =>
        prev.includes(shopId) ? prev.filter((id) => id !== shopId) : [...prev, shopId]
      )
    }
  }

  const selectAllShops = (target: 'invite' | 'edit') => {
    const allIds = shops.map(s => s.id)
    if (target === 'invite') {
      setSelectedShops(prev => prev.length === allIds.length ? [] : allIds)
    } else {
      setEditShops(prev => prev.length === allIds.length ? [] : allIds)
    }
  }

  const pendingInvites = invites.filter((i) => i.status === 'pending')

  const getDaysRemaining = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    return days
  }

  if (loading || updating) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
        {/* Header skeleton */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center',
          marginBottom: '28px', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '16px' : '0',
        }}>
          <div>
            <Skeleton height={28} width={120} />
            <div style={{ marginTop: 8 }}><Skeleton height={14} width={320} /></div>
          </div>
          <Skeleton height={42} width={isMobile ? '100%' : 180} />
        </div>

        {/* Members section skeleton */}
        <div style={{ marginBottom: '32px' }}>
          <Skeleton height={20} width={180} />
          <div style={{ marginTop: 16, display: 'grid', gap: '12px' }}>
            {[1, 2].map((i) => (
              <div key={i} style={{
                padding: '20px', borderRadius: '12px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                display: 'flex', alignItems: 'center', gap: '16px',
              }}>
                <Skeleton height={40} width={40} />
                <div style={{ flex: 1 }}>
                  <Skeleton height={16} width="40%" />
                  <div style={{ marginTop: 6 }}><Skeleton height={12} width="25%" /></div>
                </div>
                <Skeleton height={26} width={80} />
              </div>
            ))}
          </div>
        </div>

        {/* Invites section skeleton */}
        <div>
          <Skeleton height={20} width={200} />
          <div style={{ marginTop: 16, display: 'grid', gap: '12px' }}>
            <div style={{
              padding: '20px', borderRadius: '12px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              display: 'flex', alignItems: 'center', gap: '16px',
            }}>
              <Skeleton height={40} width={40} />
              <div style={{ flex: 1 }}>
                <Skeleton height={16} width="35%" />
                <div style={{ marginTop: 6 }}><Skeleton height={12} width="20%" /></div>
              </div>
              <Skeleton height={26} width={70} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center',
        marginBottom: '28px', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '16px' : '0',
      }}>
        <div>
          <h1 style={{ fontSize: isMobile ? '22px' : '26px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Equipe
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0', fontSize: '14px', lineHeight: '1.5' }}>
            Gerencie quem tem acesso à sua conta e controle as permissões
          </p>
        </div>
        <button
          onClick={() => { setShowInviteForm(!showInviteForm); setLastCreatedInvite(null) }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '11px 22px', borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--accent), #7c3aed)',
            color: '#fff', border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: '14px',
            boxShadow: '0 2px 8px rgba(124, 58, 237, 0.25)',
            transition: 'transform 0.15s, box-shadow 0.15s',
            width: isMobile ? '100%' : 'auto', justifyContent: 'center',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.35)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(124, 58, 237, 0.25)' }}
        >
          <UserPlus size={16} />
          Convidar membro
        </button>
      </div>

      {/* Mensagem de feedback */}
      {message && (
        <div style={{
          padding: '14px 18px', borderRadius: '10px', marginBottom: '20px',
          backgroundColor: message.type === 'success' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
          color: message.type === 'success' ? '#22c55e' : '#ef4444',
          border: `1px solid ${message.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`,
          display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px',
        }}>
          {message.type === 'success' ? <Check size={16} /> : <X size={16} />}
          {message.text}
        </div>
      )}

      {/* Link do convite recém-criado */}
      {lastCreatedInvite && (
        <div style={{
          padding: '18px 20px', borderRadius: '12px', marginBottom: '20px',
          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(59, 130, 246, 0.08))',
          border: '1px solid rgba(124, 58, 237, 0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Link2 size={16} style={{ color: '#8b5cf6' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Convite criado para {lastCreatedInvite.email}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
            Compartilhe este link com a pessoa convidada. O convite expira em 7 dias.
          </p>
          <div style={{
            display: 'flex', gap: '8px', alignItems: 'center',
            backgroundColor: 'var(--bg-primary)', borderRadius: '8px',
            padding: '10px 14px', border: '1px solid var(--border-color)',
          }}>
            <code style={{
              flex: 1, fontSize: '13px', color: 'var(--accent)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {getInviteLink(lastCreatedInvite.code)}
            </code>
            <button
              onClick={() => copyInviteLink(lastCreatedInvite.code, 'last')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '6px', border: 'none',
                backgroundColor: copiedInviteId === 'last' ? '#22c55e' : 'var(--accent)',
                color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                transition: 'background-color 0.2s', flexShrink: 0,
              }}
            >
              {copiedInviteId === 'last' ? <><Check size={12} /> Copiado!</> : <><Copy size={12} /> Copiar</>}
            </button>
          </div>
        </div>
      )}

      {/* Formulário de convite */}
      {showInviteForm && (
        <div style={{
          backgroundColor: 'var(--bg-card)', borderRadius: '14px',
          border: '1px solid var(--border-color)', padding: isMobile ? '20px' : '28px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Novo convite
            </h3>
            <button
              onClick={() => { setShowInviteForm(false); setSelectedShops([]); setInviteEmail(''); setInviteName('') }}
              style={{
                padding: '6px', borderRadius: '6px', border: 'none',
                backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)',
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Email *
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@exemplo.com"
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: '10px',
                  border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)', fontSize: '14px', boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                  outline: 'none',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Nome (opcional)
              </label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Nome do membro"
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: '10px',
                  border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)', fontSize: '14px', boxSizing: 'border-box',
                  outline: 'none',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              />
            </div>
          </div>

          {/* Role selector */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
              Permissão *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '10px' }}>
              {(['viewer', 'operator', 'manager'] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => setInviteRole(role)}
                  style={{
                    padding: '14px 16px', borderRadius: '10px',
                    border: `2px solid ${inviteRole === role ? roleColors[role] : 'var(--border-color)'}`,
                    backgroundColor: inviteRole === role ? `${roleColors[role]}10` : 'transparent',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <RoleIcon role={role} size={16} />
                    <span style={{ fontSize: '14px', fontWeight: 700, color: roleColors[role] }}>
                      {roleLabels[role]}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {roleDescriptions[role]}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detalhes da permissão selecionada */}
          <div style={{
            marginBottom: '20px', padding: '16px 20px', borderRadius: '10px',
            backgroundColor: `${roleColors[inviteRole]}06`,
            border: `1px solid ${roleColors[inviteRole]}20`,
          }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: roleColors[inviteRole], marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RoleIcon role={inviteRole} size={14} />
              O que o {roleLabels[inviteRole]} pode fazer:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '6px 16px' }}>
              {[
                { label: 'Ver painel de controle', viewer: true, operator: true, manager: true },
                { label: 'Ver conversas recebidas', viewer: true, operator: true, manager: true },
                { label: 'Responder conversas e tickets', viewer: false, operator: true, manager: true },
                { label: 'Ver e gerenciar formulários', viewer: false, operator: true, manager: true },
                { label: 'Ver e editar lojas', viewer: false, operator: false, manager: true },
                { label: 'Ver billing e plano', viewer: false, operator: false, manager: true },
                { label: 'Convidar e gerenciar membros', viewer: false, operator: false, manager: true },
              ].map((perm) => {
                const allowed = perm[inviteRole as keyof typeof perm] as boolean
                return (
                  <div key={perm.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '3px 0' }}>
                    <span style={{
                      width: '16px', height: '16px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: allowed ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.08)',
                      color: allowed ? '#22c55e' : '#ef4444', fontSize: '10px', flexShrink: 0,
                    }}>
                      {allowed ? <Check size={10} /> : <X size={10} />}
                    </span>
                    <span style={{ color: allowed ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                      {perm.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Shop selector */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Lojas com acesso * <span style={{ fontWeight: 400 }}>({selectedShops.length} de {shops.length})</span>
              </label>
              {shops.length > 1 && (
                <button
                  onClick={() => selectAllShops('invite')}
                  style={{
                    fontSize: '12px', color: 'var(--accent)', cursor: 'pointer',
                    border: 'none', backgroundColor: 'transparent', fontWeight: 600,
                  }}
                >
                  {selectedShops.length === shops.length ? 'Desmarcar todas' : 'Selecionar todas'}
                </button>
              )}
            </div>
            {shops.length === 0 ? (
              <div style={{
                padding: '20px', borderRadius: '10px', backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)', textAlign: 'center',
              }}>
                <Store size={20} style={{ color: 'var(--text-tertiary)', marginBottom: '8px' }} />
                <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', margin: 0 }}>
                  Nenhuma loja cadastrada. Cadastre uma loja primeiro.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px' }}>
                {shops.map((shop) => {
                  const isSelected = selectedShops.includes(shop.id)
                  return (
                    <label
                      key={shop.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px 14px', borderRadius: '10px',
                        border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border-color)'}`,
                        backgroundColor: isSelected ? 'rgba(124, 58, 237, 0.04)' : 'transparent',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleShop(shop.id, 'invite')}
                        style={{ accentColor: 'var(--accent)', width: '16px', height: '16px' }}
                      />
                      <Store size={15} style={{ color: isSelected ? 'var(--accent)' : 'var(--text-tertiary)', flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {shop.name}
                        </div>
                        {shop.shopify_domain && (
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {shop.shopify_domain}
                          </div>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Botões */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setShowInviteForm(false); setSelectedShops([]); setInviteEmail(''); setInviteName('') }}
              style={{
                padding: '11px 22px', borderRadius: '10px',
                border: '1px solid var(--border-color)', backgroundColor: 'transparent',
                color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleInvite}
              disabled={sending || !inviteEmail || selectedShops.length === 0}
              style={{
                padding: '11px 26px', borderRadius: '10px',
                border: 'none',
                background: (sending || !inviteEmail || selectedShops.length === 0) ? 'var(--border-color)' : 'linear-gradient(135deg, var(--accent), #7c3aed)',
                color: '#fff', cursor: (sending || !inviteEmail || selectedShops.length === 0) ? 'not-allowed' : 'pointer',
                fontSize: '14px', fontWeight: 600,
                boxShadow: (sending || !inviteEmail || selectedShops.length === 0) ? 'none' : '0 2px 8px rgba(124, 58, 237, 0.25)',
              }}
            >
              {sending ? 'Criando convite...' : 'Criar convite'}
            </button>
          </div>
        </div>
      )}

      {/* Stats rápidas */}
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: '12px',
        marginBottom: '24px',
      }}>
        <div style={{
          backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '16px 20px',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{members.length}</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Membros ativos</div>
        </div>
        <div style={{
          backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '16px 20px',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#f59e0b' }}>{pendingInvites.length}</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Convites pendentes</div>
        </div>
        {!isMobile && (
          <div style={{
            backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '16px 20px',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent)' }}>{shops.length}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Lojas disponíveis</div>
          </div>
        )}
      </div>

      {/* Membros atuais */}
      <div style={{
        backgroundColor: 'var(--bg-card)', borderRadius: '14px',
        border: '1px solid var(--border-color)', marginBottom: '24px',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 style={{
            margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <Users size={17} style={{ color: 'var(--accent)' }} />
            Membros da equipe
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
            {members.length} membro{members.length !== 1 ? 's' : ''}
          </span>
        </div>

        {members.length === 0 ? (
          <div style={{ padding: '50px 24px', textAlign: 'center' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 16px',
              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(59, 130, 246, 0.1))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Users size={28} style={{ color: 'var(--accent)' }} />
            </div>
            <p style={{ color: 'var(--text-primary)', margin: '0 0 6px', fontSize: '15px', fontWeight: 600 }}>
              Nenhum membro na equipe
            </p>
            <p style={{ color: 'var(--text-tertiary)', margin: 0, fontSize: '13px', maxWidth: '320px', marginLeft: 'auto', marginRight: 'auto', lineHeight: '1.5' }}>
              Convide colaboradores para gerenciar suas lojas e atender seus clientes
            </p>
          </div>
        ) : (
          <div>
            {members.map((member, index) => (
              <div key={member.id} style={{
                padding: '16px 24px',
                borderBottom: index < members.length - 1 ? '1px solid var(--border-color)' : 'none',
                transition: 'background-color 0.15s',
              }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {/* Avatar */}
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '12px',
                    background: `linear-gradient(135deg, ${roleColors[member.role]}25, ${roleColors[member.role]}10)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, border: `1.5px solid ${roleColors[member.role]}30`,
                  }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: roleColors[member.role] }}>
                      {(member.user?.name || member.user?.email || '?')[0].toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {member.user?.name || 'Sem nome'}
                      </span>
                      {editingMember !== member.id && (
                        <span style={{
                          padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                          backgroundColor: `${roleColors[member.role]}12`,
                          color: roleColors[member.role],
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          whiteSpace: 'nowrap',
                        }}>
                          <RoleIcon role={member.role} /> {roleLabels[member.role]}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      {member.user?.email}
                      {member.shops && member.shops.length > 0 && (
                        <span> · {member.shops.length} loja{member.shops.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {editingMember !== member.id ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => startEditing(member)} style={{
                        padding: '8px', borderRadius: '8px', border: 'none',
                        backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)',
                        transition: 'background-color 0.15s',
                      }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Editar permissões"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button onClick={() => handleRemoveMember(member.id)} style={{
                        padding: '8px', borderRadius: '8px', border: 'none',
                        backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)',
                        transition: 'all 0.15s',
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444' }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
                        title="Remover membro"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as 'viewer' | 'operator' | 'manager')}
                        style={{
                          padding: '7px 12px', borderRadius: '8px', fontSize: '13px',
                          border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)',
                          color: 'var(--text-primary)', cursor: 'pointer',
                        }}
                      >
                        <option value="viewer">Visualizador</option>
                        <option value="operator">Operador</option>
                        <option value="manager">Gerente</option>
                      </select>
                      <button onClick={() => handleUpdateMember(member.id)} style={{
                        padding: '7px 14px', borderRadius: '8px', border: 'none',
                        backgroundColor: 'var(--accent)', color: '#fff',
                        cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                      }}>
                        Salvar
                      </button>
                      <button onClick={() => setEditingMember(null)} style={{
                        padding: '7px 14px', borderRadius: '8px',
                        border: '1px solid var(--border-color)', backgroundColor: 'transparent',
                        color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px',
                      }}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                {/* Shop selector ao editar */}
                {editingMember === member.id && (
                  <div style={{ padding: '0 24px 16px', borderTop: '1px solid var(--border-color)', marginTop: '4px', paddingTop: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Lojas com acesso <span style={{ fontWeight: 400 }}>({editShops.length} de {shops.length})</span>
                      </label>
                      {shops.length > 1 && (
                        <button
                          onClick={() => selectAllShops('edit')}
                          style={{
                            fontSize: '12px', color: 'var(--accent)', cursor: 'pointer',
                            border: 'none', backgroundColor: 'transparent', fontWeight: 600,
                          }}
                        >
                          {editShops.length === shops.length ? 'Desmarcar todas' : 'Selecionar todas'}
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px' }}>
                      {shops.map((shop) => {
                        const isSelected = editShops.includes(shop.id)
                        return (
                          <label
                            key={shop.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '12px',
                              padding: '10px 14px', borderRadius: '10px',
                              border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border-color)'}`,
                              backgroundColor: isSelected ? 'rgba(124, 58, 237, 0.04)' : 'transparent',
                              cursor: 'pointer', transition: 'all 0.15s',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleShop(shop.id, 'edit')}
                              style={{ accentColor: 'var(--accent)', width: '16px', height: '16px' }}
                            />
                            <Store size={15} style={{ color: isSelected ? 'var(--accent)' : 'var(--text-tertiary)', flexShrink: 0 }} />
                            <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: isSelected ? 600 : 400 }}>
                              {shop.name}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                    {editShops.length === 0 && (
                      <p style={{ fontSize: '12px', color: '#ef4444', margin: '8px 0 0' }}>
                        Selecione pelo menos uma loja
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Convites pendentes */}
      {pendingInvites.length > 0 && (
        <div style={{
          backgroundColor: 'var(--bg-card)', borderRadius: '14px',
          border: '1px solid var(--border-color)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '18px 24px', borderBottom: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <h3 style={{
              margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <Mail size={17} style={{ color: '#f59e0b' }} />
              Convites pendentes
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
              {pendingInvites.length} pendente{pendingInvites.length !== 1 ? 's' : ''}
            </span>
          </div>

          {pendingInvites.map((invite, index) => {
            const daysLeft = getDaysRemaining(invite.expires_at)
            const isExpiringSoon = daysLeft <= 2

            return (
              <div key={invite.id} style={{
                padding: '16px 24px',
                borderBottom: index < pendingInvites.length - 1 ? '1px solid var(--border-color)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
                  {/* Mail icon */}
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '12px',
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, border: '1.5px solid rgba(245, 158, 11, 0.15)',
                  }}>
                    <Mail size={16} style={{ color: '#f59e0b' }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {invite.invited_name || invite.invited_email}
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                        backgroundColor: `${roleColors[invite.role]}12`,
                        color: roleColors[invite.role],
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        whiteSpace: 'nowrap',
                      }}>
                        <RoleIcon role={invite.role} /> {roleLabels[invite.role]}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      {invite.invited_name && <span>{invite.invited_email}</span>}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isExpiringSoon ? '#ef4444' : 'var(--text-tertiary)' }}>
                        <Clock size={11} />
                        {daysLeft > 0 ? `Expira em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}` : 'Expirado'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button
                      onClick={() => copyInviteLink(invite.code, invite.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        padding: '7px 12px', borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: copiedInviteId === invite.id ? 'rgba(34, 197, 94, 0.08)' : 'transparent',
                        color: copiedInviteId === invite.id ? '#22c55e' : 'var(--text-secondary)',
                        cursor: 'pointer', fontSize: '12px', fontWeight: 500,
                        transition: 'all 0.2s',
                      }}
                      title="Copiar link do convite"
                    >
                      {copiedInviteId === invite.id ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar link</>}
                    </button>
                    <button
                      onClick={() => {
                        setInviteEmail(invite.invited_email)
                        setInviteName(invite.invited_name || '')
                        setInviteRole(invite.role as 'viewer' | 'operator' | 'manager')
                        setSelectedShops(invite.allowed_shop_ids || [])
                        setShowInviteForm(true)
                        handleCancelInvite(invite.id)
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        padding: '7px 10px', borderRadius: '8px', border: 'none',
                        backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)',
                        fontSize: '12px', fontWeight: 500, transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(124,58,237,0.08)'; e.currentTarget.style.color = 'var(--accent)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
                      title="Editar convite"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Tem certeza que deseja excluir este convite?')) {
                          handleCancelInvite(invite.id)
                        }
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        padding: '7px 10px', borderRadius: '8px', border: 'none',
                        backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)',
                        fontSize: '12px', fontWeight: 500, transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
                      title="Excluir convite"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
