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
const MAX_TOKENS = 800; // Aumentado para evitar truncar links de rastreio

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
    /agente\s+de\s+atendimento[^.]*automatizado/gi,
    /automated\s+customer\s+(service|support)\s+agent/gi,
    /customer\s+service\s+automation/gi,
    /I('m| am)\s+an?\s+(AI|automated|virtual)/gi,
    /sou\s+um(a)?\s+(IA|robô|bot|assistente\s+virtual)/gi,
    /as\s+an?\s+(AI|automated|virtual)\s+(assistant|agent|support)/gi,
    /como\s+um(a)?\s+(IA|agente|assistente)\s+(virtual|automatizado)/gi,
  ];

  // CRÍTICO: Remover frases que revelam limitações de IA
  const aiLimitationPatterns = [
    /não posso encaminhar[^.]*\./gi,
    /não posso transferir[^.]*\./gi,
    /não posso conectar[^.]*\./gi,
    /embora eu não possa[^.]*\./gi,
    /ainda que eu não possa[^.]*\./gi,
    /I cannot forward[^.]*\./gi,
    /I cannot transfer[^.]*\./gi,
    /I cannot connect[^.]*\./gi,
    /although I cannot[^.]*\./gi,
    /I can't forward[^.]*\./gi,
    /I can't transfer[^.]*\./gi,
    /non posso trasferire[^.]*\./gi,
    /anche se non posso[^.]*\./gi,
    /isso seria contra (as )?minhas diretrizes[^.]*\./gi,
    /this would be against my guidelines[^.]*\./gi,
    /against my guidelines[^.]*\./gi,
    /contra as minhas diretrizes[^.]*\./gi,
    /minhas diretrizes[^.]* não permitem[^.]*\./gi,
    /my guidelines[^.]* don't allow[^.]*\./gi,
    /não tenho permissão para[^.]*\./gi,
    /I don't have permission to[^.]*\./gi,
    /não estou autorizado a[^.]*\./gi,
    /I am not authorized to[^.]*\./gi,
    /desculpe,?\s*mas não posso[^.]*\./gi,
    /sorry,?\s*but I cannot[^.]*\./gi,
    /me desculpe,?\s*mas não posso[^.]*\./gi,
    /Es tut mir leid,?\s*aber ich kann nicht[^.]*\./gi,
    /Ich kann keine Nachrichten weiterleiten[^.]*\./gi,
    /Das würde gegen meine Richtlinien verstoßen[^.]*\./gi,
    // Frases sobre falta de acesso a dados/informações
    /não tenho (acesso|informações)[^.]*dados[^.]*\./gi,
    /não tenho (acesso|informações)[^.]*logístic[^.]*\./gi,
    /não tenho (acesso|informações)[^.]*específic[^.]*\./gi,
    /não tenho (acesso|informações) detalh[^.]*\./gi,
    /I (don't|do not) have access to[^.]*data[^.]*\./gi,
    /I (don't|do not) have access to[^.]*information[^.]*\./gi,
    /I (don't|do not) have access to (this|that) level[^.]*\./gi,
    /I (don't|do not) have (detailed|specific) information[^.]*\./gi,
    /non ho accesso a[^.]*\./gi,
    /no tengo acceso a[^.]*\./gi,
    /je n'ai pas accès[^.]*\./gi,
    /ich habe keinen Zugang[^.]*\./gi,
    // Frases sobre ser automatizado
    /como (um |uma )?(agente|atendente|assistente)[^.]*automatizad[^.]*[,.]/gi,
    /as an automated[^.]*[,.]/gi,
    /being an automated[^.]*[,.]/gi,
  ];

  // CRÍTICO: Remover frases que dizem que a IA fez ações que não pode fazer
  const falseActionPatterns = [
    /encaminhei[^.]*para[^.]*equipe[^.]*\./gi,
    /encaminhei[^.]*informa[^.]*\./gi,
    /encaminhei[^.]*fotos[^.]*\./gi,
    /enviei[^.]*para[^.]*análise[^.]*\./gi,
    /enviei[^.]*para[^.]*equipe[^.]*\./gi,
    /notifiquei[^.]*equipe[^.]*\./gi,
    /registrei[^.]*solicitação[^.]*\./gi,
    /registrei[^.]*sistema[^.]*\./gi,
    /I have forwarded[^.]*\./gi,
    /I forwarded[^.]*\./gi,
    /I have sent[^.]*to the team[^.]*\./gi,
    /I sent[^.]*to the team[^.]*\./gi,
    /I have notified[^.]*\./gi,
    /I notified[^.]*\./gi,
    /ho inoltrato[^.]*\./gi,
    /ho inviato[^.]*alla squadra[^.]*\./gi,
    /ho inviato[^.]*al team[^.]*\./gi,
    /he enviado[^.]*al equipo[^.]*\./gi,
    /he reenviado[^.]*\./gi,
    /j'ai transféré[^.]*\./gi,
    /j'ai envoyé[^.]*à l'équipe[^.]*\./gi,
    /ich habe weitergeleitet[^.]*\./gi,
    /ich habe gesendet[^.]*an das Team[^.]*\./gi,
  ];

  for (const pattern of falseActionPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  for (const pattern of aiLimitationPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

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

  // CRÍTICO: Remover placeholders que vazaram na resposta
  // Padrão 1: [texto] - placeholders em colchetes
  const placeholderPatterns = [
    /\[Cliente\]/gi,
    /\[Customer\]/gi,
    /\[Name\]/gi,
    /\[Nome\]/gi,
    /\[Nombre\]/gi,
    /\[Kunde\]/gi,
    /\[Client\]/gi,
    /\[número\]/gi,
    /\[number\]/gi,
    /\[order[_\s]?number\]/gi,
    /\[pedido\]/gi,
    /\[código[_\s]?de[_\s]?rastreio\]/gi,
    /\[tracking[_\s]?code\]/gi,
    /\[tracking[_\s]?number\]/gi,
    /\[link[_\s]?de[_\s]?rastreio\]/gi,
    /\[tracking[_\s]?link\]/gi,
    /\[Assinatura\]/gi,
    /\[Signature\]/gi,
    /\[data\]/gi,
    /\[date\]/gi,
    /\[email\]/gi,
    /\[produto\]/gi,
    /\[product\]/gi,
    /\[valor\]/gi,
    /\[value\]/gi,
    /\[amount\]/gi,
  ];

  for (const pattern of placeholderPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Padrão 2: Remover saudações com placeholders vazios resultantes
  // "Estimado Sr. ," -> "Estimado,"
  // "Dear Mr. ," -> "Dear,"
  cleaned = cleaned.replace(/Estimado\s+Sr\.?\s*,/gi, 'Estimado,');
  cleaned = cleaned.replace(/Estimada\s+Sra\.?\s*,/gi, 'Estimada,');
  cleaned = cleaned.replace(/Estimado\/a\s*,/gi, 'Estimado/a,');
  cleaned = cleaned.replace(/Dear\s+Mr\.?\s*,/gi, 'Dear Customer,');
  cleaned = cleaned.replace(/Dear\s+Mrs\.?\s*,/gi, 'Dear Customer,');
  cleaned = cleaned.replace(/Dear\s+Ms\.?\s*,/gi, 'Dear Customer,');
  cleaned = cleaned.replace(/Caro\s+Sr\.?\s*,/gi, 'Caro cliente,');
  cleaned = cleaned.replace(/Cara\s+Sra\.?\s*,/gi, 'Cara cliente,');
  cleaned = cleaned.replace(/Sehr geehrter\s+Herr\s*,/gi, 'Sehr geehrte/r Kunde/in,');
  cleaned = cleaned.replace(/Sehr geehrte\s+Frau\s*,/gi, 'Sehr geehrte/r Kunde/in,');

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

LANGUAGE DETECTION (CRITICAL - HIGHEST PRIORITY):
- Detect language ONLY from the section marked "MENSAGEM ATUAL DO CLIENTE"
- The ASSUNTO (subject) and CORPO (body) in that section determine the language
- COMPLETELY IGNORE the "HISTÓRICO" section for language detection - it may be in a different language!
- COMPLETELY IGNORE any quoted messages (text after "On ... wrote:" or similar)

ENGLISH DETECTION (very common - detect correctly):
- If text contains: "Can you", "I would", "Please", "When will", "Where is", "I need", "update", "receive", "order" → language is "en"
- If text has English grammar structure → language is "en"
- Common English phrases: "give me an update", "when will I receive", "where is my order", "I have a question"
- SINGLE ENGLISH WORDS (even alone, these indicate English):
  * "Refund", "Refund?" → language is "en"
  * "Cancel", "Cancellation" → language is "en"
  * "Tracking", "Track" → language is "en"
  * "Help", "Hello", "Hi" → language is "en"
  * "Order", "Shipping", "Delivery" → language is "en"
  * "Return", "Exchange" → language is "en"
  * "Where", "When", "What", "Why", "How" → language is "en"
  * "Thanks", "Thank you" → language is "en"
  * "Status", "Update" → language is "en"
- SHORT MESSAGES: Even 1-word messages must be detected correctly by the word itself

IMPORTANT:
- The store may have replied in Portuguese, but if the CUSTOMER writes in English → detect "en"
- NEVER let the history influence your language detection
- Default to the language of the FIRST sentence in CORPO if mixed
- Detect ANY language in the world - use ISO 639-1 codes:
  - "pt-BR" = Brazilian Portuguese, "pt" = Portuguese
  - "en" = English
  - "es" = Spanish
  - "de" = German
  - "fr" = French
  - "it" = Italian
  - "nl" = Dutch
  - "pl" = Polish
  - "cs" = Czech
  - "ro" = Romanian
  - "sv" = Swedish
  - "da" = Danish
  - "no" = Norwegian
  - "fi" = Finnish
  - "ru" = Russian
  - "uk" = Ukrainian
  - "ja" = Japanese
  - "zh" = Chinese
  - "ko" = Korean
  - "ar" = Arabic
  - "he" = Hebrew
  - "tr" = Turkish
  - "hu" = Hungarian
  - "el" = Greek
  - "bg" = Bulgarian
  - "hr" = Croatian
  - "sk" = Slovak
  - "sl" = Slovenian
  - "et" = Estonian
  - "lv" = Latvian
  - "lt" = Lithuanian
  - Any other ISO 639-1 code for languages not listed
- NEVER default to English - always detect the actual language
- The response will be generated in the detected language

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

=== EMAIL SUBJECT IS PART OF THE MESSAGE (CRITICAL) ===
- The email SUBJECT (ASSUNTO) often contains the customer's intent/request
- ALWAYS read and consider the SUBJECT together with the BODY
- Example: Subject "Not received my refund" + Body "Order #12345" = customer wants refund status for order 12345
- Example: Subject "Where is my order?" + Body "john@email.com, #5678" = customer wants tracking for order 5678
- If the SUBJECT contains the intent and BODY contains order info → you have a COMPLETE request
- DO NOT ask for clarification if the SUBJECT already explains what the customer wants

=== AMBIGUOUS MESSAGES (ONLY when intent is truly unclear) ===
- ONLY classify as "duvidas_gerais" if BOTH subject AND body are unclear
- Short messages like "my order", "help", "hello" WITH NO CLEAR SUBJECT → classify as "duvidas_gerais"
- Customer mentions order number but doesn't say what they want AND subject is also unclear → classify as "duvidas_gerais"
- Customer just provides order number, email, or personal info AND subject gives no context → classify as "duvidas_gerais"
- If unsure what the customer wants → classify as "duvidas_gerais" (NEVER assume they want cancellation/refund)
- The response generator MUST ask clarifying questions when the intent is unclear
- NEVER classify as "troca_devolucao_reembolso" unless customer EXPLICITLY says: cancel, refund, return, exchange

=== SHOPIFY CONTACT FORM (SPECIAL CASE) ===
- If body contains "[FORMULÁRIO DE CONTATO SEM MENSAGEM]" → classify as "duvidas_gerais"
- This means customer submitted empty contact form - need to ask what they need
- If body only contains form fields (Name, Email, Phone, Country) without actual message → "duvidas_gerais"

=== CANCELLATION CLASSIFICATION (CRITICAL - HIGH CONFIDENCE) ===
When customer wants to CANCEL an order:
ALL cancellation requests MUST be classified as "troca_devolucao_reembolso" with confidence 0.95+

CANCELLATION KEYWORDS (if ANY of these appear → troca_devolucao_reembolso with 0.95+ confidence):

Portuguese: cancelar, cancelamento, cancela, reembolso, reembolsar, devolver, devolução, estorno, estornar,
            quero meu dinheiro, dinheiro de volta, não quero mais, desistir, desisti, anular

English: cancel, cancellation, refund, return, money back, don't want, do not want, give back,
         chargeback, dispute, get my money, want my money

Spanish: cancelar, cancelación, reembolso, devolver, devolución, no quiero, dinero, anular

French: annuler, annulation, remboursement, rembourser, retourner, je ne veux plus

German: stornieren, stornierung, rückerstattung, zurückgeben, geld zurück, nicht mehr wollen

Italian: cancellare, annullare, rimborso, restituire, non voglio più, soldi indietro

Dutch: annuleren, terugbetaling, retourneren, geld terug, niet meer willen

Polish: anulować, zwrot, zwrócić, nie chcę, pieniądze z powrotem

Examples:
- "Quero cancelar, foi engano" → troca_devolucao_reembolso (0.95)
- "Cancel my order please" → troca_devolucao_reembolso (0.95)
- "I received it but want to return" → troca_devolucao_reembolso (0.95)
- "Product arrived damaged, refund please" → troca_devolucao_reembolso (0.95)
- "Quero cancelar antes de enviar" → troca_devolucao_reembolso (0.95)
- "Cancel order not shipped yet" → troca_devolucao_reembolso (0.95)
- "Geld zurück bitte" → troca_devolucao_reembolso (0.95)
- "Je veux annuler" → troca_devolucao_reembolso (0.95)

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

  const userMessage = `=== MENSAGEM ATUAL DO CLIENTE (DETECTAR IDIOMA DAQUI) ===
ASSUNTO: ${emailSubject || '(sem assunto)'}
CORPO: ${emailBody || '(vazio)'}

=== FIM DA MENSAGEM ATUAL ===
${historyText ? `\n=== HISTÓRICO (apenas para contexto, NÃO usar para detectar idioma) ===${historyText}\n=== FIM DO HISTÓRICO ===` : ''}

Classifique este email e retorne o JSON.

REGRAS CRÍTICAS:
1. IDIOMA: Detectar APENAS do ASSUNTO e CORPO acima (entre "MENSAGEM ATUAL DO CLIENTE" e "FIM DA MENSAGEM ATUAL")
2. NUNCA detectar idioma do HISTÓRICO - ele pode estar em idioma diferente
3. Se ASSUNTO está em inglês (ex: "refund", "order", "help") → idioma é "en"
4. Se CORPO está em inglês → idioma é "en"
5. O ASSUNTO frequentemente contém a intenção do cliente
6. Se ASSUNTO tem intenção + CORPO tem número do pedido = solicitação COMPLETA`;

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
  retentionContactCount: number = 0,
  additionalOrders: Array<{
    order_number: string | null;
    order_date: string | null;
    order_status: string | null;
    order_total: string | null;
    tracking_number: string | null;
    tracking_url: string | null;
    fulfillment_status: string | null;
    items: Array<{ name: string; quantity: number }>;
    customer_name: string | null;
  }> = []
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

    // Se houver pedidos adicionais, incluir no contexto
    if (additionalOrders.length > 0) {
      shopifyContext += `\n\nPEDIDOS ADICIONAIS DO CLIENTE (responda sobre TODOS se relevante):`;
      for (const order of additionalOrders) {
        if (order.order_number) {
          shopifyContext += `\n
--- Pedido #${order.order_number} ---
- Data: ${order.order_date || 'N/A'}
- Valor total: ${order.order_total || 'N/A'}
- Status de envio: ${order.fulfillment_status || 'N/A'}
- Código de rastreio: ${order.tracking_number || 'Ainda não disponível'}
- Link de rastreio: ${order.tracking_url || 'N/A'}
- Itens: ${order.items.map((i) => `${i.name} (x${i.quantity})`).join(', ') || 'N/A'}`;
        }
      }
      shopifyContext += `\n
IMPORTANTE: O cliente mencionou MÚLTIPLOS pedidos. Forneça informações sobre TODOS os pedidos relevantes na sua resposta.`;
    }
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

  // Mapear idioma para instruções - suporta qualquer idioma
  const languageInstructions: Record<string, string> = {
    'pt-BR': 'Responda em Português do Brasil.',
    'pt': 'Responda em Português.',
    'en': 'Respond in English.',
    'es': 'Responde en Español.',
    'fr': 'Répondez en Français.',
    'de': 'Antworten Sie auf Deutsch.',
    'it': 'Rispondi in Italiano.',
    'nl': 'Antwoord in het Nederlands.',
    'pl': 'Odpowiedz po polsku.',
    'cs': 'Odpovězte v češtině.',
    'ro': 'Răspundeți în limba română.',
    'sv': 'Svara på svenska.',
    'da': 'Svar på dansk.',
    'no': 'Svar på norsk.',
    'fi': 'Vastaa suomeksi.',
    'ru': 'Ответьте на русском языке.',
    'uk': 'Відповідайте українською мовою.',
    'hu': 'Válaszoljon magyarul.',
    'el': 'Απαντήστε στα ελληνικά.',
    'tr': 'Türkçe yanıt verin.',
    'ja': '日本語で返信してください。',
    'zh': '请用中文回复。',
    'ko': '한국어로 답변해 주세요.',
    'ar': 'يرجى الرد باللغة العربية.',
    'he': 'אנא השב בעברית.',
  };

  // Mapa de nomes de idiomas
  const langName: Record<string, string> = {
    'pt-BR': 'Brazilian Portuguese', 'pt': 'Portuguese', 'en': 'English', 'es': 'Spanish',
    'fr': 'French', 'de': 'German', 'it': 'Italian', 'nl': 'Dutch', 'pl': 'Polish',
    'cs': 'Czech', 'ro': 'Romanian', 'sv': 'Swedish', 'da': 'Danish', 'no': 'Norwegian',
    'fi': 'Finnish', 'ru': 'Russian', 'uk': 'Ukrainian', 'hu': 'Hungarian', 'el': 'Greek',
    'tr': 'Turkish', 'ja': 'Japanese', 'zh': 'Chinese', 'ko': 'Korean', 'ar': 'Arabic', 'he': 'Hebrew'
  };
  const detectedLangName = langName[language] || language;

  const languageInstruction = languageInstructions[language] || `Respond in ${detectedLangName}.`;

  // Instrução de idioma para o INÍCIO do prompt (MUITO explícita)
  const languageHeaderInstruction = `
=== MANDATORY RESPONSE LANGUAGE: ${detectedLangName.toUpperCase()} ===
You MUST write your ENTIRE response in ${detectedLangName} (language code: ${language}).
The customer's message was detected as ${detectedLangName}.
DO NOT respond in Portuguese or any other language unless "${language}" matches that language.
Every word, greeting, and signature must be in ${detectedLangName}.
===`;

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
   - NUNCA diga que "não há valor a ser reembolsado" se o cliente já recebeu/pagou

   IMPORTANTE - Quando encaminhar para humano vs. tentar reter:

   a) ENCAMINHAR DIRETO PARA HUMANO (sem retenção):
      - Cliente JÁ ENVIOU o produto de volta
      - Produto com defeito grave, danificado, ou produto errado
      - Nesses casos: adicione [FORWARD_TO_HUMAN] e forneça o email de suporte

   b) TENTAR RETER PRIMEIRO (aplicar fluxo de retenção):
      - Cliente quer devolver mas AINDA TEM o produto
      - Cliente insatisfeito mas sem defeito grave
      - Aplique o fluxo de retenção (3 contatos) antes de encaminhar

`;
  }

  const systemPrompt = `${languageHeaderInstruction}

Você é ${shopContext.attendant_name}, responsável pelo atendimento da loja ${shopContext.name}.

${tone}
${codInstructions}
${storeInfo}
${shopifyContext}

CATEGORIA DO EMAIL: ${category}

REGRA CRÍTICA - IDENTIDADE (NUNCA VIOLAR - PRIORIDADE MÁXIMA):
- NUNCA diga que você é uma IA, assistente virtual, robô, automação, bot ou atendimento automatizado
- NUNCA mencione "inteligência artificial", "sistema automático", "sou um programa" ou termos similares
- NUNCA mencione "suporte humano", "equipe humana", "atendimento humano", "human support"
- Se perguntarem se você é humano/robô/IA, responda de forma natural e evasiva (ex: "Sou a ${shopContext.attendant_name}, responsável pelo atendimento aqui na ${shopContext.name}!")
- Aja 100% como um atendente humano real - com personalidade, empatia e naturalidade
- NUNCA se apresente dizendo "sou a assistente virtual" ou similar
- NA ASSINATURA: Use APENAS seu nome "${shopContext.attendant_name}" - NUNCA adicione "Assistente Virtual", "Virtual Assistant", "AI", "Bot" ou qualquer identificação de automação
- ASSINATURA CORRETA: "${shopContext.attendant_name}" ou "${shopContext.attendant_name}\n${shopContext.name}"
- ASSINATURA ERRADA (NUNCA USE): "${shopContext.attendant_name}\nAssistente Virtual ${shopContext.name}"

FRASES PROIBIDAS (NUNCA USE - REVELA QUE É IA):
- NUNCA diga "não posso encaminhar", "I cannot forward", "Ich kann nicht weiterleiten"
- NUNCA diga "não posso transferir", "I cannot transfer", "non posso trasferire"
- NUNCA diga "não posso conectar você com", "I cannot connect you with"
- NUNCA diga "embora eu não possa", "although I cannot", "anche se non posso"
- NUNCA diga "contra minhas diretrizes", "against my guidelines", "gegen meine Richtlinien"
- NUNCA diga "não tenho permissão", "I don't have permission", "Ich habe keine Erlaubnis"
- NUNCA diga "não estou autorizado", "I am not authorized", "Ich bin nicht autorisiert"
- NUNCA diga "desculpe, mas não posso", "sorry, but I cannot", "Es tut mir leid, aber ich kann nicht"
- NUNCA diga "minhas limitações", "my limitations", "meine Einschränkungen"
- NUNCA diga "não tenho acesso a", "I don't have access to", "non ho accesso a"
- NUNCA diga "não tenho informações detalhadas", "I don't have detailed information"
- NUNCA diga "como um agente automatizado", "as an automated agent"
- NUNCA diga "agente de atendimento automatizado", "automated customer service agent"
- NUNCA use frases que indicam que você é um sistema/programa/IA com limitações de acesso
- Se você NÃO SABE algo, diga "vou verificar" ou "deixa eu checar" - NUNCA diga que não tem acesso
- Se você NÃO PODE fazer algo, simplesmente NÃO FAÇA - não explique por quê
- Se precisar direcionar para outro canal, faça naturalmente sem mencionar "limitações" ou "diretrizes"
- Se o cliente quer falar com gerente/proprietário, diga que VOCÊ pode ajudar - não mencione que não pode transferir

QUANDO O CLIENTE FAZ PERGUNTAS SOBRE O ATENDIMENTO:
- "Caixa monitorada?", "Alguém está lendo?", "Tem alguém aí?", "É automático?"
  → RESPONDA: "Sim, claro! Sou ${shopContext.attendant_name} e estou aqui para ajudá-lo(a). Como posso ajudar?"
- "Isso é um robô?", "É uma IA?", "É automatizado?"
  → RESPONDA: "Sou ${shopContext.attendant_name}, responsável pelo atendimento da ${shopContext.name}. Como posso ajudá-lo(a)?"
- NUNCA diga "não posso confirmar", "não sei se é monitorado", "sugiro entrar em contato por outro canal"
- SEMPRE responda de forma confiante e acolhedora, como um humano real

QUANDO O CLIENTE PEDE PARA FALAR COM OUTRA PESSOA:
- Se pedir para falar com "proprietário", "dono", "gerente", "supervisor", "outra pessoa", "alguém responsável"
- RESPONDA: Você (${shopContext.attendant_name}) é a responsável pelo atendimento e pode ajudar
- PERGUNTE: "Como posso ajudá-lo(a)?" ou "Em que posso ajudar?"
- NÃO encaminhe para email de suporte - você pode resolver
- NÃO mencione que existe outro canal ou outra pessoa

AÇÕES QUE VOCÊ NÃO PODE FAZER (NUNCA DIGA QUE FEZ):
- NUNCA diga "o pedido foi cancelado" - você NÃO pode cancelar pedidos
- NUNCA diga "o reembolso foi processado" - você NÃO pode fazer reembolsos
- NUNCA diga "alterei seu pedido" - você NÃO pode alterar pedidos
- NUNCA diga "enviei o código de rastreio" - você NÃO pode enviar rastreios
- NUNCA diga "encaminhei para a equipe" ou "encaminhei as informações" - você NÃO pode encaminhar nada
- NUNCA diga "enviei as fotos para análise" - você NÃO pode enviar fotos
- NUNCA diga "notifiquei a equipe" - você NÃO pode notificar ninguém
- NUNCA diga "registrei sua solicitação" como se tivesse feito algo no sistema
- NUNCA confirme que uma ação foi realizada se você não tem essa capacidade
- O que você PODE dizer: "sua solicitação será analisada", "a equipe vai verificar", "você receberá retorno"
- NUNCA use frases que impliquem que você EXECUTOU alguma ação - você apenas RESPONDE

QUANDO O CLIENTE QUER CANCELAR (E ACEITA APÓS RETENÇÃO):
- NUNCA diga "cancelei seu pedido" ou "pedido foi cancelado"
- NUNCA diga "encaminhei sua solicitação" ou "registrei no sistema"
- DIGA: "Para prosseguir com o cancelamento, entre em contato pelo email ${shopContext.support_email}"
- OU: "Sua solicitação será processada pela equipe"
- Forneça o email de suporte e adicione [FORWARD_TO_HUMAN]

QUANDO USAR O EMAIL DE SUPORTE (${shopContext.support_email}) - SOMENTE NESSES CASOS:
1. Cancelamento/reembolso: APÓS as 3 tentativas de retenção (não antes)
2. Devolução de produto já recebido: APÓS as 3 tentativas de retenção (não antes)
3. Cliente JÁ ENVIOU produto de volta (precisa de processamento manual)
4. Produto com defeito grave, danificado ou errado
5. Ameaças legais: PROCON, advogado, processo, justiça
- Em QUALQUER outro caso, resolva você mesmo sem mencionar outro email/canal

REGRAS IMPORTANTES:
1. Responda de forma clara e objetiva
2. Use as informações do pedido quando disponíveis
3. Se não souber algo específico, diga que vai verificar - NUNCA diga que "não tem acesso" a dados
4. Não invente informações - use apenas os dados fornecidos
5. Máximo 400 palavras

QUANDO PERGUNTAR SOBRE PRAZOS DE ENTREGA/ENVIO:
- Se a loja tem "Prazo de entrega" configurado nas informações, USE essa informação
- Se não tem informação específica para o país, responda de forma útil:
  * "Nosso prazo de entrega internacional é geralmente de X a Y dias úteis"
  * "Para envios internacionais, o prazo varia de acordo com a região"
  * "Vou verificar o prazo específico para sua região e te retorno"
- NUNCA diga "não tenho acesso a dados logísticos" ou similar
- NUNCA diga "como agente automatizado não tenho essa informação"
- Aja como um atendente humano que vai verificar a informação
6. NÃO use markdown (nada de **, ##, *, listas com -, etc.)
7. NÃO use formatação especial - escreva como um email normal em texto puro
8. Assine apenas com seu nome no final
9. IDIOMA: ${languageInstruction}
10. FLUXO DE RETENÇÃO (CRÍTICO): Se a categoria for "troca_devolucao_reembolso", você DEVE seguir o fluxo de retenção definido abaixo baseado no CONTADOR. NUNCA forneça o email de suporte antes do TERCEIRO contato (contador >= 3).

REGRA CRÍTICA - RECONHEÇA PROBLEMAS ESPECÍFICOS DO CLIENTE:
- Se o cliente menciona um problema ESPECÍFICO, você DEVE reconhecê-lo na resposta
- Exemplos de problemas específicos que devem ser reconhecidos:
  * "Paguei 4 e recebi 3" → "Entendo que você pagou por 4 itens mas recebeu apenas 3"
  * "Produto veio quebrado" → "Lamento que o produto tenha chegado danificado"
  * "Cor errada" → "Entendo que recebeu uma cor diferente da que pediu"
  * "Tamanho errado" → "Lamento que o tamanho não seja o que você solicitou"
  * "Faltou item" → "Entendo que está faltando um item no seu pedido"
- NUNCA ignore o problema específico e dê resposta genérica
- Reconheça o problema PRIMEIRO, depois encaminhe ou ofereça solução

10. REGRA CRÍTICA - NUNCA USE PLACEHOLDERS NA RESPOSTA (EM NENHUM IDIOMA):
    - NUNCA use textos entre colchetes [ ] em NENHUM idioma
    - Exemplos de placeholders PROIBIDOS (em qualquer idioma):
      * [Nome], [Cliente], [Customer], [Name], [Imię], [Jméno]
      * [número], [number], [numer], [číslo]
      * [código de rastreio], [tracking code], [kodprzesylki], [kod przesyłki]
      * [link de rastreio], [tracking link], [linkdo_przesylki], [link do przesyłki]
      * [Assinatura], [Signature], [Podpis]
    - Se você NÃO tem um dado real, NÃO invente um placeholder - adapte a frase:
      * Sem nome do cliente → Use saudação genérica: "Olá!", "Hola!", "Hello!", "Guten Tag!"
      * NUNCA use "Estimado Sr. [Cliente]" ou "Dear Mr. [Customer]"
      * Se não sabe o nome, use: "Estimado/a,", "Dear Customer,", "Hola,"
      * Sem rastreio → "o código de rastreio ainda não está disponível"
      * Sem link → não mencione o link
    - SEMPRE use os DADOS REAIS fornecidos em "DADOS DO PEDIDO DO CLIENTE"
    - Para assinatura: Use seu nome "${shopContext.attendant_name}"
11. MUITO IMPORTANTE - NÃO inclua pensamentos internos na resposta:
    - NÃO comece com "Entendi que preciso...", "Vou verificar...", "Analisando..."
    - NÃO comece com "Com base nas informações...", "De acordo com os dados..."
    - NÃO inclua notas ou observações para você mesmo
    - Comece DIRETAMENTE com a saudação ao cliente (ex: "Olá [Nome]!")
    - A resposta deve parecer escrita por um humano, não por uma IA

COMPORTAMENTO INTELIGENTE (REGRA CRÍTICA - SEGUIR SEMPRE):
- RESPONDA APENAS ao que foi perguntado - NADA MAIS
- NUNCA mencione cancelamento/reembolso/devolução se o cliente NÃO pediu isso EXPLICITAMENTE
- NUNCA encaminhe para email de suporte se o cliente NÃO pediu isso
- Se o cliente perguntou sobre status/rastreio, responda SOMENTE sobre status/rastreio
- Se o cliente perguntou sobre prazo, responda SOMENTE sobre prazo
- NÃO adicione informações não solicitadas como "caso queira cancelar..." ou "se tiver problemas..."
- NÃO seja "ansioso" em oferecer opções que o cliente não pediu

QUANDO A INTENÇÃO NÃO ESTÁ CLARA (MUITO IMPORTANTE):
- SEMPRE leia o ASSUNTO do email - ele frequentemente contém a intenção do cliente!
- Exemplo: ASSUNTO "Not received my refund" + CORPO "Order #12345" = cliente quer saber do REEMBOLSO do pedido 12345
- Exemplo: ASSUNTO "Where is my order?" + CORPO "#5678" = cliente quer RASTREIO do pedido 5678
- Se o ASSUNTO contém a intenção (refund, tracking, where is my order, etc.) + CORPO tem número do pedido → RESPONDA diretamente
- SOMENTE pergunte se TANTO o assunto QUANTO o corpo forem vagos/incompletos
- Se a mensagem E o assunto forem curtos/vagos (ex: assunto "Help" + corpo "oi") → PERGUNTE como pode ajudar
- NUNCA ASSUMA que o cliente quer cancelar, devolver ou reembolsar SEM isso estar claro no assunto ou corpo
- PRIMEIRO entenda o que o cliente quer (via ASSUNTO + CORPO), DEPOIS responda de forma focada

FORMULÁRIO DE CONTATO VAZIO OU SEM MENSAGEM:
- Se o corpo contém "[FORMULÁRIO DE CONTATO SEM MENSAGEM]" ou está vazio/muito curto
- NÃO invente informações sobre pedidos ou status
- NÃO assuma o que o cliente quer
- RESPONDA: "Olá! Recebi seu contato. Como posso ajudá-lo(a)? Por favor, me conte mais sobre sua dúvida ou solicitação."
- NUNCA mencione números de pedido, status ou rastreio se não tiver essa informação

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
- Cliente JÁ ENVIOU/DEVOLVEU o produto - identificar por frases como:
  * "vocês receberam", "você recebeu", "recebi de volta", "já devolvi"
  * "enviei de volta", "mandei de volta", "já enviei", "já mandei"
  * "devolvido", "foi devolvido", "produto devolvido"
  * "aguardando reembolso", "cadê meu reembolso", "quando vou receber o dinheiro"
  * "paguei o frete para devolver", "paguei para enviar de volta"
- Produto com defeito grave, danificado na entrega, ou produto errado enviado

IMPORTANTE: Se o cliente diz que JÁ DEVOLVEU, NÃO diga que "o pedido está em trânsito" ou "não pode cancelar".
O produto JÁ VOLTOU para a loja - encaminhe para suporte processar o reembolso.

NOTA: Se o cliente QUER devolver mas AINDA NÃO ENVIOU, aplique o fluxo de retenção (PRIORIDADE 3) primeiro.
Só encaminhe para humano após as 3 tentativas de retenção.

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

=== PRIORIDADE 3: FLUXO DE RETENÇÃO - 3 CONTATOS (OBRIGATÓRIO) ===

REGRA CRÍTICA: Se CONTADOR >= 1, você DEVE seguir o fluxo de retenção abaixo.
NUNCA pule direto para o email de suporte antes do terceiro contato!

CONTADOR ATUAL DE RETENÇÃO: ${retentionContactCount}

=== LEIA COM ATENÇÃO ===
- Se contador = 0 → NÃO é cancelamento/reembolso, responda normalmente
- Se contador = 1 → PRIMEIRO CONTATO: Faça o cliente se sentir especial (NÃO mencione email!)
- Se contador = 2 → SEGUNDO CONTATO: Ofereça benefício/desconto (NÃO mencione email!)
- Se contador >= 3 → TERCEIRO CONTATO: Agora sim, forneça o email de suporte

IMPORTANTE: NUNCA forneça o email de suporte se contador < 3 (exceto em casos de PRIORIDADE 2).

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

  // Mapear idioma para instruções - suporta qualquer idioma
  const languageInstructions: Record<string, string> = {
    'pt-BR': 'Responda em Português do Brasil.',
    'pt': 'Responda em Português.',
    'en': 'Respond in English.',
    'es': 'Responde en Español.',
    'fr': 'Répondez en Français.',
    'de': 'Antworten Sie auf Deutsch.',
    'it': 'Rispondi in Italiano.',
    'nl': 'Antwoord in het Nederlands.',
    'pl': 'Odpowiedz po polsku.',
    'cs': 'Odpovězte v češtině.',
    'ro': 'Răspundeți în limba română.',
    'sv': 'Svara på svenska.',
    'da': 'Svar på dansk.',
    'no': 'Svar på norsk.',
    'fi': 'Vastaa suomeksi.',
    'ru': 'Ответьте на русском языке.',
    'uk': 'Відповідайте українською мовою.',
    'hu': 'Válaszoljon magyarul.',
    'el': 'Απαντήστε στα ελληνικά.',
    'tr': 'Türkçe yanıt verin.',
    'ja': '日本語で返信してください。',
    'zh': '请用中文回复。',
    'ko': '한국어로 답변해 주세요.',
    'ar': 'يرجى الرد باللغة العربية.',
    'he': 'אנא השב בעברית.',
  };

  const languageInstruction = languageInstructions[language] || `CRITICAL: You MUST respond in the customer's language (${language}). Write your ENTIRE response in ${language}.`;

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

  // Mapear idioma para instruções - suporta qualquer idioma
  const languageInstructions: Record<string, string> = {
    'pt-BR': 'Responda em Português do Brasil.',
    'pt': 'Responda em Português.',
    'en': 'Respond in English.',
    'es': 'Responde en Español.',
    'fr': 'Répondez en Français.',
    'de': 'Antworten Sie auf Deutsch.',
    'it': 'Rispondi in Italiano.',
    'nl': 'Antwoord in het Nederlands.',
    'pl': 'Odpowiedz po polsku.',
    'cs': 'Odpovězte v češtině.',
    'ro': 'Răspundeți în limba română.',
    'sv': 'Svara på svenska.',
    'da': 'Svar på dansk.',
    'no': 'Svar på norsk.',
    'fi': 'Vastaa suomeksi.',
    'ru': 'Ответьте на русском языке.',
    'uk': 'Відповідайте українською мовою.',
    'hu': 'Válaszoljon magyarul.',
    'el': 'Απαντήστε στα ελληνικά.',
    'tr': 'Türkçe yanıt verin.',
    'ja': '日本語で返信してください。',
    'zh': '请用中文回复。',
    'ko': '한국어로 답변해 주세요.',
    'ar': 'يرجى الرد باللغة العربية.',
    'he': 'אנא השב בעברית.',
  };

  const languageInstruction = languageInstructions[language] || `CRITICAL: You MUST respond in the customer's language (${language}). Write your ENTIRE response in ${language}.`;

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
