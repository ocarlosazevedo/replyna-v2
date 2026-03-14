import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutGrid, Store, Ticket, FileText, User, LogOut, Menu, X, Users, Handshake, CreditCard, AlertTriangle, type LucideIcon } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useUserProfile } from '../hooks/useUserProfile'
import { useTeamContext } from '../hooks/useTeamContext'
import { supabase } from '../lib/supabase'
import WhatsAppButton from './WhatsAppButton'
import { fetchBillingPortalUrl } from '../utils/billingPortal'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, signOut } = useAuth()
  const { shops, profile } = useUserProfile()
  const { isTeamContext, hasPermission, allowedShopIds, loading: teamLoading } = useTeamContext()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [ticketCount, setTicketCount] = useState(0)
  const [formsCount, setFormsCount] = useState(0)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)
  const [openingBillingPortal, setOpeningBillingPortal] = useState(false)

  // Detectar se é mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Buscar contagem de tickets e manter real-time
  useEffect(() => {
    // Em contexto de equipe, usar allowedShopIds; caso contrário, usar lojas próprias
    const shopIds = isTeamContext && allowedShopIds ? allowedShopIds : shops.map((s) => s.id)
    if (shopIds.length === 0) return

    const fetchCount = async () => {
      const { count } = await supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending_human')
        .eq('archived', false)
        .in('shop_id', shopIds)
        .in('category', ['suporte_humano', 'edicao_pedido'])
        .or('ticket_status.is.null,ticket_status.eq.pending,ticket_status.eq.reopened')
      setTicketCount(count ?? 0)
    }

    const fetchFormsCount = async () => {
      if (!user) return
      const { count } = await supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('archived', false)
        .in('shop_id', shopIds)
        .eq('category', 'troca_devolucao_reembolso')
        .not('form_data', 'is', null)
        .or('ticket_status.is.null,ticket_status.eq.pending,ticket_status.eq.reopened')
      setFormsCount(count ?? 0)
    }

    fetchCount()
    fetchFormsCount()

    const channel = supabase
      .channel('sidebar-ticket-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => { fetchCount(); fetchFormsCount() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [shops, isTeamContext, allowedShopIds])

  // Fechar menu ao mudar de página
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  // Buscar status da assinatura para aviso de inadimplencia
  useEffect(() => {
    if (!user) return
    let isMounted = true

    const loadSubscriptionStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('status')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error) {
          console.error('Erro ao carregar status da assinatura:', error)
          return
        }

        if (isMounted) {
          setSubscriptionStatus(data?.status ?? null)
        }
      } catch (err) {
        console.error('Erro ao carregar status da assinatura:', err)
      }
    }

    loadSubscriptionStatus()

    return () => {
      isMounted = false
    }
  }, [user])

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

  type MenuItem = {
    path: string
    label: string
    icon: LucideIcon
    badge?: number
  }

  const menuItems: MenuItem[] = [
    // Painel: sempre visível
    { path: '/dashboard', label: 'Painel de controle', icon: LayoutGrid },
    // Tickets: apenas se pode responder (operator/manager)
    ...(!isTeamContext || hasPermission('tickets', 'reply') ? [{ path: '/tickets', label: 'Tickets', icon: Ticket, badge: ticketCount }] : []),
    // Formulários: apenas se pode gerenciar (operator/manager)
    ...(!isTeamContext || hasPermission('forms', 'manage') ? [{ path: '/formularios', label: 'Formulários', icon: FileText, badge: formsCount }] : []),
    // Lojas: apenas se pode editar (manager)
    ...(!isTeamContext || hasPermission('shops', 'edit') ? [{ path: '/shops', label: isTeamContext ? 'Lojas' : 'Minhas lojas', icon: Store }] : []),
    // Equipe: owners sempre veem, membros só com permissão team.manage
    ...(!isTeamContext || hasPermission('team', 'manage') ? [{ path: '/team', label: 'Equipe', icon: Users }] : []),
    // Parceiro: apenas para conta de teste (temporário)
    ...(!isTeamContext && user?.email === 'gustavolsilva2003@gmail.com' ? [{ path: '/partner', label: 'Parceiro', icon: Handshake }] : []),
  ]

  const handleLogout = async () => {
    await signOut()
  }

  const isActive = (path: string) => location.pathname === path
  const isExpired = profile?.status === 'expired'
  const showPastDueBanner = subscriptionStatus === 'past_due' && !isExpired
  const bannerOffset = showPastDueBanner ? 56 : 0

  const handleOpenBillingPortal = async () => {
    if (!user || openingBillingPortal) return
    setOpeningBillingPortal(true)
    try {
      const url = await fetchBillingPortalUrl(user.id)
      window.location.href = url
    } catch (err) {
      console.error('Erro ao abrir fatura:', err)
    } finally {
      setOpeningBillingPortal(false)
    }
  }

  const upgradeItem: MenuItem = { path: '/plans', label: 'Planos e upgrade', icon: CreditCard }
  const visibleMenuItems: MenuItem[] = isExpired ? [upgradeItem, ...menuItems] : menuItems

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
          style={{ width: isMobile ? '140px' : '140px', height: 'auto', display: 'block' }}
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
        {teamLoading ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {[1, 2, 3, 4].map((i) => (
              <li key={i} style={{ marginBottom: '8px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 16px', borderRadius: '8px',
                }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', animation: 'replyna-pulse 1.6s ease-in-out infinite' }} />
                  <div style={{ flex: 1, height: 14, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', animation: 'replyna-pulse 1.6s ease-in-out infinite' }} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {visibleMenuItems.map((item) => {
              const isDisabled = isExpired && item.path !== '/plans'
              if (isDisabled) {
                return (
                  <li key={item.path} style={{ marginBottom: '8px' }}>
                    <div
                      className="replyna-sidebar-link"
                      aria-disabled="true"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontWeight: 500,
                        color: 'rgba(255, 255, 255, 0.45)',
                        cursor: 'not-allowed',
                        opacity: 0.7,
                      }}
                    >
                      <item.icon size={18} />
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {'badge' in item && (item.badge ?? 0) > 0 && (
                        <span style={{
                          backgroundColor: 'rgba(236, 72, 153, 0.2)',
                          color: '#f472b6',
                          padding: '1px 7px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          minWidth: '20px',
                          textAlign: 'center',
                        }}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </li>
                )
              }

              return (
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
                  {'badge' in item && (item.badge ?? 0) > 0 && (
                    <span style={{
                      backgroundColor: 'rgba(236, 72, 153, 0.2)',
                      color: '#f472b6',
                      padding: '1px 7px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      minWidth: '20px',
                      textAlign: 'center',
                    }}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
              )
            })}
          </ul>
        )}
      </nav>

      {/* User & Logout */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--sidebar-border)' }}>
        {!teamLoading && !isTeamContext && !isExpired && (
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
        )}
        {!teamLoading && !isTeamContext && isExpired && (
          <div
            className="replyna-sidebar-link"
            aria-disabled="true"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 16px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 500,
              gap: '12px',
              marginBottom: '8px',
              color: 'rgba(255, 255, 255, 0.45)',
              cursor: 'not-allowed',
              opacity: 0.7,
            }}
          >
            <User size={18} />
            Minha conta
          </div>
        )}
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
      {showPastDueBanner && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1105,
            backgroundColor: '#f59e0b',
            color: '#1f2937',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600 }}>
            <AlertTriangle size={18} />
            <span>Sua assinatura está com pagamento pendente. Regularize para continuar usando a Replyna.</span>
          </div>
          <button
            type="button"
            onClick={handleOpenBillingPortal}
            disabled={openingBillingPortal}
            style={{
              borderRadius: '8px',
              border: '1px solid rgba(31, 41, 55, 0.3)',
              backgroundColor: '#ffffff',
              color: '#1f2937',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: openingBillingPortal ? 'not-allowed' : 'pointer',
              opacity: openingBillingPortal ? 0.7 : 1,
            }}
          >
            {openingBillingPortal ? 'Abrindo...' : 'Regularizar pagamento'}
          </button>
        </div>
      )}

      {/* Mobile Header */}
      {isMobile && (
        <header
          style={{
            position: 'fixed',
            top: bannerOffset,
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
          {/* Spacer para manter logo centralizada */}
          <div style={{ width: '40px' }} />
        </header>
      )}

      {/* Mobile Menu Overlay */}
      {isMobile && isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            top: bannerOffset,
            right: 0,
            bottom: 0,
            left: 0,
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
          top: bannerOffset,
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
          padding: isMobile ? `${76 + bannerOffset}px 16px 24px` : '0',
          paddingTop: isMobile ? undefined : bannerOffset,
          backgroundColor: 'var(--bg-primary)',
          marginLeft: isMobile ? 0 : '264px',
          width: isMobile ? '100%' : 'calc(100% - 264px)',
          minHeight: '100vh',
          overflowX: 'hidden',
          maxWidth: isMobile ? '100vw' : undefined,
        }}
      >
        <div style={{ padding: isMobile ? '0' : '32px 40px' }}>
          {children}
        </div>
      </main>

      {/* Botão flutuante de WhatsApp */}
      {user?.email && <WhatsAppButton userEmail={user.email} />}
    </div>
  )
}
