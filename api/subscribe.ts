import type { VercelRequest, VercelResponse } from '@vercel/node'

const BREVO_API_KEY = process.env.BREVO_API_KEY
const BREVO_LIST_ID = 4 // Lista "Leads Masterclass"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apenas POST permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
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
        'api-key': BREVO_API_KEY || ''
      },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        attributes: {
          FIRSTNAME: name.trim(),
          WHATSAPP: whatsapp.replace(/\D/g, ''), // Só números
          SOURCE: 'Masterclass Anti-Chargeback'
        },
        listIds: [BREVO_LIST_ID],
        updateEnabled: true // Atualiza se já existir
      })
    })

    // Brevo retorna 201 para novo contato, 204 para atualizado
    if (response.status === 201 || response.status === 204) {
      return res.status(200).json({ success: true, message: 'Lead cadastrado com sucesso' })
    }

    // Se o contato já existe e não permitiu update
    if (response.status === 400) {
      const error = await response.json()
      
      // "Contact already exist" - não é erro, só adiciona na lista
      if (error.code === 'duplicate_parameter') {
        // Adicionar à lista mesmo assim
        await fetch(`https://api.brevo.com/v3/contacts/lists/${BREVO_LIST_ID}/contacts/add`, {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'api-key': BREVO_API_KEY || ''
          },
          body: JSON.stringify({
            emails: [email.toLowerCase().trim()]
          })
        })
        return res.status(200).json({ success: true, message: 'Lead adicionado à lista' })
      }
      
      console.error('Brevo error:', error)
      return res.status(400).json({ error: 'Erro ao cadastrar lead', details: error })
    }

    const errorData = await response.text()
    console.error('Brevo unexpected response:', response.status, errorData)
    return res.status(500).json({ error: 'Erro inesperado ao cadastrar lead' })

  } catch (error) {
    console.error('Subscribe error:', error)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
}
