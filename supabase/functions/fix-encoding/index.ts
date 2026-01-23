import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Corrige texto com encoding UTF-8 que foi interpretado como Latin-1
 * Exemplo: "ConfirmaciÃ³n" -> "Confirmacion"
 */
function fixMojibake(text: string | null): string | null {
  if (!text) return text;

  try {
    // Converter string para bytes Latin-1, depois interpretar como UTF-8
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      bytes[i] = text.charCodeAt(i) & 0xff;
    }

    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      const decoded = decoder.decode(bytes);
      // Verificar se a decodificacao fez sentido (nao tem caracteres de controle estranhos)
      if (!/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(decoded)) {
        return decoded;
      }
    } catch {
      // Se falhar, tentar abordagem de substituicao direta
    }

    // Fallback: substituicao direta dos padroes mais comuns
    const replacements: [string, string][] = [
      // Vogais acentuadas minusculas
      ['\u00c3\u00a1', '\u00e1'], // a com acento agudo
      ['\u00c3\u00a9', '\u00e9'], // e com acento agudo
      ['\u00c3\u00ad', '\u00ed'], // i com acento agudo
      ['\u00c3\u00b3', '\u00f3'], // o com acento agudo
      ['\u00c3\u00ba', '\u00fa'], // u com acento agudo
      ['\u00c3\u00a3', '\u00e3'], // a com til
      ['\u00c3\u00b5', '\u00f5'], // o com til
      ['\u00c3\u00a2', '\u00e2'], // a com circunflexo
      ['\u00c3\u00aa', '\u00ea'], // e com circunflexo
      ['\u00c3\u00ae', '\u00ee'], // i com circunflexo
      ['\u00c3\u00b4', '\u00f4'], // o com circunflexo
      ['\u00c3\u00bb', '\u00fb'], // u com circunflexo
      ['\u00c3\u00a0', '\u00e0'], // a com acento grave
      ['\u00c3\u00a8', '\u00e8'], // e com acento grave
      ['\u00c3\u00ac', '\u00ec'], // i com acento grave
      ['\u00c3\u00b2', '\u00f2'], // o com acento grave
      ['\u00c3\u00b9', '\u00f9'], // u com acento grave
      // Cedilha e n com til
      ['\u00c3\u00a7', '\u00e7'], // c cedilha
      ['\u00c3\u00b1', '\u00f1'], // n com til
      // Trema
      ['\u00c3\u00bc', '\u00fc'], // u com trema
    ];

    let fixed = text;
    for (const [pattern, replacement] of replacements) {
      fixed = fixed.split(pattern).join(replacement);
    }

    return fixed;
  } catch {
    return text;
  }
}

/**
 * Verifica se o texto tem sinais de mojibake
 */
function hasMojibake(text: string | null): boolean {
  if (!text) return false;
  // Procura por padroes comuns de UTF-8 mal decodificado (Ã seguido de caractere Latin-1)
  return /\u00c3[\u00a0-\u00bf]/i.test(text);
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
      conversations_fixed: 0,
      messages_checked: 0,
      messages_fixed: 0,
      errors: 0,
    };

    // 1. Corrigir conversations
    console.log('Buscando conversations com possivel mojibake...');
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, subject, customer_name')
      .or('subject.ilike.%\u00c3%,customer_name.ilike.%\u00c3%');

    if (convError) {
      console.error('Erro ao buscar conversations:', convError);
    } else if (conversations) {
      stats.conversations_checked = conversations.length;
      console.log('Encontradas ' + conversations.length + ' conversations para verificar');

      for (const conv of conversations) {
        const needsFix = hasMojibake(conv.subject) || hasMojibake(conv.customer_name);
        if (needsFix) {
          const updates: Record<string, string | null> = {};

          if (hasMojibake(conv.subject)) {
            updates.subject = fixMojibake(conv.subject);
            console.log('Corrigindo subject: ' + conv.subject + ' -> ' + updates.subject);
          }

          if (hasMojibake(conv.customer_name)) {
            updates.customer_name = fixMojibake(conv.customer_name);
            console.log('Corrigindo customer_name: ' + conv.customer_name + ' -> ' + updates.customer_name);
          }

          const { error: updateError } = await supabase
            .from('conversations')
            .update(updates)
            .eq('id', conv.id);

          if (updateError) {
            console.error('Erro ao atualizar conversation ' + conv.id + ':', updateError);
            stats.errors++;
          } else {
            stats.conversations_fixed++;
          }
        }
      }
    }

    // 2. Corrigir messages
    console.log('Buscando messages com possivel mojibake...');
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, subject, body_text, from_name')
      .or('subject.ilike.%\u00c3%,body_text.ilike.%\u00c3%,from_name.ilike.%\u00c3%');

    if (msgError) {
      console.error('Erro ao buscar messages:', msgError);
    } else if (messages) {
      stats.messages_checked = messages.length;
      console.log('Encontradas ' + messages.length + ' messages para verificar');

      for (const msg of messages) {
        const needsFix = hasMojibake(msg.subject) || hasMojibake(msg.body_text) || hasMojibake(msg.from_name);
        if (needsFix) {
          const updates: Record<string, string | null> = {};

          if (hasMojibake(msg.subject)) {
            updates.subject = fixMojibake(msg.subject);
          }

          if (hasMojibake(msg.body_text)) {
            updates.body_text = fixMojibake(msg.body_text);
          }

          if (hasMojibake(msg.from_name)) {
            updates.from_name = fixMojibake(msg.from_name);
          }

          const { error: updateError } = await supabase
            .from('messages')
            .update(updates)
            .eq('id', msg.id);

          if (updateError) {
            console.error('Erro ao atualizar message ' + msg.id + ':', updateError);
            stats.errors++;
          } else {
            stats.messages_fixed++;
          }
        }
      }
    }

    console.log('Migracao de encoding concluida:', stats);

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
