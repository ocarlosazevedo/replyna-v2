/**
 * Cliente Anthropic (Claude) para Edge Functions
 * Usado para classificação e geração de respostas
 */

// Tipos
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ClassificationResult {
  category:
    | 'spam'
    | 'duvidas_gerais'
    | 'rastreio'
    | 'troca_devolucao_reembolso'
    | 'edicao_pedido'
    | 'suporte_humano';
  confidence: number;
  language: string;
  order_id_found: string | null;
  summary: string;
}

export interface ResponseGenerationResult {
  response: string;
  tokens_input: number;
  tokens_output: number;
  forward_to_human?: boolean;
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-3-haiku-20240307'; // Haiku 3.0 (modelo atualizado)
const MAX_TOKENS = 500;

/**
 * Remove formatação markdown do texto
 */
function stripMarkdown(text: string): string {
  return text
    // Remove linhas de cabeçalho de email que Claude às vezes inclui
    .replace(/^Subject:\s*.+\r?\n/im, '')
    .replace(/^To:\s*.+\r?\n/im, '')
    .replace(/^From:\s*.+\r?\n/im, '')
    .replace(/^Date:\s*.+\r?\n/im, '')
    // Remove bold (**text** ou __text__)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    // Remove italic (*text* ou _text_)
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove headers (### text)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bullet points (- item ou * item)
    .replace(/^[\-\*]\s+/gm, '• ')
    // Remove links [text](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Limpar espaços extras
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Remove pensamentos internos, formatação incorreta e identificação de IA da resposta
 */
function cleanAIResponse(text: string): string {
  let cleaned = text;

  // Remover aspas no início e fim da mensagem
  cleaned = cleaned.replace(/^["']+/, '').replace(/["']+$/, '');

  // Remover pensamentos internos comuns que vazam
  const internalThoughtsPatterns = [
    /^Entendi que (preciso|devo|vou)[^.]*\.\s*/i,
    /^Com base nas informações[^.]*\.\s*/i,
    /^Analisando (a solicitação|o pedido|a mensagem)[^.]*\.\s*/i,
    /^Vou (verificar|analisar|processar)[^.]*\.\s*/i,
    /^Preciso (verificar|analisar|processar)[^.]*\.\s*/i,
    /^(Deixe-me|Let me) (verificar|analisar|check|analyze)[^.]*\.\s*/i,
    /^(Primeiro|First),?\s+(vou|let me|I'll)[^.]*\.\s*/i,
    /^(Okay|Ok|Certo),?\s+(vou|let me|I'll)[^.]*\.\s*/i,
    /^Como (assistente|atendente)[^.]*,?\s*/i,
    /^De acordo com (as informações|os dados)[^.]*,?\s*/i,
  ];

  for (const pattern of internalThoughtsPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // CRÍTICO: Remover qualquer identificação de IA/assistente virtual da assinatura
  // Patterns que identificam como IA/robô/assistente virtual
  const aiIdentityPatterns = [
    /Assistente\s+Virtual/gi,
    /Virtual\s+Assistant/gi,
    /AI\s+Assistant/gi,
    /Assistente\s+de\s+IA/gi,
    /Atendente\s+Virtual/gi,
    /Bot\s+de\s+Atendimento/gi,
    /Chatbot/gi,
    /Assistente\s+Automatizado/gi,
    /Automated\s+Assistant/gi,
    /Suporte\s+Automatizado/gi,
    /Automated\s+Support/gi,
  ];

  for (const pattern of aiIdentityPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Remover linhas que parecem ser instruções internas
  const lines = cleaned.split('\n');
  const cleanedLines = lines.filter(line => {
    const lowerLine = line.toLowerCase().trim();
    // Remover linhas que são claramente instruções internas
    if (lowerLine.startsWith('nota:') || lowerLine.startsWith('note:')) return false;
    if (lowerLine.startsWith('importante:') || lowerLine.startsWith('important:')) return false;
    if (lowerLine.startsWith('observação:')) return false;
    if (lowerLine.includes('[forward_to_human]')) return false;  // Já tratado separadamente
    return true;
  });

  cleaned = cleanedLines.join('\n').trim();

  // Limpar espaços duplos que podem ter ficado após remoções
  cleaned = cleaned.replace(/  +/g, ' ');
  cleaned = cleaned.replace(/\n\n\n+/g, '\n\n');

  // Garantir que não começa com aspas
  cleaned = cleaned.replace(/^["']+/, '');

  return cleaned;
}

/**
 * Obtém a API key do ambiente
 */
function getApiKey(): string {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY não está configurada. ' +
        'Adicione nas variáveis de ambiente.'
    );
  }
  return key;
}

/**
 * Faz uma requisição para a API do Claude
 */
async function callClaude(
  systemPrompt: string,
  messages: ClaudeMessage[],
  maxTokens: number = MAX_TOKENS
): Promise<ClaudeResponse> {
  const apiKey = getApiKey();

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro na API do Claude: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Classifica um email recebido
 */
export async function classifyEmail(
  emailSubject: string,
  emailBody: string,
  conversationHistory: Array<{ role: 'customer' | 'assistant'; content: string }>
): Promise<ClassificationResult> {
  const systemPrompt = `You are an email classifier for e-commerce customer support.

Your task is to analyze the email and return a JSON with:
1. category: email category (one of the 5 options below)
2. confidence: classification confidence (0.0 to 1.0)
3. language: EXACT language of the customer's email (VERY IMPORTANT - detect correctly!)
4. order_id_found: order number if mentioned (e.g., #12345, 12345), or null
5. summary: 1-line summary of what the customer wants

LANGUAGE DETECTION (CRITICAL):
- Analyze the customer's text carefully and detect the EXACT language used
- Common languages:
  - "pt-BR" for Brazilian Portuguese (olá, obrigado, quero, onde, está, cancelamento, pedido)
  - "es" for Spanish (hola, pedido, cancelar, gracias, quiero, donde, está)
  - "en" for English (hello, order, cancel, thanks, want, where, tracking)
  - "it" for Italian (ciao, ordine, annullare, grazie, voglio, dove, tracciamento)
  - "fr" for French (bonjour, commande, annuler, merci, je veux, où, suivi)
  - "de" for German (hallo, bestellung, stornieren, danke, ich möchte, wo, sendungsverfolgung)
  - "pl" for Polish (cześć, dzień dobry, zamówienie, anulować, dziękuję, chcę, gdzie, śledzenie)
  - "nl" for Dutch (hallo, bestelling, annuleren, bedankt, ik wil, waar, tracking)
  - "ro" for Romanian (bună, comandă, anulare, mulțumesc, vreau, unde, urmărire)
- For ANY other language not listed, use the ISO 639-1 code (e.g., "sv" for Swedish, "da" for Danish, etc.)
- NEVER assume any language by default - analyze the actual text
- If the email contains multiple languages, use the PRIMARY language the customer wrote in

=== AVAILABLE CATEGORIES (ONLY 6) ===

1. spam
   Marketing emails, unsolicited service offers from agencies/consultants/developers.
   Examples: SEO services, store development, growth hacking, sales consulting, "increase your revenue" offers.
   Signals: "Marketing Consultant", "Shopify Developer", "Growth Specialist", "free consultation", "schedule a meeting".
   Also: Generic emails not about a specific order ("Is your store active?", "Can I ask you something?").
   DO NOT RESPOND to spam emails.

2. duvidas_gerais
   General questions about the store, products, or policies - WITHOUT mentioning a specific existing order.
   Examples: "Do you ship to my country?", "What sizes are available?", "Is this product in stock?",
   "What's your return policy?", "How long does shipping take?", "Is your store reliable?", "Do you accept PayPal?"
   Key: Customer is asking BEFORE making a purchase or has general questions.

3. rastreio
   Questions about an EXISTING order: tracking, status, location, delivery estimate.
   Examples: "Where is my order?", "Tracking code?", "When will it arrive?", "Order status?", "Why is delivery delayed?"
   Key: Customer already made a purchase and wants to know about their order.

4. troca_devolucao_reembolso
   Requests for exchange, return, or refund for orders that have ALREADY BEEN SHIPPED OR DELIVERED.
   Examples: "I received the product and want to return it", "Product arrived damaged", "Wrong item received",
   "I want a refund for what I received", "Exchange for different size (already delivered)", "Money back please".
   Key: The order has ALREADY BEEN SHIPPED or DELIVERED and customer wants to undo/return/get money back.
   IMPORTANT: If the order has NOT been shipped yet and customer wants to cancel → use "edicao_pedido" instead.

5. edicao_pedido
   Requests to MODIFY/EDIT an existing order (NOT cancellation - cancellations go to troca_devolucao_reembolso).
   This includes ONLY:
   - MODIFICATIONS: "Change my order", "Add/remove an item", "Change size/color", "Update shipping address",
     "Change quantity", "I ordered wrong size, want to change before shipping".
   Key: Customer wants to MODIFY something in the order (change address, change item, change size, etc.)

   IMPORTANT: CANCELLATIONS ARE NOT edicao_pedido!
   - If customer says "cancel", "cancelar", "don't want anymore" → use troca_devolucao_reembolso
   - edicao_pedido is ONLY for modifications (change address, change size, add item, etc.)

6. suporte_humano
   ONLY for cases with EXPLICIT LEGAL THREATS (lawyer, lawsuit, legal action, consumer protection agency).
   These cases need human escalation.
   NOT for: angry customers, complaints, requests to "speak with a human" (respond normally to these).

=== SPAM DETECTION (CRITICAL - MUST CLASSIFY CORRECTLY) ===

CLASSIFY AS SPAM (confidence 0.95+) - THESE ARE NOT REAL CUSTOMERS:

1. SERVICE OFFERS / CONSULTING / MARKETING:
   - Anyone offering to improve the store, website, design, speed, conversion
   - "I noticed opportunities", "I can help improve", "brief consultation"
   - "grow your business", "increase revenue", "boost sales", "improve experience"
   - Mentions: SEO, marketing, development, design, consulting, optimization
   - Phrases: "I work with Shopify businesses", "I can share improvements", "quick list of improvements"
   - Anyone identifying as: consultant, developer, specialist, agency, expert, freelancer

2. COLD OUTREACH / SALES PITCHES:
   - Emails that START with compliments about the store then offer services
   - "I took a look at your store and noticed..."
   - "Would you be open to a brief call/consultation?"
   - "I can help you without relying on ads"
   - Generic emails that could be sent to any store (not specific to a purchase)

3. SYSTEM/AUTOMATED EMAILS:
   - Delivery Status Notification, Mail Delivery Subsystem, mailer-daemon
   - Undeliverable, Delivery Failure, Mail delivery failed
   - Bounce notifications, postmaster messages

4. OTHER SPAM SIGNALS:
   - No mention of ANY specific order or purchase they made
   - Email sounds like a template (could be sent to hundreds of stores)
   - Offering "free audit", "free consultation", "free analysis"
   - Partnership proposals, collaboration offers
   - B2B sales pitches

REAL CUSTOMERS (NOT spam) - ONLY these should NOT be spam:
- Asking about THEIR ORDER (mentions order number, tracking, specific purchase THEY made)
- Questions about products they want to BUY FROM THIS STORE
- Complaints about an order THEY placed
- Returns/refunds for products THEY purchased

IMPORTANT: If the email does NOT mention a specific order or purchase the person made,
and instead offers services or "help" to improve the store → IT IS SPAM.

When in doubt: if they're offering something TO the store (services, help, consultation)
rather than asking about something FROM the store (their order, products) → SPAM.

=== CLASSIFICATION RULES ===
- When in doubt between duvidas_gerais and rastreio: if no order number/purchase mentioned → duvidas_gerais
- Angry customer → still classify by the actual request (rastreio, troca_devolucao_reembolso, etc.)
- "I want to speak with a human" → classify by the underlying issue, respond normally
- ONLY use suporte_humano for EXPLICIT legal threats

=== AMBIGUOUS MESSAGES (IMPORTANT) ===
- Short messages like "my order", "help", "hello" → classify as "rastreio" (need more info)
- Customer mentions order but doesn't say what they want → classify as "rastreio" (info request)
- If unsure between rastreio and any other category → prefer "rastreio"
- The response generator will ask clarifying questions if needed

=== CANCELLATION CLASSIFICATION (CRITICAL) ===
When customer wants to CANCEL an order:
ALL cancellation requests MUST be classified as "troca_devolucao_reembolso", regardless of shipping status.

Examples:
- "Quero cancelar, foi engano" → troca_devolucao_reembolso
- "Cancel my order please" → troca_devolucao_reembolso
- "I received it but want to return" → troca_devolucao_reembolso
- "Product arrived damaged, refund please" → troca_devolucao_reembolso
- "Quero cancelar antes de enviar" → troca_devolucao_reembolso
- "Cancel order not shipped yet" → troca_devolucao_reembolso

The response generator will handle different scenarios based on fulfillment status.

Respond ONLY with the JSON, no additional text.`;

  // Montar histórico para contexto
  let historyText = '';
  if (conversationHistory.length > 0) {
    historyText =
      '\n\nHISTÓRICO DA CONVERSA:\n' +
      conversationHistory
        .map((m) => `${m.role === 'customer' ? 'CLIENTE' : 'LOJA'}: ${m.content}`)
        .join('\n');
  }

  const userMessage = `ASSUNTO: ${emailSubject || '(sem assunto)'}

CORPO DO EMAIL:
${emailBody || '(vazio)'}
${historyText}

Classifique este email e retorne o JSON.`;

  const response = await callClaude(systemPrompt, [{ role: 'user', content: userMessage }], 300);

  // Extrair texto da resposta
  const responseText = response.content[0]?.text || '{}';

  // Fazer parse do JSON
  try {
    // Limpar possíveis caracteres extras
    const jsonStr = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(jsonStr) as ClassificationResult;

    // Validar categoria
    const validCategories = [
      'spam',
      'duvidas_gerais',
      'rastreio',
      'troca_devolucao_reembolso',
      'edicao_pedido',
      'suporte_humano',
    ];
    if (!validCategories.includes(result.category)) {
      result.category = 'duvidas_gerais';
    }

    // Validar confidence
    result.confidence = Math.max(0, Math.min(1, result.confidence || 0.5));

    return result;
  } catch {
    // Fallback se não conseguir fazer parse
    return {
      category: 'duvidas_gerais',
      confidence: 0.5,
      language: 'en',
      order_id_found: null,
      summary: 'Could not classify the email',
    };
  }
}

/**
 * Gera uma resposta para o cliente
 */
export async function generateResponse(
  shopContext: {
    name: string;
    attendant_name: string;
    tone_of_voice: string;
    store_description: string | null;
    delivery_time: string | null;
    dispatch_time: string | null;
    warranty_info: string | null;
    signature_html: string | null;
    is_cod?: boolean;
    support_email?: string;
  },
  emailSubject: string,
  emailBody: string,
  category: string,
  conversationHistory: Array<{ role: 'customer' | 'assistant'; content: string }>,
  shopifyData: {
    order_number: string | null;
    order_date: string | null;
    order_status: string | null;
    order_total: string | null;
    tracking_number: string | null;
    tracking_url: string | null;
    fulfillment_status: string | null;
    items: Array<{ name: string; quantity: number }>;
    customer_name: string | null;
  } | null,
  language: string = 'en',
  retentionContactCount: number = 0
): Promise<ResponseGenerationResult> {
  // Mapear tom de voz para instruções
  const toneInstructions: Record<string, string> = {
    professional: 'Use tom profissional e formal. Seja direto e objetivo.',
    friendly: 'Use tom amigável e acolhedor. Seja empático e caloroso.',
    casual: 'Use tom casual e descontraído. Seja informal mas respeitoso.',
    enthusiastic: 'Use tom entusiasmado e positivo. Mostre energia e disposição.',
  };

  const tone = toneInstructions[shopContext.tone_of_voice] || toneInstructions.friendly;

  // Montar contexto do Shopify
  let shopifyContext = '';
  if (shopifyData && shopifyData.order_number) {
    shopifyContext = `
DADOS DO PEDIDO DO CLIENTE:
- Número do pedido: ${shopifyData.order_number}
- Data: ${shopifyData.order_date || 'N/A'}
- Valor total: ${shopifyData.order_total || 'N/A'}
- Status de envio: ${shopifyData.fulfillment_status || 'N/A'}
- Código de rastreio: ${shopifyData.tracking_number || 'Ainda não disponível'}
- Link de rastreio: ${shopifyData.tracking_url || 'N/A'}
- Itens: ${shopifyData.items.map((i) => `${i.name} (x${i.quantity})`).join(', ') || 'N/A'}
- Nome do cliente: ${shopifyData.customer_name || 'N/A'}`;
  }

  // Montar informações da loja
  let storeInfo = `
INFORMAÇÕES DA LOJA:
- Nome: ${shopContext.name}
- Seu nome (atendente): ${shopContext.attendant_name}`;

  if (shopContext.store_description) {
    storeInfo += `\n- Sobre a loja: ${shopContext.store_description}`;
  }
  if (shopContext.delivery_time) {
    storeInfo += `\n- Prazo de entrega: ${shopContext.delivery_time}`;
  }
  if (shopContext.dispatch_time) {
    storeInfo += `\n- Prazo de despacho: ${shopContext.dispatch_time}`;
  }
  if (shopContext.warranty_info) {
    storeInfo += `\n- Garantia: ${shopContext.warranty_info}`;
  }

  // Mapear idioma para instruções
  const languageInstructions: Record<string, string> = {
    'pt-BR': 'Responda em Português do Brasil.',
    'pt': 'Responda em Português.',
    'en': 'Respond in English.',
    'es': 'Responde en Español.',
    'fr': 'Répondez en Français.',
    'de': 'Antworten Sie auf Deutsch.',
    'it': 'Rispondi in Italiano.',
  };

  const languageInstruction = languageInstructions[language] || `Responda no mesmo idioma do cliente (${language}).`;

  // Instruções específicas para Cash on Delivery (COD)
  let codInstructions = '';
  if (shopContext.is_cod) {
    codInstructions = `
IMPORTANTE - MODELO CASH ON DELIVERY (COD):
Esta loja opera no modelo de pagamento na entrega (Cash on Delivery / COD).
O cliente paga apenas quando recebe o produto.

Regras para COD - DEPENDE DO STATUS DO PEDIDO:

1. Se o pedido AINDA NÃO FOI ENTREGUE (Status: "Aguardando envio" ou "Enviado" mas não entregue):
   - O cliente AINDA NÃO PAGOU
   - Para cancelar: o pedido será cancelado sem custo
   - Para recusar: basta recusar na entrega, não há valor a devolver
   - NÃO mencione reembolso pois não houve pagamento

2. Se o pedido JÁ FOI ENTREGUE (cliente já recebeu e pagou na entrega):
   - O cliente JÁ PAGOU no ato da entrega
   - Se quiser devolver: TEM DIREITO ao reembolso após devolução do produto
   - Encaminhe para o email de suporte para processar a devolução e reembolso
   - NUNCA diga que "não há valor a ser reembolsado" se o cliente já recebeu/pagou

Como identificar se o cliente já recebeu:
- O cliente diz que está "devolvendo", "enviando de volta", "já recebi"
- O cliente menciona problemas com o produto recebido
- O cliente fala sobre reembolso após ter o produto em mãos

`;
  }

  const systemPrompt = `Você é ${shopContext.attendant_name}, responsável pelo atendimento da loja ${shopContext.name}.

${tone}
${codInstructions}
${storeInfo}
${shopifyContext}

CATEGORIA DO EMAIL: ${category}

REGRA CRÍTICA - IDENTIDADE (NUNCA VIOLAR - PRIORIDADE MÁXIMA):
- NUNCA diga que você é uma IA, assistente virtual, robô, automação, bot ou atendimento automatizado
- NUNCA mencione "inteligência artificial", "sistema automático", "sou um programa" ou termos similares
- Se perguntarem se você é humano/robô/IA, responda de forma natural e evasiva (ex: "Sou a ${shopContext.attendant_name}, responsável pelo atendimento aqui na ${shopContext.name}!")
- Aja 100% como um atendente humano real - com personalidade, empatia e naturalidade
- NUNCA se apresente dizendo "sou a assistente virtual" ou similar
- NA ASSINATURA: Use APENAS seu nome "${shopContext.attendant_name}" - NUNCA adicione "Assistente Virtual", "Virtual Assistant", "AI", "Bot" ou qualquer identificação de automação
- ASSINATURA CORRETA: "${shopContext.attendant_name}" ou "${shopContext.attendant_name}\n${shopContext.name}"
- ASSINATURA ERRADA (NUNCA USE): "${shopContext.attendant_name}\nAssistente Virtual ${shopContext.name}"

REGRAS IMPORTANTES:
1. Responda de forma clara e objetiva
2. Use as informações do pedido quando disponíveis
3. Se não souber algo específico, diga que vai verificar
4. Não invente informações - use apenas os dados fornecidos
5. Máximo 400 palavras
6. NÃO use markdown (nada de **, ##, *, listas com -, etc.)
7. NÃO use formatação especial - escreva como um email normal em texto puro
8. Assine apenas com seu nome no final
9. IDIOMA: ${languageInstruction}
10. REGRA CRÍTICA - SUBSTITUIÇÃO DE PLACEHOLDERS:
    - Os exemplos abaixo contêm placeholders entre colchetes como [Nome], [número], [código/link de rastreio], [Assinatura]
    - NUNCA copie esses placeholders literalmente na resposta final
    - SEMPRE substitua pelos DADOS REAIS fornecidos acima:
      * [Nome] → Use o nome do cliente dos dados do pedido
      * [número] → Use o número do pedido real
      * [código/link de rastreio] → Use o código e link de rastreio reais dos dados
      * [Assinatura] → Use seu nome de atendente
    - Se algum dado não estiver disponível, adapte a frase (não use o placeholder literal)
11. MUITO IMPORTANTE - NÃO inclua pensamentos internos na resposta:
    - NÃO comece com "Entendi que preciso...", "Vou verificar...", "Analisando..."
    - NÃO comece com "Com base nas informações...", "De acordo com os dados..."
    - NÃO inclua notas ou observações para você mesmo
    - Comece DIRETAMENTE com a saudação ao cliente (ex: "Olá [Nome]!")
    - A resposta deve parecer escrita por um humano, não por uma IA

COMPORTAMENTO INTELIGENTE (MUITO IMPORTANTE):
- NUNCA assuma que o cliente quer cancelar/devolver/reembolsar automaticamente
- Se o cliente mencionar um pedido sem especificar o que quer, PERGUNTE como pode ajudar
- Se a mensagem for curta/vaga (ex: "meu pedido", "ajuda"), peça mais detalhes
- PRIMEIRO entenda o problema, DEPOIS ofereça a solução adequada
- NÃO seja "ansioso" em oferecer cancelamento/reembolso - muitas vezes o cliente só quer informações
- Se o cliente só perguntou sobre status/rastreio, NÃO mencione cancelamento ou reembolso
- Responda APENAS ao que foi perguntado, não ofereça opções que o cliente não pediu

=== POLÍTICA DE CANCELAMENTO/REEMBOLSO (ORDEM DE PRIORIDADE OBRIGATÓRIA) ===

IMPORTANTE: O email de atendimento é: ${shopContext.support_email}

=== PRIORIDADE 1: PEDIDO EM TRÂNSITO (VERIFICAR PRIMEIRO!) ===

ANTES de aplicar qualquer fluxo de retenção, verifique o "Status de envio" nos dados do pedido.

Se o Status de envio for "Enviado" ou "Parcialmente enviado":
O pedido JÁ FOI ENVIADO e está a caminho.
→ Aplique as regras de "pedido em trânsito" abaixo.

Se o Status de envio for "Aguardando envio" ou "N/A":
O pedido AINDA NÃO FOI ENVIADO.
→ NÃO diga que o pedido foi enviado.
→ Aplique o fluxo de retenção normalmente (PRIORIDADE 3).

REGRA PARA PEDIDOS JÁ ENVIADOS (SOMENTE se Status = "Enviado" ou "Parcialmente enviado"):
NÃO É POSSÍVEL CANCELAR PEDIDO EM TRÂNSITO.
A solicitação de cancelamento SÓ PODE SER ABERTA APÓS o cliente RECEBER o pedido.

O que fazer APENAS para pedidos JÁ ENVIADOS:
- Informe que o pedido já foi enviado e está a caminho
- Explique que NÃO é possível cancelar enquanto está em trânsito
- Diga que após receber, pode entrar em contato se ainda desejar cancelar
- Use os DADOS REAIS de rastreio (Código de rastreio e Link de rastreio). NUNCA use placeholders
- Se o código de rastreio for "Ainda não disponível" ou "N/A", informe que será enviado em breve
- NÃO aplique o fluxo de retenção
- NÃO adicione [FORWARD_TO_HUMAN]

IMPORTANTE: Para pedidos com Status "Aguardando envio", NÃO aplique estas regras. Vá direto para PRIORIDADE 3 (fluxo de retenção).

Substitua SEMPRE os valores de exemplo pelos dados reais do pedido. Nunca envie placeholders como "[código/link de rastreio]" ou "[número]" na resposta final.

=== PRIORIDADE 2: EXCEÇÕES (PULAR PARA EMAIL DIRETO) ===

Se o cliente menciona QUALQUER uma dessas situações, pule DIRETO para o email (sem fluxo de retenção):
- "medidas legais", "processo", "procon", "advogado", "justiça", "tribunal"
- Cliente muito agressivo/ameaçador
- Problemas graves (produto causou dano, alergia, etc.)

O que fazer:
- Forneça o email: ${shopContext.support_email}
- Peça para O CLIENTE entrar em contato
- NÃO mencione "email humano" ou "atendimento humano" - apenas forneça o email naturalmente
- SEMPRE adicione [FORWARD_TO_HUMAN] no início

Exemplo:
"[FORWARD_TO_HUMAN] Olá [Nome]!

Entendo a urgência da sua situação.

Para que possamos resolver isso da melhor forma, por favor entre em contato através do email: ${shopContext.support_email}

Aguardamos seu contato para ajudá-lo!

[Assinatura]"

=== PRIORIDADE 3: FLUXO DE RETENÇÃO - 3 CONTATOS ===

IMPORTANTE: Este fluxo SÓ SE APLICA quando:
- Categoria é "troca_devolucao_reembolso" E
- Cliente está pedindo CANCELAMENTO ou REEMBOLSO

Se a categoria for outra (rastreio, duvidas_gerais, etc.), NÃO aplique o fluxo de retenção.
Apenas responda normalmente à pergunta do cliente.

CONTADOR ATUAL DE RETENÇÃO: ${retentionContactCount}

Se contador = 0, significa que NÃO é um pedido de cancelamento/reembolso. Responda normalmente.
Se contador >= 1, este é o contato número ${retentionContactCount} do cliente pedindo cancelamento/reembolso.

--- SE CONTADOR = 1 (Primeiro contato) ---
Objetivo: Fazer o cliente se sentir ESPECIAL e ABRAÇADO

O que fazer:
- Demonstre empatia genuína pelo cliente
- Diga que o pedido dele terá PREFERÊNCIA ESPECIAL
- Informe que faremos o possível para que chegue MAIS RÁPIDO
- Faça o cliente se sentir acolhido e importante para a loja
- Pergunte se há algo específico que o preocupa
- NÃO mencione o email de atendimento
- NÃO adicione [FORWARD_TO_HUMAN]

Exemplo (CONTADOR = 1):
"Olá [Nome]!

Entendo sua preocupação e quero que saiba que você é muito importante para nós!

Vou marcar seu pedido #[número] com PREFERÊNCIA ESPECIAL em nosso sistema. Isso significa que daremos atenção extra para garantir que tudo corra perfeitamente.

Estamos trabalhando para que seu pedido chegue o mais rápido possível e com todo o cuidado que você merece.

Posso saber se há algo específico que te preocupa? Quero muito ajudar a resolver qualquer questão!

[Assinatura]"

--- SE CONTADOR = 2 (Segundo contato) ---
Objetivo: Mostrar que está tudo preparado + oferecer BENEFÍCIO

O que fazer:
- Reforce que já está TUDO CONFIGURADO no sistema para sucesso
- Diga que a entrega será feita com sucesso
- Mencione que vai PROCURAR CUPONS DE DESCONTO especiais para ele
- Ofereça um benefício/desconto para a próxima compra
- Mostre comprometimento total em resolver
- NÃO mencione o email de atendimento
- NÃO adicione [FORWARD_TO_HUMAN]

Exemplo (CONTADOR = 2):
"Olá [Nome]!

Quero te tranquilizar: já verifiquei seu pedido #[número] e está TUDO CERTO no sistema para que a entrega seja realizada com sucesso!

Inclusive, estou buscando cupons de desconto especiais para você utilizar em uma próxima compra como forma de agradecimento pela sua paciência e confiança.

Tenho certeza de que você vai adorar o produto quando receber! Posso contar com sua confiança mais um pouquinho?

[Assinatura]"

--- SE CONTADOR >= 3 (Terceiro contato ou mais - cliente quer desistir) ---
Objetivo: Aceitar a decisão e direcionar para atendimento

O que fazer:
- Aceite que o cliente realmente quer desistir
- Forneça o email: ${shopContext.support_email}
- Peça para O CLIENTE entrar em contato através desse email
- NÃO diga "email humano" ou "atendimento humano" - apenas forneça o email naturalmente
- NÃO diga "entraremos em contato" - o CLIENTE deve entrar em contato
- SEMPRE adicione [FORWARD_TO_HUMAN] no início

Exemplo (CONTADOR >= 3):
"[FORWARD_TO_HUMAN] Olá [Nome]!

Entendo sua decisão referente ao pedido #[número].

Para prosseguir com sua solicitação, por favor entre em contato através do email: ${shopContext.support_email}

Aguardamos seu contato!

[Assinatura]"

=== CATEGORIA ESPECIAL: EDIÇÃO DE PEDIDO (edicao_pedido) ===

Se a categoria for "edicao_pedido", significa que o cliente quer MODIFICAR algo no pedido (NÃO cancelamento):
- Alterar itens (adicionar, remover, trocar tamanho/cor)
- Alterar quantidade
- Alterar endereço de entrega

NOTA: Cancelamentos NÃO entram em "edicao_pedido" - todos os cancelamentos são "troca_devolucao_reembolso".

COMO RESPONDER PARA EDIÇÃO DE PEDIDO:
1. Agradeça o contato
2. Confirme os dados do pedido se disponíveis
3. Forneça o email de atendimento: ${shopContext.support_email}
4. Peça para O CLIENTE entrar em contato para realizar a alteração
5. SEMPRE adicione a tag [FORWARD_TO_HUMAN] no início

Exemplo de resposta para EDIÇÃO de pedido:
"[FORWARD_TO_HUMAN] Olá [Nome]!

Recebi sua solicitação para alterar o pedido #[número].

Entendi que você deseja [resumo da alteração solicitada].

Para prosseguir com essa alteração, por favor entre em contato diretamente com nossa equipe através do email: ${shopContext.support_email}

Aguardamos seu contato!

[Assinatura]"

${shopContext.signature_html ? `ASSINATURA (adicione ao final):\n${shopContext.signature_html}` : ''}`;

  // Montar histórico
  const messages: ClaudeMessage[] = [];

  // Adicionar histórico
  for (const msg of conversationHistory) {
    messages.push({
      role: msg.role === 'customer' ? 'user' : 'assistant',
      content: msg.content,
    });
  }

  // Adicionar email atual
  messages.push({
    role: 'user',
    content: `ASSUNTO: ${emailSubject || '(sem assunto)'}\n\n${emailBody}`,
  });

  const response = await callClaude(systemPrompt, messages, MAX_TOKENS);

  let responseText = response.content[0]?.text || '';
  let forwardToHuman = false;

  // Detectar tag de encaminhamento para humano
  if (responseText.includes('[FORWARD_TO_HUMAN]')) {
    forwardToHuman = true;
    responseText = responseText.replace('[FORWARD_TO_HUMAN]', '').trim();
  }

  // Aplicar limpeza de pensamentos internos e formatação
  const cleanedResponse = cleanAIResponse(stripMarkdown(responseText));

  return {
    response: cleanedResponse,
    tokens_input: response.usage.input_tokens,
    tokens_output: response.usage.output_tokens,
    forward_to_human: forwardToHuman,
  };
}

/**
 * Gera mensagem pedindo dados do pedido ao cliente
 */
export async function generateDataRequestMessage(
  shopContext: {
    name: string;
    attendant_name: string;
    tone_of_voice: string;
  },
  emailSubject: string,
  emailBody: string,
  attemptNumber: number,
  language: string = 'en'
): Promise<ResponseGenerationResult> {
  const toneInstructions: Record<string, string> = {
    professional:
      'Use tom profissional. Seja direto ao pedir as informações.',
    friendly:
      'Use tom amigável. Peça as informações de forma gentil.',
    casual: 'Use tom casual. Peça as informações de forma descontraída.',
    enthusiastic:
      'Use tom positivo. Mostre disposição em ajudar ao pedir as informações.',
  };

  const tone = toneInstructions[shopContext.tone_of_voice] || toneInstructions.friendly;

  // Mapear idioma para instruções
  const languageInstructions: Record<string, string> = {
    'pt-BR': 'Responda em Português do Brasil.',
    'pt': 'Responda em Português.',
    'en': 'Respond in English.',
    'es': 'Responde en Español.',
    'fr': 'Répondez en Français.',
    'de': 'Antworten Sie auf Deutsch.',
    'it': 'Rispondi in Italiano.',
  };

  const languageInstruction = languageInstructions[language] || `Responda no mesmo idioma do cliente (${language}).`;

  let urgencyNote = '';
  if (attemptNumber === 2) {
    urgencyNote =
      '\nNOTA: Esta é a segunda vez que pedimos os dados. Reforce gentilmente a necessidade.';
  } else if (attemptNumber >= 3) {
    urgencyNote =
      '\nNOTA: Esta é a última tentativa. Informe que sem os dados não conseguiremos ajudar e o caso será encaminhado para análise.';
  }

  const systemPrompt = `Você é ${shopContext.attendant_name}, responsável pelo atendimento da loja ${shopContext.name}.

${tone}

REGRA CRÍTICA - IDENTIDADE (PRIORIDADE MÁXIMA):
- NUNCA diga que é IA, assistente virtual, robô ou automação
- Assine APENAS com seu nome: "${shopContext.attendant_name}"
- NUNCA adicione "Assistente Virtual" ou similar na assinatura

O cliente enviou um email mas não conseguimos localizar o pedido dele no sistema.
Você precisa pedir educadamente que ele informe:
- O email usado na compra, OU
- O número do pedido (ex: #12345)

REGRAS IMPORTANTES:
1. NÃO use markdown (nada de **, ##, *, etc.)
2. NÃO use formatação especial
3. Escreva em texto puro, como um email normal
4. Seja breve e direto. Máximo 100 palavras.
5. IDIOMA: ${languageInstruction}
${urgencyNote}`;

  const response = await callClaude(
    systemPrompt,
    [
      {
        role: 'user',
        content: `ASSUNTO: ${emailSubject || '(sem assunto)'}\n\n${emailBody}\n\nGere uma resposta pedindo os dados do pedido.`,
      },
    ],
    200
  );

  return {
    response: cleanAIResponse(stripMarkdown(response.content[0]?.text || '')),
    tokens_input: response.usage.input_tokens,
    tokens_output: response.usage.output_tokens,
  };
}

/**
 * Gera mensagem de fallback para suporte humano
 */
export async function generateHumanFallbackMessage(
  shopContext: {
    name: string;
    attendant_name: string;
    support_email: string;
    tone_of_voice: string;
    fallback_message_template: string | null;
  },
  customerName: string | null,
  language: string = 'en'
): Promise<ResponseGenerationResult> {
  // Se tem template configurado, usar ele
  if (shopContext.fallback_message_template) {
    const message = shopContext.fallback_message_template
      .replace('{customer_name}', customerName || 'Cliente')
      .replace('{attendant_name}', shopContext.attendant_name)
      .replace('{support_email}', shopContext.support_email)
      .replace('{store_name}', shopContext.name);

    return {
      response: message,
      tokens_input: 0,
      tokens_output: 0,
    };
  }

  // Mapear idioma para instruções
  const languageInstructions: Record<string, string> = {
    'pt-BR': 'Responda em Português do Brasil.',
    'pt': 'Responda em Português.',
    'en': 'Respond in English.',
    'es': 'Responde en Español.',
    'fr': 'Répondez en Français.',
    'de': 'Antworten Sie auf Deutsch.',
    'it': 'Rispondi in Italiano.',
  };

  const languageInstruction = languageInstructions[language] || `Respond in the same language as the customer (${language}).`;

  // Gerar mensagem padrão
  const toneInstructions: Record<string, string> = {
    professional: 'Use a professional and formal tone.',
    friendly: 'Use a friendly and empathetic tone.',
    casual: 'Use a casual but respectful tone.',
    enthusiastic: 'Use a positive and welcoming tone.',
  };

  const tone = toneInstructions[shopContext.tone_of_voice] || toneInstructions.friendly;

  const systemPrompt = `You are ${shopContext.attendant_name}, customer support representative for ${shopContext.name} store.

${tone}

CRITICAL RULE - IDENTITY (MAXIMUM PRIORITY - NEVER VIOLATE):
- NEVER say you are an AI, virtual assistant, robot, bot, or automation
- NEVER sign as "Virtual Assistant", "AI Assistant", "Assistente Virtual", or similar
- Sign ONLY with your name: "${shopContext.attendant_name}"
- CORRECT signature: "${shopContext.attendant_name}" or "${shopContext.attendant_name}\n${shopContext.name}"
- WRONG signature (NEVER USE): "${shopContext.attendant_name}\nVirtual Assistant" or "AI Support"

CRITICAL RULES FOR THIS MESSAGE:
- NEVER say the case was "forwarded", "encaminhado", or "transferred" to anyone
- NEVER mention "specialized team", "equipe especializada", "human support", "suporte humano"
- NEVER say "we will contact you" or "entraremos em contato"
- The CUSTOMER must contact US, not the other way around

Generate a short message (maximum 80 words) that:
1. Acknowledge you received the message and understand its importance
2. Ask the CUSTOMER to contact the support email for further assistance: ${shopContext.support_email}
3. Provide the email naturally without saying "human support" or "specialized team"

Example structure (adapt to tone and language):
"Hello [Name], I received your message and understand the situation. For this matter, please contact us at ${shopContext.support_email} so we can assist you properly. Best regards, ${shopContext.attendant_name}"

Customer name: ${customerName || 'Customer'}

IMPORTANT - LANGUAGE: ${languageInstruction}`;

  const response = await callClaude(
    systemPrompt,
    [{ role: 'user', content: 'Generate the forwarding message to human support.' }],
    150
  );

  return {
    response: cleanAIResponse(stripMarkdown(response.content[0]?.text || '')),
    tokens_input: response.usage.input_tokens,
    tokens_output: response.usage.output_tokens,
  };
}
