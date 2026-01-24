/**
 * Email Processing Logic
 *
 * Extração e adaptação da lógica de processamento de process-emails/index.ts
 * para trabalhar com a arquitetura de filas.
 *
 * CORRIGIDO: Todas as chamadas de função agora usam as assinaturas corretas
 * dos módulos _shared.
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
  decryptEmailCredentials,
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
  const { message_id, shop_id } = job;

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
  _supabase: any
): Promise<void> {
  console.log(`[Processor] Processing message ${message.id} from ${message.from_email}`);

  // Check if message was already processed (prevent duplicate processing)
  if (message.status === 'replied' || message.status === 'processing') {
    console.log(`[Processor] Message ${message.id} already processed (status: ${message.status}), skipping`);
    return;
  }

  // Check if there's a recent reply to this conversation (prevent duplicate responses)
  const recentReplyCheck = await getConversationHistory(conversation.id, 5);
  const recentOutbound = (recentReplyCheck || []).filter((msg: Message) =>
    msg.direction === 'outbound' &&
    msg.was_auto_replied === true &&
    msg.created_at > new Date(Date.now() - 30 * 60 * 1000).toISOString() // Last 30 minutes
  );

  if (recentOutbound.length > 0) {
    console.log(`[Processor] Conversation ${conversation.id} already has recent auto-reply (${recentOutbound.length} in last 30min), skipping to avoid duplicate`);
    await updateMessage(message.id, {
      status: 'replied',
      error_message: 'Skipped - recent auto-reply exists',
      processed_at: new Date().toISOString(),
    });
    return;
  }

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

  // 7. Buscar histórico da conversa ANTES de classificar
  const rawHistory = await getConversationHistory(conversation.id, 3);
  const conversationHistory = (rawHistory || []).map((msg: Message) => ({
    role: msg.direction === 'inbound' ? ('customer' as const) : ('assistant' as const),
    content: cleanEmailBody(msg.body_text || '', msg.body_html || ''),
  }));

  // 8. Classificar email (ordem correta: subject, body, history)
  const classification = await classifyEmail(
    message.subject || '',
    cleanBody,
    conversationHistory.slice(0, -1) // Excluir a mensagem atual
  );

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
      language: classification.language,
    },
  });

  // Update conversation category
  if (!conversation.category && classification.category !== 'spam') {
    await updateConversation(conversation.id, {
      category: classification.category,
      language: classification.language,
    });
  }

  // 9. Se for spam, não responder
  if (classification.category === 'spam') {
    await updateMessage(message.id, {
      status: 'failed',
      error_message: 'Email classificado como spam',
      processed_at: new Date().toISOString(),
    });
    return; // Success without replying
  }

  // 10. Buscar dados do Shopify se necessário
  let shopifyData: OrderSummary | null = null;
  let needsOrderData = false;

  const categoriasQueNeedShopify = [
    'rastreio',
    'edicao_pedido',
    'troca_devolucao_reembolso',
  ];

  if (categoriasQueNeedShopify.includes(classification.category)) {
    needsOrderData = true;

    // extractOrderNumber aceita apenas 1 parâmetro
    const orderNumberFromSubject = extractOrderNumber(message.subject || '');
    const orderNumberFromBody = extractOrderNumber(cleanBody);
    const orderNumber = orderNumberFromSubject || orderNumberFromBody || conversation.shopify_order_id;

    const shopifyCredentials = await decryptShopifyCredentials(shop);

    if (shopifyCredentials) {
      try {
        // getOrderDataForAI: (credentials, customerEmail, orderNumber?)
        shopifyData = await getOrderDataForAI(
          shopifyCredentials,
          message.from_email,
          orderNumber
        );

        await logProcessingEvent({
          shop_id: shop.id,
          message_id: message.id,
          conversation_id: conversation.id,
          event_type: 'shopify_lookup',
          event_data: { order_number: orderNumber, found: !!shopifyData },
        });

        if (shopifyData) {
          await updateConversation(conversation.id, {
            shopify_order_id: shopifyData.order_number,
            customer_name: shopifyData.customer_name,
          });
        }
      } catch (error: any) {
        console.error(`[Processor] Shopify lookup failed:`, error.message);
        // Continue without Shopify data
      }
    }
  }

  // 11. Fluxo de solicitação de dados (se não tiver número do pedido)
  if (needsOrderData && !shopifyData && conversation.data_request_count < MAX_DATA_REQUESTS) {
    // generateDataRequestMessage: (shopContext, emailSubject, emailBody, attemptNumber, language)
    const dataRequestResult = await generateDataRequestMessage(
      {
        name: shop.name,
        attendant_name: shop.attendant_name,
        tone_of_voice: shop.tone_of_voice || 'friendly',
      },
      message.subject || '',
      cleanBody,
      (conversation.data_request_count || 0) + 1,
      classification.language || 'en'
    );

    await sendReply(message, conversation, shop, dataRequestResult.response, 'data_requested');

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

  // 12. Escalate para humano se MAX_DATA_REQUESTS excedido ou categoria suporte_humano
  if (
    classification.category === 'suporte_humano' ||
    (needsOrderData && !shopifyData && conversation.data_request_count >= MAX_DATA_REQUESTS)
  ) {
    // generateHumanFallbackMessage: (shopContext, customerName, language)
    const humanFallbackResult = await generateHumanFallbackMessage(
      {
        name: shop.name,
        attendant_name: shop.attendant_name,
        support_email: shop.support_email,
        tone_of_voice: shop.tone_of_voice || 'friendly',
        fallback_message_template: shop.fallback_message_template,
      },
      shopifyData?.customer_name || conversation.customer_name || null,
      classification.language || 'en'
    );

    await sendReply(message, conversation, shop, humanFallbackResult.response, 'forwarded_to_human');

    await updateMessage(message.id, {
      status: 'pending_human',
      processed_at: new Date().toISOString(),
    });

    await updateConversation(conversation.id, {
      status: 'pending_human',
    });

    // Forward to human support
    await forwardToHuman(shop, message);

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'forwarded_to_human',
      event_data: {
        reason: classification.category === 'suporte_humano'
          ? 'suporte_humano_category'
          : 'max_data_requests_exceeded'
      },
    });

    return; // Success
  }

  // 13. Gerar resposta com IA
  const aiResponse = await generateResponse(
    {
      name: shop.name,
      attendant_name: shop.attendant_name,
      tone_of_voice: shop.tone_of_voice || 'friendly',
      store_description: shop.store_description,
      delivery_time: shop.delivery_time,
      dispatch_time: shop.dispatch_time,
      warranty_info: shop.warranty_info,
      signature_html: shop.signature_html,
      is_cod: shop.is_cod,
    },
    message.subject || '',
    cleanBody,
    classification.category,
    conversationHistory,
    shopifyData ? {
      order_number: shopifyData.order_number,
      order_date: shopifyData.order_date,
      order_status: shopifyData.order_status,
      order_total: shopifyData.order_total,
      tracking_number: shopifyData.tracking_number,
      tracking_url: shopifyData.tracking_url,
      fulfillment_status: shopifyData.fulfillment_status,
      items: shopifyData.items || [],
      customer_name: shopifyData.customer_name,
    } : null,
    classification.language || 'en'
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

  // Check if AI wants to forward to human
  let finalStatus: 'replied' | 'pending_human' = 'replied';
  if (aiResponse.forward_to_human) {
    finalStatus = 'pending_human';
    await forwardToHuman(shop, message);
  }

  // 14. Enviar resposta por email
  await sendReply(message, conversation, shop, aiResponse.response, 'response_sent');

  // 15. Atualizar status da mensagem
  await updateMessage(message.id, {
    status: finalStatus,
    tokens_input: aiResponse.tokens_input,
    tokens_output: aiResponse.tokens_output,
    processed_at: new Date().toISOString(),
    replied_at: new Date().toISOString(),
  });

  if (finalStatus === 'pending_human') {
    await updateConversation(conversation.id, { status: 'pending_human' });
  }

  // 16. Incrementar uso de créditos
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
  eventType: string
): Promise<void> {
  // Build reply headers
  const replyHeaders = buildReplyHeaders(message.message_id, message.references_header);
  const replySubject = buildReplySubject(message.subject || '');

  // Decrypt email credentials properly
  const emailCredentials = await decryptEmailCredentials(shop);

  if (!emailCredentials) {
    console.error(`[Processor] Failed to decrypt email credentials for shop ${shop.id}`);
    throw new Error('Failed to decrypt email credentials');
  }

  try {
    await sendEmail(emailCredentials, {
      to: message.from_email,
      subject: replySubject,
      body_text: replyText,
      in_reply_to: message.message_id || undefined,
      references: replyHeaders.references,
      from_name: shop.attendant_name || shop.name,
    });
  } catch (error: any) {
    console.error(`[Processor] SMTP send failed:`, error.message);
    throw new Error(`SMTP error: ${error.message}`);
  }

  // Save outbound message
  await saveMessage({
    conversation_id: conversation.id,
    from_email: emailCredentials.smtp_user || shop.imap_user || '',
    from_name: shop.attendant_name || shop.name,
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
 * Encaminha email para suporte humano
 */
async function forwardToHuman(shop: Shop, message: Message): Promise<void> {
  const emailCredentials = await decryptEmailCredentials(shop);
  if (!emailCredentials) return;

  const forwardSubject = `[ENCAMINHADO] ${message.subject || 'Sem assunto'} - De: ${message.from_email}`;

  const forwardBody = `
Este email foi encaminhado automaticamente pelo Replyna porque requer atendimento humano.

═══════════════════════════════════════
DADOS DO CLIENTE
═══════════════════════════════════════
Email: ${message.from_email}
Nome: ${message.from_name || 'Não informado'}

═══════════════════════════════════════
MENSAGEM ORIGINAL
═══════════════════════════════════════
Assunto: ${message.subject || 'Sem assunto'}
Data: ${message.received_at || message.created_at}

${message.body_text || message.body_html || '(Sem conteúdo)'}

═══════════════════════════════════════
Responda diretamente ao cliente em: ${message.from_email}
`;

  try {
    await sendEmail(emailCredentials, {
      to: shop.support_email,
      subject: forwardSubject,
      body_text: forwardBody,
      from_name: 'Replyna Bot',
    });

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      event_type: 'forwarded_to_human',
      event_data: {
        forwarded_to: shop.support_email,
        reason: 'email_forwarded',
      },
    });
  } catch (error: any) {
    console.error(`[Processor] Failed to forward to human:`, error.message);
    // Don't throw - this is not critical
  }
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
    /^(recebido|received|reçu|ricevuto)\s*[!.]*$/,
  ];

  for (const pattern of acknowledgmentPatterns) {
    if (pattern.test(cleanBody) || pattern.test(cleanSubject)) {
      return true;
    }
  }

  return false;
}
