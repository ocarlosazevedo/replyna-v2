import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react'

export interface Notification {
  id: string
  type: 'feature' | 'tip' | 'alert' | 'error'
  priority: 'low' | 'medium' | 'high'
  title: string
  description: string
  icon: 'Sparkles' | 'Lightbulb' | 'Bell' | 'AlertTriangle' | 'XCircle'
  color: string
  actionLabel?: string
  actionLink?: string
  createdAt: string
  persistent?: boolean
}

interface DynamicAlerts {
  noCredits?: boolean
  shopifyError?: { shopId: string; shopName: string } | null
  emailError?: { shopId: string; shopName: string } | null
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  hasCriticalAlert: boolean
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  isRead: (id: string) => boolean
  setDynamicAlerts: (alerts: DynamicAlerts) => void
  setShopId: (shopId: string | null) => void
  setUserId: (userId: string | undefined) => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

const STORAGE_KEY_PREFIX = 'replyna_notifications_seen_'

// Notificações estáticas de funcionalidades (ordenadas da mais recente para mais antiga)
const FEATURE_NOTIFICATIONS: Omit<Notification, 'actionLink'>[] = [
  {
    id: 'notification-center-v1',
    type: 'feature',
    priority: 'low',
    title: 'Nova central de notificações',
    description: 'Agora você tem uma central de notificações para acompanhar atualizações, novas funcionalidades e alertas importantes.',
    icon: 'Bell',
    color: '#10b981',
    createdAt: '2025-02-06',
  },
  {
    id: 'auto-responder-detection-v1',
    type: 'tip',
    priority: 'low',
    title: 'Melhoria: Detecção de auto-responder',
    description: 'A IA agora detecta automaticamente mensagens de férias/ausência e evita loops de respostas automáticas.',
    icon: 'Lightbulb',
    color: '#3b82f6',
    createdAt: '2025-02-05',
  },
  {
    id: 'alternative-email-search-v1',
    type: 'tip',
    priority: 'low',
    title: 'Melhoria: Busca de pedidos aprimorada',
    description: 'Quando o cliente usa um email diferente do cadastrado no pedido, a IA agora busca automaticamente por emails alternativos mencionados na mensagem.',
    icon: 'Lightbulb',
    color: '#3b82f6',
    createdAt: '2025-02-04',
  },
  {
    id: 'ai-instructions-v1',
    type: 'feature',
    priority: 'low',
    title: 'Nova funcionalidade: Instruções personalizadas para IA',
    description: 'Adicione instruções específicas na descrição da loja para personalizar as respostas da IA.',
    icon: 'Sparkles',
    color: '#8b5cf6',
    actionLabel: 'Configurar instruções',
    createdAt: '2025-01-20',
  },
  {
    id: 'retention-coupon-v2',
    type: 'feature',
    priority: 'low',
    title: 'Nova funcionalidade: Cupom de retenção',
    description: 'Configure um cupom de desconto que a IA oferecerá automaticamente para clientes que desejam cancelar ou devolver pedidos.',
    icon: 'Lightbulb',
    color: '#3b82f6',
    actionLabel: 'Configurar cupom',
    createdAt: '2025-01-15',
  },
]

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | undefined>()
  const [shopId, setShopId] = useState<string | null>(null)
  const [dynamicAlerts, setDynamicAlerts] = useState<DynamicAlerts>({})
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set())

  // Carregar notificações vistas do localStorage
  useEffect(() => {
    if (!userId) return
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + userId)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setSeenIds(new Set(parsed))
      } catch {
        setSeenIds(new Set())
      }
    }
  }, [userId])

  // Salvar notificações vistas no localStorage
  const saveSeenIds = useCallback((ids: Set<string>) => {
    if (!userId) return
    localStorage.setItem(STORAGE_KEY_PREFIX + userId, JSON.stringify([...ids]))
  }, [userId])

  // Gerar todas as notificações (estáticas + dinâmicas)
  const notifications = useMemo<Notification[]>(() => {
    const all: Notification[] = []

    // Adicionar notificações de funcionalidades com link da loja
    FEATURE_NOTIFICATIONS.forEach(n => {
      all.push({
        ...n,
        actionLink: shopId ? `/shops/${shopId}` : '/shops',
      })
    })

    // Adicionar alertas dinâmicos (críticos)
    if (dynamicAlerts.noCredits) {
      all.push({
        id: 'no-credits',
        type: 'alert',
        priority: 'high',
        title: 'Seus créditos acabaram!',
        description: 'Você usou todos os seus créditos. Novos emails não estão sendo respondidos automaticamente.',
        icon: 'AlertTriangle',
        color: '#ef4444',
        actionLabel: 'Fazer upgrade',
        actionLink: '/account',
        createdAt: new Date().toISOString(),
        persistent: true,
      })
    }

    if (dynamicAlerts.shopifyError) {
      all.push({
        id: `shopify-error-${dynamicAlerts.shopifyError.shopId}`,
        type: 'error',
        priority: 'high',
        title: 'Erro na conexão Shopify',
        description: `A loja "${dynamicAlerts.shopifyError.shopName}" está com problemas na integração com o Shopify.`,
        icon: 'XCircle',
        color: '#f97316',
        actionLabel: 'Verificar conexão',
        actionLink: `/shops/${dynamicAlerts.shopifyError.shopId}`,
        createdAt: new Date().toISOString(),
        persistent: true,
      })
    }

    if (dynamicAlerts.emailError) {
      all.push({
        id: `email-error-${dynamicAlerts.emailError.shopId}`,
        type: 'error',
        priority: 'high',
        title: 'Erro na conexão de Email',
        description: `A loja "${dynamicAlerts.emailError.shopName}" está com problemas na conexão de email.`,
        icon: 'XCircle',
        color: '#f97316',
        actionLabel: 'Verificar conexão',
        actionLink: `/shops/${dynamicAlerts.emailError.shopId}`,
        createdAt: new Date().toISOString(),
        persistent: true,
      })
    }

    // Ordenar: críticos primeiro, depois por data
    return all.sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1
      if (b.priority === 'high' && a.priority !== 'high') return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [shopId, dynamicAlerts])

  // Calcular não lidas (excluindo persistentes que são sempre "ativas")
  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.persistent && !seenIds.has(n.id)).length
  }, [notifications, seenIds])

  // Verificar se há alertas críticos ativos
  const hasCriticalAlert = useMemo(() => {
    return notifications.some(n => n.priority === 'high')
  }, [notifications])

  // Marcar uma notificação como lida
  const markAsRead = useCallback((notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId)
    if (notification?.persistent) return

    setSeenIds(prev => {
      const newSet = new Set(prev)
      newSet.add(notificationId)
      saveSeenIds(newSet)
      return newSet
    })
  }, [notifications, saveSeenIds])

  // Marcar todas como lidas
  const markAllAsRead = useCallback(() => {
    const nonPersistentIds = notifications
      .filter(n => !n.persistent)
      .map(n => n.id)

    setSeenIds(prev => {
      const newSet = new Set([...prev, ...nonPersistentIds])
      saveSeenIds(newSet)
      return newSet
    })
  }, [notifications, saveSeenIds])

  // Verificar se uma notificação foi lida
  const isRead = useCallback((notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId)
    if (notification?.persistent) return false
    return seenIds.has(notificationId)
  }, [notifications, seenIds])

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    hasCriticalAlert,
    markAsRead,
    markAllAsRead,
    isRead,
    setDynamicAlerts,
    setShopId,
    setUserId,
  }), [notifications, unreadCount, hasCriticalAlert, markAsRead, markAllAsRead, isRead])

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotificationContext() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider')
  }
  return context
}
