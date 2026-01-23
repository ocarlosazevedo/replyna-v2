/**
 * Edge Function: Admin Conversation Details
 *
 * Retorna detalhes de uma conversa e suas mensagens para o admin
 * Bypassa RLS para permitir que o admin veja qualquer conversa
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Obter conversation_id da URL ou body
    const url = new URL(req.url);
    let conversationId = url.searchParams.get('conversation_id');

    if (!conversationId && req.method === 'POST') {
      const body = await req.json();
      conversationId = body.conversation_id;
    }

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: 'conversation_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Buscando conversa:', conversationId);

    // Buscar conversa com dados da loja
    const { data: convData, error: convError } = await supabase
      .from('conversations')
      .select('id, customer_email, customer_name, subject, category, created_at, shop_id, shops(name, imap_user)')
      .eq('id', conversationId)
      .single();

    if (convError) {
      console.error('Erro ao buscar conversa:', convError);
      return new Response(
        JSON.stringify({ error: 'Conversa não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar mensagens
    const { data: msgData, error: msgError } = await supabase
      .from('messages')
      .select('id, direction, from_email, to_email, subject, body_text, body_html, status, was_auto_replied, created_at, category')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (msgError) {
      console.error('Erro ao buscar mensagens:', msgError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar mensagens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extrair dados da loja
    const shopData = (convData as any)?.shops;
    const conversation = {
      id: convData.id,
      customer_email: convData.customer_email,
      customer_name: convData.customer_name,
      subject: convData.subject,
      category: convData.category,
      created_at: convData.created_at,
      shop_id: convData.shop_id,
      shop_email: shopData?.imap_user || (Array.isArray(shopData) ? shopData[0]?.imap_user : null),
      shop_name: shopData?.name || (Array.isArray(shopData) ? shopData[0]?.name : null),
    };

    return new Response(
      JSON.stringify({
        conversation,
        messages: msgData || [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
