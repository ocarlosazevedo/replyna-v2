import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Extrai o nome do remetente de um campo from_name ou from_email
 */
function extractNameFromEmail(email: string): string | null {
  if (!email) return null;

  // Se o email tem formato "Nome" <email@domain.com> ou Nome <email@domain.com>
  const nameMatch = email.match(/^"?([^"<]+)"?\s*</);
  if (nameMatch && nameMatch[1].trim()) {
    return nameMatch[1].trim();
  }

  // Se for apenas email, extrair a parte antes do @
  const atIndex = email.indexOf('@');
  if (atIndex > 0) {
    const localPart = email.substring(0, atIndex);
    // Converter underscores e pontos em espacos, capitalizar
    const name = localPart
      .replace(/[._]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return name;
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const stats = {
      conversations_checked: 0,
      conversations_updated: 0,
      errors: 0,
    };

    // 1. Buscar todas as conversations sem customer_name ou com customer_name vazio
    console.log('Buscando conversations sem nome de cliente...');
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, customer_email, customer_name')
      .or('customer_name.is.null,customer_name.eq.');

    if (convError) {
      console.error('Erro ao buscar conversations:', convError);
      throw convError;
    }

    if (!conversations || conversations.length === 0) {
      console.log('Nenhuma conversation sem nome encontrada');
      return new Response(JSON.stringify({
        success: true,
        message: 'Nenhuma conversation para atualizar',
        stats,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    stats.conversations_checked = conversations.length;
    console.log('Encontradas ' + conversations.length + ' conversations sem nome');

    // 2. Para cada conversation, buscar a primeira mensagem inbound e extrair o nome
    for (const conv of conversations) {
      try {
        // Buscar a primeira mensagem inbound desta conversation
        const { data: messages, error: msgError } = await supabase
          .from('messages')
          .select('from_name, from_email')
          .eq('conversation_id', conv.id)
          .eq('direction', 'inbound')
          .order('created_at', { ascending: true })
          .limit(1);

        if (msgError) {
          console.error('Erro ao buscar mensagens para conversation ' + conv.id + ':', msgError);
          stats.errors++;
          continue;
        }

        if (!messages || messages.length === 0) {
          continue;
        }

        const message = messages[0];
        let customerName: string | null = null;

        // Prioridade 1: from_name da mensagem
        if (message.from_name && message.from_name.trim()) {
          customerName = message.from_name.trim();
        }
        // Prioridade 2: extrair do from_email
        else if (message.from_email) {
          customerName = extractNameFromEmail(message.from_email);
        }
        // Prioridade 3: extrair do customer_email da conversation
        else if (conv.customer_email) {
          customerName = extractNameFromEmail(conv.customer_email);
        }

        if (customerName) {
          console.log('Atualizando conversation ' + conv.id + ' com nome: ' + customerName);

          const { error: updateError } = await supabase
            .from('conversations')
            .update({ customer_name: customerName })
            .eq('id', conv.id);

          if (updateError) {
            console.error('Erro ao atualizar conversation ' + conv.id + ':', updateError);
            stats.errors++;
          } else {
            stats.conversations_updated++;
          }
        }
      } catch (err) {
        console.error('Erro ao processar conversation ' + conv.id + ':', err);
        stats.errors++;
      }
    }

    console.log('Migracao de nomes concluida:', stats);

    return new Response(JSON.stringify({
      success: true,
      stats,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na migracao:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
