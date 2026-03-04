/**
 * Edge Function: Search Orders
 *
 * Busca pedidos reais do Shopify pelo email do cliente.
 * Usado pelo formulário de devolução (/return-request).
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';
import { decryptShopifyCredentials, getOrdersByCustomerEmail } from '../_shared/shopify.ts';
import type { ShopifyOrder } from '../_shared/shopify.ts';

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shop_id, email } = await req.json();

    if (!shop_id || !email) {
      return new Response(
        JSON.stringify({ error: 'shop_id e email são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Buscar dados da loja
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('id, name, language, shopify_domain, shopify_client_id, shopify_client_secret, shopify_client_secret_encrypted, shopify_access_token_encrypted, shopify_auth_type')
      .eq('id', shop_id)
      .single();

    if (shopError || !shop) {
      return new Response(
        JSON.stringify({ error: 'Loja não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decriptar credenciais Shopify
    const credentials = await decryptShopifyCredentials(shop);
    if (!credentials) {
      return new Response(
        JSON.stringify({ error: 'Credenciais Shopify não configuradas para esta loja' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar pedidos do Shopify
    const shopifyOrders = await getOrdersByCustomerEmail(credentials, normalizedEmail, 10);

    if (shopifyOrders.length === 0) {
      return new Response(
        JSON.stringify({ orders: [], shop_name: shop.name, language: shop.language || null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar devoluções existentes na tabela conversations
    const orderIds = shopifyOrders.map(o => String(o.id));
    const { data: existingReturns } = await supabase
      .from('conversations')
      .select('shopify_order_id, ticket_status')
      .in('shopify_order_id', orderIds)
      .eq('category', 'troca_devolucao_reembolso');

    const returnStatusMap = new Map<string, string>();
    if (existingReturns) {
      for (const r of existingReturns) {
        if (r.shopify_order_id) {
          returnStatusMap.set(r.shopify_order_id, r.ticket_status || 'pending');
        }
      }
    }

    // Mapear ShopifyOrder → Order do frontend
    const orders = shopifyOrders.map((order: ShopifyOrder) => {
      const customerName = order.customer
        ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
        : '';
      const customerPhone = order.customer?.phone || order.shipping_address?.phone || '';

      let shippingAddress = null;
      if (order.shipping_address) {
        shippingAddress = {
          address1: order.shipping_address.address1 || '',
          address2: order.shipping_address.address2 || '',
          city: order.shipping_address.city || '',
          province: order.shipping_address.province || '',
          zip: order.shipping_address.zip || '',
          country: order.shipping_address.country || '',
        };
      }

      return {
        order_number: order.name,
        order_date: order.created_at,
        total: order.total_price,
        currency: order.currency,
        line_items: (order.line_items || []).map(item => ({
          title: item.title,
          quantity: item.quantity,
          price: item.price,
        })),
        customer_name: customerName,
        customer_phone: customerPhone,
        shipping_address: shippingAddress,
        existing_return_status: returnStatusMap.get(String(order.id)) || null,
        store_id: shop_id,
        shopify_order_id: String(order.id),
        store_name: shop.name,
      };
    });

    return new Response(
      JSON.stringify({ orders, shop_name: shop.name, language: shop.language || null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[search-orders] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno ao buscar pedidos' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
