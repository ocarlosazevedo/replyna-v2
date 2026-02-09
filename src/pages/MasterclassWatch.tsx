import { useEffect } from 'react'
import { CheckCircle2, ChevronRight } from 'lucide-react'

export default function MasterclassWatch() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="mcw-page">
      <style>{styles}</style>

      <header className="mcw-header">
        <img src="/replyna-logo.webp" alt="Replyna" className="mcw-logo" />
      </header>

      <div className="mcw-content">
        <div className="mcw-success">
          <CheckCircle2 size={48} color="#22c55e" />
        </div>

        <h1 className="mcw-title">Acesso Liberado!</h1>
        <p className="mcw-subtitle">Assista à masterclass completa agora</p>

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

        <div className="mcw-cta">
          <a href="https://app.replyna.me/register" className="mcw-btn">
            Quero testar a Replyna
            <ChevronRight size={20} />
          </a>
          <p className="mcw-coupon">
            Cupom <strong>CARLOS10</strong> = 10% off
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

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  .mcw-page {
    min-height: 100vh;
    min-height: 100dvh;
    background: #050508;
    color: #fff;
    font-family: "Inter", -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .mcw-header {
    padding: 20px;
    display: flex;
    justify-content: center;
  }

  .mcw-logo {
    height: 28px;
    width: auto;
    opacity: 0.9;
  }

  .mcw-content {
    max-width: 640px;
    margin: 0 auto;
    padding: 24px 20px 48px;
    text-align: center;
  }

  .mcw-success {
    margin-bottom: 16px;
  }

  .mcw-title {
    font-size: 28px;
    font-weight: 800;
    margin: 0 0 8px;
    letter-spacing: -0.02em;
  }

  .mcw-subtitle {
    font-size: 16px;
    color: rgba(255,255,255,0.6);
    margin: 0 0 28px;
  }

  .mcw-video-wrapper {
    margin-bottom: 32px;
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

  .mcw-cta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .mcw-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 18px 36px;
    background: linear-gradient(135deg, #4672ec 0%, #5b4dd6 100%);
    border-radius: 14px;
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    text-decoration: none;
    transition: all 0.25s;
    box-shadow: 0 4px 20px rgba(70, 114, 236, 0.25);
    letter-spacing: 0.02em;
  }

  .mcw-btn:active {
    transform: scale(0.97);
  }

  .mcw-coupon {
    font-size: 14px;
    color: rgba(255,255,255,0.5);
    margin: 0;
  }

  .mcw-coupon strong {
    color: #4ade80;
  }

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

  @media (min-width: 768px) {
    .mcw-content {
      padding: 48px 24px 64px;
    }

    .mcw-title {
      font-size: 36px;
    }

    .mcw-subtitle {
      font-size: 18px;
    }
  }

  @media (min-width: 1024px) {
    .mcw-header {
      padding: 32px 48px;
    }

    .mcw-logo {
      height: 32px;
    }

    .mcw-content {
      max-width: 720px;
      padding: 64px 24px 80px;
    }

    .mcw-title {
      font-size: 42px;
    }

    .mcw-btn:hover {
      box-shadow: 0 8px 24px rgba(70, 114, 236, 0.3);
      transform: translateY(-1px);
    }
  }
`
