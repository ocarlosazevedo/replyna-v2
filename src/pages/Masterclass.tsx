import { useState, useEffect } from 'react'
import {
  Play,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Lock,
  AlertTriangle,
  Users,
  TrendingDown,
  Clock
} from 'lucide-react'

export default function Masterclass() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [errors, setErrors] = useState<{[key: string]: string}>({})

  // Scroll to top on load
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const formatWhatsApp = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
  }

  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatWhatsApp(e.target.value)
    setFormData(prev => ({ ...prev, whatsapp: formatted }))
    if (errors.whatsapp) setErrors(prev => ({ ...prev, whatsapp: '' }))
  }

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Digite seu nome'
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Digite seu email'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido'
    }
    
    if (!formData.whatsapp.trim()) {
      newErrors.whatsapp = 'Digite seu WhatsApp'
    } else if (formData.whatsapp.replace(/\D/g, '').length < 10) {
      newErrors.whatsapp = 'WhatsApp inválido'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          whatsapp: formData.whatsapp
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setIsSubmitted(true)
        window.scrollTo(0, 0)
      } else {
        alert('Erro ao cadastrar. Tente novamente.')
      }
    } catch {
      alert('Erro de conexão. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ==================== PÁGINA DE OBRIGADO ====================
  if (isSubmitted) {
    return (
      <div className="mc-page">
        <style>{styles}</style>
        
        <div className="mc-thank-you">
          {/* Success Icon */}
          <div className="mc-success-icon">
            <CheckCircle2 size={48} color="#22c55e" />
          </div>

          <h1 className="mc-thank-title">
            Acesso Liberado!
          </h1>
          
          <p className="mc-thank-subtitle">
            Assista a masterclass completa agora
          </p>

          {/* Video */}
          <div className="mc-video-wrapper">
            <div className="mc-video-container">
              <iframe
                src="https://www.youtube.com/embed/VIDEO_ID_AQUI?rel=0&modestbranding=1"
                title="Masterclass Anti-Chargeback"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>

          {/* CTA */}
          <div className="mc-thank-cta">
            <a href="https://app.replyna.me/register" className="mc-btn-cta">
              Quero testar a Replyna
              <ChevronRight size={20} />
            </a>
            <p className="mc-coupon">
              Cupom <strong>CARLOS10</strong> = 10% off
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ==================== PÁGINA DE CAPTURA ====================
  return (
    <div className="mc-page">
      <style>{styles}</style>

      {/* ===== MOBILE FIRST: HERO + FORM ===== */}
      <section className="mc-hero">
        {/* Logo */}
        <img 
          src="/replyna-logo.webp" 
          alt="Replyna" 
          className="mc-logo"
        />

        {/* Badge */}
        <div className="mc-badge">
          <AlertTriangle size={14} />
          <span>Masterclass Gratuita</span>
        </div>

        {/* Headline - Mobile First */}
        <h1 className="mc-headline">
          Como Reduzir <span className="mc-highlight">90% dos Chargebacks</span> e Proteger sua Conta
        </h1>

        {/* Subheadline */}
        <p className="mc-subheadline">
          O método usado por operações de 7 dígitos
        </p>

        {/* ===== FORMULÁRIO ===== */}
        <form onSubmit={handleSubmit} className="mc-form">
          <div className="mc-field">
            <label htmlFor="name">Seu nome</label>
            <input
              id="name"
              type="text"
              placeholder="Ex: João"
              value={formData.name}
              onChange={e => {
                setFormData(prev => ({ ...prev, name: e.target.value }))
                if (errors.name) setErrors(prev => ({ ...prev, name: '' }))
              }}
              className={errors.name ? 'mc-input-error' : ''}
            />
            {errors.name && <span className="mc-error">{errors.name}</span>}
          </div>

          <div className="mc-field">
            <label htmlFor="email">Seu melhor e-mail</label>
            <input
              id="email"
              type="email"
              placeholder="Ex: joao@email.com"
              value={formData.email}
              onChange={e => {
                setFormData(prev => ({ ...prev, email: e.target.value }))
                if (errors.email) setErrors(prev => ({ ...prev, email: '' }))
              }}
              className={errors.email ? 'mc-input-error' : ''}
            />
            {errors.email && <span className="mc-error">{errors.email}</span>}
          </div>

          <div className="mc-field">
            <label htmlFor="whatsapp">WhatsApp</label>
            <input
              id="whatsapp"
              type="tel"
              placeholder="(00) 00000-0000"
              value={formData.whatsapp}
              onChange={handleWhatsAppChange}
              className={errors.whatsapp ? 'mc-input-error' : ''}
            />
            {errors.whatsapp && <span className="mc-error">{errors.whatsapp}</span>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mc-btn-submit"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={20} className="mc-spin" />
                Liberando acesso...
              </>
            ) : (
              <>
                <Play size={20} fill="#fff" />
                QUERO ASSISTIR AGORA
              </>
            )}
          </button>

          <p className="mc-privacy">
            <Lock size={12} />
            Seus dados estão seguros
          </p>
        </form>

        {/* Instructor Mini */}
        <div className="mc-instructor-mini">
          <img src="/influencers/carlos-azevedo.webp" alt="Carlos Azevedo" />
          <div>
            <strong>Carlos Azevedo</strong>
            <span>Mentor de +1.000 alunos</span>
          </div>
        </div>
      </section>

      {/* ===== BELOW FOLD: BENEFÍCIOS ===== */}
      <section className="mc-benefits">
        <h2 className="mc-section-title">O que você vai aprender:</h2>
        
        <div className="mc-benefit-list">
          <div className="mc-benefit-item">
            <div className="mc-benefit-icon">
              <TrendingDown size={20} />
            </div>
            <div>
              <strong>Os 7 pilares anti-chargeback</strong>
              <span>Método completo para proteger sua operação</span>
            </div>
          </div>

          <div className="mc-benefit-item">
            <div className="mc-benefit-icon">
              <Users size={20} />
            </div>
            <div>
              <strong>Por que 71% dos chargebacks não são fraude</strong>
              <span>Entenda a real causa dos seus problemas</span>
            </div>
          </div>

          <div className="mc-benefit-item">
            <div className="mc-benefit-icon">
              <Clock size={20} />
            </div>
            <div>
              <strong>A regra dos 2 minutos</strong>
              <span>O segredo que muda tudo no atendimento</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mc-stats">
          <div className="mc-stat">
            <span className="mc-stat-value">1.000+</span>
            <span className="mc-stat-label">Alunos</span>
          </div>
          <div className="mc-stat">
            <span className="mc-stat-value">90%</span>
            <span className="mc-stat-label">Redução</span>
          </div>
          <div className="mc-stat">
            <span className="mc-stat-value">7+</span>
            <span className="mc-stat-label">Anos exp.</span>
          </div>
        </div>

        {/* CTA Repeat */}
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="mc-btn-secondary"
        >
          <Play size={18} fill="#fff" />
          Quero assistir grátis
        </button>
      </section>

      {/* Footer */}
      <footer className="mc-footer">
        <img src="/replyna-logo.webp" alt="Replyna" />
        <span>© {new Date().getFullYear()} Replyna</span>
      </footer>
    </div>
  )
}

// ==================== STYLES ====================
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  /* Reset & Base */
  .mc-page {
    min-height: 100vh;
    min-height: 100dvh;
    background: #050508;
    color: #fff;
    font-family: "Inter", -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  /* ===== HERO SECTION ===== */
  .mc-hero {
    padding: 24px 20px 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 440px;
    margin: 0 auto;
  }

  .mc-logo {
    height: 28px;
    width: auto;
    margin-bottom: 20px;
    opacity: 0.9;
  }

  .mc-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
    padding: 8px 14px;
    border-radius: 50px;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 16px;
  }

  .mc-headline {
    font-size: 26px;
    font-weight: 800;
    line-height: 1.2;
    margin: 0 0 10px;
    letter-spacing: -0.02em;
  }

  .mc-highlight {
    background: linear-gradient(135deg, #4672ec, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .mc-subheadline {
    font-size: 16px;
    color: rgba(255,255,255,0.6);
    margin: 0 0 24px;
  }

  /* ===== FORM ===== */
  .mc-form {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 24px;
  }

  .mc-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: left;
  }

  .mc-field label {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255,255,255,0.8);
  }

  .mc-field input {
    width: 100%;
    padding: 16px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 12px;
    color: #fff;
    font-size: 16px; /* Prevents zoom on iOS */
    transition: all 0.2s;
  }

  .mc-field input::placeholder {
    color: rgba(255,255,255,0.3);
  }

  .mc-field input:focus {
    outline: none;
    border-color: #4672ec;
    background: rgba(70, 114, 236, 0.08);
  }

  .mc-input-error {
    border-color: #ef4444 !important;
    background: rgba(239, 68, 68, 0.08) !important;
  }

  .mc-error {
    font-size: 13px;
    color: #f87171;
  }

  .mc-btn-submit {
    width: 100%;
    padding: 18px;
    background: linear-gradient(135deg, #4672ec 0%, #3b5fd9 100%);
    border: none;
    border-radius: 12px;
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 4px;
  }

  .mc-btn-submit:active {
    transform: scale(0.98);
  }

  .mc-btn-submit:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .mc-spin {
    animation: spin 1s linear infinite;
  }

  .mc-privacy {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 12px;
    color: rgba(255,255,255,0.4);
    margin: 0;
  }

  /* ===== INSTRUCTOR MINI ===== */
  .mc-instructor-mini {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    width: 100%;
  }

  .mc-instructor-mini img {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(70, 114, 236, 0.4);
  }

  .mc-instructor-mini div {
    display: flex;
    flex-direction: column;
    text-align: left;
  }

  .mc-instructor-mini strong {
    font-size: 14px;
    font-weight: 600;
  }

  .mc-instructor-mini span {
    font-size: 12px;
    color: rgba(255,255,255,0.5);
  }

  /* ===== BENEFITS SECTION ===== */
  .mc-benefits {
    padding: 40px 20px;
    border-top: 1px solid rgba(255,255,255,0.06);
    max-width: 440px;
    margin: 0 auto;
  }

  .mc-section-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 20px;
    text-align: center;
  }

  .mc-benefit-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 32px;
  }

  .mc-benefit-item {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    text-align: left;
  }

  .mc-benefit-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(70, 114, 236, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #4672ec;
  }

  .mc-benefit-item strong {
    display: block;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 2px;
  }

  .mc-benefit-item span {
    font-size: 13px;
    color: rgba(255,255,255,0.5);
  }

  /* ===== STATS ===== */
  .mc-stats {
    display: flex;
    justify-content: center;
    gap: 32px;
    margin-bottom: 28px;
    padding: 20px 0;
    border-top: 1px solid rgba(255,255,255,0.06);
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .mc-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .mc-stat-value {
    font-size: 24px;
    font-weight: 800;
    background: linear-gradient(135deg, #4672ec, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .mc-stat-label {
    font-size: 12px;
    color: rgba(255,255,255,0.5);
  }

  .mc-btn-secondary {
    width: 100%;
    padding: 16px;
    background: rgba(70, 114, 236, 0.15);
    border: 1px solid rgba(70, 114, 236, 0.3);
    border-radius: 12px;
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .mc-btn-secondary:active {
    transform: scale(0.98);
  }

  /* ===== FOOTER ===== */
  .mc-footer {
    padding: 24px 20px;
    border-top: 1px solid rgba(255,255,255,0.06);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .mc-footer img {
    height: 20px;
    opacity: 0.4;
  }

  .mc-footer span {
    font-size: 12px;
    color: rgba(255,255,255,0.3);
  }

  /* ===== THANK YOU PAGE ===== */
  .mc-thank-you {
    padding: 32px 20px;
    max-width: 560px;
    margin: 0 auto;
    text-align: center;
  }

  .mc-success-icon {
    margin-bottom: 16px;
  }

  .mc-thank-title {
    font-size: 28px;
    font-weight: 800;
    margin: 0 0 8px;
  }

  .mc-thank-subtitle {
    font-size: 16px;
    color: rgba(255,255,255,0.6);
    margin: 0 0 24px;
  }

  .mc-video-wrapper {
    margin-bottom: 24px;
  }

  .mc-video-container {
    position: relative;
    width: 100%;
    padding-bottom: 56.25%;
    border-radius: 16px;
    overflow: hidden;
    background: rgba(255,255,255,0.05);
  }

  .mc-video-container iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
  }

  .mc-thank-cta {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .mc-btn-cta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 18px 32px;
    background: linear-gradient(135deg, #4672ec 0%, #3b5fd9 100%);
    border-radius: 12px;
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    text-decoration: none;
    transition: all 0.2s;
  }

  .mc-btn-cta:active {
    transform: scale(0.98);
  }

  .mc-coupon {
    font-size: 14px;
    color: rgba(255,255,255,0.5);
    margin: 0;
  }

  .mc-coupon strong {
    color: #22c55e;
  }

  /* ===== DESKTOP (min-width: 768px) ===== */
  @media (min-width: 768px) {
    .mc-hero {
      padding: 48px 24px;
      max-width: 520px;
    }

    .mc-headline {
      font-size: 36px;
    }

    .mc-benefits {
      padding: 60px 24px;
      max-width: 520px;
    }

    .mc-benefit-list {
      gap: 20px;
    }

    .mc-stats {
      gap: 48px;
    }

    .mc-thank-you {
      padding: 48px 24px;
    }

    .mc-thank-title {
      font-size: 36px;
    }
  }

  /* ===== LARGE DESKTOP (min-width: 1024px) ===== */
  @media (min-width: 1024px) {
    .mc-hero {
      padding: 64px 24px;
      max-width: 600px;
    }

    .mc-headline {
      font-size: 42px;
    }

    .mc-form {
      max-width: 400px;
      margin-left: auto;
      margin-right: auto;
    }

    .mc-instructor-mini {
      max-width: 400px;
      margin: 0 auto;
    }
  }
`
