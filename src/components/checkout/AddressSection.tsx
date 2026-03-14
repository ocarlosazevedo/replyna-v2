import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { formatCEP } from '../../utils/cardUtils'

export interface AddressData {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
}

interface AddressSectionProps {
  address: AddressData
  onChange: (address: AddressData) => void
  isInternational?: boolean
  embedded?: boolean
}

interface ViaCepResponse {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  erro?: boolean
}

export default function AddressSection({ address, onChange, isInternational, embedded }: AddressSectionProps) {
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState('')
  const [cepSuccess, setCepSuccess] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFetchedCep = useRef('')

  const updateField = (field: keyof AddressData, value: string) => {
    onChange({ ...address, [field]: value })
  }

  const handleCepChange = (value: string) => {
    const formatted = formatCEP(value)
    updateField('cep', formatted)
    setCepError('')
    setCepSuccess(false)

    const digits = value.replace(/\D/g, '')
    if (digits.length === 8 && digits !== lastFetchedCep.current) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => lookupCep(digits), 300)
    }
  }

  const lookupCep = async (cep: string) => {
    if (isInternational) return
    setCepLoading(true)
    setCepError('')
    lastFetchedCep.current = cep

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)

      const data: ViaCepResponse = await res.json()

      if (data.erro) {
        setCepError('CEP não encontrado')
        return
      }

      onChange({
        ...address,
        cep: formatCEP(cep),
        logradouro: data.logradouro || address.logradouro,
        bairro: data.bairro || address.bairro,
        cidade: data.localidade || address.cidade,
        estado: data.uf || address.estado,
      })
      setCepSuccess(true)
    } catch {
      setCepError('Erro ao buscar CEP. Preencha manualmente.')
    } finally {
      setCepLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    fontSize: '15px',
    boxSizing: 'border-box',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--text-primary)',
    transition: 'border-color 0.2s ease',
    outline: 'none',
    fontFamily: 'inherit',
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
      transition={{ duration: 0.4, delay: 0.2 }}
      style={{
        backgroundColor: embedded ? 'transparent' : 'var(--bg-card)',
        borderRadius: embedded ? 0 : '24px',
        padding: embedded ? 0 : '24px',
        border: embedded ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div>
          <label style={labelStyle}>CEP</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={address.cep}
              onChange={(e) => handleCepChange(e.target.value)}
              style={{
                ...inputStyle,
                paddingRight: '44px',
                borderColor: cepError ? '#ef4444' : cepSuccess ? '#22c55e' : undefined,
              }}
              placeholder="00000-000"
              maxLength={9}
            />
            <div style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
            }}>
              <AnimatePresence mode="wait">
                {cepLoading && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <Loader2 size={18} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
                  </motion.div>
                )}
                {cepSuccess && !cepLoading && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <CheckCircle2 size={18} style={{ color: '#22c55e' }} />
                  </motion.div>
                )}
                {cepError && !cepLoading && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <AlertCircle size={18} style={{ color: '#ef4444' }} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <AnimatePresence>
            {cepError && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ fontSize: '12px', color: '#ef4444', margin: '4px 0 0' }}
              >
                {cepError}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <div>
          <label style={labelStyle}>Número</label>
          <input
            type="text"
            value={address.numero}
            onChange={(e) => updateField('numero', e.target.value)}
            style={inputStyle}
            placeholder="123"
          />
        </div>
      </div>

      <div>
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Rua</label>
          <input
            type="text"
            value={address.logradouro}
            onChange={(e) => updateField('logradouro', e.target.value)}
            style={inputStyle}
            placeholder="Rua, Avenida..."
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Complemento</label>
          <input
            type="text"
            value={address.complemento}
            onChange={(e) => updateField('complemento', e.target.value)}
            style={inputStyle}
            placeholder="Apto, Sala..."
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.6fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Bairro</label>
            <input
              type="text"
              value={address.bairro}
              onChange={(e) => updateField('bairro', e.target.value)}
              style={inputStyle}
              placeholder="Bairro"
            />
          </div>
          <div>
            <label style={labelStyle}>Cidade</label>
            <input
              type="text"
              value={address.cidade}
              onChange={(e) => updateField('cidade', e.target.value)}
              style={inputStyle}
              placeholder="Cidade"
            />
          </div>
          <div>
            <label style={labelStyle}>Estado</label>
            <input
              type="text"
              value={address.estado}
              onChange={(e) => updateField('estado', e.target.value)}
              style={inputStyle}
              placeholder="UF"
              maxLength={2}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}
