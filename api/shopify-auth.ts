import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

interface ShopifyAuthRequest {
  shop_id: string
  shopify_domain: string
  shopify_client_id: string
  shopify_method?: 'custom_app' | 'distribution'
}

/**
 * Initiates the Shopify OAuth Authorization Code flow.
 * Generates a signed state parameter and returns the Shopify authorization URL.
 */
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

  const { shop_id, shopify_domain, shopify_client_id, shopify_method } = req.body as ShopifyAuthRequest

  if (!shop_id || !shopify_domain || !shopify_client_id) {
    return res.status(400).json({ error: 'shop_id, shopify_domain e shopify_client_id são obrigatórios' })
  }

  const oauthSecret = process.env.SHOPIFY_OAUTH_SECRET
  if (!oauthSecret) {
    return res.status(500).json({ error: 'SHOPIFY_OAUTH_SECRET não configurado no servidor' })
  }

  try {
    // Clean domain
    let domain = shopify_domain
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')

    if (!domain.includes('.myshopify.com')) {
      domain = `${domain}.myshopify.com`
    }

    // Generate HMAC-signed state (anti-CSRF)
    const nonce = crypto.randomBytes(16).toString('hex')
    const ts = Date.now()
    const statePayload = JSON.stringify({ shop_id, nonce, ts })
    const stateBase64 = Buffer.from(statePayload).toString('base64url')
    const hmac = crypto.createHmac('sha256', oauthSecret).update(stateBase64).digest('base64url')
    const state = `${stateBase64}.${hmac}`

    // Build Shopify authorization URL
    const redirectUri = 'https://app.replyna.me/api/shopify-callback'
    const scopes = 'read_orders,read_products,read_customers,read_inventory,read_fulfillments'

    // Always include scope parameter — it's required unless the app uses
    // Shopify managed installation. Most distribution apps do NOT use managed
    // installation, so including scope is the safer default.
    const authUrl = `https://${domain}/admin/oauth/authorize?` +
      `client_id=${encodeURIComponent(shopify_client_id)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}`

    return res.status(200).json({ auth_url: authUrl })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro interno'
    return res.status(500).json({ error: `Erro ao gerar URL de autorização: ${errorMessage}` })
  }
}
