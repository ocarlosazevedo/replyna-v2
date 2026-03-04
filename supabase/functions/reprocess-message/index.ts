/**
 * Edge Function: reprocess-message
 *
 * Reprocessa uma mensagem específica após mudança de categoria.
 * Usado quando o usuário muda manualmente a categoria de spam para outra.
 *
 * Input:
 * - conversation_id: ID da conversa
 * - shop_id: ID da loja
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
  getUserById,
  checkCreditsAvailable,
  incrementEmailsUsed,
  saveMessage,
  updateMessage,
  getConversationHistory,
  updateConversation,
  logProcessingEvent,
  type Shop,
  type Message,
  type Conversation,
} from '../_shared/supabase.ts';

import {
  decryptEmailCredentials,
  sendEmail,
  buildReplyHeaders,
  buildReplySubject,
  cleanEmailBody,
} from '../_shared/email.ts';

import {
  decryptShopifyCredentials,
  getOrderDataForAI,
  extractOrderNumber,
  type OrderSummary,
} from '../_shared/shopify.ts';

import {
  generateResponse,
  generateDataRequestMessage,
  classifyEmail,
} from '../_shared/anthropic.ts';

import { getCorsHeaders } from '../_shared/cors.ts';

const MAX_DATA_REQUESTS = 3;

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversation_id, shop_id } = await req.json();

    if (!conversation_id || !shop_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'conversation_id e shop_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();

    // 1. Buscar a loja
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shop_id)
      .single();

    if (shopError || !shop) {
      return new Response(
        JSON.stringify({ success: false, error: 'Loja não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Buscar a conversa
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      return new Response(
        JSON.stringify({ success: false, error: 'Conversa não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if conversation is paused by human reply
    if (conversation.human_paused_until) {
      const pausedUntil = new Date(conversation.human_paused_until);
      if (pausedUntil > new Date()) {
        console.log(`[Reprocess] Conversation ${conversation_id} is paused until ${conversation.human_paused_until} (human replied), skipping`);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Conversa pausada por resposta humana até ${new Date(conversation.human_paused_until).toLocaleDateString('pt-BR')}. A IA não responde enquanto o humano está ativo.`,
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. Buscar a última mensagem inbound pendente
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .eq('direction', 'inbound')
      .in('status', ['pending', 'failed'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (msgError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar mensagem' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhuma mensagem pendente encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const message = messages[0] as Message;

    // 4. Verificar créditos
    const user = await getUserById(shop.user_id);
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasCredits = await checkCreditsAvailable(user.id);
    if (!hasCredits) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sem créditos disponíveis. Faça upgrade do seu plano.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Descriptografar credenciais de email
    const emailCredentials = await decryptEmailCredentials(shop);
    if (!emailCredentials) {
      return new Response(
        JSON.stringify({ success: false, error: 'Credenciais de email não configuradas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback para from_email: usar credentials.user, imap_user ou support_email
    const fromEmail = emailCredentials.user || shop.imap_user || shop.support_email;
    if (!fromEmail) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email de envio não configurado na loja. Configure o IMAP ou email de suporte.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Marcar como processando
    await updateMessage(message.id, { status: 'processing' });

    // 7. Preparar corpo do email
    let cleanBody = cleanEmailBody(message.body_text || '', message.body_html || '');

    // Fallback: extrair texto do HTML se body_text resultou vazio
    if ((!cleanBody || cleanBody.trim().length < 3) && message.body_html && message.body_html.trim().length > 10) {
      console.log(`[Reprocess] body_text vazio mas body_html tem ${message.body_html.length} chars, extraindo texto`);
      const htmlText = message.body_html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      if (htmlText && htmlText.length >= 3) {
        cleanBody = htmlText;
      }
    }

    // Fallback: usar subject
    if ((!cleanBody || cleanBody.trim().length < 3) && message.subject && message.subject.trim().length > 3) {
      cleanBody = `[Cliente respondeu ao email com assunto: ${message.subject}]`;
    }

    if (!cleanBody || cleanBody.trim().length < 3) {
      await updateMessage(message.id, {
        status: 'failed',
        error_message: 'Corpo e assunto do email vazios',
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Corpo do email vazio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Buscar histórico da conversa
    const history = await getConversationHistory(conversation.id, 10);
    const conversationHistory = history.map((m) => ({
      role: m.direction === 'inbound' ? ('customer' as const) : ('assistant' as const),
      content: cleanEmailBody(m.body_text || '', m.body_html || ''),
    }));

    // 9. Buscar dados do Shopify
    let shopifyData: OrderSummary | null = null;
    const shopifyCredentials = await decryptShopifyCredentials(shop);

    if (shopifyCredentials && message.from_email) {
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
        await updateConversation(conversation.id, {
          shopify_order_id: shopifyData.order_number,
          customer_name: shopifyData.customer_name,
        });
      }
    }

    // 10. Classificar email se categoria não existir
    let category = conversation.category || message.category;
    let detectedSentiment: 'calm' | 'frustrated' | 'angry' | 'legal_threat' = 'calm';

    if (!category) {
      console.log(`[Reprocess] Categoria não encontrada, classificando email...`);
      try {
        const classification = await classifyEmail(
          message.subject || '',
          cleanBody,
          conversationHistory,
          message.body_html || undefined,
          conversation.language || null,
          shop.imap_user || shop.support_email || null, // Email da loja para detecção de idioma por domínio
        );
        category = classification.category;
        detectedSentiment = classification.sentiment || 'calm';

        // Atualizar conversa e mensagem com a classificação
        await updateConversation(conversation.id, {
          category: classification.category,
          language: classification.language,
        });
        await updateMessage(message.id, {
          category: classification.category,
        });

        console.log(`[Reprocess] Classificado como: ${classification.category} (confidence: ${classification.confidence}, language: ${classification.language}, sentiment: ${detectedSentiment})`);
      } catch (classifyErr) {
        console.error(`[Reprocess] Erro na classificação, usando duvidas_gerais:`, classifyErr);
        category = 'duvidas_gerais';
      }
    }

    let responseResult: { response: string; tokens_input: number; tokens_output: number };
    let finalStatus: 'replied' | 'pending_human' = 'replied';

    // Categorias que precisam de dados do pedido: rastreio e troca_devolucao_reembolso
    // Categorias que NÃO precisam: duvidas_gerais (perguntas gerais sem pedido)
    const categoriesWithoutOrderData = ['duvidas_gerais'];
    const needsOrderData = !categoriesWithoutOrderData.includes(category);

    if (category === 'suporte_humano' || category === 'edicao_pedido') {
      // Apenas marca como pending_human, sem enviar resposta
      await updateMessage(message.id, {
        status: 'pending_human',
        processed_at: new Date().toISOString(),
      });
      await updateConversation(conversation.id, {
        status: 'pending_human',
        category: category,
        last_message_at: new Date().toISOString(),
      });
      await logProcessingEvent({
        shop_id: shop.id,
        message_id: message.id,
        conversation_id: conversation.id,
        event_type: 'forwarded_to_human',
        event_data: { reason: category === 'edicao_pedido' ? 'edicao_pedido_category' : 'suporte_humano_category', reprocessed: true },
      });
      console.log(`[Reprocess] Mensagem ${message.id} marcada como pending_human (${category})`);
      return new Response(
        JSON.stringify({ success: true, message: 'Marcado para atendimento humano', category, status: 'pending_human' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (!shopifyData && needsOrderData) {
      // CORREÇÃO: Verificar se já temos número de pedido antes de pedir ao cliente
      const knownOrderNumber = conversation.shopify_order_id
        || extractOrderNumber(message.subject || '')
        || extractOrderNumber(cleanBody)
        || extractOrderNumber(message.body_text || '');

      if (knownOrderNumber) {
        // Temos número de pedido mas Shopify não retornou dados - criar contexto mínimo
        shopifyData = {
          order_number: knownOrderNumber.startsWith('#') ? knownOrderNumber : `#${knownOrderNumber}`,
          order_date: '',
          order_status: '',
          order_total: '',
          currency: 'BRL',
          tracking_number: null,
          tracking_url: null,
          fulfillment_status: null,
          items: [],
          customer_name: conversation.customer_name || message.from_name || null,
        };
        console.log(`[reprocess] Order number ${knownOrderNumber} found but Shopify data unavailable, using minimal context`);
      } else if (conversation.data_request_count < MAX_DATA_REQUESTS) {
        responseResult = await generateDataRequestMessage(
          {
            name: shop.name,
            attendant_name: shop.attendant_name,
            tone_of_voice: shop.tone_of_voice,
          },
          message.subject || '',
          cleanBody,
          conversation.data_request_count + 1,
          conversation.language || 'pt-BR'
        );

        await updateConversation(conversation.id, {
          data_request_count: conversation.data_request_count + 1,
        });
      } else {
        // MAX_DATA_REQUESTS excedido - marcar como pending_human sem enviar nada
        await updateMessage(message.id, {
          status: 'pending_human',
          processed_at: new Date().toISOString(),
        });
        await updateConversation(conversation.id, {
          status: 'pending_human',
          category: category,
          last_message_at: new Date().toISOString(),
        });
        await logProcessingEvent({
          shop_id: shop.id,
          message_id: message.id,
          conversation_id: conversation.id,
          event_type: 'forwarded_to_human',
          event_data: { reason: 'max_data_requests_exceeded', reprocessed: true },
        });
        console.log(`[Reprocess] Mensagem ${message.id} marcada como pending_human (max data requests)`);
        return new Response(
          JSON.stringify({ success: true, message: 'Marcado para atendimento humano', category, status: 'pending_human' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Se shopifyData foi preenchido (real ou mínimo) e responseResult não foi setado, gerar resposta
    // @ts-ignore - responseResult pode não estar inicializado se caiu nos branches de shopifyData
    if (!responseResult) {
      const generateArgs = [
        {
          name: shop.name,
          attendant_name: shop.attendant_name,
          tone_of_voice: shop.tone_of_voice,
          store_description: shop.store_description,
          delivery_time: shop.delivery_time,
          dispatch_time: null,
          warranty_info: null,
          signature_html: shop.signature_html,
          is_cod: shop.is_cod,
          store_email: shop.imap_user || shop.support_email,
          // Formulário de devolução — apenas para lojas do Carlos Azevedo (teste)
          return_form_url: shop.user_id === '115571d2-78af-4213-a01b-8a5e3ccf1714'
            ? `https://app.replyna.me/return-request?shop=${shop.id}`
            : null,
        },
        message.subject || '',
        cleanBody,
        category,
        conversationHistory.slice(0, -1),
        shopifyData,
        conversation.language || 'pt-BR',
        0, // retentionContactCount
        [], // additionalOrders
        [], // emailImages
        detectedSentiment, // sentiment detectado na classificação (ou 'calm' como fallback)
        conversation.status, // para loop detection pular exchange_count se pending_human
      ] as const;

      // Retry automático para erros transientes da API (500, 529)
      try {
        responseResult = await generateResponse(...generateArgs);
      } catch (firstErr: any) {
        const is500 = firstErr?.message?.includes('500') || firstErr?.message?.includes('529');
        if (is500) {
          console.log(`[Reprocess] API error, retrying in 2s...`);
          await new Promise(r => setTimeout(r, 2000));
          responseResult = await generateResponse(...generateArgs);
        } else {
          throw firstErr;
        }
      }

      // Se a IA detectou que é terceiro contato de cancelamento, encaminhar para humano
      if (responseResult.forward_to_human) {
        finalStatus = 'pending_human';
      }
    }

    // 11. Enviar email
    const replyHeaders = buildReplyHeaders(message.message_id, message.references_header);
    const replySubject = buildReplySubject(message.subject || conversation.subject || '');

    // Adicionar assinatura se houver
    let finalBody = responseResult.response;
    if (shop.signature_html) {
      finalBody += `\n\n${shop.signature_html}`;
    }

    const sendResult = await sendEmail(emailCredentials, {
      to: message.from_email!,
      subject: replySubject,
      body_text: finalBody,
      in_reply_to: replyHeaders['In-Reply-To'],
      references: replyHeaders['References'],
    });

    if (!sendResult.success) {
      await updateMessage(message.id, {
        status: 'failed',
        error_message: sendResult.error || 'Erro ao enviar email',
      });
      return new Response(
        JSON.stringify({ success: false, error: sendResult.error || 'Erro ao enviar email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 12. Salvar mensagem de resposta
    await saveMessage({
      conversation_id: conversation.id,
      from_email: fromEmail,
      from_name: shop.attendant_name || shop.name,
      to_email: message.from_email!,
      subject: replySubject,
      body_text: finalBody,
      direction: 'outbound',
      status: 'replied',
      was_auto_replied: true,
      message_id: sendResult.message_id,
      in_reply_to: message.message_id,
      tokens_input: responseResult.tokens_input,
      tokens_output: responseResult.tokens_output,
    });

    // 13. Atualizar mensagem original
    await updateMessage(message.id, {
      status: finalStatus === 'replied' ? 'replied' : 'pending_human',
      was_auto_replied: true,
      auto_reply_message_id: sendResult.message_id,
      processed_at: new Date().toISOString(),
      replied_at: new Date().toISOString(),
      tokens_input: responseResult.tokens_input,
      tokens_output: responseResult.tokens_output,
    });

    // 14. Atualizar conversa (inclui categoria resolvida)
    await updateConversation(conversation.id, {
      status: finalStatus === 'replied' ? 'closed' : 'pending_human',
      category: category,
      last_message_at: new Date().toISOString(),
    });

    // 15. Incrementar créditos usados
    await incrementEmailsUsed(user.id);

    // 16. Log de sucesso
    await logProcessingEvent({
      shop_id: shop.id,
      message_id: message.id,
      conversation_id: conversation.id,
      event_type: 'response_sent',
      event_data: {
        reprocessed: true,
        category: category,
        tokens_input: responseResult.tokens_input,
        tokens_output: responseResult.tokens_output,
      },
    });

    console.log(`[Reprocess] Mensagem ${message.id} reprocessada com sucesso`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email reprocessado e resposta enviada com sucesso',
        category: category,
        status: finalStatus,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Reprocess] Erro:', error);
    const errorMsg = error instanceof Error
      ? error.message
      : (typeof error === 'string' ? error : JSON.stringify(error));
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg || 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
