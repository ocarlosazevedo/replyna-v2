/**
 * Cliente Supabase para Edge Functions (server-side)
 * Usa a Service Role Key para bypass de RLS quando necessário
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';

// Tipos das tabelas
export interface Shop {
  id: string;
  user_id: string;
  name: string;
  attendant_name: string;
  support_email: string;
  is_active: boolean;
  is_cod: boolean;

  // Shopify
  shopify_domain: string | null;
  shopify_client_id: string | null;
  shopify_client_secret: string | null;
  shopify_client_secret_encrypted: string | null;
  shopify_status: string | null;

  // Email
  imap_host: string | null;
  imap_port: string | null;
  imap_user: string | null;
  imap_password: string | null;
  imap_password_encrypted: string | null;
  smtp_host: string | null;
  smtp_port: string | null;
  smtp_user: string | null;
  smtp_password: string | null;
  smtp_password_encrypted: string | null;
  mail_status: string | null;

  // Customizações
  delivery_time: string | null;
  dispatch_time: string | null;
  warranty_info: string | null;
  store_description: string | null;
  tone_of_voice: string;
  fallback_message_template: string | null;
  signature_html: string | null;

  // Email processing options
  email_start_mode: 'all_unread' | 'from_integration_date';
  email_start_date: string | null;

  // Sync
  last_email_sync_at: string | null;
  email_sync_error: string | null;

  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  emails_limit: number | null;  // null = ilimitado
  emails_used: number;
  shops_limit: number | null;   // null = ilimitado
  last_credits_warning_at: string | null;
  credits_warning_count: number;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  shop_id: string;
  customer_name: string | null;
  customer_email: string | null;
  subject: string | null;
  category: string | null;
  status: 'open' | 'resolved' | 'pending_human' | 'closed';
  data_request_count: number;
  language: string;
  shopify_order_id: string | null;
  shopify_customer_id: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  message_id: string | null;
  in_reply_to: string | null;
  references_header: string | null;
  has_attachments: boolean;
  attachment_count: number;
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'processing' | 'replied' | 'pending_credits' | 'pending_human' | 'failed';
  category: string | null;
  category_confidence: number | null;
  was_auto_replied: boolean;
  auto_reply_message_id: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  received_at: string | null;
  processed_at: string | null;
  replied_at: string | null;
  created_at: string;
  error_message: string | null;
}

export interface EmailProcessingLog {
  id: string;
  shop_id: string | null;
  message_id: string | null;
  conversation_id: string | null;
  event_type: string;
  event_data: Record<string, unknown>;
  processing_time_ms: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  error_type: string | null;
  error_message: string | null;
  error_stack: string | null;
  created_at: string;
}

export interface RateLimit {
  id: string;
  shop_id: string;
  customer_email: string;
  responses_last_hour: number;
  last_response_at: string | null;
  hour_window_start: string;
  created_at: string;
  updated_at: string;
}

// Singleton do cliente
let supabaseClient: SupabaseClient | null = null;

/**
 * Obtém o cliente Supabase com Service Role Key
 * Necessário para operações server-side que precisam bypass de RLS
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios. ' +
        'Configure nas variáveis de ambiente.'
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

/**
 * Busca lojas ativas com email configurado
 * Ordena por last_email_sync_at (nulls first) para priorizar lojas que nunca sincronizaram
 */
export async function getActiveShopsWithEmail(): Promise<Shop[]> {
  const supabase = getSupabaseClient();

  const { data, error} = await supabase
    .from('shops')
    .select('*')
    .eq('is_active', true)
    .eq('mail_status', 'ok')
    .not('imap_host', 'is', null)
    .order('last_email_sync_at', { ascending: true, nullsFirst: true });

  if (error) throw error;
  return (data || []) as Shop[];
}

/**
 * Busca usuário pelo ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as User | null;
}

/**
 * Verifica se usuário tem créditos disponíveis
 */
export async function checkCreditsAvailable(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('check_credits_available', {
    p_user_id: userId,
  });

  if (error) throw error;
  return data as boolean;
}

/**
 * Incrementa contador de emails usados
 */
export async function incrementEmailsUsed(userId: string): Promise<number> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('increment_emails_used', {
    p_user_id: userId,
  });

  if (error) throw error;
  return data as number;
}

/**
 * Busca ou cria uma conversation
 * A RPC retorna uma TABLE com uma row, então pegamos o ID da primeira row
 */
export async function getOrCreateConversation(
  shopId: string,
  customerEmail: string,
  subject: string,
  inReplyTo?: string
): Promise<string> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('get_or_create_conversation', {
    p_shop_id: shopId,
    p_customer_email: customerEmail,
    p_subject: subject,
    p_in_reply_to: inReplyTo || null,
  });

  if (error) throw error;

  // A RPC retorna um array de rows (TABLE result)
  if (!data || data.length === 0) {
    throw new Error('Failed to get or create conversation: no data returned');
  }

  return data[0].id as string;
}

/**
 * Salva uma nova mensagem
 */
export async function saveMessage(message: Partial<Message>): Promise<Message> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('messages')
    .insert(message)
    .select()
    .single();

  if (error) throw error;
  return data as Message;
}

/**
 * Atualiza uma mensagem
 */
export async function updateMessage(
  messageId: string,
  updates: Partial<Message>
): Promise<Message> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('messages')
    .update(updates)
    .eq('id', messageId)
    .select()
    .single();

  if (error) throw error;
  return data as Message;
}

/**
 * Busca mensagens pendentes de uma loja
 */
export async function getPendingMessages(shopId: string): Promise<Message[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('messages')
    .select(
      `
      *,
      conversation:conversations!inner(
        id,
        shop_id,
        customer_email,
        data_request_count,
        shopify_order_id,
        shopify_customer_id
      )
    `
    )
    .in('status', ['pending', 'pending_credits'])
    .eq('direction', 'inbound')
    .eq('conversation.shop_id', shopId)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) throw error;
  return (data || []) as Message[];
}

/**
 * Busca histórico de mensagens de uma conversation
 */
export async function getConversationHistory(
  conversationId: string,
  limit: number = 3
): Promise<Message[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).reverse() as Message[];
}

/**
 * Atualiza conversation
 */
export async function updateConversation(
  conversationId: string,
  updates: Partial<Conversation>
): Promise<Conversation> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('conversations')
    .update(updates)
    .eq('id', conversationId)
    .select()
    .single();

  if (error) throw error;
  return data as Conversation;
}

/**
 * Registra log de processamento
 */
export async function logProcessingEvent(log: Partial<EmailProcessingLog>): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.from('email_processing_logs').insert(log);

  if (error) {
    console.error('Erro ao registrar log:', error);
    // Não propaga o erro para não interromper o fluxo principal
  }
}

/**
 * Verifica rate limit para um cliente
 */
export async function checkRateLimit(
  shopId: string,
  customerEmail: string
): Promise<{ allowed: boolean; responsesLastHour: number }> {
  const supabase = getSupabaseClient();

  // Buscar ou criar registro de rate limit
  const { data: existing } = await supabase
    .from('rate_limits')
    .select('*')
    .eq('shop_id', shopId)
    .eq('customer_email', customerEmail)
    .single();

  if (!existing) {
    // Criar novo registro
    await supabase.from('rate_limits').insert({
      shop_id: shopId,
      customer_email: customerEmail,
      responses_last_hour: 0,
      hour_window_start: new Date().toISOString(),
    });
    return { allowed: true, responsesLastHour: 0 };
  }

  // Verificar se precisa resetar a janela
  const windowStart = new Date(existing.hour_window_start);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  if (windowStart < oneHourAgo) {
    // Resetar contador
    await supabase
      .from('rate_limits')
      .update({
        responses_last_hour: 0,
        hour_window_start: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return { allowed: true, responsesLastHour: 0 };
  }

  // Verificar limite (3 respostas por hora)
  const allowed = existing.responses_last_hour < 3;
  return { allowed, responsesLastHour: existing.responses_last_hour };
}

/**
 * Incrementa contador de rate limit
 */
export async function incrementRateLimit(shopId: string, customerEmail: string): Promise<void> {
  const supabase = getSupabaseClient();

  await supabase.rpc('', {});

  // Upsert com incremento
  const { data: existing } = await supabase
    .from('rate_limits')
    .select('id, responses_last_hour')
    .eq('shop_id', shopId)
    .eq('customer_email', customerEmail)
    .single();

  if (existing) {
    await supabase
      .from('rate_limits')
      .update({
        responses_last_hour: existing.responses_last_hour + 1,
        last_response_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  }
}

/**
 * Atualiza última sincronização de email de uma loja
 */
export async function updateShopEmailSync(
  shopId: string,
  error?: string
): Promise<void> {
  const supabase = getSupabaseClient();

  await supabase
    .from('shops')
    .update({
      last_email_sync_at: new Date().toISOString(),
      email_sync_error: error || null,
    })
    .eq('id', shopId);
}

/**
 * Atualiza aviso de créditos do usuário
 */
export async function updateCreditsWarning(userId: string): Promise<void> {
  const supabase = getSupabaseClient();

  await supabase
    .from('users')
    .update({
      last_credits_warning_at: new Date().toISOString(),
      credits_warning_count: supabase.rpc('', {}), // Será incrementado via SQL
    })
    .eq('id', userId);

  // Incrementar contador separadamente
  const { data: user } = await supabase
    .from('users')
    .select('credits_warning_count')
    .eq('id', userId)
    .single();

  if (user) {
    await supabase
      .from('users')
      .update({
        credits_warning_count: (user.credits_warning_count || 0) + 1,
      })
      .eq('id', userId);
  }
}
