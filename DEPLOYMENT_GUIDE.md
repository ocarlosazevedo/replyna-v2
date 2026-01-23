# Guia de Deployment - Arquitetura de Ultra Escala

## 🎯 Objetivo

Implementar arquitetura queue-based para processar **500-5.000 emails/hora** com zero perda de mensagens.

---

## ✅ O Que Foi Criado

### Migrations
- ✅ **021_job_queue_system.sql** - Tabelas + Funções (APLICADA)
- ⏳ **022_setup_queue_cron_jobs.sql** - Cron jobs (PENDENTE)

### Edge Functions
- ✅ **fetch-emails** - Ingestion worker (CRIADA, deploy pendente)
- ✅ **process-queue** - Processing worker (CRIADA, deploy pendente)

### Arquitetura
```
IMAP → fetch-emails → job_queue → process-queue → SMTP
         (5 min)        (DB)        (1 min)
```

---

## 📋 Passos de Deployment

### Passo 1: Deploy das Edge Functions ⏳

```bash
# Deploy fetch-emails
npx supabase functions deploy fetch-emails

# Deploy process-queue
npx supabase functions deploy process-queue
```

**Verificar sucesso:**
```bash
# Teste manual do fetch-emails
curl -X POST "https://ulldjamxdsaqqyurcmcs.supabase.co/functions/v1/fetch-emails" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbGRqYW14ZHNhcXF5dXJjbWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ3OTA1NywiZXhwIjoyMDg0MDU1MDU3fQ.M3ib-i9Y_YBopQWM5wEkVK2Oi2Ssf511vWgXeUlrfgs"

# Teste manual do process-queue
curl -X POST "https://ulldjamxdsaqqyurcmcs.supabase.co/functions/v1/process-queue" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbGRqYW14ZHNhcXF5dXJjbWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ3OTA1NywiZXhwIjoyMDg0MDU1MDU3fQ.M3ib-i9Y_YBopQWM5wEkVK2Oi2Ssf511vWgXeUlrfgs"
```

---

### Passo 2: Aplicar Migration 022 ⏳

**Via Supabase Dashboard:**
1. Abrir [SQL Editor](https://supabase.com/dashboard/project/ulldjamxdsaqqyurcmcs/sql/new)
2. Copiar conteúdo de `supabase/migrations/022_setup_queue_cron_jobs.sql`
3. Clicar em **Run**
4. Verificar sucesso (sem erros)

**Verificar cron jobs criados:**
```sql
-- Ver todos os cron jobs
SELECT * FROM cron.job ORDER BY jobname;

-- Deverá mostrar:
-- - fetch-emails-cron (*/5 * * * *)
-- - process-queue-cron (* * * * *)
-- - aggregate-queue-metrics-cron (*/5 * * * *)
-- - cleanup-completed-jobs-cron (0 3 * * *)
-- - cleanup-stuck-jobs-cron (*/15 * * * *)
```

---

### Passo 3: Monitorar Primeiras Execuções ⏳

**Aguardar 1-5 minutos e verificar:**

```sql
-- Ver execuções recentes dos cron jobs
SELECT
    j.jobname,
    r.status,
    r.start_time,
    r.end_time,
    r.return_message
FROM cron.job_run_details r
JOIN cron.job j ON r.jobid = j.jobid
WHERE j.jobname LIKE '%queue%'
  OR j.jobname LIKE '%fetch-emails%'
ORDER BY r.start_time DESC
LIMIT 20;

-- Ver jobs na fila
SELECT
    status,
    COUNT(*) as total
FROM job_queue
GROUP BY status
ORDER BY total DESC;

-- Deverá mostrar jobs sendo criados e processados
```

---

## 🧪 Testes End-to-End

### Teste 1: Ingestion Manual

```bash
# Forçar ingestion agora
curl -X POST "https://ulldjamxdsaqqyurcmcs.supabase.co/functions/v1/fetch-emails" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbGRqYW14ZHNhcXF5dXJjbWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ3OTA1NywiZXhwIjoyMDg0MDU1MDU3fQ.M3ib-i9Y_YBopQWM5wEkVK2Oi2Ssf511vWgXeUlrfgs"
```

**Verificar:**
```sql
-- Jobs criados?
SELECT * FROM job_queue WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10;

-- Messages salvas?
SELECT * FROM messages WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10;
```

---

### Teste 2: Processing Manual

```bash
# Forçar processing agora
curl -X POST "https://ulldjamxdsaqqyurcmcs.supabase.co/functions/v1/process-queue" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbGRqYW14ZHNhcXF5dXJjbWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ3OTA1NywiZXhwIjoyMDg0MDU1MDU3fQ.M3ib-i9Y_YBopQWM5wEkVK2Oi2Ssf511vWgXeUlrfgs"
```

**Verificar:**
```sql
-- Jobs processados?
SELECT * FROM job_queue WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 10;

-- Messages respondidas?
SELECT * FROM messages WHERE status = 'replied' ORDER BY replied_at DESC LIMIT 10;
```

---

### Teste 3: Retry Logic

**Forçar erro em um job:**
```sql
-- Marcar job para retry
SELECT fail_job(
    'JOB_ID_AQUI'::UUID,
    'Teste de retry',
    'test_error',
    NULL,
    true  -- is_retryable
);

-- Ver se foi para retry com backoff
SELECT
    id,
    status,
    attempt_count,
    next_retry_at,
    error_message
FROM job_queue
WHERE id = 'JOB_ID_AQUI'::UUID;

-- Status deve ser 'pending' com next_retry_at no futuro
```

---

### Teste 4: Dead Letter Queue

**Simular max retries:**
```sql
-- Atualizar job para ter 5 tentativas
UPDATE job_queue
SET attempt_count = 5
WHERE id = 'JOB_ID_AQUI'::UUID;

-- Forçar falha (irá para DLQ)
SELECT fail_job(
    'JOB_ID_AQUI'::UUID,
    'Max retries exceeded test',
    'test_error',
    NULL,
    true
);

-- Verificar DLQ
SELECT * FROM job_queue WHERE status = 'dead_letter';

-- Requeue manualmente
SELECT requeue_dlq_job('JOB_ID_AQUI'::UUID, true);
```

---

## 📊 Monitoramento

### Queries Úteis

```sql
-- Dashboard de saúde da fila
SELECT
    status,
    COUNT(*) as total,
    AVG(processing_time_ms) as avg_time_ms,
    MAX(created_at) as last_created
FROM job_queue
GROUP BY status
ORDER BY total DESC;

-- Emails processados por hora
SELECT
    date_trunc('hour', completed_at) as hour,
    COUNT(*) as emails_processed
FROM job_queue
WHERE status = 'completed'
  AND completed_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- Erros por tipo
SELECT
    error_type,
    COUNT(*) as total,
    MAX(last_error_at) as last_occurrence
FROM job_queue
WHERE status IN ('failed', 'dead_letter')
  AND last_error_at > NOW() - INTERVAL '24 hours'
GROUP BY error_type
ORDER BY total DESC;

-- Performance metrics
SELECT
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY processing_time_ms) as p50_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_ms) as p95_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY processing_time_ms) as p99_ms,
    AVG(processing_time_ms) as avg_ms,
    MAX(processing_time_ms) as max_ms
FROM job_queue
WHERE status = 'completed'
  AND completed_at > NOW() - INTERVAL '1 hour';
```

---

## 🚨 Troubleshooting

### Problema: Jobs ficam stuck em 'processing'

**Causa:** Edge Function timeout ou crash

**Solução:**
```sql
-- Cron job cleanup-stuck-jobs-cron já faz isso automaticamente
-- Mas pode forçar manualmente:
UPDATE job_queue
SET status = 'pending', next_retry_at = NOW()
WHERE status = 'processing'
  AND started_at < NOW() - INTERVAL '1 hour';
```

---

### Problema: Muitos jobs em DLQ

**Causa:** Erro permanente (API key inválida, SMTP down, etc)

**Diagnóstico:**
```sql
-- Ver erros mais comuns
SELECT error_type, error_message, COUNT(*)
FROM job_queue
WHERE status = 'dead_letter'
GROUP BY error_type, error_message
ORDER BY COUNT(*) DESC;
```

**Solução:**
1. Corrigir problema root cause (API key, credentials, etc)
2. Requeue jobs da DLQ:
```sql
-- Requeue todos os jobs da DLQ de um erro específico
DO $$
DECLARE
    job_rec RECORD;
BEGIN
    FOR job_rec IN
        SELECT id FROM job_queue
        WHERE status = 'dead_letter'
        AND error_type = 'smtp_error'  -- Ajustar tipo
    LOOP
        PERFORM requeue_dlq_job(job_rec.id, true);
    END LOOP;
END $$;
```

---

### Problema: Rate limit errors

**Causa:** Processando muito rápido (>50k tokens/min na API Claude)

**Solução:**
```sql
-- Reduzir batch size temporariamente
-- Editar no código: BATCH_SIZE de 50 para 25

-- Ou adicionar delay entre batches (não implementado ainda)
```

---

## 🔄 Rollback (se necessário)

**Se precisar voltar para sistema antigo:**

```sql
-- Desabilitar novos cron jobs
SELECT cron.unschedule('fetch-emails-cron');
SELECT cron.unschedule('process-queue-cron');
SELECT cron.unschedule('aggregate-queue-metrics-cron');
SELECT cron.unschedule('cleanup-completed-jobs-cron');
SELECT cron.unschedule('cleanup-stuck-jobs-cron');

-- Reabilitar cron antigo (se existir)
-- SELECT cron.schedule(...) -- Ver migration 003
```

---

## 📈 Próximos Passos (Futuro)

1. **Dashboard UI** - Componente React para visualizar métricas
2. **Alertas** - Email/Slack quando DLQ > threshold
3. **Circuit Breaker Implementation** - Usar tabela circuit_breakers
4. **Priority Queue** - Emails urgentes com prioridade alta
5. **Multi-tenant Isolation** - Rate limiting por shop

---

## ✅ Checklist Final

- [ ] Deploy fetch-emails Edge Function
- [ ] Deploy process-queue Edge Function
- [ ] Aplicar migration 022 (cron jobs)
- [ ] Aguardar 5 minutos e verificar primeiras execuções
- [ ] Testar ingestion manual (curl fetch-emails)
- [ ] Testar processing manual (curl process-queue)
- [ ] Verificar jobs na fila (SQL queries)
- [ ] Verificar emails sendo respondidos
- [ ] Monitorar por 1 hora
- [ ] Desabilitar cron antigo (opcional)
- [ ] Documentar em ULTRA_SCALE_IMPLEMENTATION.md

---

**Suporte:** Documentação completa em `ULTRA_SCALE_IMPLEMENTATION.md`
