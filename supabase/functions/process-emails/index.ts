/**
 * Edge Function: process-emails
 *
 * Função principal que processa emails de todas as lojas ativas.
 * Deve ser chamada via cron a cada 15 minutos.
 *
 * Fluxo:
 * 1. Busca lojas ativas com email configurado
 * 2. Para cada loja, conecta IMAP e busca emails não lidos
 * 3. Salva emails no banco e agrupa em conversations
 * 4. Processa emails pendentes (classificação, resposta, envio)
 */

// deno-lint-ignore-file no-explicit-any
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import {
  getSupabaseClient,
  getActiveShopsWithEmail,
  getUserById,
  checkCreditsAvailable,
  incrementEmailsUsed,
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
  sendEmail,
  buildReplyHeaders,
  buildReplySubject,
  cleanEmailBody,
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
  generateHumanFallbackMessage,
} from '../_shared/anthropic.ts';

// Constantes
const MAX_EMAILS_PER_SHOP = 10; // Emails IMAP por loja
const MAX_DATA_REQUESTS = 3;
const MAX_CONCURRENT_SHOPS = 1; // Processar 1 loja por vez (IMAP é o gargalo)
const MAX_CONCURRENT_MESSAGES = 2; // Processar 2 mensagens em paralelo
const MAX_EXECUTION_TIME_MS = 100000; // 100 segundos (limite real é 120s)
const MAX_MESSAGES_PER_EXECUTION = 15; // Limitar total de mensagens processadas por execução

/**
 * Extrai email do cliente do corpo de um formulário de contato do Shopify
 * O Shopify envia emails do formulário com o email do cliente no corpo, não no header
 *
 * Padrões suportados:
 * - "E-mail:\nemail@example.com"
 * - "Email:\nemail@example.com"
 * - "E-mail: email@example.com"
 */
function extractEmailFromShopifyContactForm(bodyText: string): { email: string; name: string | null } | null {
  if (!bodyText) return null;

  // Padrão 1: "E-mail:\n" ou "Email:\n" seguido do email na próxima linha
  const emailLinePattern = /(?:E-?mail|email):\s*\n?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
  const emailMatch = bodyText.match(emailLinePattern);

  if (!emailMatch) return null;

  const email = emailMatch[1].toLowerCase();

  // Tentar extrair nome também
  // Padrão: "Name:\nNome do Cliente" ou "Nome:\nNome do Cliente"
  const namePattern = /(?:Name|Nome):\s*\n?\s*([^\n]+)/i;
  const nameMatch = bodyText.match(namePattern);
  const name = nameMatch ? nameMatch[1].trim() : null;

  return { email, name };
}

// Tipos
interface ProcessingStats {
  shops_processed: number;
  emails_received: number;
  emails_replied: number;
  emails_pending_credits: number;
  emails_forwarded_human: number;
  emails_spam: number;
  errors: number;
}

/**
 * Processa itens em paralelo com limite de concorrência
 */
async function processInBatches<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(processor));

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    }
  }

  return results;
}

/**
 * Verifica se ainda há tempo disponível para processamento
 */
function hasTimeRemaining(startTime: number): boolean {
  return Date.now() - startTime < MAX_EXECUTION_TIME_MS;
}

/**
 * Handler principal da Edge Function
 */
serve(async (req) => {
  // Verificar método
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Headers CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const stats: ProcessingStats = {
    shops_processed: 0,
    emails_received: 0,
    emails_replied: 0,
    emails_pending_credits: 0,
    emails_forwarded_human: 0,
    emails_spam: 0,
    errors: 0,
  };

  let timeoutReached = false;
  let shopsSkipped = 0;
  let messageLimitReached = false;
  let totalMessagesProcessed = 0;

  try {
    console.log('Iniciando processamento de emails (paralelo)...');

    // 1. Buscar lojas ativas
    const shops = await getActiveShopsWithEmail();
    console.log(`Encontradas ${shops.length} lojas ativas`);

    // 2. Processar lojas em paralelo (batches de MAX_CONCURRENT_SHOPS)
    for (let i = 0; i < shops.length; i += MAX_CONCURRENT_SHOPS) {
      // Verificar timeout antes de processar próximo batch
      if (!hasTimeRemaining(startTime)) {
        timeoutReached = true;
        shopsSkipped = shops.length - i;
        console.log(`⚠️ Timeout próximo! Pulando ${shopsSkipped} lojas restantes.`);
        break;
      }

      // Verificar limite de mensagens
      if (totalMessagesProcessed >= MAX_MESSAGES_PER_EXECUTION) {
        messageLimitReached = true;
        shopsSkipped = shops.length - i;
        console.log(`⚠️ Limite de mensagens atingido (${totalMessagesProcessed}). Pulando ${shopsSkipped} lojas restantes.`);
        break;
      }

      const batch = shops.slice(i, i + MAX_CONCURRENT_SHOPS);
      console.log(`Processando batch ${Math.floor(i / MAX_CONCURRENT_SHOPS) + 1}: ${batch.length} lojas em paralelo`);

      // Calcular quantas mensagens ainda podemos processar
      const remainingMessages = MAX_MESSAGES_PER_EXECUTION - totalMessagesProcessed;

      const batchResults = await Promise.allSettled(
        batch.map(async (shop) => {
          try {
            const shopStats = await processShopParallel(shop, startTime, remainingMessages);
            return { shop, stats: shopStats, success: true };
          } catch (error) {
            console.error(`Erro ao processar loja ${shop.id}:`, error);

            await logProcessingEvent({
              shop_id: shop.id,
              event_type: 'error',
              error_type: 'shop_processing',
              error_message: error instanceof Error ? error.message : 'Erro desconhecido',
              error_stack: error instanceof Error ? error.stack : undefined,
            });

            await updateShopEmailSync(
              shop.id,
              error instanceof Error ? error.message : 'Erro desconhecido'
            );

            return { shop, stats: null, success: false, error };
          }
        })
      );

      // Agregar estatísticas
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          const { stats: shopStats, success } = result.value;
          if (success && shopStats) {
            stats.shops_processed++;
            stats.emails_received += shopStats.emails_received;
            stats.emails_replied += shopStats.emails_replied;
            stats.emails_pending_credits += shopStats.emails_pending_credits;
            stats.emails_forwarded_human += shopStats.emails_forwarded_human;
            stats.emails_spam += shopStats.emails_spam;
            stats.errors += shopStats.errors;
            totalMessagesProcessed += shopStats.emails_replied + shopStats.emails_forwarded_human + shopStats.emails_spam;
          } else {
            stats.errors++;
          }
        } else {
          stats.errors++;
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`Processamento concluído em ${duration}ms`, stats);
    if (timeoutReached) {
      console.log(`⚠️ Timeout: ${shopsSkipped} lojas não processadas nesta execução`);
    }
    if (messageLimitReached) {
      console.log(`⚠️ Limite de mensagens: ${shopsSkipped} lojas não processadas nesta execução`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        duration_ms: duration,
        timeout_reached: timeoutReached,
        message_limit_reached: messageLimitReached,
        shops_skipped: shopsSkipped,
        total_messages_processed: totalMessagesProcessed,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Erro fatal no processamento:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stats,
        duration_ms: Date.now() - startTime,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

/**
 * Estatísticas individuais de uma loja
 */
interface ShopStats {
  emails_received: number;
  emails_replied: number;
  emails_pending_credits: number;
  emails_forwarded_human: number;
  emails_spam: number;
  errors: number;
}

/**
 * Processa uma loja específica com processamento paralelo de mensagens
 */
async function processShopParallel(shop: Shop, globalStartTime: number, maxMessages: number = MAX_MESSAGES_PER_EXECUTION): Promise<ShopStats> {
  const shopStats: ShopStats = {
    emails_received: 0,
    emails_replied: 0,
    emails_pending_credits: 0,
    emails_forwarded_human: 0,
    emails_spam: 0,
    errors: 0,
  };

  console.log(`Processando loja: ${shop.name} (${shop.id})`);

  // 1. Decriptar credenciais de email
  const emailCredentials = await decryptEmailCredentials(shop);
  if (!emailCredentials) {
    console.log(`Loja ${shop.id} sem credenciais de email válidas`);
    return shopStats;
  }

  // 2. Buscar emails não lidos via IMAP
  let emailStartDate: Date | null = null;
  if (shop.email_start_mode === 'from_integration_date' && shop.email_start_date) {
    emailStartDate = new Date(shop.email_start_date);
    console.log(`Loja ${shop.id}: Modo from_integration_date, ignorando emails anteriores a ${emailStartDate.toISOString()}`);
  } else {
    console.log(`Loja ${shop.id}: Modo all_unread, processando todos os emails não lidos`);
  }

  let incomingEmails: IncomingEmail[] = [];
  try {
    incomingEmails = await fetchUnreadEmails(emailCredentials, MAX_EMAILS_PER_SHOP, emailStartDate);
    console.log(`Loja ${shop.id}: ${incomingEmails.length} emails não lidos (após filtro de data)`);
    shopStats.emails_received = incomingEmails.length;
  } catch (error) {
    console.error(`Erro ao buscar emails da loja ${shop.id}:`, error);
    await updateShopEmailSync(
      shop.id,
      error instanceof Error ? error.message : 'Erro ao conectar IMAP'
    );
    throw error;
  }

  // 3. Salvar emails no banco (ignorando emails da própria loja)
  const shopEmail = emailCredentials.smtp_user.toLowerCase();
  for (const email of incomingEmails) {
    if (email.from_email.toLowerCase() === shopEmail) {
      console.log(`Ignorando email de ${email.from_email} (própria loja)`);
      continue;
    }
    try {
      await saveIncomingEmail(shop.id, email);
    } catch (error) {
      console.error(`Erro ao salvar email ${email.message_id}:`, error);
      shopStats.errors++;
    }
  }

  // 4. Processar emails pendentes em paralelo
  const allPendingMessages = await getPendingMessages(shop.id);
  // Limitar mensagens para não exceder o limite global
  const pendingMessages = allPendingMessages.slice(0, maxMessages);
  console.log(`Loja ${shop.id}: ${allPendingMessages.length} mensagens pendentes, processando ${pendingMessages.length}`);

  let messagesProcessedInShop = 0;

  // Processar mensagens em batches paralelos
  for (let i = 0; i < pendingMessages.length; i += MAX_CONCURRENT_MESSAGES) {
    // Verificar timeout global antes de cada batch
    if (!hasTimeRemaining(globalStartTime)) {
      console.log(`⚠️ Loja ${shop.id}: Timeout global, parando processamento. ${pendingMessages.length - i} msgs restantes.`);
      break;
    }

    // Verificar limite de mensagens por loja
    if (messagesProcessedInShop >= maxMessages) {
      console.log(`⚠️ Loja ${shop.id}: Limite de mensagens atingido (${messagesProcessedInShop})`);
      break;
    }

    const batch = pendingMessages.slice(i, i + MAX_CONCURRENT_MESSAGES);
    console.log(`Loja ${shop.id}: Processando batch de ${batch.length} mensagens em paralelo`);

    const batchResults = await Promise.allSettled(
      batch.map(async (message) => {
        try {
          return await processMessage(shop, message, emailCredentials);
        } catch (error) {
          console.error(`Erro ao processar mensagem ${message.id}:`, error);
          await updateMessage(message.id, {
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Erro desconhecido',
          });
          throw error;
        }
      })
    );

    // Agregar resultados
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        const outcome = result.value;
        if (outcome === 'replied') {
          shopStats.emails_replied++;
          messagesProcessedInShop++;
        } else if (outcome === 'pending_credits') {
          shopStats.emails_pending_credits++;
        } else if (outcome === 'forwarded_human') {
          shopStats.emails_forwarded_human++;
          messagesProcessedInShop++;
        } else if (outcome === 'spam') {
          shopStats.emails_spam++;
          messagesProcessedInShop++;
        }
      } else {
        shopStats.errors++;
      }
    }
  }

  // 5. Atualizar timestamp de sync
  await updateShopEmailSync(shop.id);

  console.log(`Loja ${shop.id} concluída:`, shopStats);
  return shopStats;
}

/**
 * Salva um email recebido no banco
 */
async function saveIncomingEmail(shopId: string, email: IncomingEmail): Promise<void> {
  const supabase = getSupabaseClient();

  // Verificar se já existe (por message_id)
  const { data: existing } = await supabase
    .from('messages')
    .select('id')
    .eq('message_id', email.message_id)
    .single();

  if (existing) {
    console.log(`Email ${email.message_id} já existe, ignorando`);
    return;
  }

  // Determinar from_email e from_name
  // Se from_email está vazio, tentar extrair do corpo (formulário de contato Shopify)
  let finalFromEmail = email.from_email;
  let finalFromName = email.from_name;

  if (!finalFromEmail || !finalFromEmail.includes('@')) {
    const bodyContent = email.body_text || email.body_html || '';
    const extracted = extractEmailFromShopifyContactForm(bodyContent);

    if (extracted) {
      console.log(`Email extraído do formulário Shopify: ${extracted.email} (Nome: ${extracted.name || 'N/A'})`);
      finalFromEmail = extracted.email;
      finalFromName = extracted.name || finalFromName;
    } else {
      // Não conseguiu extrair - salvar mesmo assim mas com status failed
      console.log(`Email ${email.message_id}: from_email vazio e não foi possível extrair do corpo`);

      // Criar conversa mesmo sem email válido para registro
      const conversationId = await getOrCreateConversation(
        shopId,
        'unknown@invalid.local', // Email placeholder para criar conversa
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

      await logProcessingEvent({
        shop_id: shopId,
        conversation_id: conversationId,
        event_type: 'email_received_invalid',
        event_data: {
          reason: 'from_email_empty_and_not_extracted',
          subject: email.subject,
        },
      });

      return;
    }
  }

  // Buscar ou criar conversation
  const conversationId = await getOrCreateConversation(
    shopId,
    finalFromEmail,
    email.subject || '',
    email.in_reply_to || undefined
  );

  // Atualizar nome do cliente na conversation se disponível
  if (finalFromName) {
    await updateConversation(conversationId, {
      customer_name: finalFromName,
    });
  }

  // Salvar mensagem
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

  // Validar from_email antes de processar
  if (!message.from_email || !message.from_email.includes('@')) {
    console.log(`Pulando mensagem ${message.id}: from_email inválido (${message.from_email})`);
    await updateMessage(message.id, {
      status: 'failed',
      error_message: 'Email do remetente inválido ou ausente',
    });
    return 'skipped';
  }

  // Ignorar emails de sistemas de entrega (bounces, notificações)
  const systemEmailPatterns = [
    'mailer-daemon@',
    'postmaster@',
    'mail-delivery-subsystem@',
    'noreply@',
    'no-reply@',
    'donotreply@',
  ];
  const fromLower = message.from_email.toLowerCase();
  if (systemEmailPatterns.some(pattern => fromLower.includes(pattern))) {
    console.log(`Pulando mensagem ${message.id}: email de sistema (${message.from_email})`);
    await updateMessage(message.id, {
      status: 'failed',
      error_message: 'Email de sistema (bounce/notificação) ignorado',
    });
    return 'skipped';
  }

  // Marcar como processando
  await updateMessage(message.id, { status: 'processing' });

  const startTime = Date.now();

  // 1. Verificar créditos
  const user = await getUserById(shop.user_id);
  if (!user) {
    await updateMessage(message.id, { status: 'failed', error_message: 'Usuário não encontrado' });
    return 'skipped';
  }

  const hasCredits = await checkCreditsAvailable(user.id);
  if (!hasCredits) {
    await updateMessage(message.id, { status: 'pending_credits' });

    // Notificar admin sobre créditos esgotados
    await handleCreditsExhausted(shop, user, message);

    return 'pending_credits';
  }

  // 2. Rate limit removido - controle de spam será feito de outra forma
  // TODO: Implementar detecção de spam via análise de conteúdo/frequência

  // 3. Limpar corpo do email
  let cleanBody = cleanEmailBody(message.body_text || message.body_html || '');

  // Se o corpo está vazio mas o assunto tem conteúdo, usar o assunto como corpo
  if ((!cleanBody || cleanBody.trim().length < 3) && message.subject && message.subject.trim().length > 3) {
    console.log(`Corpo vazio, usando assunto como contexto: "${message.subject}"`);
    cleanBody = message.subject;
  }

  // Validar que temos algum conteúdo para processar
  if (!cleanBody || cleanBody.trim().length < 3) {
    console.log(`Pulando mensagem ${message.id}: corpo e assunto vazios ou muito curtos`);
    await updateMessage(message.id, {
      status: 'failed',
      error_message: 'Corpo e assunto do email vazios',
    });
    return 'skipped';
  }

  // 4. Buscar histórico da conversa
  const history = await getConversationHistory(conversation.id, 3);
  const conversationHistory = history.map((m) => ({
    role: m.direction === 'inbound' ? ('customer' as const) : ('assistant' as const),
    content: cleanEmailBody(m.body_text || m.body_html || ''),
  }));

  // 5. Classificar email
  const classification = await classifyEmail(
    message.subject || '',
    cleanBody,
    conversationHistory.slice(0, -1) // Excluir a mensagem atual do histórico
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

  // 5.1 Se for spam, marcar e não responder
  if (classification.category === 'spam') {
    console.log(`Email ${message.id} classificado como SPAM - não será respondido`);

    await updateMessage(message.id, {
      status: 'failed',
      category: 'spam',
      category_confidence: classification.confidence,
      error_message: 'Email classificado como spam - não respondido',
    });

    await updateConversation(conversation.id, {
      category: 'spam',
      status: 'closed',
    });

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

    return 'spam';
  }

  // 6. Buscar dados do Shopify
  let shopifyData: OrderSummary | null = null;
  const shopifyCredentials = await decryptShopifyCredentials(shop);

  if (shopifyCredentials) {
    // Extrair número do pedido do email ou usar o salvo na conversation
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
      // Atualizar conversation com dados do pedido
      await updateConversation(conversation.id, {
        shopify_order_id: shopifyData.order_number,
        customer_name: shopifyData.customer_name,
      });

      await logProcessingEvent({
        shop_id: shop.id,
        message_id: message.id,
        event_type: 'shopify_lookup',
        event_data: {
          found: true,
          order_number: shopifyData.order_number,
        },
      });
    } else {
      await logProcessingEvent({
        shop_id: shop.id,
        message_id: message.id,
        event_type: 'shopify_lookup',
        event_data: { found: false },
      });
    }
  }

  // 7. Gerar resposta
  let responseResult: { response: string; tokens_input: number; tokens_output: number };
  let finalStatus: 'replied' | 'pending_human' = 'replied';

  // Categorias que NÃO precisam de dados do Shopify para responder
  // (emails genéricos, dúvidas sobre produtos, etc.)
  const categoriesWithoutOrderData = ['outros', 'produto'];
  const needsOrderData = !categoriesWithoutOrderData.includes(classification.category);

  // Se categoria é suporte_humano
  if (classification.category === 'suporte_humano') {
    responseResult = await generateHumanFallbackMessage(
      {
        name: shop.name,
        attendant_name: shop.attendant_name,
        support_email: shop.support_email,
        tone_of_voice: shop.tone_of_voice,
        fallback_message_template: shop.fallback_message_template,
      },
      shopifyData?.customer_name || conversation.customer_name,
      classification.language // Passar idioma detectado
    );
    finalStatus = 'pending_human';

    // Encaminhar para suporte humano
    await forwardToHuman(shop, message, emailCredentials);
  }
  // Se não tem dados do Shopify, precisa de dados de pedido, e ainda não pedimos muitas vezes
  else if (!shopifyData && needsOrderData && conversation.data_request_count < MAX_DATA_REQUESTS) {
    responseResult = await generateDataRequestMessage(
      {
        name: shop.name,
        attendant_name: shop.attendant_name,
        tone_of_voice: shop.tone_of_voice,
      },
      message.subject || '',
      cleanBody,
      conversation.data_request_count + 1,
      classification.language // Passar idioma detectado
    );

    // Incrementar contador de pedidos de dados
    await updateConversation(conversation.id, {
      data_request_count: conversation.data_request_count + 1,
    });

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      event_type: 'data_requested',
      event_data: { attempt: conversation.data_request_count + 1 },
    });
  }
  // Se já pedimos dados 3 vezes sem sucesso (apenas para categorias que precisam de dados)
  else if (!shopifyData && needsOrderData && conversation.data_request_count >= MAX_DATA_REQUESTS) {
    responseResult = await generateHumanFallbackMessage(
      {
        name: shop.name,
        attendant_name: shop.attendant_name,
        support_email: shop.support_email,
        tone_of_voice: shop.tone_of_voice,
        fallback_message_template: shop.fallback_message_template,
      },
      null,
      classification.language // Passar idioma detectado
    );
    finalStatus = 'pending_human';

    await forwardToHuman(shop, message, emailCredentials);
  }
  // Resposta normal (com ou sem dados do Shopify)
  else {
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
      },
      message.subject || '',
      cleanBody,
      classification.category,
      conversationHistory,
      shopifyData,
      classification.language // Passar idioma detectado
    );
  }

  await logProcessingEvent({
    shop_id: shop.id,
    message_id: message.id,
    event_type: 'response_generated',
    tokens_input: responseResult.tokens_input,
    tokens_output: responseResult.tokens_output,
    processing_time_ms: Date.now() - startTime,
  });

  // 8. Enviar resposta
  const replyHeaders = buildReplyHeaders(
    message.message_id || '',
    message.references_header
  );

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

  // 9. Salvar resposta enviada
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

  // 10. Atualizar mensagem original
  await updateMessage(message.id, {
    status: finalStatus === 'pending_human' ? 'pending_human' : 'replied',
    was_auto_replied: true,
    auto_reply_message_id: sendResult.message_id,
    tokens_input: responseResult.tokens_input,
    tokens_output: responseResult.tokens_output,
    processed_at: new Date().toISOString(),
    replied_at: new Date().toISOString(),
  });

  // 11. Incrementar contador de emails usados e verificar cobrança de extras
  await incrementEmailsUsed(user.id);

  // 11.1 Verificar se usuário excedeu o limite e precisa cobrar extras
  await checkAndChargeExtraEmails(user.id, shop.id);

  // 12. Atualizar status da conversation se foi para humano
  if (finalStatus === 'pending_human') {
    await updateConversation(conversation.id, {
      status: 'pending_human',
    });
  }

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
 * Encaminha email para suporte humano
 */
async function forwardToHuman(
  shop: Shop,
  message: Message,
  emailCredentials: NonNullable<Awaited<ReturnType<typeof decryptEmailCredentials>>>
): Promise<void> {
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
      reason: 'suporte_humano',
    },
  });
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

  // Verificar se já notificamos recentemente (última hora)
  const lastWarning = user.last_credits_warning_at
    ? new Date(user.last_credits_warning_at)
    : null;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  if (lastWarning && lastWarning > oneHourAgo) {
    // Já notificamos na última hora, não enviar novamente
    return;
  }

  // Enviar notificação por email
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

  // Atualizar timestamp do aviso
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
 * Verifica se o usuário excedeu o limite do plano e precisa cobrar pacote de emails extras
 */
async function checkAndChargeExtraEmails(userId: string, shopId: string): Promise<void> {
  const supabase = getSupabaseClient();

  // Verificar se usuário excedeu o limite do plano
  const { data: user } = await supabase
    .from('users')
    .select('id, emails_used, emails_limit, extra_emails_purchased, extra_emails_used, pending_extra_emails')
    .eq('id', userId)
    .single();

  if (!user) return;

  // Se ainda está dentro do limite do plano, não fazer nada
  if (user.emails_used <= user.emails_limit) {
    // Ainda dentro do limite do plano, não precisa contar como extra
    return;
  }

  // Usuário excedeu o limite do plano - incrementar contador de extras pendentes
  const { data: billingCheck } = await supabase.rpc('increment_pending_extra_email', {
    p_user_id: userId,
  });

  if (!billingCheck || billingCheck.length === 0) return;

  const result = billingCheck[0];

  // Se atingiu o tamanho do pacote, cobrar automaticamente
  if (result.needs_billing) {
    console.log(`Usuário ${userId} atingiu ${result.new_pending_count} emails extras - cobrando pacote`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    try {
      // Chamar Edge Function de cobrança
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
        console.log(`Pacote de emails extras cobrado com sucesso: ${chargeResult.invoice_id}`);

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
        console.error('Erro ao cobrar emails extras:', chargeResult.error);

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
      console.error('Erro ao chamar charge-extra-emails:', error);

      await logProcessingEvent({
        shop_id: shopId,
        event_type: 'extra_emails_charge_error',
        error_message: error instanceof Error ? error.message : 'Erro desconhecido',
        event_data: { user_id: userId },
      });
    }
  }
}
