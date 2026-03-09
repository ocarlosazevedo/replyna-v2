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
      // Query direta via Supabase client (já autenticado, sem depender de edge function)
      const [profileResult, shopsResult] = await Promise.all([
        supabase
          .from('users')
          .select('id, email, name, plan, emails_limit, emails_used, shops_limit, status, created_at, is_trial, trial_started_at')
          .eq('id', user.id)
          .single(),
        supabase
          .from('shops')
          .select('id, name, shopify_domain, is_active')
          .eq('user_id', user.id)
          .order('name', { ascending: true }),
      ])

      if (profileResult.error) throw profileResult.error

      setProfile(profileResult.data)
      setShops(shopsResult.data || [])
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
