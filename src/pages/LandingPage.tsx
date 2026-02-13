import { useState, useEffect, useRef } from 'react'
import {
  Shield,
  Zap,
  Bot,
  Clock,
  TrendingUp,
  MessageSquare,
  CheckCircle2,
  ChevronDown,
  Mail,
  ArrowRight,
  Star,
  CreditCard,
  Store,
  Check,
  MessageCircle,
  Instagram,
  Menu,
  X,
  Play,
  Sparkles
} from 'lucide-react'

// URL base do app (para links de login/register)
const getAppUrl = (path: string) => {
  // Em produção, sempre usar app.replyna.me
  // Em desenvolvimento (localhost), usar caminho relativo
  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return path
  }
  return `https://app.replyna.me${path}`
}

// Dados dos planos
const plans = [
  {
    name: 'Starter',
    description: 'Ideal para quem está começando',
    price: 197,
    emails: 300,
    shops: 1,
    extraPrice: 'R$1,00',
    popular: false,
    features: [
      'Integração com 1 loja',
      '300 e-mails/mês inclusos',
      'R$1,00 por email extra',
      'Atendimento 24 horas por dia',
    ],
  },
  {
    name: 'Business',
    description: 'Para operações em crescimento',
    price: 397,
    emails: 900,
    shops: 3,
    extraPrice: 'R$0,70',
    popular: true,
    features: [
      'Integração com 3 lojas',
      '900 e-mails/mês inclusos',
      'R$0,70 por e-mail extra',
      'Atendimento 24 horas por dia',
    ],
  },
  {
    name: 'Scale',
    description: 'Escale sem limites',
    price: 597,
    emails: 1500,
    shops: 5,
    extraPrice: 'R$0,60',
    popular: false,
    features: [
      'Integração com 5 lojas',
      '1.500 e-mails/mês inclusos',
      'R$0,60 por email extra',
      'Atendimento 24 horas por dia',
    ],
  },
  {
    name: 'High Scale',
    description: 'Para grandes operações',
    price: 997,
    emails: 3000,
    shops: 10,
    extraPrice: 'R$0,50',
    popular: false,
    features: [
      'Integração com 10 lojas',
      '3.000 e-mails/mês inclusos',
      'R$0,50 por email extra',
      'Atendimento 24 horas por dia',
    ],
  },
  {
    name: 'Enterprise',
    description: 'Solução personalizada',
    price: 1497,
    emails: 'Ilimitado',
    shops: 'Ilimitado',
    extraPrice: 'Incluso',
    popular: false,
    features: [
      'Lojas ilimitadas',
      'Emails ilimitados',
      'Sem custo extra por email',
      'Atendimento 24 horas por dia',
    ],
    isEnterprise: true,
  },
]

// Dados dos influenciadores
const influencers = [
  {
    name: 'Carlos Azevedo',
    role: 'Mentor de +1.000 alunos em Dropshipping Global. Referência em operações internacionais e escala de e-commerce.',
    image: '/influencers/carlos-azevedo.webp',
    instagram: 'https://www.instagram.com/ocarlosazevedo/',
  },
  {
    name: 'Lhucas Maciel',
    role: 'Especialista em Dropshipping Global com foco em estratégias de crescimento acelerado e alta performance.',
    image: '/influencers/lhucas-maciel.webp',
    instagram: 'https://www.instagram.com/lhucas_maciel/',
  },
  {
    name: 'Guilherme Smith',
    role: 'Mentor e gestor de múltiplas operações de Dropshipping Global. Expert em vendas e conversão.',
    image: '/influencers/guilherme-smith.webp',
    instagram: 'https://www.instagram.com/oguilhermesmith/',
  },
]

// Depoimentos
const testimonials = [
  {
    text: 'Antes da Replyna eu tinha 3-4 chargebacks por semana. Agora tenho menos de 1 por mês. Salvou minha conta no Shopify Payments.',
    name: 'Ricardo M.',
    role: 'Dropshipper, São Paulo',
  },
  {
    text: 'A IA responde melhor que meus funcionários respondiam. Os clientes ficam satisfeitos e eu durmo tranquilo.',
    name: 'Ana Paula S.',
    role: 'E-commerce de moda',
  },
  {
    text: 'ROI absurdo. Em um mês a Replyna evitou pelo menos 5 chargebacks que me custariam R$2.000+ cada.',
    name: 'Fernando L.',
    role: 'Múltiplas lojas',
  },
  {
    text: 'Minha taxa de chargeback caiu de 2.1% para 0.3%. O Shopify Payments parou de me ameaçar.',
    name: 'Marcos T.',
    role: 'Dropshipping Global',
  },
  {
    text: 'Configurei em 15 minutos e já no primeiro dia a IA respondeu 47 emails. Impressionante.',
    name: 'Juliana R.',
    role: 'Loja de acessórios',
  },
  {
    text: 'Tentei contratar atendentes mas ninguém respondia tão rápido quanto a Replyna. Melhor investimento.',
    name: 'Pedro H.',
    role: 'E-commerce de eletrônicos',
  },
]

// FAQ
const faqs = [
  {
    question: 'Como a Replyna reduz chargebacks em até 90%?',
    answer: 'A Replyna usa inteligência artificial para responder automaticamente emails de clientes insatisfeitos antes que eles abram disputas. Quando o cliente recebe uma resposta rápida e eficiente oferecendo solução, a maioria desiste de abrir chargeback.',
  },
  {
    question: 'A Replyna funciona com Shopify Payments?',
    answer: 'Sim! A Replyna foi desenvolvida especialmente para lojas que usam Shopify Payments. Reduzindo chargebacks, você mantém sua conta ativa e evita o risco de ter o Shopify Payments desabilitado.',
  },
  {
    question: 'Quanto tempo leva para configurar?',
    answer: 'A configuração é simples e leva cerca de 10 minutos. Basta conectar sua loja Shopify, configurar seu email e a IA já começa a responder automaticamente.',
  },
  {
    question: 'A IA responde qualquer tipo de email?',
    answer: 'A Replyna classifica automaticamente os emails em categorias como "Onde está meu pedido?", "Quero cancelar", "Produto com defeito", etc. Para cada categoria, ela gera respostas personalizadas e contextualizadas.',
  },
  {
    question: 'E se eu quiser revisar as respostas antes de enviar?',
    answer: 'Você pode configurar o modo de aprovação manual, onde todas as respostas passam por você antes de serem enviadas. Assim você mantém controle total sobre a comunicação.',
  },
  {
    question: 'Posso usar em lojas de dropshipping internacional?',
    answer: 'Sim! A Replyna é perfeita para dropshipping global. Ela responde em português, inglês e outros idiomas, e sabe lidar com prazos de entrega mais longos típicos do dropshipping.',
  },
]

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const heroRef = useRef<HTMLElement>(null)

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
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Mouse parallax effect for hero
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width
        const y = (e.clientY - rect.top) / rect.height
        setMousePosition({ x, y })
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // Bloquear scroll quando menu mobile está aberto
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault()
    setMobileMenuOpen(false)
    const element = document.getElementById(targetId)
    if (element) {
      const headerOffset = 80
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(price)
  }

  return (
    <div className="lp-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

        .lp-container {
          min-height: 100vh;
          background-color: #050508;
          color: #ffffff;
          font-family: "Inter", "Manrope", "Segoe UI", sans-serif;
          overflow-x: hidden;
        }

        /* Gradient Orbs */
        .lp-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.6;
          pointer-events: none;
        }
        .lp-orb-1 {
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(70, 114, 236, 0.4) 0%, transparent 70%);
          top: -200px;
          left: -200px;
          animation: orbFloat1 20s ease-in-out infinite;
        }
        .lp-orb-2 {
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%);
          top: 30%;
          right: -150px;
          animation: orbFloat2 25s ease-in-out infinite;
        }
        .lp-orb-3 {
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(6, 182, 212, 0.25) 0%, transparent 70%);
          bottom: 10%;
          left: 10%;
          animation: orbFloat3 18s ease-in-out infinite;
        }
        @keyframes orbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(50px, 30px) scale(1.1); }
          66% { transform: translate(-30px, 50px) scale(0.95); }
        }
        @keyframes orbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-60px, -40px) scale(1.15); }
        }
        @keyframes orbFloat3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(40px, -30px); }
        }

        /* Noise Texture Overlay */
        .lp-noise {
          position: fixed;
          inset: 0;
          opacity: 0.03;
          pointer-events: none;
          z-index: 1000;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }

        /* Grid Pattern */
        .lp-grid-pattern {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 80px 80px;
          mask-image: linear-gradient(to bottom, black 0%, black 85%, transparent 100%);
          z-index: 0;
        }

        /* Fade In Animation */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .lp-fade-in {
          animation: fadeInUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .lp-fade-in-delay-1 { animation-delay: 0.1s; opacity: 0; }
        .lp-fade-in-delay-2 { animation-delay: 0.2s; opacity: 0; }
        .lp-fade-in-delay-3 { animation-delay: 0.35s; opacity: 0; }
        .lp-fade-in-delay-4 { animation-delay: 0.5s; opacity: 0; }
        .lp-fade-in-delay-5 { animation-delay: 0.65s; opacity: 0; }

        /* Glow Effects */
        .lp-glow-blue {
          box-shadow: 0 0 80px rgba(70, 114, 236, 0.25), 0 0 160px rgba(70, 114, 236, 0.1);
        }
        .lp-glow-text {
          text-shadow: 0 0 60px rgba(70, 114, 236, 0.6), 0 0 120px rgba(70, 114, 236, 0.3);
        }

        /* Glassmorphism Card */
        .lp-glass {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        /* Card with Shine Effect */
        .lp-card-shine {
          position: relative;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lp-card-shine::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.05),
            transparent
          );
          transition: left 0.6s ease;
        }
        .lp-card-shine:hover::before {
          left: 100%;
        }
        .lp-card-shine:hover {
          transform: translateY(-8px);
          border-color: rgba(70, 114, 236, 0.3);
          box-shadow: 0 25px 50px rgba(0,0,0,0.4), 0 0 60px rgba(70, 114, 236, 0.15);
        }

        /* Gradient Border Card */
        .lp-gradient-border {
          position: relative;
          background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%);
          border-radius: 20px;
        }
        .lp-gradient-border::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 20px;
          padding: 1px;
          background: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.02) 100%);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: exclude;
          -webkit-mask-composite: xor;
          pointer-events: none;
        }

        /* Primary Button */
        .lp-btn-primary {
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          background: linear-gradient(135deg, #4672ec 0%, #3b5fd9 100%);
        }
        .lp-btn-primary::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .lp-btn-primary:hover::before {
          opacity: 1;
        }
        .lp-btn-primary:hover {
          transform: translateY(-3px);
          box-shadow: 0 15px 40px rgba(70, 114, 236, 0.4), 0 0 20px rgba(70, 114, 236, 0.3);
        }

        /* Secondary Button */
        .lp-btn-secondary {
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .lp-btn-secondary:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.2);
          transform: translateY(-2px);
        }

        /* Animated Badge */
        .lp-badge {
          position: relative;
          overflow: hidden;
        }
        .lp-badge::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            45deg,
            transparent 40%,
            rgba(255,255,255,0.1) 50%,
            transparent 60%
          );
          animation: badgeShine 3s ease-in-out infinite;
        }
        @keyframes badgeShine {
          0%, 100% { transform: translateX(-100%) rotate(45deg); }
          50% { transform: translateX(100%) rotate(45deg); }
        }

        /* Number Counter Animation */
        .lp-number {
          background: linear-gradient(135deg, #4672ec 0%, #8b5cf6 50%, #06b6d4 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Header Mobile Menu */
        .lp-nav-desktop {
          display: flex;
          gap: 32px;
          align-items: center;
        }
        .lp-nav-mobile-toggle {
          display: none;
          background: none;
          border: none;
          color: #fff;
          cursor: pointer;
          padding: 8px;
        }
        .lp-nav-link {
          color: rgba(255,255,255,0.6);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s ease;
          position: relative;
        }
        .lp-nav-link:hover {
          color: #fff;
        }
        .lp-nav-link::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 0;
          height: 2px;
          background: linear-gradient(90deg, #4672ec, #8b5cf6);
          transition: width 0.3s ease;
        }
        .lp-nav-link:hover::after {
          width: 100%;
        }

        /* Stats Grid */
        .lp-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          max-width: 700px;
          margin: 48px auto 0;
        }

        /* Problem/Solution Grid */
        .lp-problem-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          align-items: stretch;
        }

        /* Steps Grid */
        .lp-steps-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }

        /* Benefits Grid */
        .lp-benefits-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        /* Influencers Grid */
        .lp-influencers-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        /* Plans Grid */
        .lp-plans-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 20px;
          align-items: stretch;
        }
        .lp-plans-grid > * {
          display: flex;
          flex-direction: column;
        }

        /* Testimonials Grid for Mobile */
        .lp-testimonials-grid {
          display: none;
        }

        /* Carousel Animation */
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .testimonial-carousel {
          display: flex;
          gap: 24px;
          animation: scroll 40s linear infinite;
        }
        .testimonial-carousel:hover {
          animation-play-state: paused;
        }

        /* Floating Elements */
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        .lp-float {
          animation: float 5s ease-in-out infinite;
        }

        /* Pulse Ring Animation */
        @keyframes pulseRing {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .lp-pulse-ring {
          position: relative;
        }
        .lp-pulse-ring::before,
        .lp-pulse-ring::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid rgba(70, 114, 236, 0.3);
        }
        .lp-pulse-ring::before {
          animation: pulseRing 2s ease-out infinite;
        }
        .lp-pulse-ring::after {
          animation: pulseRing 2s ease-out infinite 1s;
        }

        /* WhatsApp Floating Button */
        @keyframes whatsappPulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2); opacity: 0; }
        }
        .lp-whatsapp-btn {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background-color: #25D366;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
          cursor: pointer;
          z-index: 999;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          text-decoration: none;
        }
        .lp-whatsapp-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
        }
        .lp-whatsapp-btn::before,
        .lp-whatsapp-btn::after {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background-color: #25D366;
          animation: whatsappPulse 2s ease-out infinite;
          z-index: -1;
        }
        .lp-whatsapp-btn::after {
          animation-delay: 1s;
        }
        .lp-whatsapp-tooltip {
          position: absolute;
          right: 68px;
          background: #fff;
          color: #1a1a2e;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          opacity: 0;
          pointer-events: none;
          transform: translateX(8px);
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .lp-whatsapp-tooltip::after {
          content: '';
          position: absolute;
          right: -6px;
          top: 50%;
          transform: translateY(-50%);
          border: 6px solid transparent;
          border-left-color: #fff;
          border-right: none;
        }
        .lp-whatsapp-btn:hover .lp-whatsapp-tooltip {
          opacity: 1;
          transform: translateX(0);
        }

        /* Section Divider */
        .lp-section-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          margin: 0 auto;
          max-width: 1200px;
        }

        /* Dashboard Preview Grid */
        .lp-dashboard-preview {
          display: grid;
          grid-template-columns: 1fr 1.3fr;
          gap: 60px;
          align-items: center;
        }

        /* Mobile Styles */
        @media (max-width: 1280px) {
          .lp-plans-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
          }
        }

        @media (max-width: 1024px) {
          .lp-plans-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
          .lp-benefits-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
        }

        @media (max-width: 768px) {
          .lp-nav-desktop {
            display: none;
          }
          .lp-nav-mobile-toggle {
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .lp-stats-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-top: 32px;
          }

          .lp-problem-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .lp-steps-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }

          .lp-benefits-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .lp-influencers-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .lp-plans-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .lp-section-title {
            font-size: 28px !important;
          }

          .lp-hero-buttons {
            flex-direction: column;
            width: 100%;
          }
          .lp-hero-buttons a {
            width: 100%;
            justify-content: center;
          }

          .lp-footer-content {
            flex-direction: column;
            text-align: center;
            gap: 20px;
          }

          /* Hide carousel, show grid on mobile */
          .testimonial-carousel-wrapper {
            display: none;
          }
          .lp-testimonials-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
            padding: 0 24px;
          }

          /* Mobile section padding */
          .lp-mobile-section {
            padding-top: 60px !important;
            padding-bottom: 60px !important;
          }

          /* Dashboard Preview Mobile */
          .lp-dashboard-preview {
            grid-template-columns: 1fr;
            gap: 40px;
          }

          /* Hero Grid Mobile */
          .lp-hero-grid {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
            text-align: center;
          }
          .lp-hero-grid > div:first-child {
            text-align: center;
          }
          .lp-hero-grid > div:first-child > div:last-child {
            justify-content: center;
          }
        }

        @media (max-width: 480px) {
          .lp-stats-grid {
            grid-template-columns: 1fr;
            gap: 12px;
            text-align: center;
          }

          .lp-steps-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }
      `}</style>

      {/* Noise Overlay */}
      <div className="lp-noise" />

      {/* Header */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backgroundColor: scrolled ? 'rgba(5, 5, 8, 0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.05)' : 'none',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <img
            src="/replyna-logo.webp"
            alt="Replyna"
            style={{ height: '32px', width: 'auto' }}
          />

          {/* Desktop Nav */}
          <nav className="lp-nav-desktop">
            <a href="#como-funciona" onClick={(e) => scrollToSection(e, 'como-funciona')} className="lp-nav-link">
              Como funciona
            </a>
            <a href="#precos" onClick={(e) => scrollToSection(e, 'precos')} className="lp-nav-link">
              Preços
            </a>
            <a href="#faq" onClick={(e) => scrollToSection(e, 'faq')} className="lp-nav-link">
              FAQ
            </a>
            <a href={getAppUrl('/login')} className="lp-nav-link">
              Entrar
            </a>
            <a
              href="#precos"
              onClick={(e) => scrollToSection(e, 'precos')}
              className="lp-btn-primary"
              style={{
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '10px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Começar agora
            </a>
          </nav>

          {/* Mobile Menu Toggle */}
          <button
            className="lp-nav-mobile-toggle"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      {/* Mobile Nav Overlay */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(5, 5, 8, 0.98)',
          backdropFilter: 'blur(20px)',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
        }}>
          {/* Mobile Nav Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '48px',
          }}>
            <img
              src="/replyna-logo.webp"
              alt="Replyna"
              style={{ height: '32px', width: 'auto' }}
            />
            <button
              onClick={() => setMobileMenuOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                color: '#fff',
                cursor: 'pointer',
                padding: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Fechar menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* Mobile Nav Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            {[
              { href: '#como-funciona', label: 'Como funciona', id: 'como-funciona' },
              { href: '#precos', label: 'Preços', id: 'precos' },
              { href: '#faq', label: 'FAQ', id: 'faq' },
            ].map((item) => (
              <a
                key={item.id}
                href={item.href}
                onClick={(e) => scrollToSection(e, item.id)}
                style={{
                  color: '#fff',
                  textDecoration: 'none',
                  fontSize: '20px',
                  fontWeight: 500,
                  padding: '20px 16px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  transition: 'all 0.2s ease',
                }}
              >
                {item.label}
              </a>
            ))}
            <a
              href={getAppUrl('/login')}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: '#fff',
                textDecoration: 'none',
                fontSize: '20px',
                fontWeight: 500,
                padding: '20px 16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s ease',
              }}
            >
              Entrar
            </a>
          </nav>

          {/* Mobile Nav CTA */}
          <a
            href="#precos"
            onClick={(e) => scrollToSection(e, 'precos')}
            className="lp-btn-primary"
            style={{
              color: '#ffffff',
              padding: '18px 24px',
              borderRadius: '14px',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 600,
              textAlign: 'center',
              marginTop: '24px',
            }}
          >
            Começar agora
          </a>
        </div>
      )}

      {/* Hero Section */}
      <section
        ref={heroRef}
        style={{
          position: 'relative',
          paddingTop: '120px',
          paddingBottom: '80px',
          minHeight: 'auto',
          overflow: 'hidden',
          background: 'linear-gradient(to bottom, #0c1220 0%, #050508 100%)',
        }}
      >
        {/* Animated Gradient Orbs */}
        <div
          className="lp-orb lp-orb-1"
          style={{
            transform: `translate(${mousePosition.x * 30}px, ${mousePosition.y * 30}px)`,
          }}
        />
        <div
          className="lp-orb lp-orb-2"
          style={{
            transform: `translate(${-mousePosition.x * 20}px, ${mousePosition.y * 20}px)`,
          }}
        />
        <div className="lp-grid-pattern" />

        <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>
          {/* Hero Grid: Copy Left + Dashboard Right */}
          <div className="lp-hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '60px', alignItems: 'stretch' }}>
            {/* Left: Copy */}
            <div style={{ textAlign: 'left', paddingTop: '40px', paddingBottom: '40px' }}>
              {/* Badge */}
              <div className="lp-fade-in lp-fade-in-delay-1 lp-badge" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: 'rgba(150, 191, 72, 0.1)',
                border: '1px solid rgba(150, 191, 72, 0.25)',
                padding: '8px 18px',
                borderRadius: '50px',
                marginBottom: '24px',
              }}>
                <div className="lp-pulse-ring" style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#96bf48',
                }} />
                <span style={{ fontSize: '14px', color: '#96bf48', fontWeight: 500 }}>
                  Integrado com Shopify
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="lp-fade-in lp-fade-in-delay-2" style={{
                fontSize: 'clamp(32px, 4vw, 52px)',
                fontWeight: 800,
                lineHeight: 1.1,
                marginBottom: '20px',
                letterSpacing: '-0.02em',
              }}>
                <span style={{ color: '#fff' }}>Reduza chargebacks</span>
                <br />
                <span style={{ color: '#fff' }}>em até </span>
                <span className="lp-number" style={{ fontWeight: 900 }}>90%</span>
                <span style={{ color: '#fff' }}> com IA</span>
              </h1>

              {/* Subtitle */}
              <p className="lp-fade-in lp-fade-in-delay-3" style={{
                fontSize: 'clamp(15px, 1.5vw, 17px)',
                color: 'rgba(255,255,255,0.5)',
                maxWidth: '450px',
                marginBottom: '32px',
                lineHeight: 1.7,
                fontWeight: 400,
              }}>
                A Replyna responde automaticamente os emails dos seus clientes antes que eles abram disputas.
                Mantenha seu Shopify Payments ativo.
              </p>

              {/* CTA Buttons */}
              <div className="lp-hero-buttons lp-fade-in lp-fade-in-delay-4" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <a
                  href="#precos"
                  onClick={(e) => scrollToSection(e, 'precos')}
                  className="lp-btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#ffffff',
                    padding: '16px 32px',
                    borderRadius: '14px',
                    textDecoration: 'none',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Começar agora
                  <ArrowRight size={18} />
                </a>
                <a
                  href="#como-funciona"
                  onClick={(e) => scrollToSection(e, 'como-funciona')}
                  className="lp-btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#ffffff',
                    padding: '16px 32px',
                    borderRadius: '14px',
                    textDecoration: 'none',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Play size={18} />
                  Ver demonstração
                </a>
              </div>

              {/* Stats */}
              <div className="lp-fade-in lp-fade-in-delay-5" style={{ display: 'flex', gap: '32px', marginTop: '48px' }}>
                {[
                  { value: '90%', label: 'Menos chargebacks' },
                  { value: '<2min', label: 'Tempo de resposta' },
                  { value: '24/7', label: 'Automação total' },
                ].map((stat, i) => (
                  <div key={i}>
                    <div className="lp-number" style={{
                      fontSize: '32px',
                      fontWeight: 800,
                      marginBottom: '4px',
                    }}>
                      {stat.value}
                    </div>
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Dashboard Preview */}
            <div className="lp-fade-in lp-fade-in-delay-3" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="lp-glow-blue" style={{
                position: 'relative',
                borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.1)',
                overflow: 'hidden',
                background: '#0f172a',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
              }}>
                {/* Browser Chrome */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  backgroundColor: '#1a1a2e',
                }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ff5f57' }} />
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#febc2e' }} />
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#28c840' }} />
                  </div>
                  <div style={{
                    flex: 1,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.3)',
                    marginLeft: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)' }} />
                    app.replyna.me/dashboard
                  </div>
                </div>
                {/* Dashboard Mockup Compacto */}
                <div style={{
                  padding: '16px',
                  flex: 1,
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '2px' }}>
                        Olá, Sua Empresa
                      </h3>
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                        Acompanhe o desempenho do seu atendimento
                      </p>
                    </div>
                    <div style={{
                      padding: '6px 12px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.5)',
                    }}>
                      Últimos 7 dias
                    </div>
                  </div>

                  {/* Stats Row - Compacto */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                    {[
                      { label: 'E-mails Recebidos', value: '469' },
                      { label: 'Taxa de Automação', value: '68,9%' },
                      { label: 'Taxa de Sucesso', value: '97,8%' },
                    ].map((stat, i) => (
                      <div key={i} style={{
                        padding: '12px',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>{stat.label}</div>
                        <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff' }}>{stat.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Chart Section - Compacto */}
                  <div style={{
                    padding: '14px',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    marginBottom: '12px',
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>Volume de Emails</div>
                    {/* Bar Chart Compacto */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px', height: '80px' }}>
                      {[
                        { date: '18/01', received: 40, responded: 30 },
                        { date: '19/01', received: 60, responded: 45 },
                        { date: '20/01', received: 85, responded: 60 },
                        { date: '21/01', received: 100, responded: 72 },
                      ].map((day, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '60px' }}>
                            <div style={{
                              width: '16px',
                              height: `${day.received * 0.6}px`,
                              backgroundColor: 'rgba(100, 116, 139, 0.5)',
                              borderRadius: '3px 3px 0 0',
                            }} />
                            <div style={{
                              width: '16px',
                              height: `${day.responded * 0.6}px`,
                              backgroundColor: '#4672ec',
                              borderRadius: '3px 3px 0 0',
                            }} />
                          </div>
                          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{day.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mini Table */}
                  <div style={{
                    padding: '12px',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', marginBottom: '10px' }}>Últimas Conversas</div>
                    {[
                      { client: 'Maria Silva', subject: 'Dúvida sobre entrega', category: 'Dúvidas', color: '#3b82f6' },
                      { client: 'John Smith', subject: 'Order status', category: 'Rastreio', color: '#8b5cf6' },
                    ].map((row, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i === 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <div>
                          <div style={{ fontSize: '12px', color: '#fff', fontWeight: 500 }}>{row.client}</div>
                          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{row.subject}</div>
                        </div>
                        <span style={{ padding: '3px 8px', backgroundColor: `${row.color}20`, color: row.color, borderRadius: '4px', fontSize: '10px' }}>{row.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="lp-section-divider" />

      {/* Problema/Solução */}
      <section style={{
        padding: '80px 24px',
        position: 'relative',
      }}>
        {/* Background Orb */}
        <div className="lp-orb lp-orb-3" />

        <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div className="lp-problem-grid">
            {/* Problem Card */}
            <div className="lp-card-shine lp-gradient-border" style={{ padding: '36px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                padding: '8px 14px',
                borderRadius: '50px',
                marginBottom: '24px',
              }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                }} />
                <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  O Problema
                </span>
              </div>
              <h2 style={{
                fontSize: 'clamp(22px, 3vw, 28px)',
                fontWeight: 700,
                marginBottom: '28px',
                lineHeight: 1.3,
              }}>
                Chargebacks estão{' '}
                <span style={{ color: '#ef4444' }}>matando</span> seu negócio?
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  'Clientes abrem disputas antes de você responder',
                  'Shopify Payments ameaça desativar sua conta',
                  'Você perde dinheiro e produto no chargeback',
                  'Não consegue responder emails rápido o suficiente',
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <X size={14} color="#ef4444" strokeWidth={3} />
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '15px', lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Solution Card */}
            <div className="lp-card-shine lp-gradient-border" style={{ padding: '36px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                padding: '8px 14px',
                borderRadius: '50px',
                marginBottom: '24px',
              }}>
                <Sparkles size={14} color="#22c55e" />
                <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  A Solução
                </span>
              </div>
              <h2 style={{
                fontSize: 'clamp(22px, 3vw, 28px)',
                fontWeight: 700,
                marginBottom: '28px',
                lineHeight: 1.3,
              }}>
                Com a Replyna, você tem{' '}
                <span style={{ color: '#22c55e' }}>controle total</span>
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  'IA responde em menos de 2 minutos',
                  'Clientes satisfeitos não abrem disputas',
                  'Sua conta Shopify Payments fica segura',
                  'Funciona 24/7, mesmo quando você dorme',
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(34, 197, 94, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <CheckCircle2 size={16} color="#22c55e" />
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '15px', lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="lp-section-divider" />

      {/* Como funciona */}
      <section id="como-funciona" style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(70, 114, 236, 0.1)',
            padding: '8px 16px',
            borderRadius: '50px',
            marginBottom: '20px',
          }}>
            <Zap size={14} color="#4672ec" />
            <span style={{ fontSize: '13px', color: '#4672ec', fontWeight: 600 }}>
              Simples e rápido
            </span>
          </div>

          <h2 className="lp-section-title" style={{
            fontSize: '36px',
            fontWeight: 800,
            marginBottom: '12px',
            letterSpacing: '-0.02em',
          }}>
            Como a Replyna funciona
          </h2>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.4)',
            maxWidth: '500px',
            margin: '0 auto 40px',
          }}>
            Configure em minutos, proteja seu negócio para sempre
          </p>

          <div className="lp-steps-grid">
            {[
              { icon: <Store size={28} />, title: 'Conecte sua loja', desc: 'Integre com Shopify em apenas 1 clique' },
              { icon: <Mail size={28} />, title: 'Email chega', desc: 'Monitoramos sua caixa de entrada 24/7' },
              { icon: <Bot size={28} />, title: 'IA classifica', desc: 'Identifica automaticamente o problema' },
              { icon: <Zap size={28} />, title: 'Responde rápido', desc: 'Resposta enviada em menos de 2 min' },
            ].map((step, i) => (
              <div key={i} style={{ position: 'relative', paddingTop: '14px' }}>
                {/* Number badge outside the card */}
                <div style={{
                  position: 'absolute',
                  top: '0',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4672ec 0%, #8b5cf6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 700,
                  boxShadow: '0 4px 15px rgba(70, 114, 236, 0.4)',
                  zIndex: 10,
                }}>
                  {i + 1}
                </div>
                {/* Card */}
                <div className="lp-card-shine lp-gradient-border" style={{
                  padding: '32px 24px',
                  height: '100%',
                  boxSizing: 'border-box',
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, rgba(70, 114, 236, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '8px auto 20px',
                    color: '#4672ec',
                  }}>
                    {step.icon}
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="lp-section-divider" />

      {/* Benefícios */}
      <section style={{
        padding: '80px 24px',
        position: 'relative',
      }}>
        <div className="lp-orb" style={{
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 70%)',
          top: '20%',
          left: '-10%',
        }} />

        <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            padding: '8px 16px',
            borderRadius: '50px',
            marginBottom: '20px',
          }}>
            <Shield size={14} color="#8b5cf6" />
            <span style={{ fontSize: '13px', color: '#8b5cf6', fontWeight: 600 }}>
              Benefícios
            </span>
          </div>

          <h2 className="lp-section-title" style={{
            fontSize: '36px',
            fontWeight: 800,
            marginBottom: '12px',
            letterSpacing: '-0.02em',
          }}>
            Por que escolher a Replyna
          </h2>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.4)',
            maxWidth: '500px',
            margin: '0 auto 40px',
          }}>
            Feita especialmente para dropshippers que usam Shopify Payments
          </p>

          <div className="lp-benefits-grid">
            {[
              { icon: <Shield size={24} />, title: 'Protege seu Shopify Payments', desc: 'Mantenha sua taxa de chargebacks baixa e evite ter sua conta desativada.' },
              { icon: <Clock size={24} />, title: 'Resposta em menos de 2min', desc: 'Clientes recebem resposta antes de pensar em abrir disputa.' },
              { icon: <Bot size={24} />, title: 'IA treinada para e-commerce', desc: 'Entende contexto de pedidos, rastreamento e prazos de entrega.' },
              { icon: <MessageSquare size={24} />, title: 'Respostas humanizadas', desc: 'Seus clientes nem percebem que estão falando com IA.' },
              { icon: <TrendingUp size={24} />, title: 'Escala sem contratar', desc: 'Responda 1.000 emails por minuto sem precisar de funcionários.' },
              { icon: <CreditCard size={24} />, title: 'ROI garantido', desc: 'Um chargeback evitado já paga meses de assinatura.' },
            ].map((benefit, i) => (
              <div key={i} className="lp-card-shine lp-gradient-border" style={{
                padding: '32px 28px',
                textAlign: 'left',
              }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, rgba(70, 114, 236, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px',
                  color: '#4672ec',
                }}>
                  {benefit.icon}
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>
                  {benefit.title}
                </h3>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                  {benefit.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="lp-section-divider" />

      {/* Quem usa */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(228, 64, 95, 0.1)',
            padding: '8px 16px',
            borderRadius: '50px',
            marginBottom: '20px',
          }}>
            <Instagram size={14} color="#E4405F" />
            <span style={{ fontSize: '13px', color: '#E4405F', fontWeight: 600 }}>
              Parceiros
            </span>
          </div>

          <h2 className="lp-section-title" style={{
            fontSize: '36px',
            fontWeight: 800,
            marginBottom: '12px',
            letterSpacing: '-0.02em',
          }}>
            Quem usa a <span className="lp-number">Replyna</span>
          </h2>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.4)',
            maxWidth: '500px',
            margin: '0 auto 40px',
          }}>
            De pequenas a grandes operações, todos confiam na gente
          </p>

          <div className="lp-influencers-grid">
            {influencers.map((influencer, index) => (
              <div
                key={index}
                className="lp-card-shine lp-gradient-border"
                style={{
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  height: '300px',
                  backgroundColor: '#0a0a12',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <img
                    src={influencer.image}
                    alt={influencer.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center top',
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #0a0a12 0%, #1a1a2e 100%)',
                    zIndex: -1,
                  }}>
                    <div style={{
                      width: '90px',
                      height: '90px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, rgba(70, 114, 236, 0.3) 0%, rgba(139, 92, 246, 0.2) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '36px',
                      color: '#4672ec',
                      fontWeight: 700,
                    }}>
                      {influencer.name.charAt(0)}
                    </div>
                  </div>
                  {/* Gradient overlay */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '100px',
                    background: 'linear-gradient(to top, rgba(5,5,8,1) 0%, transparent 100%)',
                  }} />
                </div>
                <div style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 700 }}>
                      {influencer.name}
                    </h3>
                    <a
                      href={influencer.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#E4405F',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(228, 64, 95, 0.1)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <Instagram size={18} />
                    </a>
                  </div>
                  <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                    {influencer.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="lp-section-divider" />

      {/* Preços */}
      <section id="precos" style={{
        padding: '80px 24px',
        position: 'relative',
      }}>
        <div className="lp-orb" style={{
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(70, 114, 236, 0.15) 0%, transparent 70%)',
          top: '10%',
          right: '-15%',
        }} />

        <div style={{ maxWidth: '1300px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(70, 114, 236, 0.1)',
            padding: '8px 16px',
            borderRadius: '50px',
            marginBottom: '20px',
          }}>
            <CreditCard size={14} color="#4672ec" />
            <span style={{ fontSize: '13px', color: '#4672ec', fontWeight: 600 }}>
              Preços transparentes
            </span>
          </div>

          <h2 className="lp-section-title" style={{
            fontSize: '36px',
            fontWeight: 800,
            marginBottom: '12px',
            letterSpacing: '-0.02em',
          }}>
            Planos e preços
          </h2>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.4)',
            maxWidth: '500px',
            margin: '0 auto 40px',
          }}>
            Escolha o plano ideal para o tamanho da sua operação
          </p>

          <div className="lp-plans-grid">
            {plans.map((plan, i) => (
              <div key={i} style={{ position: 'relative' }}>
                {/* Popular badge - positioned absolute outside card flow */}
                {plan.popular && (
                  <div style={{
                    position: 'absolute',
                    top: '-14px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#fff',
                    padding: '6px 14px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
                    zIndex: 10,
                  }}>
                    <Star size={12} fill="#fff" />
                    Popular
                  </div>
                )}
                {/* Card */}
                <div className={`lp-card-shine ${plan.popular ? '' : 'lp-gradient-border'}`} style={{
                  padding: '28px 22px',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  boxSizing: 'border-box',
                  background: plan.popular
                    ? 'linear-gradient(180deg, rgba(70, 114, 236, 0.1) 0%, rgba(70, 114, 236, 0.02) 100%)'
                    : 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                  border: plan.popular ? '2px solid rgba(70, 114, 236, 0.5)' : undefined,
                  borderRadius: '20px',
                }}>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '4px' }}>
                    {plan.name}
                  </h3>

                <p style={{
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.4)',
                  marginBottom: '20px',
                }}>
                  {plan.description}
                </p>

                <div style={{ marginBottom: '20px', height: '40px', display: 'flex', alignItems: 'center' }}>
                  <span className="lp-number" style={{ fontSize: plan.isEnterprise ? '24px' : '32px', fontWeight: 800 }}>
                    {plan.isEnterprise ? 'Sob consulta' : formatPrice(plan.price)}
                  </span>
                  {!plan.isEnterprise && (
                    <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginLeft: '4px' }}>
                      /mês
                    </span>
                  )}
                </div>

                <div style={{
                  padding: '14px',
                  backgroundColor: 'rgba(70, 114, 236, 0.08)',
                  borderRadius: '12px',
                  marginBottom: '20px',
                  border: '1px solid rgba(70, 114, 236, 0.1)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>Emails/mês</span>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: typeof plan.emails !== 'number' ? '#22c55e' : '#fff',
                    }}>
                      {typeof plan.emails === 'number' ? plan.emails.toLocaleString('pt-BR') : plan.emails}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>Lojas</span>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: typeof plan.shops !== 'number' ? '#22c55e' : '#fff',
                    }}>
                      {plan.shops}
                    </span>
                  </div>
                </div>

                <div style={{ marginBottom: '20px', flex: 1 }}>
                  {plan.features.map((feature, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        marginBottom: '10px',
                      }}
                    >
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '1px',
                      }}>
                        <Check size={12} style={{ color: '#22c55e' }} />
                      </div>
                      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                {plan.isEnterprise ? (
                  <a
                    href="https://wa.me/5531973210191?text=Olá! Tenho interesse no plano Enterprise da Replyna."
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      width: '100%',
                      padding: '14px',
                      borderRadius: '12px',
                      border: 'none',
                      backgroundColor: '#25D366',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '14px',
                      cursor: 'pointer',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      textDecoration: 'none',
                      marginTop: 'auto',
                      boxSizing: 'border-box',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <MessageCircle size={16} />
                    Fale conosco
                  </a>
                ) : (
                  <a
                    href={getAppUrl(`/register?plan=${plan.name.toLowerCase().replace(' ', '-')}`)}
                    className={plan.popular ? 'lp-btn-primary' : 'lp-btn-secondary'}
                    style={{
                      display: 'flex',
                      width: '100%',
                      padding: '14px',
                      borderRadius: '12px',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '14px',
                      cursor: 'pointer',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      textDecoration: 'none',
                      marginTop: 'auto',
                      boxSizing: 'border-box',
                    }}
                  >
                    Selecionar
                    <ArrowRight size={16} />
                  </a>
                )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="lp-section-divider" />

      {/* Depoimentos */}
      <section style={{
        padding: '80px 0',
        overflow: 'hidden',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            padding: '8px 16px',
            borderRadius: '50px',
            marginBottom: '20px',
          }}>
            <Star size={14} color="#f59e0b" fill="#f59e0b" />
            <span style={{ fontSize: '13px', color: '#f59e0b', fontWeight: 600 }}>
              Depoimentos
            </span>
          </div>

          <h2 className="lp-section-title" style={{
            fontSize: '36px',
            fontWeight: 800,
            marginBottom: '12px',
            letterSpacing: '-0.02em',
          }}>
            O que nossos clientes dizem
          </h2>
          <p style={{
            fontSize: '17px',
            color: 'rgba(255,255,255,0.4)',
            marginBottom: '40px',
          }}>
            Resultados reais de quem já usa a Replyna
          </p>
        </div>

        {/* Desktop Carousel */}
        <div className="testimonial-carousel-wrapper" style={{ position: 'relative', width: '100%' }}>
          <div className="testimonial-carousel">
            {[...testimonials, ...testimonials].map((testimonial, i) => (
              <div key={i} className="lp-gradient-border" style={{
                flex: '0 0 380px',
                padding: '28px',
              }}>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '18px' }}>
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={16} fill="#f59e0b" color="#f59e0b" />
                  ))}
                </div>
                <p style={{
                  fontSize: '15px',
                  color: 'rgba(255,255,255,0.7)',
                  lineHeight: 1.7,
                  marginBottom: '20px',
                  minHeight: '90px',
                }}>
                  "{testimonial.text}"
                </p>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{testimonial.name}</div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>{testimonial.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Grid */}
        <div className="lp-testimonials-grid">
          {testimonials.slice(0, 4).map((testimonial, i) => (
            <div key={i} className="lp-gradient-border" style={{
              padding: '24px',
            }}>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>
                {[...Array(5)].map((_, j) => (
                  <Star key={j} size={14} fill="#f59e0b" color="#f59e0b" />
                ))}
              </div>
              <p style={{
                fontSize: '14px',
                color: 'rgba(255,255,255,0.7)',
                lineHeight: 1.7,
                marginBottom: '16px',
              }}>
                "{testimonial.text}"
              </p>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>{testimonial.name}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{testimonial.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="lp-section-divider" />

      {/* FAQ */}
      <section id="faq" style={{
        padding: '80px 24px',
      }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'rgba(6, 182, 212, 0.1)',
              padding: '8px 16px',
              borderRadius: '50px',
              marginBottom: '16px',
            }}>
              <MessageSquare size={14} color="#06b6d4" />
              <span style={{ fontSize: '13px', color: '#06b6d4', fontWeight: 600 }}>
                FAQ
              </span>
            </div>

            <h2 className="lp-section-title" style={{
              fontSize: '36px',
              fontWeight: 800,
              marginBottom: '12px',
              letterSpacing: '-0.02em',
            }}>
              Perguntas frequentes
            </h2>
            <p style={{
              fontSize: '16px',
              color: 'rgba(255,255,255,0.4)',
            }}>
              Tire suas dúvidas sobre a Replyna
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="lp-gradient-border"
                style={{
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                  border: openFaq === i ? '1px solid rgba(6, 182, 212, 0.3)' : undefined,
                }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: '100%',
                    padding: '22px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '16px', fontWeight: 600, color: '#fff', paddingRight: '16px' }}>
                    {faq.question}
                  </span>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.3s ease',
                    transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0)',
                  }}>
                    <ChevronDown size={18} color="rgba(255,255,255,0.5)" />
                  </div>
                </button>
                <div style={{
                  maxHeight: openFaq === i ? '200px' : '0',
                  overflow: 'hidden',
                  transition: 'max-height 0.3s ease',
                }}>
                  <div style={{
                    padding: '0 24px 22px',
                    fontSize: '15px',
                    color: 'rgba(255,255,255,0.5)',
                    lineHeight: 1.7,
                  }}>
                    {faq.answer}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section style={{
        padding: '80px 24px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background Effects */}
        <div className="lp-orb" style={{
          width: '800px',
          height: '800px',
          background: 'radial-gradient(circle, rgba(70, 114, 236, 0.2) 0%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }} />

        <div style={{ maxWidth: '650px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            padding: '8px 16px',
            borderRadius: '50px',
            marginBottom: '24px',
          }}>
            <Sparkles size={14} color="#22c55e" />
            <span style={{ fontSize: '13px', color: '#22c55e', fontWeight: 600 }}>
              Comece hoje
            </span>
          </div>

          <h2 className="lp-section-title" style={{
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: 800,
            marginBottom: '20px',
            letterSpacing: '-0.02em',
          }}>
            Pronto para proteger seu negócio?
          </h2>
          <p style={{
            fontSize: '18px',
            color: 'rgba(255,255,255,0.4)',
            marginBottom: '40px',
            lineHeight: 1.7,
          }}>
            Comece agora e veja seus chargebacks despencarem.
            <br />
            Configuração em menos de 10 minutos.
          </p>
          <a
            href="#precos"
            onClick={(e) => scrollToSection(e, 'precos')}
            className="lp-btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              color: '#ffffff',
              padding: '20px 48px',
              borderRadius: '14px',
              textDecoration: 'none',
              fontSize: '18px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Ver planos
            <ArrowRight size={20} />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '40px 24px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div className="lp-footer-content" style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <img
            src="/replyna-logo.webp"
            alt="Replyna"
            style={{ height: '28px', width: 'auto', opacity: 0.6 }}
          />
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.3)' }}>
            © {new Date().getFullYear()} Replyna. Todos os direitos reservados.
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            <a href="#" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontSize: '14px', transition: 'color 0.2s' }}>
              Termos de uso
            </a>
            <a href="#" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontSize: '14px', transition: 'color 0.2s' }}>
              Privacidade
            </a>
          </div>
        </div>
      </footer>

      {/* WhatsApp Floating Button */}
      <a
        href={`https://wa.me/5531973210191?text=${encodeURIComponent('Olá! Gostaria de saber mais sobre a Replyna.')}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Fale conosco pelo WhatsApp"
        className="lp-whatsapp-btn"
      >
        <span className="lp-whatsapp-tooltip">Fale conosco</span>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>
    </div>
  )
}
