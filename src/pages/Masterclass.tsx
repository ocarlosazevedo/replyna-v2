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
  PlayCircle
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
  const formRef = useRef<HTMLDivElement>(null)
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

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const currentModule = curriculumModules[activeModule]

  // ==================== RENDER ====================
  return (
    <div className="mc-page">
      <style>{styles}</style>

      {/* ===== HEADER ===== */}
      <header className="mc-header">
        <div className="mc-header-inner">
          <img src="/replyna-logo.webp" alt="Replyna" className="mc-logo" />
          <nav className="mc-nav">
            <a href="#conteudo" className="mc-nav-link">Conteúdo</a>
            <a href="#instrutor" className="mc-nav-link">Instrutor</a>
            <a href="#faq" className="mc-nav-link">FAQ</a>
            <button onClick={scrollToForm} className="mc-nav-cta">Acesso Gratuito</button>
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

            <button onClick={scrollToForm} className="mc-hero-cta">
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

          <div className="mc-hero-form" ref={formRef}>
            <div className="mc-form-container">
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
            <div className="mc-video-placeholder" onClick={scrollToForm}>
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
            <button onClick={scrollToForm} className="mc-access-btn">
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
                {openFaq === i && (
                  <p className="mc-faq-answer">{item.answer}</p>
                )}
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
          <button onClick={scrollToForm} className="mc-final-btn">
            <Play size={20} fill="#fff" />
            QUERO ACESSO GRATUITO
          </button>
        </div>
      </section>

      {/* ===== STICKY CTA (mobile) ===== */}
      <div className={`mc-sticky-cta ${showSticky ? 'mc-sticky-visible' : ''}`}>
        <button onClick={scrollToForm} className="mc-sticky-btn">
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

  /* Reset & Base */
  .mc-page {
    min-height: 100vh;
    min-height: 100dvh;
    background: #050508;
    color: #fff;
    font-family: "Inter", -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }

  /* ===== SCROLL FADE-IN ===== */
  .mc-fade-in {
    opacity: 0;
    transform: translateY(32px);
    transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .mc-fade-in.mc-visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* ===== HEADER ===== */
  .mc-header {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(5, 5, 8, 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }

  .mc-header-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .mc-logo {
    height: 26px;
    width: auto;
    opacity: 0.9;
  }

  .mc-nav {
    display: none;
    align-items: center;
    gap: 32px;
  }

  .mc-nav-link {
    font-size: 14px;
    color: rgba(255,255,255,0.6);
    text-decoration: none;
    font-weight: 500;
    transition: color 0.2s;
  }

  .mc-nav-link:hover {
    color: #fff;
  }

  .mc-nav-cta {
    padding: 10px 22px;
    background: linear-gradient(135deg, #4672ec 0%, #5b4dd6 100%);
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
  }

  .mc-nav-cta:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  /* ===== HERO ===== */
  .mc-hero {
    padding: 48px 20px 48px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .mc-hero::before {
    content: '';
    position: absolute;
    top: -120px;
    left: 50%;
    transform: translateX(-50%);
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(70, 114, 236, 0.12) 0%, rgba(139, 92, 246, 0.06) 40%, transparent 70%);
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
    background: radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 60%);
    pointer-events: none;
    z-index: 0;
  }

  .mc-hero-inner {
    max-width: 720px;
    margin: 0 auto;
    position: relative;
    z-index: 1;
  }

  .mc-hero-text {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .mc-hero-form {
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
  }

  /* Social proof badge */
  .mc-social-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(250, 204, 21, 0.08);
    border: 1px solid rgba(250, 204, 21, 0.2);
    padding: 8px 18px;
    border-radius: 50px;
    margin-bottom: 24px;
  }

  .mc-social-stars {
    display: flex;
    gap: 2px;
  }

  .mc-social-badge span {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.8);
  }

  /* Rotating word animation */
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
  }

  @keyframes gradientShift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }

  .mc-highlight {
    background: linear-gradient(135deg, #4672ec, #8b5cf6, #6366f1, #4672ec);
    background-size: 300% 300%;
    animation: gradientShift 4s ease infinite;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .mc-highlight-red {
    color: #f87171;
  }

  .mc-subheadline {
    font-size: 16px;
    color: rgba(255,255,255,0.6);
    margin: 0 0 28px;
    line-height: 1.7;
  }

  @keyframes ctaPulse {
    0%, 100% { box-shadow: 0 4px 24px rgba(70, 114, 236, 0.3); }
    50% { box-shadow: 0 4px 40px rgba(70, 114, 236, 0.5), 0 0 60px rgba(139, 92, 246, 0.15); }
  }

  .mc-hero-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 18px 40px;
    background: linear-gradient(135deg, #4672ec 0%, #5b4dd6 100%);
    border: none;
    border-radius: 14px;
    color: #fff;
    font-size: 17px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.25s;
    animation: ctaPulse 2.5s ease-in-out infinite;
    letter-spacing: 0.04em;
    font-family: inherit;
    margin-bottom: 28px;
    position: relative;
  }

  .mc-hero-cta:active {
    transform: scale(0.97);
    animation: none;
  }

  /* Value Props */
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

  .mc-value-item svg {
    color: #4ade80;
    flex-shrink: 0;
  }

  /* ===== FORM ===== */
  .mc-form-container {
    max-width: 480px;
    margin: 0 auto;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(70, 114, 236, 0.2);
    border-radius: 24px;
    padding: 32px 24px;
    position: relative;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 8px 40px rgba(70, 114, 236, 0.08), 0 0 80px rgba(139, 92, 246, 0.04);
  }

  .mc-form-header {
    text-align: center;
    margin-bottom: 20px;
  }

  .mc-form-title {
    font-size: 20px;
    font-weight: 700;
    margin: 0 0 6px;
  }

  .mc-form-subtitle {
    font-size: 14px;
    color: rgba(255,255,255,0.5);
    margin: 0;
  }

  /* Countdown */
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
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
    animation: livePulse 1.5s ease-in-out infinite;
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

  .mc-countdown-sep {
    font-size: 20px;
    font-weight: 700;
    color: rgba(255,255,255,0.2);
    margin-bottom: 14px;
  }

  /* Form */
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
    font-family: inherit;
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
    animation: ctaPulse 2.5s ease-in-out infinite;
    letter-spacing: 0.02em;
    font-family: inherit;
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

  /* ===== STATS + TRUST BADGES ===== */
  .mc-stats-section {
    padding: 48px 20px;
    background: #0a0a14;
    border-top: 1px solid rgba(255,255,255,0.04);
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }

  .mc-stats-inner {
    max-width: 800px;
    margin: 0 auto;
  }

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
  }

  .mc-stat-icon {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(70, 114, 236, 0.15), rgba(139, 92, 246, 0.1));
    color: #818cf8;
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

  .mc-trust-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }

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

  .mc-trust-badge svg {
    color: #4ade80;
    flex-shrink: 0;
  }

  /* ===== VIDEO SECTION ===== */
  .mc-video-section .mc-section-inner {
    max-width: 800px;
  }

  .mc-video-wrap {
    position: relative;
    width: 100%;
    padding-bottom: 56.25%;
    border-radius: 20px;
    overflow: hidden;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(70, 114, 236, 0.2);
    box-shadow: 0 8px 40px rgba(70, 114, 236, 0.08);
  }

  .mc-video-wrap iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
  }

  .mc-video-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 64px 24px;
    background: linear-gradient(135deg, rgba(70, 114, 236, 0.06), rgba(139, 92, 246, 0.04));
    border: 1px solid rgba(70, 114, 236, 0.2);
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 8px 40px rgba(70, 114, 236, 0.08);
  }

  .mc-video-placeholder:hover {
    border-color: rgba(70, 114, 236, 0.35);
    background: linear-gradient(135deg, rgba(70, 114, 236, 0.1), rgba(139, 92, 246, 0.06));
  }

  .mc-video-placeholder svg {
    color: #818cf8;
    opacity: 0.7;
  }

  .mc-video-placeholder span {
    font-size: 15px;
    color: rgba(255,255,255,0.5);
    font-weight: 500;
  }

  /* ===== SECTIONS (shared) ===== */
  .mc-section {
    padding: 48px 20px;
    border-top: 1px solid rgba(255,255,255,0.04);
    position: relative;
  }

  .mc-section-inner {
    max-width: 800px;
    margin: 0 auto;
  }

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

  .mc-text-center {
    text-align: center;
  }

  /* ===== LOSS CALCULATOR ===== */
  .mc-loss-example {
    background: rgba(248, 113, 113, 0.04);
    border: 1px solid rgba(248, 113, 113, 0.15);
    border-radius: 20px;
    padding: 24px;
    margin-top: 8px;
    box-shadow: 0 8px 40px rgba(248, 113, 113, 0.06), inset 0 1px 0 rgba(248, 113, 113, 0.08);
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

  .mc-loss-header svg {
    color: #f87171;
  }

  .mc-loss-grid {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .mc-loss-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .mc-loss-label {
    font-size: 14px;
    color: rgba(255,255,255,0.6);
  }

  .mc-loss-value {
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
  }

  .mc-loss-red {
    color: #f87171;
  }

  .mc-loss-total {
    padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.08);
    margin-top: 4px;
  }

  .mc-loss-red-big {
    color: #ef4444;
    font-size: 20px;
    font-weight: 800;
    text-shadow: 0 0 20px rgba(239, 68, 68, 0.3);
  }

  .mc-loss-footer {
    font-size: 13px;
    line-height: 1.7;
    color: rgba(255,255,255,0.5);
    margin: 20px 0 0;
    padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .mc-loss-footer strong {
    color: #f87171;
  }

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

  .mc-tabs-bar::-webkit-scrollbar {
    display: none;
  }

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

  .mc-tab:hover {
    border-color: rgba(255,255,255,0.15);
    color: rgba(255,255,255,0.7);
  }

  .mc-tab-active {
    background: linear-gradient(135deg, rgba(70, 114, 236, 0.12), rgba(139, 92, 246, 0.08));
    border-color: rgba(70, 114, 236, 0.3);
    color: #fff;
  }

  .mc-tab-num {
    font-weight: 800;
    color: #818cf8;
    font-size: 12px;
  }

  .mc-tab-active .mc-tab-num {
    color: #a78bfa;
  }

  .mc-tab-title {
    display: none;
  }

  .mc-tab-content {
    display: flex;
    gap: 20px;
    align-items: flex-start;
    padding: 28px;
    background: linear-gradient(135deg, rgba(70, 114, 236, 0.06), rgba(139, 92, 246, 0.03));
    border: 1px solid rgba(70, 114, 236, 0.15);
    border-radius: 20px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .mc-tab-icon-wrap {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(70, 114, 236, 0.2), rgba(139, 92, 246, 0.15));
    display: flex;
    align-items: center;
    justify-content: center;
    color: #818cf8;
    flex-shrink: 0;
  }

  .mc-tab-detail {
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: left;
  }

  .mc-tab-module-num {
    font-size: 12px;
    font-weight: 700;
    color: #818cf8;
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

  .mc-tab-module-desc {
    font-size: 14px;
    line-height: 1.7;
    color: rgba(255,255,255,0.55);
    margin: 4px 0 0;
  }

  /* ===== INSTANT ACCESS ===== */
  .mc-access-card {
    text-align: center;
    background: linear-gradient(135deg, rgba(70, 114, 236, 0.06), rgba(139, 92, 246, 0.04));
    border: 1px solid rgba(70, 114, 236, 0.15);
    border-radius: 24px;
    padding: 40px 24px;
  }

  .mc-access-icon {
    width: 60px;
    height: 60px;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(70, 114, 236, 0.2), rgba(139, 92, 246, 0.15));
    display: flex;
    align-items: center;
    justify-content: center;
    color: #818cf8;
    margin: 0 auto 20px;
  }

  .mc-access-card .mc-section-title {
    margin-bottom: 12px;
  }

  .mc-access-card .mc-section-text {
    margin-bottom: 28px;
  }

  .mc-access-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 16px 32px;
    background: linear-gradient(135deg, #4672ec 0%, #5b4dd6 100%);
    border: none;
    border-radius: 14px;
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.25s;
    box-shadow: 0 4px 20px rgba(70, 114, 236, 0.25);
    letter-spacing: 0.03em;
    font-family: inherit;
  }

  .mc-access-btn:active {
    transform: scale(0.97);
  }

  /* ===== TARGET AUDIENCE ===== */
  .mc-audience-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    margin-top: 8px;
  }

  .mc-audience-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 20px;
    background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(70, 114, 236, 0.02) 100%);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px;
    text-align: left;
    transition: all 0.3s ease;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .mc-audience-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(70, 114, 236, 0.15), rgba(139, 92, 246, 0.1));
    display: flex;
    align-items: center;
    justify-content: center;
    color: #818cf8;
    margin-bottom: 4px;
  }

  .mc-audience-card strong {
    font-size: 15px;
    font-weight: 600;
    color: rgba(255,255,255,0.95);
  }

  .mc-audience-card span {
    font-size: 13px;
    color: rgba(255,255,255,0.45);
    line-height: 1.5;
  }

  /* ===== INSTRUCTOR ===== */
  .mc-instructor-card {
    background: linear-gradient(135deg, rgba(70, 114, 236, 0.06), rgba(139, 92, 246, 0.04));
    border: 1px solid rgba(70, 114, 236, 0.15);
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
    background: linear-gradient(90deg, #4672ec, #8b5cf6, #4672ec);
    opacity: 0.7;
  }

  .mc-instructor-top {
    display: flex;
    gap: 20px;
    align-items: flex-start;
    margin-bottom: 20px;
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
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid #0a0a0f;
  }

  .mc-instructor-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
  }

  .mc-instructor-info strong {
    font-size: 20px;
    font-weight: 800;
  }

  .mc-instructor-role {
    font-size: 13px;
    color: #818cf8;
    font-weight: 500;
  }

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

  .mc-instructor-bio strong {
    color: rgba(255,255,255,0.95);
  }

  .mc-instructor-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .mc-istat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 16px 8px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(70, 114, 236, 0.1);
    border-radius: 14px;
  }

  .mc-istat-item strong {
    font-size: 20px;
    font-weight: 800;
    background: linear-gradient(135deg, #4672ec, #a78bfa);
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
  .mc-testimonials-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .mc-testimonial-card {
    padding: 24px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 18px;
    text-align: left;
    transition: all 0.3s ease;
  }

  .mc-testimonial-stars {
    display: flex;
    gap: 2px;
    margin-bottom: 12px;
  }

  .mc-testimonial-text {
    font-size: 14px;
    line-height: 1.7;
    color: rgba(255,255,255,0.7);
    margin: 0 0 16px;
    font-style: italic;
  }

  .mc-testimonial-author {
    display: flex;
    flex-direction: column;
    gap: 2px;
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

  /* ===== FINAL CTA ===== */
  .mc-final-cta {
    text-align: center;
    background: linear-gradient(180deg, rgba(70, 114, 236, 0.1) 0%, rgba(139, 92, 246, 0.06) 40%, rgba(70, 114, 236, 0.03) 100%);
    overflow: hidden;
  }

  .mc-final-inner {
    position: relative;
  }

  .mc-float-icons {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }

  @keyframes floatIcon {
    0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.15; }
    50% { transform: translateY(-12px) rotate(5deg); opacity: 0.25; }
  }

  .mc-float-icon {
    position: absolute;
    color: #818cf8;
    animation: floatIcon 4s ease-in-out infinite;
  }

  .mc-fi-1 { top: 10%; left: 8%; animation-delay: 0s; }
  .mc-fi-2 { top: 20%; right: 10%; animation-delay: 1s; }
  .mc-fi-3 { bottom: 25%; left: 12%; animation-delay: 2s; }
  .mc-fi-4 { bottom: 15%; right: 8%; animation-delay: 0.5s; }

  .mc-final-icon {
    color: #818cf8;
    margin-bottom: 16px;
    position: relative;
    z-index: 1;
  }

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

  .mc-final-text strong {
    color: #f87171;
  }

  .mc-final-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 18px 40px;
    background: linear-gradient(135deg, #4672ec 0%, #5b4dd6 100%);
    border: none;
    border-radius: 14px;
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.25s;
    animation: ctaPulse 2.5s ease-in-out infinite;
    letter-spacing: 0.04em;
    font-family: inherit;
    position: relative;
    z-index: 1;
  }

  .mc-final-btn:active {
    transform: scale(0.97);
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
    font-family: inherit;
  }

  .mc-sticky-btn:active {
    transform: scale(0.97);
  }

  /* ===== FOOTER ===== */
  .mc-footer {
    padding: 48px 20px 24px;
    border-top: 1px solid rgba(255,255,255,0.06);
    background: #0a0a14;
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

  .mc-footer-brand img {
    height: 24px;
    opacity: 0.6;
    margin-bottom: 12px;
  }

  .mc-footer-brand p {
    font-size: 13px;
    color: rgba(255,255,255,0.35);
    line-height: 1.6;
    margin: 0;
    max-width: 280px;
  }

  .mc-footer-col {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .mc-footer-col strong {
    font-size: 13px;
    font-weight: 700;
    color: rgba(255,255,255,0.7);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 4px;
  }

  .mc-footer-col a {
    font-size: 14px;
    color: rgba(255,255,255,0.4);
    text-decoration: none;
    transition: color 0.2s;
  }

  .mc-footer-col a:hover {
    color: rgba(255,255,255,0.7);
  }

  .mc-footer-bottom {
    max-width: 900px;
    margin: 0 auto;
    padding-top: 20px;
    padding-bottom: calc(60px);
    text-align: center;
  }

  .mc-footer-bottom span {
    font-size: 12px;
    color: rgba(255,255,255,0.25);
  }

  /* ===== TABLET (768px) ===== */
  @media (min-width: 768px) {
    .mc-hero {
      padding: 64px 24px 48px;
    }

    .mc-headline {
      font-size: 38px;
    }

    .mc-subheadline {
      font-size: 17px;
    }

    .mc-form-container {
      padding: 36px 32px;
    }

    .mc-section {
      padding: 56px 24px;
    }

    .mc-section-title {
      font-size: 26px;
    }

    .mc-audience-grid {
      grid-template-columns: 1fr 1fr;
    }

    .mc-testimonials-grid {
      grid-template-columns: 1fr 1fr;
    }

    .mc-tab-title {
      display: inline;
    }

    .mc-loss-item {
      gap: 20px;
    }

    .mc-footer-inner {
      grid-template-columns: 1.5fr 1fr 1fr;
    }

    .mc-stat-value {
      font-size: 32px;
    }
  }

  /* ===== DESKTOP (1024px+) ===== */
  @media (min-width: 1024px) {
    .mc-header {
      padding: 16px 48px;
    }

    .mc-logo {
      height: 30px;
    }

    .mc-nav {
      display: flex;
    }

    /* Hero: 2 colunas (texto + form lado a lado) */
    .mc-hero {
      padding: 72px 48px;
    }

    .mc-hero-inner {
      max-width: 1100px;
      display: grid;
      grid-template-columns: 1fr 440px;
      gap: 48px;
      align-items: center;
      text-align: left;
    }

    .mc-hero-text {
      align-items: flex-start;
    }

    .mc-hero-form {
      max-width: none;
      width: 100%;
    }

    .mc-headline {
      font-size: 44px;
    }

    .mc-subheadline {
      font-size: 17px;
    }

    .mc-value-props {
      justify-content: flex-start;
    }

    .mc-hero-cta:hover {
      background: linear-gradient(135deg, #3b5fd9 0%, #4a3dc0 100%);
      box-shadow: 0 8px 28px rgba(70, 114, 236, 0.35);
      transform: translateY(-1px);
    }

    .mc-form-container {
      max-width: none;
      padding: 36px 32px;
    }

    /* Stats */
    .mc-stats-section {
      padding: 56px 48px;
    }

    .mc-stats-inner {
      max-width: 1100px;
    }

    .mc-stat-value {
      font-size: 36px;
    }

    /* Sections */
    .mc-section {
      padding: 72px 48px;
    }

    .mc-section-inner {
      max-width: 1100px;
    }

    .mc-section-title {
      font-size: 32px;
    }

    /* Loss calculator */
    .mc-loss-example {
      padding: 36px;
      max-width: 700px;
      margin-left: auto;
      margin-right: auto;
    }

    /* Curriculum tabs */
    .mc-tabs-bar {
      justify-content: center;
    }

    .mc-tab {
      padding: 14px 22px;
    }

    .mc-tab-content {
      max-width: 700px;
      margin-left: auto;
      margin-right: auto;
      padding: 36px;
    }

    .mc-tab-module-title {
      font-size: 20px;
    }

    /* Audience: 2x2 grid */
    .mc-audience-grid {
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      max-width: 800px;
      margin-left: auto;
      margin-right: auto;
    }

    .mc-audience-card:hover {
      border-color: rgba(70, 114, 236, 0.2);
    }

    /* Instructor */
    .mc-instructor-card {
      padding: 40px;
      max-width: 700px;
      margin-left: auto;
      margin-right: auto;
    }

    .mc-instructor-img-wrap img {
      width: 96px;
      height: 96px;
    }

    .mc-instructor-info strong {
      font-size: 24px;
    }

    .mc-instructor-role {
      font-size: 14px;
    }

    .mc-instructor-quote {
      font-size: 14px;
    }

    /* Access card */
    .mc-access-card {
      max-width: 700px;
      margin-left: auto;
      margin-right: auto;
      padding: 48px 40px;
    }

    /* Testimonials */
    .mc-testimonials-grid {
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      max-width: 800px;
      margin-left: auto;
      margin-right: auto;
    }

    .mc-testimonial-card:hover {
      border-color: rgba(70, 114, 236, 0.2);
      background: rgba(255,255,255,0.05);
    }

    /* Final CTA */
    .mc-final-title {
      font-size: 36px;
    }

    .mc-final-btn:hover {
      background: linear-gradient(135deg, #3b5fd9 0%, #4a3dc0 100%);
      box-shadow: 0 8px 28px rgba(70, 114, 236, 0.35);
      transform: translateY(-1px);
    }

    .mc-access-btn:hover {
      background: linear-gradient(135deg, #3b5fd9 0%, #4a3dc0 100%);
      box-shadow: 0 8px 24px rgba(70, 114, 236, 0.3);
      transform: translateY(-1px);
    }

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

    .mc-faq-item:hover .mc-faq-arrow {
      color: rgba(255,255,255,0.5);
    }

    .mc-sticky-cta {
      display: none;
    }

    .mc-footer {
      padding: 56px 48px 24px;
    }
  }

  /* ===== LARGE DESKTOP (1280px+) ===== */
  @media (min-width: 1280px) {
    .mc-hero {
      padding: 80px 48px;
    }

    .mc-hero-inner {
      max-width: 1200px;
      grid-template-columns: 1fr 480px;
      gap: 64px;
    }

    .mc-headline {
      font-size: 50px;
    }

    .mc-section-inner {
      max-width: 1200px;
    }

    .mc-stats-inner {
      max-width: 1200px;
    }
  }
`
