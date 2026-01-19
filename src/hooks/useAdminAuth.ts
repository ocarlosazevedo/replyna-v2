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

const ADMIN_SESSION_KEY = 'replyna_admin_session'

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

        // Validar sessão no servidor
        const { data, error } = await supabase
          .from('admin_sessions')
          .select('admin_id, expires_at')
          .eq('token_hash', simpleHash(session.token))
          .gt('expires_at', new Date().toISOString())
          .single()

        if (error || !data) {
          localStorage.removeItem(ADMIN_SESSION_KEY)
          setLoading(false)
          return
        }

        // Carregar dados do admin
        const { data: adminData } = await supabase
          .from('admins')
          .select('*')
          .eq('id', data.admin_id)
          .eq('is_active', true)
          .single()

        if (adminData) {
          setAdmin(adminData as Admin)
        } else {
          localStorage.removeItem(ADMIN_SESSION_KEY)
        }
      } catch {
        localStorage.removeItem(ADMIN_SESSION_KEY)
      } finally {
        setLoading(false)
      }
    }

    loadSession()
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    // Chamar função RPC para verificar login
    const { data, error } = await supabase.rpc('admin_login', {
      p_email: email.toLowerCase(),
      p_password: password
    })

    if (error || !data || !data.success) {
      throw new Error(data?.error || 'Email ou senha inválidos')
    }

    const adminData = data.admin as Admin

    // Gerar token de sessão
    const token = generateToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 dias

    // Criar sessão
    const { error: sessionError } = await supabase
      .from('admin_sessions')
      .insert({
        admin_id: adminData.id,
        token_hash: simpleHash(token),
        expires_at: expiresAt.toISOString(),
        user_agent: navigator.userAgent
      })

    if (sessionError) {
      throw new Error('Erro ao criar sessão')
    }

    // Salvar sessão no localStorage
    const session: AdminSession = {
      admin: adminData,
      token,
      expires_at: expiresAt.toISOString()
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
