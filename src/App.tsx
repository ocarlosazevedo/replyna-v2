import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { AdminProvider, useAdmin } from './context/AdminContext'
import { NotificationProvider } from './context/NotificationContext'

// Pages
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import CheckoutSuccess from './pages/CheckoutSuccess'
import Dashboard from './pages/Dashboard'
import Shops from './pages/Shops'
import ShopSetup from './pages/ShopSetup'
import ShopDetails from './pages/ShopDetails'
import Account from './pages/Account'
import ConversationDetails from './pages/ConversationDetails'
import LandingPage from './pages/LandingPage'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Masterclass from './pages/Masterclass'
import MasterclassWatch from './pages/MasterclassWatch'

// Verifica se estamos no domínio da Landing Page (replyna.me sem subdomain)
const isLandingDomain = () => {
  const hostname = window.location.hostname
  // replyna.me (sem www ou subdomain) = landing page
  // app.replyna.me, localhost, etc = app
  return hostname === 'replyna.me' || hostname === 'www.replyna.me'
}

// Admin Pages
import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminClients from './pages/admin/AdminClients'
import AdminAdministrators from './pages/admin/AdminAdministrators'
import AdminPlans from './pages/admin/AdminPlans'
import AdminCoupons from './pages/admin/AdminCoupons'
import AdminFinancial from './pages/admin/AdminFinancial'
import AdminMigration from './pages/admin/AdminMigration'
import MigrationAccept from './pages/MigrationAccept'
import AuthConfirm from './pages/AuthConfirm'

// Components
import DashboardLayout from './components/DashboardLayout'
import AdminLayout from './components/AdminLayout'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" />
  }

  return <>{children}</>
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
  // Se estamos no domínio da landing page (replyna.me), mostrar LP e páginas de captura
  if (isLandingDomain()) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/masterclass" element={<Masterclass />} />
          <Route path="/masterclass/assistir" element={<MasterclassWatch />} />
          <Route path="/privacidade" element={<PrivacyPolicy />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </BrowserRouter>
    )
  }

  // Se estamos no domínio do app (app.replyna.me, localhost, etc), mostrar o app
  return (
    <BrowserRouter>
      <AdminProvider>
        <NotificationProvider>
        <Routes>
          {/* Rotas publicas */}
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
          <Route path="/migrate/:code" element={<MigrationAccept />} />
          <Route path="/auth/confirm" element={<AuthConfirm />} />

          {/* Rotas privadas */}
          <Route path="/dashboard" element={
            <PrivateRoute>
              <DashboardLayout>
                <Dashboard />
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
          <Route path="/account" element={
            <PrivateRoute>
              <DashboardLayout>
                <Account />
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
        </NotificationProvider>
      </AdminProvider>
    </BrowserRouter>
  )
}

export default App
