import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useUserProfile } from './hooks/useUserProfile'
import { AdminProvider, useAdmin } from './context/AdminContext'
import { NotificationProvider } from './context/NotificationContext'

// Componentes essenciais (carregam imediatamente)
import ErrorBoundary from './components/ErrorBoundary'
import { TeamProvider } from './hooks/useTeamContext'

// Loading spinner reutilizável
const PageSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
  </div>
)

// Lazy load - Pages (carregam sob demanda)
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const CheckoutSuccess = lazy(() => import('./pages/CheckoutSuccess'))
const Checkout = lazy(() => import('./pages/Checkout'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Shops = lazy(() => import('./pages/Shops'))
const ShopSetup = lazy(() => import('./pages/ShopSetup'))
const ShopDetails = lazy(() => import('./pages/ShopDetails'))
const Account = lazy(() => import('./pages/Account'))
const Plans = lazy(() => import('./pages/Plans'))
const TrialExpired = lazy(() => import('./pages/TrialExpired'))
const ConversationDetails = lazy(() => import('./pages/ConversationDetails'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const ChargebackPage = lazy(() => import('./pages/ChargebackPage'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const Masterclass = lazy(() => import('./pages/Masterclass'))
const MasterclassWatch = lazy(() => import('./pages/MasterclassWatch'))
const Tickets = lazy(() => import('./pages/Tickets'))
const Formularios = lazy(() => import('./pages/Formularios'))
const Migrate = lazy(() => import('./pages/Migrate'))
const ReturnRequest = lazy(() => import('./pages/ReturnRequest'))
const Team = lazy(() => import('./pages/Team'))
const TeamInvite = lazy(() => import('./pages/TeamInvite'))
const Partner = lazy(() => import('./pages/Partner'))

// Lazy load - Admin Pages
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminClients = lazy(() => import('./pages/admin/AdminClients'))
const AdminAdministrators = lazy(() => import('./pages/admin/AdminAdministrators'))
const AdminPlans = lazy(() => import('./pages/admin/AdminPlans'))
const AdminCoupons = lazy(() => import('./pages/admin/AdminCoupons'))
const AdminFinancial = lazy(() => import('./pages/admin/AdminFinancial'))
const AdminPartners = lazy(() => import('./pages/admin/AdminPartners'))
const AdminMigration = lazy(() => import('./pages/admin/AdminMigration'))
const MigrationAccept = lazy(() => import('./pages/MigrationAccept'))
const AuthConfirm = lazy(() => import('./pages/AuthConfirm'))

// Lazy load - Layouts (carregam quando necessário)
const DashboardLayout = lazy(() => import('./components/DashboardLayout'))
const AdminLayout = lazy(() => import('./components/AdminLayout'))

// Verifica se estamos no domínio da Landing Page (replyna.me sem subdomain)
const isLandingDomain = () => {
  const hostname = window.location.hostname
  // replyna.me (sem www ou subdomain) = landing page
  // app.replyna.me = app
  return hostname === 'replyna.me' || hostname === 'www.replyna.me'
}

const isLocalhost = () => {
  const hostname = window.location.hostname
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0'
}

const isLandingPath = () => {
  const pathname = window.location.pathname
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  const landingPaths = new Set([
    '/',
    '/chargeback',
    '/masterclass',
    '/masterclass/assistir',
    '/privacidade',
  ])
  return landingPaths.has(normalized)
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const { profile, loading: profileLoading } = useUserProfile()

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" />
  }

  const allowedWhenExpired = new Set(['/trial-expired', '/plans', '/checkout', '/checkout/success'])
  if (profile?.status === 'expired' && !allowedWhenExpired.has(location.pathname)) {
    return <Navigate to="/trial-expired" replace />
  }

  return <TeamProvider>{children}</TeamProvider>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" />
  }

  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAdmin()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid var(--border-color)',
          borderTopColor: '#ef4444',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
      </div>
    )
  }

  if (!admin) {
    return <Navigate to="/admin/login" />
  }

  return <>{children}</>
}

function AdminPublicRoute({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAdmin()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f0f23',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#ef4444',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
      </div>
    )
  }

  if (admin) {
    return <Navigate to="/admin" />
  }

  return <>{children}</>
}

function App() {
  // replyna.me sempre usa LP. No localhost, liberar LP apenas para rotas específicas.
  if (isLandingDomain() || (isLocalhost() && isLandingPath())) {
    return (
      <BrowserRouter>
        <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/masterclass" element={<Masterclass />} />
          <Route path="/masterclass/assistir" element={<MasterclassWatch />} />
          <Route path="/chargeback" element={<ChargebackPage />} />
          <Route path="/privacidade" element={<PrivacyPolicy />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    )
  }

  // Se estamos no domínio do app (app.replyna.me, localhost, etc), mostrar o app
  return (
    <BrowserRouter>
      <AdminProvider>
        <NotificationProvider>
        <ErrorBoundary>
        <Suspense fallback={<PageSpinner />}>
        <Routes>
          {/* Rotas publicas */}
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
          <Route path="/migrate" element={<Migrate />} />
          <Route path="/migrate/:code" element={<MigrationAccept />} />
          <Route path="/auth/confirm" element={<AuthConfirm />} />
          <Route path="/return-request" element={<ReturnRequest />} />

          {/* Rotas privadas */}
          <Route path="/dashboard" element={
            <PrivateRoute>
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            </PrivateRoute>
          } />
          <Route path="/tickets" element={
            <PrivateRoute>
              <DashboardLayout>
                <Tickets />
              </DashboardLayout>
            </PrivateRoute>
          } />
          <Route path="/shops" element={
            <PrivateRoute>
              <DashboardLayout>
                <Shops />
              </DashboardLayout>
            </PrivateRoute>
          } />
          <Route path="/shops/setup" element={
            <PrivateRoute>
              <DashboardLayout>
                <ShopSetup />
              </DashboardLayout>
            </PrivateRoute>
          } />
          <Route path="/shops/:shopId" element={
            <PrivateRoute>
              <DashboardLayout>
                <ShopDetails />
              </DashboardLayout>
            </PrivateRoute>
          } />
          <Route path="/formularios" element={
            <PrivateRoute>
              <DashboardLayout>
                <Formularios />
              </DashboardLayout>
            </PrivateRoute>
          } />
          
          <Route path="/team" element={
            <PrivateRoute>
              <DashboardLayout>
                <Team />
              </DashboardLayout>
            </PrivateRoute>
          } />
          <Route path="/team/invite/:code" element={<TeamInvite />} />
          <Route path="/partner" element={
            <PrivateRoute>
              <DashboardLayout>
                <Partner />
              </DashboardLayout>
            </PrivateRoute>
          } />
          <Route path="/account" element={
            <PrivateRoute>
              <DashboardLayout>
                <Account />
              </DashboardLayout>
            </PrivateRoute>
          } />
          <Route path="/plans" element={
            <PrivateRoute>
              <DashboardLayout>
                <Plans />
              </DashboardLayout>
            </PrivateRoute>
          } />
          <Route path="/trial-expired" element={
            <PrivateRoute>
              <DashboardLayout>
                <TrialExpired />
              </DashboardLayout>
            </PrivateRoute>
          } />
          <Route path="/conversations/:conversationId" element={
            <PrivateRoute>
              <DashboardLayout>
                <ConversationDetails />
              </DashboardLayout>
            </PrivateRoute>
          } />

          {/* Rotas Admin */}
          <Route path="/admin/login" element={
            <AdminPublicRoute>
              <AdminLogin />
            </AdminPublicRoute>
          } />
          <Route path="/admin" element={
            <AdminRoute>
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/clients" element={
            <AdminRoute>
              <AdminLayout>
                <AdminClients />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/administrators" element={
            <AdminRoute>
              <AdminLayout>
                <AdminAdministrators />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/plans" element={
            <AdminRoute>
              <AdminLayout>
                <AdminPlans />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/partners" element={
            <AdminRoute>
              <AdminLayout>
                <AdminPartners />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/coupons" element={
            <AdminRoute>
              <AdminLayout>
                <AdminCoupons />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/financial" element={
            <AdminRoute>
              <AdminLayout>
                <AdminFinancial />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/migration" element={
            <AdminRoute>
              <AdminLayout>
                <AdminMigration />
              </AdminLayout>
            </AdminRoute>
          } />

          {/* No app, redirecionar / para login ou dashboard */}
          <Route path="/" element={<Navigate to="/login" />} />

          {/* Redirect padrao */}
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
        </NotificationProvider>
      </AdminProvider>
    </BrowserRouter>
  )
}

export default App
