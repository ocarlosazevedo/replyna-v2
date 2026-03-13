import { motion, AnimatePresence } from 'framer-motion'
import { Check, Lock, ShieldCheck } from 'lucide-react'

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
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '28px',
        border: '1px solid var(--border-color)',
        position: isMobile ? 'relative' : 'sticky',
        top: isMobile ? undefined : '24px',
        height: 'fit-content',
      }}
    >
      {/* Plan Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ marginBottom: '8px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {isTrial ? 'Free Trial' : plan.name}
            </h3>
            {plan.is_popular && !isTrial && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#f59e0b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Mais popular
              </motion.span>
            )}
          </div>
        </div>
        {plan.description && (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            {isTrial ? '30 emails grátis, 1 loja. Nenhuma cobrança será feita.' : plan.description}
          </p>
        )}
      </div>

      {/* Features */}
      <div style={{
        padding: '16px',
        backgroundColor: 'rgba(70, 114, 236, 0.04)',
        borderRadius: '12px',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Emails/mês</span>
          <span style={{
            fontSize: '13px',
            fontWeight: 600,
            color: plan.emails_limit === null ? '#22c55e' : 'var(--text-primary)',
          }}>
            {isTrial ? '30' : plan.emails_limit === null ? 'Ilimitado' : plan.emails_limit.toLocaleString('pt-BR')}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Lojas</span>
          <span style={{
            fontSize: '13px',
            fontWeight: 600,
            color: plan.shops_limit === null ? '#22c55e' : 'var(--text-primary)',
          }}>
            {isTrial ? '1' : plan.shops_limit === null ? 'Ilimitado' : plan.shops_limit}
          </span>
        </div>
      </div>

      {plan.features && plan.features.length > 0 && !isTrial && (
        <div style={{ marginBottom: '24px' }}>
          {plan.features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.06, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
              }}
            >
              <div style={{
                width: '18px', height: '18px', borderRadius: '50%',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Check size={11} style={{ color: '#22c55e' }} />
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{feature}</span>
            </motion.div>
          ))}
        </div>
      )}

      {/* Price */}
      <div style={{
        borderTop: '1px solid var(--border-color)',
        paddingTop: '20px',
      }}>
        {isTrial ? (
          <div style={{ textAlign: 'center' }}>
            <motion.span
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              style={{ fontSize: '32px', fontWeight: 700, color: '#22c55e', display: 'block' }}
            >
              Grátis
            </motion.span>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Subtotal</span>
              <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{formatPrice(basePrice)}</span>
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
                  <span style={{ fontSize: '14px', color: '#22c55e' }}>Desconto</span>
                  <span style={{ fontSize: '14px', color: '#22c55e', fontWeight: 600 }}>
                    -{formatPrice(discount)}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-color)',
            }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Total</span>
              <div style={{ textAlign: 'right' }}>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={finalPrice}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.3 }}
                    style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}
                  >
                    {formatPrice(finalPrice)}
                  </motion.span>
                </AnimatePresence>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>/mês</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Security trust indicators */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        style={{
          marginTop: '20px',
          padding: '14px',
          borderRadius: '10px',
          backgroundColor: 'rgba(34, 197, 94, 0.04)',
          border: '1px solid rgba(34, 197, 94, 0.08)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px',
        }}>
          <ShieldCheck size={14} style={{ color: '#22c55e' }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Compra segura</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lock size={10} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Criptografia SSL 256 bits</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Check size={10} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Dados protegidos e não armazenados</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Check size={10} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Cancele a qualquer momento</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
