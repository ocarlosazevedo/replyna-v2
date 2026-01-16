import type { VercelRequest, VercelResponse } from '@vercel/node'
import Imap from 'imap'
import nodemailer from 'nodemailer'

interface EmailTestRequest {
  imap_host: string
  imap_port: string
  imap_user: string
  imap_password: string
  smtp_host: string
  smtp_port: string
  smtp_user: string
  smtp_password: string
}

function parseEmailError(error: string): { message: string; help: string } {
  const errorLower = error.toLowerCase()

  // Account not found / user not found
  if (errorLower.includes('accountnotfound') || errorLower.includes('user not found') || errorLower.includes('no such user')) {
    return {
      message: 'Conta não encontrada',
      help: 'Verifique se o email está correto e se a conta existe no provedor.'
    }
  }

  // Authentication failed
  if (errorLower.includes('auth') || errorLower.includes('invalid credentials') || errorLower.includes('login failed') || errorLower.includes('authentication')) {
    return {
      message: 'Falha na autenticação',
      help: 'Verifique se a senha está correta. Para Gmail, use uma "Senha de app" em vez da senha normal (Conta Google → Segurança → Senhas de app).'
    }
  }

  // Connection refused / host not found
  if (errorLower.includes('econnrefused') || errorLower.includes('connection refused')) {
    return {
      message: 'Conexão recusada',
      help: 'O servidor recusou a conexão. Verifique se o host e a porta estão corretos.'
    }
  }

  if (errorLower.includes('enotfound') || errorLower.includes('getaddrinfo') || errorLower.includes('host not found')) {
    return {
      message: 'Servidor não encontrado',
      help: 'Verifique se o endereço do servidor (host) está correto.'
    }
  }

  // Timeout
  if (errorLower.includes('timeout') || errorLower.includes('etimedout')) {
    return {
      message: 'Tempo de conexão esgotado',
      help: 'O servidor demorou muito para responder. Verifique se o host e a porta estão corretos.'
    }
  }

  // Certificate errors
  if (errorLower.includes('certificate') || errorLower.includes('ssl') || errorLower.includes('tls')) {
    return {
      message: 'Erro de certificado SSL/TLS',
      help: 'Problema com o certificado de segurança do servidor. Entre em contato com seu provedor de email.'
    }
  }

  // Wrong port
  if (errorLower.includes('wrong version') || errorLower.includes('unexpected')) {
    return {
      message: 'Porta incorreta',
      help: 'A porta pode estar errada. Portas comuns: IMAP (993), SMTP (465 ou 587).'
    }
  }

  // Generic error - return original with generic help
  return {
    message: error,
    help: 'Verifique se todas as configurações estão corretas (host, porta, email e senha).'
  }
}

async function testImap(config: EmailTestRequest): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const imap = new Imap({
      user: config.imap_user,
      password: config.imap_password,
      host: config.imap_host,
      port: parseInt(config.imap_port),
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 10000,
      authTimeout: 10000,
    })

    let resolved = false

    imap.once('ready', () => {
      if (!resolved) {
        resolved = true
        imap.end()
        resolve({ success: true })
      }
    })

    imap.once('error', (err: Error) => {
      if (!resolved) {
        resolved = true
        const parsed = parseEmailError(err.message)
        resolve({
          success: false,
          error: `IMAP: ${parsed.message}\n\n${parsed.help}`
        })
      }
    })

    imap.once('end', () => {
      // Connection ended
    })

    try {
      imap.connect()
    } catch (err) {
      if (!resolved) {
        resolved = true
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido'
        const parsed = parseEmailError(errorMsg)
        resolve({
          success: false,
          error: `IMAP: ${parsed.message}\n\n${parsed.help}`
        })
      }
    }

    // Timeout fallback
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        imap.end()
        resolve({
          success: false,
          error: 'IMAP: Tempo de conexão esgotado\n\nO servidor demorou muito para responder. Verifique se o host e a porta estão corretos.'
        })
      }
    }, 15000)
  })
}

async function testSmtp(config: EmailTestRequest): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    let resolved = false

    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: parseInt(config.smtp_port),
      secure: parseInt(config.smtp_port) === 465,
      auth: {
        user: config.smtp_user,
        pass: config.smtp_password,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    })

    transporter.verify((error) => {
      if (!resolved) {
        resolved = true
        if (error) {
          const parsed = parseEmailError(error.message)
          resolve({
            success: false,
            error: `SMTP: ${parsed.message}\n\n${parsed.help}`
          })
        } else {
          resolve({ success: true })
        }
        transporter.close()
      }
    })

    // Timeout fallback
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        transporter.close()
        resolve({
          success: false,
          error: 'SMTP: Tempo de conexão esgotado\n\nO servidor demorou muito para responder. Verifique se o host e a porta estão corretos.'
        })
      }
    }, 15000)
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const config = req.body as EmailTestRequest

  // Validate required fields
  if (!config.imap_host || !config.imap_user || !config.imap_password ||
      !config.smtp_host || !config.smtp_user || !config.smtp_password) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' })
  }

  try {
    // Test IMAP first
    const imapResult = await testImap(config)
    if (!imapResult.success) {
      return res.status(400).json({
        success: false,
        error: imapResult.error || 'Falha na conexão IMAP'
      })
    }

    // Then test SMTP
    const smtpResult = await testSmtp(config)
    if (!smtpResult.success) {
      return res.status(400).json({
        success: false,
        error: smtpResult.error || 'Falha na conexão SMTP'
      })
    }

    return res.status(200).json({ success: true, message: 'Conexão estabelecida com sucesso!' })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Erro interno do servidor'
    const parsed = parseEmailError(errorMsg)

    return res.status(500).json({
      success: false,
      error: `${parsed.message}\n\n${parsed.help}`
    })
  }
}
