/**
 * Edge Function: get-shop-public-info
 *
 * Retorna informações públicas da loja (nome, idioma, logo).
 * Busca o logo via:
 *   1. Cache no banco (logo_url)
 *   2. Shopify GraphQL Admin API (brand.squareLogo / brand.logo)
 *   3. Scraping do HTML público da loja (favicon / og:image)
 *
 * Input: { shop_id: string }
 * Output: { name, language, logo_url }
 */

// deno-lint-ignore-file no-explicit-any
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

import { getCorsHeaders } from '../_shared/cors.ts';
import { decrypt, getEncryptionKey } from '../_shared/encryption.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

/**
 * Tenta buscar logo via Shopify GraphQL Admin API
 */
async function fetchLogoViaGraphQL(shop: any): Promise<string | null> {
  try {
    if (!shop.shopify_domain || !shop.shopify_client_id) return null;

    const encryptionKey = getEncryptionKey();
    let accessToken: string | undefined;

    if (shop.shopify_auth_type === 'oauth' && shop.shopify_access_token_encrypted) {
      const oauthKey = Deno.env.get('OAUTH_ENCRYPTION_KEY');
      if (!oauthKey) return null;
      accessToken = await decrypt(shop.shopify_access_token_encrypted, oauthKey);
    } else if (shop.shopify_client_secret_encrypted) {
      const clientSecret = await decrypt(shop.shopify_client_secret_encrypted, encryptionKey);
      const tokenRes = await fetch(`https://${shop.shopify_domain}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: shop.shopify_client_id,
          client_secret: clientSecret,
          grant_type: 'client_credentials',
        }),
      });
      if (!tokenRes.ok) return null;
      const tokenData = await tokenRes.json();
      accessToken = tokenData.access_token;
    }

    if (!accessToken) return null;

    const graphqlRes = await fetch(`https://${shop.shopify_domain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({
        query: `{
          shop {
            brand {
              squareLogo { image { url } }
              logo { image { url } }
            }
          }
        }`,
      }),
    });

    if (!graphqlRes.ok) {
      console.log(`[get-shop-public-info] GraphQL ${graphqlRes.status} para ${shop.shopify_domain}`);
      return null;
    }

    const data = await graphqlRes.json();
    const brand = data?.data?.shop?.brand;
    return brand?.squareLogo?.image?.url || brand?.logo?.image?.url || null;
  } catch (error: any) {
    console.log(`[get-shop-public-info] GraphQL falhou: ${error.message}`);
    return null;
  }
}

/**
 * Busca o favicon/logo parseando o HTML público da loja Shopify
 * Procura: <link rel="shortcut icon"> ou <meta property="og:image">
 */
async function fetchLogoViaStorefront(shopifyDomain: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`https://${shopifyDomain}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Replyna/1.0' },
      redirect: 'follow',
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const html = await res.text();

    // 1. Procurar <link rel="shortcut icon" href="...">
    const faviconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i);
    if (faviconMatch?.[1]) {
      let url = faviconMatch[1];
      // Resolver URLs relativas ou protocol-relative
      if (url.startsWith('//')) url = 'https:' + url;
      else if (url.startsWith('/')) url = `https://${shopifyDomain}${url}`;
      console.log(`[get-shop-public-info] Favicon encontrado via HTML: ${url}`);
      return url;
    }

    // 2. Fallback: <meta property="og:image" content="...">
    const ogMatch = html.match(/<meta[^>]*property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i);
    if (ogMatch?.[1]) {
      let url = ogMatch[1];
      if (url.startsWith('//')) url = 'https:' + url;
      console.log(`[get-shop-public-info] OG image encontrado via HTML: ${url}`);
      return url;
    }

    return null;
  } catch (error: any) {
    console.log(`[get-shop-public-info] Storefront fetch falhou: ${error.message}`);
    return null;
  }
}

/**
 * Tenta todas as estratégias para encontrar o logo da loja
 */
async function fetchShopLogo(shop: any): Promise<string | null> {
  // Estratégia 1: GraphQL Admin API (mais confiável se tiver permissão)
  const graphqlLogo = await fetchLogoViaGraphQL(shop);
  if (graphqlLogo) return graphqlLogo;

  // Estratégia 2: Scraping do HTML público da loja
  if (shop.shopify_domain) {
    const storefrontLogo = await fetchLogoViaStorefront(shop.shopify_domain);
    if (storefrontLogo) return storefrontLogo;
  }

  return null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shop_id } = await req.json();

    if (!shop_id) {
      return new Response(
        JSON.stringify({ error: 'shop_id é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();

    const { data: shop, error } = await supabase
      .from('shops')
      .select('name, shopify_domain, language, logo_url, shopify_client_id, shopify_client_secret_encrypted, shopify_access_token_encrypted, shopify_auth_type')
      .eq('id', shop_id)
      .single();

    if (error || !shop) {
      return new Response(
        JSON.stringify({ error: 'Loja não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se já tem logo cacheado (e não é string vazia), retornar direto
    let logoUrl = shop.logo_url && shop.logo_url.length > 0 ? shop.logo_url : null;

    // Se não tem logo cacheado, buscar
    if (!logoUrl) {
      logoUrl = await fetchShopLogo(shop);

      // Cachear resultado (null vira string vazia para não buscar novamente)
      await supabase
        .from('shops')
        .update({ logo_url: logoUrl || '' })
        .eq('id', shop_id);
    }

    return new Response(
      JSON.stringify({
        name: shop.name,
        language: shop.language,
        logo_url: logoUrl || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[get-shop-public-info] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
