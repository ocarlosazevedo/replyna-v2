import { useState, useEffect, useCallback, createContext, useContext, createElement } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// Tipos de permissão
export interface TeamPermissions {
  conversations: { read: boolean; reply: boolean; close: boolean }
  shops: { read: boolean; edit: boolean }
  tickets: { read: boolean; reply: boolean }
  forms: { read: boolean; manage: boolean }
  billing: { read: boolean }
  team: { read: boolean; manage: boolean }
}

export interface TeamMembership {
  id: string
  owner_user_id: string
  role: 'viewer' | 'operator' | 'manager'
  allowed_shop_ids: string[]
  permissions: TeamPermissions
  created_at: string
  owner: {
    id: string
    name: string | null
    email: string
  } | null
  shops?: Array<{ id: string; name: string; shopify_domain?: string; is_active?: boolean }>
}

export interface TeamMember {
  id: string
  member_user_id: string
  role: 'viewer' | 'operator' | 'manager'
  allowed_shop_ids: string[]
  permissions: TeamPermissions
  created_at: string
  updated_at: string
  user: {
    id: string
    name: string | null
    email: string
  } | null
  shops: Array<{ id: string; name: string }>
}

export interface TeamInvite {
  id: string
  code: string
  invited_email: string
  invited_name: string | null
  role: 'viewer' | 'operator' | 'manager'
  allowed_shop_ids: string[]
  permissions: TeamPermissions
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  expires_at: string
  created_at: string
}

export type TeamContextType = 'own' | string // 'own' = minha conta, string = owner_user_id

interface UseTeamContextResult {
  // Contexto ativo
  activeContext: TeamContextType
  switchContext: (context: TeamContextType) => void
  isTeamContext: boolean

  // Memberships (equipes das quais sou membro)
  memberships: TeamMembership[]

  // Membros da minha equipe (sou owner)
  members: TeamMember[]

  // Convites pendentes
  invites: TeamInvite[]

  // Permissões do contexto ativo
  currentPermissions: TeamPermissions | null
  currentRole: string | null
  allowedShopIds: string[] | null // null = todas (contexto próprio)

  // Helpers
  hasPermission: (area: keyof TeamPermissions, action: string) => boolean
  isOwner: boolean

  // Estado
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const STORAGE_KEY = 'replyna_team_context'

const DEFAULT_PERMISSIONS: TeamPermissions = {
  conversations: { read: true, reply: true, close: true },
  shops: { read: true, edit: true },
  tickets: { read: true, reply: true },
  forms: { read: true, manage: true },
  billing: { read: true },
  team: { read: true, manage: true },
}

const DEFAULT_CONTEXT: UseTeamContextResult = {
  activeContext: 'own',
  switchContext: () => {},
  isTeamContext: false,
  memberships: [],
  members: [],
  invites: [],
  currentPermissions: DEFAULT_PERMISSIONS,
  currentRole: 'owner',
  allowedShopIds: null,
  hasPermission: () => true,
  isOwner: true,
  loading: true,
  error: null,
  refetch: async () => {},
}

const TeamContext = createContext<UseTeamContextResult>(DEFAULT_CONTEXT)

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [activeContext, setActiveContext] = useState<TeamContextType>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'own'
    } catch {
      return 'own'
    }
  })
  const [memberships, setMemberships] = useState<TeamMembership[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTeamData = useCallback(async () => {
    if (!user) {
      setMemberships([])
      setMembers([])
      setInvites([])
      // Não setar loading=false aqui — user pode estar null temporariamente
      // enquanto o auth ainda carrega. Manter loading=true até ter dados reais.
      return
    }

    if (!initialLoadDone) setLoading(true)
    setError(null)

    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      if (!token) throw new Error('No session')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      // Buscar membros e memberships
      const membersRes = await fetch(`${supabaseUrl}/functions/v1/team-members`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      })

      if (membersRes.ok) {
        const data = await membersRes.json()
        const fetchedMembers = data.members || []
        const fetchedMemberships = data.memberships || []
        setMembers(fetchedMembers)
        setMemberships(fetchedMemberships)

        // Se o usuário é membro de alguma equipe, forçar contexto para a equipe do owner
        if (fetchedMemberships.length > 0) {
          const ownerUserId = fetchedMemberships[0].owner_user_id
          setActiveContext(ownerUserId)
          localStorage.setItem(STORAGE_KEY, ownerUserId)
        } else if (activeContext !== 'own') {
          // Se não é membro de nenhuma equipe mas contexto não é 'own', resetar
          const stillMember = fetchedMemberships.some(
            (m: TeamMembership) => m.owner_user_id === activeContext
          )
          if (!stillMember) {
            setActiveContext('own')
            localStorage.setItem(STORAGE_KEY, 'own')
          }
        }
      }

      // Buscar convites pendentes (como owner)
      const invitesRes = await fetch(`${supabaseUrl}/functions/v1/team-invite`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      })

      if (invitesRes.ok) {
        const invitesData = await invitesRes.json()
        setInvites(invitesData.invites || [])
      }
    } catch (err) {
      console.error('Erro ao carregar dados de equipe:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
      setInitialLoadDone(true)
    }
  }, [user?.id])

  useEffect(() => {
    fetchTeamData()
  }, [fetchTeamData])

  const switchContext = useCallback((context: TeamContextType) => {
    // Membros de equipe não podem voltar para 'own'
    if (context === 'own' && memberships.length > 0) return
    setActiveContext(context)
    try {
      localStorage.setItem(STORAGE_KEY, context)
    } catch {
      // Ignore localStorage errors
    }
  }, [memberships])

  // Calcular permissões do contexto ativo
  const activeMembership = activeContext !== 'own'
    ? memberships.find((m) => m.owner_user_id === activeContext)
    : null

  const currentPermissions = activeMembership
    ? activeMembership.permissions
    : DEFAULT_PERMISSIONS

  const currentRole = activeMembership ? activeMembership.role : 'owner'

  const allowedShopIds = activeMembership
    ? activeMembership.allowed_shop_ids
    : null // null = todas (próprias)

  const hasPermission = useCallback(
    (area: keyof TeamPermissions, action: string): boolean => {
      if (activeContext === 'own') return true // Owner tem todas as permissões
      if (!currentPermissions) return false
      const areaPerms = currentPermissions[area]
      if (!areaPerms) return false
      return (areaPerms as Record<string, boolean>)[action] ?? false
    },
    [activeContext, currentPermissions]
  )

  const value: UseTeamContextResult = {
    activeContext,
    switchContext,
    isTeamContext: activeContext !== 'own',

    memberships,
    members,
    invites,

    currentPermissions,
    currentRole,
    allowedShopIds,

    hasPermission,
    isOwner: activeContext === 'own',

    loading,
    error,
    refetch: fetchTeamData,
  }

  return createElement(TeamContext.Provider, { value }, children)
}

export function useTeamContext(): UseTeamContextResult {
  return useContext(TeamContext)
}
