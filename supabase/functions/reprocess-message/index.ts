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
  generateHumanFallbackMessage,
} from '../_shared/anthropic.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_DATA_REQUESTS = 3;

Deno.serve(async (req) => {
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

    // 6. Marcar como processando
    await updateMessage(message.id, { status: 'processing' });

    // 7. Preparar corpo do email
    let cleanBody = cleanEmailBody(message.body_text || '', message.body_html || '');
    if ((!cleanBody || cleanBody.trim().length < 3) && message.subject && message.subject.trim().length > 3) {
      cleanBody = message.subject;
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
    const history = await getConversationHistory(conversation.id, 3);
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

    // 10. Gerar resposta baseada na categoria
    const category = conversation.category || message.category || 'duvidas_gerais';
    let responseResult: { response: string; tokens_input: number; tokens_output: number };
    let finalStatus: 'replied' | 'pending_human' = 'replied';

    // Categorias que precisam de dados do pedido: rastreio e troca_devolucao_reembolso
    // Categorias que NÃO precisam: duvidas_gerais (perguntas gerais sem pedido)
    const categoriesWithoutOrderData = ['duvidas_gerais'];
    const needsOrderData = !categoriesWithoutOrderData.includes(category);

    if (category === 'suporte_humano') {
      responseResult = await generateHumanFallbackMessage(
        {
          name: shop.name,
          attendant_name: shop.attendant_name,
          support_email: shop.support_email,
          tone_of_voice: shop.tone_of_voice,
          fallback_message_template: shop.fallback_message_template,
        },
        shopifyData?.customer_name || conversation.customer_name,
        conversation.language || 'pt-BR'
      );
      finalStatus = 'pending_human';
    } else if (!shopifyData && needsOrderData && conversation.data_request_count < MAX_DATA_REQUESTS) {
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
    } else if (!shopifyData && needsOrderData && conversation.data_request_count >= MAX_DATA_REQUESTS) {
      responseResult = await generateHumanFallbackMessage(
        {
          name: shop.name,
          attendant_name: shop.attendant_name,
          support_email: shop.support_email,
          tone_of_voice: shop.tone_of_voice,
          fallback_message_template: shop.fallback_message_template,
        },
        null,
        conversation.language || 'pt-BR'
      );
      finalStatus = 'pending_human';
    } else {
      responseResult = await generateResponse(
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
        },
        message.subject || '',
        cleanBody,
        category,
        conversationHistory.slice(0, -1),
        shopifyData,
        conversation.language || 'pt-BR'
      );

      // Se a IA detectou que é terceiro contato de cancelamento, encaminhar para humano
      if (responseResult.forward_to_human) {
        finalStatus = 'pending_human';
      }
    }

    // 11. Enviar email
    const replyHeaders = buildReplyHeaders(message);
    const replySubject = buildReplySubject(message.subject || conversation.subject || '');

    // Adicionar assinatura se houver
    let finalBody = responseResult.response;
    if (shop.signature_html) {
      finalBody += `\n\n${shop.signature_html}`;
    }

    const sendResult = await sendEmail(emailCredentials, {
      to: message.from_email!,
      subject: replySubject,
      body: finalBody,
      headers: replyHeaders,
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
      from_email: emailCredentials.user,
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

    // 14. Atualizar conversa
    await updateConversation(conversation.id, {
      status: finalStatus === 'replied' ? 'closed' : 'pending_human',
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
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
