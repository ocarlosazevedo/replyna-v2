import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const STATE_MAX_AGE_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Encrypts a plaintext string using AES-256-GCM (compatible with Deno Edge Functions decrypt).
 * Uses PBKDF2 key derivation with same salt as encryption.ts.
 */
async function encryptToken(plaintext: string, masterKey: string): Promise<string> {
  // Derive key using PBKDF2 (same params as Deno encryption.ts)
  const key = crypto.pbkdf2Sync(masterKey, 'replyna-v2-salt', 100000, 32, 'sha256')

  // Generate random 12-byte IV
  const iv = crypto.randomBytes(12)

  // Encrypt with AES-256-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Combine: iv(12) + ciphertext + authTag(16) → base64
  const combined = Buffer.concat([iv, encrypted, authTag])
  return combined.toString('base64')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code, state, shop } = req.query as Record<string, string>

  if (!code || !state || !shop) {
    return res.redirect(302, 'https://app.replyna.me/shops?shopify_oauth=error&reason=missing_params')
  }

  const oauthSecret = process.env.SHOPIFY_OAUTH_SECRET
  const encryptionKey = process.env.OAUTH_ENCRYPTION_KEY
  const supabaseUrl = process.env.SUPABASE_URL || 'https://ulldjamxdsaqqyurcmcs.supabase.co'
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!oauthSecret || !encryptionKey || !supabaseServiceKey) {
    console.error('[shopify-callback] Missing environment variables')
    return res.redirect(302, 'https://app.replyna.me/shops?shopify_oauth=error&reason=server_config')
  }

  try {
    // 1. Verify HMAC state (anti-CSRF)
    const [stateBase64, hmacReceived] = (state as string).split('.')
    if (!stateBase64 || !hmacReceived) {
      return res.redirect(302, 'https://app.replyna.me/shops?shopify_oauth=error&reason=invalid_state')
    }

    const hmacExpected = crypto.createHmac('sha256', oauthSecret).update(stateBase64).digest('base64url')
    if (!crypto.timingSafeEqual(Buffer.from(hmacReceived), Buffer.from(hmacExpected))) {
      return res.redirect(302, 'https://app.replyna.me/shops?shopify_oauth=error&reason=invalid_state')
    }

    // Decode state payload
    const statePayload = JSON.parse(Buffer.from(stateBase64, 'base64url').toString('utf8'))
    const { shop_id, ts } = statePayload

    // Check expiration (10 min)
    if (Date.now() - ts > STATE_MAX_AGE_MS) {
      return res.redirect(302, 'https://app.replyna.me/shops?shopify_oauth=error&reason=expired_state')
    }

    // 2. Fetch shop from DB to get client_id and client_secret
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: shopData, error: shopError } = await supabase
      .from('shops')
      .select('id, shopify_domain, shopify_client_id, shopify_client_secret')
      .eq('id', shop_id)
      .single()

    if (shopError || !shopData) {
      console.error('[shopify-callback] Shop not found:', shop_id, shopError)
      return res.redirect(302, 'https://app.replyna.me/shops?shopify_oauth=error&reason=shop_not_found')
    }

    const clientId = shopData.shopify_client_id
    const clientSecret = shopData.shopify_client_secret

    if (!clientId || !clientSecret) {
      return res.redirect(302, `https://app.replyna.me/shops/${shop_id}?shopify_oauth=error&reason=missing_credentials`)
    }

    // 3. Exchange authorization code for access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('[shopify-callback] Token exchange failed:', tokenResponse.status, errorText.substring(0, 300))
      return res.redirect(302, `https://app.replyna.me/shops/${shop_id}?shopify_oauth=error&reason=token_exchange_failed`)
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      console.error('[shopify-callback] No access_token in response:', tokenData)
      return res.redirect(302, `https://app.replyna.me/shops/${shop_id}?shopify_oauth=error&reason=no_token`)
    }

    // 4. Encrypt the access token
    const encryptedToken = await encryptToken(accessToken, encryptionKey)

    // 5. Save to database
    const { error: updateError } = await supabase
      .from('shops')
      .update({
        shopify_access_token_encrypted: encryptedToken,
        shopify_auth_type: 'oauth',
        shopify_status: 'ok',
      })
      .eq('id', shop_id)

    if (updateError) {
      console.error('[shopify-callback] DB update failed:', updateError)
      return res.redirect(302, `https://app.replyna.me/shops/${shop_id}?shopify_oauth=error&reason=db_error`)
    }

    // 6. Verify token works by calling shop.json
    const verifyResponse = await fetch(`https://${shop}/admin/api/2025-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    })

    if (!verifyResponse.ok) {
      console.warn('[shopify-callback] Token verification failed but token was saved:', verifyResponse.status)
    }

    // 7. Redirect to shop details with success
    return res.redirect(302, `https://app.replyna.me/shops/${shop_id}?shopify_oauth=success`)
  } catch (err) {
    console.error('[shopify-callback] Unexpected error:', err)
    return res.redirect(302, 'https://app.replyna.me/shops?shopify_oauth=error&reason=unexpected')
  }
}
