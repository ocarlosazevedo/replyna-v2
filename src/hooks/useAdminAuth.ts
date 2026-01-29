import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface Admin {
  id: string
  email: string
  name: string
  role: 'admin' | 'super_admin'
  is_active: boolean
  last_login_at: string | null
  created_at: string
}

interface AdminSession {
  admin: Admin
  token: string
  expires_at: string
}

interface LoginResponse {
  success: boolean
  error?: string
  blocked?: boolean
  blocked_until?: string
  admin?: Admin
  expires_at?: string
}

const ADMIN_SESSION_KEY = 'replyna_admin_session'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

// Hash simples para o token (apenas para identificação, não segurança)
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}

function generateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function useAdminAuth() {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [loading, setLoading] = useState(true)

  // Carregar sessão do localStorage
  useEffect(() => {
    const loadSession = async () => {
      try {
        const stored = localStorage.getItem(ADMIN_SESSION_KEY)
        if (!stored) {
          setLoading(false)
          return
        }

        const session: AdminSession = JSON.parse(stored)

        // Verificar se a sessão expirou localmente
        if (new Date(session.expires_at) < new Date()) {
          localStorage.removeItem(ADMIN_SESSION_KEY)
          setLoading(false)
          return
        }

        // Usar os dados do admin armazenados na sessão local
        // A sessão já foi validada no momento do login
        setAdmin(session.admin)
      } catch {
        localStorage.removeItem(ADMIN_SESSION_KEY)
      } finally {
        setLoading(false)
      }
    }

    loadSession()
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    // Gerar token de sessão
    const token = generateToken()
    const tokenHash = simpleHash(token)

    console.log('Tentando login com:', { email: email.toLowerCase(), tokenHash })

    // Chamar edge function com rate limiting integrado
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.toLowerCase(),
        password: password,
        token_hash: tokenHash,
        user_agent: navigator.userAgent,
      }),
    })

    const data: LoginResponse = await response.json()
    console.log('Resposta do login:', data)

    if (!response.ok || !data.success) {
      // Mensagem especial para rate limiting
      if (data.blocked) {
        throw new Error(data.error || 'Muitas tentativas. Aguarde alguns minutos.')
      }
      throw new Error(data.error || 'Email ou senha inválidos')
    }

    const adminData = data.admin as Admin
    const expiresAt = data.expires_at as string

    // Salvar sessão no localStorage
    const session: AdminSession = {
      admin: adminData,
      token,
      expires_at: expiresAt
    }
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session))

    setAdmin(adminData)
  }, [])

  const signOut = useCallback(async () => {
    const stored = localStorage.getItem(ADMIN_SESSION_KEY)
    if (stored) {
      try {
        const session: AdminSession = JSON.parse(stored)
        // Remover sessão do banco
        await supabase
          .from('admin_sessions')
          .delete()
          .eq('token_hash', simpleHash(session.token))
      } catch {
        // Ignora erro ao deletar sessão
      }
    }

    localStorage.removeItem(ADMIN_SESSION_KEY)
    setAdmin(null)
  }, [])

  return {
    admin,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!admin,
    isSuperAdmin: admin?.role === 'super_admin'
  }
}
