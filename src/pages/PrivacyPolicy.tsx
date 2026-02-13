import { useState, useEffect } from 'react'

const sections = [
  {
    id: 'introducao',
    title: '1. Introdução',
    content: `A Replyna ("nós", "nosso" ou "Replyna") é uma plataforma de atendimento automatizado por inteligência artificial, desenvolvida para auxiliar lojistas de e-commerce na gestão de e-mails de clientes e na prevenção de chargebacks. Esta Política de Privacidade descreve como coletamos, utilizamos, armazenamos e protegemos as informações pessoais dos nossos usuários e dos clientes finais das lojas integradas à nossa plataforma. Ao utilizar nossos serviços, você concorda com as práticas descritas nesta política.`,
  },
  {
    id: 'dados-coletados',
    title: '2. Dados que Coletamos',
    subsections: [
      {
        subtitle: '2.1 Dados do Lojista (Usuário da Plataforma)',
        items: [
          'Nome completo e endereço de e-mail',
          'Dados de acesso e autenticação (credenciais de login)',
          'Informações de faturamento e pagamento',
          'Dados da loja Shopify (nome da loja, URL, ID da loja)',
          'Configurações de integração e preferências da plataforma',
          'Dados de uso e interação com o painel da Replyna',
          'Endereço IP e informações do dispositivo de acesso',
        ],
      },
      {
        subtitle: '2.2 Dados dos Clientes Finais (Processados em Nome do Lojista)',
        items: [
          'Nome e endereço de e-mail do cliente',
          'Conteúdo dos e-mails recebidos e enviados',
          'Dados de pedidos vinculados (número do pedido, status, rastreamento)',
          'Histórico de interações e classificações de atendimento',
          'Idioma de comunicação detectado',
        ],
      },
      {
        subtitle: '2.3 Dados Coletados Automaticamente',
        items: [
          'Cookies e tecnologias de rastreamento similares',
          'Dados de navegação no site e na plataforma',
          'Informações do navegador, sistema operacional e dispositivo',
          'Dados de navegação agregados para melhoria da plataforma',
        ],
      },
    ],
  },
  {
    id: 'uso-dados',
    title: '3. Como Utilizamos os Dados',
    items: [
      'Prover e operar os serviços de atendimento automatizado por IA',
      'Processar, classificar e responder e-mails de clientes automaticamente',
      'Gerar relatórios e métricas de desempenho do atendimento',
      'Processar pagamentos e gerenciar assinaturas',
      'Melhorar a qualidade das respostas da inteligência artificial',
      'Enviar comunicações relacionadas ao serviço (atualizações, alertas, suporte)',
      'Realizar campanhas de marketing (com consentimento)',
      'Cumprir obrigações legais e regulatórias',
      'Prevenir fraudes e garantir a segurança da plataforma',
      'Personalizar a experiência do usuário na plataforma',
    ],
  },
  {
    id: 'base-legal',
    title: '4. Base Legal para o Tratamento (LGPD)',
    content: `Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), o tratamento de dados pessoais pela Replyna é fundamentado nas seguintes bases legais:`,
    items: [
      'Execução de contrato: para a prestação dos serviços contratados pelo lojista',
      'Consentimento: para o envio de comunicações de marketing e uso de cookies não essenciais',
      'Legítimo interesse: para melhoria dos serviços, análise de uso e prevenção de fraudes',
      'Cumprimento de obrigação legal: para atender exigências regulatórias e fiscais',
    ],
  },
  {
    id: 'compartilhamento',
    title: '5. Compartilhamento de Dados',
    content: `A Replyna não vende, aluga ou comercializa dados pessoais. Podemos compartilhar informações nas seguintes situações:`,
    items: [
      'Provedores de infraestrutura e hospedagem de dados',
      'Processadores de pagamento para gestão de assinaturas',
      'Serviços de e-mail para envio de respostas automatizadas',
      'Shopify, por meio da integração autorizada pelo lojista',
      'Autoridades competentes, quando exigido por lei ou ordem judicial',
    ],
    note: 'Todos os prestadores de serviço terceirizados estão vinculados a acordos de proteção de dados e confidencialidade.',
  },
  {
    id: 'armazenamento',
    title: '6. Armazenamento e Segurança',
    content: `Os dados são armazenados em servidores seguros com as seguintes medidas de proteção:`,
    items: [
      'Criptografia de dados em trânsito (TLS/SSL) e em repouso',
      'Controle de acesso baseado em funções e autenticação multifator',
      'Monitoramento contínuo de segurança e detecção de intrusões',
      'Backups regulares com armazenamento redundante',
      'Infraestrutura hospedada em provedores com certificações de segurança reconhecidas',
    ],
    note: 'Os dados são retidos pelo período necessário para a prestação dos serviços e cumprimento de obrigações legais. Após o cancelamento da conta, os dados são excluídos em até 90 dias, salvo quando a retenção for exigida por lei.',
  },
  {
    id: 'direitos',
    title: '7. Seus Direitos (LGPD)',
    content: `Conforme a LGPD, você tem os seguintes direitos em relação aos seus dados pessoais:`,
    items: [
      'Confirmação da existência de tratamento de dados',
      'Acesso aos dados pessoais coletados',
      'Correção de dados incompletos, inexatos ou desatualizados',
      'Anonimização, bloqueio ou eliminação de dados desnecessários',
      'Portabilidade dos dados a outro fornecedor de serviço',
      'Eliminação dos dados tratados com consentimento',
      'Informação sobre compartilhamento de dados com terceiros',
      'Revogação do consentimento a qualquer momento',
    ],
    note: 'Para exercer seus direitos, entre em contato pelo e-mail: contato@replyna.me',
  },
  {
    id: 'cookies',
    title: '8. Cookies e Tecnologias de Rastreamento',
    subsections: [
      {
        subtitle: 'Cookies Essenciais',
        description: 'Necessários para o funcionamento da plataforma, incluindo autenticação e preferências de sessão.',
      },
      {
        subtitle: 'Cookies de Análise',
        description: 'Utilizados para compreender como os usuários interagem com a plataforma e melhorar a experiência.',
      },
      {
        subtitle: 'Cookies de Marketing',
        description: 'Utilizados para campanhas de marketing, medição de conversões e melhoria da experiência do usuário.',
      },
    ],
    note: 'Você pode gerenciar suas preferências de cookies através das configurações do seu navegador.',
  },
  {
    id: 'ia',
    title: '9. Inteligência Artificial e Processamento Automatizado',
    items: [
      'A Replyna utiliza inteligência artificial para classificar e responder e-mails automaticamente',
      'O processamento é realizado com base nos dados do pedido e no conteúdo do e-mail recebido',
      'As respostas são enviadas automaticamente para reduzir ao máximo o trabalho manual do lojista',
      'O lojista pode revisar as respostas enviadas pela IA a qualquer momento no painel',
      'Os dados processados pela IA são utilizados exclusivamente para a prestação do serviço contratado',
      'Não utilizamos dados de clientes finais para treinar modelos de IA de uso geral',
    ],
  },
  {
    id: 'menores',
    title: '10. Menores de Idade',
    content: `Os serviços da Replyna são destinados a pessoas maiores de 18 anos. Não coletamos intencionalmente dados de menores de idade. Caso identifiquemos a coleta inadvertida de dados de menores, estes serão excluídos imediatamente.`,
  },
  {
    id: 'internacional',
    title: '11. Transferência Internacional de Dados',
    content: `Seus dados podem ser processados em servidores localizados fora do Brasil, incluindo Estados Unidos e outras jurisdições onde nossos provedores de infraestrutura operam. Nestes casos, garantimos que as transferências são realizadas com salvaguardas adequadas conforme a LGPD, incluindo cláusulas contratuais padrão e garantias de nível equivalente de proteção.`,
  },
  {
    id: 'alteracoes',
    title: '12. Alterações nesta Política',
    content: `A Replyna pode atualizar esta Política de Privacidade periodicamente para refletir mudanças nos nossos serviços, práticas de dados ou requisitos legais. Notificaremos alterações significativas por e-mail ou através de aviso na plataforma. A data da última atualização será sempre indicada ao final deste documento. O uso continuado dos serviços após a publicação de alterações constitui aceitação da política atualizada.`,
  },
  {
    id: 'contato',
    title: '13. Contato',
    content: `Para dúvidas, solicitações ou reclamações relacionadas à privacidade e proteção de dados, entre em contato conosco:`,
    contactInfo: [
      { label: 'E-mail', value: 'contato@replyna.me' },
      { label: 'WhatsApp', value: '+55 (31) 97321-0191' },
      { label: 'Site', value: 'replyna.me' },
    ],
  },
]

const navItems = [
  { id: 'introducao', label: 'Introdução' },
  { id: 'dados-coletados', label: 'Dados Coletados' },
  { id: 'uso-dados', label: 'Uso dos Dados' },
  { id: 'base-legal', label: 'Base Legal' },
  { id: 'compartilhamento', label: 'Compartilhamento' },
  { id: 'armazenamento', label: 'Segurança' },
  { id: 'direitos', label: 'Seus Direitos' },
  { id: 'cookies', label: 'Cookies' },
  { id: 'ia', label: 'IA' },
  { id: 'contato', label: 'Contato' },
]

export default function PrivacyPolicy() {
  const [activeSection, setActiveSection] = useState('introducao')
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)

      const sectionElements = sections.map(s => ({
        id: s.id,
        el: document.getElementById(s.id),
      }))

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const { id, el } = sectionElements[i]
        if (el) {
          const rect = el.getBoundingClientRect()
          if (rect.top <= 160) {
            setActiveSection(id)
            break
          }
        }
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      const offset = 120
      const top = el.getBoundingClientRect().top + window.pageYOffset - offset
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#050508',
      color: '#ffffff',
      fontFamily: '"Inter", "Segoe UI", sans-serif',
      overflowX: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

        .pp-noise {
          position: fixed;
          inset: 0;
          opacity: 0.03;
          pointer-events: none;
          z-index: 1000;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }

        .pp-grid-pattern {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 80px 80px;
          mask-image: linear-gradient(to bottom, black 0%, black 85%, transparent 100%);
          z-index: 0;
        }

        .pp-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.6;
          pointer-events: none;
        }

        .pp-gradient-text {
          background: linear-gradient(135deg, #4672ec 0%, #8b5cf6 50%, #06b6d4 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .pp-nav-item {
          display: block;
          padding: 8px 16px;
          font-size: 13px;
          color: rgba(255,255,255,0.4);
          text-decoration: none;
          border-left: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s ease;
          background: none;
          border-right: none;
          border-top: none;
          border-bottom: none;
          text-align: left;
          width: 100%;
          font-family: inherit;
        }
        .pp-nav-item:hover {
          color: rgba(255,255,255,0.7);
          border-left-color: rgba(70, 114, 236, 0.3);
        }
        .pp-nav-item.active {
          color: #4672ec;
          border-left-color: #4672ec;
          background: rgba(70, 114, 236, 0.05);
        }

        .pp-section {
          scroll-margin-top: 120px;
        }

        .pp-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 32px;
          margin-bottom: 24px;
        }

        .pp-list-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 10px;
        }
        .pp-list-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4672ec, #8b5cf6);
          flex-shrink: 0;
          margin-top: 8px;
        }

        .pp-note {
          margin-top: 16px;
          padding: 16px 20px;
          background: rgba(70, 114, 236, 0.06);
          border: 1px solid rgba(70, 114, 236, 0.12);
          border-radius: 12px;
          font-size: 13px;
          color: rgba(255,255,255,0.5);
          line-height: 1.7;
        }

        .pp-contact-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          margin-bottom: 10px;
        }

        .pp-sidebar {
          position: sticky;
          top: 120px;
        }

        @media (max-width: 900px) {
          .pp-layout {
            grid-template-columns: 1fr !important;
          }
          .pp-sidebar-wrapper {
            display: none !important;
          }
          .pp-card {
            padding: 24px 20px;
          }
        }
      `}</style>

      {/* Noise */}
      <div className="pp-noise" />

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
          <a href="/" style={{ textDecoration: 'none' }}>
            <img
              src="/replyna-logo.webp"
              alt="Replyna"
              style={{ height: '32px', width: 'auto' }}
            />
          </a>
          <a
            href="/"
            style={{
              color: 'rgba(255,255,255,0.5)',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
              padding: '10px 20px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.1)',
              transition: 'all 0.2s ease',
            }}
          >
            ← Voltar ao site
          </a>
        </div>
      </header>

      {/* Hero */}
      <section style={{
        position: 'relative',
        paddingTop: '140px',
        paddingBottom: '60px',
        overflow: 'hidden',
        background: 'linear-gradient(to bottom, #0c1220 0%, #050508 100%)',
      }}>
        <div className="pp-orb" style={{
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(70, 114, 236, 0.3) 0%, transparent 70%)',
          top: '-200px',
          left: '-200px',
        }} />
        <div className="pp-orb" style={{
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 70%)',
          top: '-100px',
          right: '-100px',
        }} />
        <div className="pp-grid-pattern" />

        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(70, 114, 236, 0.1)',
            padding: '8px 18px',
            borderRadius: '50px',
            marginBottom: '24px',
            border: '1px solid rgba(70, 114, 236, 0.15)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4672ec" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span style={{ fontSize: '13px', color: '#4672ec', fontWeight: 600 }}>
              Privacidade & Proteção
            </span>
          </div>

          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            marginBottom: '16px',
            lineHeight: 1.1,
          }}>
            Política de <span className="pp-gradient-text">Privacidade</span>
          </h1>

          <p style={{
            fontSize: '17px',
            color: 'rgba(255,255,255,0.4)',
            maxWidth: '550px',
            margin: '0 auto 24px',
            lineHeight: 1.7,
          }}>
            Transparência e segurança no tratamento dos seus dados. Saiba como a Replyna protege suas informações.
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '13px',
            color: 'rgba(255,255,255,0.35)',
          }}>
            <span>Última atualização: 13 de Fevereiro de 2026</span>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
            <span>Versão 1.0</span>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div style={{
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
        margin: '0 auto',
        maxWidth: '1200px',
      }} />

      {/* Content */}
      <section style={{ padding: '60px 24px 100px' }}>
        <div className="pp-layout" style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '220px 1fr',
          gap: '48px',
          alignItems: 'start',
        }}>
          {/* Sidebar Nav */}
          <div className="pp-sidebar-wrapper">
            <div className="pp-sidebar" style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '16px',
              padding: '16px 0',
            }}>
              <div style={{
                padding: '0 16px 12px',
                fontSize: '11px',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.25)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}>
                Navegação
              </div>
              {navItems.map(item => (
                <button
                  key={item.id}
                  className={`pp-nav-item ${activeSection === item.id ? 'active' : ''}`}
                  onClick={() => scrollToSection(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div>
            {sections.map(section => (
              <div key={section.id} id={section.id} className="pp-section pp-card">
                <h2 style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  marginBottom: '20px',
                  letterSpacing: '-0.01em',
                }}>
                  {section.title}
                </h2>

                {section.content && (
                  <p style={{
                    fontSize: '15px',
                    color: 'rgba(255,255,255,0.55)',
                    lineHeight: 1.8,
                    marginBottom: section.items || section.subsections || section.contactInfo ? '20px' : '0',
                  }}>
                    {section.content}
                  </p>
                )}

                {section.items && (
                  <div>
                    {section.items.map((item, i) => (
                      <div key={i} className="pp-list-item">
                        <div className="pp-list-dot" />
                        <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {section.subsections && section.subsections.map((sub, i) => (
                  <div key={i} style={{ marginBottom: i < section.subsections!.length - 1 ? '24px' : '0' }}>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      marginBottom: '12px',
                      color: 'rgba(255,255,255,0.8)',
                    }}>
                      {sub.subtitle}
                    </h3>
                    {sub.description && (
                      <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                        {sub.description}
                      </p>
                    )}
                    {sub.items && sub.items.map((item, j) => (
                      <div key={j} className="pp-list-item">
                        <div className="pp-list-dot" />
                        <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}

                {section.contactInfo && (
                  <div>
                    {section.contactInfo.map((info, i) => (
                      <div key={i} className="pp-contact-item">
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, rgba(70, 114, 236, 0.15), rgba(139, 92, 246, 0.1))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {info.label === 'E-mail' && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4672ec" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="4" width="20" height="16" rx="2" />
                              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                            </svg>
                          )}
                          {info.label === 'WhatsApp' && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4672ec" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                          )}
                          {info.label === 'Site' && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4672ec" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="2" y1="12" x2="22" y2="12" />
                              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginBottom: '2px' }}>
                            {info.label}
                          </div>
                          <div style={{ fontSize: '14px', color: '#fff', fontWeight: 500 }}>
                            {info.value}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {section.note && (
                  <div className="pp-note">
                    {section.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '40px 24px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{
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
            <a href="/" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontSize: '14px' }}>
              Início
            </a>
            <a href="/termos" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontSize: '14px' }}>
              Termos de uso
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
