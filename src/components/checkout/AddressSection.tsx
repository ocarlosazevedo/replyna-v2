import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
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

export default function AddressSection({ address, onChange, isInternational }: AddressSectionProps) {
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
    padding: '12px 16px',
    border: '1px solid var(--input-border)',
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
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid var(--border-color)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          backgroundColor: 'rgba(70, 114, 236, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <MapPin size={18} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Endereço
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            Endereço de cobrança
          </p>
        </div>
      </div>

      {/* CEP */}
      {!isInternational && (
        <div style={{ marginBottom: '16px' }}>
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
      )}

      {/* Auto-filled fields */}
      <AnimatePresence>
        {(cepSuccess || isInternational || address.logradouro) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Logradouro</label>
              <input
                type="text"
                value={address.logradouro}
                onChange={(e) => updateField('logradouro', e.target.value)}
                style={inputStyle}
                placeholder="Rua, Avenida..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Numero</label>
                <input
                  type="text"
                  value={address.numero}
                  onChange={(e) => updateField('numero', e.target.value)}
                  style={inputStyle}
                  placeholder="123"
                />
              </div>
              <div>
                <label style={labelStyle}>Complemento</label>
                <input
                  type="text"
                  value={address.complemento}
                  onChange={(e) => updateField('complemento', e.target.value)}
                  style={inputStyle}
                  placeholder="Apto, Sala..."
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Bairro</label>
              <input
                type="text"
                value={address.bairro}
                onChange={(e) => updateField('bairro', e.target.value)}
                style={inputStyle}
                placeholder="Bairro"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
