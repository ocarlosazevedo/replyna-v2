import type { VercelRequest, VercelResponse } from '@vercel/node'

interface ShopifyTestRequest {
  shopify_domain: string
  shopify_client_id: string
  shopify_client_secret: string
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

  const config = req.body as ShopifyTestRequest

  // Validate required fields
  if (!config.shopify_domain || !config.shopify_client_id || !config.shopify_client_secret) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' })
  }

  try {
    // Clean domain (remove https://, trailing slashes)
    let domain = config.shopify_domain
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')

    // Ensure it has .myshopify.com
    if (!domain.includes('.myshopify.com')) {
      domain = `${domain}.myshopify.com`
    }

    // Step 1: Get access token using Client Credentials Grant (Shopify 2026 flow)
    const tokenUrl = `https://${domain}/admin/oauth/access_token`

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.shopify_client_id,
        client_secret: config.shopify_client_secret,
      }).toString(),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()

      if (tokenResponse.status === 401 || tokenResponse.status === 403) {
        return res.status(400).json({
          success: false,
          error: 'Credenciais inválidas. Verifique o Client ID e Client Secret.'
        })
      }

      if (tokenResponse.status === 404) {
        return res.status(400).json({
          success: false,
          error: 'Loja não encontrada. Verifique o domínio.'
        })
      }

      return res.status(400).json({
        success: false,
        error: `Erro ao obter token: ${tokenResponse.status} - ${errorText}`
      })
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Não foi possível obter o access token. Verifique as credenciais.'
      })
    }

    // Step 2: Test the connection by making a simple API call
    const apiUrl = `https://${domain}/admin/api/2024-01/shop.json`

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()

      return res.status(400).json({
        success: false,
        error: `Erro ao acessar API: ${response.status} - ${errorText}`
      })
    }

    const shopData = await response.json()

    return res.status(200).json({
      success: true,
      message: 'Conexão estabelecida com sucesso!',
      shop_name: shopData.shop?.name || domain
    })
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Erro interno do servidor'
    })
  }
}
