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

    imap.once('ready', () => {
      imap.end()
      resolve({ success: true })
    })

    imap.once('error', (err: Error) => {
      resolve({ success: false, error: `IMAP: ${err.message}` })
    })

    imap.once('end', () => {
      // Connection ended
    })

    try {
      imap.connect()
    } catch (err) {
      resolve({ success: false, error: `IMAP: ${err instanceof Error ? err.message : 'Erro desconhecido'}` })
    }

    // Timeout fallback
    setTimeout(() => {
      imap.end()
      resolve({ success: false, error: 'IMAP: Timeout de conexão' })
    }, 15000)
  })
}

async function testSmtp(config: EmailTestRequest): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
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
      if (error) {
        resolve({ success: false, error: `SMTP: ${error.message}` })
      } else {
        resolve({ success: true })
      }
      transporter.close()
    })

    // Timeout fallback
    setTimeout(() => {
      transporter.close()
      resolve({ success: false, error: 'SMTP: Timeout de conexão' })
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
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Erro interno do servidor'
    })
  }
}
