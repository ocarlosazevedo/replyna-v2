import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Sparkles, Lightbulb, AlertTriangle, XCircle, Check } from 'lucide-react'
import type { Notification } from '../context/NotificationContext'

interface NotificationCenterProps {
  notifications: Notification[]
  unreadCount: number
  hasCriticalAlert: boolean
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  isRead: (id: string) => boolean
}

const iconMap = {
  Sparkles,
  Lightbulb,
  Bell,
  AlertTriangle,
  XCircle,
}

export default function NotificationCenter({
  notifications,
  unreadCount,
  hasCriticalAlert,
  markAsRead,
  markAllAsRead,
  isRead,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Fechar com Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Fechar ao clicar fora
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Marcar todas como lidas ao abrir o dropdown
  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      markAllAsRead()
    }
  }, [isOpen, unreadCount, markAllAsRead])

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id)
    if (notification.actionLink) {
      navigate(notification.actionLink)
    }
    setIsOpen(false)
  }

  const totalBadge = unreadCount + (hasCriticalAlert ? notifications.filter(n => n.priority === 'high').length : 0)

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          color: hasCriticalAlert ? '#ef4444' : 'var(--text-on-dark)',
          animation: hasCriticalAlert ? 'pulse 2s infinite' : 'none',
        }}
        title="Notificações"
      >
        <Bell size={22} />

        {/* Badge */}
        {totalBadge > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              backgroundColor: '#ef4444',
              color: 'white',
              fontSize: '11px',
              fontWeight: 600,
              minWidth: '16px',
              height: '16px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}
          >
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '400px',
            maxHeight: '520px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
            zIndex: 2000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>
              Notificações
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--accent)',
                  fontSize: '13px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Check size={14} />
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Notification List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  fontSize: '14px',
                }}
              >
                Nenhuma notificação
              </div>
            ) : (
              notifications.map((notification) => {
                const Icon = iconMap[notification.icon] || Bell
                const read = isRead(notification.id)
                const isCritical = notification.priority === 'high'

                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      background: isCritical
                        ? 'rgba(239, 68, 68, 0.08)'
                        : read
                        ? 'transparent'
                        : 'rgba(70, 114, 236, 0.05)',
                      border: 'none',
                      borderLeft: isCritical ? '3px solid #ef4444' : '3px solid transparent',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseOver={(e) => {
                      if (!isCritical) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = isCritical
                        ? 'rgba(239, 68, 68, 0.08)'
                        : read
                        ? 'transparent'
                        : 'rgba(70, 114, 236, 0.05)'
                    }}
                  >
                    {/* Icon */}
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: `${notification.color}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={18} color={notification.color} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: read && !isCritical ? 400 : 600,
                          fontSize: '14px',
                          color: isCritical ? '#ef4444' : 'var(--text-primary)',
                          marginBottom: '4px',
                        }}
                      >
                        {notification.title}
                      </div>
                      <div
                        style={{
                          fontSize: '13px',
                          color: 'var(--text-secondary)',
                          lineHeight: '1.4',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {notification.description}
                      </div>
                      {/* Data para features/tips (não críticos) */}
                      {!isCritical && notification.createdAt && (
                        <div
                          style={{
                            marginTop: '6px',
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {new Date(notification.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      )}
                      {notification.actionLabel && (
                        <div
                          style={{
                            marginTop: '8px',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: notification.color,
                          }}
                        >
                          {notification.actionLabel} →
                        </div>
                      )}
                    </div>

                    {/* Unread indicator */}
                    {!read && !isCritical && (
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--accent)',
                          flexShrink: 0,
                          marginTop: '4px',
                        }}
                      />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}
