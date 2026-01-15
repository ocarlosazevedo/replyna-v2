import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, signOut } = useAuth()
  const location = useLocation()

  const menuItems = [
    { path: '/dashboard', label: 'Painel' },
    { path: '/shops', label: 'Minhas Lojas' },
    { path: '/account', label: 'Minha Conta' },
  ]

  const handleLogout = async () => {
    await signOut()
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: '#f4f7ff' }}>
      {/* Sidebar */}
      <aside style={{ width: '264px', backgroundColor: '#0e1729', color: '#f5fafe', display: 'flex', flexDirection: 'column' }}>
        {/* Logo */}
        <div style={{ padding: '24px', borderBottom: '1px solid rgba(245, 250, 254, 0.12)' }}>
          <img
            src="/replyna-logo.webp"
            alt="Replyna"
            style={{ width: '160px', height: 'auto', display: 'block' }}
          />
        </div>

        {/* Menu */}
        <nav style={{ flex: 1, padding: '16px' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {menuItems.map((item) => (
              <li key={item.path} style={{ marginBottom: '8px' }}>
                <Link
                  to={item.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    backgroundColor: isActive(item.path) ? '#4672ec' : 'transparent',
                    color: isActive(item.path) ? '#f5fafe' : 'rgba(245, 250, 254, 0.72)',
                    fontWeight: 500,
                  }}
                >
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* User & Logout */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(245, 250, 254, 0.12)' }}>
          <div style={{ fontSize: '13px', color: 'rgba(245, 250, 254, 0.7)', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              color: 'rgba(245, 250, 254, 0.85)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: 500,
            }}
          >
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '32px 40px', backgroundColor: '#f4f7ff' }}>
        {children}
      </main>
    </div>
  )
}
