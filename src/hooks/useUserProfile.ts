import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

interface UserProfile {
  id: string
  email: string
  name: string | null
  plan: string | null
  emails_limit: number | null
  emails_used: number | null
  shops_limit: number | null
  status: string | null
  created_at: string | null
  is_trial: boolean | null
  trial_started_at: string | null
  trial_ends_at: string | null
}

interface Shop {
  id: string
  name: string
  shopify_domain: string
  is_active: boolean
}

interface UseUserProfileResult {
  profile: UserProfile | null
  shops: Shop[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useUserProfile(): UseUserProfileResult {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = async () => {
    if (!user) {
      setProfile(null)
      setShops([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        throw new Error('Sessão inválida')
      }

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const doRequest = (accessToken: string) => fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-profile`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: anonKey,
          },
        }
      )

      let response = await doRequest(token)

      if (response.status === 401) {
        const { data: refreshed } = await supabase.auth.refreshSession()
        const refreshedToken = refreshed?.session?.access_token
        if (refreshedToken) {
          response = await doRequest(refreshedToken)
        }
      }

      const data = await response.json()

      if (response.status === 401) {
        await supabase.auth.signOut()
        throw new Error('Sessão expirada')
      }

      if (response.status === 402 && data?.code === 'TRIAL_EXPIRED') {
        setProfile(data.profile || null)
        setShops(data.shops || [])
        setError('TRIAL_EXPIRED')
        return
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao carregar perfil')
      }

      setProfile(data.profile || null)
      setShops(data.shops || [])
    } catch (err) {
      console.error('Erro ao carregar perfil:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [user?.id])

  return {
    profile,
    shops,
    loading,
    error,
    refetch: fetchProfile,
  }
}
