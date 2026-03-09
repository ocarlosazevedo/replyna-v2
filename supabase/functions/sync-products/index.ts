/**
 * Edge Function: sync-products
 *
 * Sincroniza o catálogo de produtos do Shopify para o cache local.
 * Permite que a IA responda perguntas sobre disponibilidade, variantes e preços.
 *
 * Input:
 * - shop_id: ID da loja (obrigatório)
 *
 * Pode ser chamado:
 * - Manualmente pelo lojista (botão "Sincronizar Catálogo")
 * - Via cron para manter o cache atualizado
 */

// deno-lint-ignore-file no-explicit-any
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

import {
  decryptShopifyCredentials,
  syncProductsToCache,
  isShopifyCircuitOpen,
  recordShopifySuccess,
  recordShopifyFailure,
} from '../_shared/shopify.ts';

import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Autenticação: aceita service_role ou user autenticado
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // SERVICE_ROLE_JWT contém o JWT correto; SUPABASE_SERVICE_ROLE_KEY pode conter apenas o secret
    const serviceRoleJwt = Deno.env.get('SERVICE_ROLE_JWT') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Cliente service_role (para operações de banco)
    const supabase = createClient(supabaseUrl, serviceRoleJwt);

    // Parse body
    const body = await req.json();
    const { shop_id } = body;

    if (!shop_id) {
      return new Response(
        JSON.stringify({ error: 'shop_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o usuário tem acesso à shop (ou é service_role)
    const token = authHeader.replace('Bearer ', '');
    const isServiceRole = token === serviceRoleJwt;

    if (!isServiceRole) {
      // Verificar user via Auth API diretamente
      const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          'Authorization': authHeader,
          'apikey': serviceRoleJwt,
        },
      });

      if (!authResponse.ok) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const user = await authResponse.json();
      if (!user || !user.id) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar ownership da shop
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id, user_id')
        .eq('id', shop_id)
        .single();

      if (shopError || !shop || shop.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Shop not found or unauthorized' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Buscar credenciais da shop
    const { data: shop, error: shopFetchError } = await supabase
      .from('shops')
      .select(`
        id, shopify_domain, shopify_client_id, shopify_client_secret,
        shopify_client_secret_encrypted, shopify_access_token_encrypted,
        shopify_auth_type
      `)
      .eq('id', shop_id)
      .single();

    if (shopFetchError || !shop) {
      return new Response(
        JSON.stringify({ error: 'Shop not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!shop.shopify_domain) {
      return new Response(
        JSON.stringify({ error: 'Shop has no Shopify integration configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check circuit breaker
    const circuitOpen = await isShopifyCircuitOpen(shop_id);
    if (circuitOpen) {
      return new Response(
        JSON.stringify({
          error: 'Shopify is temporarily unavailable for this shop',
          circuit_open: true,
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decriptar credenciais
    const credentials = await decryptShopifyCredentials(shop);
    if (!credentials) {
      return new Response(
        JSON.stringify({ error: 'Could not decrypt Shopify credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Executar sync
    console.log(`[sync-products] Starting sync for shop ${shop_id}`);
    const result = await syncProductsToCache(shop_id, credentials, supabase);

    // Registrar sucesso no circuit breaker
    await recordShopifySuccess(shop_id);

    console.log(`[sync-products] Completed: ${result.synced} synced, ${result.errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: result.synced,
        errors: result.errors,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error(`[sync-products] Error:`, error);

    // Tentar registrar falha no circuit breaker
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.shop_id) {
        await recordShopifyFailure(body.shop_id, error.message);
      }
    } catch (_) {
      // Ignore
    }

    // Limpar mensagem de erro (pode conter HTML do Shopify)
    let errorMessage = error.message || 'Internal server error';
    if (errorMessage.includes('<!DOCTYPE') || errorMessage.includes('<html')) {
      if (errorMessage.includes('403')) {
        errorMessage = 'Acesso negado pelo Shopify (403). Verifique se as credenciais da API estão corretas e se o app ainda está instalado na loja.';
      } else if (errorMessage.includes('401')) {
        errorMessage = 'Credenciais Shopify inválidas (401). Reconfigure a integração.';
      } else if (errorMessage.includes('404')) {
        errorMessage = 'Loja Shopify não encontrada (404). Verifique o domínio configurado.';
      } else {
        errorMessage = 'Erro de comunicação com o Shopify. Verifique suas credenciais e tente novamente.';
      }
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      { status: 500, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
    );
  }
});
