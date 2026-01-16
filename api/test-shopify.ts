import type { VercelRequest, VercelResponse } from '@vercel/node'

interface ShopifyTestRequest {
  shopify_domain: string
  shopify_client_id: string
  shopify_client_secret: string
}

function parseShopifyError(responseText: string, statusCode: number): string {
  // Check if response is HTML (error page)
  if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
    // Extract error from HTML if possible
    const titleMatch = responseText.match(/<title>([^<]+)<\/title>/i)
    const errorTitle = titleMatch ? titleMatch[1] : ''

    if (errorTitle.includes('invalid_request')) {
      return 'Requisição OAuth inválida. Verifique se o app foi instalado corretamente na loja e se as credenciais estão corretas.'
    }

    if (errorTitle.includes('access_denied')) {
      return 'Acesso negado. Verifique se o app tem as permissões necessárias.'
    }

    if (statusCode === 400) {
      return 'Requisição inválida. Verifique se o Client ID e Client Secret estão corretos e se o app foi instalado na loja.'
    }

    return `Erro do Shopify (${statusCode}). Verifique se o app foi criado e instalado corretamente.`
  }

  // Try to parse as JSON
  try {
    const json = JSON.parse(responseText)
    if (json.error_description) return json.error_description
    if (json.error) return json.error
    if (json.errors) return typeof json.errors === 'string' ? json.errors : JSON.stringify(json.errors)
  } catch {
    // Not JSON, return truncated text
    if (responseText.length > 200) {
      return responseText.substring(0, 200) + '...'
    }
  }

  return responseText || `Erro desconhecido (${statusCode})`
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

    const tokenResponseText = await tokenResponse.text()

    if (!tokenResponse.ok) {
      const errorMessage = parseShopifyError(tokenResponseText, tokenResponse.status)

      // Provide helpful guidance based on error
      let helpText = ''
      if (tokenResponse.status === 400 || tokenResponseText.includes('invalid_request')) {
        helpText = '\n\nPossíveis soluções:\n' +
          '1. Verifique se o app foi instalado na loja (Release → Install)\n' +
          '2. Confirme que o Client ID e Secret estão corretos\n' +
          '3. Verifique se os escopos foram configurados corretamente'
      }

      return res.status(400).json({
        success: false,
        error: errorMessage + helpText
      })
    }

    // Try to parse token response
    let tokenData
    try {
      tokenData = JSON.parse(tokenResponseText)
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Resposta inválida do Shopify ao obter token. Verifique as credenciais.'
      })
    }

    const accessToken = tokenData.access_token

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Não foi possível obter o access token. Verifique se o app foi instalado na loja.'
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
      const errorMessage = parseShopifyError(errorText, response.status)

      return res.status(400).json({
        success: false,
        error: `Erro ao acessar API: ${errorMessage}`
      })
    }

    const shopData = await response.json()

    return res.status(200).json({
      success: true,
      message: 'Conexão estabelecida com sucesso!',
      shop_name: shopData.shop?.name || domain
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro interno do servidor'

    return res.status(500).json({
      success: false,
      error: `Erro de conexão: ${errorMessage}. Verifique se o domínio está correto.`
    })
  }
}
