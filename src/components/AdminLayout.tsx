import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutGrid, Users, Shield, CreditCard, Tag, DollarSign, LogOut, Menu, X, UserPlus } from 'lucide-react'
import { useAdmin } from '../context/AdminContext'

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { admin, signOut } = useAdmin()
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
    { path: '/admin', label: 'Painel de Controle', icon: LayoutGrid },
    { path: '/admin/clients', label: 'Clientes', icon: Users },
    { path: '/admin/administrators', label: 'Administradores', icon: Shield },
    { path: '/admin/plans', label: 'Planos', icon: CreditCard },
    { path: '/admin/coupons', label: 'Cupons', icon: Tag },
    { path: '/admin/financial', label: 'Financeiro', icon: DollarSign },
    { path: '/admin/migration', label: 'Migração V1', icon: UserPlus },
  ]

  const handleLogout = async () => {
    await signOut()
  }

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin'
    }
    return location.pathname.startsWith(path)
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="/replyna-logo.webp"
            alt="Replyna"
            style={{ width: isMobile ? '140px' : '180px', height: 'auto' }}
          />
          <span style={{
            backgroundColor: 'var(--accent)',
            color: '#fff',
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '4px',
            textTransform: 'uppercase',
          }}>
            Admin
          </span>
        </div>
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
      <nav style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {menuItems.map((item) => (
            <li key={item.path}>
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
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Admin Info & Logout */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--sidebar-border)' }}>
        <div style={{
          padding: '12px 16px',
          marginBottom: '8px',
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: '8px',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-on-dark)' }}>
            {admin?.name}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
            {admin?.role === 'super_admin' ? 'Super Admin' : 'Administrador'}
          </div>
        </div>
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
          Sair do Painel Admin
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img
              src="/replyna-logo.webp"
              alt="Replyna"
              style={{ height: '32px', width: 'auto' }}
            />
            <span style={{
              backgroundColor: 'var(--accent)',
              color: '#fff',
              fontSize: '9px',
              fontWeight: 700,
              padding: '2px 5px',
              borderRadius: '4px',
              textTransform: 'uppercase',
            }}>
              Admin
            </span>
          </div>
          <div style={{ width: '40px' }} /> {/* Spacer para centralizar */}
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
    </div>
  )
}
