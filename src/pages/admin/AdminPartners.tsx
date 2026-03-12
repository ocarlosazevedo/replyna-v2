import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Handshake, Users, DollarSign, Clock, Eye, X, Check, Ban, Wallet, AlertTriangle, Search } from 'lucide-react'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return isMobile
}

interface PartnerData {
  id: string
  user_id: string
  coupon_code: string
  pix_key_type: string | null
  pix_key: string | null
  status: string
  total_referrals: number
  total_earned: number
  available_balance: number
  pending_balance: number
  withdrawn_balance: number
  created_at: string
  // joined from users
  user_name: string
  user_email: string
}

interface WithdrawalData {
  id: string
  partner_id: string
  amount: number
  pix_key_type: string
  pix_key: string
  status: string
  admin_notes: string | null
  created_at: string
  paid_at: string | null
  // joined
  partner_name: string
  partner_email: string
  partner_coupon: string
}

interface PartnerDetail {
  partner: PartnerData
  referrals: Array<{
    id: string
    user_name: string
    user_email: string
    user_plan: string
    user_status: string
    created_at: string
  }>
  commissions: Array<{
    id: string
    commission_type: string
    payment_value: number
    commission_rate: number
    commission_value: number
    status: string
    created_at: string
  }>
  withdrawals: Array<{
    id: string
    amount: number
    status: string
    admin_notes: string | null
    created_at: string
    paid_at: string | null
  }>
}

const pixKeyTypeLabels: Record<string, string> = {
  cpf: 'CPF',
  email: 'E-mail',
  phone: 'Telefone',
  random: 'Aleatória',
}

const statusColors: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', label: 'Pendente' },
  available: { bg: 'rgba(34, 197, 94, 0.12)', color: '#22c55e', label: 'Disponível' },
  withdrawn: { bg: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', label: 'Sacado' },
  reversed: { bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', label: 'Revertido' },
  approved: { bg: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', label: 'Aprovado' },
  rejected: { bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', label: 'Rejeitado' },
  paid: { bg: 'rgba(34, 197, 94, 0.12)', color: '#22c55e', label: 'Pago' },
  active: { bg: 'rgba(34, 197, 94, 0.12)', color: '#22c55e', label: 'Ativo' },
  suspended: { bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', label: 'Suspenso' },
  first_sale: { bg: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', label: '1ª Venda' },
  recurring: { bg: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', label: 'Recorrente' },
}

export default function AdminPartners() {
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [partners, setPartners] = useState<PartnerData[]>([])
  const [pendingWithdrawals, setPendingWithdrawals] = useState<WithdrawalData[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedPartner, setSelectedPartner] = useState<PartnerDetail | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Withdrawal review
  const [reviewingWithdrawal, setReviewingWithdrawal] = useState<string | null>(null)
  const [withdrawalNotes, setWithdrawalNotes] = useState('')
  const [processingWithdrawal, setProcessingWithdrawal] = useState(false)

  // Stats
  const [stats, setStats] = useState({
    totalPartners: 0,
    activePartners: 0,
    totalCommissionsPaid: 0,
    pendingWithdrawalsCount: 0,
    totalReferrals: 0,
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load partners with user info
      const { data: partnersData } = await supabase
        .from('partners')
        .select('*')
        .order('created_at', { ascending: false })

      if (partnersData && partnersData.length > 0) {
        const userIds = partnersData.map((p: any) => p.user_id)
        const { data: users } = await supabase
          .from('users')
          .select('id, name, email')
          .in('id', userIds)

        const userMap = new Map((users || []).map((u: any) => [u.id, u]))
        const enrichedPartners = partnersData.map((p: any) => ({
          ...p,
          user_name: userMap.get(p.user_id)?.name || 'Usuário',
          user_email: userMap.get(p.user_id)?.email || '',
        }))
        setPartners(enrichedPartners)

        // Calculate stats
        const active = enrichedPartners.filter((p: any) => p.status === 'active').length
        const totalEarned = enrichedPartners.reduce((sum: number, p: any) => sum + (p.withdrawn_balance || 0), 0)
        const totalRefs = enrichedPartners.reduce((sum: number, p: any) => sum + (p.total_referrals || 0), 0)

        setStats(prev => ({
          ...prev,
          totalPartners: enrichedPartners.length,
          activePartners: active,
          totalCommissionsPaid: totalEarned,
          totalReferrals: totalRefs,
        }))
      }

      // Load pending withdrawals
      const { data: wdData } = await supabase
        .from('partner_withdrawals')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      if (wdData && wdData.length > 0) {
        const partnerIds = [...new Set(wdData.map((w: any) => w.partner_id))]
        const { data: wdPartners } = await supabase
          .from('partners')
          .select('id, coupon_code, user_id')
          .in('id', partnerIds)

        const partnerMap = new Map((wdPartners || []).map((p: any) => [p.id, p]))

        // Get user info for these partners
        const wdUserIds = (wdPartners || []).map((p: any) => p.user_id)
        const { data: wdUsers } = await supabase
          .from('users')
          .select('id, name, email')
          .in('id', wdUserIds)

        const wdUserMap = new Map((wdUsers || []).map((u: any) => [u.id, u]))

        const enrichedWd = wdData.map((w: any) => {
          const partner = partnerMap.get(w.partner_id)
          const user = partner ? wdUserMap.get(partner.user_id) : null
          return {
            ...w,
            partner_name: user?.name || 'Usuário',
            partner_email: user?.email || '',
            partner_coupon: partner?.coupon_code || '',
          }
        })
        setPendingWithdrawals(enrichedWd)
        setStats(prev => ({ ...prev, pendingWithdrawalsCount: enrichedWd.length }))
      }
    } catch (err) {
      console.error('Error loading partners data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleViewPartnerDetail = async (partner: PartnerData) => {
    try {
      // Load referrals
      const { data: refs } = await supabase
        .from('partner_referrals')
        .select('id, referred_user_id, created_at')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false })

      let enrichedRefs: any[] = []
      if (refs && refs.length > 0) {
        const userIds = refs.map((r: any) => r.referred_user_id)
        const { data: users } = await supabase.from('users').select('id, name, email, plan, status').in('id', userIds)
        const userMap = new Map((users || []).map((u: any) => [u.id, u]))
        enrichedRefs = refs.map((r: any) => ({
          ...r,
          user_name: userMap.get(r.referred_user_id)?.name || 'Usuário',
          user_email: userMap.get(r.referred_user_id)?.email || '',
          user_plan: userMap.get(r.referred_user_id)?.plan || '-',
          user_status: userMap.get(r.referred_user_id)?.status || 'inactive',
        }))
      }

      // Load commissions
      const { data: comms } = await supabase
        .from('partner_commissions')
        .select('id, commission_type, payment_value, commission_rate, commission_value, status, created_at')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false })
        .limit(30)

      // Load withdrawals
      const { data: wds } = await supabase
        .from('partner_withdrawals')
        .select('id, amount, status, admin_notes, created_at, paid_at')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false })

      setSelectedPartner({
        partner,
        referrals: enrichedRefs,
        commissions: comms || [],
        withdrawals: wds || [],
      })
      setShowDetailModal(true)
    } catch (err) {
      console.error('Error loading partner detail:', err)
    }
  }

  const handleTogglePartnerStatus = async (partnerId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active'
    const confirmMsg = newStatus === 'suspended'
      ? 'Suspender este parceiro? Ele perderá todas as comissões pendentes e disponíveis.'
      : 'Reativar este parceiro?'
    if (!confirm(confirmMsg)) return

    try {
      const updateData: any = { status: newStatus }
      if (newStatus === 'suspended') {
        updateData.available_balance = 0
        updateData.pending_balance = 0
      }

      const { error } = await supabase
        .from('partners')
        .update(updateData)
        .eq('id', partnerId)
      if (error) throw error
      loadData()
    } catch (err) {
      console.error('Error toggling partner status:', err)
    }
  }

  const handleWithdrawalAction = async (withdrawalId: string, action: 'approved' | 'rejected' | 'paid') => {
    setProcessingWithdrawal(true)
    try {
      const updateData: any = {
        status: action,
        admin_notes: withdrawalNotes || null,
        reviewed_at: new Date().toISOString(),
      }
      if (action === 'paid') {
        updateData.paid_at = new Date().toISOString()
      }

      // If rejecting, we need to return the amount to the partner's available_balance
      if (action === 'rejected') {
        const withdrawal = pendingWithdrawals.find(w => w.id === withdrawalId)
        if (withdrawal) {
          const { data: partnerData } = await supabase
            .from('partners')
            .select('available_balance')
            .eq('id', withdrawal.partner_id)
            .single()

          if (partnerData) {
            await supabase
              .from('partners')
              .update({ available_balance: partnerData.available_balance + withdrawal.amount })
              .eq('id', withdrawal.partner_id)
          }
        }
      }

      const { error } = await supabase
        .from('partner_withdrawals')
        .update(updateData)
        .eq('id', withdrawalId)

      if (error) throw error
      setReviewingWithdrawal(null)
      setWithdrawalNotes('')
      loadData()
    } catch (err) {
      console.error('Error processing withdrawal:', err)
    } finally {
      setProcessingWithdrawal(false)
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date))

  const filteredPartners = partners.filter(p => {
    const matchesSearch = !searchTerm ||
      p.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.coupon_code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

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

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ height: '32px', width: '200px', backgroundColor: 'var(--border-color)', borderRadius: '8px', marginBottom: '32px', animation: 'replyna-pulse 1.6s ease-in-out infinite' }} />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
        <h1 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
          Parceiros
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '14px' : '15px' }}>
          Gerencie parceiros, comissões e saques
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)',
        gap: isMobile ? '12px' : '16px',
        marginBottom: '24px',
      }}>
        {[
          { label: 'Total Partners', value: stats.totalPartners.toString(), icon: Handshake, color: '#6366f1' },
          { label: 'Ativos', value: stats.activePartners.toString(), icon: Users, color: '#22c55e' },
          { label: 'Comissões Pagas', value: formatCurrency(stats.totalCommissionsPaid), icon: DollarSign, color: '#3b82f6' },
          { label: 'Saques Pendentes', value: stats.pendingWithdrawalsCount.toString(), icon: Clock, color: '#f59e0b' },
          { label: 'Total Indicados', value: stats.totalReferrals.toString(), icon: Users, color: '#8b5cf6' },
        ].map((stat) => (
          <div key={stat.label} style={{ ...cardStyle, padding: isMobile ? '14px' : '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                backgroundColor: `${stat.color}14`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <stat.icon size={16} style={{ color: stat.color }} />
              </div>
            </div>
            <div style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{stat.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Pending Withdrawals Section */}
      {pendingWithdrawals.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: '24px', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <AlertTriangle size={20} style={{ color: '#f59e0b' }} />
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Saques Pendentes ({pendingWithdrawals.length})
            </h2>
          </div>

          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingWithdrawals.map((w) => (
                <div key={w.id} style={{
                  padding: '14px', borderRadius: '12px',
                  backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{w.partner_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{w.partner_email}</div>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {formatCurrency(w.amount)}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    PIX ({pixKeyTypeLabels[w.pix_key_type]}): {w.pix_key} | {formatDate(w.created_at)}
                  </div>
                  {reviewingWithdrawal === w.id ? (
                    <div>
                      <textarea
                        value={withdrawalNotes}
                        onChange={(e) => setWithdrawalNotes(e.target.value)}
                        placeholder="Notas (opcional)"
                        style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' as const, marginBottom: '8px' }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => { setReviewingWithdrawal(null); setWithdrawalNotes('') }}
                          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}>
                          Cancelar
                        </button>
                        <button onClick={() => handleWithdrawalAction(w.id, 'rejected')} disabled={processingWithdrawal}
                          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', backgroundColor: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                          Rejeitar
                        </button>
                        <button onClick={() => handleWithdrawalAction(w.id, 'approved')} disabled={processingWithdrawal}
                          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', backgroundColor: '#22c55e', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                          Aprovar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setReviewingWithdrawal(w.id)}
                        style={{
                          flex: 1, padding: '8px 12px', borderRadius: '8px',
                          border: 'none', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366f1',
                          cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                        }}>
                        Revisar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
                  <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>Parceiro</th>
                  <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>Valor</th>
                  <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>Chave PIX</th>
                  <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>Data</th>
                  <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {pendingWithdrawals.map((w) => (
                  <tr key={w.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{w.partner_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{w.partner_email}</div>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 700, color: 'var(--text-primary)', fontSize: '15px' }}>
                      {formatCurrency(w.amount)}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      <div>{pixKeyTypeLabels[w.pix_key_type]}</div>
                      <div style={{ fontFamily: 'monospace' }}>{w.pix_key}</div>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>{formatDate(w.created_at)}</td>
                    <td style={{ padding: '12px' }}>
                      {reviewingWithdrawal === w.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px' }}>
                          <input
                            type="text"
                            value={withdrawalNotes}
                            onChange={(e) => setWithdrawalNotes(e.target.value)}
                            placeholder="Notas (opcional)"
                            style={{ ...inputStyle, padding: '8px 12px', fontSize: '12px' }}
                          />
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => { setReviewingWithdrawal(null); setWithdrawalNotes('') }}
                              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px' }}>
                              <X size={12} />
                            </button>
                            <button onClick={() => handleWithdrawalAction(w.id, 'rejected')} disabled={processingWithdrawal}
                              style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Ban size={12} /> Rejeitar
                            </button>
                            <button onClick={() => handleWithdrawalAction(w.id, 'approved')} disabled={processingWithdrawal}
                              style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#22c55e', color: '#fff', cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Check size={12} /> Aprovar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => setReviewingWithdrawal(w.id)}
                            style={{
                              padding: '6px 12px', borderRadius: '6px',
                              border: 'none', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366f1',
                              cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                            }}>
                            Revisar
                          </button>
                          <button onClick={() => handleWithdrawalAction(w.id, 'paid')}
                            style={{
                              padding: '6px 12px', borderRadius: '6px',
                              border: 'none', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e',
                              cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                              display: 'flex', alignItems: 'center', gap: '4px',
                            }}>
                            <Wallet size={12} /> Marcar Pago
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Partners List */}
      <div style={cardStyle}>
        {/* Filters */}
        <div style={{
          display: 'flex', flexDirection: isMobile ? 'column' : 'row',
          gap: '12px', marginBottom: '20px',
        }}>
          <div style={{ flex: 1, position: 'relative' as const }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, email ou cupom..."
              style={{ ...inputStyle, paddingLeft: '38px' }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="replyna-select form-input"
            style={{ ...inputStyle, width: isMobile ? '100%' : '160px' }}
          >
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="suspended">Suspensos</option>
          </select>
        </div>

        {/* Partners Table */}
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredPartners.map((p) => {
              const s = statusColors[p.status] || statusColors.active
              return (
                <div key={p.id} style={{
                  padding: '14px', borderRadius: '12px',
                  backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{p.user_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{p.user_email}</div>
                    </div>
                    <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Cupom</div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#6366f1', fontSize: '13px' }}>{p.coupon_code}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Indicados</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.total_referrals}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Ganho</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(p.total_earned)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Saldo Disp.</div>
                      <div style={{ fontWeight: 600, color: '#22c55e' }}>{formatCurrency(p.available_balance)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleViewPartnerDetail(p)}
                      style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <Eye size={14} /> Detalhes
                    </button>
                    <button onClick={() => handleTogglePartnerStatus(p.id, p.status)}
                      style={{
                        flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                        backgroundColor: p.status === 'active' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                        color: p.status === 'active' ? '#ef4444' : '#22c55e',
                        cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                      }}>
                      {p.status === 'active' ? <><Ban size={14} /> Suspender</> : <><Check size={14} /> Reativar</>}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
                <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>Parceiro</th>
                <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>Cupom</th>
                <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>Indicados</th>
                <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>Total Ganho</th>
                <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>Saldo Disp.</th>
                <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>Status</th>
                <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredPartners.map((p) => {
                const s = statusColors[p.status] || statusColors.active
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '14px 12px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.user_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{p.user_email}</div>
                    </td>
                    <td style={{ padding: '14px 12px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#6366f1', fontSize: '14px' }}>{p.coupon_code}</span>
                    </td>
                    <td style={{ padding: '14px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.total_referrals}</td>
                    <td style={{ padding: '14px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(p.total_earned)}</td>
                    <td style={{ padding: '14px 12px', fontWeight: 600, color: '#22c55e' }}>{formatCurrency(p.available_balance)}</td>
                    <td style={{ padding: '14px 12px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                    <td style={{ padding: '14px 12px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleViewPartnerDetail(p)}
                          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                          <Eye size={14} /> Ver
                        </button>
                        <button onClick={() => handleTogglePartnerStatus(p.id, p.status)}
                          style={{
                            padding: '6px 10px', borderRadius: '6px', border: 'none',
                            backgroundColor: p.status === 'active' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)',
                            color: p.status === 'active' ? '#ef4444' : '#22c55e',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px',
                          }}>
                          {p.status === 'active' ? <><Ban size={12} /> Suspender</> : <><Check size={12} /> Reativar</>}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {filteredPartners.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
            {searchTerm || statusFilter !== 'all' ? 'Nenhum parceiro encontrado com esses filtros' : 'Nenhum parceiro cadastrado ainda'}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedPartner && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
          onClick={() => setShowDetailModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '24px',
              width: '100%', maxWidth: '800px', maxHeight: '85vh', overflowY: 'auto' as const,
              border: '1px solid var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {selectedPartner.partner.user_name}
                </h2>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {selectedPartner.partner.user_email} | Cupom: <strong style={{ color: '#6366f1' }}>{selectedPartner.partner.coupon_code}</strong> | Desde: {formatDate(selectedPartner.partner.created_at)}
                </div>
                {selectedPartner.partner.pix_key && (
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    PIX ({pixKeyTypeLabels[selectedPartner.partner.pix_key_type!]}): {selectedPartner.partner.pix_key}
                  </div>
                )}
              </div>
              <button onClick={() => setShowDetailModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
              {[
                { label: 'Total Ganho', value: formatCurrency(selectedPartner.partner.total_earned), color: '#6366f1' },
                { label: 'Disponível', value: formatCurrency(selectedPartner.partner.available_balance), color: '#22c55e' },
                { label: 'Pendente', value: formatCurrency(selectedPartner.partner.pending_balance), color: '#f59e0b' },
                { label: 'Sacado', value: formatCurrency(selectedPartner.partner.withdrawn_balance), color: '#3b82f6' },
              ].map((s) => (
                <div key={s.label} style={{
                  padding: '14px', borderRadius: '12px',
                  backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                  textAlign: 'center' as const,
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{s.label}</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Referrals Section */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '12px' }}>
                Indicados ({selectedPartner.referrals.length})
              </h3>
              {selectedPartner.referrals.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>Nenhum indicado</div>
              ) : (
                <div style={{ overflowX: 'auto' as const }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700 }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Nome</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Email</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Plano</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Status</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPartner.referrals.map((r) => {
                        const rs = statusColors[r.user_status] || statusColors.active
                        return (
                          <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.user_name}</td>
                            <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{r.user_email}</td>
                            <td style={{ padding: '8px', color: 'var(--text-primary)' }}>{r.user_plan}</td>
                            <td style={{ padding: '8px' }}>
                              <span style={{ padding: '2px 6px', borderRadius: '999px', fontSize: '10px', fontWeight: 600, backgroundColor: rs.bg, color: rs.color }}>{rs.label}</span>
                            </td>
                            <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{formatDate(r.created_at)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Commissions Section */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '12px' }}>
                Comissões Recentes ({selectedPartner.commissions.length})
              </h3>
              {selectedPartner.commissions.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>Nenhuma comissão</div>
              ) : (
                <div style={{ overflowX: 'auto' as const }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700 }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Data</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Tipo</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Valor Pago</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Comissão</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPartner.commissions.map((c) => {
                        const cs = statusColors[c.status] || statusColors.pending
                        const ct = statusColors[c.commission_type] || statusColors.recurring
                        return (
                          <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{formatDate(c.created_at)}</td>
                            <td style={{ padding: '8px' }}>
                              <span style={{ padding: '2px 6px', borderRadius: '999px', fontSize: '10px', fontWeight: 600, backgroundColor: ct.bg, color: ct.color }}>{ct.label}</span>
                            </td>
                            <td style={{ padding: '8px', color: 'var(--text-primary)' }}>{formatCurrency(c.payment_value)}</td>
                            <td style={{ padding: '8px', fontWeight: 700, color: '#22c55e' }}>{formatCurrency(c.commission_value)}</td>
                            <td style={{ padding: '8px' }}>
                              <span style={{ padding: '2px 6px', borderRadius: '999px', fontSize: '10px', fontWeight: 600, backgroundColor: cs.bg, color: cs.color }}>{cs.label}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Withdrawals Section */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '12px' }}>
                Histórico de Saques ({selectedPartner.withdrawals.length})
              </h3>
              {selectedPartner.withdrawals.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>Nenhum saque</div>
              ) : (
                <div style={{ overflowX: 'auto' as const }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700 }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Data</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Valor</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Status</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPartner.withdrawals.map((w) => {
                        const ws = statusColors[w.status] || statusColors.pending
                        return (
                          <tr key={w.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{formatDate(w.created_at)}</td>
                            <td style={{ padding: '8px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(w.amount)}</td>
                            <td style={{ padding: '8px' }}>
                              <span style={{ padding: '2px 6px', borderRadius: '999px', fontSize: '10px', fontWeight: 600, backgroundColor: ws.bg, color: ws.color }}>{ws.label}</span>
                            </td>
                            <td style={{ padding: '8px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{w.admin_notes || '-'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
