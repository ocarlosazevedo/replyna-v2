import { createContext, useContext, type ReactNode } from 'react'
import type { UseUserProfileResult } from './useUserProfile'

const ProfileContext = createContext<UseUserProfileResult | null>(null)

interface ProfileProviderProps {
  value: UseUserProfileResult
  children: ReactNode
}

export function ProfileProvider({ value, children }: ProfileProviderProps) {
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfileContext() {
  const context = useContext(ProfileContext)
  if (!context) {
    throw new Error('useProfileContext must be used within ProfileProvider')
  }
  return context
}
