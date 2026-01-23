/**
 * Edge Function: Debug Shops
 *
 * Função para verificar o status das lojas e suas configurações de email.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
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

    // Buscar todas as lojas ativas
    const { data: shops, error: shopsError } = await supabase
      .from('shops')
      .select(`
        id,
        name,
        shopify_domain,
        is_active,
        mail_status,
        imap_host,
        imap_port,
        imap_user,
        smtp_host,
        smtp_port,
        last_email_sync_at,
        email_sync_error,
        user_id,
        created_at
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (shopsError) {
      throw shopsError;
    }

    // Buscar lojas prontas para processar (mail_status = 'ok')
    const { data: readyShops, error: readyError } = await supabase
      .from('shops')
      .select('id, name, imap_host, mail_status')
      .eq('is_active', true)
      .eq('mail_status', 'ok')
      .not('imap_host', 'is', null);

    // Buscar últimos logs de processamento (incluindo logs por loja)
    const { data: logs, error: logsError } = await supabase
      .from('email_processing_logs')
      .select('shop_id, event_type, event_data, error_message, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    // Agrupar logs por shop_id
    const logsByShop: Record<string, any[]> = {};
    for (const log of logs || []) {
      if (log.shop_id) {
        if (!logsByShop[log.shop_id]) {
          logsByShop[log.shop_id] = [];
        }
        logsByShop[log.shop_id].push(log);
      }
    }

    // Buscar mensagens recentes
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, conversation_id, from_email, subject, status, direction, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    // Formatar resposta
    const result = {
      total_active_shops: shops?.length || 0,
      ready_to_process: readyShops?.length || 0,
      shops: (shops || []).map(shop => ({
        name: shop.name,
        domain: shop.shopify_domain,
        mail_status: shop.mail_status,
        imap_host: shop.imap_host,
        imap_port: shop.imap_port,
        imap_user: shop.imap_user ? shop.imap_user.substring(0, 20) + '...' : null,
        smtp_host: shop.smtp_host,
        last_sync: shop.last_email_sync_at,
        sync_error: shop.email_sync_error,
        created_at: shop.created_at,
        recent_logs: (logsByShop[shop.id] || []).slice(0, 3).map(l => ({
          event: l.event_type,
          error: l.error_message,
          time: l.created_at,
        })),
      })),
      ready_shops: (readyShops || []).map(s => s.name),
      recent_logs: (logs || []).slice(0, 20).map(log => ({
        event: log.event_type,
        error: log.error_message,
        time: log.created_at,
      })),
      recent_messages: (messages || []).map(msg => ({
        from: msg.from_email,
        subject: msg.subject?.substring(0, 50),
        status: msg.status,
        direction: msg.direction,
        time: msg.created_at,
      })),
    };

    return new Response(
      JSON.stringify(result, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
