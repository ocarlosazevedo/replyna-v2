import { useState, useEffect, useRef } from 'react'
import {
  Play,
  AlertCircle,
  ChevronDown,
  Loader2,
  Lock,
  Shield,
  Check,
  Zap,
  DollarSign,
  BookOpen,
  Target,
  ShoppingCart,
  BarChart3,
  MessageSquare,
  FileText,
  Settings,
  Award,
  Star,
  Users,
  Clock,
  CreditCard,
  Calendar,
  PlayCircle,
  X,
  TrendingDown
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ==================== CONSTANTS ====================

const VIDEO_URL = '' // Placeholder — substituir pela URL real do video

const heroWords = ['chargebacks', 'disputas', 'bloqueios', 'prejuízos']

const statsData = [
  { value: '+500', label: 'Alunos', icon: <Users size={22} /> },
  { value: '47min', label: 'Conteúdo completo', icon: <Clock size={22} /> },
  { value: '100%', label: 'Gratuito', icon: <Zap size={22} /> }
]

const trustBadges = [
  { icon: <Shield size={16} />, label: 'Método Validado' },
  { icon: <Lock size={16} />, label: 'Acesso Vitalício' },
  { icon: <CreditCard size={16} />, label: 'Sem Cartão' },
  { icon: <Calendar size={16} />, label: 'Conteúdo 2026' }
]

const valueProps = [
  '100% gratuito',
  'Método validado',
  'Conteúdo atualizado 2026',
  'Acesso vitalício'
]

const curriculumModules = [
  {
    number: '01',
    title: 'O que é Chargeback e por que ele acontece',
    description: 'Entenda de vez o mecanismo por trás das disputas e por que sua loja é alvo. Você vai aprender a identificar os principais gatilhos que levam clientes a abrir chargebacks.',
    icon: <BookOpen size={24} />
  },
  {
    number: '02',
    title: 'Os erros que estão matando sua conta na Payments',
    description: 'Os 5 erros mais comuns que aumentam sua taxa de chargeback sem você perceber. Descubra o que está sabotando sua operação e como corrigir imediatamente.',
    icon: <AlertCircle size={24} />
  },
  {
    number: '03',
    title: 'O Método Anti-Chargeback completo',
    description: 'Passo a passo do método validado para reduzir até 90% dos chargebacks. A estratégia exata usada por operações que faturam $500K+/mês.',
    icon: <Shield size={24} />
  },
  {
    number: '04',
    title: 'Configurações essenciais da Shopify Payments',
    description: 'O que configurar hoje para proteger sua conta e evitar bloqueios. Checklist completo das configurações que 90% dos lojistas ignoram.',
    icon: <Settings size={24} />
  },
  {
    number: '05',
    title: 'Como responder disputas e vencer',
    description: 'Templates e estratégias para montar evidências e reverter chargebacks. Aumente sua taxa de vitória em disputas com documentação profissional.',
    icon: <FileText size={24} />
  },
  {
    number: '06',
    title: 'Automação e prevenção avançada',
    description: 'Como automatizar a proteção e manter sua taxa abaixo de 1% no piloto automático. Ferramentas e workflows para escalar sem medo.',
    icon: <Zap size={24} />
  }
]

const audienceItems = [
  {
    icon: <ShoppingCart size={22} />,
    title: 'Donos de e-commerce',
    description: 'Que vendem pela Shopify e processam pagamentos com Shopify Payments.'
  },
  {
    icon: <BarChart3 size={22} />,
    title: 'Operações de dropshipping',
    description: 'Que precisam manter a taxa de chargeback baixa para não perder a conta.'
  },
  {
    icon: <MessageSquare size={22} />,
    title: 'Quem já sofreu bloqueio',
    description: 'Que teve conta bloqueada ou recebeu aviso da Shopify sobre taxa de disputas.'
  },
  {
    icon: <Target size={22} />,
    title: 'Quem quer escalar com segurança',
    description: 'Que quer faturar mais sem o medo constante de perder a estrutura de pagamentos.'
  }
]

const testimonials = [
  {
    name: 'Rafael M.',
    role: 'Dropshipping — $120K/mês',
    text: 'Minha taxa de chargeback caiu de 3.2% para 0.4% em menos de 30 dias. Salvou minha conta na Shopify Payments.',
    stars: 5
  },
  {
    name: 'Juliana S.',
    role: 'E-commerce próprio',
    text: 'Conteúdo direto ao ponto. Implementei as configurações do módulo 4 e já vi resultado na primeira semana.',
    stars: 5
  },
  {
    name: 'Pedro L.',
    role: 'Dropshipping Global',
    text: 'Já tinha perdido 2 contas antes de assistir essa masterclass. Agora minha operação roda há 8 meses sem problemas.',
    stars: 5
  },
  {
    name: 'Mariana C.',
    role: 'Loja Shopify — Moda',
    text: 'O método de resposta a disputas é ouro. Comecei a vencer 70% dos chargebacks que antes eram perda total.',
    stars: 5
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
    answer: 'Sim. O método funciona para e-commerce, dropshipping, infoprodutos e qualquer operação que processa pagamentos online pela Shopify Payments.'
  },
  {
    question: 'Recebo o acesso na hora?',
    answer: 'Sim! Após o cadastro você é redirecionado imediatamente para a área de membros onde pode assistir a masterclass completa.'
  },
  {
    question: 'Preciso ter experiência técnica?',
    answer: 'Não. O conteúdo foi pensado para donos de negócio, não desenvolvedores. Tudo é explicado de forma simples e prática, com exemplos reais.'
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
  const [heroWordIndex, setHeroWordIndex] = useState(0)
  const [activeModule, setActiveModule] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const countdown = useCountdown()

  // Meta Pixel
  useEffect(() => {
    const w = window as Record<string, any>
    if (w.fbq) return

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

  // Rotating hero words
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroWordIndex(prev => (prev + 1) % heroWords.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  // Carousel auto-rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setCarouselIndex(prev => (prev + 1) % 4)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  // Sticky header scroll detection
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Sticky CTA: show when hero scrolls out of view
  useEffect(() => {
    if (!heroRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(heroRef.current)
    return () => observer.disconnect()
  }, [])

  // Scroll fade-in animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('mc-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )
    document.querySelectorAll('.mc-fade-in').forEach(el => observer.observe(el))
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

  const openModal = () => {
    setShowModal(true)
    document.body.style.overflow = 'hidden'
  }

  const closeModal = () => {
    setShowModal(false)
    document.body.style.overflow = ''
  }

  const currentModule = curriculumModules[activeModule]

  // ==================== RENDER ====================
  return (
    <div className="mc-page">
      <style>{styles}</style>

      {/* ===== HEADER ===== */}
      <header className={`mc-header ${scrolled ? 'mc-header-scrolled' : ''}`}>
        <div className="mc-header-inner">
          <img src="/replyna-logo.webp" alt="Replyna" className="mc-logo" />
          <nav className="mc-nav">
            <a href="#conteudo" className="mc-nav-link">Conteúdo</a>
            <a href="#instrutor" className="mc-nav-link">Instrutor</a>
            <a href="#faq" className="mc-nav-link">FAQ</a>
            <button onClick={openModal} className="mc-nav-cta">Acesso Gratuito</button>
          </nav>
        </div>
      </header>

      {/* ===== HERO + FORM ===== */}
      <section className="mc-hero">
        <div className="mc-hero-inner">
          <div className="mc-hero-text">
            {/* Social proof badge */}
            <div className="mc-social-badge">
              <div className="mc-social-stars">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={12} fill="#facc15" color="#facc15" />
                ))}
              </div>
              <span>+500 alunos já assistiram</span>
            </div>

            <h1 className="mc-headline">
              Pare de perder dinheiro com{' '}
              <span className="mc-rotating-word" key={heroWordIndex}>
                {heroWords[heroWordIndex]}
              </span>
              {' '}e proteja sua conta na Shopify Payments
            </h1>

            <p className="mc-subheadline">
              Masterclass gratuita de 47 minutos com o método validado para reduzir até 90% dos
              chargebacks e evitar o bloqueio da sua conta.
            </p>

            <button onClick={openModal} className="mc-hero-cta">
              <Play size={20} fill="#fff" />
              QUERO ACESSO GRATUITO
            </button>

            {/* Value props */}
            <div className="mc-value-props">
              {valueProps.map((prop, i) => (
                <div key={i} className="mc-value-item">
                  <Check size={16} />
                  <span>{prop}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hero Carousel */}
          <div className="mc-hero-carousel" ref={heroRef}>
            <div className="mc-carousel-viewport">
              {/* Slide 0: Dashboard */}
              <div className={`mc-carousel-slide ${carouselIndex === 0 ? 'mc-slide-active' : ''}`}>
                <div className="mc-slide-card">
                  <div className="mc-slide-topbar">
                    <div className="mc-slide-dots"><span /><span /><span /></div>
                    <span className="mc-slide-url">shopify.com/admin/payments</span>
                  </div>
                  <div className="mc-slide-content">
                    <div className="mc-slide-metric-row">
                      <span className="mc-slide-metric-label">Taxa de Chargeback</span>
                      <span className="mc-slide-metric-badge"><TrendingDown size={12} /> -90%</span>
                    </div>
                    <div className="mc-slide-big-number">0.4%</div>
                    <div className="mc-slide-bars">
                      <div className="mc-slide-bar-item">
                        <span>Antes</span>
                        <div className="mc-slide-bar-track"><div className="mc-slide-bar-fill mc-fill-red" style={{width: '80%'}} /></div>
                        <span className="mc-color-red">3.2%</span>
                      </div>
                      <div className="mc-slide-bar-item">
                        <span>Depois</span>
                        <div className="mc-slide-bar-track"><div className="mc-slide-bar-fill mc-fill-green" style={{width: '10%'}} /></div>
                        <span className="mc-color-green">0.4%</span>
                      </div>
                    </div>
                    <div className="mc-slide-stats-row">
                      <div><strong>$500K+</strong><span>Faturamento</span></div>
                      <div><strong>40%</strong><span>Margem</span></div>
                      <div><strong>0</strong><span>Bloqueios</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Slide 1: Protection */}
              <div className={`mc-carousel-slide ${carouselIndex === 1 ? 'mc-slide-active' : ''}`}>
                <div className="mc-slide-card mc-slide-protection">
                  <div className="mc-slide-shield-icon">
                    <Shield size={40} />
                  </div>
                  <h3 className="mc-slide-title">Conta Protegida</h3>
                  <div className="mc-slide-checklist">
                    <div className="mc-slide-check"><Check size={16} /> Monitoramento de disputas</div>
                    <div className="mc-slide-check"><Check size={16} /> Prevenção automatizada</div>
                    <div className="mc-slide-check"><Check size={16} /> Resposta profissional a CBs</div>
                    <div className="mc-slide-check"><Check size={16} /> Taxa abaixo de 1%</div>
                  </div>
                  <div className="mc-slide-protected-badge">
                    <Shield size={14} />
                    <span>500+ contas protegidas</span>
                  </div>
                </div>
              </div>

              {/* Slide 2: Modules */}
              <div className={`mc-carousel-slide ${carouselIndex === 2 ? 'mc-slide-active' : ''}`}>
                <div className="mc-slide-card mc-slide-modules">
                  <div className="mc-slide-modules-header">
                    <BookOpen size={20} />
                    <span>6 Módulos Práticos</span>
                    <span className="mc-slide-duration">47min</span>
                  </div>
                  <div className="mc-slide-module-list">
                    <div className="mc-slide-mod"><span className="mc-slide-mod-num">01</span> O que é Chargeback</div>
                    <div className="mc-slide-mod"><span className="mc-slide-mod-num">02</span> Erros que matam sua conta</div>
                    <div className="mc-slide-mod mc-slide-mod-highlight"><span className="mc-slide-mod-num">03</span> Método Anti-Chargeback</div>
                    <div className="mc-slide-mod"><span className="mc-slide-mod-num">04</span> Configurações essenciais</div>
                    <div className="mc-slide-mod"><span className="mc-slide-mod-num">05</span> Responder e vencer disputas</div>
                    <div className="mc-slide-mod"><span className="mc-slide-mod-num">06</span> Automação avançada</div>
                  </div>
                </div>
              </div>

              {/* Slide 3: Results */}
              <div className={`mc-carousel-slide ${carouselIndex === 3 ? 'mc-slide-active' : ''}`}>
                <div className="mc-slide-card mc-slide-results">
                  <h3 className="mc-slide-title">Resultados Comprovados</h3>
                  <div className="mc-slide-comparison">
                    <div className="mc-slide-comp-col mc-comp-before">
                      <span className="mc-slide-comp-label">ANTES</span>
                      <div className="mc-slide-comp-item"><span>Taxa CB</span><strong>3.2%</strong></div>
                      <div className="mc-slide-comp-item"><span>Disputas</span><strong>20+/mês</strong></div>
                      <div className="mc-slide-comp-item"><span>Risco</span><strong>Alto</strong></div>
                    </div>
                    <div className="mc-slide-comp-divider" />
                    <div className="mc-slide-comp-col mc-comp-after">
                      <span className="mc-slide-comp-label">DEPOIS</span>
                      <div className="mc-slide-comp-item"><span>Taxa CB</span><strong>0.4%</strong></div>
                      <div className="mc-slide-comp-item"><span>Disputas</span><strong>2/mês</strong></div>
                      <div className="mc-slide-comp-item"><span>Risco</span><strong>Zero</strong></div>
                    </div>
                  </div>
                  <div className="mc-slide-results-footer">
                    <Star size={14} fill="#facc15" color="#facc15" />
                    <span>Método aplicado em +500 operações</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation dots */}
            <div className="mc-carousel-dots">
              {[0, 1, 2, 3].map(i => (
                <button
                  key={i}
                  className={`mc-carousel-dot ${carouselIndex === i ? 'mc-dot-active' : ''}`}
                  onClick={() => setCarouselIndex(i)}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>

            {/* Floating badges (desktop only) */}
            <div className="mc-carousel-float mc-cf-1">
              <Shield size={16} />
              <span>Método Validado</span>
            </div>
            <div className="mc-carousel-float mc-cf-2">
              <Star size={16} fill="#facc15" color="#facc15" />
              <span>+500 Alunos</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== STATS + TRUST BADGES ===== */}
      <section className="mc-stats-section mc-fade-in">
        <div className="mc-stats-inner">
          <div className="mc-stats-grid">
            {statsData.map((stat, i) => (
              <div key={i} className="mc-stat-card">
                <div className="mc-stat-icon">{stat.icon}</div>
                <span className="mc-stat-value">{stat.value}</span>
                <span className="mc-stat-label">{stat.label}</span>
              </div>
            ))}
          </div>

          <div className="mc-trust-row">
            {trustBadges.map((badge, i) => (
              <div key={i} className="mc-trust-badge">
                {badge.icon}
                <span>{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== VIDEO EMBED ===== */}
      {VIDEO_URL && (
        <section className="mc-section mc-video-section mc-fade-in">
          <div className="mc-section-inner">
            <h2 className="mc-section-title">
              Veja um trecho da <span className="mc-highlight">masterclass</span>
            </h2>
            <div className="mc-video-wrap">
              <iframe
                src={VIDEO_URL}
                title="Trecho da Masterclass"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </section>
      )}

      {/* Video placeholder when no URL */}
      {!VIDEO_URL && (
        <section className="mc-section mc-video-section mc-fade-in">
          <div className="mc-section-inner">
            <h2 className="mc-section-title">
              Veja um trecho da <span className="mc-highlight">masterclass</span>
            </h2>
            <div className="mc-video-placeholder" onClick={openModal}>
              <PlayCircle size={64} />
              <span>Cadastre-se para assistir a masterclass completa</span>
            </div>
          </div>
        </section>
      )}

      {/* ===== LOSS CALCULATOR ===== */}
      <section className="mc-section mc-losses mc-fade-in">
        <div className="mc-section-inner">
          <h2 className="mc-section-title">
            Você já fez os cálculos de quanto{' '}
            <span className="mc-highlight-red">tem perdido</span>{' '}
            com bloqueios na Payments e chargebacks?
          </h2>

          <p className="mc-section-text">
            A maioria dos lojistas só percebe o tamanho do prejuízo quando já é tarde demais.
            Chargebacks não são apenas o valor da venda perdida — são taxas extras, multas
            acumulativas e o risco real de perder sua conta na Shopify Payments.
          </p>

          <div className="mc-loss-example">
            <div className="mc-loss-header">
              <DollarSign size={20} />
              <span>Exemplo real: operação de R$100.000/mês</span>
            </div>
            <div className="mc-loss-grid">
              <div className="mc-loss-item">
                <span className="mc-loss-label">Chargebacks (taxa média de 2%)</span>
                <span className="mc-loss-value mc-loss-red">-R$ 2.000/mês</span>
              </div>
              <div className="mc-loss-item">
                <span className="mc-loss-label">Taxas por disputa (~R$85 cada)</span>
                <span className="mc-loss-value mc-loss-red">-R$ 1.700/mês</span>
              </div>
              <div className="mc-loss-item">
                <span className="mc-loss-label">Produtos enviados sem reembolso</span>
                <span className="mc-loss-value mc-loss-red">-R$ 2.000/mês</span>
              </div>
              <div className="mc-loss-item mc-loss-total">
                <span className="mc-loss-label">Prejuízo estimado por ano</span>
                <span className="mc-loss-value mc-loss-red-big">-R$ 68.400/ano</span>
              </div>
            </div>
            <p className="mc-loss-footer">
              E isso sem contar o maior risco: o <strong>bloqueio definitivo</strong> da sua conta
              na Shopify Payments, que pode parar toda sua operação de uma hora pra outra.
            </p>
          </div>
        </div>
      </section>

      {/* ===== CURRICULUM (TABS) ===== */}
      <section id="conteudo" className="mc-section mc-curriculum mc-fade-in">
        <div className="mc-section-inner">
          <h2 className="mc-section-title">
            Veja todo conteúdo da masterclass que vai{' '}
            <span className="mc-highlight">mudar o destino</span>{' '}
            da sua operação
          </h2>
          <p className="mc-section-text">
            São 6 módulos práticos em 47 minutos de puro conteúdo aplicável.
          </p>

          {/* Tab bar */}
          <div className="mc-tabs-bar">
            {curriculumModules.map((mod, i) => (
              <button
                key={i}
                className={`mc-tab ${activeModule === i ? 'mc-tab-active' : ''}`}
                onClick={() => setActiveModule(i)}
              >
                <span className="mc-tab-num">{mod.number}</span>
                <span className="mc-tab-title">{mod.title.split(' ').slice(0, 3).join(' ')}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="mc-tab-content">
            <div className="mc-tab-icon-wrap">{currentModule.icon}</div>
            <div className="mc-tab-detail">
              <span className="mc-tab-module-num">Módulo {currentModule.number}</span>
              <h3 className="mc-tab-module-title">{currentModule.title}</h3>
              <p className="mc-tab-module-desc">{currentModule.description}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== INSTANT ACCESS ===== */}
      <section className="mc-section mc-access mc-fade-in">
        <div className="mc-section-inner">
          <div className="mc-access-card">
            <div className="mc-access-icon">
              <Zap size={28} />
            </div>
            <h2 className="mc-section-title">Acesso gratuito e imediato</h2>
            <p className="mc-section-text">
              Assim que você se cadastrar, será redirecionado automaticamente para a área de membros.
              Sem espera, sem e-mail de confirmação. Você assiste a masterclass completa na hora,
              no seu ritmo, quantas vezes quiser. O acesso é vitalício.
            </p>
            <button onClick={openModal} className="mc-access-btn">
              <Play size={18} fill="#fff" />
              QUERO ACESSO AGORA
            </button>
          </div>
        </div>
      </section>

      {/* ===== TARGET AUDIENCE ===== */}
      <section className="mc-section mc-audience mc-fade-in">
        <div className="mc-section-inner">
          <h2 className="mc-section-title">Pra quem é essa aula?</h2>
          <p className="mc-section-text mc-text-center">
            Se você se encaixa em pelo menos um dos perfis abaixo,
            essa masterclass foi feita para você.
          </p>

          <div className="mc-audience-grid">
            {audienceItems.map((item, i) => (
              <div key={i} className="mc-audience-card">
                <div className="mc-audience-icon">{item.icon}</div>
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== INSTRUCTOR ===== */}
      <section id="instrutor" className="mc-section mc-instructor mc-fade-in">
        <div className="mc-section-inner">
          <h2 className="mc-section-title">Quem será o seu mentor nessa aula?</h2>

          <div className="mc-instructor-card">
            <div className="mc-instructor-top">
              <div className="mc-instructor-img-wrap">
                <img src="/influencers/carlos-azevedo.jpg" alt="Carlos Azevedo" />
              </div>
              <div className="mc-instructor-info">
                <strong>Carlos Azevedo</strong>
                <span className="mc-instructor-role">Empresário & Especialista em E-commerce Global</span>
                <p className="mc-instructor-quote">
                  "Minha missão é mostrar que é possível escalar sem medo de perder tudo da noite pro dia."
                </p>
              </div>
            </div>

            <p className="mc-instructor-bio">
              Empresário com mais de <strong>6 anos no mercado de e-commerce global</strong>.
              Pioneiro em dropshipping global, Google Ads e Shopify Payments.
              Hoje compartilho as estratégias que uso para faturar{' '}
              <strong>+$500K/mês com margem de até 40%</strong>.
            </p>

            <div className="mc-instructor-stats">
              <div className="mc-istat-item">
                <strong>$500K+</strong>
                <span>Faturamento/mês</span>
              </div>
              <div className="mc-istat-item">
                <strong>6+ anos</strong>
                <span>No mercado</span>
              </div>
              <div className="mc-istat-item">
                <strong>40%</strong>
                <span>Margem</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SOCIAL PROOF / TESTIMONIALS ===== */}
      <section className="mc-section mc-testimonials mc-fade-in">
        <div className="mc-section-inner">
          <h2 className="mc-section-title">
            O que os alunos <span className="mc-highlight">dizem</span>
          </h2>
          <p className="mc-section-text">
            Resultados reais de quem já aplicou o método da masterclass.
          </p>

          <div className="mc-testimonials-grid">
            {testimonials.map((t, i) => (
              <div key={i} className="mc-testimonial-card">
                <div className="mc-testimonial-stars">
                  {[...Array(t.stars)].map((_, j) => (
                    <Star key={j} size={14} fill="#facc15" color="#facc15" />
                  ))}
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
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="mc-section mc-faq mc-fade-in">
        <div className="mc-section-inner">
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
                <div className={`mc-faq-answer-wrap ${openFaq === i ? 'mc-faq-answer-open' : ''}`}>
                  <p className="mc-faq-answer">{item.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="mc-section mc-final-cta mc-fade-in">
        <div className="mc-section-inner mc-final-inner">
          {/* Floating icons */}
          <div className="mc-float-icons">
            <PlayCircle size={28} className="mc-float-icon mc-fi-1" />
            <Shield size={24} className="mc-float-icon mc-fi-2" />
            <Zap size={26} className="mc-float-icon mc-fi-3" />
            <Award size={22} className="mc-float-icon mc-fi-4" />
          </div>

          <Award size={44} className="mc-final-icon" />
          <h2 className="mc-final-title">
            Não deixe o chargeback destruir sua operação
          </h2>
          <p className="mc-final-text">
            Assista a masterclass gratuita e aprenda o método que já protegeu
            centenas de operações na Shopify Payments. Acesso gratuito expira em{' '}
            <strong>{String(countdown.hours).padStart(2, '0')}h {String(countdown.minutes).padStart(2, '0')}m</strong>.
          </p>
          <button onClick={openModal} className="mc-final-btn">
            <Play size={20} fill="#fff" />
            QUERO ACESSO GRATUITO
          </button>
        </div>
      </section>

      {/* ===== MODAL POPUP ===== */}
      {showModal && (
        <div className="mc-modal-overlay" onClick={closeModal}>
          <div className="mc-modal" onClick={e => e.stopPropagation()}>
            <button className="mc-modal-close" onClick={closeModal}>
              <X size={20} />
            </button>

            <div className="mc-form-header">
              <h2 className="mc-form-title">Garanta seu acesso gratuito</h2>
              <p className="mc-form-subtitle">Preencha abaixo e assista agora mesmo</p>
            </div>

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

            <form onSubmit={handleSubmit} className="mc-form">
              <div className="mc-field">
                <label htmlFor="modal-name">Seu nome</label>
                <input
                  id="modal-name"
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
                <label htmlFor="modal-email">Seu melhor e-mail</label>
                <input
                  id="modal-email"
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
                <label htmlFor="modal-whatsapp">WhatsApp</label>
                <input
                  id="modal-whatsapp"
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
                    QUERO ACESSO GRATUITO
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
        </div>
      )}

      {/* ===== STICKY CTA (mobile) ===== */}
      <div className={`mc-sticky-cta ${showSticky ? 'mc-sticky-visible' : ''}`}>
        <button onClick={openModal} className="mc-sticky-btn">
          <Play size={16} fill="#fff" />
          QUERO ACESSO GRATUITO
        </button>
      </div>

      {/* ===== FOOTER ===== */}
      <footer className="mc-footer">
        <div className="mc-footer-inner">
          <div className="mc-footer-col mc-footer-brand">
            <img src="/replyna-logo.webp" alt="Replyna" />
            <p>Proteja sua operação na Shopify Payments com o método anti-chargeback mais completo do mercado.</p>
          </div>
          <div className="mc-footer-col">
            <strong>Masterclass</strong>
            <a href="#conteudo">Conteúdo</a>
            <a href="#instrutor">Instrutor</a>
            <a href="#faq">Perguntas frequentes</a>
          </div>
          <div className="mc-footer-col">
            <strong>Contato</strong>
            <a href="mailto:support@replyna.com">support@replyna.com</a>
          </div>
        </div>
        <div className="mc-footer-bottom">
          <span>&copy; {new Date().getFullYear()} Replyna. Todos os direitos reservados.</span>
        </div>
      </footer>
    </div>
  )
}

// ==================== STYLES ====================
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  .mc-page {
    min-height: 100vh;
    min-height: 100dvh;
    background: #0a1628;
    color: #fff;
    font-family: "Inter", -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }

  /* ===== SCROLL FADE-IN ===== */
  .mc-fade-in {
    opacity: 0;
    transform: translateY(24px);
    transition: opacity 0.7s cubic-bezier(0.23, 1, 0.32, 1), transform 0.7s cubic-bezier(0.23, 1, 0.32, 1);
  }
  .mc-fade-in.mc-visible { opacity: 1; transform: translateY(0); }

  @keyframes cascadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .mc-fade-in .mc-stat-card,
  .mc-fade-in .mc-audience-card,
  .mc-fade-in .mc-testimonial-card,
  .mc-fade-in .mc-trust-badge { opacity: 0; }
  .mc-fade-in.mc-visible .mc-stat-card,
  .mc-fade-in.mc-visible .mc-audience-card,
  .mc-fade-in.mc-visible .mc-testimonial-card,
  .mc-fade-in.mc-visible .mc-trust-badge { animation: cascadeIn 0.6s ease-out forwards; }
  .mc-fade-in.mc-visible .mc-stat-card:nth-child(1),
  .mc-fade-in.mc-visible .mc-audience-card:nth-child(1),
  .mc-fade-in.mc-visible .mc-testimonial-card:nth-child(1),
  .mc-fade-in.mc-visible .mc-trust-badge:nth-child(1) { animation-delay: 0s; }
  .mc-fade-in.mc-visible .mc-stat-card:nth-child(2),
  .mc-fade-in.mc-visible .mc-audience-card:nth-child(2),
  .mc-fade-in.mc-visible .mc-testimonial-card:nth-child(2),
  .mc-fade-in.mc-visible .mc-trust-badge:nth-child(2) { animation-delay: 0.1s; }
  .mc-fade-in.mc-visible .mc-stat-card:nth-child(3),
  .mc-fade-in.mc-visible .mc-audience-card:nth-child(3),
  .mc-fade-in.mc-visible .mc-testimonial-card:nth-child(3),
  .mc-fade-in.mc-visible .mc-trust-badge:nth-child(3) { animation-delay: 0.15s; }
  .mc-fade-in.mc-visible .mc-audience-card:nth-child(4),
  .mc-fade-in.mc-visible .mc-testimonial-card:nth-child(4),
  .mc-fade-in.mc-visible .mc-trust-badge:nth-child(4) { animation-delay: 0.2s; }

  /* ===== HEADER ===== */
  .mc-header {
    padding: 16px 20px;
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(10, 22, 40, 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    transition: box-shadow 0.25s ease-out, background 0.25s ease-out;
  }
  .mc-header-scrolled {
    background: rgba(10, 22, 40, 0.95);
    box-shadow: 0 1px 20px rgba(0,0,0,0.3);
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .mc-header-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .mc-logo { height: 26px; width: auto; opacity: 0.95; }
  .mc-nav { display: none; align-items: center; gap: 32px; }
  .mc-nav-link {
    font-size: 14px;
    color: rgba(255,255,255,0.6);
    text-decoration: none;
    font-weight: 500;
    transition: color 0.2s;
    position: relative;
  }
  .mc-nav-link::after {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 0;
    width: 0;
    height: 2px;
    background: #1E90FF;
    transition: width 0.25s ease-out;
  }
  .mc-nav-link:hover { color: #fff; }
  .mc-nav-link:hover::after { width: 100%; }
  .mc-nav-cta {
    padding: 10px 22px;
    background: #1E90FF;
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.25s ease-in-out;
    font-family: inherit;
  }
  .mc-nav-cta:hover { background: #0C7CD5; transform: scale(1.03); }

  /* ===== HERO ===== */
  .mc-hero {
    padding: 48px 20px 48px;
    text-align: center;
    position: relative;
    overflow: hidden;
    background: linear-gradient(180deg, #0e1d35 0%, #0a1628 100%);
  }
  .mc-hero::before {
    content: '';
    position: absolute;
    top: -120px;
    left: 50%;
    transform: translateX(-50%);
    width: 700px;
    height: 700px;
    background: radial-gradient(circle, rgba(30,144,255,0.1) 0%, rgba(32,178,170,0.05) 40%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }
  .mc-hero::after {
    content: '';
    position: absolute;
    top: 60px;
    right: -200px;
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(32,178,170,0.06) 0%, transparent 60%);
    pointer-events: none;
    z-index: 0;
  }
  .mc-hero-inner {
    max-width: 720px;
    margin: 0 auto;
    position: relative;
    z-index: 1;
  }
  .mc-hero-text { display: flex; flex-direction: column; align-items: center; }

  /* ===== HERO CAROUSEL ===== */
  .mc-hero-carousel {
    width: 100%;
    max-width: 500px;
    margin: 0 auto;
    position: relative;
  }
  .mc-carousel-viewport {
    position: relative;
    width: 100%;
    height: 340px;
    border-radius: 20px;
    overflow: hidden;
  }
  .mc-carousel-slide {
    position: absolute;
    inset: 0;
    opacity: 0;
    transition: opacity 0.5s ease-in-out;
    pointer-events: none;
  }
  .mc-slide-active { opacity: 1; pointer-events: auto; }
  .mc-slide-card {
    width: 100%;
    height: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 8px 40px rgba(0,0,0,0.3);
    display: flex;
    flex-direction: column;
  }
  .mc-slide-topbar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: rgba(255,255,255,0.04);
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .mc-slide-dots { display: flex; gap: 5px; }
  .mc-slide-dots span { width: 8px; height: 8px; border-radius: 50%; }
  .mc-slide-dots span:first-child { background: #ef4444; opacity: 0.8; }
  .mc-slide-dots span:nth-child(2) { background: #facc15; opacity: 0.8; }
  .mc-slide-dots span:nth-child(3) { background: #4ade80; opacity: 0.8; }
  .mc-slide-url { font-size: 10px; color: rgba(255,255,255,0.3); font-weight: 500; }
  .mc-slide-content {
    flex: 1;
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .mc-slide-metric-row { display: flex; align-items: center; justify-content: space-between; }
  .mc-slide-metric-label { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.6); }
  .mc-slide-metric-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: rgba(74,222,128,0.12);
    border: 1px solid rgba(74,222,128,0.2);
    border-radius: 50px;
    font-size: 11px;
    font-weight: 700;
    color: #4ade80;
  }
  .mc-slide-big-number {
    font-size: 38px;
    font-weight: 800;
    background: linear-gradient(135deg, #4ade80, #22c55e);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1;
  }
  .mc-slide-bars { display: flex; flex-direction: column; gap: 8px; }
  .mc-slide-bar-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: rgba(255,255,255,0.4);
  }
  .mc-slide-bar-item > span:first-child { width: 40px; flex-shrink: 0; }
  .mc-slide-bar-track {
    flex: 1;
    height: 6px;
    background: rgba(255,255,255,0.06);
    border-radius: 4px;
    overflow: hidden;
  }
  .mc-slide-bar-fill { height: 100%; border-radius: 4px; }
  .mc-fill-red { background: linear-gradient(90deg, #ef4444, #f87171); }
  .mc-fill-green { background: linear-gradient(90deg, #22c55e, #4ade80); box-shadow: 0 0 8px rgba(74,222,128,0.3); }
  .mc-color-red { color: #f87171; font-weight: 700; }
  .mc-color-green { color: #4ade80; font-weight: 700; }
  .mc-slide-stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border-top: 1px solid rgba(255,255,255,0.06);
    padding-top: 12px;
    margin-top: auto;
  }
  .mc-slide-stats-row > div { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .mc-slide-stats-row strong {
    font-size: 14px;
    font-weight: 800;
    background: linear-gradient(135deg, #1E90FF, #20B2AA);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .mc-slide-stats-row span {
    font-size: 9px;
    color: rgba(255,255,255,0.35);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .mc-slide-protection {
    align-items: center;
    justify-content: center;
    padding: 24px 20px;
    gap: 14px;
    text-align: center;
  }
  .mc-slide-shield-icon {
    width: 64px;
    height: 64px;
    border-radius: 18px;
    background: linear-gradient(135deg, rgba(30,144,255,0.15), rgba(32,178,170,0.1));
    display: flex;
    align-items: center;
    justify-content: center;
    color: #1E90FF;
  }
  .mc-slide-title { font-size: 18px; font-weight: 700; margin: 0; color: rgba(255,255,255,0.95); }
  .mc-slide-checklist { display: flex; flex-direction: column; gap: 6px; width: 100%; text-align: left; }
  .mc-slide-check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: rgba(255,255,255,0.65);
    padding: 7px 12px;
    background: rgba(255,255,255,0.03);
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.06);
  }
  .mc-slide-check svg { color: #20B2AA; flex-shrink: 0; }
  .mc-slide-protected-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: rgba(30,144,255,0.1);
    border: 1px solid rgba(30,144,255,0.2);
    border-radius: 50px;
    font-size: 11px;
    font-weight: 600;
    color: rgba(255,255,255,0.8);
  }
  .mc-slide-protected-badge svg { color: #1E90FF; }
  .mc-slide-modules { padding: 16px; gap: 10px; }
  .mc-slide-modules-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 700;
    color: rgba(255,255,255,0.9);
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .mc-slide-modules-header svg { color: #1E90FF; }
  .mc-slide-duration {
    margin-left: auto;
    padding: 3px 10px;
    background: rgba(30,144,255,0.12);
    border: 1px solid rgba(30,144,255,0.2);
    border-radius: 50px;
    font-size: 11px;
    font-weight: 600;
    color: #1E90FF;
  }
  .mc-slide-module-list { display: flex; flex-direction: column; gap: 3px; flex: 1; }
  .mc-slide-mod {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
    color: rgba(255,255,255,0.5);
  }
  .mc-slide-mod-num { font-weight: 800; color: rgba(255,255,255,0.2); font-size: 11px; min-width: 18px; }
  .mc-slide-mod-highlight {
    background: rgba(30,144,255,0.08);
    border: 1px solid rgba(30,144,255,0.2);
    color: rgba(255,255,255,0.9);
  }
  .mc-slide-mod-highlight .mc-slide-mod-num { color: #1E90FF; }
  .mc-slide-results { padding: 20px 16px; gap: 12px; align-items: center; }
  .mc-slide-comparison { display: flex; gap: 0; width: 100%; flex: 1; }
  .mc-slide-comp-col { flex: 1; display: flex; flex-direction: column; gap: 8px; padding: 10px; }
  .mc-slide-comp-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 2px;
  }
  .mc-comp-before .mc-slide-comp-label { color: #f87171; }
  .mc-comp-after .mc-slide-comp-label { color: #4ade80; }
  .mc-slide-comp-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    background: rgba(255,255,255,0.03);
    border-radius: 8px;
    font-size: 12px;
  }
  .mc-slide-comp-item span { color: rgba(255,255,255,0.4); }
  .mc-comp-before .mc-slide-comp-item strong { color: #f87171; font-weight: 700; }
  .mc-comp-after .mc-slide-comp-item strong { color: #4ade80; font-weight: 700; }
  .mc-slide-comp-divider { width: 1px; background: rgba(255,255,255,0.08); margin: 10px 0; }
  .mc-slide-results-footer {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: rgba(255,255,255,0.5);
    font-weight: 500;
  }
  .mc-carousel-dots { display: flex; justify-content: center; gap: 8px; margin-top: 16px; }
  .mc-carousel-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: none;
    background: rgba(255,255,255,0.15);
    cursor: pointer;
    padding: 0;
    transition: all 0.3s ease;
  }
  .mc-dot-active {
    background: #1E90FF;
    width: 24px;
    border-radius: 4px;
    box-shadow: 0 0 10px rgba(30,144,255,0.4);
  }
  @keyframes floatBadge {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  .mc-carousel-float {
    position: absolute;
    display: none;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: rgba(14, 29, 53, 0.9);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255,255,255,0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    animation: floatBadge 4s ease-in-out infinite;
    white-space: nowrap;
    z-index: 2;
  }
  .mc-carousel-float svg { color: #1E90FF; flex-shrink: 0; }
  .mc-cf-1 { top: 12%; right: -24px; animation-delay: 0s; }
  .mc-cf-2 { bottom: 20%; left: -28px; animation-delay: 1s; }

  /* ===== MODAL ===== */
  @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes modalSlideUp {
    from { opacity: 0; transform: translateY(24px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .mc-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    animation: modalFadeIn 0.25s ease;
  }
  .mc-modal {
    width: 100%;
    max-width: 440px;
    max-height: 90vh;
    overflow-y: auto;
    background: #0e1d35;
    border: 1px solid rgba(30,144,255,0.2);
    border-radius: 24px;
    padding: 32px 24px;
    position: relative;
    box-shadow: 0 24px 80px rgba(0,0,0,0.5), 0 0 120px rgba(30,144,255,0.06);
    animation: modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .mc-modal-close {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    transition: all 0.2s;
  }
  .mc-modal-close:hover { background: rgba(255,255,255,0.1); color: #fff; }

  /* Social proof badge */
  .mc-social-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(250,204,21,0.08);
    border: 1px solid rgba(250,204,21,0.2);
    padding: 8px 18px;
    border-radius: 50px;
    margin-bottom: 24px;
  }
  .mc-social-stars { display: flex; gap: 2px; }
  .mc-social-badge span { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.8); }

  @keyframes wordFadeIn {
    0% { opacity: 0; transform: translateY(8px); }
    15% { opacity: 1; transform: translateY(0); }
    85% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-8px); }
  }
  .mc-rotating-word {
    display: inline-block;
    background: linear-gradient(135deg, #f87171, #ef4444, #dc2626);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: wordFadeIn 2.5s ease-in-out;
    font-weight: 800;
  }
  .mc-headline {
    font-size: 28px;
    font-weight: 800;
    line-height: 1.2;
    margin: 0 0 16px;
    letter-spacing: -0.025em;
    color: #fff;
  }
  @keyframes gradientShift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  .mc-highlight {
    background: linear-gradient(135deg, #1E90FF, #20B2AA, #1E90FF);
    background-size: 300% 300%;
    animation: gradientShift 4s ease infinite;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .mc-highlight-red { color: #f87171; }
  .mc-subheadline {
    font-size: 16px;
    color: rgba(255,255,255,0.6);
    margin: 0 0 28px;
    line-height: 1.7;
  }
  @keyframes ctaPulse {
    0%, 100% { box-shadow: 0 4px 20px rgba(30,144,255,0.3); }
    50% { box-shadow: 0 4px 40px rgba(30,144,255,0.5), 0 0 60px rgba(32,178,170,0.12); }
  }
  .mc-hero-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 18px 40px;
    background: #1E90FF;
    border: none;
    border-radius: 14px;
    color: #fff;
    font-size: 17px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.25s ease-in-out;
    animation: ctaPulse 2.5s ease-in-out infinite;
    letter-spacing: 0.04em;
    font-family: inherit;
    margin-bottom: 28px;
    position: relative;
  }
  .mc-hero-cta:hover { background: #0C7CD5; transform: scale(1.03); }
  .mc-hero-cta:active { transform: scale(0.97); animation: none; }
  .mc-value-props {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px 20px;
    margin-bottom: 32px;
  }
  .mc-value-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: rgba(255,255,255,0.6);
    font-weight: 500;
  }
  .mc-value-item svg { color: #20B2AA; flex-shrink: 0; }

  /* ===== FORM ===== */
  .mc-form-container {
    max-width: 480px;
    margin: 0 auto;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(30,144,255,0.2);
    border-radius: 24px;
    padding: 32px 24px;
    position: relative;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 8px 40px rgba(30,144,255,0.06);
  }
  .mc-form-header { text-align: center; margin-bottom: 20px; }
  .mc-form-title { font-size: 20px; font-weight: 700; margin: 0 0 6px; }
  .mc-form-subtitle { font-size: 14px; color: rgba(255,255,255,0.5); margin: 0; }
  .mc-countdown {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 16px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px;
    margin-bottom: 20px;
  }
  @keyframes livePulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.8); }
  }
  .mc-countdown-label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255,255,255,0.5);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .mc-countdown-label::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ef4444;
    box-shadow: 0 0 8px rgba(239,68,68,0.6);
    animation: livePulse 1.5s ease-in-out infinite;
  }
  .mc-countdown-timer { display: flex; align-items: center; gap: 8px; }
  .mc-countdown-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 52px;
    padding: 8px 0;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
  }
  .mc-countdown-value {
    font-size: 24px;
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
    margin-top: 3px;
  }
  .mc-countdown-sep { font-size: 20px; font-weight: 700; color: rgba(255,255,255,0.2); margin-bottom: 14px; }
  .mc-form { width: 100%; display: flex; flex-direction: column; gap: 14px; }
  .mc-field { display: flex; flex-direction: column; gap: 6px; text-align: left; }
  .mc-field label { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.8); }
  .mc-field input {
    width: 100%;
    padding: 16px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    color: #fff;
    font-size: 16px;
    transition: all 0.2s;
    box-sizing: border-box;
    font-family: inherit;
  }
  .mc-field input::placeholder { color: rgba(255,255,255,0.3); }
  .mc-field input:focus {
    outline: none;
    border-color: #1E90FF;
    background: rgba(30,144,255,0.08);
    box-shadow: 0 0 0 3px rgba(30,144,255,0.1);
  }
  .mc-input-error { border-color: #ef4444 !important; background: rgba(239,68,68,0.08) !important; }
  .mc-error { font-size: 13px; color: #f87171; }
  .mc-btn-submit {
    width: 100%;
    padding: 18px;
    background: #1E90FF;
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
    transition: all 0.25s ease-in-out;
    margin-top: 4px;
    animation: ctaPulse 2.5s ease-in-out infinite;
    letter-spacing: 0.02em;
    font-family: inherit;
  }
  .mc-btn-submit:hover:not(:disabled) { background: #0C7CD5; transform: scale(1.02); }
  .mc-btn-submit:active { transform: scale(0.97); }
  .mc-btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .mc-spin { animation: spin 1s linear infinite; }
  .mc-privacy-row { display: flex; justify-content: center; gap: 16px; }
  .mc-privacy {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: rgba(255,255,255,0.4);
    margin: 0;
  }

  /* ===== STATS + TRUST BADGES ===== */
  .mc-stats-section {
    padding: 48px 20px;
    background: #0e1d35;
    border-top: 1px solid rgba(255,255,255,0.04);
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .mc-stats-inner { max-width: 800px; margin: 0 auto; }
  .mc-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 32px;
  }
  .mc-stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px 12px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px;
    text-align: center;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }
  .mc-stat-icon {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(30,144,255,0.15), rgba(32,178,170,0.1));
    color: #1E90FF;
  }
  .mc-stat-value {
    font-size: 28px;
    font-weight: 800;
    background: linear-gradient(135deg, #fff, rgba(255,255,255,0.8));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .mc-stat-label {
    font-size: 12px;
    color: rgba(255,255,255,0.5);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .mc-trust-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
  .mc-trust-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 50px;
    font-size: 12px;
    color: rgba(255,255,255,0.6);
    font-weight: 500;
  }
  .mc-trust-badge svg { color: #20B2AA; flex-shrink: 0; }

  /* ===== VIDEO SECTION ===== */
  .mc-video-section .mc-section-inner { max-width: 800px; }
  .mc-video-wrap {
    position: relative;
    width: 100%;
    padding-bottom: 56.25%;
    border-radius: 20px;
    overflow: hidden;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(30,144,255,0.2);
    box-shadow: 0 8px 40px rgba(30,144,255,0.06);
  }
  .mc-video-wrap iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }
  .mc-video-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 64px 24px;
    background: linear-gradient(135deg, rgba(30,144,255,0.06), rgba(32,178,170,0.03));
    border: 1px solid rgba(30,144,255,0.2);
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 8px 40px rgba(30,144,255,0.06);
  }
  .mc-video-placeholder:hover { border-color: rgba(30,144,255,0.35); }
  .mc-video-placeholder svg { color: #1E90FF; opacity: 0.7; }
  .mc-video-placeholder span { font-size: 15px; color: rgba(255,255,255,0.5); font-weight: 500; }

  /* ===== SECTIONS (shared) ===== */
  .mc-section {
    padding: 48px 20px;
    border-top: 1px solid rgba(255,255,255,0.04);
    position: relative;
  }
  .mc-section-inner { max-width: 800px; margin: 0 auto; }
  .mc-section-title {
    font-size: 22px;
    font-weight: 800;
    margin: 0 0 16px;
    text-align: center;
    letter-spacing: -0.02em;
    line-height: 1.3;
  }
  .mc-section-text {
    font-size: 15px;
    line-height: 1.7;
    color: rgba(255,255,255,0.6);
    margin: 0 0 24px;
    text-align: center;
  }
  .mc-text-center { text-align: center; }

  /* ===== LOSS CALCULATOR ===== */
  .mc-loss-example {
    background: rgba(248,113,113,0.04);
    border: 1px solid rgba(248,113,113,0.15);
    border-radius: 20px;
    padding: 24px;
    margin-top: 8px;
    box-shadow: 0 8px 40px rgba(248,113,113,0.04);
  }
  .mc-loss-header {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 15px;
    font-weight: 700;
    color: rgba(255,255,255,0.9);
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .mc-loss-header svg { color: #f87171; }
  .mc-loss-grid { display: flex; flex-direction: column; gap: 14px; }
  .mc-loss-item { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .mc-loss-label { font-size: 14px; color: rgba(255,255,255,0.6); }
  .mc-loss-value { font-size: 14px; font-weight: 700; white-space: nowrap; }
  .mc-loss-red { color: #f87171; }
  .mc-loss-total { padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); margin-top: 4px; }
  .mc-loss-red-big {
    color: #ef4444;
    font-size: 20px;
    font-weight: 800;
    text-shadow: 0 0 20px rgba(239,68,68,0.3);
  }
  .mc-loss-footer {
    font-size: 13px;
    line-height: 1.7;
    color: rgba(255,255,255,0.5);
    margin: 20px 0 0;
    padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .mc-loss-footer strong { color: #f87171; }

  /* ===== CURRICULUM TABS ===== */
  .mc-tabs-bar {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
    margin-bottom: 24px;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .mc-tabs-bar::-webkit-scrollbar { display: none; }
  .mc-tab {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 18px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    color: rgba(255,255,255,0.5);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.25s;
    font-family: inherit;
    white-space: nowrap;
  }
  .mc-tab:hover { border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.7); }
  .mc-tab-active {
    background: linear-gradient(135deg, rgba(30,144,255,0.1), rgba(32,178,170,0.06));
    border-color: rgba(30,144,255,0.3);
    color: #fff;
  }
  .mc-tab-num { font-weight: 800; color: #1E90FF; font-size: 12px; }
  .mc-tab-active .mc-tab-num { color: #20B2AA; }
  .mc-tab-title { display: none; }
  .mc-tab-content {
    display: flex;
    gap: 20px;
    align-items: flex-start;
    padding: 28px;
    background: linear-gradient(135deg, rgba(30,144,255,0.05), rgba(32,178,170,0.02));
    border: 1px solid rgba(30,144,255,0.15);
    border-radius: 20px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .mc-tab-icon-wrap {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(30,144,255,0.15), rgba(32,178,170,0.1));
    display: flex;
    align-items: center;
    justify-content: center;
    color: #1E90FF;
    flex-shrink: 0;
  }
  .mc-tab-detail { display: flex; flex-direction: column; gap: 6px; text-align: left; }
  .mc-tab-module-num {
    font-size: 12px;
    font-weight: 700;
    color: #1E90FF;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .mc-tab-module-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0;
    line-height: 1.3;
    color: rgba(255,255,255,0.95);
  }
  .mc-tab-module-desc { font-size: 14px; line-height: 1.7; color: rgba(255,255,255,0.55); margin: 4px 0 0; }

  /* ===== INSTANT ACCESS ===== */
  .mc-access-card {
    text-align: center;
    background: linear-gradient(135deg, rgba(30,144,255,0.05), rgba(32,178,170,0.03));
    border: 1px solid rgba(30,144,255,0.15);
    border-radius: 24px;
    padding: 40px 24px;
  }
  .mc-access-icon {
    width: 60px;
    height: 60px;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(30,144,255,0.15), rgba(32,178,170,0.1));
    display: flex;
    align-items: center;
    justify-content: center;
    color: #1E90FF;
    margin: 0 auto 20px;
  }
  .mc-access-card .mc-section-title { margin-bottom: 12px; }
  .mc-access-card .mc-section-text { margin-bottom: 28px; }
  .mc-access-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 16px 32px;
    background: #1E90FF;
    border: none;
    border-radius: 14px;
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.25s ease-in-out;
    box-shadow: 0 4px 20px rgba(30,144,255,0.25);
    letter-spacing: 0.03em;
    font-family: inherit;
  }
  .mc-access-btn:hover { background: #0C7CD5; transform: scale(1.03); }
  .mc-access-btn:active { transform: scale(0.97); }

  /* ===== TARGET AUDIENCE ===== */
  .mc-audience-grid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 8px; }
  .mc-audience-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 20px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px;
    text-align: left;
    transition: all 0.3s ease;
  }
  .mc-audience-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(30,144,255,0.15), rgba(32,178,170,0.1));
    display: flex;
    align-items: center;
    justify-content: center;
    color: #1E90FF;
    margin-bottom: 4px;
  }
  .mc-audience-card strong { font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.95); }
  .mc-audience-card span { font-size: 13px; color: rgba(255,255,255,0.45); line-height: 1.5; }

  /* ===== INSTRUCTOR ===== */
  .mc-instructor-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(30,144,255,0.15);
    border-radius: 24px;
    padding: 32px 24px;
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
    background: linear-gradient(90deg, #1E90FF, #20B2AA, #1E90FF);
    opacity: 0.7;
  }
  .mc-instructor-top { display: flex; gap: 20px; align-items: flex-start; margin-bottom: 20px; }
  .mc-instructor-img-wrap { position: relative; flex-shrink: 0; }
  .mc-instructor-img-wrap::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1E90FF, #20B2AA);
    z-index: 0;
  }
  .mc-instructor-img-wrap img {
    position: relative;
    z-index: 1;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid #0a1628;
  }
  .mc-instructor-info { display: flex; flex-direction: column; gap: 4px; text-align: left; }
  .mc-instructor-info strong { font-size: 20px; font-weight: 800; }
  .mc-instructor-role { font-size: 13px; color: #1E90FF; font-weight: 500; }
  .mc-instructor-quote {
    font-size: 13px;
    color: rgba(255,255,255,0.45);
    font-style: italic;
    margin: 8px 0 0;
    line-height: 1.5;
  }
  .mc-instructor-bio {
    font-size: 15px;
    line-height: 1.7;
    color: rgba(255,255,255,0.6);
    margin: 0 0 24px;
    text-align: left;
  }
  .mc-instructor-bio strong { color: rgba(255,255,255,0.95); }
  .mc-instructor-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .mc-istat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 16px 8px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(30,144,255,0.1);
    border-radius: 14px;
  }
  .mc-istat-item strong {
    font-size: 20px;
    font-weight: 800;
    background: linear-gradient(135deg, #1E90FF, #20B2AA);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .mc-istat-item span {
    font-size: 11px;
    color: rgba(255,255,255,0.45);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* ===== TESTIMONIALS ===== */
  .mc-testimonials-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
  .mc-testimonial-card {
    padding: 24px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 18px;
    text-align: left;
    transition: all 0.3s ease;
  }
  .mc-testimonial-stars { display: flex; gap: 2px; margin-bottom: 12px; }
  .mc-testimonial-text {
    font-size: 14px;
    line-height: 1.7;
    color: rgba(255,255,255,0.7);
    margin: 0 0 16px;
    font-style: italic;
  }
  .mc-testimonial-author { display: flex; flex-direction: column; gap: 2px; }
  .mc-testimonial-author strong { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.9); }
  .mc-testimonial-author span { font-size: 12px; color: rgba(255,255,255,0.4); }

  /* ===== FAQ ===== */
  .mc-faq-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 700px;
    margin: 0 auto;
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
    border-color: rgba(30,144,255,0.3) !important;
    background: linear-gradient(135deg, rgba(30,144,255,0.05), rgba(32,178,170,0.02)) !important;
  }
  .mc-faq-question {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    gap: 12px;
  }
  .mc-faq-question span { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.85); }
  .mc-faq-arrow { flex-shrink: 0; color: rgba(255,255,255,0.3); transition: all 0.25s ease; }
  .mc-faq-arrow-open { transform: rotate(180deg); color: #1E90FF; }
  .mc-faq-answer-wrap {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.35s ease-out;
  }
  .mc-faq-answer-wrap > p { overflow: hidden; }
  .mc-faq-answer-open { grid-template-rows: 1fr; }
  .mc-faq-answer {
    padding: 0 20px 18px;
    margin: 0;
    font-size: 14px;
    line-height: 1.7;
    color: rgba(255,255,255,0.55);
  }

  /* ===== FINAL CTA ===== */
  .mc-final-cta {
    text-align: center;
    background: linear-gradient(180deg, rgba(30,144,255,0.08) 0%, rgba(32,178,170,0.04) 40%, #0a1628 100%);
    overflow: hidden;
  }
  .mc-final-inner { position: relative; }
  .mc-float-icons { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  @keyframes floatIcon {
    0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.15; }
    50% { transform: translateY(-12px) rotate(5deg); opacity: 0.25; }
  }
  .mc-float-icon {
    position: absolute;
    color: #1E90FF;
    animation: floatIcon 4s ease-in-out infinite;
  }
  .mc-fi-1 { top: 10%; left: 8%; animation-delay: 0s; }
  .mc-fi-2 { top: 20%; right: 10%; animation-delay: 1s; }
  .mc-fi-3 { bottom: 25%; left: 12%; animation-delay: 2s; }
  .mc-fi-4 { bottom: 15%; right: 8%; animation-delay: 0.5s; }
  .mc-final-icon { color: #1E90FF; margin-bottom: 16px; position: relative; z-index: 1; }
  .mc-final-title {
    font-size: 24px;
    font-weight: 800;
    margin: 0 0 12px;
    letter-spacing: -0.02em;
    position: relative;
    z-index: 1;
  }
  .mc-final-text {
    font-size: 15px;
    line-height: 1.7;
    color: rgba(255,255,255,0.55);
    margin: 0 0 28px;
    max-width: 520px;
    margin-left: auto;
    margin-right: auto;
    position: relative;
    z-index: 1;
  }
  .mc-final-text strong { color: #f87171; }
  .mc-final-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 18px 40px;
    background: #1E90FF;
    border: none;
    border-radius: 14px;
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.25s ease-in-out;
    animation: ctaPulse 2.5s ease-in-out infinite;
    letter-spacing: 0.04em;
    font-family: inherit;
    position: relative;
    z-index: 1;
  }
  .mc-final-btn:hover { background: #0C7CD5; transform: scale(1.03); }
  .mc-final-btn:active { transform: scale(0.97); }

  /* ===== STICKY CTA (mobile) ===== */
  .mc-sticky-cta {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 12px 16px;
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
    background: rgba(10, 22, 40, 0.95);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid rgba(255,255,255,0.1);
    z-index: 100;
    transform: translateY(100%);
    transition: transform 0.3s ease;
  }
  .mc-sticky-visible { transform: translateY(0); }
  .mc-sticky-btn {
    width: 100%;
    padding: 16px;
    background: #1E90FF;
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
    box-shadow: 0 4px 20px rgba(30,144,255,0.3);
    letter-spacing: 0.02em;
    font-family: inherit;
  }
  .mc-sticky-btn:active { transform: scale(0.97); }

  /* ===== FOOTER ===== */
  .mc-footer {
    padding: 48px 20px 24px;
    border-top: 1px solid rgba(255,255,255,0.06);
    background: #0e1d35;
  }
  .mc-footer-inner {
    max-width: 900px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr;
    gap: 32px;
    padding-bottom: 32px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .mc-footer-brand img { height: 24px; opacity: 0.6; margin-bottom: 12px; }
  .mc-footer-brand p { font-size: 13px; color: rgba(255,255,255,0.35); line-height: 1.6; margin: 0; max-width: 280px; }
  .mc-footer-col { display: flex; flex-direction: column; gap: 10px; }
  .mc-footer-col strong {
    font-size: 13px;
    font-weight: 700;
    color: rgba(255,255,255,0.7);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 4px;
  }
  .mc-footer-col a { font-size: 14px; color: rgba(255,255,255,0.4); text-decoration: none; transition: color 0.2s; }
  .mc-footer-col a:hover { color: #1E90FF; }
  .mc-footer-bottom {
    max-width: 900px;
    margin: 0 auto;
    padding-top: 20px;
    padding-bottom: 60px;
    text-align: center;
  }
  .mc-footer-bottom span { font-size: 12px; color: rgba(255,255,255,0.25); }

  /* ===== TABLET (768px) ===== */
  @media (min-width: 768px) {
    .mc-hero { padding: 64px 24px 48px; }
    .mc-headline { font-size: 38px; }
    .mc-subheadline { font-size: 17px; }
    .mc-form-container { padding: 36px 32px; }
    .mc-section { padding: 56px 24px; }
    .mc-section-title { font-size: 26px; }
    .mc-audience-grid { grid-template-columns: 1fr 1fr; }
    .mc-testimonials-grid { grid-template-columns: 1fr 1fr; }
    .mc-tab-title { display: inline; }
    .mc-loss-item { gap: 20px; }
    .mc-footer-inner { grid-template-columns: 1.5fr 1fr 1fr; }
    .mc-stat-value { font-size: 32px; }
    .mc-carousel-viewport { height: 380px; }
  }

  /* ===== DESKTOP (1024px+) ===== */
  @media (min-width: 1024px) {
    .mc-header { padding: 16px 48px; }
    .mc-logo { height: 30px; }
    .mc-nav { display: flex; }
    .mc-hero { padding: 72px 48px; }
    .mc-hero-inner {
      max-width: 1100px;
      display: grid;
      grid-template-columns: 1fr 460px;
      gap: 48px;
      align-items: center;
      text-align: left;
    }
    .mc-hero-text { align-items: flex-start; }
    .mc-hero-carousel { max-width: none; width: 100%; }
    .mc-carousel-viewport { height: 420px; }
    .mc-carousel-float { display: flex; }
    .mc-slide-big-number { font-size: 48px; }
    .mc-slide-content { padding: 24px 20px; gap: 16px; }
    .mc-slide-stats-row strong { font-size: 16px; }
    .mc-slide-check { font-size: 13px; padding: 9px 14px; }
    .mc-slide-mod { padding: 10px 14px; font-size: 13px; }
    .mc-headline { font-size: 44px; }
    .mc-subheadline { font-size: 17px; }
    .mc-value-props { justify-content: flex-start; }
    .mc-stats-section { padding: 56px 48px; }
    .mc-stats-inner { max-width: 1100px; }
    .mc-stat-value { font-size: 36px; }
    .mc-stat-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.3); }
    .mc-section { padding: 72px 48px; }
    .mc-section-inner { max-width: 1100px; }
    .mc-section-title { font-size: 32px; }
    .mc-loss-example { padding: 36px; max-width: 700px; margin-left: auto; margin-right: auto; }
    .mc-tabs-bar { justify-content: center; }
    .mc-tab { padding: 14px 22px; }
    .mc-tab-content { max-width: 700px; margin-left: auto; margin-right: auto; padding: 36px; }
    .mc-tab-module-title { font-size: 20px; }
    .mc-audience-grid { grid-template-columns: 1fr 1fr; gap: 20px; max-width: 800px; margin-left: auto; margin-right: auto; }
    .mc-audience-card:hover { border-color: rgba(30,144,255,0.2); transform: translateY(-2px); }
    .mc-instructor-card { padding: 40px; max-width: 700px; margin-left: auto; margin-right: auto; }
    .mc-instructor-img-wrap img { width: 96px; height: 96px; }
    .mc-instructor-info strong { font-size: 24px; }
    .mc-instructor-role { font-size: 14px; }
    .mc-instructor-quote { font-size: 14px; }
    .mc-access-card { max-width: 700px; margin-left: auto; margin-right: auto; padding: 48px 40px; }
    .mc-testimonials-grid { grid-template-columns: 1fr 1fr; gap: 20px; max-width: 800px; margin-left: auto; margin-right: auto; }
    .mc-testimonial-card:hover { border-color: rgba(30,144,255,0.2); background: rgba(255,255,255,0.05); transform: translateY(-2px); }
    .mc-final-title { font-size: 36px; }
    .mc-sticky-cta { display: none; }
    .mc-footer { padding: 56px 48px 24px; }
    .mc-field input:hover { border-color: rgba(255,255,255,0.2); }
    .mc-faq-item:hover .mc-faq-arrow { color: rgba(255,255,255,0.5); }
  }

  /* ===== LARGE DESKTOP (1280px+) ===== */
  @media (min-width: 1280px) {
    .mc-hero { padding: 80px 48px; }
    .mc-hero-inner { max-width: 1200px; grid-template-columns: 1fr 500px; gap: 64px; }
    .mc-headline { font-size: 50px; }
    .mc-section-inner { max-width: 1200px; }
    .mc-stats-inner { max-width: 1200px; }
  }
`
