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
const MAX_EMAILS_PER_SHOP = 50;
const MAX_DATA_REQUESTS = 3;

// Tipos
interface ProcessingStats {
  shops_processed: number;
  emails_received: number;
  emails_replied: number;
  emails_pending_credits: number;
  emails_forwarded_human: number;
  errors: number;
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
    errors: 0,
  };

  try {
    console.log('Iniciando processamento de emails...');

    // 1. Buscar lojas ativas
    const shops = await getActiveShopsWithEmail();
    console.log(`Encontradas ${shops.length} lojas ativas`);

    // 2. Processar cada loja
    for (const shop of shops) {
      try {
        await processShop(shop, stats);
        stats.shops_processed++;
      } catch (error) {
        console.error(`Erro ao processar loja ${shop.id}:`, error);
        stats.errors++;

        await logProcessingEvent({
          shop_id: shop.id,
          event_type: 'error',
          error_type: 'shop_processing',
          error_message: error instanceof Error ? error.message : 'Erro desconhecido',
          error_stack: error instanceof Error ? error.stack : undefined,
        });

        // Atualizar erro de sync da loja
        await updateShopEmailSync(
          shop.id,
          error instanceof Error ? error.message : 'Erro desconhecido'
        );
      }
    }

    const duration = Date.now() - startTime;
    console.log(`Processamento concluído em ${duration}ms`, stats);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        duration_ms: duration,
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
 * Processa uma loja específica
 */
async function processShop(shop: Shop, stats: ProcessingStats): Promise<void> {
  console.log(`Processando loja: ${shop.name} (${shop.id})`);

  // 1. Decriptar credenciais de email
  const emailCredentials = await decryptEmailCredentials(shop);
  if (!emailCredentials) {
    console.log(`Loja ${shop.id} sem credenciais de email válidas`);
    return;
  }

  // 2. Buscar emails não lidos via IMAP
  let incomingEmails: IncomingEmail[] = [];
  try {
    incomingEmails = await fetchUnreadEmails(emailCredentials, MAX_EMAILS_PER_SHOP);
    console.log(`Loja ${shop.id}: ${incomingEmails.length} emails não lidos`);
    stats.emails_received += incomingEmails.length;
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
    // Ignorar emails enviados pela própria loja (evita responder a si mesmo)
    if (email.from_email.toLowerCase() === shopEmail) {
      console.log(`Ignorando email de ${email.from_email} (própria loja)`);
      continue;
    }
    try {
      await saveIncomingEmail(shop.id, email);
    } catch (error) {
      console.error(`Erro ao salvar email ${email.message_id}:`, error);
      stats.errors++;
    }
  }

  // 4. Processar emails pendentes
  const pendingMessages = await getPendingMessages(shop.id);
  console.log(`Loja ${shop.id}: ${pendingMessages.length} mensagens pendentes`);

  for (const message of pendingMessages) {
    try {
      const result = await processMessage(shop, message, emailCredentials);

      if (result === 'replied') stats.emails_replied++;
      else if (result === 'pending_credits') stats.emails_pending_credits++;
      else if (result === 'forwarded_human') stats.emails_forwarded_human++;
    } catch (error) {
      console.error(`Erro ao processar mensagem ${message.id}:`, error);
      stats.errors++;

      await updateMessage(message.id, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  }

  // 5. Atualizar timestamp de sync
  await updateShopEmailSync(shop.id);
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

  // Buscar ou criar conversation
  const conversationId = await getOrCreateConversation(
    shopId,
    email.from_email,
    email.subject || '',
    email.in_reply_to || undefined
  );

  // Salvar mensagem
  await saveMessage({
    conversation_id: conversationId,
    from_email: email.from_email,
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
    status: 'pending',
    received_at: email.received_at.toISOString(),
  });

  await logProcessingEvent({
    shop_id: shopId,
    conversation_id: conversationId,
    event_type: 'email_received',
    event_data: {
      from: email.from_email,
      subject: email.subject,
      has_attachments: email.has_attachments,
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
): Promise<'replied' | 'pending_credits' | 'forwarded_human' | 'skipped'> {
  if (!emailCredentials) return 'skipped';

  const conversation = message.conversation as Conversation | undefined;
  if (!conversation) return 'skipped';

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
  const cleanBody = cleanEmailBody(message.body_text || message.body_html || '');

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
      shopifyData?.customer_name || conversation.customer_name
    );
    finalStatus = 'pending_human';

    // Encaminhar para suporte humano
    await forwardToHuman(shop, message, emailCredentials);
  }
  // Se não tem dados do Shopify e ainda não pedimos muitas vezes
  else if (!shopifyData && conversation.data_request_count < MAX_DATA_REQUESTS) {
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
  // Se já pedimos dados 3 vezes sem sucesso
  else if (!shopifyData && conversation.data_request_count >= MAX_DATA_REQUESTS) {
    responseResult = await generateHumanFallbackMessage(
      {
        name: shop.name,
        attendant_name: shop.attendant_name,
        support_email: shop.support_email,
        tone_of_voice: shop.tone_of_voice,
        fallback_message_template: shop.fallback_message_template,
      },
      null
    );
    finalStatus = 'pending_human';

    await forwardToHuman(shop, message, emailCredentials);
  }
  // Resposta normal com dados do Shopify
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

  // 11. Incrementar contador de emails usados
  await incrementEmailsUsed(user.id);

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

Acesse: https://app.replyna.com/account

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
