/**
 * Edge Function: Delete Shop
 *
 * Deleta uma loja e todos os dados relacionados em etapas
 * para evitar timeout do PostgREST.
 *
 * Autenticação: JWT do usuário (verifica ownership) ou service_role
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';

const BATCH_SIZE = 100;

async function deleteBatch(
  supabase: ReturnType<typeof createClient>,
  table: string,
  column: string,
  values: string[]
): Promise<number> {
  let totalDeleted = 0;
  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const batch = values.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from(table)
      .delete()
      .in(column, batch);
    if (error) {
      console.error(`Erro ao deletar batch de ${table}:`, error);
    } else {
      totalDeleted += batch.length;
    }
  }
  return totalDeleted;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Client com service role para deletar dados
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verificar autenticação do usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { shopId } = await req.json();

    if (!shopId) {
      return new Response(
        JSON.stringify({ error: 'shopId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se a loja pertence ao usuário
    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('id, name, user_id')
      .eq('id', shopId)
      .single();

    if (shopError || !shop) {
      return new Response(
        JSON.stringify({ error: 'Loja não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (shop.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Você não tem permissão para deletar esta loja' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Iniciando exclusão da loja: ${shop.name} (${shopId})`);

    // 1. Buscar todas as conversas da loja
    const { data: conversations } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('shop_id', shopId);

    const conversationIds = conversations?.map(c => c.id) || [];

    // 2. Deletar mensagens em batches
    if (conversationIds.length > 0) {
      const deleted = await deleteBatch(supabaseAdmin, 'messages', 'conversation_id', conversationIds);
      console.log(`Mensagens deletadas: ${deleted} batches processados`);
    }

    // 3. Deletar email_processing_logs
    const { error: logsError } = await supabaseAdmin
      .from('email_processing_logs')
      .delete()
      .eq('shop_id', shopId);
    if (logsError) console.error('Erro ao deletar logs:', logsError);
    else console.log('Logs deletados');

    // 4. Deletar conversas em batches
    if (conversationIds.length > 0) {
      const deleted = await deleteBatch(supabaseAdmin, 'conversations', 'id', conversationIds);
      console.log(`Conversas deletadas: ${deleted} batches processados`);
    }

    // 5. Deletar rate_limits
    const { error: rateLimitsError } = await supabaseAdmin
      .from('rate_limits')
      .delete()
      .eq('shop_id', shopId);
    if (rateLimitsError) console.error('Erro ao deletar rate limits:', rateLimitsError);

    // 6. Deletar job_queue
    const { error: jobQueueError } = await supabaseAdmin
      .from('job_queue')
      .delete()
      .eq('shop_id', shopId);
    if (jobQueueError) console.error('Erro ao deletar job queue:', jobQueueError);

    // 7. Deletar circuit_breakers
    const { error: cbError } = await supabaseAdmin
      .from('circuit_breakers')
      .delete()
      .eq('shop_id', shopId);
    if (cbError) console.error('Erro ao deletar circuit breakers:', cbError);

    // 8. Deletar queue_metrics
    const { error: metricsError } = await supabaseAdmin
      .from('queue_metrics')
      .delete()
      .eq('shop_id', shopId);
    if (metricsError) console.error('Erro ao deletar queue metrics:', metricsError);

    // 9. Deletar shop_products_cache
    const { error: productsError } = await supabaseAdmin
      .from('shop_products_cache')
      .delete()
      .eq('shop_id', shopId);
    if (productsError) console.error('Erro ao deletar products cache:', productsError);

    // 10. Deletar a loja
    const { error: shopDeleteError } = await supabaseAdmin
      .from('shops')
      .delete()
      .eq('id', shopId);

    if (shopDeleteError) {
      console.error('Erro ao deletar loja:', shopDeleteError);
      throw new Error(`Erro ao deletar loja: ${shopDeleteError.message}`);
    }

    console.log(`Loja deletada com sucesso: ${shop.name} (${shopId})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Loja deletada com sucesso',
        deletedShop: shop.name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao deletar loja:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao deletar loja' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
