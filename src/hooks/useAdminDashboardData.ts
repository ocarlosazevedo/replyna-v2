import useSWR from 'swr'

interface DashboardStats {
  conversationsReceived: number
  conversationsReplied: number
  humanEmails: number
  automationRate: number
  successRate: number
  usersAtLimit: number
  categories: Record<string, number>
}

interface RecentConversation {
  id: string
  shop_id: string
  shop_name: string
  customer_email: string
  customer_name: string | null
  subject: string | null
  category: string | null
  created_at: string
  last_message_at: string | null
}

interface Client {
  id: string
  name: string | null
  email: string
  shops: string[]
}

interface AdminDashboardData {
  stats: DashboardStats | null
  recentConversations: RecentConversation[]
  clients: Client[]
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Configuração do SWR para admin
const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 30000, // 30 segundos para admin (atualização mais frequente)
  errorRetryCount: 2,
}

// Hook para dados do dashboard admin
export function useAdminDashboardStats(dateStart: Date | null, dateEnd: Date | null) {
  const key = dateStart && dateEnd
    ? ['admin-dashboard-stats', dateStart.toISOString(), dateEnd.toISOString()]
    : null

  return useSWR<AdminDashboardData>(
    key,
    async () => {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/admin-dashboard-stats?dateStart=${dateStart!.toISOString()}&dateEnd=${dateEnd!.toISOString()}`,
        {
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao carregar estatísticas')
      }

      const data = await response.json()
      return {
        stats: data.stats,
        recentConversations: data.recentConversations || [],
        clients: data.clients || [],
      }
    },
    swrConfig
  )
}

// Hook para lista de clientes admin
export function useAdminClients() {
  return useSWR<Client[]>(
    ['admin-clients'],
    async () => {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/admin-list-clients`,
        {
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Erro ao carregar clientes')
      }

      const data = await response.json()
      return data.clients || []
    },
    { ...swrConfig, revalidateIfStale: false }
  )
}

// Hook para dados financeiros admin
export function useAdminFinancialData(dateStart: Date | null, dateEnd: Date | null) {
  const key = dateStart && dateEnd
    ? ['admin-financial', dateStart.toISOString(), dateEnd.toISOString()]
    : null

  return useSWR(
    key,
    async () => {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/admin-financial-stats?dateStart=${dateStart!.toISOString()}&dateEnd=${dateEnd!.toISOString()}`,
        {
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Erro ao carregar dados financeiros')
      }

      return response.json()
    },
    swrConfig
  )
}
