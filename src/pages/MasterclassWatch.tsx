import { useState, useEffect } from 'react'
import { ChevronRight, LogOut, Mail, Loader2, Play, AlertCircle } from 'lucide-react'

export default function MasterclassWatch() {
  const [authenticated, setAuthenticated] = useState(false)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)

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
    w.fbq('track', 'Lead', {
      content_name: 'leadisca',
      content_category: 'Masterclass',
    })

    return () => {
      document.head.removeChild(script)
    }
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)

    // Verificar se já tem email salvo no localStorage
    const savedEmail = localStorage.getItem('masterclass_email')
    if (savedEmail) {
      // Auto-verificar o email salvo
      verifyEmail(savedEmail, true)
    } else {
      setInitialLoading(false)
    }
  }, [])

  const verifyEmail = async (email: string, isAutoLogin = false) => {
    if (!isAutoLogin) setIsVerifying(true)
    setLoginError('')

    try {
      const response = await fetch('/api/verify-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() })
      })

      const data = await response.json()

      if (data.exists) {
        setUserEmail(email.toLowerCase().trim())
        setUserName(data.name || '')
        localStorage.setItem('masterclass_email', email.toLowerCase().trim())
        setAuthenticated(true)
      } else {
        if (!isAutoLogin) {
          setLoginError('E-mail não encontrado. Cadastre-se primeiro na página da masterclass.')
        }
        localStorage.removeItem('masterclass_email')
      }
    } catch {
      if (!isAutoLogin) {
        setLoginError('Erro de conexão. Tente novamente.')
      }
    } finally {
      setIsVerifying(false)
      setInitialLoading(false)
    }
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail.trim()) return
    verifyEmail(loginEmail)
  }

  const handleLogout = () => {
    localStorage.removeItem('masterclass_email')
    setAuthenticated(false)
    setUserEmail('')
    setUserName('')
    setLoginEmail('')
  }

  // ===== Loading screen =====
  if (initialLoading) {
    return (
      <div className="mcw-page">
        <style>{styles}</style>
        <div className="mcw-loading">
          <Loader2 size={32} className="mcw-spinner" />
        </div>
      </div>
    )
  }

  // ===== TELA 2: Login =====
  if (!authenticated) {
    return (
      <div className="mcw-page">
        <style>{styles}</style>

        <div className="mcw-login-wrapper">
          <div className="mcw-login-card">
            <img src="/replyna-logo.webp" alt="Replyna" className="mcw-login-logo" />

            <h1 className="mcw-login-title">Área de Membros</h1>
            <p className="mcw-login-subtitle">
              Digite o e-mail que você usou no cadastro para acessar a masterclass
            </p>

            <form onSubmit={handleLogin} className="mcw-login-form">
              <div className="mcw-login-field">
                <Mail size={18} className="mcw-login-field-icon" />
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={loginEmail}
                  onChange={(e) => { setLoginEmail(e.target.value); setLoginError('') }}
                  required
                  autoFocus
                />
              </div>

              {loginError && (
                <div className="mcw-login-error">
                  <AlertCircle size={14} />
                  <span>{loginError}</span>
                </div>
              )}

              <button type="submit" className="mcw-login-btn" disabled={isVerifying || !loginEmail.trim()}>
                {isVerifying ? (
                  <>
                    <Loader2 size={18} className="mcw-spinner" />
                    Verificando...
                  </>
                ) : (
                  <>
                    Acessar Masterclass
                    <ChevronRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="mcw-login-divider" />

            <p className="mcw-login-info">
              Ainda não se cadastrou?{' '}
              <a href="/masterclass">Cadastre-se gratuitamente</a>
            </p>

            <p className="mcw-login-tip">
              Para reassistir o material, basta acessar esta página e fazer login com seu e-mail novamente.
            </p>
          </div>
        </div>

        <footer className="mcw-footer">
          <img src="/replyna-logo.webp" alt="Replyna" />
          <span>&copy; {new Date().getFullYear()} Replyna</span>
        </footer>
      </div>
    )
  }

  // ===== TELA 3: Área de Membros =====
  return (
    <div className="mcw-page">
      <style>{styles}</style>

      {/* Header com info do usuário */}
      <header className="mcw-header mcw-header-auth">
        <img src="/replyna-logo.webp" alt="Replyna" className="mcw-logo" />
        <div className="mcw-user-info">
          <span className="mcw-user-email">{userEmail}</span>
          <button onClick={handleLogout} className="mcw-logout-btn" title="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Área de membros */}
      <div className="mcw-members">
        {/* Video Player */}
        <main className="mcw-main">
          <div className="mcw-video-wrapper">
            <div className="mcw-video-container">
              <iframe
                src="https://www.youtube.com/embed/VIDEO_ID_AQUI?rel=0&modestbranding=1"
                title="Masterclass Anti-Chargeback"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>

          {/* CTA Mobile (aparece abaixo do vídeo no mobile) */}
          <div className="mcw-mobile-cta">
            <a href="https://app.replyna.me/register" className="mcw-cta-btn">
              Quero testar a Replyna
              <ChevronRight size={18} />
            </a>
            <p className="mcw-cta-coupon">
              Cupom <strong>MASTERCLASS20</strong> = 20% off
            </p>
          </div>
        </main>

        {/* Sidebar / Info */}
        <aside className="mcw-sidebar">
          <div className="mcw-sidebar-badge">
            <Play size={14} />
            <span>Masterclass</span>
          </div>

          <h2 className="mcw-sidebar-title">
            Como Reduzir 90% dos Chargebacks e Proteger sua Conta
          </h2>

          <div className="mcw-sidebar-instructor">
            <img src="/influencers/carlos-azevedo.jpg" alt="Carlos Azevedo" className="mcw-sidebar-avatar" />
            <div>
              <strong>Carlos Azevedo</strong>
              <span>Empresário & Especialista em E-commerce Global</span>
            </div>
          </div>

          <p className="mcw-sidebar-desc">
            {userName ? `Olá, ${userName}! ` : ''}Empresário com mais de 6 anos no mercado de e-commerce global.
            Pioneiro em dropshipping global, Google Ads e Shopify Payments.
            Compartilho as estratégias que uso para faturar +$500K/mês com margem de até 40%.
          </p>

          {/* CTA */}
          <div className="mcw-sidebar-cta">
            <a href="https://app.replyna.me/register" className="mcw-cta-btn">
              Quero testar a Replyna
              <ChevronRight size={18} />
            </a>
            <p className="mcw-cta-coupon">
              Cupom <strong>MASTERCLASS20</strong> = 20% off
            </p>
          </div>
        </aside>
      </div>

      <footer className="mcw-footer">
        <img src="/replyna-logo.webp" alt="Replyna" />
        <span>&copy; {new Date().getFullYear()} Replyna</span>
      </footer>
    </div>
  )
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  .mcw-page {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background: #0a1628;
    color: #fff;
    font-family: "Inter", -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  /* ===== LOADING ===== */
  .mcw-loading {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mcw-spinner {
    animation: mcw-spin 1s linear infinite;
    color: #1E90FF;
  }

  @keyframes mcw-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* ===== HEADER ===== */
  .mcw-header {
    padding: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .mcw-header-auth {
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .mcw-logo {
    height: 28px;
    width: auto;
    opacity: 0.9;
  }

  .mcw-user-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .mcw-user-email {
    font-size: 13px;
    color: rgba(255,255,255,0.5);
    display: none;
  }

  .mcw-logout-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.03);
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    transition: all 0.2s;
  }

  .mcw-logout-btn:hover {
    border-color: rgba(255,255,255,0.2);
    color: rgba(255,255,255,0.8);
    background: rgba(255,255,255,0.06);
  }

  /* ===== TELA 2: LOGIN ===== */
  .mcw-login-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 24px 20px;
  }

  .mcw-login-card {
    width: 100%;
    max-width: 420px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 24px;
    padding: 40px 28px;
    text-align: center;
  }

  .mcw-login-logo {
    height: 36px;
    width: auto;
    margin: 0 auto 20px;
    display: block;
    opacity: 0.9;
  }

  .mcw-login-title {
    font-size: 24px;
    font-weight: 800;
    margin: 0 0 8px;
    letter-spacing: -0.02em;
  }

  .mcw-login-subtitle {
    font-size: 14px;
    color: rgba(255,255,255,0.5);
    margin: 0 0 28px;
    line-height: 1.6;
  }

  .mcw-login-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .mcw-login-field {
    position: relative;
  }

  .mcw-login-field-icon {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: rgba(255,255,255,0.3);
    pointer-events: none;
  }

  .mcw-login-field input {
    width: 100%;
    padding: 16px 16px 16px 46px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 14px;
    color: #fff;
    font-size: 15px;
    font-family: inherit;
    outline: none;
    transition: all 0.2s;
    box-sizing: border-box;
  }

  .mcw-login-field input:focus {
    border-color: rgba(30,144,255,0.5);
    background: rgba(255,255,255,0.07);
    box-shadow: 0 0 0 3px rgba(30,144,255,0.1);
  }

  .mcw-login-field input::placeholder {
    color: rgba(255,255,255,0.25);
  }

  .mcw-login-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 12px;
    font-size: 13px;
    color: #f87171;
    text-align: left;
  }

  .mcw-login-error svg {
    flex-shrink: 0;
  }

  .mcw-login-btn {
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
    transition: all 0.25s;
    box-shadow: 0 4px 20px rgba(30,144,255,0.25);
    letter-spacing: 0.02em;
    font-family: inherit;
  }

  .mcw-login-btn:active {
    transform: scale(0.97);
  }

  .mcw-login-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .mcw-login-divider {
    height: 1px;
    background: rgba(255,255,255,0.08);
    margin: 24px 0;
  }

  .mcw-login-info {
    font-size: 14px;
    color: rgba(255,255,255,0.5);
    margin: 0 0 12px;
  }

  .mcw-login-info a {
    color: #1E90FF;
    text-decoration: none;
    font-weight: 600;
  }

  .mcw-login-info a:hover {
    text-decoration: underline;
  }

  .mcw-login-tip {
    font-size: 12px;
    color: rgba(255,255,255,0.3);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== TELA 3: MEMBERS AREA ===== */
  .mcw-members {
    max-width: 1000px;
    margin: 0 auto;
    padding: 24px 20px 48px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* Video */
  .mcw-main {
    width: 100%;
  }

  .mcw-video-wrapper {
    margin-bottom: 24px;
  }

  .mcw-video-container {
    position: relative;
    width: 100%;
    padding-bottom: 56.25%;
    border-radius: 16px;
    overflow: hidden;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
  }

  .mcw-video-container iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
  }

  /* Sidebar */
  .mcw-sidebar {
    width: 100%;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 24px;
  }

  .mcw-sidebar-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, rgba(30,144,255,0.15), rgba(32,178,170,0.1));
    border: 1px solid rgba(30,144,255,0.3);
    color: #1E90FF;
    padding: 6px 14px;
    border-radius: 50px;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 16px;
  }

  .mcw-sidebar-title {
    font-size: 20px;
    font-weight: 800;
    line-height: 1.3;
    margin: 0 0 20px;
    letter-spacing: -0.02em;
  }

  .mcw-sidebar-instructor {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px;
    margin-bottom: 16px;
  }

  .mcw-sidebar-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(30,144,255,0.3);
  }

  .mcw-sidebar-instructor > div {
    display: flex;
    flex-direction: column;
  }

  .mcw-sidebar-instructor strong {
    font-size: 14px;
    font-weight: 700;
  }

  .mcw-sidebar-instructor span {
    font-size: 12px;
    color: #1E90FF;
  }

  .mcw-sidebar-desc {
    font-size: 14px;
    line-height: 1.7;
    color: rgba(255,255,255,0.5);
    margin: 0 0 20px;
  }

  /* CTA section */
  .mcw-sidebar-cta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding-top: 20px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .mcw-cta-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 16px 24px;
    background: #1E90FF;
    border-radius: 14px;
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    text-decoration: none;
    transition: all 0.25s;
    box-shadow: 0 4px 20px rgba(30,144,255,0.25);
    letter-spacing: 0.02em;
    text-align: center;
  }

  .mcw-cta-btn:active {
    transform: scale(0.97);
  }

  .mcw-cta-coupon {
    font-size: 13px;
    color: rgba(255,255,255,0.45);
    margin: 0;
  }

  .mcw-cta-coupon strong {
    color: #4ade80;
  }

  /* Mobile CTA (shown below video on mobile, hidden on desktop) */
  .mcw-mobile-cta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  /* ===== FOOTER ===== */
  .mcw-footer {
    padding: 24px 20px;
    border-top: 1px solid rgba(255,255,255,0.06);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .mcw-footer img {
    height: 20px;
    opacity: 0.4;
  }

  .mcw-footer span {
    font-size: 12px;
    color: rgba(255,255,255,0.3);
  }

  /* ===== TABLET (768px) ===== */
  @media (min-width: 768px) {
    .mcw-login-card {
      padding: 48px 36px;
    }

    .mcw-login-title {
      font-size: 28px;
    }

    .mcw-user-email {
      display: inline;
    }

    .mcw-sidebar-title {
      font-size: 22px;
    }
  }

  /* ===== DESKTOP (1024px) ===== */
  @media (min-width: 1024px) {
    .mcw-header {
      padding: 20px 40px;
    }

    .mcw-header-auth {
      padding: 16px 40px;
    }

    .mcw-logo {
      height: 30px;
    }

    .mcw-login-btn:hover:not(:disabled) {
      background: #0C7CD5;
      box-shadow: 0 8px 24px rgba(30,144,255,0.3);
    }

    .mcw-login-field input:hover {
      border-color: rgba(255,255,255,0.2);
    }

    /* Members area: side-by-side layout */
    .mcw-members {
      flex-direction: row;
      align-items: flex-start;
      gap: 32px;
      padding: 32px 40px 64px;
    }

    .mcw-sidebar {
      width: 340px;
      flex-shrink: 0;
      position: sticky;
      top: 24px;
    }

    .mcw-main {
      flex: 1;
      min-width: 0;
    }

    /* Hide mobile CTA on desktop (sidebar has it) */
    .mcw-mobile-cta {
      display: none;
    }

    .mcw-cta-btn:hover {
      background: #0C7CD5;
      box-shadow: 0 8px 24px rgba(30,144,255,0.3);
      transform: translateY(-1px);
    }
  }

  /* ===== LARGE DESKTOP (1280px) ===== */
  @media (min-width: 1280px) {
    .mcw-members {
      max-width: 1100px;
      gap: 40px;
    }

    .mcw-sidebar {
      width: 380px;
      padding: 28px;
    }

    .mcw-sidebar-title {
      font-size: 24px;
    }
  }
`
