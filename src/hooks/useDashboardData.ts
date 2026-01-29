import useSWR from 'swr'
import { supabase } from '../lib/supabase'

interface ShopOption {
  id: string
  name: string
}

interface UserProfile {
  name: string | null
  plan: string | null
  emails_limit: number | null
  emails_used: number | null
  shops_limit: number | null
  created_at: string | null
  extra_emails_purchased: number | null
  extra_emails_used: number | null
}

interface ConversationRow {
  id: string
  shop_id: string
  customer_email: string
  customer_name: string | null
  subject: string | null
  category: string | null
  status: string | null
  created_at: string
  shop_name?: string
}

interface MessageRow {
  created_at: string
  direction: string
  was_auto_replied: boolean | null
  category: string | null
  conversation_id: string
  conversations: { shop_id: string; category: string | null }[]
}

// Configuração padrão do SWR - cache de 5 minutos
const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 60000, // Dedupe requests por 1 minuto
  errorRetryCount: 2,
}

// Hook para perfil do usuário
export function useUserProfile(userId: string | undefined) {
  return useSWR<UserProfile | null>(
    userId ? ['profile', userId] : null,
    async () => {
      const { data, error } = await supabase
        .from('users')
        .select('name, plan, emails_limit, emails_used, shops_limit, created_at, extra_emails_purchased, extra_emails_used')
        .eq('id', userId!)
        .maybeSingle()
      if (error) throw error
      return data as UserProfile | null
    },
    { ...swrConfig, revalidateIfStale: false }
  )
}

// Hook para lojas do usuário
export function useUserShops(userId: string | undefined) {
  return useSWR<ShopOption[]>(
    userId ? ['shops', userId] : null,
    async () => {
      const { data, error } = await supabase
        .from('shops')
        .select('id, name')
        .eq('user_id', userId!)
        .eq('is_active', true)
        .order('name', { ascending: true })
      if (error) throw error
      return (data || []) as ShopOption[]
    },
    { ...swrConfig, revalidateIfStale: false }
  )
}

// Hook para contagem de conversas (métricas)
export function useConversationCounts(
  userId: string | undefined,
  shopIds: string[],
  dateStart: Date | null,
  dateEnd: Date | null,
  selectedShopId: string
) {
  const key = userId && dateStart && dateEnd && shopIds.length > 0
    ? ['conversation-counts', userId, selectedShopId, dateStart.toISOString(), dateEnd.toISOString()]
    : null

  return useSWR<{ conversationsReceived: number; conversationsReplied: number; pendingHuman: number }>(
    key,
    async () => {
      const effectiveShopIds = selectedShopId === 'all' ? shopIds : [selectedShopId]

      // Query para conversas recebidas
      const receivedBaseQuery = supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dateStart!.toISOString())
        .lte('created_at', dateEnd!.toISOString())
        .not('category', 'in', '("spam","acknowledgment")')

      const receivedQuery = selectedShopId === 'all'
        ? receivedBaseQuery.in('shop_id', effectiveShopIds)
        : receivedBaseQuery.eq('shop_id', selectedShopId)

      // Query para conversas respondidas
      const repliedBaseQuery = supabase
        .from('conversations')
        .select('id, messages!inner(direction)', { count: 'exact', head: true })
        .gte('created_at', dateStart!.toISOString())
        .lte('created_at', dateEnd!.toISOString())
        .not('category', 'in', '("spam","acknowledgment")')
        .eq('messages.direction', 'outbound')

      const repliedQuery = selectedShopId === 'all'
        ? repliedBaseQuery.in('shop_id', effectiveShopIds)
        : repliedBaseQuery.eq('shop_id', selectedShopId)

      // Query para pending human
      const pendingBaseQuery = supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dateStart!.toISOString())
        .lte('created_at', dateEnd!.toISOString())
        .eq('status', 'pending_human')
        .neq('category', 'troca_devolucao_reembolso')

      const pendingQuery = selectedShopId === 'all'
        ? pendingBaseQuery.in('shop_id', effectiveShopIds)
        : pendingBaseQuery.eq('shop_id', selectedShopId)

      const [receivedResult, repliedResult, pendingResult] = await Promise.all([
        receivedQuery,
        repliedQuery,
        pendingQuery,
      ])

      if (receivedResult.error) throw receivedResult.error
      if (repliedResult.error) throw repliedResult.error
      if (pendingResult.error) throw pendingResult.error

      return {
        conversationsReceived: receivedResult.count ?? 0,
        conversationsReplied: repliedResult.count ?? 0,
        pendingHuman: pendingResult.count ?? 0,
      }
    },
    swrConfig
  )
}

// Hook para lista de conversas
export function useConversationsList(
  userId: string | undefined,
  shopIds: string[],
  dateStart: Date | null,
  dateEnd: Date | null,
  selectedShopId: string
) {
  const key = userId && dateStart && dateEnd && shopIds.length > 0
    ? ['conversations-list', userId, selectedShopId, dateStart.toISOString(), dateEnd.toISOString()]
    : null

  return useSWR<ConversationRow[]>(
    key,
    async () => {
      const query = supabase
        .from('conversations')
        .select('id, shop_id, customer_email, customer_name, subject, category, status, created_at, shops(name)')
        .not('category', 'is', null)
        .gte('created_at', dateStart!.toISOString())
        .lte('created_at', dateEnd!.toISOString())
        .order('created_at', { ascending: false })
        .limit(200)

      const { data, error } = selectedShopId === 'all'
        ? await query.in('shop_id', shopIds)
        : await query.eq('shop_id', selectedShopId)

      if (error) throw error

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data || []).map((row: any) => ({
        id: row.id,
        shop_id: row.shop_id,
        customer_email: row.customer_email,
        customer_name: row.customer_name,
        subject: row.subject,
        category: row.category,
        status: row.status,
        created_at: row.created_at,
        shop_name: row.shops?.name || (Array.isArray(row.shops) ? row.shops[0]?.name : null) || null,
      })) as ConversationRow[]
    },
    swrConfig
  )
}

// Hook para mensagens (gráfico)
export function useMessagesForChart(
  userId: string | undefined,
  shopIds: string[],
  dateStart: Date | null,
  dateEnd: Date | null,
  selectedShopId: string
) {
  const key = userId && dateStart && dateEnd && shopIds.length > 0
    ? ['messages-chart', userId, selectedShopId, dateStart.toISOString(), dateEnd.toISOString()]
    : null

  return useSWR<MessageRow[]>(
    key,
    async () => {
      const query = supabase
        .from('messages')
        .select('created_at, direction, was_auto_replied, category, conversation_id, conversations!inner(shop_id, category)')
        .gte('created_at', dateStart!.toISOString())
        .lte('created_at', dateEnd!.toISOString())
        .limit(2000)

      const { data, error } = selectedShopId === 'all'
        ? await query.in('conversations.shop_id', shopIds)
        : await query.eq('conversations.shop_id', selectedShopId)

      if (error) throw error
      return (data || []) as MessageRow[]
    },
    { ...swrConfig, revalidateIfStale: true } // Gráfico pode revalidar
  )
}
