import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, signOut } = useAuth()
  const location = useLocation()

  const menuItems = [
    { path: '/dashboard', label: 'Painel', icon: '📊' },
    { path: '/shops', label: 'Minhas Lojas', icon: '🏪' },
    { path: '/account', label: 'Minha Conta', icon: '👤' },
  ]

  const handleLogout = async () => {
    await signOut()
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: '#f3f4f6' }}>
      {/* Sidebar */}
      <aside style={{ width: '256px', backgroundColor: '#0f172a', color: 'white', display: 'flex', flexDirection: 'column' }}>
        {/* Logo */}
        <div style={{ padding: '24px', borderBottom: '1px solid #334155' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#60a5fa' }}>Replyna</h1>
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
                    backgroundColor: isActive(item.path) ? '#2563eb' : 'transparent',
                    color: isActive(item.path) ? 'white' : '#cbd5e1',
                  }}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* User & Logout */}
        <div style={{ padding: '16px', borderTop: '1px solid #334155' }}>
          <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
              color: '#cbd5e1',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            <span>🚪</span>
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '32px' }}>
        {children}
      </main>
    </div>
  )
}
