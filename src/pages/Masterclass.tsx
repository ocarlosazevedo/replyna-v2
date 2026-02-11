import { useState, useEffect, useRef } from 'react'
import {
  Play,
  AlertCircle,

  ChevronDown,
  Loader2,
  Lock,

  Users,
  TrendingDown,
  Clock,

  Star,
  Shield
} from 'lucide-react'
import { supabase } from '../lib/supabase'

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
  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [showSticky, setShowSticky] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  const countdown = useCountdown()

  // Meta Pixel
  useEffect(() => {
    const w = window as Record<string, any>
    if (w.fbq) return

    // Inline pixel bootstrap (avoids TS issues with the official snippet)
    const q: any[][] = []
    const fbq: any = function (...args: any[]) {
      if (fbq.callMethod) {
        fbq.callMethod(...args)
      } else {
        q.push(args)
      }
    }
    fbq.push = fbq
    fbq.loaded = true
    fbq.version = '2.0'
    fbq.queue = q
    w.fbq = fbq
    if (!w._fbq) w._fbq = fbq

    const script = document.createElement('script')
    script.async = true
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(script)

    w.fbq('init', '1587401225738187')
    w.fbq('track', 'PageView')

    return () => {
      document.head.removeChild(script)
    }
  }, [])

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
      // 1. Salvar no Brevo (primário)
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

      if (!response.ok || !data.success) {
        console.error('Brevo error:', data)
        alert('Erro ao cadastrar. Tente novamente.')
        return
      }

      // 2. Backup no Supabase (não bloqueia o redirect)
      supabase
        .from('masterclass_leads')
        .insert({
          name: formData.name.trim(),
          email: formData.email.toLowerCase().trim(),
          whatsapp: formData.whatsapp.replace(/\D/g, '')
        })
        .then(() => {}) // fire-and-forget

      // 3. Meta Pixel - track Lead conversion
      if ((window as any).fbq) {
        (window as any).fbq('track', 'Lead', {
          content_name: 'Masterclass Replyna',
        })
      }

      // 4. Salvar email no localStorage para auto-login na área de membros
      localStorage.setItem('masterclass_email', formData.email.toLowerCase().trim())

      // 5. Redirect após Brevo salvar
      window.location.href = '/masterclass/assistir'
    } catch (err) {
      console.error('Submit error:', err)
      alert('Erro de conexão. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' })
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
            <Play size={14} />
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
          <h2 className="mc-section-title">Se isso parece com a sua realidade...</h2>
          <div className="mc-pain-list">
            {[
              { icon: <TrendingDown size={20} />, text: 'Taxa de chargeback acima de 1%' },
              { icon: <Lock size={20} />, text: 'Medo de ter a conta bloqueada' },
              { icon: <Clock size={20} />, text: 'Horas perdidas respondendo contestações' },
              { icon: <AlertCircle size={20} />, text: 'Dinheiro escorrendo com disputas' }
            ].map((item, i) => (
              <div key={i} className="mc-pain-item">
                <span className="mc-pain-icon">{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
          <p className="mc-pain-cta">
            ...então essa masterclass foi <strong>feita para você</strong>.
          </p>
        </div>

        {/* ===== INSTRUCTOR (expanded) ===== */}
        <div className="mc-instructor-wrap">
          <h2 className="mc-section-title">Quem vai ensinar você</h2>
          <div className="mc-instructor-card">
            <div className="mc-instructor-header">
              <div className="mc-instructor-img-wrap">
                <img src="/influencers/carlos-azevedo.webp" alt="Carlos Azevedo" />
              </div>
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
              <div className="mc-stat-item">
                <strong>1.000+</strong>
                <span>Alunos</span>
              </div>
              <div className="mc-stat-item">
                <strong>7+ anos</strong>
                <span>Experiência</span>
              </div>
              <div className="mc-stat-item">
                <strong>90%</strong>
                <span>Redução média</span>
              </div>
            </div>
          </div>
        </div>

        {/* ===== BENEFITS ===== */}
        <div className="mc-benefits">
          <h2 className="mc-section-title">O que você vai aprender</h2>

          <div className="mc-benefit-list">
            <div className="mc-benefit-card">
              <div className="mc-benefit-icon">
                <TrendingDown size={22} />
              </div>
              <strong>Os 7 pilares anti-chargeback</strong>
              <span>Método completo para proteger sua operação de ponta a ponta</span>
            </div>

            <div className="mc-benefit-card">
              <div className="mc-benefit-icon">
                <Users size={22} />
              </div>
              <strong>Por que 71% dos chargebacks não são fraude</strong>
              <span>Entenda a real causa e elimine os problemas na raiz</span>
            </div>

            <div className="mc-benefit-card">
              <div className="mc-benefit-icon">
                <Clock size={22} />
              </div>
              <strong>A regra dos 2 minutos</strong>
              <span>O segredo que transforma seu atendimento e evita disputas</span>
            </div>
          </div>
        </div>

        {/* ===== TESTIMONIALS ===== */}
        <div className="mc-testimonials">
          <h2 className="mc-section-title">O que dizem nossos alunos</h2>
          <div className="mc-testimonial-list">
            {testimonials.map((t, i) => (
              <div key={i} className="mc-testimonial-card">
                <span className="mc-testimonial-quote">"</span>
                <div className="mc-testimonial-top">
                  <div className="mc-testimonial-stars">
                    {Array.from({ length: 5 }, (_, j) => (
                      <Star key={j} size={14} fill="#fbbf24" color="#fbbf24" />
                    ))}
                  </div>
                  <span className="mc-testimonial-result">{t.result}</span>
                </div>
                <p className="mc-testimonial-text">{t.text}</p>
                <div className="mc-testimonial-author">
                  <div className="mc-testimonial-avatar">
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <strong>{t.name}</strong>
                    <span>{t.role}</span>
                  </div>
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
    gap: 7px;
    background: linear-gradient(135deg, rgba(70, 114, 236, 0.15), rgba(139, 92, 246, 0.15));
    border: 1px solid rgba(70, 114, 236, 0.3);
    color: #a5b4fc;
    padding: 8px 16px;
    border-radius: 50px;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 20px;
    letter-spacing: 0.02em;
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
    gap: 10px;
    padding: 20px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 16px;
  }

  .mc-countdown-label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255,255,255,0.5);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .mc-countdown-timer {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .mc-countdown-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 56px;
    padding: 10px 0;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
  }

  .mc-countdown-value {
    font-size: 28px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    background: linear-gradient(180deg, #fff 30%, rgba(255,255,255,0.6));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1;
  }

  .mc-countdown-unit {
    font-size: 10px;
    color: rgba(255,255,255,0.35);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 4px;
  }

  .mc-countdown-sep {
    font-size: 22px;
    font-weight: 700;
    color: rgba(255,255,255,0.2);
    margin-bottom: 14px;
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
    margin-bottom: 18px;
    font-size: 13px;
    color: rgba(255,255,255,0.55);
    padding: 10px 16px;
    background: rgba(34, 197, 94, 0.06);
    border: 1px solid rgba(34, 197, 94, 0.12);
    border-radius: 10px;
  }

  .mc-form-social strong {
    color: #4ade80;
  }

  .mc-live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22c55e;
    animation: pulse-dot 2s ease-in-out infinite;
    flex-shrink: 0;
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
    background: linear-gradient(135deg, #4672ec 0%, #5b4dd6 100%);
    border: none;
    border-radius: 14px;
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    cursor: pointer;
    transition: all 0.25s;
    margin-top: 4px;
    box-shadow: 0 4px 20px rgba(70, 114, 236, 0.25);
    letter-spacing: 0.02em;
  }

  .mc-btn-submit:active {
    transform: scale(0.97);
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

  .mc-pain-subtitle {
    text-align: center;
    font-size: 14px;
    color: rgba(255,255,255,0.45);
    margin: 0 0 18px;
  }

  .mc-pain-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 20px;
  }

  .mc-pain-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px 20px;
    background: rgba(248, 113, 113, 0.06);
    border: 1px solid rgba(248, 113, 113, 0.15);
    border-radius: 14px;
    font-size: 15px;
    font-weight: 500;
    color: rgba(255,255,255,0.9);
    text-align: left;
  }

  .mc-pain-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(248, 113, 113, 0.12);
    color: #f87171;
  }

  .mc-pain-cta {
    text-align: center;
    font-size: 16px;
    color: rgba(255,255,255,0.6);
    margin: 0;
    min-height: 20px;
  }

  .mc-pain-cta strong {
    color: #a78bfa;
  }

  /* ===== INSTRUCTOR (expanded) ===== */
  .mc-instructor-wrap {
    width: 100%;
    margin-bottom: 28px;
  }

  .mc-instructor-card {
    background: linear-gradient(135deg, rgba(70, 114, 236, 0.06), rgba(139, 92, 246, 0.04));
    border: 1px solid rgba(70, 114, 236, 0.15);
    border-radius: 20px;
    padding: 24px;
    position: relative;
    overflow: hidden;
  }

  .mc-instructor-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #4672ec, #8b5cf6, #4672ec);
    opacity: 0.7;
  }

  .mc-instructor-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
  }

  .mc-instructor-img-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .mc-instructor-img-wrap::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    background: linear-gradient(135deg, #4672ec, #8b5cf6);
    z-index: 0;
  }

  .mc-instructor-img-wrap img {
    position: relative;
    z-index: 1;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid #0a0a0f;
  }

  .mc-instructor-header > div {
    display: flex;
    flex-direction: column;
    text-align: left;
  }

  .mc-instructor-header strong {
    font-size: 17px;
    font-weight: 700;
  }

  .mc-instructor-header span {
    font-size: 13px;
    color: #818cf8;
    font-weight: 500;
  }

  .mc-instructor-bio {
    font-size: 14px;
    line-height: 1.7;
    color: rgba(255,255,255,0.6);
    margin: 0 0 20px;
    text-align: left;
  }

  .mc-instructor-bio strong {
    color: rgba(255,255,255,0.95);
  }

  .mc-instructor-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .mc-stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 14px 8px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
  }

  .mc-stat-item strong {
    font-size: 20px;
    font-weight: 800;
    background: linear-gradient(135deg, #4672ec, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .mc-stat-item span {
    font-size: 11px;
    color: rgba(255,255,255,0.45);
    text-transform: uppercase;
    letter-spacing: 0.04em;
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
    margin: 0 0 24px;
    text-align: center;
    color: rgba(255,255,255,0.95);
  }

  .mc-benefit-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .mc-benefit-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 20px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px;
    text-align: left;
    transition: border-color 0.2s;
  }

  .mc-benefit-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(70, 114, 236, 0.2), rgba(139, 92, 246, 0.15));
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #818cf8;
    margin-bottom: 4px;
  }

  .mc-benefit-card strong {
    display: block;
    font-size: 15px;
    font-weight: 600;
    color: rgba(255,255,255,0.95);
  }

  .mc-benefit-card span {
    font-size: 13px;
    color: rgba(255,255,255,0.45);
    line-height: 1.5;
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
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 18px;
    padding: 22px;
    position: relative;
    overflow: hidden;
    transition: border-color 0.2s;
  }

  .mc-testimonial-quote {
    position: absolute;
    top: 10px;
    right: 20px;
    font-size: 64px;
    font-weight: 800;
    line-height: 1;
    background: linear-gradient(135deg, rgba(70, 114, 236, 0.15), rgba(139, 92, 246, 0.08));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    pointer-events: none;
    font-family: Georgia, serif;
  }

  .mc-testimonial-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }

  .mc-testimonial-stars {
    display: flex;
    gap: 2px;
  }

  .mc-testimonial-result {
    font-size: 11px;
    font-weight: 700;
    color: #4ade80;
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.15);
    padding: 4px 10px;
    border-radius: 50px;
    letter-spacing: 0.02em;
  }

  .mc-testimonial-text {
    font-size: 14px;
    line-height: 1.7;
    color: rgba(255,255,255,0.7);
    margin: 0 0 16px;
    position: relative;
  }

  .mc-testimonial-author {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: 14px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .mc-testimonial-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, #4672ec, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    flex-shrink: 0;
    letter-spacing: -0.02em;
  }

  .mc-testimonial-author > div {
    display: flex;
    flex-direction: column;
  }

  .mc-testimonial-author strong {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255,255,255,0.9);
  }

  .mc-testimonial-author span {
    font-size: 12px;
    color: rgba(255,255,255,0.4);
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
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s;
  }

  .mc-faq-item:hover {
    border-color: rgba(255,255,255,0.14);
    background: rgba(255,255,255,0.04);
  }

  .mc-faq-open {
    border-color: rgba(70, 114, 236, 0.3) !important;
    background: linear-gradient(135deg, rgba(70, 114, 236, 0.06), rgba(139, 92, 246, 0.03)) !important;
  }

  .mc-faq-question {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    gap: 12px;
  }

  .mc-faq-question span {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255,255,255,0.85);
  }

  .mc-faq-arrow {
    flex-shrink: 0;
    color: rgba(255,255,255,0.3);
    transition: all 0.25s ease;
  }

  .mc-faq-arrow-open {
    transform: rotate(180deg);
    color: #818cf8;
  }

  .mc-faq-answer {
    padding: 0 20px 18px;
    margin: 0;
    font-size: 14px;
    line-height: 1.7;
    color: rgba(255,255,255,0.55);
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
    background: linear-gradient(135deg, #4672ec 0%, #5b4dd6 100%);
    border: none;
    border-radius: 14px;
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(70, 114, 236, 0.3);
    letter-spacing: 0.02em;
  }

  .mc-sticky-btn:active {
    transform: scale(0.97);
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
        "pain         pain"
        "instructor   instructor"
        "benefits     benefits"
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
      padding-top: 40px;
    }

    .mc-pain-list {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .mc-instructor-wrap {
      grid-area: instructor;
      margin-bottom: 0;
    }

    .mc-instructor-card {
      padding: 32px;
    }

    .mc-instructor-img-wrap img {
      width: 72px;
      height: 72px;
    }

    .mc-benefits {
      grid-area: benefits;
    }

    .mc-benefit-list {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
    }

    .mc-benefit-card:hover {
      border-color: rgba(70, 114, 236, 0.2);
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

    .mc-field input:hover {
      border-color: rgba(255,255,255,0.2);
    }

    .mc-faq-item:hover {
      border-color: rgba(255,255,255,0.2);
    }

    .mc-testimonial-card:hover {
      border-color: rgba(70, 114, 236, 0.2);
    }

    .mc-faq-item:hover .mc-faq-arrow {
      color: rgba(255,255,255,0.5);
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
