import { Link, useLocation } from 'react-router-dom'
import { LayoutGrid, Store, User, LogOut } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { signOut } = useAuth()
  const location = useLocation()

  const menuItems = [
    { path: '/dashboard', label: 'Painel de controle', icon: LayoutGrid },
    { path: '/shops', label: 'Minhas lojas', icon: Store },
  ]

  const handleLogout = async () => {
    await signOut()
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '264px',
          backgroundColor: 'var(--bg-sidebar)',
          color: 'var(--text-on-dark)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          inset: '0 auto 0 0',
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '24px', borderBottom: '1px solid var(--sidebar-border)' }}>
          <img
            src="/replyna-logo.webp"
            alt="Replyna"
            style={{ width: '180px', height: 'auto', display: 'block', margin: '0 auto' }}
          />
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
      </aside>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          padding: '32px 40px',
          backgroundColor: 'var(--bg-primary)',
          marginLeft: '264px',
          width: 'calc(100% - 264px)',
          minHeight: '100vh',
        }}
      >
        {children}
      </main>
    </div>
  )
}
