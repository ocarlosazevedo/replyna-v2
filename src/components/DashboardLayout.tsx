import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutGrid, Store, User, LogOut, Menu, X, PlayCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import WhatsAppButton from './WhatsAppButton'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detectar se é mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Fechar menu ao mudar de página
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  // Prevenir scroll quando menu está aberto
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  const menuItems = [
    { path: '/dashboard', label: 'Painel de controle', icon: LayoutGrid },
    { path: '/shops', label: 'Minhas lojas', icon: Store },
  ]

  const handleLogout = async () => {
    await signOut()
  }

  const isActive = (path: string) => location.pathname === path

  const sidebarContent = (
    <>
      {/* Logo */}
      <div style={{
        padding: isMobile ? '16px 20px' : '24px',
        borderBottom: '1px solid var(--sidebar-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <img
          src="/replyna-logo.webp"
          alt="Replyna"
          style={{ width: isMobile ? '140px' : '180px', height: 'auto', display: 'block' }}
        />
        {isMobile && (
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-on-dark)',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={24} />
          </button>
        )}
      </div>

      {/* Menu */}
      <nav style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {menuItems.map((item) => (
            <li key={item.path} style={{ marginBottom: '8px' }}>
              <Link
                to={item.path}
                className={`replyna-sidebar-link${isActive(item.path) ? ' active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                <item.icon size={18} />
                <span style={{ flex: 1 }}>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        {/* Tutorial Link */}
        <a
          href="https://youtu.be/PpoJjvGz0AY"
          target="_blank"
          rel="noopener noreferrer"
          className="replyna-sidebar-integrate"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 500,
            marginTop: '8px',
          }}
        >
          <PlayCircle size={18} />
          <span style={{ flex: 1 }}>Tutorial de integração</span>
        </a>
      </nav>

      {/* User & Logout */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--sidebar-border)' }}>
        <Link
          to="/account"
          className={`replyna-sidebar-link${isActive('/account') ? ' active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 500,
            gap: '12px',
            marginBottom: '8px',
          }}
        >
          <User size={18} />
          Minha conta
        </Link>
        <button
          onClick={handleLogout}
          className="replyna-sidebar-link replyna-sidebar-logout"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: 500,
          }}
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: 'var(--bg-primary)' }}>
      {/* Mobile Header */}
      {isMobile && (
        <header
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '60px',
            backgroundColor: 'var(--bg-sidebar)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            zIndex: 1000,
            borderBottom: '1px solid var(--sidebar-border)',
          }}
        >
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-on-dark)',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Menu size={24} />
          </button>
          <img
            src="/replyna-logo.webp"
            alt="Replyna"
            style={{ height: '32px', width: 'auto' }}
          />
          <div style={{ width: '40px' }} /> {/* Spacer para centralizar logo */}
        </header>
      )}

      {/* Mobile Menu Overlay */}
      {isMobile && isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1001,
          }}
        />
      )}

      {/* Sidebar - Desktop fixo, Mobile slide-in */}
      <aside
        style={{
          width: '264px',
          backgroundColor: 'var(--bg-sidebar)',
          color: 'var(--text-on-dark)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: isMobile ? (isMobileMenuOpen ? 0 : '-264px') : 0,
          bottom: 0,
          height: '100vh',
          overflow: 'hidden',
          zIndex: 1002,
          transition: isMobile ? 'left 0.3s ease' : 'none',
        }}
      >
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          padding: isMobile ? '76px 16px 24px' : '32px 40px',
          backgroundColor: 'var(--bg-primary)',
          marginLeft: isMobile ? 0 : '264px',
          width: isMobile ? '100%' : 'calc(100% - 264px)',
          minHeight: '100vh',
          overflowX: 'hidden',
          maxWidth: isMobile ? '100vw' : undefined,
        }}
      >
        {children}
      </main>

      {/* Botão flutuante de WhatsApp */}
      {user?.email && <WhatsAppButton userEmail={user.email} />}
    </div>
  )
}
