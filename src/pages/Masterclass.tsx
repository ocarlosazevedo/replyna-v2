import { useState, useEffect, useRef } from 'react'
import {
  Play,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Loader2,
  Lock,
  AlertTriangle,
  Users,
  TrendingDown,
  Clock,
  XCircle,
  Star,
  Shield
} from 'lucide-react'

// ==================== DATA ====================

const testimonials = [
  {
    name: 'Rafael Mendes',
    role: 'Loja de Eletrônicos',
    text: 'Reduzi minha taxa de chargeback de 4.2% para 0.5% em menos de 45 dias. A masterclass abriu meus olhos para erros que eu nem sabia que cometia.',
    result: '4.2% → 0.5%'
  },
  {
    name: 'Amanda Costa',
    role: 'E-commerce de Moda',
    text: 'Minha conta no Shopify Payments estava prestes a ser bloqueada. Depois de aplicar o método, não tive mais nenhuma disputa em 3 meses.',
    result: '0 disputas em 3 meses'
  },
  {
    name: 'Lucas Ferreira',
    role: 'Dropshipping',
    text: 'O conteúdo sobre a regra dos 2 minutos vale a masterclass inteira. Simples de aplicar e resultado imediato no meu atendimento.',
    result: 'Resultado imediato'
  }
]

const faqItems = [
  {
    question: 'A masterclass é realmente gratuita?',
    answer: 'Sim, 100% gratuita. Não pedimos cartão de crédito nem cobramos nada. É um conteúdo educativo completo sem nenhum custo.'
  },
  {
    question: 'Quanto tempo dura a masterclass?',
    answer: 'A masterclass tem aproximadamente 47 minutos. Recomendamos assistir até o final para aproveitar todo o conteúdo, incluindo as estratégias avançadas.'
  },
  {
    question: 'Funciona para qualquer tipo de loja?',
    answer: 'Sim. O método funciona para e-commerce, dropshipping, infoprodutos e qualquer operação que processa pagamentos online. Os princípios anti-chargeback são universais.'
  },
  {
    question: 'Vou receber spam depois de me cadastrar?',
    answer: 'Não. Enviamos apenas conteúdo relevante sobre proteção contra chargebacks. Você pode cancelar a qualquer momento com um clique.'
  },
  {
    question: 'Preciso ter experiência técnica?',
    answer: 'Não. O conteúdo foi pensado para donos de negócio, não desenvolvedores. Tudo é explicado de forma simples e prática.'
  }
]

// ==================== COUNTDOWN HOOK ====================

function useCountdown() {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const DEADLINE_KEY = 'mc_deadline'
    let deadline = localStorage.getItem(DEADLINE_KEY)

    if (!deadline || Number(deadline) < Date.now()) {
      const d = Date.now() + 48 * 60 * 60 * 1000
      localStorage.setItem(DEADLINE_KEY, String(d))
      deadline = String(d)
    }

    const deadlineMs = Number(deadline)

    const update = () => {
      const diff = Math.max(0, deadlineMs - Date.now())
      setTimeLeft({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000)
      })
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  return timeLeft
}

// ==================== COMPONENT ====================

export default function Masterclass() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [showSticky, setShowSticky] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  const countdown = useCountdown()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Sticky CTA: show when form scrolls out of view
  useEffect(() => {
    if (!formRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(formRef.current)
    return () => observer.disconnect()
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
      newErrors.email = 'Digite seu e-mail'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'E-mail inválido'
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

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // ==================== PÁGINA DE OBRIGADO ====================
  if (isSubmitted) {
    return (
      <div className="mc-page">
        <style>{styles}</style>

        <div className="mc-thank-you">
          <div className="mc-success-icon">
            <CheckCircle2 size={48} color="#22c55e" />
          </div>

          <h1 className="mc-thank-title">Acesso Liberado!</h1>

          <p className="mc-thank-subtitle">
            Assista à masterclass completa agora
          </p>

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

      {/* Header */}
      <header className="mc-header">
        <img src="/replyna-logo.webp" alt="Replyna" className="mc-logo" />
      </header>

      {/* Main Layout */}
      <div className="mc-layout">

        {/* ===== HERO TEXT ===== */}
        <div className="mc-hero-text">
          <div className="mc-badge">
            <AlertTriangle size={14} />
            <span>Masterclass Gratuita</span>
          </div>

          <h1 className="mc-headline">
            Como Reduzir{' '}
            <span className="mc-highlight">90% dos Chargebacks</span>{' '}
            e Proteger sua Conta
          </h1>

          <p className="mc-subheadline">
            O método usado por operações de 7 dígitos
          </p>

          {/* Countdown Timer */}
          <div className="mc-countdown">
            <span className="mc-countdown-label">Acesso gratuito expira em:</span>
            <div className="mc-countdown-timer">
              <div className="mc-countdown-block">
                <span className="mc-countdown-value">{String(countdown.hours).padStart(2, '0')}</span>
                <span className="mc-countdown-unit">horas</span>
              </div>
              <span className="mc-countdown-sep">:</span>
              <div className="mc-countdown-block">
                <span className="mc-countdown-value">{String(countdown.minutes).padStart(2, '0')}</span>
                <span className="mc-countdown-unit">min</span>
              </div>
              <span className="mc-countdown-sep">:</span>
              <div className="mc-countdown-block">
                <span className="mc-countdown-value">{String(countdown.seconds).padStart(2, '0')}</span>
                <span className="mc-countdown-unit">seg</span>
              </div>
            </div>
          </div>
        </div>

        {/* ===== FORM SECTION ===== */}
        <div className="mc-form-section" ref={formRef}>
          {/* Social proof counter */}
          <div className="mc-form-social">
            <div className="mc-live-dot" />
            <span><strong>2.347</strong> pessoas já se inscreveram</span>
          </div>

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

            <div className="mc-privacy-row">
              <p className="mc-privacy">
                <Lock size={12} />
                Seus dados estão seguros
              </p>
              <p className="mc-privacy">
                <Shield size={12} />
                Não enviamos spam
              </p>
            </div>
          </form>
        </div>

        {/* ===== PAIN POINTS ===== */}
        <div className="mc-pain-section">
          <h2 className="mc-section-title">Você está passando por isso?</h2>
          <div className="mc-pain-list">
            <div className="mc-pain-item">
              <XCircle size={18} color="#f87171" />
              <span>Sua taxa de chargeback está acima de 1%</span>
            </div>
            <div className="mc-pain-item">
              <XCircle size={18} color="#f87171" />
              <span>Já teve ou tem medo de ter a conta bloqueada</span>
            </div>
            <div className="mc-pain-item">
              <XCircle size={18} color="#f87171" />
              <span>Perde horas toda semana respondendo contestações</span>
            </div>
            <div className="mc-pain-item">
              <XCircle size={18} color="#f87171" />
              <span>Sente que está perdendo dinheiro com disputas</span>
            </div>
          </div>
          <p className="mc-pain-cta">
            Se marcou pelo menos <strong>1 item</strong>, essa masterclass foi feita para você.
          </p>
        </div>

        {/* ===== INSTRUCTOR (expanded) ===== */}
        <div className="mc-instructor-wrap">
          <div className="mc-instructor-card">
            <div className="mc-instructor-header">
              <img src="/influencers/carlos-azevedo.webp" alt="Carlos Azevedo" />
              <div>
                <strong>Carlos Azevedo</strong>
                <span>Especialista Anti-Chargeback</span>
              </div>
            </div>
            <p className="mc-instructor-bio">
              Com mais de <strong>7 anos de experiência</strong> em proteção de operações digitais,
              Carlos já ajudou <strong>+1.000 empreendedores</strong> a reduzirem drasticamente suas
              taxas de chargeback. Responsável por proteger operações que faturam milhões por mês.
            </p>
            <div className="mc-instructor-stats">
              <div>
                <strong>1.000+</strong>
                <span>Alunos</span>
              </div>
              <div>
                <strong>7+ anos</strong>
                <span>Experiência</span>
              </div>
              <div>
                <strong>90%</strong>
                <span>Redução média</span>
              </div>
            </div>
          </div>
        </div>

        {/* ===== BENEFITS ===== */}
        <div className="mc-benefits">
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
        </div>

        {/* ===== TESTIMONIALS ===== */}
        <div className="mc-testimonials">
          <h2 className="mc-section-title">O que dizem nossos alunos</h2>
          <div className="mc-testimonial-list">
            {testimonials.map((t, i) => (
              <div key={i} className="mc-testimonial-card">
                <div className="mc-testimonial-top">
                  <div className="mc-testimonial-stars">
                    {Array.from({ length: 5 }, (_, j) => (
                      <Star key={j} size={14} fill="#fbbf24" color="#fbbf24" />
                    ))}
                  </div>
                  <span className="mc-testimonial-result">{t.result}</span>
                </div>
                <p className="mc-testimonial-text">"{t.text}"</p>
                <div className="mc-testimonial-author">
                  <strong>{t.name}</strong>
                  <span>{t.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== FAQ ===== */}
        <div className="mc-faq">
          <h2 className="mc-section-title">Perguntas frequentes</h2>
          <div className="mc-faq-list">
            {faqItems.map((item, i) => (
              <div
                key={i}
                className={`mc-faq-item ${openFaq === i ? 'mc-faq-open' : ''}`}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div className="mc-faq-question">
                  <span>{item.question}</span>
                  <ChevronDown
                    size={18}
                    className={`mc-faq-arrow ${openFaq === i ? 'mc-faq-arrow-open' : ''}`}
                  />
                </div>
                {openFaq === i && (
                  <p className="mc-faq-answer">{item.answer}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== STICKY CTA (mobile) ===== */}
      <div className={`mc-sticky-cta ${showSticky ? 'mc-sticky-visible' : ''}`}>
        <button onClick={scrollToForm} className="mc-sticky-btn">
          <Play size={16} fill="#fff" />
          QUERO ASSISTIR AGORA
        </button>
      </div>

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

  /* ===== HEADER ===== */
  .mc-header {
    padding: 20px;
    display: flex;
    justify-content: center;
  }

  .mc-logo {
    height: 28px;
    width: auto;
    opacity: 0.9;
  }

  /* ===== LAYOUT (Mobile default: flex column) ===== */
  .mc-layout {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 440px;
    margin: 0 auto;
    padding: 0 20px 32px;
  }

  /* ===== HERO TEXT ===== */
  .mc-hero-text {
    text-align: center;
    margin-bottom: 24px;
    width: 100%;
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
    margin: 0 0 20px;
  }

  /* ===== COUNTDOWN ===== */
  .mc-countdown {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 14px;
  }

  .mc-countdown-label {
    font-size: 13px;
    font-weight: 600;
    color: #f87171;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .mc-countdown-timer {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .mc-countdown-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 48px;
  }

  .mc-countdown-value {
    font-size: 28px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: #fff;
    line-height: 1;
  }

  .mc-countdown-unit {
    font-size: 10px;
    color: rgba(255,255,255,0.5);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 2px;
  }

  .mc-countdown-sep {
    font-size: 24px;
    font-weight: 700;
    color: rgba(255,255,255,0.3);
    margin-bottom: 12px;
  }

  /* ===== FORM SECTION ===== */
  .mc-form-section {
    width: 100%;
    margin-bottom: 28px;
  }

  .mc-form-social {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 16px;
    font-size: 13px;
    color: rgba(255,255,255,0.6);
  }

  .mc-form-social strong {
    color: #fff;
  }

  .mc-live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22c55e;
    animation: pulse-dot 2s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
    50% { opacity: 0.7; box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
  }

  .mc-form {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 14px;
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
    font-size: 16px;
    transition: all 0.2s;
    box-sizing: border-box;
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

  .mc-privacy-row {
    display: flex;
    justify-content: center;
    gap: 16px;
  }

  .mc-privacy {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: rgba(255,255,255,0.4);
    margin: 0;
  }

  /* ===== PAIN POINTS ===== */
  .mc-pain-section {
    width: 100%;
    padding: 28px 0;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .mc-pain-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 16px;
  }

  .mc-pain-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.06);
    border: 1px solid rgba(239, 68, 68, 0.12);
    border-radius: 10px;
    font-size: 14px;
    color: rgba(255,255,255,0.85);
  }

  .mc-pain-item svg {
    flex-shrink: 0;
  }

  .mc-pain-cta {
    text-align: center;
    font-size: 14px;
    color: rgba(255,255,255,0.6);
    margin: 0;
  }

  .mc-pain-cta strong {
    color: #f87171;
  }

  /* ===== INSTRUCTOR (expanded) ===== */
  .mc-instructor-wrap {
    width: 100%;
    margin-bottom: 28px;
  }

  .mc-instructor-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px;
    padding: 20px;
  }

  .mc-instructor-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
  }

  .mc-instructor-header img {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(70, 114, 236, 0.4);
  }

  .mc-instructor-header div {
    display: flex;
    flex-direction: column;
    text-align: left;
  }

  .mc-instructor-header strong {
    font-size: 16px;
    font-weight: 700;
  }

  .mc-instructor-header span {
    font-size: 13px;
    color: #4672ec;
    font-weight: 500;
  }

  .mc-instructor-bio {
    font-size: 14px;
    line-height: 1.6;
    color: rgba(255,255,255,0.65);
    margin: 0 0 16px;
  }

  .mc-instructor-bio strong {
    color: #fff;
  }

  .mc-instructor-stats {
    display: flex;
    justify-content: space-around;
    padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.08);
  }

  .mc-instructor-stats > div {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .mc-instructor-stats strong {
    font-size: 18px;
    font-weight: 800;
    background: linear-gradient(135deg, #4672ec, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .mc-instructor-stats span {
    font-size: 11px;
    color: rgba(255,255,255,0.5);
  }

  /* ===== BENEFITS ===== */
  .mc-benefits {
    width: 100%;
    padding: 28px 0;
    border-top: 1px solid rgba(255,255,255,0.06);
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

  /* ===== TESTIMONIALS ===== */
  .mc-testimonials {
    width: 100%;
    padding: 28px 0;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .mc-testimonial-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .mc-testimonial-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: 18px;
  }

  .mc-testimonial-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .mc-testimonial-stars {
    display: flex;
    gap: 2px;
  }

  .mc-testimonial-result {
    font-size: 12px;
    font-weight: 600;
    color: #22c55e;
    background: rgba(34, 197, 94, 0.1);
    padding: 4px 10px;
    border-radius: 50px;
  }

  .mc-testimonial-text {
    font-size: 14px;
    line-height: 1.6;
    color: rgba(255,255,255,0.75);
    margin: 0 0 12px;
    font-style: italic;
  }

  .mc-testimonial-author {
    display: flex;
    flex-direction: column;
  }

  .mc-testimonial-author strong {
    font-size: 14px;
    font-weight: 600;
  }

  .mc-testimonial-author span {
    font-size: 12px;
    color: rgba(255,255,255,0.45);
  }

  /* ===== FAQ ===== */
  .mc-faq {
    width: 100%;
    padding: 28px 0 8px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .mc-faq-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .mc-faq-item {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s;
  }

  .mc-faq-item:hover {
    border-color: rgba(255,255,255,0.15);
  }

  .mc-faq-open {
    border-color: rgba(70, 114, 236, 0.3);
    background: rgba(70, 114, 236, 0.05);
  }

  .mc-faq-question {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    gap: 12px;
  }

  .mc-faq-question span {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255,255,255,0.9);
  }

  .mc-faq-arrow {
    flex-shrink: 0;
    color: rgba(255,255,255,0.4);
    transition: transform 0.2s;
  }

  .mc-faq-arrow-open {
    transform: rotate(180deg);
    color: #4672ec;
  }

  .mc-faq-answer {
    padding: 0 16px 16px;
    margin: 0;
    font-size: 14px;
    line-height: 1.6;
    color: rgba(255,255,255,0.6);
  }

  /* ===== STICKY CTA (mobile) ===== */
  .mc-sticky-cta {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 12px 16px;
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
    background: rgba(5, 5, 8, 0.95);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid rgba(255,255,255,0.1);
    z-index: 100;
    transform: translateY(100%);
    transition: transform 0.3s ease;
  }

  .mc-sticky-visible {
    transform: translateY(0);
  }

  .mc-sticky-btn {
    width: 100%;
    padding: 16px;
    background: linear-gradient(135deg, #4672ec 0%, #3b5fd9 100%);
    border: none;
    border-radius: 12px;
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
  }

  .mc-sticky-btn:active {
    transform: scale(0.98);
  }

  /* ===== FOOTER ===== */
  .mc-footer {
    padding: 24px 20px;
    padding-bottom: calc(24px + 60px);
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

  /* ===== TABLET (768px - 1023px) ===== */
  @media (min-width: 768px) {
    .mc-layout {
      max-width: 560px;
      padding: 0 24px 48px;
    }

    .mc-headline {
      font-size: 36px;
    }

    .mc-subheadline {
      font-size: 18px;
    }

    .mc-countdown-value {
      font-size: 32px;
    }

    .mc-benefit-list {
      gap: 20px;
    }

    .mc-benefit-item strong {
      font-size: 15px;
    }

    .mc-benefit-item span {
      font-size: 14px;
    }

    .mc-testimonial-list {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .mc-testimonial-card:last-child {
      grid-column: 1 / -1;
    }

    .mc-thank-you {
      padding: 48px 24px;
    }

    .mc-thank-title {
      font-size: 36px;
    }
  }

  /* ===== DESKTOP (1024px+) ===== */
  @media (min-width: 1024px) {
    .mc-header {
      padding: 32px 48px;
      justify-content: center;
    }

    .mc-logo {
      height: 32px;
    }

    /* Grid layout: 2 columns */
    .mc-layout {
      display: grid;
      grid-template-columns: 1fr 400px;
      grid-template-areas:
        "hero         form"
        "pain         form"
        "instructor   form"
        "benefits     form"
        "testimonials testimonials"
        "faq          faq";
      gap: 0 60px;
      max-width: 1100px;
      padding: 0 48px 64px;
      align-items: start;
    }

    .mc-hero-text {
      grid-area: hero;
      text-align: center;
      margin-bottom: 28px;
    }

    .mc-headline {
      font-size: 46px;
      line-height: 1.15;
    }

    .mc-subheadline {
      font-size: 18px;
    }

    .mc-countdown {
      align-items: center;
    }

    /* Form card in sidebar */
    .mc-form-section {
      grid-area: form;
      position: sticky;
      top: 32px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      padding: 28px;
      margin-bottom: 0;
    }

    .mc-pain-section {
      grid-area: pain;
    }

    .mc-instructor-wrap {
      grid-area: instructor;
      margin-bottom: 0;
    }

    .mc-benefits {
      grid-area: benefits;
    }

    .mc-testimonials {
      grid-area: testimonials;
      padding-top: 40px;
    }

    .mc-testimonial-list {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
    }

    .mc-testimonial-card:last-child {
      grid-column: auto;
    }

    .mc-faq {
      grid-area: faq;
    }

    .mc-faq-list {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .mc-section-title {
      text-align: center;
      font-size: 20px;
    }

    /* Hide sticky CTA on desktop */
    .mc-sticky-cta {
      display: none;
    }

    .mc-footer {
      padding: 32px 48px;
      padding-bottom: 32px;
    }

    /* Hover states (desktop) */
    .mc-btn-submit:hover:not(:disabled) {
      background: linear-gradient(135deg, #3b5fd9 0%, #3451c4 100%);
      box-shadow: 0 8px 24px rgba(70, 114, 236, 0.3);
    }

    .mc-btn-cta:hover {
      box-shadow: 0 8px 24px rgba(70, 114, 236, 0.3);
      transform: translateY(-1px);
    }

    .mc-field input:hover {
      border-color: rgba(255,255,255,0.2);
    }

    .mc-faq-item:hover {
      border-color: rgba(255,255,255,0.2);
    }

    .mc-testimonial-card:hover {
      border-color: rgba(255,255,255,0.15);
    }

    /* Thank you page */
    .mc-thank-you {
      padding: 64px 24px;
      max-width: 700px;
    }

    .mc-thank-title {
      font-size: 42px;
    }

    .mc-thank-subtitle {
      font-size: 18px;
    }
  }

  /* ===== LARGE DESKTOP (1280px+) ===== */
  @media (min-width: 1280px) {
    .mc-layout {
      grid-template-columns: 1fr 440px;
      gap: 0 80px;
      max-width: 1200px;
    }

    .mc-headline {
      font-size: 52px;
    }
  }
`
