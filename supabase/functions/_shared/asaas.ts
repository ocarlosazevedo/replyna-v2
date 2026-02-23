/**
 * Cliente Asaas para Edge Functions (Deno)
 * Sem SDK oficial: usa fetch nativo
 */

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

const ASAAS_BASE_URL = Deno.env.get('ASAAS_BASE_URL') || 'https://api.asaas.com/v3';
const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');

function assertApiKey(): void {
  if (!ASAAS_API_KEY) {
    throw new Error('ASAAS_API_KEY nao configurada');
  }
}

function maskSensitive(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;

  const clone = Array.isArray(value) ? [...value] : { ...value } as Record<string, unknown>;

  const sensitiveKeys = [
    'creditCard',
    'creditCardHolderInfo',
    'access_token',
    'api_key',
    'token',
    'password',
    'email',
    'cpfCnpj',
    'mobilePhone',
    'phone',
  ];

  for (const key of Object.keys(clone)) {
    if (sensitiveKeys.includes(key)) {
      clone[key] = '[REDACTED]';
    } else if (typeof clone[key] === 'object' && clone[key] !== null) {
      clone[key] = maskSensitive(clone[key]);
    }
  }

  return clone;
}

async function asaasRequest<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  assertApiKey();

  const url = `${ASAAS_BASE_URL}${path}`;
  const sanitizedBody = body ? maskSensitive(body) : undefined;

  console.log(`[ASAAS] ${method} ${url}`);
  if (sanitizedBody) {
    console.log('[ASAAS] Request body:', JSON.stringify(sanitizedBody));
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY!,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch (err) {
    console.error('[ASAAS] Falha ao parsear JSON:', err);
  }

  if (!response.ok) {
    console.error(`[ASAAS] Error ${response.status}:`, JSON.stringify(data));
    throw new Error(`Asaas API error: ${response.status} - ${JSON.stringify(data)}`);
  }

  const sanitizedResponse = maskSensitive(data);
  console.log('[ASAAS] Response:', JSON.stringify(sanitizedResponse));
  return data as T;
}

// ----------------------
// Types
// ----------------------

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string | null;
  mobilePhone?: string | null;
  phone?: string | null;
  createdAt?: string;
}

export interface AsaasCustomerList {
  data: AsaasCustomer[];
}

export interface AsaasSubscription {
  id: string;
  customer: string;
  billingType: 'CREDIT_CARD' | 'BOLETO' | 'PIX';
  value: number;
  cycle: 'MONTHLY' | 'WEEKLY' | 'YEARLY';
  description?: string;
  nextDueDate?: string;
  status?: string;
  createdAt?: string;
}

export interface AsaasSubscriptionList {
  data: AsaasSubscription[];
}

export interface AsaasPayment {
  id: string;
  customer: string;
  subscription?: string;
  billingType: 'CREDIT_CARD' | 'BOLETO' | 'PIX';
  value: number;
  dueDate?: string;
  status?: string;
  invoiceUrl?: string;
  createdAt?: string;
}

export interface AsaasPaymentList {
  data: AsaasPayment[];
}

export interface AsaasBalance {
  balance: number;
  available: number;
  pending: number;
}

export interface AsaasPaymentStatistics {
  totalCount?: number;
  totalValue?: number;
}

export type AsaasDiscountType = 'PERCENTAGE' | 'FIXED';

export interface AsaasDiscount {
  value: number;
  dueDateLimitDays: number;
  type: AsaasDiscountType;
}

// ----------------------
// Customers
// ----------------------

export async function createCustomer(input: {
  name: string;
  email: string;
  cpfCnpj?: string;
  mobilePhone?: string;
}): Promise<AsaasCustomer> {
  return await asaasRequest<AsaasCustomer>('POST', '/customers', input);
}

export async function getCustomerByEmail(email: string): Promise<AsaasCustomer | null> {
  const data = await asaasRequest<AsaasCustomerList>('GET', `/customers?email=${encodeURIComponent(email)}`);
  return data.data?.[0] || null;
}

export async function getCustomer(id: string): Promise<AsaasCustomer> {
  return await asaasRequest<AsaasCustomer>('GET', `/customers/${id}`);
}

export async function updateCustomer(id: string, input: Partial<{
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone: string;
}>): Promise<AsaasCustomer> {
  return await asaasRequest<AsaasCustomer>('PUT', `/customers/${id}`, input);
}

// ----------------------
// Subscriptions
// ----------------------

export async function createSubscription(input: {
  customer: string;
  billingType: 'CREDIT_CARD' | 'BOLETO' | 'PIX';
  value: number;
  cycle: 'MONTHLY' | 'WEEKLY' | 'YEARLY';
  description?: string;
  nextDueDate: string; // YYYY-MM-DD
  creditCard?: unknown;
  creditCardHolderInfo?: unknown;
  discount?: AsaasDiscount;
  callback?: {
    successUrl: string;
    autoRedirect?: boolean;
  };
}): Promise<AsaasSubscription> {
  return await asaasRequest<AsaasSubscription>('POST', '/subscriptions', input);
}

export async function getSubscription(id: string): Promise<AsaasSubscription> {
  return await asaasRequest<AsaasSubscription>('GET', `/subscriptions/${id}`);
}

export async function updateSubscription(id: string, input: {
  value?: number;
  description?: string;
  cycle?: 'MONTHLY' | 'WEEKLY' | 'YEARLY';
  discount?: AsaasDiscount;
  updatePendingPayments?: boolean;
  billingType?: 'CREDIT_CARD' | 'BOLETO' | 'PIX';
  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo?: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
    mobilePhone?: string;
    addressComplement?: string;
  };
}): Promise<AsaasSubscription> {
  return await asaasRequest<AsaasSubscription>('PUT', `/subscriptions/${id}`, input);
}

export async function deleteSubscription(id: string): Promise<{ deleted: boolean }> {
  return await asaasRequest<{ deleted: boolean }>('DELETE', `/subscriptions/${id}`);
}

export async function getSubscriptionsByCustomer(customerId: string): Promise<AsaasSubscriptionList> {
  return await asaasRequest<AsaasSubscriptionList>('GET', `/subscriptions?customer=${encodeURIComponent(customerId)}`);
}

// ----------------------
// Payments
// ----------------------

export async function createPayment(input: {
  customer: string;
  billingType: 'CREDIT_CARD' | 'BOLETO' | 'PIX';
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
}): Promise<AsaasPayment> {
  return await asaasRequest<AsaasPayment>('POST', '/payments', input);
}

export async function getPayment(id: string): Promise<AsaasPayment> {
  return await asaasRequest<AsaasPayment>('GET', `/payments/${id}`);
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null);
  if (entries.length === 0) return '';
  return `?${entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')}`;
}

export async function getPaymentsBySubscription(
  subscriptionId: string,
  options?: { status?: string; limit?: number; order?: 'asc' | 'desc' }
): Promise<AsaasPaymentList> {
  const query = buildQuery({
    subscription: subscriptionId,
    status: options?.status,
    limit: options?.limit,
    order: options?.order,
  });
  return await asaasRequest<AsaasPaymentList>('GET', `/payments${query}`);
}

export async function getPaymentsByCustomer(
  customerId: string,
  options?: { status?: string; limit?: number; order?: 'asc' | 'desc' }
): Promise<AsaasPaymentList> {
  const query = buildQuery({
    customer: customerId,
    status: options?.status,
    limit: options?.limit,
    order: options?.order,
  });
  return await asaasRequest<AsaasPaymentList>('GET', `/payments${query}`);
}

export async function getPaymentsByDateRange(input: {
  startDate: string;
  endDate: string;
  status?: string;
  limit?: number;
  order?: 'asc' | 'desc';
}): Promise<AsaasPaymentList> {
  const query = buildQuery({
    startDate: input.startDate,
    endDate: input.endDate,
    status: input.status,
    limit: input.limit,
    order: input.order,
  });
  return await asaasRequest<AsaasPaymentList>('GET', `/payments${query}`);
}

export async function deletePayment(id: string): Promise<{ deleted: boolean }> {
  return await asaasRequest<{ deleted: boolean }>('DELETE', `/payments/${id}`);
}

// ----------------------
// Financeiro
// ----------------------

export async function getBalance(): Promise<AsaasBalance> {
  return await asaasRequest<AsaasBalance>('GET', '/finance/balance');
}

export async function getPaymentStatistics(dateRange: { startDate: string; endDate: string }): Promise<AsaasPaymentStatistics> {
  const query = `?startDate=${encodeURIComponent(dateRange.startDate)}&endDate=${encodeURIComponent(dateRange.endDate)}`;
  return await asaasRequest<AsaasPaymentStatistics>('GET', `/finance/payment/statistics${query}`);
}
