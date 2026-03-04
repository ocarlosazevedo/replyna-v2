/**
 * Edge Function: send-reply
 *
 * Envia uma resposta manual do usuário para o cliente.
 * Não consome créditos. Anexa assinatura HTML da loja automaticamente.
 *
 * Input:
 * - conversation_id: ID da conversa
 * - shop_id: ID da loja
 * - reply_text: Texto da resposta (plain text)
 * - attachments?: Array<{ filename, content_type, url }> (opcional)
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
  saveMessage,
  updateConversation,
  logProcessingEvent,
  type Shop,
  type Message,
} from '../_shared/supabase.ts';

import {
  decryptEmailCredentials,
  sendEmail,
  buildReplyHeaders,
  buildReplySubject,
} from '../_shared/email.ts';

import { getCorsHeaders } from '../_shared/cors.ts';

const MAX_REPLY_LENGTH = 10000;

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Parse e validar inputs
    const { conversation_id, shop_id, reply_text, attachments } = await req.json();

    if (!conversation_id || !shop_id || !reply_text) {
      return new Response(
        JSON.stringify({ success: false, error: 'conversation_id, shop_id e reply_text são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedText = reply_text.trim();
    if (!trimmedText) {
      return new Response(
        JSON.stringify({ success: false, error: 'O texto da resposta não pode estar vazio' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (trimmedText.length > MAX_REPLY_LENGTH) {
      return new Response(
        JSON.stringify({ success: false, error: `O texto não pode exceder ${MAX_REPLY_LENGTH} caracteres` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();

    // 2. Buscar a loja
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shop_id)
      .single();

    if (shopError || !shop) {
      return new Response(
        JSON.stringify({ success: false, error: 'Loja não encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Buscar a conversa
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversation_id)
      .eq('shop_id', shop_id)
      .single();

    if (convError || !conversation) {
      return new Response(
        JSON.stringify({ success: false, error: 'Conversa não encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Buscar a última mensagem inbound (para threading)
    const { data: lastInbound } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // 5. Marcar TODAS mensagens inbound pendentes como 'replied'
    // Previne a IA de responder em paralelo
    await supabase
      .from('messages')
      .update({
        status: 'replied',
        was_auto_replied: false,
        processed_at: new Date().toISOString(),
        replied_at: new Date().toISOString(),
      })
      .eq('conversation_id', conversation_id)
      .eq('direction', 'inbound')
      .in('status', ['pending', 'processing', 'pending_credits']);

    // 6. Descriptografar credenciais SMTP
    const emailCredentials = await decryptEmailCredentials(shop as Shop);
    if (!emailCredentials) {
      return new Response(
        JSON.stringify({ success: false, error: 'Credenciais de email não configuradas para esta loja' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Construir headers de threading
    const replyHeaders = buildReplyHeaders(
      lastInbound?.message_id || null,
      lastInbound?.references_header || null
    );
    const replySubject = buildReplySubject(
      conversation.subject || lastInbound?.subject || null
    );

    // 8. Montar body com assinatura
    let emailBody = trimmedText;
    if ((shop as Shop).signature_html) {
      emailBody = trimmedText + '\n\n' + (shop as Shop).signature_html;
    }

    // Destinatário: email do último inbound ou customer_email da conversa
    const recipientEmail = lastInbound?.from_email || conversation.customer_email;
    const fromName = (shop as Shop).attendant_name || (shop as Shop).name;

    // 9. Validar anexos (se enviados)
    const validAttachments = Array.isArray(attachments)
      ? attachments.filter(
          (a: { filename?: string; content_type?: string; url?: string }) =>
            a && a.filename && a.content_type && a.url
        ).slice(0, 10) // Máximo 10 anexos
      : [];

    // 10. Enviar via SMTP
    const sendResult = await sendEmail(emailCredentials, {
      to: recipientEmail,
      subject: replySubject,
      body_text: emailBody,
      in_reply_to: lastInbound?.message_id || undefined,
      references: replyHeaders.references || undefined,
      from_name: fromName,
      attachments: validAttachments.length > 0 ? validAttachments : undefined,
    });

    if (!sendResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: `Erro ao enviar email: ${sendResult.error}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 10. Salvar mensagem outbound no banco
    await saveMessage({
      conversation_id: conversation.id,
      from_email: emailCredentials.smtp_user || (shop as Shop).imap_user || '',
      from_name: fromName,
      to_email: recipientEmail,
      subject: replySubject,
      body_text: trimmedText, // Armazena sem assinatura para exibição limpa
      direction: 'outbound',
      status: 'replied',
      was_auto_replied: false,
      message_id: sendResult.message_id || null,
      in_reply_to: lastInbound?.message_id || null,
      references_header: replyHeaders.references || null,
      processed_at: new Date().toISOString(),
      replied_at: new Date().toISOString(),
    } as any);

    // 11. Atualizar conversa (pausa IA por 7 dias)
    const pauseUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await updateConversation(conversation.id, {
      last_message_at: new Date().toISOString(),
      ticket_status: 'answered',
      human_paused_until: pauseUntil,
    } as any);

    // 12. Registrar log
    await logProcessingEvent({
      shop_id: shop.id,
      conversation_id: conversation.id,
      event_type: 'response_sent' as any,
      event_data: {
        type: 'manual_reply',
        reply_length: trimmedText.length,
        recipient: recipientEmail,
        attachment_count: validAttachments.length,
      },
    });

    console.log(`[send-reply] Resposta manual enviada para ${recipientEmail} na conversa ${conversation.id}`);

    // Montar resposta com info de anexos
    const responseData: Record<string, any> = {
      success: true,
      message: 'Resposta enviada com sucesso',
      message_id: sendResult.message_id,
    };

    // Avisar se algum anexo falhou no download
    if (sendResult.attachments_requested && sendResult.attachments_requested > 0) {
      responseData.attachments_requested = sendResult.attachments_requested;
      responseData.attachments_sent = sendResult.attachments_sent ?? 0;
    }

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[send-reply] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erro interno do servidor' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
