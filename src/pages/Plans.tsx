import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, ArrowRight, ArrowLeft, MessageCircle, Check } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { normalizePlanSlug } from '../utils/plan'
import { supabase } from '../lib/supabase'

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

interface UserPlanInfo {
  plan: string | null
  is_trial: boolean | null
}

export default function Plans() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [userPlan, setUserPlan] = useState<UserPlanInfo | null>(null)
  const [changingPlanId, setChangingPlanId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    try {
      const [plansResult, userResult] = await Promise.all([
        supabase
          .from('plans')
          .select('id, name, slug, description, price_monthly, price_yearly, emails_limit, shops_limit, team_members_limit, features, is_popular')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        user
          ? supabase
              .from('users')
              .select('plan, is_trial')
              .eq('id', user.id)
              .single()
          : Promise.resolve({ data: null, error: null }),
      ])

      if (plansResult.data) setPlans(plansResult.data)
      if (userResult.data) setUserPlan(userResult.data)
    } catch (err) {
      console.error('Erro ao carregar planos:', err)
    } finally {
      setLoading(false)
    }
  }

  const currentPlanSlug = normalizePlanSlug(userPlan?.plan || '')

  const isCurrentPlan = (plan: Plan) =>
    normalizePlanSlug(plan.slug || plan.name) === currentPlanSlug

  const isEnterprise = (plan: Plan) =>
    normalizePlanSlug(plan.slug || plan.name) === 'enterprise'

  const currentPlanData = plans.find(p => isCurrentPlan(p)) || null

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(price)

  const handleSelectPlan = async (plan: Plan) => {
    if (isEnterprise(plan)) {
      window.open('https://wa.me/5531973210191?text=Olá! Tenho interesse no plano Enterprise da Replyna.', '_blank')
      return
    }

    if (!user || isCurrentPlan(plan)) return

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

      // Aguardar sincronização
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Mensagem de sucesso
      let successMessage = `Plano alterado para ${plan.name} com sucesso!`

      if (result.is_upgrade && result.price_difference > 0) {
        const diffFormatted = `R$ ${(result.price_difference || 0).toFixed(2).replace('.', ',')}`
        successMessage = `Upgrade para ${plan.name} realizado! A diferença de ${diffFormatted} foi cobrada.`
      } else if (result.is_downgrade) {
        const priceFormatted = result.new_plan?.price_monthly
          ? `R$ ${result.new_plan.price_monthly.toFixed(2).replace('.', ',')}/mês`
          : ''
        successMessage = `Downgrade para ${plan.name} realizado! ${priceFormatted ? `O novo valor de ${priceFormatted} será aplicado na próxima fatura.` : ''}`
      }

      setNotice({ type: 'success', message: successMessage })

      // Recarregar dados do usuário
      const { data: updated } = await supabase
        .from('users')
        .select('plan, is_trial')
        .eq('id', user.id)
        .single()

      if (updated) setUserPlan(updated)
    } catch (err: unknown) {
      console.error('Erro ao alterar plano:', err)
      const message = err instanceof Error ? err.message : 'Erro ao alterar plano. Tente novamente.'
      setNotice({ type: 'error', message })
    } finally {
      setChangingPlanId(null)
    }
  }

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
      <button
        onClick={() => navigate('/account')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary)',
          fontSize: '14px',
          cursor: 'pointer',
          padding: 0,
          marginBottom: '20px',
        }}
      >
        <ArrowLeft size={16} />
        Voltar para Minha Conta
      </button>

      <h1 style={{
        fontSize: '24px',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: '8px',
        marginTop: 0,
      }}>
        Alterar plano
      </h1>
      <p style={{
        color: 'var(--text-secondary)',
        fontSize: '15px',
        marginBottom: '28px',
        marginTop: 0,
      }}>
        Selecione o plano ideal para o seu negócio. A alteração é aplicada imediatamente.
      </p>

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

      {(() => {
        const filteredPlans = plans.filter(p => p.price_monthly > 0 && normalizePlanSlug(p.slug || p.name) !== 'partners')
        const colCount = filteredPlans.length

        return (
          <div className="plans-page-grid" style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${colCount}, 1fr)`,
            gap: '20px',
            paddingTop: '14px',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}>
            <style>{`
              @media (max-width: 900px) {
                .plans-page-grid {
                  grid-template-columns: repeat(${colCount}, 240px) !important;
                }
              }
              .plans-page-grid > div { scroll-snap-align: start; }
              .plans-page-grid::-webkit-scrollbar { height: 6px; }
              .plans-page-grid::-webkit-scrollbar-track { background: transparent; }
              .plans-page-grid::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
            `}</style>

            {filteredPlans.map((plan) => {
              const isCurrent = isCurrentPlan(plan)
              const enterprise = isEnterprise(plan)
              const priceDiff = currentPlanData && !isCurrent && !enterprise
                ? plan.price_monthly - currentPlanData.price_monthly
                : null

              return (
                <div
                  key={plan.id}
                  style={{
                    backgroundColor: isCurrent ? 'rgba(70, 114, 236, 0.06)' : 'var(--bg-card)',
                    borderRadius: '16px',
                    padding: '24px',
                    border: isCurrent
                      ? '2px solid var(--accent)'
                      : plan.is_popular
                      ? '2px solid var(--accent)'
                      : '1px solid var(--border-color)',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Badge area - altura fixa para alinhar cards com/sem badge */}
                  <div style={{
                    minHeight: '22px',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                  }}>
                    {isCurrent && (
                      <div style={{
                        backgroundColor: 'var(--accent)',
                        color: '#fff',
                        padding: '4px 12px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}>
                        Seu plano atual
                      </div>
                    )}
                    {plan.is_popular && !isCurrent && (
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

                  {/* Nome do plano - altura fixa */}
                  <div style={{ height: '32px', marginBottom: '8px' }}>
                    <h3 style={{
                      fontSize: '22px',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      margin: 0,
                    }}>
                      {plan.name}
                    </h3>
                  </div>

                  {/* Descrição - altura fixa */}
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

                  {/* Preço - altura fixa */}
                  <div style={{ height: '70px', marginBottom: '16px' }}>
                    {enterprise ? (
                      <span style={{
                        fontSize: '28px',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                      }}>
                        Personalizado
                      </span>
                    ) : (
                      <>
                        <div>
                          <span style={{
                            fontSize: '36px',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                          }}>
                            {formatPrice(plan.price_monthly)}
                          </span>
                          <span style={{
                            fontSize: '14px',
                            color: 'var(--text-secondary)',
                            marginLeft: '4px',
                          }}>
                            /mês
                          </span>
                        </div>
                        <div style={{ height: '20px' }}>
                          {priceDiff !== null && priceDiff !== 0 && (
                            <span style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: priceDiff > 0 ? '#f59e0b' : '#22c55e',
                            }}>
                              {priceDiff > 0
                                ? `+R$ ${priceDiff.toFixed(2).replace('.', ',')} do seu plano`
                                : `-R$ ${Math.abs(priceDiff).toFixed(2).replace('.', ',')} do seu plano`}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Limites - altura fixa */}
                  <div style={{
                    padding: '12px',
                    backgroundColor: 'rgba(70, 114, 236, 0.06)',
                    borderRadius: '10px',
                    marginBottom: '16px',
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Emails/mês
                      </span>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: enterprise || plan.emails_limit === null ? '#22c55e' : 'var(--text-primary)',
                      }}>
                        {enterprise || plan.emails_limit === null ? 'Ilimitado' : plan.emails_limit.toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Lojas
                      </span>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: enterprise || plan.shops_limit === null ? '#22c55e' : 'var(--text-primary)',
                      }}>
                        {enterprise || plan.shops_limit === null ? 'Ilimitado' : plan.shops_limit}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Membros da equipe
                      </span>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: enterprise || plan.team_members_limit === null ? '#22c55e' : 'var(--text-primary)',
                      }}>
                        {enterprise || plan.team_members_limit === null ? 'Ilimitado' : plan.team_members_limit === 0 ? '—' : plan.team_members_limit}
                      </span>
                    </div>
                  </div>

                  {/* Features - flex: 1 para ocupar espaço restante e alinhar botão */}
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

                  {/* Botão - sempre no final do card */}
                  <button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={isCurrent || (changingPlanId !== null && changingPlanId !== plan.id)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: isCurrent
                        ? 'var(--border-color)'
                        : enterprise
                        ? '#25D366'
                        : plan.is_popular
                        ? 'var(--accent)'
                        : 'var(--bg-primary)',
                      color: isCurrent
                        ? 'var(--text-secondary)'
                        : enterprise || plan.is_popular
                        ? '#fff'
                        : 'var(--text-primary)',
                      fontWeight: 600,
                      fontSize: '14px',
                      cursor: isCurrent || changingPlanId !== null ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      marginTop: 'auto',
                      opacity: changingPlanId !== null && changingPlanId !== plan.id ? 0.6 : 1,
                    }}
                  >
                    {isCurrent ? (
                      'Plano atual'
                    ) : changingPlanId === plan.id ? (
                      'Alterando...'
                    ) : enterprise ? (
                      <>
                        <MessageCircle size={16} />
                        Fale conosco
                      </>
                    ) : (
                      <>
                        Selecionar
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}
