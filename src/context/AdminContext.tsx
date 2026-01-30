import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useAdminAuth } from '../hooks/useAdminAuth'
import type { Admin } from '../hooks/useAdminAuth'
import { useSWRConfig } from 'swr'

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
  const { cache } = useSWRConfig()
  const [cacheCleared, setCacheCleared] = useState(false)

  // Limpar cache quando URL tiver ?reset=true
  useEffect(() => {
    if (cacheCleared) return

    const params = new URLSearchParams(window.location.search)
    if (params.get('reset') === 'true') {
      // Limpar localStorage (exceto credenciais se quiser manter logado)
      const adminSession = localStorage.getItem('replyna_admin_session')
      localStorage.clear()
      sessionStorage.clear()
      if (adminSession) {
        localStorage.setItem('replyna_admin_session', adminSession)
      }

      // Limpar cache do SWR
      if (cache && typeof (cache as Map<string, unknown>).clear === 'function') {
        (cache as Map<string, unknown>).clear()
      }

      setCacheCleared(true)

      // Remover ?reset=true da URL e recarregar
      const url = new URL(window.location.href)
      url.searchParams.delete('reset')
      window.history.replaceState({}, '', url.pathname + url.search)
      window.location.reload()
    }
  }, [cache, cacheCleared])

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
