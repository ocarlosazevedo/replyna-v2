import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, MessageCircle, Star, Check } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useUserProfile } from '../hooks/useUserProfile'
import { supabase } from '../lib/supabase'
import { normalizePlanSlug } from '../utils/plan'

interface Plan {
  id: string
  name: string
  slug?: string | null
  description: string | null
  price_monthly: number
  price_yearly: number | null
  emails_limit: number | null
  shops_limit: number | null
  team_members_limit: number | null
  features: string[]
  is_popular: boolean
}

export default function TrialExpired() {
  const { user } = useAuth()
  const { profile } = useUserProfile()
  const navigate = useNavigate()

  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [changingPlanId, setChangingPlanId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  useEffect(() => {
    loadPlans()
  }, [])

  const loadPlans = async () => {
    try {
      const { data } = await supabase
        .from('plans')
        .select('id, name, description, price_monthly, price_yearly, emails_limit, shops_limit, team_members_limit, features, is_popular')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (data) setPlans(data as Plan[])
    } catch (err) {
      console.error('Erro ao carregar planos:', err)
    } finally {
      setLoading(false)
    }
  }

  const isEnterprise = (plan: Plan) =>
    (plan.slug || plan.name).toLowerCase().includes('enterprise')

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(price)

  const trialInfo = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000
    const now = new Date()
    const started = profile?.trial_started_at ? new Date(profile.trial_started_at) : null
    const ends = profile?.trial_ends_at
      ? new Date(profile.trial_ends_at)
      : started
      ? new Date(started.getTime() + 7 * dayMs)
      : null

    const totalDays = started && ends ? Math.max(1, Math.round((ends.getTime() - started.getTime()) / dayMs)) : 7
    const effectiveEnd = ends && ends.getTime() < now.getTime() ? ends : now
    const daysUsed = started ? Math.max(0, Math.ceil((effectiveEnd.getTime() - started.getTime()) / dayMs)) : null

    const emailsUsed = profile?.emails_used ?? 0
    const emailsLimit = profile?.emails_limit ?? null
    const expiredByCredits = typeof emailsLimit === 'number' ? emailsUsed >= emailsLimit : false
    const expiredByTime = ends ? ends.getTime() < now.getTime() : false

    return {
      started,
      ends,
      totalDays,
      daysUsed,
      emailsUsed,
      emailsLimit,
      expiredByCredits,
      expiredByTime,
    }
  }, [profile])

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date)

  const handleSelectPlan = async (plan: Plan) => {
    if (isEnterprise(plan)) {
      window.open('https://wa.me/5531973210191?text=Olá! Quero reativar minha conta com o plano Enterprise.', '_blank')
      return
    }

    if (!user) return

    setChangingPlanId(plan.id)
    setNotice(null)

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
            new_plan_id: plan.id,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao alterar plano')
      }

      if (result.needs_checkout) {
        navigate('/checkout', {
          state: {
            plan,
            isTrialFlow: false,
            isUpgrade: true,
            userId: user.id,
          },
        })
        return
      }

      setNotice({ type: 'success', message: `Plano ${plan.name} ativado com sucesso!` })
      setTimeout(() => navigate('/dashboard'), 1200)
    } catch (err: unknown) {
      console.error('Erro ao alterar plano:', err)
      const message = err instanceof Error ? err.message : 'Erro ao alterar plano. Tente novamente.'
      setNotice({ type: 'error', message })
    } finally {
      setChangingPlanId(null)
    }
  }

  const paidPlans = plans.filter((plan) => plan.price_monthly > 0 && normalizePlanSlug(plan.slug || plan.name) !== 'partners')

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid var(--border-color)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '24px',
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start',
      }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <AlertTriangle size={22} style={{ color: '#ef4444' }} />
        </div>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
            Seu período de teste grátis expirou
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
            Para continuar usando a Replyna, escolha um plano pago abaixo.
          </p>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          padding: '16px',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Dias usados
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {trialInfo.daysUsed !== null ? `${trialInfo.daysUsed} de ${trialInfo.totalDays}` : '—'}
          </div>
          {trialInfo.started && trialInfo.ends && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
              {formatDate(trialInfo.started)} → {formatDate(trialInfo.ends)}
            </div>
          )}
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          padding: '16px',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Emails usados
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {trialInfo.emailsLimit !== null
              ? `${trialInfo.emailsUsed} de ${trialInfo.emailsLimit}`
              : `${trialInfo.emailsUsed}`}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            {trialInfo.expiredByCredits ? 'Limite atingido' : 'Dentro do limite'}
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          padding: '16px',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Motivo do bloqueio
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {trialInfo.expiredByCredits ? 'Créditos esgotados' : 'Tempo do trial encerrado'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            {trialInfo.expiredByTime ? 'Trial concluído' : 'Sem cobrança realizada'}
          </div>
        </div>
      </div>

      {notice && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '12px',
          marginBottom: '20px',
          backgroundColor: notice.type === 'success'
            ? 'rgba(34, 197, 94, 0.1)'
            : notice.type === 'error'
            ? 'rgba(239, 68, 68, 0.1)'
            : 'rgba(59, 130, 246, 0.1)',
          border: `1px solid ${
            notice.type === 'success'
              ? 'rgba(34, 197, 94, 0.3)'
              : notice.type === 'error'
              ? 'rgba(239, 68, 68, 0.3)'
              : 'rgba(59, 130, 246, 0.3)'
          }`,
          color: notice.type === 'success'
            ? '#16a34a'
            : notice.type === 'error'
            ? '#dc2626'
            : '#2563eb',
          fontSize: '14px',
          fontWeight: 500,
        }}>
          {notice.message}
        </div>
      )}

      <h2 style={{
        fontSize: '20px',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: '12px',
      }}>
        Escolha seu plano
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
        Seu cartão já está salvo. A ativação é imediata, sem precisar preencher dados novamente.
      </p>

      {paidPlans.length === 0 ? (
        <div style={{
          padding: '18px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
        }}>
          Nenhum plano pago disponível no momento.
        </div>
      ) : (
        <div className="plans-page-grid" style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${paidPlans.length}, 1fr)`,
          gap: '20px',
          paddingTop: '6px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>
          <style>{`
            @media (max-width: 900px) {
              .plans-page-grid {
                grid-template-columns: repeat(${paidPlans.length}, 240px) !important;
              }
            }
            .plans-page-grid > div { scroll-snap-align: start; }
            .plans-page-grid::-webkit-scrollbar { height: 6px; }
            .plans-page-grid::-webkit-scrollbar-track { background: transparent; }
            .plans-page-grid::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
          `}</style>

          {paidPlans.map((plan) => {
            const enterprise = isEnterprise(plan)
            return (
              <div
                key={plan.id}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '16px',
                  padding: '24px',
                  border: plan.is_popular ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Badge */}
                <div style={{
                  minHeight: '22px',
                  marginBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  {plan.is_popular && (
                    <div style={{
                      marginLeft: 'auto',
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
                </div>

                <div style={{ height: '32px', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {plan.name}
                  </h3>
                </div>

                <div style={{ height: '40px', marginBottom: '16px' }}>
                  {plan.description && (
                    <p style={{
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                      margin: 0,
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {plan.description}
                    </p>
                  )}
                </div>

                <div style={{ height: '70px', marginBottom: '16px' }}>
                  {enterprise ? (
                    <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Personalizado
                    </span>
                  ) : (
                    <div>
                      <span style={{ fontSize: '36px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatPrice(plan.price_monthly)}
                      </span>
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)', marginLeft: '4px' }}>
                        /mês
                      </span>
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
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Emails/mês</span>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: plan.emails_limit === null ? '#22c55e' : 'var(--text-primary)',
                    }}>
                      {plan.emails_limit === null ? 'Ilimitado' : plan.emails_limit.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Lojas</span>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: plan.shops_limit === null ? '#22c55e' : 'var(--text-primary)',
                    }}>
                      {plan.shops_limit === null ? 'Ilimitado' : plan.shops_limit}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Membros da equipe</span>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: plan.team_members_limit === null ? '#22c55e' : 'var(--text-primary)',
                    }}>
                      {plan.team_members_limit === null ? 'Ilimitado' : plan.team_members_limit === 0 ? '—' : plan.team_members_limit}
                    </span>
                  </div>
                </div>

                <div style={{ flex: 1, marginBottom: '16px', minHeight: '120px' }}>
                  {plan.features && plan.features.length > 0 && (
                    <>
                      {plan.features.slice(0, 4).map((feature, index) => (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '8px',
                          }}
                        >
                          <Check size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
                          <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                            {feature}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                <button
                  onClick={() => handleSelectPlan(plan)}
                  disabled={changingPlanId !== null && changingPlanId !== plan.id}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: enterprise
                      ? '#25D366'
                      : plan.is_popular
                      ? 'var(--accent)'
                      : 'var(--bg-primary)',
                    color: enterprise || plan.is_popular ? '#fff' : 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: changingPlanId !== null && changingPlanId !== plan.id ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: 'auto',
                    opacity: changingPlanId !== null && changingPlanId !== plan.id ? 0.6 : 1,
                  }}
                >
                  {changingPlanId === plan.id ? (
                    'Ativando...'
                  ) : enterprise ? (
                    <>
                      <MessageCircle size={16} />
                      Fale conosco
                    </>
                  ) : (
                    <>
                      Ativar plano
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
