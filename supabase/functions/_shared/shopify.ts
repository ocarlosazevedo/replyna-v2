/**
 * Módulo de Integração Shopify
 * Busca dados de pedidos e clientes
 * Inclui circuit breaker para detecção de Shopify offline
 */

import { decrypt, getEncryptionKey } from './encryption.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Supabase client for circuit breaker operations
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseKey);
}

// =====================================================================
// Circuit Breaker Functions
// =====================================================================

export interface CircuitBreakerState {
  isOpen: boolean;
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  lastFailureAt: string | null;
  nextAttemptAt: string | null;
}

/**
 * Check if the Shopify circuit breaker is open for a shop
 * Returns true if circuit is OPEN (should skip processing)
 * Returns false if circuit is CLOSED or HALF_OPEN (should try processing)
 */
export async function isShopifyCircuitOpen(shopId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('is_shopify_circuit_open', {
      p_shop_id: shopId,
    });

    if (error) {
      console.error('[Shopify Circuit] Error checking circuit state:', error);
      return false; // On error, allow processing (fail open)
    }

    return data === true;
  } catch (error) {
    console.error('[Shopify Circuit] Exception checking circuit state:', error);
    return false;
  }
}

/**
 * Get detailed circuit breaker state for a shop
 */
export async function getShopifyCircuitState(shopId: string): Promise<CircuitBreakerState | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('circuit_breakers')
      .select('state, failure_count, last_failure_at, next_attempt_at')
      .eq('shop_id', shopId)
      .eq('service', 'shopify')
      .single();

    if (error || !data) {
      return null; // No circuit breaker = closed (working)
    }

    return {
      isOpen: data.state === 'open',
      state: data.state as 'closed' | 'open' | 'half_open',
      failureCount: data.failure_count,
      lastFailureAt: data.last_failure_at,
      nextAttemptAt: data.next_attempt_at,
    };
  } catch (error) {
    console.error('[Shopify Circuit] Exception getting circuit state:', error);
    return null;
  }
}

/**
 * Record a Shopify failure and potentially open the circuit breaker
 * Returns the new circuit state: 'closed', 'open', or 'half_open'
 */
export async function recordShopifyFailure(shopId: string, errorMessage?: string): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('record_shopify_failure', {
      p_shop_id: shopId,
      p_error_message: errorMessage || null,
    });

    if (error) {
      console.error('[Shopify Circuit] Error recording failure:', error);
      return 'closed';
    }

    const newState = data as string;
    console.log(`[Shopify Circuit] Recorded failure for shop ${shopId}, new state: ${newState}`);
    return newState;
  } catch (error) {
    console.error('[Shopify Circuit] Exception recording failure:', error);
    return 'closed';
  }
}

/**
 * Record a Shopify success and close the circuit if in half_open state
 * Also triggers reprocessing of pending_shopify emails
 * Returns the new circuit state: 'closed'
 */
export async function recordShopifySuccess(shopId: string): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('record_shopify_success', {
      p_shop_id: shopId,
    });

    if (error) {
      console.error('[Shopify Circuit] Error recording success:', error);
      return 'closed';
    }

    const newState = data as string;
    console.log(`[Shopify Circuit] Recorded success for shop ${shopId}, new state: ${newState}`);
    return newState;
  } catch (error) {
    console.error('[Shopify Circuit] Exception recording success:', error);
    return 'closed';
  }
}

// Tipos
export interface ShopifyCredentials {
  domain: string;
  client_id: string;
  client_secret: string;
  access_token?: string;
}

export interface ShopifyOrder {
  id: number;
  order_number: number;
  name: string; // "#1001"
  created_at: string;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: string;
  currency: string;
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  } | null;
  line_items: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
  }>;
  fulfillments: Array<{
    id: number;
    status: string;
    tracking_number: string | null;
    tracking_url: string | null;
    tracking_company: string | null;
  }>;
  shipping_address?: {
    city: string;
    province: string;
    country: string;
  };
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  orders_count: number;
  total_spent: string;
  created_at: string;
}

export interface OrderSummary {
  order_number: string;
  order_date: string;
  order_status: string;
  order_total: string;
  tracking_number: string | null;
  tracking_url: string | null;
  fulfillment_status: string | null;
  items: Array<{ name: string; quantity: number }>;
  customer_name: string | null;
}

/**
 * Decripta as credenciais Shopify de uma loja
 */
export async function decryptShopifyCredentials(shop: {
  shopify_domain: string | null;
  shopify_client_id: string | null;
  shopify_client_secret: string | null;
  shopify_client_secret_encrypted: string | null;
  shopify_access_token_encrypted?: string | null;
  shopify_auth_type?: string | null;
}): Promise<ShopifyCredentials | null> {
  if (!shop.shopify_domain || !shop.shopify_client_id) {
    return null;
  }

  const encryptionKey = getEncryptionKey();

  let clientSecret = '';
  if (shop.shopify_client_secret_encrypted) {
    clientSecret = await decrypt(shop.shopify_client_secret_encrypted, encryptionKey);
  } else if (shop.shopify_client_secret) {
    clientSecret = shop.shopify_client_secret;
  }

  // For OAuth apps, decrypt the stored access token using dedicated OAuth key
  let accessToken: string | undefined;
  if (shop.shopify_auth_type === 'oauth' && shop.shopify_access_token_encrypted) {
    const oauthKey = Deno.env.get('OAUTH_ENCRYPTION_KEY');
    if (!oauthKey) {
      throw new Error('OAUTH_ENCRYPTION_KEY não está configurada.');
    }
    accessToken = await decrypt(shop.shopify_access_token_encrypted, oauthKey);
  }

  // OAuth apps may not have client_secret, but must have access_token
  if (!clientSecret && !accessToken) {
    return null;
  }

  return {
    domain: shop.shopify_domain,
    client_id: shop.shopify_client_id,
    client_secret: clientSecret,
    access_token: accessToken,
  };
}

/**
 * Obtém access token via Client Credentials Grant (Shopify 2024+)
 */
async function getAccessToken(credentials: ShopifyCredentials): Promise<string> {
  // Se já tem token, retornar
  if (credentials.access_token) {
    return credentials.access_token;
  }

  const tokenUrl = `https://${credentials.domain}/admin/oauth/access_token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[Shopify Auth] Falha ao obter token para ${credentials.domain}: ${response.status} - ${error.substring(0, 200)}`);
    throw new Error(`Erro ao obter access token Shopify: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log(`[Shopify Auth] Token obtido com sucesso para ${credentials.domain}`);
  return data.access_token;
}

/**
 * Faz uma requisição para a API Admin do Shopify
 */
async function shopifyRequest<T>(
  credentials: ShopifyCredentials,
  endpoint: string,
  method: string = 'GET',
  body?: unknown
): Promise<T> {
  const accessToken = await getAccessToken(credentials);
  const url = `https://${credentials.domain}/admin/api/2025-01/${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[Shopify API] ${method} ${url} → ${response.status}: ${error.substring(0, 200)}`);
    throw new Error(`Erro na API Shopify: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Busca pedidos de um cliente pelo email
 * Tenta primeiro pela API de orders com filtro email,
 * depois fallback via customer search + orders do customer
 */
export async function getOrdersByCustomerEmail(
  credentials: ShopifyCredentials,
  customerEmail: string,
  limit: number = 5
): Promise<ShopifyOrder[]> {
  const normalizedEmail = customerEmail.trim().toLowerCase();
  console.log(`[Shopify] Buscando pedidos para email: ${normalizedEmail}`);

  // Tentativa 1: Busca direta por email na API de orders
  try {
    const data = await shopifyRequest<{ orders: ShopifyOrder[] }>(
      credentials,
      `orders.json?email=${encodeURIComponent(normalizedEmail)}&status=any&limit=${limit}`
    );

    if (data.orders && data.orders.length > 0) {
      console.log(`[Shopify] Encontrados ${data.orders.length} pedidos via orders?email=`);
      return data.orders;
    }
    console.log(`[Shopify] Nenhum pedido encontrado via orders?email= para ${normalizedEmail}`);
  } catch (error: any) {
    console.error(`[Shopify] Erro na busca direta por email (${normalizedEmail}):`, error.message);
  }

  // Tentativa 2: Buscar cliente pelo email e depois seus pedidos
  try {
    console.log(`[Shopify] Tentando fallback via customer search para ${normalizedEmail}`);
    const customer = await getCustomerByEmail(credentials, normalizedEmail);

    if (customer) {
      console.log(`[Shopify] Cliente encontrado: ${customer.first_name} ${customer.last_name} (ID: ${customer.id})`);
      const customerOrders = await getOrdersByCustomerId(credentials, customer.id, limit);

      if (customerOrders.length > 0) {
        console.log(`[Shopify] Encontrados ${customerOrders.length} pedidos via customer ID ${customer.id}`);
        return customerOrders;
      }
      console.log(`[Shopify] Cliente encontrado mas sem pedidos associados`);
    } else {
      console.log(`[Shopify] Nenhum cliente encontrado para email ${normalizedEmail}`);
    }
  } catch (error: any) {
    console.error(`[Shopify] Erro no fallback via customer search (${normalizedEmail}):`, error.message);
  }

  return [];
}

/**
 * Busca pedidos pelo ID do cliente no Shopify
 */
async function getOrdersByCustomerId(
  credentials: ShopifyCredentials,
  customerId: number,
  limit: number = 5
): Promise<ShopifyOrder[]> {
  try {
    const data = await shopifyRequest<{ orders: ShopifyOrder[] }>(
      credentials,
      `orders.json?customer_id=${customerId}&status=any&limit=${limit}`
    );
    return data.orders || [];
  } catch (error: any) {
    console.error(`[Shopify] Erro ao buscar pedidos por customer_id ${customerId}:`, error.message);
    return [];
  }
}

/**
 * Busca um pedido pelo número
 * Tenta múltiplos formatos: #2202, 2202, order_number
 */
export async function getOrderByNumber(
  credentials: ShopifyCredentials,
  orderNumber: string
): Promise<ShopifyOrder | null> {
  try {
    // Remover # se presente
    const cleanNumber = orderNumber.replace(/^#/, '').trim();

    console.log(`[Shopify] Buscando pedido: ${cleanNumber}`);

    // Tentar busca pelo campo name (formato Shopify padrão: #1234)
    const formats = [
      `#${cleanNumber}`,  // #2202
      cleanNumber,         // 2202 (alguns stores usam sem #)
    ];

    for (const format of formats) {
      console.log(`[Shopify] Tentando formato: ${format}`);

      const data = await shopifyRequest<{ orders: ShopifyOrder[] }>(
        credentials,
        `orders.json?name=${encodeURIComponent(format)}&status=any&limit=1`
      );

      if (data.orders && data.orders.length > 0) {
        console.log(`[Shopify] Pedido encontrado com formato ${format}: ${data.orders[0].name}`);
        return data.orders[0];
      }
    }

    // Tentar busca pelo order_number (ID interno do Shopify)
    console.log(`[Shopify] Tentando busca por order_number: ${cleanNumber}`);
    const dataByNumber = await shopifyRequest<{ orders: ShopifyOrder[] }>(
      credentials,
      `orders.json?order_number=${cleanNumber}&status=any&limit=1`
    );

    if (dataByNumber.orders && dataByNumber.orders.length > 0) {
      console.log(`[Shopify] Pedido encontrado por order_number: ${dataByNumber.orders[0].name}`);
      return dataByNumber.orders[0];
    }

    console.log(`[Shopify] Nenhum pedido encontrado para: ${cleanNumber}`);
    return null;
  } catch (error) {
    console.error('[Shopify] Erro ao buscar pedido por número:', error);
    return null;
  }
}

/**
 * Busca um pedido pelo ID
 */
export async function getOrderById(
  credentials: ShopifyCredentials,
  orderId: number | string
): Promise<ShopifyOrder | null> {
  try {
    const data = await shopifyRequest<{ order: ShopifyOrder }>(
      credentials,
      `orders/${orderId}.json`
    );

    return data.order || null;
  } catch (error) {
    console.error('Erro ao buscar pedido por ID:', error);
    return null;
  }
}

/**
 * Busca cliente pelo email
 */
export async function getCustomerByEmail(
  credentials: ShopifyCredentials,
  email: string
): Promise<ShopifyCustomer | null> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const data = await shopifyRequest<{ customers: ShopifyCustomer[] }>(
      credentials,
      `customers/search.json?query=email:${encodeURIComponent(normalizedEmail)}&limit=1`
    );

    const customer = data.customers?.[0] || null;
    if (customer) {
      console.log(`[Shopify] Cliente encontrado para ${normalizedEmail}: ${customer.first_name} ${customer.last_name} (${customer.orders_count} pedidos)`);
    }
    return customer;
  } catch (error: any) {
    console.error(`[Shopify] Erro ao buscar cliente por email (${email}):`, error.message);
    return null;
  }
}

/**
 * Converte um pedido Shopify para o formato resumido usado na IA
 */
export function orderToSummary(order: ShopifyOrder): OrderSummary {
  // Encontrar tracking mais recente
  const latestFulfillment = order.fulfillments?.[order.fulfillments.length - 1];

  // Traduzir status
  const financialStatusMap: Record<string, string> = {
    pending: 'Pagamento pendente',
    authorized: 'Pagamento autorizado',
    partially_paid: 'Parcialmente pago',
    paid: 'Pago',
    partially_refunded: 'Parcialmente reembolsado',
    refunded: 'Reembolsado',
    voided: 'Cancelado',
  };

  const fulfillmentStatusMap: Record<string, string> = {
    fulfilled: 'Enviado',
    partial: 'Parcialmente enviado',
    unfulfilled: 'Aguardando envio',
    null: 'Aguardando envio',
  };

  return {
    order_number: order.name || `#${order.order_number}`,
    order_date: formatDate(order.created_at),
    order_status: financialStatusMap[order.financial_status] || order.financial_status,
    order_total: formatCurrency(order.total_price, order.currency),
    tracking_number: latestFulfillment?.tracking_number || null,
    tracking_url: latestFulfillment?.tracking_url || null,
    fulfillment_status:
      fulfillmentStatusMap[order.fulfillment_status || 'null'] ||
      order.fulfillment_status ||
      'Aguardando envio',
    items: order.line_items.map((item) => ({
      name: item.title,
      quantity: item.quantity,
    })),
    customer_name: order.customer
      ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
      : null,
  };
}

/**
 * Busca dados do pedido para enriquecer a resposta da IA
 */
export async function getOrderDataForAI(
  credentials: ShopifyCredentials,
  customerEmail: string,
  orderNumberFromEmail?: string | null
): Promise<OrderSummary | null> {
  console.log(`[getOrderDataForAI] email=${customerEmail}, orderNumber=${orderNumberFromEmail || 'none'}`);

  // Se tem número do pedido no email, buscar direto
  if (orderNumberFromEmail) {
    const order = await getOrderByNumber(credentials, orderNumberFromEmail);
    if (order) {
      console.log(`[getOrderDataForAI] Pedido encontrado por número: ${order.name}`);
      return orderToSummary(order);
    }
    console.log(`[getOrderDataForAI] Pedido não encontrado por número, tentando por email...`);
  }

  // Buscar pelo email do cliente (inclui fallback via customer search)
  const orders = await getOrdersByCustomerEmail(credentials, customerEmail, 1);
  if (orders.length > 0) {
    console.log(`[getOrderDataForAI] Pedido encontrado por email: ${orders[0].name}`);
    return orderToSummary(orders[0]);
  }

  console.log(`[getOrderDataForAI] Nenhum pedido encontrado para email=${customerEmail}`);
  return null;
}

/**
 * Busca dados de MÚLTIPLOS pedidos para enriquecer a resposta da IA
 * Útil quando cliente menciona mais de um pedido no mesmo email
 */
export async function getMultipleOrdersDataForAI(
  credentials: ShopifyCredentials,
  customerEmail: string,
  orderNumbers: string[]
): Promise<OrderSummary[]> {
  const results: OrderSummary[] = [];

  // Limitar a 5 pedidos para não sobrecarregar
  const limitedOrderNumbers = orderNumbers.slice(0, 5);

  for (const orderNumber of limitedOrderNumbers) {
    try {
      const order = await getOrderByNumber(credentials, orderNumber);
      if (order) {
        results.push(orderToSummary(order));
      }
    } catch (error) {
      console.error(`[getMultipleOrdersDataForAI] Error fetching order ${orderNumber}:`, error);
    }
  }

  // Se não encontrou nenhum pelos números, tentar pelo email
  if (results.length === 0) {
    const orders = await getOrdersByCustomerEmail(credentials, customerEmail, 1);
    if (orders.length > 0) {
      results.push(orderToSummary(orders[0]));
    }
  }

  console.log(`[getMultipleOrdersDataForAI] Found ${results.length} orders for numbers: ${orderNumbers.join(', ')}`);
  return results;
}

/**
 * Extrai número de pedido de um texto (subject ou body do email)
 */
export function extractOrderNumber(text: string): string | null {
  if (!text) return null;

  // Padrões comuns de número de pedido (incluindo formatos com letras como #W185ES1320)
  // IMPORTANTE: Patterns mais específicos primeiro, mais genéricos depois
  const patterns = [
    // Formatos explícitos com palavra-chave (suporta "é", ":", "=", espaço como separador)
    /order\s*(?:#|:|\s|é|=)\s*#?([A-Z]*\d+[A-Z]*\d*)/i,     // order #2202, order: 2202, order is 2202
    /pedido\s*(?:#|:|\s|é|=)\s*#?([A-Z]*\d+[A-Z]*\d*)/i,   // pedido #2202, pedido é 2202
    /número\s*(?:do\s*)?(?:pedido\s*)?(?:#|:|\s|é|=)\s*#?([A-Z]*\d+[A-Z]*\d*)/i, // número do pedido é 2202
    /nº\s*(?:#|:|\s|é|=)\s*#?([A-Z]*\d+[A-Z]*\d*)/i,       // nº 2202, nº: 2202
    /commande\s*(?:#|:|\s|est|=)\s*#?([A-Z]*\d+[A-Z]*\d*)/i, // commande (francês)
    /bestellung\s*(?:#|:|\s|ist|=)\s*#?([A-Z]*\d+[A-Z]*\d*)/i, // bestellung (alemão)
    /bestelling\s*(?:#|:|\s|is|=)\s*#?([A-Z]*\d+[A-Z]*\d*)/i, // bestelling (holandês)
    /ordine\s*(?:#|:|\s|è|=)\s*#?([A-Z]*\d+[A-Z]*\d*)/i,   // ordine (italiano)
    /ordernummer\s*(?:#|:|\s|is|=)\s*#?([A-Z]*\d+[A-Z]*\d*)/i, // ordernummer (holandês/alemão)

    // Formato com # (ex: #2202, # 2202)
    /#\s*([A-Z]*\d+[A-Z]*\d*)/i,

    // Número longo isolado (7+ dígitos) - provavelmente número de pedido
    /\b(\d{7,})\b/,

    // Número isolado no início da linha (provavelmente número de pedido)
    /^([A-Z]*\d{4,}[A-Z]*\d*)$/im,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const orderNum = match[1].trim();
      // Validar: pelo menos 3 dígitos para evitar falsos positivos
      const digitCount = (orderNum.match(/\d/g) || []).length;
      if (digitCount >= 3) {
        console.log(`[extractOrderNumber] Found order number: ${orderNum} from pattern: ${pattern}`);
        return orderNum;
      }
    }
  }

  return null;
}

/**
 * Extrai TODOS os números de pedido de um texto (para casos com múltiplos pedidos)
 */
export function extractAllOrderNumbers(text: string): string[] {
  if (!text) return [];

  const foundOrders: string[] = [];

  // Padrões comuns de número de pedido
  const patterns = [
    // Formatos explícitos com palavra-chave (inclui "Order Number:", "Order No:", etc.)
    /order\s*(?:number|num|no\.?)?\s*(?:#|:|\s|é|=)\s*#?([A-Z]*\d+[A-Z]*\d*)/gi,
    /pedido\s*(?:número|numero|nº|num|no\.?)?\s*(?:#|:|\s|é|=)\s*#?([A-Z]*\d+[A-Z]*\d*)/gi,
    /número\s*(?:do\s*)?(?:pedido\s*)?(?:#|:|\s|é|=)\s*#?([A-Z]*\d+[A-Z]*\d*)/gi,
    /nº\s*(?:#|:|\s|é|=)\s*#?([A-Z]*\d+[A-Z]*\d*)/gi,
    /commande\s*(?:numéro|n°|nº|num|no\.?)?\s*(?:#|:|\s|est|=)\s*#?([A-Z]*\d+[A-Z]*\d*)/gi,
    /bestellung\s*(?:nummer|nr\.?)?\s*(?:#|:|\s|ist|=)\s*#?([A-Z]*\d+[A-Z]*\d*)/gi,
    /bestelling\s*(?:nummer|nr\.?)?\s*(?:#|:|\s|is|=)\s*#?([A-Z]*\d+[A-Z]*\d*)/gi,
    /ordine\s*(?:numero|n°|nr\.?)?\s*(?:#|:|\s|è|=)\s*#?([A-Z]*\d+[A-Z]*\d*)/gi,
    /ordernummer\s*(?:#|:|\s|is|=)\s*#?([A-Z]*\d+[A-Z]*\d*)/gi,
    /objednávka\s*(?:číslo|č\.?)?\s*(?:#|:|\s|=)\s*#?([A-Z]*\d+[A-Z]*\d*)/gi,
    /zamówienie\s*(?:numer|nr\.?)?\s*(?:#|:|\s|=)\s*#?([A-Z]*\d+[A-Z]*\d*)/gi,
    // Formato com #
    /#\s*([A-Z]*\d+[A-Z]*\d*)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const orderNum = match[1].trim();
      const digitCount = (orderNum.match(/\d/g) || []).length;
      if (digitCount >= 3 && !foundOrders.includes(orderNum)) {
        foundOrders.push(orderNum);
      }
    }
  }

  // Também procurar números longos isolados (7+ dígitos)
  const longNumberPattern = /\b(\d{7,})\b/g;
  let match;
  while ((match = longNumberPattern.exec(text)) !== null) {
    const orderNum = match[1].trim();
    if (!foundOrders.includes(orderNum)) {
      foundOrders.push(orderNum);
    }
  }

  if (foundOrders.length > 0) {
    console.log(`[extractAllOrderNumbers] Found ${foundOrders.length} order numbers: ${foundOrders.join(', ')}`);
  }

  return foundOrders;
}

// Helpers

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCurrency(amount: string, currency: string): string {
  const num = parseFloat(amount);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(num);
}
