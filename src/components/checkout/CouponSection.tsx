import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Tag, X, Loader2, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface CouponValidation {
  is_valid: boolean
  coupon_id: string | null
  discount_type: 'percentage' | 'fixed_amount' | null
  discount_value: number | null
  error_message: string | null
}

interface CouponSectionProps {
  planId: string
  onCouponValidated: (validation: CouponValidation) => void
  onCouponRemoved: () => void
  onCodeChange?: (code: string) => void
  validation: CouponValidation | null
}

export default function CouponSection({ planId, onCouponValidated, onCouponRemoved, onCodeChange, validation }: CouponSectionProps) {
  const [showField, setShowField] = useState(false)
  const [code, setCode] = useState('')
  const [validating, setValidating] = useState(false)

  const handleValidate = async () => {
    if (!code.trim()) return
    setValidating(true)

    try {
      const { data, error } = await supabase.rpc('validate_coupon', {
        p_code: code.toUpperCase(),
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_plan_id: planId,
      })

      if (error) throw error

      if (data && data[0]) {
        onCouponValidated(data[0] as CouponValidation)
        onCodeChange?.(code.toUpperCase())
      }
    } catch {
      onCouponValidated({
        is_valid: false,
        coupon_id: null,
        discount_type: null,
        discount_value: null,
        error_message: 'Erro ao validar cupom',
      })
    } finally {
      setValidating(false)
    }
  }

  const handleRemove = () => {
    setShowField(false)
    setCode('')
    onCouponRemoved()
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '12px 16px',
    border: `1px solid ${validation?.is_valid === false ? '#ef4444' : 'var(--input-border)'}`,
    borderRadius: '10px',
    fontSize: '14px',
    boxSizing: 'border-box',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    fontFamily: 'monospace',
    outline: 'none',
  }

  // Show applied coupon
  if (validation?.is_valid) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '16px 24px',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Check size={14} style={{ color: '#22c55e' }} />
          </div>
          <div>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Cupom {code.toUpperCase()} aplicado
            </span>
            <span style={{ fontSize: '13px', color: '#22c55e', marginLeft: '8px' }}>
              {validation.discount_type === 'percentage'
                ? `-${validation.discount_value}%`
                : `-R$${validation.discount_value?.toFixed(2)}`}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRemove}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            padding: '4px',
          }}
        >
          <X size={16} />
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
    >
      <AnimatePresence mode="wait">
        {!showField ? (
          <motion.button
            key="toggle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            type="button"
            onClick={() => setShowField(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontSize: '14px',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'inherit',
            }}
          >
            <Tag size={14} />
            Tem um cupom de desconto?
          </motion.button>
        ) : (
          <motion.div
            key="field"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '20px 24px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Tag size={16} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Cupom de desconto
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase()
                  setCode(val)
                  onCodeChange?.(val)
                  if (validation) onCouponRemoved()
                }}
                style={inputStyle}
                placeholder="CODIGO"
              />
              <button
                type="button"
                onClick={handleValidate}
                disabled={validating || !code.trim()}
                style={{
                  padding: '12px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'var(--accent)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: validating || !code.trim() ? 'not-allowed' : 'pointer',
                  opacity: validating || !code.trim() ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: 'inherit',
                }}
              >
                {validating ? (
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  'Aplicar'
                )}
              </button>
              <button
                type="button"
                onClick={handleRemove}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>
            <AnimatePresence>
              {validation?.is_valid === false && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ marginTop: '8px', fontSize: '13px', color: '#ef4444', margin: '8px 0 0' }}
                >
                  {validation.error_message || 'Cupom invalido'}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
