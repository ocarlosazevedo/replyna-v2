import type { VercelRequest, VercelResponse } from '@vercel/node'

const BREVO_API_KEY = process.env.BREVO_API_KEY

const brevoHeaders = {
  'accept': 'application/json',
  'content-type': 'application/json',
  'api-key': BREVO_API_KEY || ''
}

// Garante que o contato exista e esteja na lista, retorna true se criou/atualizou
async function ensureContact(email: string, name: string): Promise<boolean> {
  const resp = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: brevoHeaders,
    body: JSON.stringify({
      email,
      attributes: { FIRSTNAME: name, LASTNAME: '', NOME: name },
      listIds: [4],
      updateEnabled: true
    })
  })

  if (resp.status === 201 || resp.status === 204) return true

  if (resp.status === 400) {
    const err = await resp.json()
    if (err.code === 'duplicate_parameter') {
      // Contato ja existe, atualizar nome e garantir que esta na lista
      await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
        method: 'PUT',
        headers: brevoHeaders,
        body: JSON.stringify({
          attributes: { FIRSTNAME: name, LASTNAME: '', NOME: name },
          listIds: [4]
        })
      })
      return true
    }
    console.error('Brevo ensureContact 400:', JSON.stringify(err))
  }

  return false
}

// Tenta salvar o numero no contato (SMS + WHATSAPP_NUMBER)
async function savePhoneToContact(email: string, phone: string, countryCode: string): Promise<void> {
  // Garante formato: +CC seguido dos digitos do telefone
  const code = countryCode.startsWith('+') ? countryCode : `+${countryCode}`
  const smsValue = `${code}${phone}`

  // Tentativa 1: salvar SMS + WHATSAPP_NUMBER juntos
  const resp = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
    method: 'PUT',
    headers: brevoHeaders,
    body: JSON.stringify({
      attributes: { SMS: smsValue, WHATSAPP_NUMBER: smsValue }
    })
  })

  if (resp.status === 204 || resp.status === 200) return

  // Se SMS falhou (ex: duplicata), salvar pelo menos WHATSAPP_NUMBER
  console.error('Brevo SMS update failed, saving WHATSAPP_NUMBER only. Status:', resp.status)
  const fallback = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
    method: 'PUT',
    headers: brevoHeaders,
    body: JSON.stringify({
      attributes: { WHATSAPP_NUMBER: smsValue }
    })
  })

  if (fallback.status !== 204 && fallback.status !== 200) {
    const errText = await fallback.text()
    console.error('Brevo WHATSAPP_NUMBER fallback also failed:', fallback.status, errText)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers (must be set BEFORE any method check)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Apenas POST permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verificar se a API key está configurada
  if (!BREVO_API_KEY) {
    console.error('BREVO_API_KEY não configurada nas variáveis de ambiente')
    return res.status(500).json({ error: 'Configuração do servidor incompleta', code: 'MISSING_API_KEY' })
  }

  const { name, email, whatsapp, countryCode } = req.body

  // Validação básica
  if (!name || !email || !whatsapp) {
    return res.status(400).json({ error: 'Campos obrigatórios: name, email, whatsapp' })
  }

  // Validar email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Email inválido' })
  }

  const cleanEmail = email.toLowerCase().trim()
  const cleanName = name.trim()
  const cleanWhatsapp = whatsapp.replace(/\D/g, '')

  try {
    // Passo 1: Criar/atualizar contato (sem telefone, para garantir que o contato exista)
    const contactOk = await ensureContact(cleanEmail, cleanName)
    if (!contactOk) {
      return res.status(500).json({ error: 'Erro ao criar contato no Brevo', code: 'BREVO_CONTACT_ERROR' })
    }

    // Passo 2: Salvar telefone separadamente (SMS + WHATSAPP_NUMBER com fallback)
    if (cleanWhatsapp) {
      await savePhoneToContact(cleanEmail, cleanWhatsapp, countryCode || '+55')
    }

    return res.status(200).json({ success: true, message: 'Lead cadastrado com sucesso' })

  } catch (error) {
    console.error('Subscribe error:', error)
    return res.status(500).json({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' })
  }
}
