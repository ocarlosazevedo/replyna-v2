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
      // Obter token de acesso do usuário
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-profile`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao carregar perfil')
      }

      const data = await response.json()
      setProfile(data.profile)
      setShops(data.shops || [])
    } catch (err) {
      console.error('Erro ao carregar perfil:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')

      // Fallback: tentar buscar diretamente (caso RLS permita)
      try {
        const { data: profileData } = await supabase
          .from('users')
          .select('id, email, name, plan, emails_limit, emails_used, shops_limit, status, created_at')
          .eq('id', user.id)
          .single()

        if (profileData) {
          setProfile(profileData)
          setError(null)
        }

        const { data: shopsData } = await supabase
          .from('shops')
          .select('id, name, shopify_domain, is_active')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (shopsData) {
          setShops(shopsData)
        }
      } catch {
        // Manter erro original
      }
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
