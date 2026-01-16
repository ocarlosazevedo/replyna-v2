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
const MODEL = 'claude-3-5-sonnet-20241022';
const MAX_TOKENS = 500;

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
  const systemPrompt = `Você é um classificador de emails de atendimento ao cliente para e-commerce.

Sua tarefa é analisar o email e retornar um JSON com:
1. category: categoria do email (uma das opções abaixo)
2. confidence: confiança na classificação (0.0 a 1.0)
3. language: idioma do email (pt-BR, en, es, etc.)
4. order_id_found: número do pedido se mencionado (ex: #12345, 12345), ou null
5. summary: resumo de 1 linha do que o cliente quer

CATEGORIAS DISPONÍVEIS:
- rastreio: Perguntas sobre onde está o pedido, código de rastreio, status de entrega
- reembolso: Pedidos de devolução, cancelamento, estorno, troca de produto
- produto: Dúvidas sobre tamanho, cor, disponibilidade, especificações do produto
- pagamento: Problemas com boleto, cartão recusado, parcelamento, nota fiscal
- entrega: Endereço errado, ausente na entrega, problema com transportadora
- suporte_humano: APENAS SE o cliente pedir EXPLICITAMENTE para falar com humano/atendente/gerente, OU fizer ameaça legal (advogado, Procon, processo)
- outros: Não se encaixa em nenhuma categoria acima

IMPORTANTE:
- Cliente irritado NÃO é suporte_humano (a menos que peça explicitamente)
- Reclamação sobre produto ou entrega NÃO é suporte_humano
- Se tiver dúvida, escolha a categoria mais provável, não suporte_humano

Responda APENAS com o JSON, sem texto adicional.`;

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
      language: 'pt-BR',
      order_id_found: null,
      summary: 'Não foi possível classificar o email',
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
  } | null
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
- Status: ${shopifyData.order_status || 'N/A'}
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

  const systemPrompt = `Você é ${shopContext.attendant_name}, atendente virtual da loja ${shopContext.name}.

${tone}

${storeInfo}
${shopifyContext}

CATEGORIA DO EMAIL: ${category}

REGRAS:
1. Responda de forma clara e objetiva
2. Use as informações do pedido quando disponíveis
3. Se não souber algo específico, diga que vai verificar
4. Não invente informações - use apenas os dados fornecidos
5. Máximo 400 palavras
6. Não use markdown ou formatação especial
7. Assine apenas com seu nome no final

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
    response: response.content[0]?.text || '',
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
  attemptNumber: number
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

Seja breve e direto. Máximo 100 palavras.
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
    response: response.content[0]?.text || '',
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
  customerName: string | null
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

  // Gerar mensagem padrão
  const toneInstructions: Record<string, string> = {
    professional: 'Use tom profissional e formal.',
    friendly: 'Use tom amigável e empático.',
    casual: 'Use tom casual mas respeitoso.',
    enthusiastic: 'Use tom positivo e acolhedor.',
  };

  const tone = toneInstructions[shopContext.tone_of_voice] || toneInstructions.friendly;

  const systemPrompt = `Você é ${shopContext.attendant_name}, atendente virtual da loja ${shopContext.name}.

${tone}

O caso do cliente será encaminhado para atendimento humano.
Gere uma mensagem curta (máximo 80 palavras) informando que:
1. Você recebeu a mensagem e entende a importância
2. O caso foi encaminhado para a equipe especializada
3. Eles receberão retorno em breve

Não mencione prazos específicos (ex: "24 horas").
Nome do cliente: ${customerName || 'Cliente'}`;

  const response = await callClaude(
    systemPrompt,
    [{ role: 'user', content: 'Gere a mensagem de encaminhamento para atendimento humano.' }],
    150
  );

  return {
    response: response.content[0]?.text || '',
    tokens_input: response.usage.input_tokens,
    tokens_output: response.usage.output_tokens,
  };
}
