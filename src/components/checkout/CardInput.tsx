import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CreditCard, Lock, Eye, EyeOff, Wifi, ShieldCheck } from 'lucide-react'
import {
  detectCardBrand,
  formatCardNumber,
  formatExpiryDate,
  getCvvLength,
  getCardNumberMaxLength,
  type CardBrand,
} from '../../utils/cardUtils'

export interface CardData {
  number: string
  holderName: string
  expiry: string
  cvv: string
}

interface CardInputProps {
  card: CardData
  onChange: (card: CardData) => void
  onBrandDetected?: (brand: CardBrand) => void
  onInternationalDetected?: (isInternational: boolean) => void
}

const BRAND_LABELS: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  elo: 'Elo',
  hipercard: 'Hipercard',
  unknown: '',
}

const CARD_GRADIENTS: Record<CardBrand, string> = {
  visa: 'linear-gradient(135deg, #1a1f71 0%, #2b3a9e 50%, #1a1f71 100%)',
  mastercard: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  amex: 'linear-gradient(135deg, #006fcf 0%, #0051a5 50%, #003d7a 100%)',
  elo: 'linear-gradient(135deg, #1a1a2e 0%, #00a4e0 100%)',
  hipercard: 'linear-gradient(135deg, #822124 0%, #a52a2a 50%, #822124 100%)',
  unknown: 'linear-gradient(135deg, #2d2d3f 0%, #1a1a2e 50%, #0d0d1a 100%)',
}

type FocusedField = 'number' | 'name' | 'expiry' | 'cvv' | null

function CardPreview({ card, brand, isFlipped, focusedField }: { card: CardData; brand: CardBrand; isFlipped: boolean; focusedField: FocusedField }) {
  const digits = card.number.replace(/\D/g, '')
  const displayNumber = digits
    ? formatCardNumber(digits.padEnd(16, ' '), brand).replace(/ +/g, m => '\u2003'.repeat(m.length))
    : '\u2022\u2022\u2022\u2022\u2003\u2022\u2022\u2022\u2022\u2003\u2022\u2022\u2022\u2022\u2003\u2022\u2022\u2022\u2022'

  const highlightStyle = (field: FocusedField): React.CSSProperties => ({
    transition: 'all 0.3s ease',
    ...(focusedField === field ? {
      textShadow: '0 0 12px rgba(255,255,255,0.6), 0 1px 3px rgba(0,0,0,0.3)',
      transform: 'scale(1.02)',
    } : {
      textShadow: '0 1px 3px rgba(0,0,0,0.3)',
    }),
  })

  return (
    <div style={{ perspective: '1200px', marginBottom: '24px' }}>
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '380px',
          aspectRatio: '1.586',
          margin: '0 auto',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Front */}
        <motion.div
          animate={{ background: CARD_GRADIENTS[brand] }}
          transition={{ duration: 0.8 }}
          style={{
            position: 'absolute',
            inset: 0,
            background: CARD_GRADIENTS[brand],
            borderRadius: '16px',
            padding: '24px',
            backfaceVisibility: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 25px 50px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06) inset',
            overflow: 'hidden',
          }}
        >
          {/* Animated shine */}
          <motion.div
            animate={{
              x: ['-100%', '200%'],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              repeatDelay: 4,
              ease: 'easeInOut',
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '40%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
              pointerEvents: 'none',
            }}
          />

          {/* Static ambient light */}
          <div style={{
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.1) 0%, transparent 60%)',
            pointerEvents: 'none',
          }} />

          {/* Top row: chip + contactless + brand */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Chip */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                style={{
                  width: '42px',
                  height: '32px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #e8c547 0%, #d4a726 30%, #f0d96b 50%, #d4a726 70%, #e8c547 100%)',
                  boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3), inset 0 -1px 2px rgba(0,0,0,0.15)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  position: 'absolute', top: '50%', left: '4px', right: '4px',
                  height: '1px', background: 'rgba(0,0,0,0.12)', transform: 'translateY(-50%)',
                }} />
                <div style={{
                  position: 'absolute', left: '50%', top: '4px', bottom: '4px',
                  width: '1px', background: 'rgba(0,0,0,0.12)', transform: 'translateX(-50%)',
                }} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ delay: 0.3 }}
              >
                <Wifi size={20} style={{ color: '#fff', transform: 'rotate(90deg)' }} />
              </motion.div>
            </div>

            <AnimatePresence mode="wait">
              {brand !== 'unknown' && (
                <motion.span
                  key={brand}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.3 }}
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: '#fff',
                    letterSpacing: '1px',
                    textShadow: '0 2px 8px rgba(0,0,0,0.4)',
                  }}
                >
                  {BRAND_LABELS[brand]}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Card number */}
          <motion.div
            style={{
              fontSize: '20px',
              fontFamily: '"Courier New", monospace',
              fontWeight: 600,
              color: '#fff',
              letterSpacing: '2px',
              marginTop: '8px',
              position: 'relative',
              zIndex: 1,
              ...highlightStyle('number'),
            }}
          >
            {displayNumber}
          </motion.div>

          {/* Bottom row: name + expiry */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative', zIndex: 1 }}>
            <div style={highlightStyle('name')}>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px', marginBottom: '2px', textTransform: 'uppercase' }}>
                TITULAR
              </div>
              <div style={{
                fontSize: '14px', fontWeight: 500, color: '#fff', letterSpacing: '1px',
                maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {card.holderName || 'SEU NOME AQUI'}
              </div>
            </div>
            <div style={{ textAlign: 'right', ...highlightStyle('expiry') }}>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px', marginBottom: '2px', textTransform: 'uppercase' }}>
                VALIDADE
              </div>
              <div style={{
                fontSize: '14px', fontWeight: 500, color: '#fff', letterSpacing: '1px',
                fontFamily: '"Courier New", monospace',
              }}>
                {card.expiry || 'MM/AA'}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Back */}
        <div style={{
          position: 'absolute', inset: 0,
          background: CARD_GRADIENTS[brand],
          borderRadius: '16px', backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06) inset',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          {/* Magnetic stripe */}
          <div style={{ width: '100%', height: '44px', backgroundColor: '#1a1a1a', marginTop: '28px' }} />

          {/* CVV area */}
          <div style={{ padding: '20px 24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px', marginBottom: '6px', textAlign: 'right' }}>
              CVV
            </div>
            <motion.div
              animate={focusedField === 'cvv' ? {
                boxShadow: '0 0 0 2px rgba(255,255,255,0.4), 0 0 20px rgba(255,255,255,0.1)',
              } : {
                boxShadow: 'none',
              }}
              transition={{ duration: 0.3 }}
              style={{
                backgroundColor: 'rgba(255,255,255,0.9)',
                borderRadius: '6px',
                padding: '10px 16px',
                textAlign: 'right',
                fontFamily: '"Courier New", monospace',
                fontSize: '18px',
                fontWeight: 600,
                color: '#1a1a1a',
                letterSpacing: '4px',
                minHeight: '24px',
              }}
            >
              {card.cvv || '\u2022\u2022\u2022'}
            </motion.div>
          </div>

          {/* Brand on back */}
          <div style={{ padding: '0 24px 20px', textAlign: 'right' }}>
            <AnimatePresence mode="wait">
              {brand !== 'unknown' && (
                <motion.span
                  key={brand}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  exit={{ opacity: 0 }}
                  style={{ fontSize: '14px', fontWeight: 700, color: '#fff', letterSpacing: '1px' }}
                >
                  {BRAND_LABELS[brand]}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function CardInput({ card, onChange, onBrandDetected }: CardInputProps) {
  const [brand, setBrand] = useState<CardBrand>('unknown')
  const [showCvv, setShowCvv] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)
  const [focusedField, setFocusedField] = useState<FocusedField>(null)
  const holderNameRef = useRef<HTMLInputElement>(null)
  const expiryRef = useRef<HTMLInputElement>(null)
  const cvvRef = useRef<HTMLInputElement>(null)

  const handleNumberChange = (value: string) => {
    const digits = value.replace(/\D/g, '')
    const detected = detectCardBrand(digits)
    const maxLen = getCardNumberMaxLength(detected)
    const limited = digits.substring(0, maxLen)
    const formatted = formatCardNumber(limited, detected)

    setBrand(detected)
    onBrandDetected?.(detected)
    onChange({ ...card, number: formatted })

    // Auto-advance to holder name when card number is complete
    if (limited.length === maxLen) {
      holderNameRef.current?.focus()
    }
  }

  const handleExpiryChange = (value: string) => {
    const formatted = formatExpiryDate(value)
    onChange({ ...card, expiry: formatted })

    // Auto-advance to CVV when expiry is complete
    if (formatted.length === 5) {
      cvvRef.current?.focus()
    }
  }

  const handleCvvChange = (value: string) => {
    const maxLen = getCvvLength(brand)
    const digits = value.replace(/\D/g, '').substring(0, maxLen)
    onChange({ ...card, cvv: digits })
  }

  const handleFocus = (field: FocusedField) => {
    setFocusedField(field)
    setIsFlipped(field === 'cvv')
  }

  const handleBlur = () => {
    setFocusedField(null)
    setIsFlipped(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid var(--input-border)',
    borderRadius: '10px',
    fontSize: '15px',
    boxSizing: 'border-box',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--text-primary)',
    transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
    outline: 'none',
    fontFamily: 'inherit',
  }

  const focusedInputStyle: React.CSSProperties = {
    borderColor: 'var(--accent)',
    boxShadow: '0 0 0 3px rgba(70, 114, 236, 0.15)',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid var(--border-color)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          backgroundColor: 'rgba(70, 114, 236, 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CreditCard size={18} style={{ color: 'var(--accent)' }} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Pagamento
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            Cartao de credito
          </p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px 10px', borderRadius: '20px',
            backgroundColor: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
          }}
        >
          <ShieldCheck size={13} style={{ color: '#22c55e' }} />
          <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: 600 }}>Criptografado</span>
        </motion.div>
      </div>

      {/* Card Preview */}
      <CardPreview card={card} brand={brand} isFlipped={isFlipped} focusedField={focusedField} />

      {/* Card Number */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: '16px' }}
      >
        <label style={labelStyle}>Numero do cartao</label>
        <input
          type="text"
          inputMode="numeric"
          value={card.number}
          onChange={(e) => handleNumberChange(e.target.value)}
          onFocus={() => handleFocus('number')}
          onBlur={handleBlur}
          style={{
            ...inputStyle,
            fontFamily: '"Manrope", monospace',
            letterSpacing: '1px',
            ...(focusedField === 'number' ? focusedInputStyle : {}),
          }}
          placeholder="0000 0000 0000 0000"
        />
      </motion.div>

      {/* Holder Name */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        style={{ marginBottom: '16px' }}
      >
        <label style={labelStyle}>Nome no cartao</label>
        <input
          ref={holderNameRef}
          type="text"
          value={card.holderName}
          onChange={(e) => onChange({ ...card, holderName: e.target.value.toUpperCase() })}
          onFocus={() => handleFocus('name')}
          onBlur={handleBlur}
          style={{
            ...inputStyle,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            ...(focusedField === 'name' ? focusedInputStyle : {}),
          }}
          placeholder="NOME COMO ESTA NO CARTAO"
        />
      </motion.div>

      {/* Expiry + CVV */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}
      >
        <div>
          <label style={labelStyle}>Validade</label>
          <input
            ref={expiryRef}
            type="text"
            inputMode="numeric"
            value={card.expiry}
            onChange={(e) => handleExpiryChange(e.target.value)}
            onFocus={() => handleFocus('expiry')}
            onBlur={handleBlur}
            style={{
              ...inputStyle,
              fontFamily: '"Manrope", monospace',
              letterSpacing: '2px',
              textAlign: 'center',
              ...(focusedField === 'expiry' ? focusedInputStyle : {}),
            }}
            placeholder="MM/AA"
            maxLength={5}
          />
        </div>
        <div>
          <label style={labelStyle}>CVV</label>
          <div style={{ position: 'relative' }}>
            <input
              ref={cvvRef}
              type={showCvv ? 'text' : 'password'}
              inputMode="numeric"
              value={card.cvv}
              onChange={(e) => handleCvvChange(e.target.value)}
              onFocus={() => handleFocus('cvv')}
              onBlur={handleBlur}
              style={{
                ...inputStyle,
                fontFamily: '"Manrope", monospace',
                letterSpacing: '4px',
                textAlign: 'center',
                paddingRight: '40px',
                ...(focusedField === 'cvv' ? focusedInputStyle : {}),
              }}
              placeholder={brand === 'amex' ? '0000' : '000'}
              maxLength={getCvvLength(brand)}
            />
            <button
              type="button"
              onClick={() => setShowCvv(!showCvv)}
              style={{
                position: 'absolute', right: '10px', top: '50%',
                transform: 'translateY(-50%)', background: 'none',
                border: 'none', cursor: 'pointer', padding: '2px',
                color: 'var(--text-secondary)',
              }}
            >
              {showCvv ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Security footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '6px', marginTop: '20px', padding: '12px',
          borderRadius: '10px', backgroundColor: 'rgba(34, 197, 94, 0.04)',
          border: '1px solid rgba(34, 197, 94, 0.08)',
        }}
      >
        <Lock size={12} style={{ color: '#22c55e' }} />
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Seus dados sao criptografados com SSL de 256 bits
        </span>
      </motion.div>
    </motion.div>
  )
}
