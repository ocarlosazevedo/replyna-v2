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
 * Remove pensamentos internos e formatação incorreta da resposta
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
   Requests to MODIFY/EDIT an existing order OR CANCEL an order that has NOT been shipped yet.
   This includes:
   - MODIFICATIONS: "Change my order", "Add/remove an item", "Change size/color", "Update shipping address",
     "Change quantity", "I ordered wrong size, want to change before shipping".
   - CANCELLATIONS (NOT SHIPPED): "Cancel my order" (when order hasn't been shipped), "I don't want it anymore",
     "Please cancel", "Foi engano" (it was a mistake), "Quero cancelar antes de enviar".
   Key: Customer wants to MODIFY or CANCEL something in the order BEFORE it is shipped/delivered.
   This is different from troca_devolucao_reembolso (which is for orders ALREADY shipped/delivered).
   IMPORTANT: These cases REQUIRE HUMAN INTERVENTION because the AI cannot modify/cancel orders in Shopify.

   DECISION RULE FOR CANCELLATIONS:
   - If customer says "cancel" and order is NOT shipped → edicao_pedido
   - If customer says "cancel"/"return"/"refund" and order IS shipped/delivered → troca_devolucao_reembolso
   - If unsure about shipping status, assume NOT shipped → edicao_pedido (safer to escalate to human)

6. suporte_humano
   ONLY for cases with EXPLICIT LEGAL THREATS (lawyer, lawsuit, legal action, consumer protection agency).
   These cases need human escalation.
   NOT for: angry customers, complaints, requests to "speak with a human" (respond normally to these).

=== SPAM DETECTION (IMPORTANT) ===
Classify as "spam" with HIGH confidence (0.9+):
- Emails offering marketing, SEO, development, consulting services
- Phrases like "grow your business", "increase revenue", "boost sales", "performance audit"
- Senders identifying as consultants, developers, specialists, agencies
- Generic emails with [placeholders] or template text
- Cold outreach trying to sell services
- Emails NOT related to a specific purchase from the store
- BOUNCE/DSN EMAILS (VERY IMPORTANT): Emails with "Delivery Status Notification", "Mail Delivery Subsystem",
  "mailer-daemon", "Undeliverable", "Delivery Failure", "Mail delivery failed" in subject or body.
  These are automatic system notifications about failed email delivery - NOT real customer messages.
  Remetentes como: mailer-daemon@*, postmaster@*, bounce@* são sempre spam.
- Forwarded bounce notifications: If a customer forwards a bounce email, it's still spam - there's no real question to answer.

REAL CUSTOMERS (NOT spam):
- Asking about THEIR order (mentions order number, tracking, specific purchase)
- Questions about products they want to BUY
- Support for a purchase THEY made

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
  language: string = 'en'
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
O cliente NÃO paga antecipadamente - ele paga apenas quando recebe o produto.

Regras especiais para COD:
- NUNCA mencione estorno, reembolso no cartão ou devolução de valores pagos
- Para cancelamentos: o pedido simplesmente será cancelado (não há valor a devolver)
- Para devoluções: explique que o cliente pode recusar na entrega ou devolver o produto
- Para trocas: o cliente devolve o produto e faz um novo pedido
- Se o cliente mencionar "reembolso", explique que como o pagamento é feito na entrega, não há valor a ser reembolsado
- Foque em soluções práticas: cancelar pedido, recusar na entrega, devolver produto

`;
  }

  const systemPrompt = `Você é ${shopContext.attendant_name}, atendente virtual da loja ${shopContext.name}.

${tone}
${codInstructions}
${storeInfo}
${shopifyContext}

CATEGORIA DO EMAIL: ${category}

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
10. MUITO IMPORTANTE - NÃO inclua pensamentos internos na resposta:
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

=== POLÍTICA DE CANCELAMENTO (OBRIGATÓRIO SEGUIR) ===

IMPORTANTE: O email de atendimento humano é: ${shopContext.support_email || '[email de suporte da loja]'}

REGRA 1 - PEDIDO AINDA NÃO FOI ENVIADO (fulfillment_status == "unfulfilled" ou null):
Se o cliente pedir cancelamento MAS o pedido ainda NÃO foi enviado:
- Agradeça o contato
- Forneça o email de atendimento: ${shopContext.support_email || '[email de suporte]'}
- Peça para O CLIENTE entrar em contato através desse email
- NÃO diga "entraremos em contato" ou "nossa equipe entrará em contato"
- A responsabilidade de contato é do CLIENTE
- SEMPRE adicione a tag [FORWARD_TO_HUMAN] no início

Exemplo de resposta (pedido NÃO enviado):
"[FORWARD_TO_HUMAN] Olá [Nome]!

Recebi sua solicitação de cancelamento do pedido #[número].

Para prosseguir com o cancelamento, por favor entre em contato diretamente com nossa equipe de atendimento através do email: ${shopContext.support_email || '[email]'}

Aguardamos seu contato!

[Assinatura]"

REGRA 2 - PEDIDO EM TRÂNSITO (fulfillment_status == "fulfilled" ou "shipped" ou "in_transit" ou "partial"):
Se o cliente pedir cancelamento MAS o pedido está em trânsito (enviado mas não entregue):
- Informe que o pedido já foi enviado e está a caminho
- Explique que a solicitação de cancelamento SÓ PODE SER ABERTA APÓS o cliente RECEBER o pedido
- Enquanto o pedido não chegar, NÃO é possível solicitar cancelamento
- Forneça informações de rastreio se disponíveis
- NÃO adicione [FORWARD_TO_HUMAN] neste caso - apenas informe que deve aguardar

Exemplo de resposta (pedido EM TRÂNSITO):
"Olá [Nome]!

Recebi sua solicitação referente ao pedido #[número].

Informo que seu pedido já foi enviado e está a caminho. A solicitação de cancelamento só poderá ser aberta após você receber o pedido.

Você pode acompanhar a entrega através do rastreio: [código/link de rastreio]

Assim que receber o pedido, caso ainda deseje cancelar, entre em contato conosco.

Qualquer dúvida, estou à disposição!

[Assinatura]"

REGRA 3 - PEDIDO JÁ ENTREGUE (fulfillment_status == "delivered"):
Se o cliente pedir cancelamento/devolução E o pedido já foi entregue:
- Agradeça o contato
- Forneça o email de atendimento: ${shopContext.support_email || '[email de suporte]'}
- Peça para O CLIENTE entrar em contato através desse email
- NÃO diga "entraremos em contato" ou "nossa equipe entrará em contato"
- A responsabilidade de contato é do CLIENTE
- SEMPRE adicione a tag [FORWARD_TO_HUMAN] no início

Exemplo de resposta (pedido ENTREGUE):
"[FORWARD_TO_HUMAN] Olá [Nome]!

Recebi sua solicitação referente ao pedido #[número].

Para prosseguir com sua solicitação, por favor entre em contato diretamente com nossa equipe de atendimento através do email: ${shopContext.support_email || '[email]'}

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
3. Forneça o email de atendimento: ${shopContext.support_email || '[email]'}
4. Peça para O CLIENTE entrar em contato para realizar a alteração
5. SEMPRE adicione a tag [FORWARD_TO_HUMAN] no início

Exemplo de resposta para EDIÇÃO de pedido:
"[FORWARD_TO_HUMAN] Olá [Nome]!

Recebi sua solicitação para alterar o pedido #[número].

Entendi que você deseja [resumo da alteração solicitada].

Para prosseguir com essa alteração, por favor entre em contato diretamente com nossa equipe através do email: ${shopContext.support_email || '[email]'}

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

  const systemPrompt = `Você é ${shopContext.attendant_name}, atendente virtual da loja ${shopContext.name}.

${tone}

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

  const systemPrompt = `You are ${shopContext.attendant_name}, virtual assistant for ${shopContext.name} store.

${tone}

The customer's case will be forwarded to human support.
Generate a short message (maximum 80 words) informing that:
1. You received the message and understand its importance
2. The case has been forwarded to a specialized team
3. They will receive a response soon

Do not mention specific timeframes (e.g., "24 hours").
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
