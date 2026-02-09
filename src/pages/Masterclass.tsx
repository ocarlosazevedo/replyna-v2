import { useState, useEffect } from 'react'
import {
  Play,
  CheckCircle2,
  TrendingDown,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Instagram,
  Users,
  Award,
  Zap
} from 'lucide-react'

export default function Masterclass() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
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
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          whatsapp: formData.whatsapp
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setIsSubmitted(true)
      } else {
        console.error('Erro ao cadastrar:', data)
        alert('Erro ao cadastrar. Tente novamente.')
      }
    } catch (error) {
      console.error('Erro na requisição:', error)
      alert('Erro de conexão. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Se já submeteu, mostrar página de obrigado com vídeo
  if (isSubmitted) {
    return (
      <div className="mc-container">
        <style>{masterclassStyles}</style>
        <div className="mc-noise" />

        {/* Background Effects */}
        <div className="mc-orb mc-orb-1" />
        <div className="mc-orb mc-orb-2" />

        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{
            maxWidth: '900px',
            width: '100%',
            textAlign: 'center'
          }}>
            {/* Success Badge */}
            <div className="mc-fade-in" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
              padding: '10px 20px',
              borderRadius: '50px',
              marginBottom: '24px',
              border: '1px solid rgba(34, 197, 94, 0.3)'
            }}>
              <CheckCircle2 size={18} color="#22c55e" />
              <span style={{ fontSize: '14px', color: '#22c55e', fontWeight: 600 }}>
                Inscrição confirmada!
              </span>
            </div>

            <h1 className="mc-fade-in mc-fade-in-delay-1" style={{
              fontSize: 'clamp(28px, 5vw, 42px)',
              fontWeight: 800,
              marginBottom: '16px',
              lineHeight: 1.2
            }}>
              Assista a Masterclass Agora
            </h1>

            <p className="mc-fade-in mc-fade-in-delay-2" style={{
              fontSize: '18px',
              color: 'rgba(255,255,255,0.6)',
              marginBottom: '40px',
              maxWidth: '600px',
              margin: '0 auto 40px'
            }}>
              O Carlos preparou um conteúdo exclusivo pra você. Assista até o final.
            </p>

            {/* Video Container */}
            <div className="mc-fade-in mc-fade-in-delay-3 mc-video-container" style={{
              position: 'relative',
              width: '100%',
              paddingBottom: '56.25%',
              borderRadius: '20px',
              overflow: 'hidden',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              marginBottom: '32px'
            }}>
              {/* Substituir pelo embed real do YouTube */}
              <iframe
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none'
                }}
                src="https://www.youtube.com/embed/VIDEO_ID_AQUI?rel=0&modestbranding=1"
                title="Masterclass Anti-Chargeback"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            {/* CTA após vídeo */}
            <div className="mc-fade-in mc-fade-in-delay-4" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px'
            }}>
              <a
                href="https://app.replyna.me/register"
                className="mc-btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '18px 36px',
                  borderRadius: '14px',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#fff',
                  textDecoration: 'none'
                }}
              >
                Quero testar a Replyna
                <ChevronRight size={20} />
              </a>
              <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>
                Use o cupom <strong style={{ color: '#22c55e' }}>CARLOS10</strong> e ganhe 10% de desconto
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mc-container">
      <style>{masterclassStyles}</style>
      <div className="mc-noise" />

      {/* Background Effects */}
      <div className="mc-orb mc-orb-1" />
      <div className="mc-orb mc-orb-2" />
      <div className="mc-orb mc-orb-3" />

      {/* Header */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: '16px 24px',
        transition: 'all 0.3s ease',
        backgroundColor: scrolled ? 'rgba(5, 5, 8, 0.9)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.05)' : 'none'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <img
            src="/replyna-logo.webp"
            alt="Replyna"
            style={{ height: '32px', width: 'auto' }}
          />
          <a
            href="#form"
            className="mc-btn-primary"
            style={{
              padding: '12px 24px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#fff',
              textDecoration: 'none'
            }}
          >
            Quero assistir grátis
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        padding: '120px 24px 80px',
        position: 'relative'
      }}>
        <div className="mc-grid-pattern" />

        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))',
          gap: '60px',
          alignItems: 'center'
        }}>
          {/* Left Content */}
          <div>
            {/* Badge */}
            <div className="mc-fade-in mc-badge" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              padding: '10px 18px',
              borderRadius: '50px',
              marginBottom: '24px',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }}>
              <AlertTriangle size={16} color="#ef4444" />
              <span style={{ fontSize: '13px', color: '#ef4444', fontWeight: 600 }}>
                Masterclass Gratuita
              </span>
            </div>

            {/* Headline */}
            <h1 className="mc-fade-in mc-fade-in-delay-1" style={{
              fontSize: 'clamp(32px, 6vw, 52px)',
              fontWeight: 800,
              lineHeight: 1.1,
              marginBottom: '20px',
              letterSpacing: '-0.03em'
            }}>
              Como Reduzir até{' '}
              <span className="mc-gradient-text">90% dos Chargebacks</span>{' '}
              e Blindar sua Conta Shopify Payments
            </h1>

            {/* Subheadline */}
            <p className="mc-fade-in mc-fade-in-delay-2" style={{
              fontSize: '18px',
              color: 'rgba(255,255,255,0.6)',
              lineHeight: 1.7,
              marginBottom: '32px',
              maxWidth: '520px'
            }}>
              Descubra o método que donos de operações de 7 dígitos usam pra manter a taxa de chargeback perto de zero — mesmo vendendo pra fora do Brasil.
            </p>

            {/* Benefits List */}
            <div className="mc-fade-in mc-fade-in-delay-3" style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              marginBottom: '32px'
            }}>
              {[
                'Os 7 pilares anti-chargeback que toda operação precisa',
                'Por que 71% dos chargebacks não são fraude real',
                'A regra dos 2 minutos que muda tudo',
                'Como automatizar o atendimento sem perder qualidade'
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(34, 197, 94, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <CheckCircle2 size={14} color="#22c55e" />
                  </div>
                  <span style={{ fontSize: '15px', color: 'rgba(255,255,255,0.8)' }}>
                    {item}
                  </span>
                </div>
              ))}
            </div>

            {/* Mobile CTA */}
            <div className="mc-mobile-cta mc-fade-in mc-fade-in-delay-4">
              <a
                href="#form"
                className="mc-btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '18px 32px',
                  borderRadius: '14px',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#fff',
                  textDecoration: 'none'
                }}
              >
                <Play size={20} fill="#fff" />
                Quero assistir grátis
              </a>
            </div>
          </div>

          {/* Right - Form */}
          <div id="form" className="mc-fade-in mc-fade-in-delay-4">
            <div className="mc-form-card">
              {/* Instructor Badge */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                marginBottom: '24px',
                paddingBottom: '24px',
                borderBottom: '1px solid rgba(255,255,255,0.08)'
              }}>
                <img
                  src="/influencers/carlos-azevedo.webp"
                  alt="Carlos Azevedo"
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid rgba(70, 114, 236, 0.5)'
                  }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '2px' }}>
                    Carlos Azevedo
                  </div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                    Mentor de +1.000 alunos em Dropshipping Global
                  </div>
                </div>
              </div>

              <h2 style={{
                fontSize: '22px',
                fontWeight: 700,
                marginBottom: '8px',
                textAlign: 'center'
              }}>
                Assista a Masterclass Grátis
              </h2>
              <p style={{
                fontSize: '14px',
                color: 'rgba(255,255,255,0.5)',
                textAlign: 'center',
                marginBottom: '28px'
              }}>
                Preencha abaixo e acesse o conteúdo imediatamente
              </p>

              <form onSubmit={handleSubmit} style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.7)',
                    marginBottom: '8px'
                  }}>
                    Seu nome
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: João Silva"
                    required
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="mc-input"
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.7)',
                    marginBottom: '8px'
                  }}>
                    Seu melhor e-mail
                  </label>
                  <input
                    type="email"
                    placeholder="Ex: joao@email.com"
                    required
                    value={formData.email}
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="mc-input"
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.7)',
                    marginBottom: '8px'
                  }}>
                    WhatsApp
                  </label>
                  <input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    required
                    value={formData.whatsapp}
                    onChange={handleWhatsAppChange}
                    className="mc-input"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mc-btn-primary mc-btn-submit"
                  style={{
                    width: '100%',
                    padding: '18px',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: 700,
                    color: '#fff',
                    border: 'none',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    marginTop: '8px'
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={20} className="mc-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Play size={20} fill="#fff" />
                      Quero assistir agora
                    </>
                  )}
                </button>

                <p style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.35)',
                  textAlign: 'center',
                  marginTop: '8px'
                }}>
                  🔒 Seus dados estão seguros. Não enviamos spam.
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section style={{
        padding: '80px 24px',
        position: 'relative',
        borderTop: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{
          maxWidth: '1000px',
          margin: '0 auto'
        }}>
          {/* Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '32px',
            marginBottom: '60px'
          }}>
            {[
              { icon: Users, value: '1.000+', label: 'Alunos treinados' },
              { icon: TrendingDown, value: '90%', label: 'Redução média em chargebacks' },
              { icon: Award, value: '7+', label: 'Anos de experiência' },
              { icon: Zap, value: '24/7', label: 'Método funciona non-stop' }
            ].map((stat, i) => (
              <div key={i} style={{
                textAlign: 'center',
                padding: '24px'
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(70, 114, 236, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px'
                }}>
                  <stat.icon size={26} color="#4672ec" />
                </div>
                <div className="mc-gradient-text" style={{
                  fontSize: '36px',
                  fontWeight: 800,
                  marginBottom: '4px'
                }}>
                  {stat.value}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.5)'
                }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* About Carlos */}
          <div className="mc-about-card">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
              gap: '40px',
              alignItems: 'center'
            }}>
              <div style={{ textAlign: 'center' }}>
                <img
                  src="/influencers/carlos-azevedo.webp"
                  alt="Carlos Azevedo"
                  style={{
                    width: '180px',
                    height: '180px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '4px solid rgba(70, 114, 236, 0.3)',
                    marginBottom: '20px'
                  }}
                />
                <a
                  href="https://www.instagram.com/ocarlosazevedo/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'rgba(255,255,255,0.6)',
                    textDecoration: 'none',
                    fontSize: '14px',
                    transition: 'color 0.2s'
                  }}
                >
                  <Instagram size={18} />
                  @ocarlosazevedo
                </a>
              </div>
              <div>
                <h3 style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  marginBottom: '16px'
                }}>
                  Quem é Carlos Azevedo?
                </h3>
                <p style={{
                  fontSize: '16px',
                  color: 'rgba(255,255,255,0.6)',
                  lineHeight: 1.8,
                  marginBottom: '20px'
                }}>
                  Mentor de mais de 1.000 alunos em Dropshipping Global, Carlos é referência quando o assunto é operar com Shopify Payments sem ter a conta banida.
                </p>
                <p style={{
                  fontSize: '16px',
                  color: 'rgba(255,255,255,0.6)',
                  lineHeight: 1.8
                }}>
                  Nesta masterclass, ele vai compartilhar o método exato que usa pra manter a taxa de chargeback de suas operações perto de zero — e como você pode fazer o mesmo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section style={{
        padding: '80px 24px',
        textAlign: 'center',
        position: 'relative'
      }}>
        <div className="mc-orb" style={{
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(70, 114, 236, 0.2) 0%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }} />

        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          position: 'relative',
          zIndex: 1
        }}>
          <h2 style={{
            fontSize: 'clamp(28px, 5vw, 40px)',
            fontWeight: 800,
            marginBottom: '16px',
            lineHeight: 1.2
          }}>
            Sua conta Shopify Payments está em risco?
          </h2>
          <p style={{
            fontSize: '18px',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '32px'
          }}>
            Assista a masterclass gratuita e descubra como proteger seu negócio.
          </p>
          <a
            href="#form"
            className="mc-btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '20px 40px',
              borderRadius: '14px',
              fontSize: '18px',
              fontWeight: 700,
              color: '#fff',
              textDecoration: 'none'
            }}
          >
            <Play size={22} fill="#fff" />
            Assistir masterclass grátis
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '32px 24px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        textAlign: 'center'
      }}>
        <img
          src="/replyna-logo.webp"
          alt="Replyna"
          style={{ height: '24px', width: 'auto', opacity: 0.5, marginBottom: '16px' }}
        />
        <p style={{
          fontSize: '13px',
          color: 'rgba(255,255,255,0.3)'
        }}>
          © {new Date().getFullYear()} Replyna. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  )
}

// Styles
const masterclassStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  .mc-container {
    min-height: 100vh;
    background-color: #050508;
    color: #ffffff;
    font-family: "Inter", "Manrope", sans-serif;
    overflow-x: hidden;
  }

  /* Noise Texture */
  .mc-noise {
    position: fixed;
    inset: 0;
    opacity: 0.03;
    pointer-events: none;
    z-index: 1000;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  }

  /* Gradient Orbs */
  .mc-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.5;
    pointer-events: none;
  }
  .mc-orb-1 {
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(70, 114, 236, 0.4) 0%, transparent 70%);
    top: -200px;
    left: -200px;
  }
  .mc-orb-2 {
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%);
    top: 40%;
    right: -200px;
  }
  .mc-orb-3 {
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(239, 68, 68, 0.2) 0%, transparent 70%);
    bottom: 20%;
    left: 10%;
  }

  /* Grid Pattern */
  .mc-grid-pattern {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: linear-gradient(to bottom, black 0%, transparent 100%);
    z-index: 0;
  }

  /* Animations */
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .mc-fade-in {
    animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  .mc-fade-in-delay-1 { animation-delay: 0.1s; opacity: 0; }
  .mc-fade-in-delay-2 { animation-delay: 0.2s; opacity: 0; }
  .mc-fade-in-delay-3 { animation-delay: 0.3s; opacity: 0; }
  .mc-fade-in-delay-4 { animation-delay: 0.4s; opacity: 0; }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .mc-spin {
    animation: spin 1s linear infinite;
  }

  /* Gradient Text */
  .mc-gradient-text {
    background: linear-gradient(135deg, #4672ec 0%, #8b5cf6 50%, #06b6d4 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* Badge */
  .mc-badge {
    position: relative;
    overflow: hidden;
  }

  /* Primary Button */
  .mc-btn-primary {
    position: relative;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    background: linear-gradient(135deg, #4672ec 0%, #3b5fd9 100%);
  }
  .mc-btn-primary::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%);
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  .mc-btn-primary:hover::before {
    opacity: 1;
  }
  .mc-btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 15px 40px rgba(70, 114, 236, 0.35);
  }

  /* Form Card */
  .mc-form-card {
    background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 24px;
    padding: 32px;
    position: relative;
    backdrop-filter: blur(20px);
  }
  .mc-form-card::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 24px;
    padding: 1px;
    background: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.02) 100%);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: exclude;
    -webkit-mask-composite: xor;
    pointer-events: none;
  }

  /* Input */
  .mc-input {
    width: 100%;
    padding: 16px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    color: #fff;
    font-size: 15px;
    transition: all 0.2s ease;
    outline: none;
  }
  .mc-input::placeholder {
    color: rgba(255,255,255,0.3);
  }
  .mc-input:focus {
    border-color: #4672ec;
    background: rgba(70, 114, 236, 0.05);
    box-shadow: 0 0 0 3px rgba(70, 114, 236, 0.15);
  }

  /* About Card */
  .mc-about-card {
    background: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 24px;
    padding: 48px;
  }

  /* Video Container Glow */
  .mc-video-container {
    box-shadow: 0 25px 80px rgba(70, 114, 236, 0.2), 0 0 60px rgba(70, 114, 236, 0.1);
  }

  /* Mobile CTA (hidden on desktop) */
  .mc-mobile-cta {
    display: none;
  }

  /* Mobile Responsive */
  @media (max-width: 900px) {
    .mc-form-card {
      padding: 24px;
    }
    .mc-about-card {
      padding: 32px;
    }
  }

  @media (max-width: 768px) {
    .mc-mobile-cta {
      display: block;
    }
  }
`
