/**
 * Email Processing Logic
 *
 * Extração e adaptação da lógica de processamento de process-emails/index.ts
 * para trabalhar com a arquitetura de filas.
 */

// deno-lint-ignore-file no-explicit-any

import {
  getUserById,
  checkCreditsAvailable,
  incrementEmailsUsed,
  updateMessage,
  getConversationHistory,
  updateConversation,
  logProcessingEvent,
  saveMessage,
  type Message,
  type Conversation,
  type Shop,
} from '../_shared/supabase.ts';

import {
  sendEmail,
  buildReplyHeaders,
  buildReplySubject,
  cleanEmailBody,
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
  generateHumanFallbackMessage,
} from '../_shared/anthropic.ts';

const MAX_DATA_REQUESTS = 3;

// System email patterns to ignore
const systemEmailPatterns = [
  'no-reply',
  'noreply',
  'mailer-daemon',
  'postmaster',
  'bounce',
  'do-not-reply',
];

/**
 * Processa um job de email da fila
 */
export async function processMessageFromQueue(job: any, supabase: any): Promise<void> {
  const { message_id, shop_id, payload } = job;

  // Load message from database
  const { data: message, error: messageError } = await supabase
    .from('messages')
    .select('*')
    .eq('id', message_id)
    .single();

  if (messageError || !message) {
    throw new Error(`Message not found: ${message_id}`);
  }

  // Load shop
  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .select('*')
    .eq('id', shop_id)
    .single();

  if (shopError || !shop) {
    throw new Error(`Shop not found: ${shop_id}`);
  }

  // Load conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', message.conversation_id)
    .single();

  if (convError || !conversation) {
    throw new Error(`Conversation not found: ${message.conversation_id}`);
  }

  // Try to acquire advisory lock for conversation (prevent duplicate processing)
  const { data: lockAcquired } = await supabase.rpc('try_lock_conversation', {
    p_conversation_id: conversation.id,
  });

  if (!lockAcquired) {
    console.log(`[Processor] Conversation ${conversation.id} is locked by another worker, skipping`);
    throw new Error('Conversation locked'); // Will retry later
  }

  // Process the message
  await processMessage(message, conversation, shop, supabase);
}

/**
 * Lógica principal de processamento de email
 * Adaptado de process-emails/index.ts
 */
async function processMessage(
  message: Message,
  conversation: Conversation,
  shop: Shop,
  supabase: any
): Promise<void> {
  console.log(`[Processor] Processing message ${message.id} from ${message.from_email}`);

  // Mark as processing
  await updateMessage(message.id, { status: 'processing' });

  // 1. Validar email
  if (!message.from_email || !message.from_email.includes('@')) {
    await updateMessage(message.id, {
      status: 'failed',
      category: 'spam',
      error_message: 'Email do remetente inválido',
    });
    throw new Error('Email do remetente inválido');
  }

  // 2. Ignorar emails de sistema
  const fromLower = message.from_email.toLowerCase();
  if (systemEmailPatterns.some((pattern) => fromLower.includes(pattern))) {
    await updateMessage(message.id, {
      status: 'failed',
      category: 'spam',
      error_message: 'Email de sistema ignorado',
    });
    throw new Error('Email de sistema ignorado');
  }

  // 3. Limpar corpo do email
  const cleanBody = cleanEmailBody(message.body_text || '', message.body_html || '');
  if (!cleanBody || cleanBody.trim().length < 3) {
    await updateMessage(message.id, {
      status: 'failed',
      category: 'spam',
      error_message: 'Corpo do email vazio',
    });
    throw new Error('Corpo do email vazio');
  }

  // 4. Verificar agradecimentos (não responder)
  if (isAcknowledgmentMessage(cleanBody, message.subject || '')) {
    await updateMessage(message.id, {
      status: 'replied',
      category: 'acknowledgment',
      error_message: 'Mensagem de agradecimento - não requer resposta',
      processed_at: new Date().toISOString(),
    });
    return; // Success without replying
  }

  // 5. Buscar usuário (dono da loja)
  const user = await getUserById(shop.user_id);
  if (!user) {
    await updateMessage(message.id, {
      status: 'failed',
      category: 'duvidas_gerais',
      error_message: 'Usuário não encontrado',
    });
    throw new Error('Usuário não encontrado');
  }

  // 6. Verificar créditos disponíveis
  const hasCredits = await checkCreditsAvailable(user.id);
  if (!hasCredits) {
    await updateMessage(message.id, {
      status: 'pending_credits',
      category: 'duvidas_gerais',
    });
    throw new Error('Créditos insuficientes');
  }

  // 7. Classificar email
  const classification = await classifyEmail(cleanBody, message.subject || '', shop);
  await updateMessage(message.id, {
    category: classification.category,
    category_confidence: classification.confidence,
  });

  await logProcessingEvent({
    shop_id: shop.id,
    message_id: message.id,
    conversation_id: conversation.id,
    event_type: 'email_classified',
    event_data: {
      category: classification.category,
      confidence: classification.confidence,
    },
  });

  // Update conversation category
  if (!conversation.category && classification.category !== 'spam') {
    await updateConversation(conversation.id, {
      category: classification.category,
    });
  }

  // 8. Se for spam, não responder
  if (classification.category === 'spam') {
    await updateMessage(message.id, {
      status: 'failed',
      error_message: 'Email classificado como spam',
      processed_at: new Date().toISOString(),
    });
    return; // Success without replying
  }

  // 9. Buscar dados do Shopify se necessário
  let shopifyData: OrderSummary | null = null;
  let needsOrderData = false;

  const categoriasQueNeedShopify = [
    'rastreio',
    'edicao_pedido',
    'troca_devolucao_reembolso',
  ];

  if (categoriasQueNeedShopify.includes(classification.category)) {
    needsOrderData = true;
    const orderNumber = extractOrderNumber(cleanBody, message.subject || '');

    if (orderNumber) {
      try {
        const shopifyCredentials = decryptShopifyCredentials(shop);
        shopifyData = await getOrderDataForAI(orderNumber, shopifyCredentials);

        await logProcessingEvent({
          shop_id: shop.id,
          message_id: message.id,
          conversation_id: conversation.id,
          event_type: 'shopify_lookup',
          event_data: { order_number: orderNumber, found: !!shopifyData },
        });
      } catch (error: any) {
        console.error(`[Processor] Shopify lookup failed:`, error.message);
        // Continue without Shopify data
      }
    }
  }

  // 10. Fluxo de solicitação de dados (se não tiver número do pedido)
  if (needsOrderData && !shopifyData && conversation.data_request_count < MAX_DATA_REQUESTS) {
    const dataRequestMsg = generateDataRequestMessage(classification.category, shop);
    await sendReply(message, conversation, shop, dataRequestMsg, 'data_requested', supabase);

    await updateConversation(conversation.id, {
      data_request_count: (conversation.data_request_count || 0) + 1,
    });

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'data_requested',
      event_data: { request_count: (conversation.data_request_count || 0) + 1 },
    });

    return; // Success
  }

  // 11. Escalate para humano se MAX_DATA_REQUESTS excedido
  if (needsOrderData && !shopifyData && conversation.data_request_count >= MAX_DATA_REQUESTS) {
    const humanFallbackMsg = generateHumanFallbackMessage(shop);
    await sendReply(message, conversation, shop, humanFallbackMsg, 'forwarded_to_human', supabase);

    await updateMessage(message.id, {
      status: 'pending_human',
      processed_at: new Date().toISOString(),
    });

    await updateConversation(conversation.id, {
      status: 'pending_human',
    });

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'forwarded_to_human',
      event_data: { reason: 'max_data_requests_exceeded' },
    });

    return; // Success
  }

  // 12. Gerar resposta com IA
  const conversationHistory = await getConversationHistory(conversation.id, 3);
  const aiResponse = await generateResponse(
    cleanBody,
    message.subject || '',
    classification.category,
    shop,
    shopifyData,
    conversationHistory
  );

  await logProcessingEvent({
    shop_id: shop.id,
    message_id: message.id,
    conversation_id: conversation.id,
    event_type: 'response_generated',
    event_data: {
      tokens_input: aiResponse.tokens_input,
      tokens_output: aiResponse.tokens_output,
    },
    tokens_input: aiResponse.tokens_input,
    tokens_output: aiResponse.tokens_output,
  });

  // 13. Enviar resposta por email
  await sendReply(message, conversation, shop, aiResponse.response, 'response_sent', supabase);

  // 14. Incrementar uso de créditos
  await incrementEmailsUsed(user.id);

  console.log(`[Processor] Message ${message.id} processed successfully`);
}

/**
 * Envia resposta por email e salva na base
 */
async function sendReply(
  message: Message,
  conversation: Conversation,
  shop: Shop,
  replyText: string,
  eventType: string,
  supabase: any
): Promise<void> {
  // Build reply headers
  const replyHeaders = buildReplyHeaders(message.message_id, message.references_header);
  const replySubject = buildReplySubject(message.subject || '');

  // Send via SMTP
  const emailCredentials = {
    host: shop.email_imap_host || '',
    port: parseInt(shop.email_smtp_port || '587', 10),
    user: shop.email_imap_user || '',
    password: shop.email_imap_password || '', // Already decrypted by caller
    secure: shop.email_smtp_port === '465',
  };

  try {
    await sendEmail(emailCredentials, {
      from: shop.email_imap_user || '',
      to: message.from_email,
      subject: replySubject,
      text: replyText,
      inReplyTo: message.message_id,
      references: replyHeaders.references,
    });
  } catch (error: any) {
    console.error(`[Processor] SMTP send failed:`, error.message);
    throw new Error(`SMTP error: ${error.message}`);
  }

  // Save outbound message
  await saveMessage({
    conversation_id: conversation.id,
    from_email: shop.email_imap_user || '',
    from_name: shop.name,
    to_email: message.from_email,
    subject: replySubject,
    body_text: replyText,
    direction: 'outbound',
    status: 'replied',
    was_auto_replied: true,
    in_reply_to: message.message_id,
    references_header: replyHeaders.references,
    processed_at: new Date().toISOString(),
    replied_at: new Date().toISOString(),
  });

  // Update original message status
  await updateMessage(message.id, {
    status: 'replied',
    processed_at: new Date().toISOString(),
    replied_at: new Date().toISOString(),
  });

  // Update conversation
  await updateConversation(conversation.id, {
    status: 'replied',
    last_message_at: new Date().toISOString(),
  });

  // Log event
  await logProcessingEvent({
    shop_id: shop.id,
    message_id: message.id,
    conversation_id: conversation.id,
    event_type: eventType as any,
    event_data: { reply_length: replyText.length },
  });
}

/**
 * Verifica se mensagem é apenas agradecimento
 */
function isAcknowledgmentMessage(body: string, subject: string): boolean {
  const cleanBody = (body || '').toLowerCase().trim();
  const cleanSubject = (subject || '').toLowerCase().trim();

  const acknowledgmentPatterns = [
    /^(ok|okay|obrigad[oa]|thanks?|thank you|gracias|grazie|merci|danke)\s*[!.]*$/,
    /^(entendido|perfeito|perfect|perfetto|excelente|excellent)\s*[!.]*$/,
    /^(recebido|received|re\u00e7u|ricevuto)\s*[!.]*$/,
  ];

  for (const pattern of acknowledgmentPatterns) {
    if (pattern.test(cleanBody) || pattern.test(cleanSubject)) {
      return true;
    }
  }

  return false;
}
