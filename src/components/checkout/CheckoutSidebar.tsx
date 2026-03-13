import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'

interface Plan {
  id: string
  name: string
  slug?: string | null
  description: string | null
  price_monthly: number
  emails_limit: number | null
  shops_limit: number | null
  features: string[]
  is_popular: boolean
}

interface CouponValidation {
  is_valid: boolean
  discount_type: 'percentage' | 'fixed_amount' | null
  discount_value: number | null
}

interface CheckoutSidebarProps {
  plan: Plan
  isTrialFlow: boolean
  couponValidation: CouponValidation | null
  isMobile?: boolean
}

export default function CheckoutSidebar({ plan, isTrialFlow, couponValidation, isMobile }: CheckoutSidebarProps) {
  const basePrice = plan.price_monthly
  const isTrial = isTrialFlow || plan.slug === 'trial'
  let discount = 0
  if (couponValidation?.is_valid && couponValidation.discount_value) {
    if (couponValidation.discount_type === 'percentage') {
      discount = basePrice * (couponValidation.discount_value / 100)
    } else {
      discount = couponValidation.discount_value
    }
  }
  const finalPrice = Math.max(0, basePrice - discount)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(price)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: isMobile ? 0 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      style={{
        position: isMobile ? 'relative' : 'sticky',
        top: isMobile ? undefined : '24px',
        height: 'fit-content',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '24px',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <div style={{ fontSize: '12px', letterSpacing: '0.4px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Plano selecionado
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {isTrial ? 'Free Trial' : plan.name}
            </h3>
            {!isTrial && (
              <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatPrice(basePrice)}<span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>/mês</span>
              </span>
            )}
            {isTrial && (
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#22c55e' }}>Grátis</span>
            )}
          </div>

          {plan.features && plan.features.length > 0 && !isTrial && (
            <div style={{ display: 'grid', gap: '8px' }}>
              {plan.features.map((feature, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={12} style={{ color: '#22c55e' }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{feature}</span>
                </div>
              ))}
            </div>
          )}

          {isTrial && (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              30 emails grátis · 1 loja
            </p>
          )}
        </div>

        <div style={{
          backgroundColor: '#0f172a',
          borderRadius: '24px',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <div style={{ fontSize: '12px', letterSpacing: '0.4px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Resumo do pedido
          </div>

          {isTrial ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total</span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#22c55e' }}>Grátis</span>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Plano {plan.name}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{formatPrice(basePrice)}</span>
              </div>

              <AnimatePresence>
                {discount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}
                  >
                    <span style={{ fontSize: '13px', color: '#22c55e' }}>Desconto</span>
                    <span style={{ fontSize: '13px', color: '#22c55e', fontWeight: 600 }}>
                      -{formatPrice(discount)}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', marginTop: '12px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Total</span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatPrice(finalPrice)}<span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>/mês</span>
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}
