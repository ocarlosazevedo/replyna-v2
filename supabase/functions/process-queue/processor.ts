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
  notifyCreditsExhausted,
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
  getMultipleOrdersDataForAI,
  extractOrderNumber,
  extractAllOrderNumbers,
  isShopifyCircuitOpen,
  recordShopifyFailure,
  recordShopifySuccess,
  type OrderSummary,
} from '../_shared/shopify.ts';

import {
  classifyEmail,
  generateResponse,
  generateDataRequestMessage,
  generateHumanFallbackMessage,
} from '../_shared/anthropic.ts';

const MAX_DATA_REQUESTS = 3;

// System email patterns to ignore (expanded list)
const systemEmailPatterns = [
  'no-reply',
  'noreply',
  'mailer-daemon',
  'postmaster',
  'bounce',
  'do-not-reply',
  'donotreply',
  'daemon',
  'auto-reply',
  'autoreply',
  'automated',
  'notification',
  'notifications',
  'alert@',
  'alerts@',
  'system@',
  'admin@',
  'mail-daemon',
  'failure',
  'undeliverable',
  'returned',
  // Shopify system emails - NUNCA responder
  '@shopify.com',
  'mailer@shopify',
  'support@shopify',
  'notifications@shopify',
  'help@shopify',
  'noreply@shopify',
  // Outros sistemas de e-commerce
  '@paypal.com',
  '@stripe.com',
  '@mailchimp.com',
  '@klaviyo.com',
  '@sendgrid.com',
];

// Padrões específicos de email do Shopify que podem conter email do cliente no corpo
const shopifyContactFormPatterns = [
  'mailer@shopify',
  '@shopify.com',
];

/**
 * Extrai email do cliente do corpo de um formulário de contato do Shopify
 * Lida com diferentes formatos: texto puro e HTML com tags entre "Email:" e o endereço
 */
function extractEmailFromShopifyContactForm(bodyText: string, bodyHtml?: string): { email: string; name: string | null } | null {
  if (!bodyText && !bodyHtml) return null;

  // Padrões para extrair email - do mais específico ao mais genérico
  const emailPatterns = [
    // Padrão 1: "Email:" seguido diretamente pelo email (texto puro)
    /(?:E-?mail|email):\s*\n?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    // Padrão 2: "Email:" com tags HTML no meio (ex: <b>Email:</b><pre>email@test.com</pre>)
    /(?:E-?mail|email):<\/b>\s*(?:<[^>]*>)*\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    // Padrão 3: Qualquer formato com "Email:" e email na mesma região
    /(?:E-?mail|email):[^@]*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
  ];

  // Padrões para extrair nome
  const namePatterns = [
    /(?:Name|Nome):\s*\n?\s*([^\n<]+)/i,
    /(?:Name|Nome):<\/b>\s*(?:<[^>]*>)*\s*([^<\n]+)/i,
  ];

  let email: string | null = null;
  let name: string | null = null;

  // Tentar extrair do texto primeiro
  if (bodyText) {
    for (const pattern of emailPatterns) {
      const match = bodyText.match(pattern);
      if (match && match[1]) {
        email = match[1].toLowerCase().trim();
        break;
      }
    }

    for (const pattern of namePatterns) {
      const match = bodyText.match(pattern);
      if (match && match[1] && match[1].trim()) {
        name = match[1].trim();
        break;
      }
    }
  }

  // Se não encontrou no texto, tentar no HTML
  if (!email && bodyHtml) {
    for (const pattern of emailPatterns) {
      const match = bodyHtml.match(pattern);
      if (match && match[1]) {
        email = match[1].toLowerCase().trim();
        break;
      }
    }

    if (!name) {
      for (const pattern of namePatterns) {
        const match = bodyHtml.match(pattern);
        if (match && match[1] && match[1].trim()) {
          name = match[1].trim();
          break;
        }
      }
    }
  }

  if (!email) return null;

  // Limpar nome de possíveis tags HTML residuais
  if (name) {
    name = name.replace(/<[^>]*>/g, '').trim();
  }

  return { email, name };
}

/**
 * Verifica se o email é de um formulário de contato do Shopify
 */
function isShopifyContactFormEmail(fromEmail: string): boolean {
  const fromLower = (fromEmail || '').toLowerCase();
  return shopifyContactFormPatterns.some(pattern => fromLower.includes(pattern));
}

/**
 * Processa um job de email da fila
 *
 * IMPORTANTE: Se ocorrer erro APÓS marcar mensagem como 'processing',
 * a mensagem é resetada para 'pending' para evitar ficar presa.
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

  // Track if we set status to 'processing' so we can reset on error
  let markedAsProcessing = false;

  try {
    // Process the message
    markedAsProcessing = await processMessage(message, conversation, shop, supabase);
  } catch (error: any) {
    // Se a mensagem foi marcada como 'processing' e ocorreu erro,
    // resetar para 'pending' para que o cleanup não precise intervir
    if (markedAsProcessing) {
      console.log(`[Processor] Error after marking as processing, resetting message ${message_id} to pending`);
      try {
        await updateMessage(message_id, { status: 'pending' });
      } catch (resetError: any) {
        console.error(`[Processor] Failed to reset message status:`, resetError.message);
      }
    }
    // Re-throw para o process-queue tratar (retry ou DLQ)
    throw error;
  }
}

/**
 * Lógica principal de processamento de email
 * Adaptado de process-emails/index.ts
 *
 * @returns boolean - true se a mensagem foi marcada como 'processing', false caso contrário
 */
async function processMessage(
  message: Message,
  conversation: Conversation,
  shop: Shop,
  _supabase: any
): Promise<boolean> {
  console.log(`[Processor] Processing message ${message.id} from ${message.from_email}`);

  // Check if message was already successfully processed (prevent duplicate processing)
  // NOTA: Não verificamos 'processing' aqui porque mensagens em 'processing' podem ter sido
  // resetadas pelo cleanup e precisam ser reprocessadas
  if (message.status === 'replied') {
    console.log(`[Processor] Message ${message.id} already replied, skipping`);
    return false;
  }

  // Check if there's a recent reply to this conversation (prevent duplicate responses)
  // Reduced from 30 min to 3 min - 30 min was too aggressive and caused legitimate follow-up messages to be skipped
  const recentReplyCheck = await getConversationHistory(conversation.id, 5);
  const recentOutbound = (recentReplyCheck || []).filter((msg: Message) =>
    msg.direction === 'outbound' &&
    msg.was_auto_replied === true &&
    msg.created_at > new Date(Date.now() - 3 * 60 * 1000).toISOString() // Last 3 minutes
  );

  if (recentOutbound.length > 0) {
    console.log(`[Processor] Conversation ${conversation.id} already has recent auto-reply (${recentOutbound.length} in last 3min), skipping to avoid duplicate`);
    await updateMessage(message.id, {
      status: 'replied',
      error_message: 'Skipped - recent auto-reply exists',
      processed_at: new Date().toISOString(),
    });
    return false;
  }

  // Mark as processing
  await updateMessage(message.id, { status: 'processing' });

  // 1. Tentar extrair email de formulários Shopify ANTES de validar
  const isEmptyOrInvalid = !message.from_email || !message.from_email.includes('@');
  const isShopifySystem = isShopifyContactFormEmail(message.from_email || '');

  if (isEmptyOrInvalid || isShopifySystem) {
    // Tentar extrair email do cliente do corpo da mensagem (formulários Shopify)
    const extracted = extractEmailFromShopifyContactForm(message.body_text || '', message.body_html || '');

    if (extracted && extracted.email) {
      console.log(`[Processor] Email extraído do formulário Shopify: ${extracted.email}, Nome: ${extracted.name}`);
      message.from_email = extracted.email;
      if (extracted.name && !message.from_name) {
        message.from_name = extracted.name;
      }

      // Atualizar no banco
      await updateMessage(message.id, {
        from_email: extracted.email,
        from_name: extracted.name || message.from_name,
      });

      // Atualizar email do cliente na conversa se necessário
      if (!conversation.customer_email ||
          conversation.customer_email === 'unknown@invalid.local' ||
          isShopifyContactFormEmail(conversation.customer_email)) {
        await updateConversation(conversation.id, {
          customer_email: extracted.email,
          customer_name: extracted.name || conversation.customer_name,
        });
      }
    } else if (isEmptyOrInvalid) {
      // Email inválido e não conseguiu extrair de formulário
      await updateMessage(message.id, {
        status: 'failed',
        error_message: 'Email do remetente inválido',
      });
      throw new Error('Email do remetente inválido');
    } else {
      // É email Shopify mas não conseguiu extrair - marcar como falha
      await updateMessage(message.id, {
        status: 'failed',
        error_message: 'Formulário Shopify: não foi possível extrair email do cliente',
      });
      console.log(`[Processor] Shopify contact form but could not extract customer email from body`);
      throw new Error('Formulário Shopify: não foi possível extrair email do cliente');
    }
  }

  // 2. Ignorar outros emails de sistema (não Shopify, já tratado acima)
  const fromLower = message.from_email.toLowerCase();
  const nonShopifySystemPatterns = systemEmailPatterns.filter(
    pattern => !shopifyContactFormPatterns.some(sp => pattern.includes(sp.replace('@', '')))
  );
  if (nonShopifySystemPatterns.some((pattern) => fromLower.includes(pattern))) {
    await updateMessage(message.id, {
      status: 'failed',
      error_message: 'Email de sistema ignorado',
    });
    console.log(`[Processor] System email ignored: ${message.from_email}`);
    throw new Error('Email de sistema ignorado');
  }

  // 3. Limpar corpo do email
  const cleanBody = cleanEmailBody(message.body_text || '', message.body_html || '');
  if (!cleanBody || cleanBody.trim().length < 3) {
    await updateMessage(message.id, {
      status: 'failed',
      error_message: 'Corpo do email vazio',
      // NÃO salva categoria para emails vazios
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
    return true; // Success without replying - marked as processing before
  }

  // 5. Buscar usuário (dono da loja)
  const user = await getUserById(shop.user_id);
  if (!user) {
    await updateMessage(message.id, {
      status: 'failed',
      error_message: 'Usuário não encontrado',
    });
    throw new Error('Usuário não encontrado');
  }

  // 6. Buscar histórico da conversa ANTES de classificar
  const rawHistory = await getConversationHistory(conversation.id, 3);
  const conversationHistory = (rawHistory || []).map((msg: Message) => ({
    role: msg.direction === 'inbound' ? ('customer' as const) : ('assistant' as const),
    content: cleanEmailBody(msg.body_text || '', msg.body_html || ''),
  }));

  // 7. Classificar email PRIMEIRO (antes de verificar créditos)
  // Isso garante que a categoria seja salva mesmo sem créditos
  const classification = await classifyEmail(
    message.subject || '',
    cleanBody,
    conversationHistory.slice(0, -1) // Excluir a mensagem atual
  );

  // 8. Verificar créditos disponíveis (APÓS classificar)
  const hasCredits = await checkCreditsAvailable(user.id);
  if (!hasCredits) {
    // Notificar usuário que os créditos acabaram (não cobra automaticamente)
    console.log(`[Processor] User ${user.id} sem créditos - enviando notificação`);
    const notifyResult = await notifyCreditsExhausted(user.id);

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'credits_exhausted_notification',
      event_data: {
        notified: notifyResult.notified,
        error: notifyResult.error,
      },
    });

    // Salvar categoria mesmo sem créditos
    await updateMessage(message.id, {
      status: 'pending_credits',
      category: classification.category,
      category_confidence: classification.confidence,
    });

    // Atualizar conversa com categoria se não tiver
    if (!conversation.category && classification.category !== 'spam') {
      await updateConversation(conversation.id, {
        category: classification.category,
        language: classification.language,
      });
    }

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'pending_credits',
      event_data: {
        category: classification.category,
        confidence: classification.confidence,
        userNotified: notifyResult.notified,
      },
    });

    console.log(`[Processor] Message ${message.id} classified as ${classification.category}, no credits available. User notified: ${notifyResult.notified}`);
    throw new Error('Créditos insuficientes');
  }

  // 9. Se for spam, salvar categoria na MENSAGEM (para aparecer no painel), mas NÃO atualizar CONVERSA
  if (classification.category === 'spam') {
    // Salvar categoria 'spam' na MENSAGEM para aparecer no filtro do painel
    await updateMessage(message.id, {
      status: 'failed',
      category: 'spam',
      category_confidence: classification.confidence,
      error_message: 'Email classificado como spam',
      processed_at: new Date().toISOString(),
    });

    // Atualizar a CONVERSA com categoria spam apenas se não tiver categoria ainda
    // Isso permite que o spam apareça no filtro de spam do painel
    if (!conversation.category) {
      await updateConversation(conversation.id, {
        category: 'spam',
      });
    }

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'spam_detected',
      event_data: {
        confidence: classification.confidence,
        summary: classification.summary,
      },
    });

    console.log(`[Processor] Message ${message.id} classified as SPAM, ignoring`);
    return true; // Success without replying - marked as processing before
  }

  // 10. Salvar categoria apenas para emails NÃO-spam
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

  // Update conversation category (apenas para NÃO-spam)
  if (!conversation.category) {
    await updateConversation(conversation.id, {
      category: classification.category,
      language: classification.language,
    });
  } else if (
    classification.category === 'troca_devolucao_reembolso' &&
    conversation.category !== 'troca_devolucao_reembolso'
  ) {
    // Atualizar categoria se escalou para cancelamento/reembolso
    // Isso garante que a categoria da conversa fique consistente com o retention_contact_count
    await updateConversation(conversation.id, {
      category: classification.category,
    });
    console.log(`[Processor] Conversation ${conversation.id} category updated: ${conversation.category} -> troca_devolucao_reembolso`);
  }

  // 10. Buscar dados do Shopify se necessário
  let shopifyData: OrderSummary | null = null;
  let needsOrderData = false;

  const categoriasQueNeedShopify = [
    'rastreio',
    'edicao_pedido',
    'troca_devolucao_reembolso',
  ];

  // Variável para armazenar pedidos adicionais (quando cliente menciona múltiplos)
  let additionalOrders: OrderSummary[] = [];

  if (categoriasQueNeedShopify.includes(classification.category)) {
    needsOrderData = true;

    // CHECK CIRCUIT BREAKER - but continue processing even if open
    const shopifyCircuitOpen = await isShopifyCircuitOpen(shop.id);
    if (shopifyCircuitOpen) {
      console.log(`[Processor] Shopify circuit breaker is OPEN for shop ${shop.id}, continuing without Shopify data`);

      await logProcessingEvent({
        shop_id: shop.id,
        message_id: message.id,
        conversation_id: conversation.id,
        event_type: 'shopify_circuit_open',
        event_data: {
          category: classification.category,
          action: 'continuing_without_shopify',
        },
      });

      // Continue processing - AI will respond without Shopify data
    }

    // Only try Shopify lookup if circuit is not open
    if (!shopifyCircuitOpen) {
    // NOVO: Extrair TODOS os números de pedido de todas as fontes
    const originalBody = message.body_text || message.body_html || '';
    const allOrderNumbers = new Set<string>();

    // Extrair de todas as fontes
    extractAllOrderNumbers(message.subject || '').forEach(n => allOrderNumbers.add(n));
    extractAllOrderNumbers(cleanBody).forEach(n => allOrderNumbers.add(n));
    extractAllOrderNumbers(originalBody).forEach(n => allOrderNumbers.add(n));

    // Também buscar no histórico de mensagens da conversa
    for (const historyMsg of rawHistory || []) {
      extractAllOrderNumbers(historyMsg.subject || '').forEach(n => allOrderNumbers.add(n));
      extractAllOrderNumbers(historyMsg.body_text || '').forEach(n => allOrderNumbers.add(n));
    }

    // Adicionar o número salvo na conversa, se existir
    if (conversation.shopify_order_id) {
      allOrderNumbers.add(conversation.shopify_order_id);
    }

    const orderNumbersArray = Array.from(allOrderNumbers);
    const orderNumber = orderNumbersArray[0] || null; // Primeiro número para compatibilidade

    console.log(`[Processor] Order numbers found: ${orderNumbersArray.join(', ')} (total: ${orderNumbersArray.length})`);

    const shopifyCredentials = await decryptShopifyCredentials(shop);

    if (shopifyCredentials) {
      try {
        // Se houver múltiplos pedidos, buscar todos
        if (orderNumbersArray.length > 1) {
          console.log(`[Processor] Multiple orders detected, fetching all...`);
          const allOrders = await getMultipleOrdersDataForAI(
            shopifyCredentials,
            message.from_email,
            orderNumbersArray
          );

          if (allOrders.length > 0) {
            shopifyData = allOrders[0]; // Primeiro pedido como principal
            additionalOrders = allOrders.slice(1); // Restante como adicionais
            console.log(`[Processor] Found ${allOrders.length} orders: primary=${shopifyData?.order_number}, additional=${additionalOrders.map(o => o.order_number).join(', ')}`);
          }
        } else {
          // Comportamento original para único pedido
          shopifyData = await getOrderDataForAI(
            shopifyCredentials,
            message.from_email,
            orderNumber
          );
        }

        // RECORD SHOPIFY SUCCESS - circuit breaker will close if in half_open
        await recordShopifySuccess(shop.id);

        await logProcessingEvent({
          shop_id: shop.id,
          message_id: message.id,
          conversation_id: conversation.id,
          event_type: 'shopify_lookup',
          event_data: {
            order_numbers: orderNumbersArray,
            found: !!shopifyData,
            additional_orders_count: additionalOrders.length
          },
        });

        if (shopifyData) {
          await updateConversation(conversation.id, {
            shopify_order_id: shopifyData.order_number,
            customer_name: shopifyData.customer_name,
          });
        } else if (orderNumber) {
          // IMPORTANTE: Salvar o número do pedido mesmo se Shopify não encontrou
          console.log(`[Processor] Saving customer-provided order number to conversation: ${orderNumber}`);
          await updateConversation(conversation.id, {
            shopify_order_id: orderNumber,
          });
        }
      } catch (error: any) {
        console.error(`[Processor] Shopify lookup failed:`, error.message);

        // RECORD SHOPIFY FAILURE - may open circuit breaker after 3 failures
        const circuitState = await recordShopifyFailure(shop.id, error.message);
        console.log(`[Processor] Shopify circuit state after failure: ${circuitState}`);

        await logProcessingEvent({
          shop_id: shop.id,
          message_id: message.id,
          conversation_id: conversation.id,
          event_type: 'shopify_lookup_failed',
          event_data: {
            error: error.message,
            circuit_state: circuitState,
            category: classification.category,
          },
        });

        // Save order number and continue without Shopify data - AI will respond with available info
        if (orderNumber && !conversation.shopify_order_id) {
          await updateConversation(conversation.id, {
            shopify_order_id: orderNumber,
          });
        }

        console.log(`[Processor] Continuing without Shopify data, AI will respond with available info`);
      }
    }
    } // end if (!shopifyCircuitOpen)
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

    return true; // Success - marked as processing before
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

    return true; // Success - marked as processing before
  }

  // 12.5 Incrementar contador de retenção se for cancelamento/reembolso
  let currentRetentionCount = conversation.retention_contact_count || 0;
  if (classification.category === 'troca_devolucao_reembolso') {
    currentRetentionCount += 1;
    await updateConversation(conversation.id, {
      retention_contact_count: currentRetentionCount,
    });
    console.log(`[Processor] Retention contact #${currentRetentionCount} for conversation ${conversation.id}`);
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
      support_email: shop.support_email,
      retention_coupon_code: shop.retention_coupon_code,
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
    classification.language || 'en',
    currentRetentionCount,
    // Passar pedidos adicionais se houver
    additionalOrders.map(order => ({
      order_number: order.order_number,
      order_date: order.order_date,
      order_status: order.order_status,
      order_total: order.order_total,
      tracking_number: order.tracking_number,
      tracking_url: order.tracking_url,
      fulfillment_status: order.fulfillment_status,
      items: order.items || [],
      customer_name: order.customer_name,
    }))
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
  // Note: troca_devolucao_reembolso is handled by the AI directing customer to support email
  let finalStatus: 'replied' | 'pending_human' = 'replied';

  if (aiResponse.forward_to_human) {
    finalStatus = 'pending_human';
    await forwardToHuman(shop, message);
    console.log(`[Processor] Forwarding to human - ai_forward: true`);
  } else if (classification.category === 'troca_devolucao_reembolso' && currentRetentionCount >= 3) {
    // Só marca como pending_human APÓS 3 contatos de retenção
    // Nos contatos 1 e 2, a IA tenta reter o cliente
    finalStatus = 'pending_human';
    console.log(`[Processor] Marked as pending_human - category: troca_devolucao_reembolso after ${currentRetentionCount} retention contacts`);
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

    // Log event - different reasons for different scenarios
    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: classification.category === 'troca_devolucao_reembolso'
        ? 'directed_to_support'  // Customer directed to contact support email
        : 'forwarded_to_human',  // Email actually forwarded to human
      event_data: {
        reason: classification.category === 'troca_devolucao_reembolso'
          ? 'customer_directed_to_support_email'
          : 'ai_requested_forward',
        category: classification.category,
      },
    });
  }

  // 16. Incrementar uso de créditos
  await incrementEmailsUsed(user.id);

  console.log(`[Processor] Message ${message.id} processed successfully`);
  return true; // Marked as processing at the beginning
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
