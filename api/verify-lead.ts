import type { VercelRequest, VercelResponse } from '@vercel/node'

const BREVO_API_KEY = process.env.BREVO_API_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!BREVO_API_KEY) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta' })
  }

  const { email } = req.body

  if (!email) {
    return res.status(400).json({ error: 'Email obrigatório' })
  }

  const cleanEmail = email.toLowerCase().trim()

  try {
    // Verificar se o contato existe no Brevo
    const response = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(cleanEmail)}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY
      }
    })

    if (response.status === 200) {
      const contact = await response.json()
      return res.status(200).json({
        exists: true,
        name: contact.attributes?.FIRSTNAME || ''
      })
    }

    if (response.status === 404) {
      return res.status(200).json({ exists: false })
    }

    return res.status(200).json({ exists: false })

  } catch (error) {
    console.error('Verify lead error:', error)
    return res.status(500).json({ error: 'Erro interno' })
  }
}
