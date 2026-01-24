/**
 * Edge Function: process-pending-credits
 *
 * Reprocessa mensagens que estavam aguardando créditos (pending_credits).
 * Deve ser chamada quando o usuário compra créditos extras.
 *
 * Uso:
 * POST /functions/v1/process-pending-credits
 * Body: { "user_id": "uuid" } ou { "shop_id": "uuid" }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id, shop_id } = await req.json();

    if (!user_id && !shop_id) {
      return new Response(
        JSON.stringify({ error: 'user_id ou shop_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar mensagens pending_credits
    let query = supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        conversations!inner(shop_id, shops!inner(user_id))
      `)
      .eq('status', 'pending_credits')
      .eq('direction', 'inbound')
      .order('created_at', { ascending: true })
      .limit(50); // Processar em lotes de 50

    if (user_id) {
      query = query.eq('conversations.shops.user_id', user_id);
    } else if (shop_id) {
      query = query.eq('conversations.shop_id', shop_id);
    }

    const { data: messages, error: messagesError } = await query;

    if (messagesError) {
      console.error('Erro ao buscar mensagens:', messagesError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar mensagens', details: messagesError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhuma mensagem pendente de créditos encontrada',
          processed: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[process-pending-credits] Encontradas ${messages.length} mensagens para reprocessar`);

    // Adicionar mensagens à fila de processamento
    const jobsToInsert = messages.map((msg: any) => ({
      message_id: msg.id,
      shop_id: msg.conversations.shop_id,
      status: 'pending',
      priority: 5, // Prioridade normal
      created_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from('job_queue')
      .insert(jobsToInsert);

    if (insertError) {
      console.error('Erro ao inserir jobs na fila:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao adicionar à fila', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar status das mensagens para 'pending' (aguardando processamento)
    const messageIds = messages.map((m: any) => m.id);
    const { error: updateError } = await supabase
      .from('messages')
      .update({ status: 'pending' })
      .in('id', messageIds);

    if (updateError) {
      console.error('Erro ao atualizar status das mensagens:', updateError);
    }

    console.log(`[process-pending-credits] ${messages.length} mensagens adicionadas à fila`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${messages.length} mensagens adicionadas à fila para reprocessamento`,
        processed: messages.length,
        message_ids: messageIds
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
