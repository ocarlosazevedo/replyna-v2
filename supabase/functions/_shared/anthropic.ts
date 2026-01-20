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
    | 'rastreio'
    | 'reembolso'
    | 'produto'
    | 'pagamento'
    | 'entrega'
    | 'suporte_humano'
    | 'spam'
    | 'outros';
  confidence: number;
  language: string;
  order_id_found: string | null;
  summary: string;
}

export interface ResponseGenerationResult {
  response: string;
  tokens_input: number;
  tokens_output: number;
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-3-5-haiku-20241022';
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
1. category: email category (one of the options below)
2. confidence: classification confidence (0.0 to 1.0)
3. language: EXACT language of the customer's email (VERY IMPORTANT - detect correctly!)
4. order_id_found: order number if mentioned (e.g., #12345, 12345), or null
5. summary: 1-line summary of what the customer wants

LANGUAGE DETECTION (CRITICAL):
- Analyze the customer's text carefully
- "es" for Spanish (words like: hola, pedido, cancelar, gracias, quiero, donde, está)
- "pt-BR" for Brazilian Portuguese (words like: olá, obrigado, quero, onde, está, cancelamento)
- "en" for English (words like: hello, order, cancel, thanks, want, where, tracking)
- NEVER assume any language by default - analyze the actual text

AVAILABLE CATEGORIES:
- rastreio: Questions about order location, tracking code, delivery status ("where is my order", "tracking", "when will it arrive")
- reembolso: Return requests, cancellation, refund, product exchange ("refund", "cancel order", "return", "exchange")
- produto: Questions about size, color, availability, product specs ("is it available", "what size", "product details", "in stock")
- pagamento: Payment issues, declined card, invoice ("payment failed", "invoice", "payment problem")
- entrega: Wrong address, missed delivery, shipping issues ("wrong address", "delivery problem", "shipping")
- suporte_humano: ONLY for VERY SERIOUS cases with explicit legal threat (lawyer, lawsuit, legal action)
- spam: Unsolicited service offers from agencies, consultants, or developers (see list below)
- outros: Doesn't fit any category above

SPAM DETECTION (VERY IMPORTANT):
Classify as "spam" emails offering UNSOLICITED services such as:
- Digital marketing, SEO, paid traffic, growth hacking
- Website/Shopify store development
- Sales consulting, conversion optimization, performance audits
- Store audits, growth analysis
- Revenue share or commission partnerships
- Offers to "increase sales", "generate traffic", "improve conversion", "boost revenue"

SPAM signals - classify as SPAM with HIGH confidence (0.9+):
- Senders like "Marketing Consultant", "Shopify Developer", "Growth Specialist", "Expert", "Agency"
- Phrases like "growth opportunity", "increase revenue", "boost sales", "performance audit", "results-first"
- Offers of "quick call", "schedule a meeting", "free consultation", "no upfront fees"
- Mentions of "Shopify partner", "certified developer", "agency", "affiliate marketing"
- GENERIC emails that don't mention any specific order or product purchase
- Emails asking generic questions like "Is your store active?", "Are you accepting orders?", "Can I ask you something?"
- Templates with [placeholders] or generic text
- Emails from people introducing themselves as consultants, developers, or specialists
- Cold outreach emails trying to sell services

REAL CUSTOMERS (NOT spam):
- Customer asking about THEIR existing order (mentions order number, tracking, specific purchase)
- Customer with questions about products they want to BUY from the store
- Customer needing support for a purchase THEY made
- Shopify system emails (order confirmations, email verifications)

IMPORTANT RULES:
- Angry customer is NOT suporte_humano
- Complaint about product or delivery is NOT suporte_humano
- Customer asking to speak with owner/human is NOT suporte_humano - respond normally
- ONLY classify as suporte_humano if there's EXPLICIT LEGAL THREAT (mentioning lawyer, lawsuit, legal action)
- When in doubt, choose the most likely category (rastreio, reembolso, produto, etc), NEVER suporte_humano
- If it looks like agency/consultant spam, classify as "spam" with high confidence (0.9+)
- Generic "is your store active?" type emails are SPAM - they're from service sellers, not real customers

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
      'rastreio',
      'reembolso',
      'produto',
      'pagamento',
      'entrega',
      'suporte_humano',
      'spam',
      'outros',
    ];
    if (!validCategories.includes(result.category)) {
      result.category = 'outros';
    }

    // Validar confidence
    result.confidence = Math.max(0, Math.min(1, result.confidence || 0.5));

    return result;
  } catch {
    // Fallback se não conseguir fazer parse
    return {
      category: 'outros',
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

  return {
    response: stripMarkdown(response.content[0]?.text || ''),
    tokens_input: response.usage.input_tokens,
    tokens_output: response.usage.output_tokens,
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
    response: stripMarkdown(response.content[0]?.text || ''),
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
    response: stripMarkdown(response.content[0]?.text || ''),
    tokens_input: response.usage.input_tokens,
    tokens_output: response.usage.output_tokens,
  };
}
