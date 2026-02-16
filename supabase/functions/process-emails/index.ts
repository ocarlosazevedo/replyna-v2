/**
 * Edge Function: process-emails (Orquestrador com Workers Internos)
 *
 * Função principal que processa emails de todas as lojas ativas em paralelo.
 * Processa múltiplas lojas simultaneamente para maximizar throughput.
 *
 * Deve ser chamada via cron a cada 5 minutos.
 *
 * Fluxo:
 * 1. Busca lojas ativas com email configurado
 * 2. Processa lojas em paralelo (até MAX_CONCURRENT_SHOPS)
 * 3. Cada loja tem processamento independente com timeout próprio
 * 4. Agrega resultados e retorna estatísticas
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
  getActiveShopsWithEmail,
  getUserById,
  tryReserveCredit,
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
  generateHumanFallbackMessage,
  isSpamByPattern,
} from '../_shared/anthropic.ts';

// Constantes - ESCALA AUMENTADA
const MAX_CONCURRENT_SHOPS = 5; // Reduzido de 10 para 5 para evitar WORKER_LIMIT
const MAX_EMAILS_PER_SHOP = 10; // Emails IMAP por loja
const MAX_MESSAGES_PER_SHOP = 10; // Reduzido de 15 para 10
const MAX_CONCURRENT_MESSAGES = 3; // Mensagens em paralelo por loja
const MAX_DATA_REQUESTS = 3;
const MAX_EXECUTION_TIME_MS = 110000; // 110 segundos (limite real é 120s)

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
 * Verifica se a mensagem é um auto-responder (out-of-office, férias, etc.)
 */
function isAutoResponder(body: string, subject: string): boolean {
  const cleanBody = (body || '').toLowerCase();
  const cleanSubject = (subject || '').toLowerCase();

  // Padrões de auto-responder no ASSUNTO
  const autoReplySubjectPatterns = [
    /out of office/i,
    /automatic reply/i,
    /auto[- ]?reply/i,
    /fora do escrit[oó]rio/i,
    /resposta autom[aá]tica/i,
    /abwesenheitsnotiz/i,  // Alemão: out of office
    /automatische antwort/i,  // Alemão: automatic reply
    /absence/i,
    /vacation/i,
    /holiday/i,
  ];

  for (const pattern of autoReplySubjectPatterns) {
    if (pattern.test(cleanSubject)) {
      console.log('[AutoResponder] Detectado por assunto:', cleanSubject);
      return true;
    }
  }

  // Padrões de auto-responder no CONTEÚDO (férias, ausência, etc.)
  const autoReplyBodyPatterns = [
    // Português
    /estou (de|em) f[eé]rias/i,
    /estarei dispon[ií]vel (novamente |)a partir de/i,
    /retorno (em|no dia|dia)/i,
    /durante minha aus[eê]ncia/i,
    /n[aã]o (ser[aã]o|serão) lidos? (nem |ou |)encaminhados?/i,
    /responderei .{0,30} ap[oó]s meu retorno/i,
    /aus[eê]ncia programada/i,
    // Inglês
    /i('m| am) (currently )?(on |out of |away |on )vacation/i,
    /i('ll| will) be (back|available|returning) on/i,
    /during my absence/i,
    /will not be (read|monitored|checked)/i,
    /out of (the )?office/i,
    /away from (the )?office/i,
    /i('m| am) away/i,
    // Alemão
    /bin (derzeit |aktuell |)im urlaub/i,  // estou de férias
    /bin (ab |wieder |)(dem |).*? wieder erreichbar/i,  // estarei disponível novamente
    /w[aä]hrend meiner abwesenheit/i,  // durante minha ausência
    /e-?mails? werden? nicht (gelesen|weitergeleitet)/i,  // emails não serão lidos
    /nach meiner r[uü]ckkehr/i,  // após meu retorno
    // Padrões genéricos de assinatura de auto-reply
    /this is an auto(matic)?[- ]?(generated )?reply/i,
    /esta [eé] uma resposta autom[aá]tica/i,
    /dies ist eine automatische/i,
  ];

  for (const pattern of autoReplyBodyPatterns) {
    if (pattern.test(cleanBody)) {
      console.log('[AutoResponder] Detectado por conteúdo, padrão:', pattern.toString());
      return true;
    }
  }

  return false;
}

/**
 * Verifica se a mensagem é apenas um agradecimento/confirmação que não precisa de resposta
 */
function isAcknowledgmentMessage(body: string, subject: string): boolean {
  // Primeiro verificar se é auto-responder
  if (isAutoResponder(body, subject)) {
    return true;
  }

  const cleanBody = (body || '').toLowerCase().trim();
  const cleanSubject = (subject || '').toLowerCase().trim();

  // Remover saudações e assinaturas comuns para analisar apenas o conteúdo principal
  const bodyWithoutGreetings = cleanBody
    .replace(/^(ol[aá]|oi|bom dia|boa tarde|boa noite|hi|hello|hey)[,!.\s]*/gi, '')
    .replace(/(obrigad[oa]|valeu|grat[oa]|thanks|thank you|thx)[,!.\s]*$/gi, '')
    .replace(/^(atenciosamente|att|abraços?|regards)[,.\s]*.*/gim, '')
    .trim();

  // Remover assinaturas/nomes curtos do final (ex: "Wendy-", "- João", "Maria")
  const bodyWithoutSignature = cleanBody
    .replace(/[\r\n]+-+\s*$/g, '')
    .replace(/[\r\n]+[a-záàãéêíóôúç\s.\-]{2,30}[\r\n]*$/gi, '')
    .trim();

  // Se o corpo ficar muito curto após remover saudações, provavelmente é só agradecimento
  if (bodyWithoutGreetings.length < 20) {
    // Padrões de mensagens que são apenas agradecimento/confirmação
    const acknowledgmentPatterns = [
      /^(ok|okay|certo|entendi|perfeito|beleza|blz|show|top|massa|legal)\.?!?$/i,
      /^(obrigad[oa]|muito obrigad[oa]|valeu|grat[oa])\.?!?$/i,
      /^(thanks|thank you|thx|ty)\.?!?$/i,
      /^(recebi|recebido)\.?!?$/i,
      /^(sim|n[aã]o)\.?!?$/i,
      /^[\.\!\?\s]*$/,  // Mensagens vazias ou só pontuação
    ];

    for (const pattern of acknowledgmentPatterns) {
      if (pattern.test(cleanBody) || pattern.test(bodyWithoutGreetings)) {
        return true;
      }
    }
  }

  // Padrões de agradecimento com complemento (mensagem curta, < 100 chars)
  const textToCheck = bodyWithoutSignature.length < cleanBody.length ? bodyWithoutSignature : cleanBody;
  if (textToCheck.length < 100) {
    const shortAckPatterns = [
      /^obrigad[oa]\s+(pelo|pela|por|pelo retorno|pela resposta|pela ajuda|por responder)/i,
      /^thanks?\s+(for|for getting back|for your|for the)/i,
      /^thank you\s+(for|so much|very much|for getting back|for your|for the)/i,
      /^gracias\s+(por|por responder|por la|por su)/i,
      /^merci\s+(pour|beaucoup|de)/i,
      /^danke\s+(für|schön|sehr)/i,
      /^(muito obrigad[oa]|thanks a lot|many thanks|muchísimas gracias)/i,
      /^(valeu|vlw|thx|tks|ty)\b/i,
    ];

    for (const pattern of shortAckPatterns) {
      if (pattern.test(textToCheck) || pattern.test(cleanBody)) {
        console.log(`[isAcknowledgment] Detected short ack: "${textToCheck.substring(0, 50)}"`);
        return true;
      }
    }
  }

  return false;
}

/**
 * Verifica se a mensagem é uma notificação de sistema do Shopify (NÃO é uma mensagem de cliente)
 * Ex: chargebacks, disputas, alertas de pedido, notificações administrativas
 */
function isShopifySystemNotification(body: string): boolean {
  if (!body) return false;
  const lower = body.toLowerCase();

  const shopifyNotificationPatterns = [
    'abriu um estorno',
    'opened a chargeback',
    'filed a chargeback',
    'new order inquiry',
    'nova consulta de pedido',
    'dispute_evidences',
    'o banco devolveu',
    'the bank returned',
    'charged a fee for the chargeback',
    'taxa de estorno',
    'enviar resposta ao banco',
    'send response to bank',
    'coletamos evidências',
    'we collected evidence',
    'order risk analysis',
    'análise de risco do pedido',
    'high risk order',
    'pedido de alto risco',
    'payment was voided',
    'pagamento foi cancelado',
    'payout has been sent',
    'pagamento foi enviado',
  ];

  for (const pattern of shopifyNotificationPatterns) {
    if (lower.includes(pattern)) {
      console.log(`[isShopifySystemNotification] Matched pattern: "${pattern}"`);
      return true;
    }
  }

  return false;
}

// Set para controlar conversas em processamento (evitar duplicatas)
const conversationsInProcessing = new Set<string>();

// Map para armazenar imagens de emails por message_id durante o processamento
// Imagens são grandes demais para salvar no banco, então mantemos em memória
// IMPORTANTE: Cache é limitado para evitar memory leak em ambiente serverless
const MAX_CACHE_SIZE = 50; // Máximo de 50 emails com imagens em cache
const MAX_CACHE_AGE_MS = 5 * 60 * 1000; // 5 minutos de idade máxima

interface CachedImages {
  images: Array<{
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string;
    filename?: string;
  }>;
  timestamp: number;
}

const emailImagesCache = new Map<string, CachedImages>();

/**
 * Limpa entradas antigas do cache de imagens
 */
function cleanupImageCache(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of emailImagesCache.entries()) {
    if (now - value.timestamp > MAX_CACHE_AGE_MS) {
      emailImagesCache.delete(key);
      cleaned++;
    }
  }

  // Se ainda estiver acima do limite, remover os mais antigos
  if (emailImagesCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(emailImagesCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = entries.slice(0, emailImagesCache.size - MAX_CACHE_SIZE);
    for (const [key] of toRemove) {
      emailImagesCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[ImageCache] Limpeza: ${cleaned} entradas removidas, ${emailImagesCache.size} restantes`);
  }
}

// Tipos
interface ProcessingStats {
  shops_total: number;
  shops_processed: number;
  shops_failed: number;
  emails_received: number;
  emails_replied: number;
  emails_pending_credits: number;
  emails_forwarded_human: number;
  emails_spam: number;
  errors: number;
}

interface ShopStats {
  shop_id: string;
  shop_name: string;
  emails_received: number;
  emails_replied: number;
  emails_pending_credits: number;
  emails_forwarded_human: number;
  emails_spam: number;
  errors: number;
}

/**
 * Verifica se ainda há tempo disponível para processamento
 */
function hasTimeRemaining(startTime: number): boolean {
  return Date.now() - startTime < MAX_EXECUTION_TIME_MS;
}

/**
 * Processa itens em paralelo com limite de concorrência
 */
async function processInBatches<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number,
  startTime: number
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    // Verificar timeout antes de cada batch
    if (!hasTimeRemaining(startTime)) {
      console.log(`[Orchestrator] Timeout! Processados ${i} de ${items.length} items.`);
      break;
    }

    const batch = items.slice(i, i + concurrency);
    console.log(`[Orchestrator] Batch ${Math.floor(i / concurrency) + 1}: processando ${batch.length} items em paralelo`);

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
 * Handler principal da Edge Function
 */
Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const stats: ProcessingStats = {
    shops_total: 0,
    shops_processed: 0,
    shops_failed: 0,
    emails_received: 0,
    emails_replied: 0,
    emails_pending_credits: 0,
    emails_forwarded_human: 0,
    emails_spam: 0,
    errors: 0,
  };

  try {
    // Limpar cache de imagens antigas para evitar memory leak
    cleanupImageCache();

    console.log('[Orchestrator] Iniciando processamento de emails em escala...');

    // 1. Buscar lojas ativas
    const shops = await getActiveShopsWithEmail();
    stats.shops_total = shops.length;
    console.log(`[Orchestrator] Encontradas ${shops.length} lojas ativas`);

    if (shops.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhuma loja ativa encontrada',
          stats,
          duration_ms: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1.5 Ordenar lojas por quantidade de mensagens pendentes (menos primeiro)
    // Isso garante que lojas menores sejam processadas rapidamente
    try {
      const supabase = getSupabaseClient();
      const { data: pendingCounts, error: rpcError } = await supabase.rpc('get_pending_message_counts_by_shop');

      if (!rpcError && pendingCounts) {
        // Criar mapa de contagem por loja
        const countByShop: Record<string, number> = {};
        for (const row of pendingCounts as Array<{ shop_id: string; count: number }>) {
          countByShop[row.shop_id] = row.count;
        }

        // Ordenar lojas: menos pendentes primeiro
        shops.sort((a, b) => {
          const countA = countByShop[a.id] || 0;
          const countB = countByShop[b.id] || 0;
          return countA - countB;
        });

        console.log('[Orchestrator] Lojas ordenadas por mensagens pendentes (menos primeiro):');
        shops.slice(0, 5).forEach(s => {
          console.log(`  - ${s.name}: ${countByShop[s.id] || 0} pendentes`);
        });
      } else {
        console.log('[Orchestrator] Não foi possível ordenar lojas por pendentes, usando ordem padrão');
      }
    } catch (sortError) {
      console.log('[Orchestrator] Erro ao ordenar lojas:', sortError);
    }

    // 2. Processar lojas em paralelo
    console.log(`[Orchestrator] Processando até ${MAX_CONCURRENT_SHOPS} lojas em paralelo`);

    const results = await processInBatches(
      shops,
      async (shop) => {
        try {
          const shopStats = await processShop(shop, startTime);
          return { success: true, stats: shopStats };
        } catch (error) {
          console.error(`[Orchestrator] Erro na loja ${shop.name}:`, error);
          await logProcessingEvent({
            shop_id: shop.id,
            event_type: 'error',
            error_type: 'shop_processing',
            error_message: error instanceof Error ? error.message : 'Erro desconhecido',
          });
          return { success: false, error: error instanceof Error ? error.message : 'Erro' };
        }
      },
      MAX_CONCURRENT_SHOPS,
      startTime
    );

    // 3. Agregar resultados
    for (const result of results) {
      if (result.success && result.stats) {
        stats.shops_processed++;
        stats.emails_received += result.stats.emails_received;
        stats.emails_replied += result.stats.emails_replied;
        stats.emails_pending_credits += result.stats.emails_pending_credits;
        stats.emails_forwarded_human += result.stats.emails_forwarded_human;
        stats.emails_spam += result.stats.emails_spam;
        stats.errors += result.stats.errors;
      } else {
        stats.shops_failed++;
        stats.errors++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Orchestrator] Processamento concluído em ${duration}ms:`, stats);

    // Log de conclusão removido - event_type 'orchestrator_completed' não existe na tabela

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        duration_ms: duration,
        config: {
          max_concurrent_shops: MAX_CONCURRENT_SHOPS,
          max_emails_per_shop: MAX_EMAILS_PER_SHOP,
          max_messages_per_shop: MAX_MESSAGES_PER_SHOP,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Orchestrator] Erro fatal:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stats,
        duration_ms: Date.now() - startTime,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Processa uma loja específica
 */
async function processShop(shop: Shop, globalStartTime: number): Promise<ShopStats> {
  const stats: ShopStats = {
    shop_id: shop.id,
    shop_name: shop.name,
    emails_received: 0,
    emails_replied: 0,
    emails_pending_credits: 0,
    emails_forwarded_human: 0,
    emails_spam: 0,
    errors: 0,
  };

  console.log(`[Shop ${shop.name}] Iniciando processamento`);

  // 1. Decriptar credenciais de email
  const emailCredentials = await decryptEmailCredentials(shop);
  if (!emailCredentials) {
    console.log(`[Shop ${shop.name}] Sem credenciais de email válidas`);
    return stats;
  }

  // 2. Buscar emails não lidos via IMAP
  let emailStartDate: Date | null = null;
  if (shop.email_start_mode === 'from_integration_date' && shop.email_start_date) {
    emailStartDate = new Date(shop.email_start_date);
  }

  let incomingEmails: IncomingEmail[] = [];
  try {
    incomingEmails = await fetchUnreadEmails(emailCredentials, MAX_EMAILS_PER_SHOP, emailStartDate);
    console.log(`[Shop ${shop.name}] ${incomingEmails.length} emails não lidos`);
    stats.emails_received = incomingEmails.length;
  } catch (error) {
    console.error(`[Shop ${shop.name}] Erro IMAP:`, error);
    await updateShopEmailSync(shop.id, error instanceof Error ? error.message : 'Erro IMAP');
    throw error;
  }

  // 3. Salvar emails no banco
  const shopEmail = emailCredentials.smtp_user.toLowerCase();
  for (const email of incomingEmails) {
    if (email.from_email.toLowerCase() === shopEmail) continue;
    try {
      await saveIncomingEmail(shop.id, email);
    } catch (error) {
      console.error(`[Shop ${shop.name}] Erro ao salvar email:`, error);
      stats.errors++;
    }
  }

  // 4. Processar emails pendentes
  const allPendingMessages = await getPendingMessages(shop.id);
  const pendingMessages = allPendingMessages.slice(0, MAX_MESSAGES_PER_SHOP);
  console.log(`[Shop ${shop.name}] ${allPendingMessages.length} pendentes, processando ${pendingMessages.length}`);

  // Processar mensagens em paralelo
  for (let i = 0; i < pendingMessages.length; i += MAX_CONCURRENT_MESSAGES) {
    if (!hasTimeRemaining(globalStartTime)) {
      console.log(`[Shop ${shop.name}] Timeout global, parando`);
      break;
    }

    const batch = pendingMessages.slice(i, i + MAX_CONCURRENT_MESSAGES);

    const batchResults = await Promise.allSettled(
      batch.map(async (message) => {
        try {
          return await processMessage(shop, message, emailCredentials);
        } catch (error) {
          console.error(`[Shop ${shop.name}] Erro ao processar msg ${message.id}:`, error);
          await updateMessage(message.id, {
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Erro',
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

  console.log(`[Shop ${shop.name}] Concluído:`, stats);
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

  if (existing) return;

  let finalFromEmail = email.from_email;
  let finalFromName = email.from_name;

  // Verificar se é email de sistema Shopify (formulário de contato)
  const isShopifySystemEmail = finalFromEmail &&
    (finalFromEmail.toLowerCase().includes('mailer@shopify') ||
     finalFromEmail.toLowerCase().includes('@shopify.com'));

  // Se email é inválido OU é do sistema Shopify, tentar extrair email real do cliente
  if (!finalFromEmail || !finalFromEmail.includes('@') || isShopifySystemEmail) {
    // Tentar usar Reply-To como fallback
    if (email.reply_to && email.reply_to.includes('@') && !email.reply_to.toLowerCase().includes('@shopify')) {
      console.log(`[saveIncomingEmail] Usando Reply-To (${email.reply_to}) como fallback para from_email`);
      finalFromEmail = email.reply_to;
    } else {
      // Tentar extrair do corpo do email (formulários Shopify)
      // Passar tanto body_text quanto body_html para melhor extração
      const extracted = extractEmailFromShopifyContactForm(email.body_text || '', email.body_html || '');

      if (extracted) {
        console.log(`[saveIncomingEmail] Email extraído do formulário Shopify: ${extracted.email}, Nome: ${extracted.name}`);
        finalFromEmail = extracted.email;
        finalFromName = extracted.name || finalFromName;
      } else if (isShopifySystemEmail) {
        // Se é email do Shopify mas não conseguiu extrair, logar para debug
        console.log(`[saveIncomingEmail] AVISO: Email do Shopify (${email.from_email}) mas não conseguiu extrair email do cliente do corpo`);
      }
    }
  }

  // Se ainda não encontrou email válido, marcar como falha
  if (!finalFromEmail || !finalFromEmail.includes('@')) {
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
      error_message: 'Email do remetente inválido ou ausente',
      received_at: email.received_at.toISOString(),
    });

    return;
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

  // Armazenar imagens em cache para uso durante o processamento
  // Usamos message_id como chave pois é único
  if (email.images && email.images.length > 0) {
    emailImagesCache.set(email.message_id, {
      images: email.images,
      timestamp: Date.now(),
    });
    console.log(`[saveIncomingEmail] ${email.images.length} imagem(s) armazenada(s) em cache para message_id ${email.message_id}`);
  }
}

/**
 * Processa uma mensagem pendente
 */
async function processMessage(
  shop: Shop,
  message: Message & { conversation?: Conversation },
  emailCredentials: Awaited<ReturnType<typeof decryptEmailCredentials>>
): Promise<'replied' | 'pending_credits' | 'forwarded_human' | 'spam' | 'skipped' | 'acknowledgment'> {
  if (!emailCredentials) return 'skipped';

  const conversation = message.conversation as Conversation | undefined;
  if (!conversation) return 'skipped';

  // CONTROLE DE CONCORRÊNCIA: Verificar se já está processando esta conversa
  if (conversationsInProcessing.has(conversation.id)) {
    console.log(`[Shop ${shop.name}] Conversa ${conversation.id} já está sendo processada, pulando msg ${message.id}`);
    return 'skipped';
  }

  // Marcar conversa como em processamento
  conversationsInProcessing.add(conversation.id);

  try {
    return await processMessageInternal(shop, message, conversation, emailCredentials);
  } finally {
    // Sempre remover da lista ao terminar
    conversationsInProcessing.delete(conversation.id);
  }
}

/**
 * Lógica interna de processamento de mensagem (separada para controle de concorrência)
 */
async function processMessageInternal(
  shop: Shop,
  message: Message & { conversation?: Conversation },
  conversation: Conversation,
  emailCredentials: NonNullable<Awaited<ReturnType<typeof decryptEmailCredentials>>>
): Promise<'replied' | 'pending_credits' | 'forwarded_human' | 'spam' | 'skipped' | 'acknowledgment'> {
  // Skip Replyna forwarding notifications (emails that were forwarded to human support)
  const messageBody = message.body_text || '';
  const messageSubject = message.subject || '';
  const isForwardingNotification =
    messageBody.includes('Este email foi encaminhado automaticamente pelo Replyna') ||
    messageBody.includes('This email was automatically forwarded by Replyna') ||
    messageSubject.startsWith('[ENCAMINHADO]') ||
    messageSubject.startsWith('[FORWARDED]');

  if (isForwardingNotification) {
    console.log(`[processMessage] Message ${message.id} is a Replyna forwarding notification, skipping`);
    await updateMessage(message.id, {
      status: 'replied',
      error_message: 'Skipped - Replyna forwarding notification',
      processed_at: new Date().toISOString(),
    });
    return 'skipped';
  }

  // PRIMEIRO: Tentar extrair email de formulários Shopify se from_email está vazio ou é do sistema Shopify
  const fromLower = (message.from_email || '').toLowerCase();
  const isEmptyOrInvalid = !message.from_email || !message.from_email.includes('@');
  const isShopifySystem = fromLower.includes('mailer@shopify') || fromLower.includes('@shopify.com');

  if (isEmptyOrInvalid || isShopifySystem) {
    // Tentar extrair email do cliente do corpo da mensagem (formulários Shopify)
    const extracted = extractEmailFromShopifyContactForm(message.body_text || '', message.body_html || '');

    if (extracted && extracted.email) {
      console.log(`[processMessage] Email extraído do formulário: ${extracted.email}, Nome: ${extracted.name}`);
      message.from_email = extracted.email;
      if (extracted.name && !message.from_name) {
        message.from_name = extracted.name;
      }

      // Atualizar no banco
      await updateMessage(message.id, {
        from_email: extracted.email,
        from_name: extracted.name || message.from_name,
      });

      // Atualizar email do cliente na conversa
      if (!conversation.customer_email || conversation.customer_email === 'mailer@shopify.com' ||
          conversation.customer_email.includes('@shopify.com') || conversation.customer_email === 'unknown@invalid.local') {
        await updateConversation(conversation.id, {
          customer_email: extracted.email,
          customer_name: extracted.name || conversation.customer_name,
        });
      }
    } else if (isEmptyOrInvalid) {
      // Email inválido e não conseguiu extrair de formulário
      await updateMessage(message.id, {
        status: 'failed',
        category: 'spam',
        error_message: 'Email do remetente inválido',
      });
      return 'skipped';
    } else {
      // É email Shopify mas não conseguiu extrair - marcar como falha
      await updateMessage(message.id, {
        status: 'failed',
        category: 'spam',
        error_message: 'Formulário Shopify: não foi possível extrair email do cliente',
      });
      return 'skipped';
    }
  }

  // Outros padrões de emails de sistema que devem ser ignorados
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
    'support@shopify',
    'notifications@shopify',
    // Outros sistemas
    '@paypal.com',
    '@stripe.com',
  ];

  // Verificar se é outro tipo de email de sistema (não Shopify, já tratado acima)
  const updatedFromLower = message.from_email.toLowerCase();
  if (systemEmailPatterns.some(pattern => updatedFromLower.includes(pattern))) {
    // Outros emails de sistema - ignorar
    await updateMessage(message.id, {
      status: 'failed',
      category: 'spam',
      error_message: 'Email de sistema ignorado',
    });
    return 'skipped';
  }

  await updateMessage(message.id, { status: 'processing' });

  const startTime = Date.now();

  // 1. Limpar corpo do email (movido para antes do crédito para permitir spam check)
  let cleanBody = cleanEmailBody(message.body_text || '', message.body_html || '');

  if ((!cleanBody || cleanBody.trim().length < 3) && message.subject && message.subject.trim().length > 3) {
    cleanBody = message.subject;
  }

  if (!cleanBody || cleanBody.trim().length < 3) {
    await updateMessage(message.id, {
      status: 'failed',
      category: 'spam', // Emails vazios são tratados como spam
      error_message: 'Corpo e assunto do email vazios',
    });
    return 'skipped';
  }

  // 1.05 Detectar notificações de sistema do Shopify (chargeback, disputa, alertas admin)
  // NÃO são mensagens de cliente - ignorar sem enviar resposta
  const originalBodyText = message.body_text || message.body_html || '';
  if (isShopifySystemNotification(originalBodyText)) {
    console.log(`[Shop ${shop.name}] Msg ${message.id} is Shopify system notification, skipping`);
    await updateMessage(message.id, {
      status: 'replied',
      error_message: 'Skipped - Shopify system notification (not a customer message)',
      processed_at: new Date().toISOString(),
    });
    return 'skipped';
  }

  // 1.1 PRÉ-CLASSIFICAÇÃO: Detectar spam por padrões ANTES de gastar créditos
  if (isSpamByPattern(message.subject || '', cleanBody)) {
    console.log(`[Shop ${shop.name}] Msg ${message.id} detectada como spam por padrão (pré-AI)`);
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
        body_preview: cleanBody.substring(0, 150),
        reason: 'Pre-AI pattern-based spam detection',
      },
    });

    return 'spam';
  }

  // 2. Verificar créditos
  const user = await getUserById(shop.user_id);
  if (!user) {
    await updateMessage(message.id, {
      status: 'failed',
      category: 'duvidas_gerais', // Categoria padrão para erros de sistema
      error_message: 'Usuário não encontrado',
    });
    return 'skipped';
  }

  // Verificar se o usuário tem assinatura ativa
  if (user.status !== 'active') {
    console.log(`[Shop ${shop.name}] Usuário ${user.id} com status '${user.status}' - assinatura inativa, pulando msg ${message.id}`);
    await updateMessage(message.id, {
      status: 'failed',
      error_message: `Assinatura inativa (status: ${user.status})`,
    });
    return 'skipped';
  }

  // Operação atômica: verifica E reserva o crédito em uma única transação
  // Isso evita race condition quando múltiplos emails são processados em paralelo
  const creditReserved = await tryReserveCredit(user.id);
  if (!creditReserved) {
    await updateMessage(message.id, {
      status: 'pending_credits',
      category: 'duvidas_gerais', // Categoria padrão temporária até ter créditos
    });
    await handleCreditsExhausted(shop, user, message);
    return 'pending_credits';
  }

  // 2.1 Verificar se é apenas uma mensagem de agradecimento/confirmação
  if (isAcknowledgmentMessage(cleanBody, message.subject || '')) {
    console.log(`[Shop ${shop.name}] Msg ${message.id} é agradecimento, marcando como replied sem responder`);
    await updateMessage(message.id, {
      status: 'replied',
      category: 'acknowledgment',
      error_message: 'Mensagem de agradecimento - não requer resposta',
      processed_at: new Date().toISOString(),
    });

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'acknowledgment_skipped',
      event_data: {
        body_preview: cleanBody.substring(0, 100),
        reason: 'Mensagem de agradecimento/confirmação',
      },
    });

    return 'acknowledgment';
  }

  // 2.2 Verificar se há loop de auto-responder (muitas respostas em pouco tempo)
  const supabase = getSupabaseClient();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data: recentOutboundMessages, error: loopCheckError } = await supabase
    .from('messages')
    .select('id, created_at')
    .eq('conversation_id', conversation.id)
    .eq('direction', 'outbound')
    .gte('created_at', twoHoursAgo)
    .order('created_at', { ascending: false });

  if (!loopCheckError && recentOutboundMessages && recentOutboundMessages.length >= 5) {
    console.log(`[Shop ${shop.name}] LOOP DETECTADO: ${recentOutboundMessages.length} respostas nas últimas 2h para conversa ${conversation.id}`);
    await updateMessage(message.id, {
      status: 'replied',
      category: 'auto-responder-loop',
      error_message: `Loop detectado: ${recentOutboundMessages.length} respostas em 2h - não respondendo para evitar spam`,
      processed_at: new Date().toISOString(),
    });

    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'loop_detected',
      event_data: {
        recent_outbound_count: recentOutboundMessages.length,
        reason: 'Possível loop de auto-responder detectado',
      },
    });

    return 'loop_detected';
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

  // 4.1 Se for spam
  if (classification.category === 'spam') {
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

    // Tentar buscar com email do remetente primeiro
    shopifyData = await getOrderDataForAI(
      shopifyCredentials,
      message.from_email,
      orderNumber
    );

    // Se não encontrou e tem número do pedido, tentar com emails alternativos mencionados no corpo
    if (!shopifyData && orderNumber) {
      // Extrair emails mencionados no corpo da mensagem (cliente pode ter usado outro email)
      const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
      const mentionedEmails = cleanBody.match(emailPattern) || [];

      // Filtrar emails que são diferentes do remetente
      const alternativeEmails = mentionedEmails
        .filter(email => email.toLowerCase() !== message.from_email.toLowerCase())
        .filter((email, index, self) => self.indexOf(email) === index); // Remover duplicados

      for (const altEmail of alternativeEmails) {
        console.log(`[Shop ${shop.name}] Tentando email alternativo: ${altEmail}`);
        shopifyData = await getOrderDataForAI(
          shopifyCredentials,
          altEmail,
          orderNumber
        );
        if (shopifyData) {
          console.log(`[Shop ${shop.name}] Pedido encontrado com email alternativo: ${altEmail}`);
          break;
        }
      }
    }

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
      classification.language
    );
    finalStatus = 'pending_human';
    await forwardToHuman(shop, message, emailCredentials);
  } else if (!shopifyData && needsOrderData) {
    // CORREÇÃO: Verificar se já temos número de pedido antes de pedir ao cliente
    const knownOrderNumber = conversation.shopify_order_id
      || extractOrderNumber(message.subject || '')
      || extractOrderNumber(cleanBody)
      || extractOrderNumber(message.body_text || '');

    if (knownOrderNumber) {
      // Temos número de pedido mas Shopify não retornou dados - criar contexto mínimo
      // para que a IA responda com o que temos (NUNCA pedir tracking ao cliente)
      shopifyData = {
        order_number: knownOrderNumber.startsWith('#') ? knownOrderNumber : `#${knownOrderNumber}`,
        order_date: '',
        order_status: '',
        order_total: '',
        tracking_number: null,
        tracking_url: null,
        fulfillment_status: null,
        items: [],
        customer_name: conversation.customer_name || message.from_name || null,
      };
      console.log(`[process-emails] Order number ${knownOrderNumber} found but Shopify data unavailable, using minimal context`);

      if (!conversation.shopify_order_id) {
        await updateConversation(conversation.id, {
          shopify_order_id: knownOrderNumber,
        });
      }
      // NÃO set responseResult - vai cair no else abaixo para generateResponse
    } else if (conversation.data_request_count < MAX_DATA_REQUESTS) {
      // Sem número de pedido - pedir APENAS número do pedido (nunca tracking)
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
    } else {
      // MAX_DATA_REQUESTS excedido sem número de pedido - escalar para humano
      responseResult = await generateHumanFallbackMessage(
        {
          name: shop.name,
          attendant_name: shop.attendant_name,
          support_email: shop.support_email,
          tone_of_voice: shop.tone_of_voice,
          fallback_message_template: shop.fallback_message_template,
        },
        null,
        classification.language
      );
      finalStatus = 'pending_human';
      await forwardToHuman(shop, message, emailCredentials);
    }
  }

  // @ts-ignore - responseResult pode não estar inicializado se caiu nos branches de shopifyData
  if (!responseResult) {
    // Buscar imagens do cache se disponíveis
    const cachedEntry = message.message_id ? emailImagesCache.get(message.message_id) : undefined;
    const cachedImages = cachedEntry?.images;
    if (cachedImages && cachedImages.length > 0) {
      console.log(`[processMessage] ${cachedImages.length} imagem(s) encontrada(s) no cache para análise visual`);
    }

    // Lógica de retenção: incrementar contador se for cancelamento/devolução
    let retentionContactCount = conversation.retention_contact_count || 0;
    if (classification.category === 'troca_devolucao_reembolso') {
      retentionContactCount += 1;
      await updateConversation(conversation.id, {
        retention_contact_count: retentionContactCount,
      });
      console.log(`[processMessage] Retenção: contato #${retentionContactCount} para conversa ${conversation.id}`);
    }

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
        support_email: shop.support_email,
        retention_coupon_code: shop.retention_coupon_code,
        retention_coupon_type: shop.retention_coupon_type,
        retention_coupon_value: shop.retention_coupon_value,
      },
      message.subject || '',
      cleanBody,
      classification.category,
      conversationHistory,
      shopifyData,
      classification.language,
      retentionContactCount,
      [], // additionalOrders
      cachedImages || [], // imagens do email para análise visual
      classification.sentiment || 'calm',
      conversation.status, // para loop detection pular exchange_count se pending_human
    );

    // Se a IA detectou que é terceiro contato de cancelamento, encaminhar para humano
    if (responseResult.forward_to_human) {
      finalStatus = 'pending_human';
      await forwardToHuman(shop, message, emailCredentials);
    }

    // Limpar imagens do cache após processamento
    if (message.message_id) {
      emailImagesCache.delete(message.message_id);
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

  // 10.1 Verificar cobrança de extras
  await checkAndChargeExtraEmails(user.id, shop.id);

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
    console.log(`[Billing] Usuário ${userId} atingiu ${result.new_pending_count} emails extras - cobrando pacote`);

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
        console.log(`[Billing] Pacote de emails extras cobrado: ${chargeResult.invoice_id}`);

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
        console.error('[Billing] Erro ao cobrar emails extras:', chargeResult.error);

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
      console.error('[Billing] Erro ao chamar charge-extra-emails:', error);

      await logProcessingEvent({
        shop_id: shopId,
        event_type: 'extra_emails_charge_error',
        error_message: error instanceof Error ? error.message : 'Erro desconhecido',
        event_data: { user_id: userId },
      });
    }
  }
}
