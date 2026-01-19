import { createContext, useContext, ReactNode } from 'react'
import { useAdminAuth, Admin } from '../hooks/useAdminAuth'

interface AdminContextValue {
  admin: Admin | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  isAuthenticated: boolean
  isSuperAdmin: boolean
}

const AdminContext = createContext<AdminContextValue | null>(null)

export function AdminProvider({ children }: { children: ReactNode }) {
  const auth = useAdminAuth()

  return (
    <AdminContext.Provider value={auth}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const context = useContext(AdminContext)
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider')
  }
  return context
}
