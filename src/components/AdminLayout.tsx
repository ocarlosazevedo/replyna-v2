import { Link, useLocation } from 'react-router-dom'
import { LayoutGrid, Users, Shield, CreditCard, Tag, DollarSign, LogOut } from 'lucide-react'
import { useAdmin } from '../context/AdminContext'

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { admin, signOut } = useAdmin()
  const location = useLocation()

  const menuItems = [
    { path: '/admin', label: 'Painel de Controle', icon: LayoutGrid },
    { path: '/admin/clients', label: 'Clientes', icon: Users },
    { path: '/admin/administrators', label: 'Administradores', icon: Shield },
    { path: '/admin/plans', label: 'Planos', icon: CreditCard },
    { path: '/admin/coupons', label: 'Cupons', icon: Tag },
    { path: '/admin/financial', label: 'Financeiro', icon: DollarSign },
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '264px',
          backgroundColor: '#1a1a2e',
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
        <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
            <img
              src="/replyna-logo.webp"
              alt="Replyna"
              style={{ width: '140px', height: 'auto' }}
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
        </div>

        {/* Menu */}
        <nav style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {menuItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: 500,
                    color: isActive(item.path) ? '#fff' : 'rgba(255,255,255,0.7)',
                    backgroundColor: isActive(item.path) ? 'var(--accent)' : 'transparent',
                    transition: 'all 0.2s ease',
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
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{
            padding: '12px 16px',
            marginBottom: '8px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              {admin?.name}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
              {admin?.role === 'super_admin' ? 'Super Admin' : 'Administrador'}
            </div>
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
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              backgroundColor: 'transparent',
              color: 'rgba(255,255,255,0.7)',
              transition: 'all 0.2s ease',
            }}
          >
            <LogOut size={18} />
            Sair do Painel Admin
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
