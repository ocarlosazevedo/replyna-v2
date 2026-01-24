// Script para verificar conversas órfãs
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ulldjamxdsaqqyurcmcs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbGRqYW14ZHNhcXF5dXJjbWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ3OTA1NywiZXhwIjoyMDg0MDU1MDU3fQ.M3ib-i9Y_YBopQWM5wEkVK2Oi2Ssf511vWgXeUlrfgs'
);

async function main() {
  // Buscar conversas sem categoria
  const { data: conversations, error } = await supabase
    .from('conversations')
    .select('id, customer_email, subject, created_at')
    .is('category', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Erro ao buscar conversas:', error);
    return;
  }

  console.log(`Total de conversas sem categoria: ${conversations.length}`);

  let withMessages = 0;
  let withoutMessages = 0;
  const orphanIds = [];

  for (const conv of conversations) {
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conv.id)
      .limit(1);

    if (msgError) {
      console.error(`Erro ao buscar mensagens para ${conv.id}:`, msgError);
      continue;
    }

    if (messages && messages.length > 0) {
      withMessages++;
      console.log(`✅ ${conv.id} - ${conv.customer_email} - TEM mensagens`);
    } else {
      withoutMessages++;
      orphanIds.push(conv.id);
      console.log(`❌ ${conv.id} - ${conv.customer_email} - SEM mensagens (órfã)`);
    }
  }

  console.log('\n=== RESUMO ===');
  console.log(`Com mensagens: ${withMessages}`);
  console.log(`Sem mensagens (órfãs): ${withoutMessages}`);
  console.log(`IDs órfãs: ${orphanIds.length}`);
}

main().catch(console.error);
