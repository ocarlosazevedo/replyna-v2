// Script para limpar conversas órfãs e criar jobs para as que têm mensagens
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ulldjamxdsaqqyurcmcs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbGRqYW14ZHNhcXF5dXJjbWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ3OTA1NywiZXhwIjoyMDg0MDU1MDU3fQ.M3ib-i9Y_YBopQWM5wEkVK2Oi2Ssf511vWgXeUlrfgs'
);

async function main() {
  console.log('=== ANALISANDO CONVERSAS SEM CATEGORIA ===\n');

  // Buscar TODAS as conversas sem categoria
  const { data: conversations, error } = await supabase
    .from('conversations')
    .select('id, shop_id, customer_email, subject, created_at')
    .is('category', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar conversas:', error);
    return;
  }

  console.log(`Total de conversas sem categoria: ${conversations.length}\n`);

  const orphanIds = [];
  const needsProcessing = [];

  for (const conv of conversations) {
    // Verificar se tem mensagens
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, status')
      .eq('conversation_id', conv.id)
      .limit(1);

    if (msgError) {
      console.error(`Erro ao buscar mensagens para ${conv.id}:`, msgError);
      continue;
    }

    if (messages && messages.length > 0) {
      needsProcessing.push({ conv, message: messages[0] });
    } else {
      orphanIds.push(conv.id);
    }
  }

  console.log(`\n=== RESUMO ===`);
  console.log(`Conversas órfãs (sem mensagens): ${orphanIds.length}`);
  console.log(`Conversas com mensagens (precisam processar): ${needsProcessing.length}\n`);

  // 1. Deletar conversas órfãs em lotes
  if (orphanIds.length > 0) {
    console.log(`\n=== DELETANDO ${orphanIds.length} CONVERSAS ÓRFÃS ===\n`);

    const batchSize = 50;
    let deleted = 0;

    for (let i = 0; i < orphanIds.length; i += batchSize) {
      const batch = orphanIds.slice(i, i + batchSize);
      const { error: delError } = await supabase
        .from('conversations')
        .delete()
        .in('id', batch);

      if (delError) {
        console.error(`Erro ao deletar lote:`, delError);
      } else {
        deleted += batch.length;
        console.log(`Deletadas: ${deleted}/${orphanIds.length}`);
      }
    }

    console.log(`\n✅ ${deleted} conversas órfãs deletadas`);
  }

  // 2. Criar jobs para mensagens pendentes
  if (needsProcessing.length > 0) {
    console.log(`\n=== CRIANDO JOBS PARA ${needsProcessing.length} CONVERSAS ===\n`);

    let jobsCreated = 0;

    for (const { conv, message } of needsProcessing) {
      // Verificar se já existe job para esta mensagem
      const { data: existingJob } = await supabase
        .from('job_queue')
        .select('id')
        .eq('message_id', message.id)
        .in('status', ['pending', 'processing'])
        .single();

      if (existingJob) {
        console.log(`Job já existe para mensagem ${message.id}`);
        continue;
      }

      // Criar job
      const { data: jobId, error: jobError } = await supabase.rpc('enqueue_job', {
        p_job_type: 'process_email',
        p_shop_id: conv.shop_id,
        p_message_id: message.id,
        p_payload: {
          conversation_id: conv.id,
          from_email: conv.customer_email,
          subject: conv.subject,
        },
        p_priority: 0,
        p_max_attempts: 5,
      });

      if (jobError) {
        console.error(`Erro ao criar job para ${message.id}:`, jobError);
      } else {
        jobsCreated++;
        console.log(`✅ Job criado para conversa ${conv.id} (msg ${message.id})`);
      }
    }

    console.log(`\n✅ ${jobsCreated} jobs criados`);
  }

  console.log('\n=== LIMPEZA CONCLUÍDA ===');
}

main().catch(console.error);
