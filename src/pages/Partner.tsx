import { useState, useEffect, useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { Copy, Link2, CheckCircle, AlertCircle, Share2 } from 'lucide-react'
import { useIsMobile } from '../hooks/useIsMobile'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend)

// ── Types ──
interface Partner {
  id: string; user_id: string; coupon_code: string; pix_key_type: string | null; pix_key: string | null
  status: string; total_referrals: number; total_earned: number; available_balance: number
  pending_balance: number; withdrawn_balance: number; created_at: string
}
interface Referral { id: string; referred_user_id: string; created_at: string; user_name: string; user_email: string; user_plan: string; user_status: string }
interface Commission { id: string; commission_type: 'first_sale' | 'recurring'; payment_value: number; commission_rate: number; commission_value: number; status: string; created_at: string }
interface Withdrawal { id: string; amount: number; pix_key_type: string; pix_key: string; status: string; admin_notes: string | null; created_at: string; paid_at: string | null }

const pixKeyTypeLabels: Record<string, string> = { cpf: 'CPF', email: 'E-mail', phone: 'Telefone', random: 'Aleatória' }

const statusColors: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', label: 'Pendente' },
  available: { bg: 'rgba(34,197,94,0.1)', color: '#22c55e', label: 'Disponível' },
  withdrawn: { bg: 'rgba(99,102,241,0.1)', color: '#6366f1', label: 'Sacado' },
  reversed: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', label: 'Revertido' },
  approved: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6', label: 'Aprovado' },
  rejected: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', label: 'Rejeitado' },
  paid: { bg: 'rgba(34,197,94,0.1)', color: '#22c55e', label: 'Pago' },
  active: { bg: 'rgba(34,197,94,0.1)', color: '#22c55e', label: 'Ativo' },
  suspended: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', label: 'Suspenso' },
  inactive: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280', label: 'Inativo' },
}

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtDate = (d: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))
const Badge = ({ status }: { status: string }) => {
  const s = statusColors[status] || statusColors.inactive
  return <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, backgroundColor: s.bg, color: s.color }}>{s.label}</span>
}

export default function Partner() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const { theme } = useTheme()

  const [loading, setLoading] = useState(true)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [, setWithdrawals] = useState<Withdrawal[]>([])
  const [editingCoupon, setEditingCoupon] = useState(false)
  const [newCouponCode, setNewCouponCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [savingCoupon, setSavingCoupon] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [editingPix, setEditingPix] = useState(false)
  const [pixKeyType, setPixKeyType] = useState('cpf')
  const [pixKey, setPixKey] = useState('')
  const [savingPix, setSavingPix] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)

  const chartColors = useMemo(() => {
    if (typeof document === 'undefined') return { text: '#94a3b8', grid: 'rgba(226,232,240,0.6)' }
    const styles = getComputedStyle(document.documentElement)
    return {
      text: styles.getPropertyValue('--text-secondary').trim() || '#94a3b8',
      grid: styles.getPropertyValue('--border-color').trim() || 'rgba(226,232,240,0.6)',
    }
  }, [theme])

  useEffect(() => { if (user) loadPartnerData() }, [user])

  const loadPartnerData = async () => {
    if (!user) return
    setLoading(true)
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      if (!token) { setLoading(false); return }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partner-profile`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      const data = await res.json()

      setPartner(data.partner as Partner)
      setReferrals(data.referrals || [])
      setCommissions(data.commissions || [])
      setWithdrawals(data.withdrawals || [])
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  const handleChangeCoupon = async () => {
    if (!newCouponCode.trim() || !partner) return
    setCodeError(''); setSavingCoupon(true)
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      if (!token) { setCodeError('Sessão expirada.'); setSavingCoupon(false); return }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partner-register`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ coupon_code: newCouponCode.trim() }),
      })
      const data = await res.json()

      if (!res.ok) { setCodeError(data.error || 'Código indisponível.'); setSavingCoupon(false); return }
      setPartner({ ...partner, coupon_code: newCouponCode.trim().toUpperCase() })
      setEditingCoupon(false); setNewCouponCode('')
    } catch { setCodeError('Erro ao salvar.') } finally { setSavingCoupon(false) }
  }

  const handleSavePix = async () => {
    if (!partner || !pixKey.trim()) return
    setSavingPix(true)
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      if (!token) { console.error('[Partner] No token'); setSavingPix(false); return }

      console.log('[Partner] Saving PIX:', { pix_key_type: pixKeyType, pix_key: pixKey.trim() })

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partner-withdraw`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pix_key_type: pixKeyType, pix_key: pixKey.trim() }),
      })

      const data = await res.json()
      console.log('[Partner] PIX response:', res.status, data)

      if (res.ok) {
        setPartner({ ...partner, pix_key_type: pixKeyType, pix_key: pixKey.trim() }); setEditingPix(false)
      } else {
        console.error('[Partner] PIX save error:', data.error)
        alert(data.error || 'Erro ao salvar chave PIX')
      }
    } catch (err) { console.error('[Partner] PIX exception:', err) } finally { setSavingPix(false) }
  }

  const handleWithdraw = async () => {
    if (!partner) return
    const amount = parseFloat(withdrawAmount)
    if (isNaN(amount) || amount < 100 || amount > partner.available_balance) return
    setWithdrawing(true)
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      if (!token) return

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partner-withdraw`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })

      if (res.ok) {
        setPartner({ ...partner, available_balance: partner.available_balance - amount })
        setShowWithdrawModal(false); setWithdrawAmount(''); loadPartnerData()
      }
    } catch (err) { console.error(err) } finally { setWithdrawing(false) }
  }

  const copy = (text: string, key: string) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000) }

  // ── Chart data ──
  const monthlyData = useMemo(() => {
    const months: { label: string; firstSale: number; recurring: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i)
      const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
      months.push({ label: label.charAt(0).toUpperCase() + label.slice(1), firstSale: 0, recurring: 0 })
    }
    commissions.forEach(c => {
      const d = new Date(c.created_at)
      const idx = months.findIndex((_m, i) => { const ref = new Date(); ref.setMonth(ref.getMonth() - (11 - i)); return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear() })
      if (idx >= 0) { if (c.commission_type === 'first_sale') months[idx].firstSale += c.commission_value; else months[idx].recurring += c.commission_value }
    })
    return months
  }, [commissions])

  const maxVal = Math.max(...monthlyData.map(m => m.firstSale + m.recurring), 1)
  const totalFirstSale = commissions.filter(c => c.commission_type === 'first_sale').reduce((s, c) => s + c.commission_value, 0)
  const totalRecurring = commissions.filter(c => c.commission_type === 'recurring').reduce((s, c) => s + c.commission_value, 0)

  const chartData = useMemo(() => ({
    labels: monthlyData.map(m => m.label),
    datasets: [
      { label: 'Indicações diretas', data: monthlyData.map(m => m.firstSale), backgroundColor: '#6366f1', borderRadius: 4, barPercentage: 0.6 },
      { label: 'Recorrente', data: monthlyData.map(m => m.recurring), backgroundColor: '#22c55e', borderRadius: 4, barPercentage: 0.6 },
    ],
  }), [monthlyData])

  const chartOpts = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#1e293b', titleColor: '#f8fafc', bodyColor: '#f8fafc', padding: 10, cornerRadius: 8, callbacks: { label: (ctx: any) => `  ${ctx.dataset.label}: ${fmt(ctx.parsed.y ?? 0)}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: chartColors.text, font: { size: 11 } } },
      y: { grid: { color: chartColors.grid, drawBorder: false }, ticks: { color: chartColors.text, font: { size: 11 }, callback: (v: number | string) => typeof v === 'number' ? fmt(v) : v }, min: 0, suggestedMax: Math.ceil(maxVal * 1.3) },
    },
  }), [chartColors, maxVal])

  // ── Design tokens ──
  const gap = isMobile ? 12 : 16
  const card: React.CSSProperties = { backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: isMobile ? '16px' : '20px' }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }
  const label: React.CSSProperties = { fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }

  // Referral stats
  const activeCount = referrals.filter(r => r.user_status === 'active').length
  const suspendedCount = referrals.filter(r => r.user_status === 'suspended').length

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      <div style={{ height: 28, width: 180, backgroundColor: 'var(--border-color)', borderRadius: 8, animation: 'replyna-pulse 1.6s ease-in-out infinite' }} />
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap }}>
        {[1, 2, 3].map(i => <div key={i} style={{ height: 80, backgroundColor: 'var(--border-color)', borderRadius: 12, animation: 'replyna-pulse 1.6s ease-in-out infinite' }} />)}
      </div>
    </div>
  )

  const referralLink = partner ? `${window.location.origin}/register?ref=${partner.coupon_code}` : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {/* ── Header ── */}
      <div>
        <h1 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Programa de Parceiros</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>Indique clientes e ganhe comissões recorrentes</p>
      </div>

      {/* ── Como funciona ── */}
      <div style={{ ...card, padding: isMobile ? '14px' : '16px 20px' }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '10px' : '0', justifyContent: 'space-between' }}>
          {[
            { step: '1', title: 'Compartilhe', desc: 'Envie seu cupom ou link para potenciais clientes', color: '#6366f1' },
            { step: '2', title: 'Cliente assina', desc: 'Ele ganha 10% de desconto no primeiro mês', color: '#8b5cf6' },
            { step: '3', title: 'Ganhe 30%', desc: 'Comissão de 30% sobre a primeira venda', color: '#22c55e' },
            { step: '4', title: 'Recorrência 10%', desc: 'Receba 10% todo mês enquanto ele estiver ativo', color: '#f59e0b' },
          ].map((item, i) => (
            <div key={item.step} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, position: 'relative', paddingRight: isMobile ? 0 : '16px' }}>
              {!isMobile && i > 0 && <div style={{ position: 'absolute', left: '-1px', top: 0, bottom: 0, width: '1px', backgroundColor: 'var(--border-color)' }} />}
              {!isMobile && i > 0 && <div style={{ width: '16px' }} />}
              <span style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: `${item.color}15`, color: item.color, fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.step}</span>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {partner && (
        <>
          {/* ── 3 Stats cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap }}>
            {[
              { label: 'Total ganho', value: fmt(partner.total_earned), color: '#6366f1' },
              { label: 'Pendente', value: fmt(partner.pending_balance), color: '#f59e0b' },
              { label: 'Saldo disponível', value: fmt(partner.available_balance), color: '#22c55e' },
            ].map(s => (
              <div key={s.label} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 16px' : '16px 20px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}>{s.label}</div>
                  <div style={{ fontSize: isMobile ? '20px' : '22px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
                </div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: s.color, flexShrink: 0 }} />
              </div>
            ))}
          </div>

          {/* ── Gráfico ── */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={label}>Comissões - últimos 12 meses</div>
              <div style={{ display: 'flex', gap: '16px' }}>
                {[
                  { label: '1ª Venda', color: '#6366f1', value: totalFirstSale },
                  { label: 'Recorrente', color: '#22c55e', value: totalRecurring },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: l.color, display: 'inline-block' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{l.label}: <strong style={{ color: 'var(--text-primary)' }}>{fmt(l.value)}</strong></span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ height: isMobile ? '180px' : '240px' }}>
              <Bar data={chartData} options={chartOpts as any} />
            </div>
          </div>

          {/* ── Cupom + PIX ── */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap }}>
            {/* Cupom */}
            <div style={{ ...card, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ ...label, marginBottom: 0 }}>Cupom de indicação</div>
                {!editingCoupon && (
                  <button onClick={() => { setNewCouponCode(partner.coupon_code); setEditingCoupon(true); setCodeError('') }} style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                    Personalizar
                  </button>
                )}
              </div>
              {editingCoupon ? (
                <div>
                  <input type="text" value={newCouponCode} onChange={(e) => { setNewCouponCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setCodeError('') }}
                    style={{ ...inputStyle, textTransform: 'uppercase', fontFamily: 'monospace', fontSize: '15px', fontWeight: 700, letterSpacing: '1px', borderColor: codeError ? '#ef4444' : 'var(--border-color)', marginBottom: '8px' }}
                    placeholder="SEUCUPOM" maxLength={20} />
                  {codeError && <p style={{ fontSize: '11px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', margin: '0 0 8px' }}><AlertCircle size={11} /> {codeError}</p>}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { setEditingCoupon(false); setCodeError('') }} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>Cancelar</button>
                    <button onClick={handleChangeCoupon} disabled={savingCoupon || !newCouponCode.trim() || newCouponCode === partner.coupon_code} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', backgroundColor: '#6366f1', color: '#fff', fontWeight: 600, cursor: savingCoupon || !newCouponCode.trim() ? 'not-allowed' : 'pointer', opacity: savingCoupon || !newCouponCode.trim() ? 0.6 : 1, fontSize: '12px' }}>
                      {savingCoupon ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '12px', borderRadius: '8px', textAlign: 'center',
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(99,102,241,0.02) 100%)',
                  border: '1px dashed rgba(99,102,241,0.25)',
                }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 800, color: '#6366f1', letterSpacing: '3px' }}>{partner.coupon_code}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>10% de desconto no 1° mês</div>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', backgroundColor: 'var(--input-bg)', border: '1px solid var(--border-color)' }}>
                <Link2 size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{referralLink}</span>
                <button onClick={() => copy(referralLink, 'link')} style={{ padding: '3px 8px', borderRadius: '6px', border: 'none', backgroundColor: copied === 'link' ? 'rgba(34,197,94,0.1)' : 'rgba(99,102,241,0.1)', color: copied === 'link' ? '#22c55e' : '#6366f1', cursor: 'pointer', fontSize: '11px', fontWeight: 600, flexShrink: 0 }}>
                  {copied === 'link' ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <button onClick={() => copy(partner.coupon_code, 'code')} style={{ padding: '7px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: copied === 'code' ? 'rgba(34,197,94,0.05)' : 'transparent', color: copied === 'code' ? '#22c55e' : 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
                  {copied === 'code' ? <CheckCircle size={12} /> : <Copy size={12} />} Cupom
                </button>
                <button onClick={() => copy(referralLink, 'link2')} style={{ padding: '7px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: copied === 'link2' ? 'rgba(34,197,94,0.05)' : 'transparent', color: copied === 'link2' ? '#22c55e' : 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
                  {copied === 'link2' ? <CheckCircle size={12} /> : <Link2 size={12} />} Link
                </button>
                <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Ganhe 10% de desconto na Replyna: ${referralLink}`)}`, '_blank')} style={{ padding: '7px', borderRadius: '8px', border: 'none', backgroundColor: 'rgba(37,211,102,0.08)', color: '#25d366', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
                  <Share2 size={12} /> WhatsApp
                </button>
              </div>
            </div>

            {/* Saque e PIX */}
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={label}>Saque e PIX</div>

              {/* Chave PIX */}
              {!partner.pix_key || editingPix ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {!partner.pix_key && <p style={{ fontSize: '11px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', margin: 0 }}><AlertCircle size={11} /> Configure para habilitar saques</p>}
                  <select value={pixKeyType} onChange={(e) => setPixKeyType(e.target.value)} className="replyna-select form-input" style={inputStyle}>
                    <option value="cpf">CPF</option><option value="email">E-mail</option><option value="phone">Telefone</option><option value="random">Aleatória</option>
                  </select>
                  <input type="text" value={pixKey} onChange={(e) => setPixKey(e.target.value)} style={inputStyle}
                    placeholder={pixKeyType === 'cpf' ? '000.000.000-00' : pixKeyType === 'email' ? 'seu@email.com' : pixKeyType === 'phone' ? '(11) 99999-9999' : 'Chave aleatória'} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {editingPix && <button onClick={() => setEditingPix(false)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>Cancelar</button>}
                    <button onClick={handleSavePix} disabled={savingPix || !pixKey.trim()} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', backgroundColor: '#6366f1', color: '#fff', fontWeight: 600, cursor: savingPix || !pixKey.trim() ? 'not-allowed' : 'pointer', opacity: savingPix || !pixKey.trim() ? 0.6 : 1, fontSize: '12px' }}>
                      {savingPix ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderRadius: '8px', backgroundColor: 'var(--input-bg)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={13} style={{ color: '#22c55e' }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {pixKeyTypeLabels[partner.pix_key_type!]}: <strong style={{ color: 'var(--text-primary)' }}>{partner.pix_key}</strong>
                    </span>
                  </div>
                  <button onClick={() => { setPixKeyType(partner.pix_key_type || 'cpf'); setPixKey(partner.pix_key || ''); setEditingPix(true) }} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '11px' }}>
                    Alterar
                  </button>
                </div>
              )}

              {/* Botão Sacar */}
              <button onClick={() => setShowWithdrawModal(true)} disabled={!partner.pix_key || partner.available_balance < 100} style={{
                padding: '10px', borderRadius: '8px', border: 'none', width: '100%',
                backgroundColor: partner.pix_key && partner.available_balance >= 100 ? '#22c55e' : 'var(--border-color)',
                color: partner.pix_key && partner.available_balance >= 100 ? '#fff' : 'var(--text-secondary)',
                fontWeight: 600, fontSize: '13px', cursor: partner.pix_key && partner.available_balance >= 100 ? 'pointer' : 'not-allowed',
              }}>
                {!partner.pix_key ? 'Configure PIX para sacar' : partner.available_balance < 100 ? `Mínimo ${fmt(100)}` : 'Solicitar saque'}
              </button>

              {/* Resumo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total já sacado</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(partner.withdrawn_balance)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Comissão 1ª venda</span>
                  <span style={{ fontWeight: 600, color: '#6366f1' }}>30%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Comissão recorrente</span>
                  <span style={{ fontWeight: 600, color: '#22c55e' }}>10%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Saque mínimo</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(100)}</span>
                </div>
              </div>

            </div>
          </div>

          {/* ── Indicados ── */}
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: isMobile ? '14px 16px' : '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Suas indicações</div>
              <div style={{ display: 'flex', gap: isMobile ? '12px' : '20px', alignItems: 'center' }}>
                {[
                  { label: 'Total', value: partner.total_referrals },
                  { label: 'Ativas', value: activeCount },
                  { label: 'Suspensas', value: suspendedCount },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.value}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {referrals.length > 0 ? (
              <div style={{ padding: isMobile ? '12px' : '0' }}>
                {isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {referrals.map(r => (
                      <div key={r.id} style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '12px' }}>{r.user_name}</span>
                          <Badge status={r.user_status} />
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{r.user_email} · {r.user_plan} · {fmtDate(r.created_at)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)' }}>Nome</th>
                      <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>Email</th>
                      <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>Plano</th>
                      <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>Status</th>
                      <th style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>Data</th>
                    </tr></thead>
                    <tbody>{referrals.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '12px' }}>{r.user_name}</td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '12px' }}>{r.user_email}</td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-primary)', fontSize: '12px' }}>{r.user_plan}</td>
                        <td style={{ padding: '12px 14px' }}><Badge status={r.user_status} /></td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '12px' }}>{fmtDate(r.created_at)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
            ) : (
              <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                Nenhuma indicação ainda. Compartilhe seu cupom para começar!
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modal Saque ── */}
      {showWithdrawModal && partner && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setShowWithdrawModal(false)}>
          <div style={{ ...card, padding: '24px', width: '100%', maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Solicitar Saque</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Disponível: <strong style={{ color: '#22c55e' }}>{fmt(partner.available_balance)}</strong>
            </p>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>R$</span>
                <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: '38px', fontSize: '16px', fontWeight: 700 }}
                  placeholder="100,00" min={100} max={partner.available_balance} step="0.01" />
              </div>
              <button onClick={() => setWithdrawAmount(partner.available_balance.toFixed(2))} style={{ marginTop: '6px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px' }}>
                Sacar tudo ({fmt(partner.available_balance)})
              </button>
            </div>
            <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'var(--input-bg)', border: '1px solid var(--border-color)', marginBottom: '14px', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>PIX: </span>
              <strong style={{ color: 'var(--text-primary)' }}>{pixKeyTypeLabels[partner.pix_key_type!]}: {partner.pix_key}</strong>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowWithdrawModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
              <button onClick={handleWithdraw} disabled={withdrawing || !withdrawAmount || parseFloat(withdrawAmount) < 100 || parseFloat(withdrawAmount) > partner.available_balance}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#22c55e', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: withdrawing || !withdrawAmount || parseFloat(withdrawAmount) < 100 ? 0.6 : 1, fontSize: '13px' }}>
                {withdrawing ? 'Solicitando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
