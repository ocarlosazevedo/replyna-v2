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
  ShoppingBag,
  Mail,
  MailOpen,
  Send,
  Cloud,
  ShieldCheck,
  Inbox,
  Globe,
  DollarSign,
  BookOpen,
  Target,
  ShoppingCart,
  BarChart3,
  MessageSquare,
  FileText,
  Settings,
  Award,
  Users,
  Clock,
  CreditCard,
  Calendar,
  PlayCircle,
  TrendingUp,
  X
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ==================== CONSTANTS ====================

const heroWords = ['chargebacks', 'disputas', 'bloqueios', 'prejuízos']

const statsData = [
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

// ==================== ORBIT DATA ====================

const orbitPlatforms: { name: string; color: string; Icon: React.ElementType }[] = [
  { name: 'Shopify', color: '#96bf48', Icon: ShoppingBag },
  { name: 'Gmail', color: '#EA4335', Icon: Mail },
  { name: 'Outlook', color: '#0078D4', Icon: MailOpen },
  { name: 'Yahoo', color: '#6001D2', Icon: Send },
  { name: 'iCloud', color: '#3693F3', Icon: Cloud },
  { name: 'ProtonMail', color: '#6D4AFF', Icon: ShieldCheck },
  { name: 'Zoho Mail', color: '#C8202B', Icon: Inbox },
  { name: 'AOL', color: '#31459B', Icon: Globe },
]

const orbitPositions = [
  { top: '6%',  left: '50%', sx: 250, sy: 30 },
  { top: '18%', left: '84%', sx: 420, sy: 90 },
  { top: '50%', left: '94%', sx: 470, sy: 250 },
  { top: '82%', left: '84%', sx: 420, sy: 410 },
  { top: '94%', left: '50%', sx: 250, sy: 470 },
  { top: '82%', left: '16%', sx: 80, sy: 410 },
  { top: '50%', left: '6%',  sx: 30, sy: 250 },
  { top: '18%', left: '16%', sx: 80, sy: 90 },
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
  const [showModal, setShowModal] = useState(false)
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

      supabase
        .from('masterclass_leads')
        .insert({
          name: formData.name.trim(),
          email: formData.email.toLowerCase().trim(),
          whatsapp: formData.whatsapp.replace(/\D/g, '')
        })
        .then(() => {})

      if ((window as any).fbq) {
        (window as any).fbq('track', 'Lead', {
          content_name: 'Masterclass Replyna',
        })
      }

      localStorage.setItem('masterclass_email', formData.email.toLowerCase().trim())

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

      {/* ===== HERO + ORBIT ===== */}
      <section className="mc-hero">
        <div className="mc-hero-inner">
          <div className="mc-hero-text">
            <div className="mc-social-badge">
              <span>Masterclass 100% gratuita</span>
            </div>

            <h1 className="mc-headline">
              Descubra a metodologia utilizada pelos maiores players do mercado para{' '}
              <span className="mc-rotating-word" key={heroWordIndex}>
                reduzir até 90%
              </span>
              {' '}do Chargeback
            </h1>

            <p className="mc-subheadline">
              Tenha acesso à uma masterclass completa com a metodologia detalhada utilizada para
              reduzir o chargeback e ainda manter as contas da Shopify Payments ativas.
            </p>

            <button onClick={openModal} className="mc-hero-cta">
              <Play size={20} fill="#fff" />
              QUERO ACESSO GRATUITO
            </button>

            <div className="mc-value-props">
              {valueProps.map((prop, i) => (
                <div key={i} className="mc-value-item">
                  <Check size={16} />
                  <span>{prop}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ===== ORBIT ANIMATION ===== */}
          <div className="mc-hero-visual" ref={heroRef}>
            <div className="mc-orbit-container">
              {/* SVG connecting lines and traveling dots */}
              <svg className="mc-orbit-svg" viewBox="0 0 500 500" fill="none">
                {/* Orbital track rings */}
                <ellipse cx="250" cy="250" rx="218" ry="218" stroke="rgba(30,144,255,0.06)" strokeWidth="1" strokeDasharray="4 8" />
                <ellipse cx="250" cy="250" rx="155" ry="155" stroke="rgba(32,178,170,0.04)" strokeWidth="1" strokeDasharray="3 6" />

                {/* Connecting lines from center to each platform */}
                {orbitPositions.map((pos, i) => (
                  <line key={`line-${i}`} x1="250" y1="250" x2={pos.sx} y2={pos.sy}
                    stroke={i % 2 === 0 ? 'rgba(30,144,255,0.1)' : 'rgba(32,178,170,0.08)'}
                    strokeWidth="1" />
                ))}

                {/* Cross-connections between adjacent platforms */}
                <line x1={orbitPositions[0].sx} y1={orbitPositions[0].sy} x2={orbitPositions[1].sx} y2={orbitPositions[1].sy} stroke="rgba(30,144,255,0.04)" strokeWidth="1" />
                <line x1={orbitPositions[2].sx} y1={orbitPositions[2].sy} x2={orbitPositions[3].sx} y2={orbitPositions[3].sy} stroke="rgba(32,178,170,0.04)" strokeWidth="1" />
                <line x1={orbitPositions[4].sx} y1={orbitPositions[4].sy} x2={orbitPositions[5].sx} y2={orbitPositions[5].sy} stroke="rgba(30,144,255,0.04)" strokeWidth="1" />
                <line x1={orbitPositions[6].sx} y1={orbitPositions[6].sy} x2={orbitPositions[7].sx} y2={orbitPositions[7].sy} stroke="rgba(32,178,170,0.04)" strokeWidth="1" />

                {/* Path definitions for animated dots */}
                <defs>
                  {orbitPositions.map((pos, i) => (
                    <path key={`fp-${i}`} id={`op${i}`} d={`M250,250 L${pos.sx},${pos.sy}`} />
                  ))}
                  <path id="rp1" d={`M${orbitPositions[1].sx},${orbitPositions[1].sy} L250,250`} />
                  <path id="rp4" d={`M${orbitPositions[4].sx},${orbitPositions[4].sy} L250,250`} />
                  <path id="rp6" d={`M${orbitPositions[6].sx},${orbitPositions[6].sy} L250,250`} />
                </defs>

                {/* Forward traveling dots (center → platform) */}
                <circle r="3" fill="#1E90FF">
                  <animateMotion dur="5s" repeatCount="indefinite" begin="0s"><mpath href="#op0" /></animateMotion>
                  <animate attributeName="opacity" dur="5s" repeatCount="indefinite" begin="0s" values="0;0.8;0.8;0" keyTimes="0;0.1;0.85;1" />
                </circle>
                <circle r="3" fill="#1E90FF">
                  <animateMotion dur="5.4s" repeatCount="indefinite" begin="0.7s"><mpath href="#op1" /></animateMotion>
                  <animate attributeName="opacity" dur="5.4s" repeatCount="indefinite" begin="0.7s" values="0;0.8;0.8;0" keyTimes="0;0.1;0.85;1" />
                </circle>
                <circle r="3" fill="#20B2AA">
                  <animateMotion dur="4.8s" repeatCount="indefinite" begin="1.4s"><mpath href="#op2" /></animateMotion>
                  <animate attributeName="opacity" dur="4.8s" repeatCount="indefinite" begin="1.4s" values="0;0.7;0.7;0" keyTimes="0;0.1;0.85;1" />
                </circle>
                <circle r="3" fill="#1E90FF">
                  <animateMotion dur="5.6s" repeatCount="indefinite" begin="2.1s"><mpath href="#op3" /></animateMotion>
                  <animate attributeName="opacity" dur="5.6s" repeatCount="indefinite" begin="2.1s" values="0;0.8;0.8;0" keyTimes="0;0.1;0.85;1" />
                </circle>
                <circle r="3" fill="#20B2AA">
                  <animateMotion dur="5.2s" repeatCount="indefinite" begin="2.8s"><mpath href="#op4" /></animateMotion>
                  <animate attributeName="opacity" dur="5.2s" repeatCount="indefinite" begin="2.8s" values="0;0.7;0.7;0" keyTimes="0;0.1;0.85;1" />
                </circle>
                <circle r="3" fill="#1E90FF">
                  <animateMotion dur="5.8s" repeatCount="indefinite" begin="3.5s"><mpath href="#op5" /></animateMotion>
                  <animate attributeName="opacity" dur="5.8s" repeatCount="indefinite" begin="3.5s" values="0;0.8;0.8;0" keyTimes="0;0.1;0.85;1" />
                </circle>
                <circle r="3" fill="#20B2AA">
                  <animateMotion dur="4.6s" repeatCount="indefinite" begin="4.2s"><mpath href="#op6" /></animateMotion>
                  <animate attributeName="opacity" dur="4.6s" repeatCount="indefinite" begin="4.2s" values="0;0.7;0.7;0" keyTimes="0;0.1;0.85;1" />
                </circle>
                <circle r="3" fill="#1E90FF">
                  <animateMotion dur="5.1s" repeatCount="indefinite" begin="4.9s"><mpath href="#op7" /></animateMotion>
                  <animate attributeName="opacity" dur="5.1s" repeatCount="indefinite" begin="4.9s" values="0;0.8;0.8;0" keyTimes="0;0.1;0.85;1" />
                </circle>

                {/* Reverse traveling dots (platform → center) */}
                <circle r="2.5" fill="#20B2AA">
                  <animateMotion dur="6s" repeatCount="indefinite" begin="2s"><mpath href="#rp1" /></animateMotion>
                  <animate attributeName="opacity" dur="6s" repeatCount="indefinite" begin="2s" values="0;0.6;0.6;0" keyTimes="0;0.12;0.82;1" />
                </circle>
                <circle r="2.5" fill="#1E90FF">
                  <animateMotion dur="6.5s" repeatCount="indefinite" begin="3.5s"><mpath href="#rp4" /></animateMotion>
                  <animate attributeName="opacity" dur="6.5s" repeatCount="indefinite" begin="3.5s" values="0;0.6;0.6;0" keyTimes="0;0.12;0.82;1" />
                </circle>
                <circle r="2.5" fill="#20B2AA">
                  <animateMotion dur="5.5s" repeatCount="indefinite" begin="5s"><mpath href="#rp6" /></animateMotion>
                  <animate attributeName="opacity" dur="5.5s" repeatCount="indefinite" begin="5s" values="0;0.6;0.6;0" keyTimes="0;0.12;0.82;1" />
                </circle>

                {/* Center glow */}
                <circle cx="250" cy="250" r="40" fill="url(#centerGlow)" />
                <defs>
                  <radialGradient id="centerGlow" cx="0.5" cy="0.5" r="0.5">
                    <stop offset="0%" stopColor="rgba(30,144,255,0.15)" />
                    <stop offset="100%" stopColor="rgba(30,144,255,0)" />
                  </radialGradient>
                </defs>
              </svg>

              {/* Central Replyna icon */}
              <div className="mc-orbit-center">
                <img
                  src="/Logo Replyna.png"
                  alt="Replyna"
                  style={{
                    width: 160,
                    height: 160,
                    objectFit: 'contain',
                    filter: 'brightness(0) invert(1)',
                  }}
                />
              </div>

              {/* Platform items */}
              {orbitPlatforms.map((platform, i) => (
                <div
                  key={i}
                  className={`mc-orbit-item mc-oi-${i}`}
                  style={{ top: orbitPositions[i].top, left: orbitPositions[i].left }}
                >
                  <div className="mc-orbit-inner">
                    <div className="mc-orbit-logo" style={{ background: platform.color }}>
                      <platform.Icon size={22} />
                    </div>
                    <span className="mc-orbit-label">{platform.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== HEADLINE BLOCK 2 ===== */}
      <section className="mc-section mc-fade-in" style={{ paddingTop: '60px', paddingBottom: '20px' }}>
        <div className="mc-section-inner" style={{ textAlign: 'center' }}>
          <h2 className="mc-section-title" style={{ fontSize: '36px', lineHeight: 1.3 }}>
            Dê Adeus aos Bloqueios da Shopify Payments:{' '}
            <span className="mc-highlight">Método Ultra Validado</span>{' '}
            para ZERAR os bloqueios!
          </h2>
          <p className="mc-section-text" style={{ maxWidth: '700px', margin: '20px auto 0', fontSize: '18px' }}>
            Descubra o grande segredo dos maiores players do mercado e as estratégias para manter
            as contas da Payments ativas por mais de 6 meses.
          </p>

          <div className="mc-stats-grid" style={{ marginTop: '40px' }}>
            {statsData.map((stat, i) => (
              <div key={i} className="mc-stat-card">
                <div className="mc-stat-icon">{stat.icon}</div>
                <span className="mc-stat-value">{stat.value}</span>
                <span className="mc-stat-label">{stat.label}</span>
              </div>
            ))}
          </div>

          <div className="mc-trust-row" style={{ marginTop: '30px' }}>
            {trustBadges.map((badge, i) => (
              <div key={i} className="mc-trust-badge">
                {badge.icon}
                <span>{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

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

      {/* ===== CURRICULUM (MODULES GRID) ===== */}
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

          <div className="mc-modules-grid">
            {curriculumModules.map((mod, i) => (
              <div key={i} className="mc-module-card mc-fade-in">
                <div className="mc-module-header">
                  <div className="mc-module-number">{mod.number}</div>
                  <div className="mc-module-icon">{mod.icon}</div>
                </div>
                <h3 className="mc-module-title">{mod.title}</h3>
                <p className="mc-module-desc">{mod.description}</p>
              </div>
            ))}
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
                <div className="mc-audience-left">
                  <div className="mc-audience-icon">{item.icon}</div>
                </div>
                <div className="mc-audience-right">
                  <h3 className="mc-audience-title">{item.title}</h3>
                  <p className="mc-audience-desc">{item.description}</p>
                </div>
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
            <div className="mc-instructor-hero">
              <div className="mc-instructor-img-wrap">
                <img src="/influencers/carlos-azevedo.jpg" alt="Carlos Azevedo" />
              </div>
              <div className="mc-instructor-headline">
                <h3 className="mc-instructor-name">Carlos Azevedo</h3>
                <span className="mc-instructor-role">Empresário & Especialista em E-commerce Global</span>
              </div>
            </div>

            <p className="mc-instructor-quote">
              "Minha missão é mostrar que é possível escalar sem medo de perder tudo da noite pro dia."
            </p>

            <div className="mc-instructor-divider" />

            <p className="mc-instructor-bio">
              Empresário com mais de <strong>6 anos no mercado de e-commerce global</strong>.
              Pioneiro em dropshipping global, Google Ads e Shopify Payments.
              Hoje compartilho as estratégias que uso para faturar{' '}
              <strong>+$500K/mês com margem de até 40%</strong>.
            </p>

            <div className="mc-instructor-stats">
              <div className="mc-istat-item">
                <DollarSign size={18} />
                <strong>$500K+</strong>
                <span>Faturamento/mês</span>
              </div>
              <div className="mc-istat-item">
                <Clock size={18} />
                <strong>6+ anos</strong>
                <span>No mercado</span>
              </div>
              <div className="mc-istat-item">
                <TrendingUp size={18} />
                <strong>40%</strong>
                <span>Margem</span>
              </div>
            </div>
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
                  <div className="mc-faq-answer-inner">
                    <p className="mc-faq-answer">{item.answer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="mc-section mc-final-cta mc-fade-in">
        <div className="mc-section-inner mc-final-inner">
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
        <div className="mc-footer-content">
          <img src="/Logo Replyna.png" alt="Replyna" className="mc-footer-logo" />
          <p className="mc-footer-desc">
            Proteja sua operação na Shopify Payments com o método anti-chargeback mais completo do mercado.
          </p>
          <nav className="mc-footer-links">
            <a href="#conteudo">Conteúdo</a>
            <span className="mc-footer-dot" />
            <a href="#instrutor">Instrutor</a>
            <span className="mc-footer-dot" />
            <a href="#faq">FAQ</a>
            <span className="mc-footer-dot" />
            <a href="mailto:support@replyna.com">Contato</a>
          </nav>
          <div className="mc-footer-divider" />
          <span className="mc-footer-copy">&copy; {new Date().getFullYear()} Replyna. Todos os direitos reservados.</span>
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

  /* ===== ORBIT ANIMATION ===== */
  .mc-hero-visual {
    display: none;
    width: 100%;
    max-width: 340px;
    margin: 32px auto 0;
    position: relative;
  }
  .mc-orbit-container {
    width: 100%;
    aspect-ratio: 1;
    position: relative;
  }
  .mc-orbit-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
  }
  .mc-orbit-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 3;
    width: 80px;
    height: 80px;
    border-radius: 20px;
    background: linear-gradient(135deg, #1E90FF, #20B2AA);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    box-shadow: 0 0 30px rgba(30,144,255,0.3), 0 0 60px rgba(30,144,255,0.1);
    animation: centerPulse 3s ease-in-out infinite;
  }
  @keyframes centerPulse {
    0%, 100% { box-shadow: 0 0 30px rgba(30,144,255,0.3), 0 0 60px rgba(30,144,255,0.1); }
    50% { box-shadow: 0 0 40px rgba(30,144,255,0.45), 0 0 80px rgba(30,144,255,0.15); }
  }
  .mc-orbit-item {
    position: absolute;
    z-index: 2;
    transform: translate(-50%, -50%);
  }
  .mc-orbit-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .mc-orbit-logo {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 15px;
    color: #fff;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    border: 2px solid rgba(255,255,255,0.12);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }
  .mc-orbit-logo:hover {
    transform: scale(1.12);
    box-shadow: 0 6px 28px rgba(0,0,0,0.4);
  }
  .mc-orbit-label {
    font-size: 9px;
    color: rgba(255,255,255,0.45);
    font-weight: 600;
    white-space: nowrap;
    letter-spacing: 0.02em;
  }

  /* Float animation for each orbit item */
  @keyframes orbitFloat {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-12px); }
  }
  .mc-oi-0 .mc-orbit-inner { animation: orbitFloat 4s ease-in-out infinite; animation-delay: 0s; }
  .mc-oi-1 .mc-orbit-inner { animation: orbitFloat 4.5s ease-in-out infinite; animation-delay: 0.6s; }
  .mc-oi-2 .mc-orbit-inner { animation: orbitFloat 3.8s ease-in-out infinite; animation-delay: 1.2s; }
  .mc-oi-3 .mc-orbit-inner { animation: orbitFloat 5s ease-in-out infinite; animation-delay: 0.3s; }
  .mc-oi-4 .mc-orbit-inner { animation: orbitFloat 4.2s ease-in-out infinite; animation-delay: 1.8s; }
  .mc-oi-5 .mc-orbit-inner { animation: orbitFloat 3.5s ease-in-out infinite; animation-delay: 0.9s; }
  .mc-oi-6 .mc-orbit-inner { animation: orbitFloat 4.8s ease-in-out infinite; animation-delay: 1.5s; }
  .mc-oi-7 .mc-orbit-inner { animation: orbitFloat 4.3s ease-in-out infinite; animation-delay: 2.1s; }

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
  .mc-highlight-red { color: #f59e0b; }
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
    width: 100%;
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
    margin-bottom: 28px;
    position: relative;
    box-sizing: border-box;
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
    background: linear-gradient(180deg, #0a1628 0%, #0e1d35 50%, #0a1628 100%);
    border-top: 1px solid rgba(255,255,255,0.04);
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .mc-stats-inner { max-width: 800px; margin: 0 auto; }
  .mc-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 32px;
  }
  .mc-stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 20px 8px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px;
    text-align: center;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }
  .mc-stat-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(30,144,255,0.15), rgba(32,178,170,0.1));
    color: #1E90FF;
  }
  .mc-stat-value {
    font-size: 24px;
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
  .mc-trust-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .mc-trust-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
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

  /* Section background fades */
  .mc-losses {
    background: linear-gradient(180deg, #0a1628 0%, #0d1a30 50%, #0a1628 100%);
  }
  .mc-curriculum {
    background: linear-gradient(180deg, #0a1628 0%, #0e1d35 50%, #0a1628 100%);
    padding-top: 72px;
    padding-bottom: 72px;
  }
  .mc-audience {
    background: linear-gradient(180deg, #0a1628 0%, #0d1a30 50%, #0a1628 100%);
  }
  .mc-instructor {
    background: linear-gradient(180deg, #0a1628 0%, #0e1d35 50%, #0a1628 100%);
  }
  .mc-testimonials {
    background: linear-gradient(180deg, #0a1628 0%, #0d1a30 50%, #0a1628 100%);
  }
  .mc-faq {
    background: linear-gradient(180deg, #0a1628 0%, #0e1d35 50%, #0a1628 100%);
  }

  /* ===== LOSS CALCULATOR ===== */
  .mc-loss-example {
    background: rgba(248,113,113,0.04);
    border: 1px solid rgba(248,113,113,0.15);
    border-radius: 20px;
    padding: 20px;
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
  .mc-loss-header svg { color: #f59e0b; }
  .mc-loss-grid { display: flex; flex-direction: column; gap: 14px; }
  .mc-loss-item { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .mc-loss-label { font-size: 14px; color: rgba(255,255,255,0.6); }
  .mc-loss-value { font-size: 14px; font-weight: 700; white-space: nowrap; }
  .mc-loss-red { color: #f59e0b; }
  .mc-loss-total { padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); margin-top: 4px; }
  .mc-loss-red-big {
    color: #f59e0b;
    font-size: 20px;
    font-weight: 800;
    text-shadow: 0 0 20px rgba(245,158,11,0.3);
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

  /* ===== CURRICULUM MODULES GRID ===== */
  .mc-modules-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    margin-top: 40px;
  }
  .mc-module-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 16px;
    padding: 22px;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }
  .mc-module-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: linear-gradient(180deg, #1E90FF, #20B2AA);
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  .mc-module-card:hover {
    background: rgba(255,255,255,0.05);
    border-color: rgba(30,144,255,0.2);
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(30,144,255,0.08);
  }
  .mc-module-card:hover::before { opacity: 1; }
  .mc-module-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  .mc-module-number {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: linear-gradient(135deg, #1E90FF, #20B2AA);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 800;
    color: #fff;
    flex-shrink: 0;
  }
  .mc-module-icon {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: rgba(30,144,255,0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #1E90FF;
  }
  .mc-module-title {
    font-size: 17px;
    font-weight: 700;
    color: rgba(255,255,255,0.95);
    margin: 0 0 10px;
    line-height: 1.35;
  }
  .mc-module-desc {
    font-size: 14px;
    line-height: 1.75;
    color: rgba(255,255,255,0.5);
    margin: 0;
  }

  /* ===== INSTANT ACCESS ===== */
  .mc-access-card {
    text-align: center;
    background: linear-gradient(135deg, rgba(30,144,255,0.05), rgba(32,178,170,0.03));
    border: 1px solid rgba(30,144,255,0.15);
    border-radius: 24px;
    padding: 32px 20px;
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
  .mc-audience-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    margin-top: 36px;
  }
  .mc-audience-card {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 22px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 16px;
    text-align: left;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }
  .mc-audience-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: linear-gradient(180deg, #1E90FF, #20B2AA);
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  .mc-audience-card:hover {
    background: rgba(255,255,255,0.05);
    border-color: rgba(30,144,255,0.2);
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(30,144,255,0.08);
  }
  .mc-audience-card:hover::before { opacity: 1; }
  .mc-audience-left { flex-shrink: 0; }
  .mc-audience-icon {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(30,144,255,0.15), rgba(32,178,170,0.08));
    display: flex;
    align-items: center;
    justify-content: center;
    color: #1E90FF;
  }
  .mc-audience-right { display: flex; flex-direction: column; gap: 6px; }
  .mc-audience-title {
    font-size: 17px;
    font-weight: 700;
    color: rgba(255,255,255,0.95);
    margin: 0;
    line-height: 1.3;
  }
  .mc-audience-desc {
    font-size: 14px;
    color: rgba(255,255,255,0.5);
    line-height: 1.7;
    margin: 0;
  }

  /* ===== INSTRUCTOR ===== */
  .mc-instructor-card {
    background: linear-gradient(135deg, rgba(30,144,255,0.04), rgba(32,178,170,0.02));
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 24px;
    padding: 28px 20px;
    position: relative;
    overflow: hidden;
    text-align: center;
    max-width: 640px;
    margin: 0 auto;
  }
  .mc-instructor-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, transparent, #1E90FF, #20B2AA, transparent);
  }
  .mc-instructor-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
  }
  .mc-instructor-img-wrap { position: relative; flex-shrink: 0; }
  .mc-instructor-img-wrap::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1E90FF, #20B2AA);
    z-index: 0;
  }
  .mc-instructor-img-wrap img {
    position: relative;
    z-index: 1;
    width: 100px;
    height: 100px;
    border-radius: 50%;
    object-fit: cover;
    border: 4px solid #0e1d35;
  }
  .mc-instructor-headline {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .mc-instructor-name {
    font-size: 24px;
    font-weight: 800;
    margin: 0;
    color: #fff;
  }
  .mc-instructor-role {
    font-size: 14px;
    color: #1E90FF;
    font-weight: 500;
  }
  .mc-instructor-quote {
    font-size: 15px;
    color: rgba(255,255,255,0.5);
    font-style: italic;
    margin: 0 0 0;
    line-height: 1.6;
    max-width: 460px;
    margin-left: auto;
    margin-right: auto;
  }
  .mc-instructor-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(30,144,255,0.2), transparent);
    margin: 24px 0;
  }
  .mc-instructor-bio {
    font-size: 15px;
    line-height: 1.75;
    color: rgba(255,255,255,0.6);
    margin: 0 0 28px;
    text-align: center;
  }
  .mc-instructor-bio strong { color: rgba(255,255,255,0.95); }
  .mc-instructor-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .mc-istat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 16px 6px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 16px;
    transition: all 0.3s ease;
  }
  .mc-istat-item:hover {
    border-color: rgba(30,144,255,0.2);
    background: rgba(255,255,255,0.05);
    transform: translateY(-2px);
  }
  .mc-istat-item svg {
    color: #20B2AA;
    opacity: 0.7;
  }
  .mc-istat-item strong {
    font-size: 18px;
    font-weight: 800;
    white-space: nowrap;
    background: linear-gradient(135deg, #1E90FF, #20B2AA);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .mc-istat-item span {
    font-size: 10px;
    color: rgba(255,255,255,0.45);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-weight: 600;
    text-align: center;
    line-height: 1.3;
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
    gap: 14px;
    max-width: 700px;
    margin: 0 auto;
  }
  .mc-faq-item {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  .mc-faq-item:hover {
    border-color: rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.04);
  }
  .mc-faq-open {
    border-color: rgba(30,144,255,0.25) !important;
    background: linear-gradient(135deg, rgba(30,144,255,0.06), rgba(32,178,170,0.02)) !important;
    box-shadow: 0 4px 24px rgba(30,144,255,0.06);
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
    color: rgba(255,255,255,0.9);
  }
  .mc-faq-arrow {
    flex-shrink: 0;
    color: rgba(255,255,255,0.3);
    transition: all 0.3s ease;
  }
  .mc-faq-arrow-open { transform: rotate(180deg); color: #1E90FF; }
  .mc-faq-answer-wrap {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.35s ease-out;
  }
  .mc-faq-answer-inner { overflow: hidden; }
  .mc-faq-answer-open { grid-template-rows: 1fr; }
  .mc-faq-answer {
    padding: 0 20px 18px;
    margin: 0;
    font-size: 14px;
    line-height: 1.75;
    color: rgba(255,255,255,0.55);
    border-top: 1px solid rgba(255,255,255,0.06);
    padding-top: 16px;
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
    padding: 18px 32px;
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
    padding: 56px 20px 24px;
    border-top: 1px solid rgba(255,255,255,0.06);
    background: linear-gradient(180deg, #0a1628 0%, #060d18 100%);
  }
  .mc-footer-content {
    max-width: 600px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;
  }
  .mc-footer-logo {
    height: 40px;
    width: auto;
    object-fit: contain;
    opacity: 0.8;
  }
  .mc-footer-desc {
    font-size: 14px;
    color: rgba(255,255,255,0.4);
    line-height: 1.7;
    margin: 0;
    max-width: 400px;
  }
  .mc-footer-links {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: 8px;
  }
  .mc-footer-links a {
    font-size: 14px;
    color: rgba(255,255,255,0.45);
    text-decoration: none;
    transition: color 0.2s;
    font-weight: 500;
  }
  .mc-footer-links a:hover { color: #1E90FF; }
  .mc-footer-dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
  }
  .mc-footer-divider {
    width: 100%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
    margin: 8px 0;
  }
  .mc-footer-copy {
    font-size: 12px;
    color: rgba(255,255,255,0.2);
    padding-bottom: 60px;
  }

  /* ===== TABLET (768px) ===== */
  @media (min-width: 768px) {
    .mc-hero { padding: 64px 24px 48px; }
    .mc-headline { font-size: 38px; }
    .mc-subheadline { font-size: 17px; }
    .mc-hero-cta { width: auto; font-size: 17px; }
    .mc-section { padding: 56px 24px; }
    .mc-section-title { font-size: 26px; }
    .mc-audience-grid { grid-template-columns: 1fr 1fr; }
    .mc-testimonials-grid { grid-template-columns: 1fr 1fr; }
    .mc-modules-grid { grid-template-columns: 1fr 1fr; gap: 20px; }
    .mc-module-card { padding: 28px; }
    .mc-audience-card { padding: 28px; gap: 18px; }
    .mc-instructor-card { padding: 36px 28px; }
    .mc-instructor-stats { gap: 14px; }
    .mc-istat-item { padding: 20px 12px; }
    .mc-istat-item strong { font-size: 22px; white-space: normal; }
    .mc-istat-item span { font-size: 11px; letter-spacing: 0.05em; }
    .mc-access-card { padding: 40px 24px; }
    .mc-loss-item { gap: 20px; }
    .mc-loss-example { padding: 24px; }
    .mc-faq-question { padding: 20px 24px; gap: 16px; }
    .mc-faq-question span { font-size: 15px; }
    .mc-faq-answer { padding: 0 24px 20px; }
    .mc-trust-row { gap: 12px; }
    .mc-trust-badge { padding: 8px 16px; }
    .mc-final-btn { padding: 18px 40px; }
    .mc-footer-logo { height: 48px; }
    .mc-stats-grid { gap: 16px; }
    .mc-stat-card { padding: 24px 12px; gap: 8px; }
    .mc-stat-icon { width: 44px; height: 44px; }
    .mc-stat-value { font-size: 32px; }
    .mc-hero-visual { display: block; max-width: 420px; }
    .mc-orbit-logo { width: 52px; height: 52px; font-size: 16px; }
    .mc-orbit-center { width: 72px; height: 72px; border-radius: 20px; }
    .mc-orbit-label { font-size: 10px; }
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
      grid-template-columns: 1fr 480px;
      gap: 48px;
      align-items: center;
      text-align: left;
    }
    .mc-hero-text { align-items: flex-start; }
    .mc-hero-visual { max-width: none; width: 100%; margin: 0; }
    .mc-orbit-logo { width: 56px; height: 56px; font-size: 17px; border-radius: 16px; }
    .mc-orbit-center { width: 80px; height: 80px; border-radius: 22px; }
    .mc-orbit-center svg { width: 32px; height: 32px; }
    .mc-orbit-label { font-size: 10px; }
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
    .mc-modules-grid { gap: 24px; }
    .mc-module-card { padding: 32px; }
    .mc-tab { padding: 14px 22px; }
    .mc-tab-content { max-width: 700px; margin-left: auto; margin-right: auto; padding: 36px; }
    .mc-tab-module-title { font-size: 20px; }
    .mc-audience-grid { grid-template-columns: 1fr 1fr; gap: 24px; max-width: 900px; margin-left: auto; margin-right: auto; }
    .mc-audience-card { padding: 32px; }
    .mc-instructor-card { padding: 48px 40px; }
    .mc-instructor-img-wrap img { width: 120px; height: 120px; }
    .mc-instructor-name { font-size: 28px; }
    .mc-instructor-role { font-size: 15px; }
    .mc-instructor-quote { font-size: 16px; }
    .mc-istat-item { padding: 24px 16px; }
    .mc-istat-item strong { font-size: 26px; }
    .mc-access-card { max-width: 700px; margin-left: auto; margin-right: auto; padding: 48px 40px; }
    .mc-testimonials-grid { grid-template-columns: 1fr 1fr; gap: 20px; max-width: 800px; margin-left: auto; margin-right: auto; }
    .mc-testimonial-card:hover { border-color: rgba(30,144,255,0.2); background: rgba(255,255,255,0.05); transform: translateY(-2px); }
    .mc-final-title { font-size: 36px; }
    .mc-sticky-cta { display: none; }
    .mc-footer { padding: 64px 48px 24px; }
    .mc-field input:hover { border-color: rgba(255,255,255,0.2); }
    .mc-faq-item:hover .mc-faq-arrow { color: rgba(255,255,255,0.5); }
  }

  /* ===== LARGE DESKTOP (1280px+) ===== */
  @media (min-width: 1280px) {
    .mc-hero { padding: 80px 48px; }
    .mc-hero-inner { max-width: 1200px; grid-template-columns: 1fr 520px; gap: 64px; }
    .mc-headline { font-size: 50px; }
    .mc-section-inner { max-width: 1200px; }
    .mc-stats-inner { max-width: 1200px; }
    .mc-orbit-logo { width: 60px; height: 60px; font-size: 18px; }
    .mc-orbit-center { width: 88px; height: 88px; }
    .mc-orbit-center svg { width: 36px; height: 36px; }
    .mc-orbit-label { font-size: 11px; }
  }
`
