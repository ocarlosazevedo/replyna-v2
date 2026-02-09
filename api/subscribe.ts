import type { VercelRequest, VercelResponse } from '@vercel/node'

const BREVO_API_KEY = process.env.BREVO_API_KEY
const BREVO_LIST_ID = 4 // Lista "Leads Masterclass"

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

  const { name, email, whatsapp } = req.body

  // Validação básica
  if (!name || !email || !whatsapp) {
    return res.status(400).json({ error: 'Campos obrigatórios: name, email, whatsapp' })
  }

  // Validar email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Email inválido' })
  }

  try {
    // Criar/atualizar contato no Brevo
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        attributes: {
          FIRSTNAME: name.trim(),
          WHATSAPP: whatsapp.replace(/\D/g, ''),
          SOURCE: 'Masterclass Anti-Chargeback'
        },
        listIds: [BREVO_LIST_ID],
        updateEnabled: true
      })
    })

    // Brevo retorna 201 para novo contato, 204 para atualizado
    if (response.status === 201 || response.status === 204) {
      return res.status(200).json({ success: true, message: 'Lead cadastrado com sucesso' })
    }

    // Se o contato já existe
    if (response.status === 400) {
      const error = await response.json()

      if (error.code === 'duplicate_parameter') {
        await fetch(`https://api.brevo.com/v3/contacts/lists/${BREVO_LIST_ID}/contacts/add`, {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'api-key': BREVO_API_KEY
          },
          body: JSON.stringify({
            emails: [email.toLowerCase().trim()]
          })
        })
        return res.status(200).json({ success: true, message: 'Lead adicionado à lista' })
      }

      console.error('Brevo error:', JSON.stringify(error))
      return res.status(400).json({ error: 'Erro ao cadastrar lead', code: error.code })
    }

    // Erro de autenticação
    if (response.status === 401) {
      console.error('Brevo: API key inválida ou sem permissão')
      return res.status(500).json({ error: 'Erro de autenticação com o serviço', code: 'AUTH_ERROR' })
    }

    const errorData = await response.text()
    console.error('Brevo unexpected response:', response.status, errorData)
    return res.status(500).json({ error: 'Erro inesperado', code: 'BREVO_ERROR', status: response.status })

  } catch (error) {
    console.error('Subscribe error:', error)
    return res.status(500).json({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' })
  }
}
