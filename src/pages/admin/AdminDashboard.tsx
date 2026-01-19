import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { MessageSquare, Users, Store, TrendingUp, Mail, CheckCircle } from 'lucide-react'

interface DashboardStats {
  totalUsers: number
  activeUsers: number
  totalShops: number
  activeShops: number
  totalConversations: number
  totalMessages: number
  automationRate: number
  conversationsToday: number
  conversationsThisWeek: number
  conversationsThisMonth: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      // Total de usuarios
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      // Usuarios ativos
      const { count: activeUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      // Total de lojas
      const { count: totalShops } = await supabase
        .from('shops')
        .select('*', { count: 'exact', head: true })

      // Lojas ativas
      const { count: activeShops } = await supabase
        .from('shops')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      // Total de conversas
      const { count: totalConversations } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })

      // Total de mensagens
      const { count: totalMessages } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })

      // Mensagens auto-respondidas
      const { count: autoReplied } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('was_auto_replied', true)

      // Conversas hoje
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { count: conversationsToday } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())

      // Conversas esta semana
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      weekStart.setHours(0, 0, 0, 0)
      const { count: conversationsThisWeek } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekStart.toISOString())

      // Conversas este mes
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)
      const { count: conversationsThisMonth } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', monthStart.toISOString())

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalShops: totalShops || 0,
        activeShops: activeShops || 0,
        totalConversations: totalConversations || 0,
        totalMessages: totalMessages || 0,
        automationRate: totalMessages && autoReplied ? Math.round((autoReplied / totalMessages) * 100) : 0,
        conversationsToday: conversationsToday || 0,
        conversationsThisWeek: conversationsThisWeek || 0,
        conversationsThisMonth: conversationsThisMonth || 0,
      })
    } catch (err) {
      console.error('Erro ao carregar estatisticas:', err)
    } finally {
      setLoading(false)
    }
  }

  const cardStyle = {
    backgroundColor: 'var(--bg-card)',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid var(--border-color)',
  }

  const statCardStyle = {
    ...cardStyle,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
  }

  const iconBoxStyle = (color: string) => ({
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    backgroundColor: `${color}15`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  })

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{
          height: '32px',
          width: '200px',
          backgroundColor: 'var(--border-color)',
          borderRadius: '8px',
          marginBottom: '32px',
          animation: 'replyna-pulse 1.6s ease-in-out infinite',
        }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                height: '120px',
                backgroundColor: 'var(--border-color)',
                borderRadius: '16px',
                animation: 'replyna-pulse 1.6s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
          Painel de Controle
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Visao geral de todas as metricas da Replyna
        </p>
      </div>

      {/* Metricas principais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '32px' }}>
        <div style={statCardStyle}>
          <div style={iconBoxStyle('#3b82f6')}>
            <Users size={24} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Total de Clientes
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.totalUsers || 0}
            </div>
            <div style={{ fontSize: '12px', color: '#22c55e', marginTop: '4px' }}>
              {stats?.activeUsers || 0} ativos
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#8b5cf6')}>
            <Store size={24} style={{ color: '#8b5cf6' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Total de Lojas
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.totalShops || 0}
            </div>
            <div style={{ fontSize: '12px', color: '#22c55e', marginTop: '4px' }}>
              {stats?.activeShops || 0} ativas
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#f59e0b')}>
            <MessageSquare size={24} style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Total de Conversas
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.totalConversations || 0}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {stats?.totalMessages || 0} mensagens
            </div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={iconBoxStyle('#22c55e')}>
            <CheckCircle size={24} style={{ color: '#22c55e' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Taxa de Automacao
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.automationRate || 0}%
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              respostas automaticas
            </div>
          </div>
        </div>
      </div>

      {/* Conversas por periodo */}
      <div style={{ ...cardStyle, marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px' }}>
          Conversas por Periodo
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          <div style={{
            padding: '20px',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            borderRadius: '12px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Hoje
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#3b82f6' }}>
              {stats?.conversationsToday || 0}
            </div>
          </div>

          <div style={{
            padding: '20px',
            backgroundColor: 'rgba(139, 92, 246, 0.08)',
            borderRadius: '12px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Esta Semana
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#8b5cf6' }}>
              {stats?.conversationsThisWeek || 0}
            </div>
          </div>

          <div style={{
            padding: '20px',
            backgroundColor: 'rgba(34, 197, 94, 0.08)',
            borderRadius: '12px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Este Mes
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#22c55e' }}>
              {stats?.conversationsThisMonth || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Acoes rapidas */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px' }}>
          Acoes Rapidas
        </h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <a
            href="/admin/clients"
            style={{
              padding: '12px 20px',
              backgroundColor: 'var(--accent)',
              color: '#fff',
              borderRadius: '10px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Users size={18} />
            Ver Clientes
          </a>
          <a
            href="/admin/plans"
            style={{
              padding: '12px 20px',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CreditCard size={18} />
            Gerenciar Planos
          </a>
          <a
            href="/admin/coupons"
            style={{
              padding: '12px 20px',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <TrendingUp size={18} />
            Criar Cupom
          </a>
        </div>
      </div>
    </div>
  )
}
