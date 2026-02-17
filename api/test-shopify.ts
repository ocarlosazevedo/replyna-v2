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

/**
 * Tenta obter access token via Client Credentials Grant
 * Tenta primeiro com application/json, depois com x-www-form-urlencoded
 */
async function getAccessToken(domain: string, clientId: string, clientSecret: string): Promise<{ token?: string; error?: string }> {
  const tokenUrl = `https://${domain}/admin/oauth/access_token`

  // Tentativa 1: JSON (mesmo formato usado no shopify.ts das Edge Functions)
  const jsonResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (jsonResponse.ok) {
    try {
      const data = await jsonResponse.json()
      if (data.access_token) return { token: data.access_token }
    } catch { /* fall through */ }
  }

  // Tentativa 2: x-www-form-urlencoded (formato alternativo)
  const formResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  })

  const responseText = await formResponse.text()

  if (!formResponse.ok) {
    return { error: parseShopifyError(responseText, formResponse.status) }
  }

  try {
    const data = JSON.parse(responseText)
    if (data.access_token) return { token: data.access_token }
  } catch { /* fall through */ }

  return { error: 'Não foi possível obter o access token. Verifique se o app foi instalado na loja.' }
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

    // Step 1: Get access token
    const tokenResult = await getAccessToken(domain, config.shopify_client_id, config.shopify_client_secret)

    if (!tokenResult.token) {
      const helpText = '\n\nComo resolver:\n' +
        '1. No Shopify Admin, vá em Settings > Apps and sales channels > Develop apps\n' +
        '2. Clique no seu app e depois em "Install app" (botão verde no topo)\n' +
        '3. Confirme que o Client ID e Client Secret estão corretos (copie novamente)\n' +
        '4. Verifique se os escopos read_orders e read_customers estão habilitados'

      // Detect if this is a distribution app that needs OAuth Authorization Code flow
      const errorLower = (tokenResult.error || '').toLowerCase()
      const isOAuthRequired = errorLower.includes('invalid_request') ||
        errorLower.includes('requisição oauth inválida') ||
        errorLower.includes('requisição inválida')

      return res.status(400).json({
        success: false,
        error: (tokenResult.error || 'Falha ao obter token de acesso') + helpText,
        oauth_required: isOAuthRequired,
      })
    }

    // Step 2: Test the connection by making a simple API call
    const apiUrl = `https://${domain}/admin/api/2025-01/shop.json`

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': tokenResult.token,
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
