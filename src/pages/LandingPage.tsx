import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
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
  X
} from 'lucide-react'

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

// Depoimentos para o carrossel
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
  {
    text: 'Meus clientes elogiam o atendimento e nem sabem que é IA. As respostas são muito naturais.',
    name: 'Camila F.',
    role: 'Moda feminina',
  },
  {
    text: 'Reduzi 90% do tempo que gastava respondendo emails. Agora foco em escalar o negócio.',
    name: 'Lucas A.',
    role: 'Dropshipper',
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
  const carouselRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Função para scroll suave
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
      {/* CSS Global */}
      <style>{`
        .lp-container {
          min-height: 100vh;
          background-color: #0a0a0f;
          color: #ffffff;
          font-family: "Manrope", "Segoe UI", sans-serif;
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
        .lp-nav-mobile {
          display: none;
        }

        /* Stats Grid */
        .lp-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
          max-width: 600px;
          margin: 80px auto 0;
        }

        /* Problem/Solution Grid */
        .lp-problem-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 60px;
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
          gap: 16px;
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

        /* Section Divider */
        .lp-section-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          max-width: 800px;
          margin: 0 auto;
        }

        /* Mobile Styles */
        @media (max-width: 1024px) {
          .lp-plans-grid {
            grid-template-columns: repeat(3, 1fr);
          }
          .lp-benefits-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .lp-nav-desktop {
            display: none;
          }
          .lp-nav-mobile-toggle {
            display: flex;
          }
          .lp-nav-mobile {
            display: flex;
            flex-direction: column;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(10, 10, 15, 0.98);
            z-index: 200;
            padding: 80px 24px 24px;
            gap: 24px;
          }
          .lp-nav-mobile a {
            font-size: 18px;
            padding: 12px 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
          }
          .lp-nav-mobile-close {
            position: absolute;
            top: 16px;
            right: 16px;
            background: none;
            border: none;
            color: #fff;
            cursor: pointer;
            padding: 8px;
          }

          .lp-stats-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-top: 48px;
          }
          .lp-stats-grid > div > div:first-child {
            font-size: 28px !important;
          }

          .lp-problem-grid {
            grid-template-columns: 1fr;
            gap: 48px;
          }

          .lp-steps-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }

          .lp-benefits-grid {
            grid-template-columns: 1fr;
          }

          .lp-influencers-grid {
            grid-template-columns: 1fr;
          }

          .lp-plans-grid {
            grid-template-columns: 1fr;
            gap: 16px;
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
            gap: 24px;
          }
        }

        @media (max-width: 480px) {
          .lp-stats-grid {
            grid-template-columns: 1fr;
            gap: 24px;
            text-align: center;
          }

          .lp-steps-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Header */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backgroundColor: scrolled ? 'rgba(10, 10, 15, 0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.1)' : 'none',
        transition: 'all 0.3s ease',
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
            <a href="#como-funciona" onClick={(e) => scrollToSection(e, 'como-funciona')} style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
              Como funciona
            </a>
            <a href="#precos" onClick={(e) => scrollToSection(e, 'precos')} style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
              Preços
            </a>
            <a href="#faq" onClick={(e) => scrollToSection(e, 'faq')} style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
              FAQ
            </a>
            <Link to="/login" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>
              Entrar
            </Link>
            <a
              href="#precos"
              onClick={(e) => scrollToSection(e, 'precos')}
              style={{
                backgroundColor: '#4672ec',
                color: '#ffffff',
                padding: '10px 20px',
                borderRadius: '8px',
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
          >
            <Menu size={24} />
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <nav className="lp-nav-mobile">
            <button
              className="lp-nav-mobile-close"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X size={24} />
            </button>
            <a href="#como-funciona" onClick={(e) => scrollToSection(e, 'como-funciona')} style={{ color: '#fff', textDecoration: 'none', fontWeight: 500 }}>
              Como funciona
            </a>
            <a href="#precos" onClick={(e) => scrollToSection(e, 'precos')} style={{ color: '#fff', textDecoration: 'none', fontWeight: 500 }}>
              Preços
            </a>
            <a href="#faq" onClick={(e) => scrollToSection(e, 'faq')} style={{ color: '#fff', textDecoration: 'none', fontWeight: 500 }}>
              FAQ
            </a>
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} style={{ color: '#fff', textDecoration: 'none', fontWeight: 500 }}>
              Entrar
            </Link>
            <a
              href="#precos"
              onClick={(e) => scrollToSection(e, 'precos')}
              style={{
                backgroundColor: '#4672ec',
                color: '#ffffff',
                padding: '14px 24px',
                borderRadius: '10px',
                textDecoration: 'none',
                fontSize: '16px',
                fontWeight: 600,
                textAlign: 'center',
                marginTop: '16px',
              }}
            >
              Começar agora
            </a>
          </nav>
        )}
      </header>

      {/* Hero Section */}
      <section style={{
        paddingTop: '120px',
        paddingBottom: '80px',
        textAlign: 'center',
        background: 'radial-gradient(ellipse at top, rgba(70, 114, 236, 0.15) 0%, transparent 60%)',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(150, 191, 72, 0.15)',
            border: '1px solid rgba(150, 191, 72, 0.3)',
            padding: '8px 16px',
            borderRadius: '50px',
            marginBottom: '24px',
          }}>
            <Shield size={16} color="#96bf48" />
            <span style={{ fontSize: '14px', color: '#96bf48', fontWeight: 500 }}>
              Proteja sua conta Shopify Payments
            </span>
          </div>

          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 56px)',
            fontWeight: 700,
            lineHeight: 1.1,
            marginBottom: '24px',
            background: 'linear-gradient(to right, #ffffff, rgba(255,255,255,0.8))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Reduza seus chargebacks em até{' '}
            <span style={{
              background: 'linear-gradient(135deg, #4672ec, #6b8cff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              90%
            </span>{' '}
            com IA
          </h1>

          <p style={{
            fontSize: 'clamp(16px, 2vw, 18px)',
            color: 'rgba(255,255,255,0.6)',
            maxWidth: '600px',
            margin: '0 auto 40px',
            lineHeight: 1.6,
          }}>
            A Replyna responde automaticamente os emails dos seus clientes antes que eles abram disputas.
            Mantenha seu Shopify Payments ativo e seu negócio funcionando.
          </p>

          <div className="lp-hero-buttons" style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="#precos"
              onClick={(e) => scrollToSection(e, 'precos')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#4672ec',
                color: '#ffffff',
                padding: '16px 32px',
                borderRadius: '10px',
                textDecoration: 'none',
                fontSize: '16px',
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
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                padding: '16px 32px',
                borderRadius: '10px',
                textDecoration: 'none',
                fontSize: '16px',
                fontWeight: 600,
                border: '1px solid rgba(255,255,255,0.2)',
                cursor: 'pointer',
              }}
            >
              Ver demonstração
            </a>
          </div>

          {/* Stats */}
          <div className="lp-stats-grid">
            <div>
              <div style={{ fontSize: '40px', fontWeight: 700, color: '#4672ec' }}>90%</div>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>Redução em chargebacks</div>
            </div>
            <div>
              <div style={{ fontSize: '40px', fontWeight: 700, color: '#4672ec' }}>&lt;2min</div>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>Tempo de resposta</div>
            </div>
            <div>
              <div style={{ fontSize: '40px', fontWeight: 700, color: '#4672ec' }}>24/7</div>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>Atendimento automático</div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="lp-section-divider" />

      {/* Problema/Solução */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div className="lp-problem-grid">
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              borderRadius: '20px',
              padding: '32px',
              border: '1px solid rgba(239, 68, 68, 0.15)',
            }}>
              <h2 style={{
                fontSize: 'clamp(24px, 3vw, 28px)',
                fontWeight: 700,
                marginBottom: '24px',
                lineHeight: 1.3,
              }}>
                Chargebacks estão matando seu negócio de{' '}
                <span style={{ color: '#ef4444' }}>dropshipping</span>?
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  'Clientes abrem disputas antes de você responder',
                  'Shopify Payments ameaça desativar sua conta',
                  'Você perde dinheiro e produto no chargeback',
                  'Não consegue responder emails rápido o suficiente',
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 700 }}>✕</span>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '15px' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              backgroundColor: 'rgba(34, 197, 94, 0.05)',
              borderRadius: '20px',
              padding: '32px',
              border: '1px solid rgba(34, 197, 94, 0.15)',
            }}>
              <h2 style={{
                fontSize: 'clamp(24px, 3vw, 28px)',
                fontWeight: 700,
                marginBottom: '24px',
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
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(34, 197, 94, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <CheckCircle2 size={14} color="#22c55e" />
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '15px' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" style={{
        padding: '80px 24px',
        backgroundColor: 'rgba(70, 114, 236, 0.03)',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
          <h2 className="lp-section-title" style={{
            fontSize: '36px',
            fontWeight: 700,
            marginBottom: '12px',
          }}>
            Como a Replyna funciona
          </h2>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '48px',
          }}>
            Configure em minutos, proteja seu negócio para sempre
          </p>

          <div className="lp-steps-grid">
            {[
              {
                icon: <Store size={28} />,
                title: 'Conecte sua loja',
                desc: 'Integre com Shopify em 1 clique e configure seu email',
              },
              {
                icon: <Mail size={28} />,
                title: 'Email chega',
                desc: 'A Replyna monitora sua caixa de entrada 24/7',
              },
              {
                icon: <Bot size={28} />,
                title: 'IA classifica',
                desc: 'Identifica o tipo de problema e contexto do pedido',
              },
              {
                icon: <Zap size={28} />,
                title: 'Responde rápido',
                desc: 'Envia resposta personalizada em menos de 2 minutos',
              },
            ].map((step, i) => (
              <div key={i} style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: '16px',
                padding: '28px 20px',
                border: '1px solid rgba(255,255,255,0.08)',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: '#4672ec',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                }}>
                  {i + 1}
                </div>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(70, 114, 236, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: '#4672ec',
                }}>
                  {step.icon}
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '8px' }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
          <h2 className="lp-section-title" style={{
            fontSize: '36px',
            fontWeight: 700,
            marginBottom: '12px',
          }}>
            Por que escolher a Replyna
          </h2>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '48px',
          }}>
            Feita especialmente para dropshippers que usam Shopify Payments
          </p>

          <div className="lp-benefits-grid">
            {[
              {
                icon: <Shield size={24} />,
                title: 'Protege seu Shopify Payments',
                desc: 'Mantenha sua taxa de chargebacks baixa e evite ter sua conta desativada.',
              },
              {
                icon: <Clock size={24} />,
                title: 'Resposta em menos de 2min',
                desc: 'Clientes recebem resposta antes de pensar em abrir disputa.',
              },
              {
                icon: <Bot size={24} />,
                title: 'IA treinada para e-commerce',
                desc: 'Entende contexto de pedidos, rastreamento e prazos de entrega.',
              },
              {
                icon: <MessageSquare size={24} />,
                title: 'Respostas humanizadas',
                desc: 'Seus clientes nem percebem que estão falando com IA.',
              },
              {
                icon: <TrendingUp size={24} />,
                title: 'Escala sem contratar',
                desc: 'Responda 1.000 emails por minuto sem precisar de funcionários.',
              },
              {
                icon: <CreditCard size={24} />,
                title: 'ROI garantido',
                desc: 'Um chargeback evitado já paga meses de assinatura.',
              },
            ].map((benefit, i) => (
              <div key={i} style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: '16px',
                padding: '28px 24px',
                border: '1px solid rgba(255,255,255,0.08)',
                textAlign: 'left',
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(70, 114, 236, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  color: '#4672ec',
                }}>
                  {benefit.icon}
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '8px' }}>
                  {benefit.title}
                </h3>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                  {benefit.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quem usa */}
      <section style={{
        padding: '80px 24px',
        backgroundColor: 'rgba(70, 114, 236, 0.03)',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
          <h2 className="lp-section-title" style={{
            fontSize: '36px',
            fontWeight: 700,
            marginBottom: '12px',
          }}>
            Quem usa a{' '}
            <span style={{ color: '#4672ec' }}>Replyna</span>
          </h2>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '48px',
          }}>
            De pequenas a grandes operações, todos confiam na gente
          </p>

          <div className="lp-influencers-grid">
            {influencers.map((influencer, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div style={{
                  height: '280px',
                  backgroundColor: '#1a1a2e',
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
                    backgroundColor: '#1a1a2e',
                    zIndex: -1,
                  }}>
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(70, 114, 236, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px',
                      color: '#4672ec',
                    }}>
                      {influencer.name.charAt(0)}
                    </div>
                  </div>
                </div>
                <div style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600 }}>
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
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(228, 64, 95, 0.1)',
                      }}
                    >
                      <Instagram size={18} />
                    </a>
                  </div>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                    {influencer.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preços */}
      <section id="precos" style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1300px', margin: '0 auto', textAlign: 'center' }}>
          <h2 className="lp-section-title" style={{
            fontSize: '36px',
            fontWeight: 700,
            marginBottom: '12px',
          }}>
            Planos e preços
          </h2>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '48px',
          }}>
            Escolha o plano ideal para o tamanho da sua operação
          </p>

          <div className="lp-plans-grid">
            {plans.map((plan, i) => (
              <div key={i} style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: '16px',
                padding: '24px 20px',
                border: plan.popular ? '2px solid #4672ec' : '1px solid rgba(255,255,255,0.08)',
                position: 'relative',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
              }}>
                {plan.popular && (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#f59e0b',
                    color: '#fff',
                    padding: '4px 12px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                  }}>
                    <Star size={12} />
                    Popular
                  </div>
                )}

                <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px', marginTop: plan.popular ? '8px' : 0 }}>
                  {plan.name}
                </h3>

                <p style={{
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: '16px',
                }}>
                  {plan.description}
                </p>

                <div style={{ marginBottom: '16px' }}>
                  <span style={{ fontSize: '28px', fontWeight: 700 }}>
                    {formatPrice(plan.price)}
                  </span>
                  <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginLeft: '4px' }}>
                    /mês
                  </span>
                </div>

                <div style={{
                  padding: '12px',
                  backgroundColor: 'rgba(70, 114, 236, 0.08)',
                  borderRadius: '10px',
                  marginBottom: '16px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>Emails/mês</span>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: typeof plan.emails !== 'number' ? '#22c55e' : '#fff',
                    }}>
                      {typeof plan.emails === 'number' ? plan.emails.toLocaleString('pt-BR') : plan.emails}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>Lojas</span>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: typeof plan.shops !== 'number' ? '#22c55e' : '#fff',
                    }}>
                      {typeof plan.shops === 'number' ? plan.shops : plan.shops}
                    </span>
                  </div>
                </div>

                <div style={{ marginBottom: '16px', flex: 1 }}>
                  {plan.features.map((feature, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        marginBottom: '8px',
                      }}
                    >
                      <Check size={14} style={{ color: '#22c55e', flexShrink: 0, marginTop: '2px' }} />
                      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
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
                      padding: '12px',
                      borderRadius: '10px',
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
                    }}
                  >
                    <MessageCircle size={16} />
                    Fale conosco
                  </a>
                ) : (
                  <Link
                    to={`/register?plan=${plan.name.toLowerCase().replace(' ', '-')}`}
                    style={{
                      display: 'flex',
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: plan.popular ? '#4672ec' : 'rgba(255,255,255,0.1)',
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
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Depoimentos - CARROSSEL */}
      <section style={{
        padding: '80px 0',
        backgroundColor: 'rgba(70, 114, 236, 0.03)',
        overflow: 'hidden',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <h2 className="lp-section-title" style={{
            fontSize: '36px',
            fontWeight: 700,
            marginBottom: '12px',
          }}>
            O que nossos clientes dizem
          </h2>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '48px',
          }}>
            Resultados reais de quem já usa a Replyna
          </p>
        </div>

        {/* Carrossel infinito */}
        <div style={{ position: 'relative', width: '100%' }}>
          <div
            ref={carouselRef}
            className="testimonial-carousel"
          >
            {/* Duplicar items para loop infinito */}
            {[...testimonials, ...testimonials].map((testimonial, i) => (
              <div key={i} style={{
                flex: '0 0 320px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={16} fill="#f59e0b" color="#f59e0b" />
                  ))}
                </div>
                <p style={{
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.8)',
                  lineHeight: 1.6,
                  marginBottom: '16px',
                  minHeight: '84px',
                }}>
                  "{testimonial.text}"
                </p>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{testimonial.name}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{testimonial.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h2 className="lp-section-title" style={{
            fontSize: '36px',
            fontWeight: 700,
            marginBottom: '12px',
            textAlign: 'center',
          }}>
            Perguntas frequentes
          </h2>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '48px',
            textAlign: 'center',
          }}>
            Tire suas dúvidas sobre a Replyna
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {faqs.map((faq, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: '100%',
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '15px', fontWeight: 600, color: '#fff', paddingRight: '12px' }}>
                    {faq.question}
                  </span>
                  <ChevronDown
                    size={20}
                    color="rgba(255,255,255,0.5)"
                    style={{
                      transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0)',
                      transition: 'transform 0.2s ease',
                      flexShrink: 0,
                    }}
                  />
                </button>
                {openFaq === i && (
                  <div style={{
                    padding: '0 24px 20px',
                    fontSize: '14px',
                    color: 'rgba(255,255,255,0.6)',
                    lineHeight: 1.6,
                  }}>
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section style={{
        padding: '80px 24px',
        textAlign: 'center',
        background: 'radial-gradient(ellipse at bottom, rgba(70, 114, 236, 0.15) 0%, transparent 60%)',
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 className="lp-section-title" style={{
            fontSize: '36px',
            fontWeight: 700,
            marginBottom: '16px',
          }}>
            Pronto para proteger seu negócio?
          </h2>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '32px',
          }}>
            Comece agora e veja seus chargebacks despencarem
          </p>
          <a
            href="#precos"
            onClick={(e) => scrollToSection(e, 'precos')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#4672ec',
              color: '#ffffff',
              padding: '16px 40px',
              borderRadius: '10px',
              textDecoration: 'none',
              fontSize: '18px',
              fontWeight: 600,
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
        padding: '32px 24px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
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
            style={{ height: '28px', width: 'auto', opacity: 0.7 }}
          />
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>
            © {new Date().getFullYear()} Replyna. Todos os direitos reservados.
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            <a href="#" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: '14px' }}>
              Termos de uso
            </a>
            <a href="#" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: '14px' }}>
              Privacidade
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
