import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { Settings, Trash2, Power, PowerOff, Mail, ShoppingBag, User, Store, Plus, ChevronDown, Snowflake } from 'lucide-react'

// Componente Skeleton para loading animado
const Skeleton = ({ height = 16, width = '100%' }: { height?: number | string; width?: number | string }) => (
  <div style={{
    width,
    height,
    backgroundColor: 'var(--border-color)',
    borderRadius: 8,
    animation: 'replyna-pulse 1.6s ease-in-out infinite',
  }} />
)

interface Shop {
  id: string
  name: string
  attendant_name: string
  support_email: string
  imap_user: string
  mail_status: string
  shopify_status: string
  is_active: boolean
  is_cod: boolean
  created_at: string
}

type StatusFilter = 'all' | 'active' | 'paused' | 'frozen'
type BusinessFilter = 'all' | 'cod' | 'non-cod'

const statusFilterOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos os status' },
  { value: 'active', label: 'Ativas' },
  { value: 'paused', label: 'Pausadas' },
  { value: 'frozen', label: 'Congeladas' },
]

const businessFilterOptions: { value: BusinessFilter; label: string }[] = [
  { value: 'all', label: 'Todos os modelos' },
  { value: 'cod', label: 'COD' },
  { value: 'non-cod', label: 'Não-COD' },
]

export default function Shops() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [shopsLimit, setShopsLimit] = useState<number | null>(null) // null = ainda carregando ou ilimitado
  const [limitsLoaded, setLimitsLoaded] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [businessFilter, setBusinessFilter] = useState<BusinessFilter>('all')
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showBusinessDropdown, setShowBusinessDropdown] = useState(false)
  const isMobile = useIsMobile()

  // Verificar se é ilimitado (só após carregar os limites)
  const isUnlimited = limitsLoaded && shopsLimit === null

  // Ordenar lojas: ativas primeiro por data de criação (mais antigas primeiro)
  const sortedShops = [...shops].sort((a, b) => {
    if (a.is_active && !b.is_active) return -1
    if (!a.is_active && b.is_active) return 1
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  // Determinar quais lojas estão "congeladas" (excedem o limite do plano)
  // Lojas ativas mais antigas têm prioridade
  const activeShops = sortedShops.filter(s => s.is_active)
  const frozenShopIds = new Set<string>()

  if (!isUnlimited && shopsLimit !== null && activeShops.length > shopsLimit) {
    // Lojas excedentes (as mais recentes) ficam congeladas
    const excessShops = activeShops.slice(shopsLimit)
    excessShops.forEach(shop => frozenShopIds.add(shop.id))
  }

  const hasFrozenShops = frozenShopIds.size > 0

  // Filtrar lojas (combina ambos os filtros)
  const filteredShops = sortedShops.filter((shop) => {
    const isFrozen = frozenShopIds.has(shop.id)

    // Filtro de status
    let passesStatusFilter = true
    switch (statusFilter) {
      case 'active':
        passesStatusFilter = shop.is_active && !isFrozen
        break
      case 'paused':
        passesStatusFilter = !shop.is_active
        break
      case 'frozen':
        passesStatusFilter = isFrozen
        break
      case 'all':
      default:
        passesStatusFilter = true
    }

    // Filtro de modelo de negócio
    let passesBusinessFilter = true
    switch (businessFilter) {
      case 'cod':
        passesBusinessFilter = shop.is_cod
        break
      case 'non-cod':
        passesBusinessFilter = !shop.is_cod
        break
      case 'all':
      default:
        passesBusinessFilter = true
    }

    return passesStatusFilter && passesBusinessFilter
  })

  // Contadores para os dropdowns
  const statusCounts = {
    all: shops.length,
    active: activeShops.filter(s => !frozenShopIds.has(s.id)).length,
    paused: shops.filter(s => !s.is_active).length,
    frozen: frozenShopIds.size,
  }

  const businessCounts = {
    all: shops.length,
    cod: shops.filter(s => s.is_cod).length,
    'non-cod': shops.filter(s => !s.is_cod).length,
  }

  useEffect(() => {
    loadShops()
    loadUserLimit()
  }, [user])

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.status-filter-dropdown')) {
        setShowStatusDropdown(false)
      }
      if (!target.closest('.business-filter-dropdown')) {
        setShowBusinessDropdown(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const loadUserLimit = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('users')
        .select('shops_limit')
        .eq('id', user.id)
        .single()

      if (!error && data) {
        // NULL = ilimitado, manter como null
        setShopsLimit(data.shops_limit)
      }
    } catch (err) {
      console.error('Erro ao carregar limite de lojas:', err)
    } finally {
      setLimitsLoaded(true)
    }
  }

  const loadShops = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setShops(data || [])
    } catch (err) {
      console.error('Erro ao carregar lojas:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteShop = async (shopId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta loja? Esta ação não pode ser desfeita.')) return

    try {
      const { error } = await supabase
        .from('shops')
        .delete()
        .eq('id', shopId)

      if (error) throw error
      loadShops()
    } catch (err) {
      console.error('Erro ao excluir loja:', err)
    }
  }

  const handleToggleActive = async (shopId: string, currentStatus: boolean) => {
    // Verificar se está tentando ativar uma loja quando já atingiu o limite
    if (!currentStatus && !isUnlimited && shopsLimit !== null) {
      const currentActiveCount = shops.filter(s => s.is_active).length
      if (currentActiveCount >= shopsLimit) {
        alert(`Você atingiu o limite de ${shopsLimit} loja${shopsLimit > 1 ? 's' : ''} ativa${shopsLimit > 1 ? 's' : ''} do seu plano. Faça upgrade para ativar mais lojas.`)
        return
      }
    }

    try {
      const { error } = await supabase
        .from('shops')
        .update({ is_active: !currentStatus })
        .eq('id', shopId)

      if (error) throw error
      loadShops()
    } catch (err) {
      console.error('Erro ao atualizar status:', err)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return { color: '#22c55e', label: 'Conectado' }
      case 'error':
        return { color: '#ef4444', label: 'Erro' }
      case 'pending':
        return { color: '#f59e0b', label: 'Pendente' }
      default:
        return { color: 'var(--text-secondary)', label: 'Não configurado' }
    }
  }

  const cardStyle = {
    backgroundColor: 'var(--bg-card)',
    borderRadius: '16px',
    padding: isMobile ? '16px' : '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid var(--border-color)',
  }

  const buttonPrimary = {
    backgroundColor: 'var(--accent)',
    color: '#ffffff',
    padding: '10px 20px',
    borderRadius: '10px',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
  }

  const buttonSecondary = {
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    padding: '10px 20px',
    borderRadius: '10px',
    fontWeight: '600',
    border: '1px solid var(--border-color)',
    cursor: 'pointer',
    fontSize: '14px',
  }

  const buttonIcon = {
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    padding: '10px',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  // Verificar se pode adicionar mais lojas (ilimitado ou abaixo do limite)
  const canAddMoreShops = isUnlimited || shops.length < (shopsLimit ?? 0)

  const selectedStatusLabel = statusFilterOptions.find(f => f.value === statusFilter)?.label || 'Todos os status'
  const selectedBusinessLabel = businessFilterOptions.find(f => f.value === businessFilter)?.label || 'Todos os modelos'

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', marginBottom: '24px', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Minhas Lojas
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Gerencie suas lojas e integrações ({shops.length} de {!limitsLoaded ? '...' : isUnlimited ? <span style={{ color: '#22c55e' }}>Ilimitado</span> : shopsLimit})
          </p>
        </div>
        {!limitsLoaded ? (
          <Skeleton height={42} width={isMobile ? '100%' : 180} />
        ) : canAddMoreShops ? (
          <button onClick={() => navigate('/shops/setup')} style={{ ...buttonPrimary, whiteSpace: 'nowrap', width: isMobile ? '100%' : 'auto' }}>
            + Integrar nova loja
          </button>
        ) : (
          <button
            onClick={() => navigate('/account')}
            style={{
              ...buttonPrimary,
              whiteSpace: 'nowrap',
              width: isMobile ? '100%' : 'auto',
              backgroundColor: '#f59e0b',
            }}
            title="Faça upgrade do seu plano para adicionar mais lojas"
          >
            Fazer upgrade
          </button>
        )}
      </div>

      {/* Banner de lojas congeladas */}
      {hasFrozenShops && (
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: '12px',
          padding: isMobile ? '14px' : '16px',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '12px',
          marginBottom: '20px',
        }}>
          <Snowflake size={isMobile ? 20 : 24} style={{ color: '#3b82f6', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: 600, color: '#3b82f6', marginBottom: '4px' }}>
              {frozenShopIds.size} loja{frozenShopIds.size > 1 ? 's' : ''} congelada{frozenShopIds.size > 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Seu plano permite {shopsLimit} loja{shopsLimit && shopsLimit > 1 ? 's' : ''} ativa{shopsLimit && shopsLimit > 1 ? 's' : ''}.
              As lojas excedentes estão congeladas e não processam emails.
              <button
                onClick={() => navigate('/account')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#3b82f6',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  marginLeft: '4px',
                  textDecoration: 'underline',
                  fontSize: 'inherit',
                }}
              >
                Fazer upgrade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filtros em Dropdown */}
      {shops.length > 0 && (
        <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {/* Filtro de Status */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              onClick={() => {
                setShowStatusDropdown(!showStatusDropdown)
                setShowBusinessDropdown(false)
              }}
              className={`replyna-dropdown-trigger ${showStatusDropdown ? 'open' : ''}`}
              style={{ minWidth: isMobile ? 'auto' : '180px', flex: isMobile ? 1 : 'none' }}
            >
              <span>{selectedStatusLabel} ({statusCounts[statusFilter]})</span>
              <ChevronDown
                size={18}
                style={{
                  transform: showStatusDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  color: 'var(--text-secondary)',
                }}
              />
            </button>

            {showStatusDropdown && (
              <div className="replyna-dropdown-menu" style={{ minWidth: '200px' }}>
                {statusFilterOptions.map((option) => {
                  // Esconder opção "Congeladas" se não houver lojas congeladas
                  if (option.value === 'frozen' && statusCounts.frozen === 0) return null

                  return (
                    <button
                      key={option.value}
                      onClick={() => {
                        setStatusFilter(option.value)
                        setShowStatusDropdown(false)
                      }}
                      className={`replyna-dropdown-item ${statusFilter === option.value ? 'active' : ''}`}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {option.value === 'frozen' && <Snowflake size={14} style={{ color: '#3b82f6' }} />}
                        {option.label}
                      </span>
                      <span className="replyna-dropdown-badge">
                        {statusCounts[option.value]}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Filtro de Modelo de Negócio */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              onClick={() => {
                setShowBusinessDropdown(!showBusinessDropdown)
                setShowStatusDropdown(false)
              }}
              className={`replyna-dropdown-trigger ${showBusinessDropdown ? 'open' : ''}`}
              style={{ minWidth: isMobile ? 'auto' : '160px', flex: isMobile ? 1 : 'none' }}
            >
              <span>{selectedBusinessLabel} ({businessCounts[businessFilter]})</span>
              <ChevronDown
                size={18}
                style={{
                  transform: showBusinessDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  color: 'var(--text-secondary)',
                }}
              />
            </button>

            {showBusinessDropdown && (
              <div className="replyna-dropdown-menu">
                {businessFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setBusinessFilter(option.value)
                      setShowBusinessDropdown(false)
                    }}
                    className={`replyna-dropdown-item ${businessFilter === option.value ? 'active' : ''}`}
                  >
                    <span>{option.label}</span>
                    <span className="replyna-dropdown-badge">
                      {businessCounts[option.value]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {loading || !limitsLoaded ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ ...cardStyle }}>
              {/* Header skeleton */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <Skeleton height={24} width="60%" />
                <Skeleton height={28} width={80} />
              </div>

              {/* Info sections skeleton */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Skeleton height={36} width={36} />
                  <div style={{ flex: 1 }}>
                    <Skeleton height={12} width="30%" />
                    <div style={{ marginTop: 6 }}><Skeleton height={16} width="70%" /></div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Skeleton height={36} width={36} />
                  <div style={{ flex: 1 }}>
                    <Skeleton height={12} width="35%" />
                    <div style={{ marginTop: 6 }}><Skeleton height={16} width="65%" /></div>
                  </div>
                </div>
              </div>

              {/* Integration status skeleton */}
              <div style={{
                display: 'flex',
                gap: '16px',
                padding: '16px',
                backgroundColor: 'rgba(70, 114, 236, 0.06)',
                borderRadius: '12px',
                marginBottom: '20px',
                border: '1px solid var(--border-color)',
              }}>
                <div style={{ flex: 1 }}>
                  <Skeleton height={12} width="40%" />
                  <div style={{ marginTop: 6 }}><Skeleton height={16} width="60%" /></div>
                </div>
                <div style={{ width: '1px', backgroundColor: 'var(--border-color)' }} />
                <div style={{ flex: 1 }}>
                  <Skeleton height={12} width="40%" />
                  <div style={{ marginTop: 6 }}><Skeleton height={16} width="60%" /></div>
                </div>
              </div>

              {/* Actions skeleton */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <Skeleton height={42} width="100%" />
                <Skeleton height={42} width={42} />
                <Skeleton height={42} width={42} />
              </div>
            </div>
          ))}
        </div>
      ) : filteredShops.length === 0 && shops.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: isMobile ? '48px 24px' : '64px 48px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            backgroundColor: 'rgba(70, 114, 236, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <Store size={40} style={{ color: 'var(--accent)' }} />
          </div>
          <h2 style={{ fontSize: isMobile ? '22px' : '26px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>
            Integre sua primeira loja
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '440px', margin: '0 auto 24px', lineHeight: '1.6', fontSize: '15px' }}>
            Configure sua loja para ativar o atendimento automatizado. A Replyna vai responder seus clientes com inteligência artificial.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => navigate('/shops/setup')}
              style={{
                ...buttonPrimary,
                padding: '14px 28px',
                fontSize: '15px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Plus size={18} />
              Integrar minha loja
            </button>
            <a
              href="https://youtu.be/PpoJjvGz0AY"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--accent)',
                fontSize: '14px',
                fontWeight: '500',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              Assistir tutorial de integração
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </div>
      ) : filteredShops.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '48px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Nenhuma loja encontrada com o filtro selecionado.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
          {filteredShops.map((shop) => {
            const emailStatus = getStatusIcon(shop.mail_status)
            const shopifyStatus = getStatusIcon(shop.shopify_status)
            const isFrozen = frozenShopIds.has(shop.id)

            return (
              <div
                key={shop.id}
                style={{
                  ...cardStyle,
                  position: 'relative',
                  overflow: 'hidden',
                  ...(isFrozen ? {
                    border: '2px solid rgba(59, 130, 246, 0.4)',
                    backgroundColor: 'rgba(59, 130, 246, 0.03)',
                  } : {}),
                }}
              >
                {/* Overlay de congelado */}
                {isFrozen && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 197, 253, 0.05) 100%)',
                    pointerEvents: 'none',
                    zIndex: 1,
                  }} />
                )}

                {/* Badge de congelado */}
                {isFrozen && (
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    color: '#3b82f6',
                    padding: '6px 12px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    zIndex: 2,
                  }}>
                    <Snowflake size={12} className="frozen-icon" />
                    Congelada
                  </div>
                )}

                {/* Header com nome e status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', position: 'relative', zIndex: 2 }}>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: isFrozen ? 'var(--text-secondary)' : 'var(--text-primary)',
                    margin: 0,
                    maxWidth: isFrozen ? '60%' : '100%',
                  }}>
                    {shop.name}
                  </h3>
                  {!isFrozen && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {shop.is_cod && (
                        <span style={{
                          backgroundColor: 'rgba(139, 92, 246, 0.16)',
                          color: '#8b5cf6',
                          padding: '4px 10px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          COD
                        </span>
                      )}
                      <span style={{
                        backgroundColor: shop.is_active ? 'rgba(34, 197, 94, 0.16)' : 'rgba(107, 114, 128, 0.16)',
                        color: shop.is_active ? '#22c55e' : 'var(--text-secondary)',
                        padding: '4px 12px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {shop.is_active ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Informações organizadas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', position: 'relative', zIndex: 2, opacity: isFrozen ? 0.6 : 1 }}>
                  {/* Email da IA (Replyna) */}
                  {shop.imap_user && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        backgroundColor: isFrozen ? 'rgba(59, 130, 246, 0.1)' : 'rgba(70, 114, 236, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Mail size={18} style={{ color: isFrozen ? '#3b82f6' : 'var(--accent)' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                          Email da IA (Replyna responde)
                        </div>
                        <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '500' }}>
                          {shop.imap_user}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Email Humano (Escalonamento) */}
                  {shop.support_email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <User size={18} style={{ color: '#f59e0b' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                          Email humano (escalonamento)
                        </div>
                        <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '500' }}>
                          {shop.support_email}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status das integrações */}
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  padding: '16px',
                  backgroundColor: isFrozen ? 'rgba(59, 130, 246, 0.06)' : 'rgba(70, 114, 236, 0.06)',
                  borderRadius: '12px',
                  marginBottom: '20px',
                  border: '1px solid var(--border-color)',
                  position: 'relative',
                  zIndex: 2,
                  opacity: isFrozen ? 0.6 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <Mail size={16} style={{ color: emailStatus.color }} />
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Email
                      </div>
                      <div style={{ fontSize: '13px', color: emailStatus.color, fontWeight: '600' }}>
                        {emailStatus.label}
                      </div>
                    </div>
                  </div>
                  <div style={{ width: '1px', backgroundColor: 'var(--border-color)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <ShoppingBag size={16} style={{ color: shopifyStatus.color }} />
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Shopify
                      </div>
                      <div style={{ fontSize: '13px', color: shopifyStatus.color, fontWeight: '600' }}>
                        {shopifyStatus.label}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', position: 'relative', zIndex: 2 }}>
                  <button
                    onClick={() => navigate(`/shops/${shop.id}`)}
                    style={{
                      ...buttonSecondary,
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <Settings size={16} />
                    Gerenciar
                  </button>
                  {isFrozen ? (
                    <button
                      onClick={() => navigate('/account')}
                      style={{
                        ...buttonIcon,
                        color: '#3b82f6',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      }}
                      title="Fazer upgrade para descongelar"
                    >
                      <Snowflake size={18} />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleActive(shop.id, shop.is_active)}
                      style={{
                        ...buttonIcon,
                        color: shop.is_active ? '#22c55e' : 'var(--text-secondary)',
                      }}
                      title={shop.is_active ? 'Desativar loja' : 'Ativar loja'}
                    >
                      {shop.is_active ? <Power size={18} /> : <PowerOff size={18} />}
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteShop(shop.id)}
                    style={{ ...buttonIcon, color: '#ef4444' }}
                    title="Excluir loja"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CSS para animação do ícone de congelado */}
      <style>{`
        @keyframes frost-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
        .frozen-icon {
          animation: frost-pulse 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
