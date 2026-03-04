/**
 * Edge Function: process-shop-emails (Worker)
 *
 * Processa emails de UMA loja específica.
 * Chamada pelo orquestrador (process-emails) para cada loja ativa.
 *
 * Input: { shop_id: string, max_emails?: number, max_messages?: number }
 * Output: ShopStats
 */

// deno-lint-ignore-file no-explicit-any
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

import {
  getSupabaseClient,
  getUserById,
  tryReserveCredit,
  releaseCredit,
  checkCreditsAvailable,  // Mantido para verificações não-atômicas
  incrementEmailsUsed,  // Mantido para compatibilidade
  getOrCreateConversation,
  saveMessage,
  updateMessage,
  getPendingMessages,
  getConversationHistory,
  updateConversation,
  logProcessingEvent,
  updateShopEmailSync,
  updateCreditsWarning,
  type Shop,
  type Message,
  type Conversation,
} from '../_shared/supabase.ts';

import {
  decryptEmailCredentials,
  fetchUnreadEmails,
  markEmailsAsSeen,
  sendEmail,
  buildReplyHeaders,
  buildReplySubject,
  cleanEmailBody,
  extractNameFromEmail,
  type IncomingEmail,
} from '../_shared/email.ts';

import {
  decryptShopifyCredentials,
  getOrderDataForAI,
  extractOrderNumber,
  type OrderSummary,
} from '../_shared/shopify.ts';

import {
  classifyEmail,
  generateResponse,
  generateDataRequestMessage,
  isSpamByPattern,
} from '../_shared/anthropic.ts';

// Constantes
const DEFAULT_MAX_EMAILS = 10;
const DEFAULT_MAX_MESSAGES = 15;
const MAX_DATA_REQUESTS = 3;
const MAX_CONCURRENT_MESSAGES = 3; // Mais paralelo já que é apenas 1 loja
const MAX_EXECUTION_TIME_MS = 110000; // 110 segundos (limite real é 120s)

/**
 * Extrai email do cliente do corpo de um formulário de contato do Shopify
 */
function extractEmailFromShopifyContactForm(bodyText: string): { email: string; name: string | null } | null {
  if (!bodyText) return null;

  const emailLinePattern = /(?:E-?mail|email):\s*\n?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
  const emailMatch = bodyText.match(emailLinePattern);

  if (!emailMatch) return null;

  const email = emailMatch[1].toLowerCase();

  const namePattern = /(?:Name|Nome):\s*\n?\s*([^\n]+)/i;
  const nameMatch = bodyText.match(namePattern);
  const name = nameMatch ? nameMatch[1].trim() : null;

  return { email, name };
}

// Tipos
interface ShopStats {
  shop_id: string;
  shop_name: string;
  emails_received: number;
  emails_replied: number;
  emails_pending_credits: number;
  emails_forwarded_human: number;
  emails_spam: number;
  errors: number;
  duration_ms: number;
}

interface WorkerInput {
  shop_id: string;
  max_emails?: number;
  max_messages?: number;
}

/**
 * Verifica se ainda há tempo disponível para processamento
 */
function hasTimeRemaining(startTime: number): boolean {
  return Date.now() - startTime < MAX_EXECUTION_TIME_MS;
}

/**
 * Handler principal da Edge Function (Worker)
 */
Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const input: WorkerInput = await req.json();
    const { shop_id, max_emails = DEFAULT_MAX_EMAILS, max_messages = DEFAULT_MAX_MESSAGES } = input;

    if (!shop_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'shop_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Worker] Iniciando processamento da loja ${shop_id}`);

    // Buscar loja pelo ID
    const supabase = getSupabaseClient();
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shop_id)
      .eq('is_active', true)
      .single();

    if (shopError || !shop) {
      console.error(`[Worker] Loja ${shop_id} não encontrada ou inativa:`, shopError);
      return new Response(
        JSON.stringify({ success: false, error: 'Loja não encontrada ou inativa' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Processar a loja
    const stats = await processShop(shop as Shop, startTime, max_emails, max_messages);

    const duration = Date.now() - startTime;
    console.log(`[Worker] Loja ${shop.name} concluída em ${duration}ms:`, stats);

    return new Response(
      JSON.stringify({
        success: true,
        stats: { ...stats, duration_ms: duration },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Worker] Erro fatal:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Processa uma loja específica
 */
async function processShop(
  shop: Shop,
  startTime: number,
  maxEmails: number,
  maxMessages: number
): Promise<Omit<ShopStats, 'duration_ms'>> {
  const stats: Omit<ShopStats, 'duration_ms'> = {
    shop_id: shop.id,
    shop_name: shop.name,
    emails_received: 0,
    emails_replied: 0,
    emails_pending_credits: 0,
    emails_forwarded_human: 0,
    emails_spam: 0,
    errors: 0,
  };

  console.log(`[Worker] Processando loja: ${shop.name} (${shop.id})`);

  // 1. Decriptar credenciais de email
  const emailCredentials = await decryptEmailCredentials(shop);
  if (!emailCredentials) {
    console.log(`[Worker] Loja ${shop.id} sem credenciais de email válidas`);
    return stats;
  }

  // 2. Buscar emails não lidos via IMAP
  let emailStartDate: Date | null = null;
  if (shop.email_start_mode === 'from_integration_date' && shop.email_start_date) {
    emailStartDate = new Date(shop.email_start_date);
    console.log(`[Worker] Loja ${shop.id}: Modo from_integration_date, ignorando emails anteriores a ${emailStartDate.toISOString()}`);
  }

  let incomingEmails: IncomingEmail[] = [];
  try {
    incomingEmails = await fetchUnreadEmails(emailCredentials, maxEmails, emailStartDate);
    console.log(`[Worker] Loja ${shop.id}: ${incomingEmails.length} emails não lidos`);
    stats.emails_received = incomingEmails.length;
  } catch (error) {
    console.error(`[Worker] Erro ao buscar emails da loja ${shop.id}:`, error);
    await updateShopEmailSync(shop.id, error instanceof Error ? error.message : 'Erro ao conectar IMAP');
    throw error;
  }

  // 3. Salvar emails no banco e marcar como lidos no IMAP após salvar
  const shopEmail = emailCredentials.smtp_user.toLowerCase();
  const savedUids: number[] = [];
  for (const email of incomingEmails) {
    if (email.from_email.toLowerCase() === shopEmail) {
      console.log(`[Worker] Ignorando email de ${email.from_email} (própria loja)`);
      if (email.imap_uid) savedUids.push(email.imap_uid); // Marcar próprios emails como lidos também
      continue;
    }
    try {
      await saveIncomingEmail(shop.id, email);
      if (email.imap_uid) savedUids.push(email.imap_uid);
    } catch (error) {
      console.error(`[Worker] Erro ao salvar email ${email.message_id}:`, error);
      stats.errors++;
    }
  }

  // Marcar como lidos apenas emails salvos com sucesso
  if (savedUids.length > 0) {
    try {
      await markEmailsAsSeen(emailCredentials, savedUids);
    } catch (error) {
      console.error(`[Worker] Erro ao marcar emails como lidos:`, error);
    }
  }

  // 4. Processar emails pendentes
  const allPendingMessages = await getPendingMessages(shop.id);
  const pendingMessages = allPendingMessages.slice(0, maxMessages);
  console.log(`[Worker] Loja ${shop.id}: ${allPendingMessages.length} pendentes, processando ${pendingMessages.length}`);

  // Processar mensagens em paralelo
  for (let i = 0; i < pendingMessages.length; i += MAX_CONCURRENT_MESSAGES) {
    if (!hasTimeRemaining(startTime)) {
      console.log(`[Worker] Loja ${shop.id}: Timeout, ${pendingMessages.length - i} msgs restantes`);
      break;
    }

    const batch = pendingMessages.slice(i, i + MAX_CONCURRENT_MESSAGES);
    console.log(`[Worker] Loja ${shop.id}: Batch de ${batch.length} mensagens`);

    const batchResults = await Promise.allSettled(
      batch.map(async (message) => {
        try {
          return await processMessage(shop, message, emailCredentials);
        } catch (error) {
          console.error(`[Worker] Erro ao processar mensagem ${message.id}:`, error);
          await updateMessage(message.id, {
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Erro desconhecido',
          });
          throw error;
        }
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        const outcome = result.value;
        if (outcome === 'replied') stats.emails_replied++;
        else if (outcome === 'pending_credits') stats.emails_pending_credits++;
        else if (outcome === 'forwarded_human') stats.emails_forwarded_human++;
        else if (outcome === 'spam') stats.emails_spam++;
      } else {
        stats.errors++;
      }
    }
  }

  // 5. Atualizar timestamp de sync
  await updateShopEmailSync(shop.id);

  return stats;
}

/**
 * Salva um email recebido no banco
 */
async function saveIncomingEmail(shopId: string, email: IncomingEmail): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from('messages')
    .select('id')
    .eq('message_id', email.message_id)
    .single();

  if (existing) {
    console.log(`[Worker] Email ${email.message_id} já existe, ignorando`);
    return;
  }

  let finalFromEmail = email.from_email;
  let finalFromName = email.from_name;

  if (!finalFromEmail || !finalFromEmail.includes('@')) {
    const bodyContent = email.body_text || email.body_html || '';
    const extracted = extractEmailFromShopifyContactForm(bodyContent);

    if (extracted) {
      console.log(`[Worker] Email extraído do formulário Shopify: ${extracted.email}`);
      finalFromEmail = extracted.email;
      finalFromName = extracted.name || finalFromName;
    } else {
      console.log(`[Worker] Email ${email.message_id}: from_email vazio e não extraído do corpo`);

      const conversationId = await getOrCreateConversation(
        shopId,
        'unknown@invalid.local',
        email.subject || '',
        email.in_reply_to || undefined
      );

      await saveMessage({
        conversation_id: conversationId,
        from_email: '',
        from_name: email.from_name,
        to_email: email.to_email,
        subject: email.subject,
        body_text: email.body_text,
        body_html: email.body_html,
        message_id: email.message_id,
        in_reply_to: email.in_reply_to,
        references_header: email.references,
        has_attachments: email.has_attachments,
        attachment_count: email.attachment_count,
        direction: 'inbound',
        status: 'failed',
        error_message: 'Email do remetente inválido ou ausente (não extraído do corpo)',
        received_at: email.received_at.toISOString(),
      });

      return;
    }
  }

  const conversationId = await getOrCreateConversation(
    shopId,
    finalFromEmail,
    email.subject || '',
    email.in_reply_to || undefined
  );

  // Usar nome do email se disponível, senão tentar extrair do endereço de email
  const customerName = finalFromName || extractNameFromEmail(finalFromEmail);
  if (customerName) {
    // Buscar conversa para verificar se já tem nome
    const supabase = getSupabaseClient();
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('customer_name')
      .eq('id', conversationId)
      .single();

    // Atualizar se não tiver nome ou se o nome atual for vazio
    if (!existingConv?.customer_name) {
      await updateConversation(conversationId, { customer_name: customerName });
    }
  }

  await saveMessage({
    conversation_id: conversationId,
    from_email: finalFromEmail,
    from_name: finalFromName,
    to_email: email.to_email,
    subject: email.subject,
    body_text: email.body_text,
    body_html: email.body_html,
    message_id: email.message_id,
    in_reply_to: email.in_reply_to,
    references_header: email.references,
    has_attachments: email.has_attachments,
    attachment_count: email.attachment_count,
    direction: 'inbound',
    status: 'pending',
    received_at: email.received_at.toISOString(),
  });

  await logProcessingEvent({
    shop_id: shopId,
    conversation_id: conversationId,
    event_type: 'email_received',
    event_data: {
      from: finalFromEmail,
      subject: email.subject,
      has_attachments: email.has_attachments,
      extracted_from_body: email.from_email !== finalFromEmail,
    },
  });
}

/**
 * Processa uma mensagem pendente
 */
async function processMessage(
  shop: Shop,
  message: Message & { conversation?: Conversation },
  emailCredentials: Awaited<ReturnType<typeof decryptEmailCredentials>>
): Promise<'replied' | 'pending_credits' | 'forwarded_human' | 'spam' | 'skipped'> {
  if (!emailCredentials) return 'skipped';

  const conversation = message.conversation as Conversation | undefined;
  if (!conversation) return 'skipped';

  // Check if conversation is frozen (ticket closed, 7-day freeze - ignore completely)
  if (conversation.frozen_until) {
    const frozenUntil = new Date(conversation.frozen_until);
    if (frozenUntil > new Date()) {
      console.log(`[Worker] Conversa ${conversation.id} está frozen até ${conversation.frozen_until}, ignorando msg ${message.id}`);
      return 'skipped';
    }
  }

  if (!message.from_email || !message.from_email.includes('@')) {
    console.log(`[Worker] Pulando mensagem ${message.id}: from_email inválido`);
    await updateMessage(message.id, {
      status: 'failed',
      error_message: 'Email do remetente inválido ou ausente',
    });
    return 'skipped';
  }

  const systemEmailPatterns = [
    'mailer-daemon@',
    'postmaster@',
    'mail-delivery-subsystem@',
    'noreply@',
    'no-reply@',
    'donotreply@',
    'auto-reply',
    'autoreply',
    'automated',
    'notification',
    'bounce',
    'failure',
    'undeliverable',
    // Shopify system emails - NUNCA responder
    '@shopify.com',
    'mailer@shopify',
    'support@shopify',
    'notifications@shopify',
    // Outros sistemas
    '@paypal.com',
    '@stripe.com',
    '@asaas.com.br',
  ];
  const fromLower = message.from_email.toLowerCase();
  if (systemEmailPatterns.some(pattern => fromLower.includes(pattern))) {
    console.log(`[Worker] Pulando mensagem ${message.id}: email de sistema`);
    await updateMessage(message.id, {
      status: 'failed',
      error_message: 'Email de sistema ignorado',
    });
    return 'skipped';
  }

  // Skip Replyna forwarding notifications (emails that were forwarded to human support)
  const messageBody = message.body_text || '';
  const messageSubject = message.subject || '';
  const isForwardingNotification =
    messageBody.includes('Este email foi encaminhado automaticamente pelo Replyna') ||
    messageBody.includes('This email was automatically forwarded by Replyna') ||
    messageSubject.startsWith('[ENCAMINHADO]') ||
    messageSubject.startsWith('[FORWARDED]');

  if (isForwardingNotification) {
    console.log(`[Worker] Message ${message.id} is a Replyna forwarding notification, skipping`);
    await updateMessage(message.id, {
      status: 'replied',
      error_message: 'Skipped - Replyna forwarding notification',
      processed_at: new Date().toISOString(),
    });
    return 'skipped';
  }

  await updateMessage(message.id, { status: 'processing' });

  const startTime = Date.now();

  // 0.5 PRÉ-CLASSIFICAÇÃO: Detectar spam por padrões ANTES de gastar créditos
  const preCleanBody = cleanEmailBody(message.body_text || '', message.body_html || '');
  if (isSpamByPattern(message.subject || '', preCleanBody || message.body_text || '')) {
    console.log(`[Worker] Msg ${message.id} detectada como spam por padrão (pré-AI)`);
    await updateMessage(message.id, {
      status: 'failed',
      category: 'spam',
      category_confidence: 0.98,
      error_message: 'Spam detectado por padrão (cold outreach/template)',
      processed_at: new Date().toISOString(),
    });

    await updateConversation(conversation.id, {
      category: 'spam',
      status: 'closed',
    });

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'spam_pattern_detected',
      event_data: {
        subject: message.subject,
        body_preview: (preCleanBody || message.body_text || '').substring(0, 150),
        reason: 'Pre-AI pattern-based spam detection',
      },
    });

    return 'spam';
  }

  // 1. Verificar créditos
  const user = await getUserById(shop.user_id);
  if (!user) {
    await updateMessage(message.id, { status: 'failed', error_message: 'Usuário não encontrado' });
    return 'skipped';
  }

  // Verificar se o usuário tem assinatura ativa
  if (user.status !== 'active') {
    console.log(`[Worker] Usuário ${user.id} com status '${user.status}' - pagamento pendente/inativo, pulando msg ${message.id}`);
    await updateMessage(message.id, {
      status: 'pending_credits',
      error_message: user.status === 'suspended'
        ? 'Pagamento pendente - aguardando regularização'
        : `Assinatura inativa (status: ${user.status})`,
    });
    return 'skipped';
  }

  // 2. Verificar corpo do email (ANTES de gastar créditos - reutiliza preCleanBody)
  let cleanBody = preCleanBody;

  // Fallback: extrair texto do HTML se body_text resultou vazio
  if ((!cleanBody || cleanBody.trim().length < 3) && message.body_html && message.body_html.trim().length > 10) {
    console.log(`[Worker] body_text vazio mas body_html tem ${message.body_html.length} chars, extraindo texto`);
    const htmlText = message.body_html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (htmlText && htmlText.length >= 3) {
      cleanBody = htmlText;
    }
  }

  // Fallback: usar subject como contexto
  if ((!cleanBody || cleanBody.trim().length < 3) && message.subject && message.subject.trim().length > 3) {
    console.log(`[Worker] Corpo vazio, usando assunto: "${message.subject}"`);
    cleanBody = `[Cliente respondeu ao email com assunto: ${message.subject}]`;
  }

  if (!cleanBody || cleanBody.trim().length < 3) {
    console.log(`[Worker] Pulando mensagem ${message.id}: corpo e assunto vazios`);
    await updateMessage(message.id, {
      status: 'failed',
      error_message: 'Corpo e assunto do email vazios',
    });
    return 'skipped';
  }

  // 2.1 Reservar crédito (apenas após verificações gratuitas confirmarem que precisa processar)
  const creditReserved = await tryReserveCredit(user.id);
  if (!creditReserved) {
    await updateMessage(message.id, { status: 'pending_credits' });
    await handleCreditsExhausted(shop, user, message);
    return 'pending_credits';
  }

  // 3. Buscar histórico da conversa
  const history = await getConversationHistory(conversation.id, 10);
  const conversationHistory = history.map((m) => ({
    role: m.direction === 'inbound' ? ('customer' as const) : ('assistant' as const),
    content: cleanEmailBody(m.body_text || '', m.body_html || ''),
  }));

  // 4. Classificar email
  const classification = await classifyEmail(
    message.subject || '',
    cleanBody,
    conversationHistory.slice(0, -1),
    message.body_text || '', // rawEmailBody para fallback de idioma
    conversation.language || null, // Idioma da conversa para continuidade
    shop.imap_user || shop.support_email || null, // Email da loja para detecção de idioma por domínio (.de→alemão, .fr→francês)
  );

  await updateMessage(message.id, {
    category: classification.category,
    category_confidence: classification.confidence,
  });

  await updateConversation(conversation.id, {
    category: classification.category,
    language: classification.language,
  });

  await logProcessingEvent({
    shop_id: shop.id,
    message_id: message.id,
    conversation_id: conversation.id,
    event_type: 'email_classified',
    event_data: classification,
  });

  // 4.1 Se for spam, marcar e não responder
  if (classification.category === 'spam') {
    console.log(`[Worker] Email ${message.id} classificado como SPAM`);

    await updateMessage(message.id, {
      status: 'failed',
      category: 'spam',
      category_confidence: classification.confidence,
      error_message: 'Email classificado como spam',
    });

    await updateConversation(conversation.id, {
      category: 'spam',
      status: 'closed',
    });

    return 'spam';
  }

  // 5. Buscar dados do Shopify
  let shopifyData: OrderSummary | null = null;
  const shopifyCredentials = await decryptShopifyCredentials(shop);

  if (shopifyCredentials) {
    const orderNumber =
      extractOrderNumber(message.subject || '') ||
      extractOrderNumber(cleanBody) ||
      conversation.shopify_order_id;

    shopifyData = await getOrderDataForAI(
      shopifyCredentials,
      message.from_email,
      orderNumber
    );

    if (shopifyData) {
      await updateConversation(conversation.id, {
        shopify_order_id: shopifyData.order_number,
        customer_name: shopifyData.customer_name,
      });
    }
  }

  // 6. Gerar resposta
  let responseResult: { response: string; tokens_input: number; tokens_output: number };
  let finalStatus: 'replied' | 'pending_human' = 'replied';

  // Categorias que precisam de dados do pedido: rastreio e troca_devolucao_reembolso
  // Categorias que NÃO precisam: duvidas_gerais (perguntas gerais sem pedido)
  const categoriesWithoutOrderData = ['duvidas_gerais'];
  const needsOrderData = !categoriesWithoutOrderData.includes(classification.category);

  if (classification.category === 'suporte_humano' || classification.category === 'edicao_pedido') {
    // Apenas marca como pending_human, sem enviar resposta nem encaminhar
    await releaseCredit(user.id);
    await updateMessage(message.id, {
      status: 'pending_human',
      category: classification.category,
      category_confidence: classification.confidence,
      processed_at: new Date().toISOString(),
    });
    await updateConversation(conversation.id, {
      status: 'pending_human',
      category: classification.category,
      language: classification.language,
      last_message_at: new Date().toISOString(),
    });
    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'forwarded_to_human',
      event_data: { reason: classification.category === 'edicao_pedido' ? 'edicao_pedido_category' : 'suporte_humano_category' },
    });
    console.log(`[process-shop-emails] Message ${message.id} marked as pending_human (${classification.category})`);
    return 'forwarded_human';
  } else if (!shopifyData && needsOrderData && conversation.data_request_count < MAX_DATA_REQUESTS) {
    responseResult = await generateDataRequestMessage(
      {
        name: shop.name,
        attendant_name: shop.attendant_name,
        tone_of_voice: shop.tone_of_voice,
      },
      message.subject || '',
      cleanBody,
      conversation.data_request_count + 1,
      classification.language
    );

    await updateConversation(conversation.id, {
      data_request_count: conversation.data_request_count + 1,
    });
  } else if (!shopifyData && needsOrderData && conversation.data_request_count >= MAX_DATA_REQUESTS) {
    // MAX_DATA_REQUESTS excedido - marcar como pending_human
    await releaseCredit(user.id);
    await updateMessage(message.id, {
      status: 'pending_human',
      category: classification.category,
      category_confidence: classification.confidence,
      processed_at: new Date().toISOString(),
    });
    await updateConversation(conversation.id, {
      status: 'pending_human',
      category: classification.category,
      language: classification.language,
      last_message_at: new Date().toISOString(),
    });
    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'forwarded_to_human',
      event_data: { reason: 'max_data_requests_exceeded' },
    });
    console.log(`[process-shop-emails] Message ${message.id} marked as pending_human (max data requests exceeded)`);
    return 'forwarded_human';
  } else {
    responseResult = await generateResponse(
      {
        name: shop.name,
        attendant_name: shop.attendant_name,
        tone_of_voice: shop.tone_of_voice,
        store_description: shop.store_description,
        delivery_time: shop.delivery_time,
        dispatch_time: shop.dispatch_time,
        warranty_info: shop.warranty_info,
        signature_html: shop.signature_html,
        is_cod: shop.is_cod,
        store_email: shop.imap_user || shop.support_email,
        // Formulário de devolução — apenas para lojas do Carlos Azevedo (teste)
        return_form_url: shop.user_id === '115571d2-78af-4213-a01b-8a5e3ccf1714'
          ? `https://app.replyna.me/return-request?shop=${shop.id}`
          : null,
      },
      message.subject || '',
      cleanBody,
      classification.category,
      conversationHistory,
      shopifyData,
      classification.language,
      0, // retentionContactCount
      [], // additionalOrders
      [], // emailImages
      classification.sentiment || 'calm',
      conversation.status, // para loop detection pular exchange_count se pending_human
    );

    // Se a IA detectou que é terceiro contato de cancelamento, marcar para humano
    if (responseResult.forward_to_human) {
      finalStatus = 'pending_human';
    }
  }

  await logProcessingEvent({
    shop_id: shop.id,
    message_id: message.id,
    event_type: 'response_generated',
    tokens_input: responseResult.tokens_input,
    tokens_output: responseResult.tokens_output,
    processing_time_ms: Date.now() - startTime,
  });

  // 7. Enviar resposta
  const replyHeaders = buildReplyHeaders(message.message_id || '', message.references_header);

  const sendResult = await sendEmail(emailCredentials, {
    to: message.from_email,
    subject: buildReplySubject(message.subject),
    body_text: responseResult.response,
    from_name: shop.attendant_name,
    in_reply_to: replyHeaders.in_reply_to,
    references: replyHeaders.references,
  });

  if (!sendResult.success) {
    await updateMessage(message.id, {
      status: 'failed',
      error_message: sendResult.error || 'Erro ao enviar email',
    });
    throw new Error(sendResult.error || 'Erro ao enviar email');
  }

  // 8. Salvar resposta enviada
  await saveMessage({
    conversation_id: conversation.id,
    from_email: emailCredentials.smtp_user,
    from_name: shop.attendant_name,
    to_email: message.from_email,
    subject: buildReplySubject(message.subject),
    body_text: responseResult.response,
    message_id: sendResult.message_id,
    in_reply_to: replyHeaders.in_reply_to,
    references_header: replyHeaders.references,
    direction: 'outbound',
    status: 'replied',
    was_auto_replied: true,
    tokens_input: responseResult.tokens_input,
    tokens_output: responseResult.tokens_output,
    replied_at: new Date().toISOString(),
  });

  // 9. Atualizar mensagem original
  await updateMessage(message.id, {
    status: finalStatus === 'pending_human' ? 'pending_human' : 'replied',
    was_auto_replied: true,
    auto_reply_message_id: sendResult.message_id,
    tokens_input: responseResult.tokens_input,
    tokens_output: responseResult.tokens_output,
    processed_at: new Date().toISOString(),
    replied_at: new Date().toISOString(),
  });

  // 10. Crédito já foi reservado atomicamente no início (tryReserveCredit)
  // Não precisa mais chamar incrementEmailsUsed aqui

  // 10.1 Cobrança automática de extras DESATIVADA
  // Quando o usuário atingir o limite, o sistema para de processar (pending_credits).
  // Não cobra extras automaticamente.
  // await checkAndChargeExtraEmails(user.id, shop.id);

  // 11. Atualizar status da conversation
  await updateConversation(conversation.id, {
    status: finalStatus === 'pending_human' ? 'pending_human' : 'replied',
  });

  await logProcessingEvent({
    shop_id: shop.id,
    message_id: message.id,
    event_type: 'response_sent',
    event_data: {
      message_id_sent: sendResult.message_id,
      status: finalStatus,
    },
    processing_time_ms: Date.now() - startTime,
  });

  return finalStatus === 'pending_human' ? 'forwarded_human' : 'replied';
}


/**
 * Lida com créditos esgotados
 */
async function handleCreditsExhausted(
  shop: Shop,
  user: Awaited<ReturnType<typeof getUserById>>,
  message: Message
): Promise<void> {
  if (!user) return;

  const lastWarning = user.last_credits_warning_at ? new Date(user.last_credits_warning_at) : null;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  if (lastWarning && lastWarning > oneHourAgo) return;

  const emailCredentials = await decryptEmailCredentials(shop);
  if (!emailCredentials) return;

  const notificationSubject = '⚠️ Replyna: Email não respondido - Créditos esgotados';
  const notificationBody = `
Olá ${user.name || 'Admin'},

Sua loja ${shop.name} recebeu um novo email de cliente, mas não foi possível responder porque seus créditos acabaram.

═══════════════════════════════════════
📧 EMAIL NÃO RESPONDIDO
═══════════════════════════════════════
De: ${message.from_email}
Assunto: ${message.subject || 'Sem assunto'}
Recebido em: ${message.received_at || message.created_at}

═══════════════════════════════════════
📊 SEU USO ATUAL
═══════════════════════════════════════
Emails usados: ${user.emails_used} / ${user.emails_limit}
Plano: ${user.plan}

═══════════════════════════════════════
🔄 PARA VOLTAR A RESPONDER
═══════════════════════════════════════
• Faça upgrade do seu plano
• Compre créditos avulsos

Acesse: https://app.replyna.me/account

—
Replyna - Atendimento Inteligente
`;

  await sendEmail(emailCredentials, {
    to: user.email,
    subject: notificationSubject,
    body_text: notificationBody,
    from_name: 'Replyna',
  });

  await updateCreditsWarning(user.id);

  await logProcessingEvent({
    shop_id: shop.id,
    message_id: message.id,
    event_type: 'credits_exhausted',
    event_data: {
      user_email: user.email,
      emails_used: user.emails_used,
      emails_limit: user.emails_limit,
    },
  });
}

/**
 * Verifica se o usuário excedeu o limite e precisa cobrar pacote de emails extras
 */
async function checkAndChargeExtraEmails(userId: string, shopId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: user } = await supabase
    .from('users')
    .select('id, emails_used, emails_limit, extra_emails_purchased, extra_emails_used, pending_extra_emails')
    .eq('id', userId)
    .single();

  if (!user) return;

  if (user.emails_used <= user.emails_limit) return;

  const { data: billingCheck } = await supabase.rpc('increment_pending_extra_email', {
    p_user_id: userId,
  });

  if (!billingCheck || billingCheck.length === 0) return;

  const result = billingCheck[0];

  if (result.needs_billing) {
    console.log(`[Worker] Usuário ${userId} atingiu ${result.new_pending_count} emails extras - cobrando pacote`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    try {
      const chargeResponse = await fetch(
        `${supabaseUrl}/functions/v1/charge-extra-emails`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ user_id: userId }),
        }
      );

      const chargeResult = await chargeResponse.json();

      if (chargeResult.success) {
        console.log(`[Worker] Pacote de emails extras cobrado: ${chargeResult.invoice_id}`);

        await logProcessingEvent({
          shop_id: shopId,
          event_type: 'extra_emails_charged',
          event_data: {
            user_id: userId,
            package_size: result.package_size,
            amount: result.total_amount,
            invoice_id: chargeResult.invoice_id,
          },
        });
      } else {
        console.error('[Worker] Erro ao cobrar emails extras:', chargeResult.error);

        await logProcessingEvent({
          shop_id: shopId,
          event_type: 'extra_emails_charge_failed',
          error_message: chargeResult.error,
          event_data: {
            user_id: userId,
            package_size: result.package_size,
            amount: result.total_amount,
          },
        });
      }
    } catch (error) {
      console.error('[Worker] Erro ao chamar charge-extra-emails:', error);

      await logProcessingEvent({
        shop_id: shopId,
        event_type: 'extra_emails_charge_error',
        error_message: error instanceof Error ? error.message : 'Erro desconhecido',
        event_data: { user_id: userId },
      });
    }
  }
}
