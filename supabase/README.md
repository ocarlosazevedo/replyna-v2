# Replyna V2 - Backend Setup

## Estrutura de Arquivos

```
supabase/
├── functions/
│   ├── _shared/              # Módulos compartilhados
│   │   ├── encryption.ts     # Encriptação AES-256
│   │   ├── supabase.ts       # Cliente Supabase server-side
│   │   ├── anthropic.ts      # Cliente Claude AI
│   │   ├── email.ts          # IMAP/SMTP helpers
│   │   └── shopify.ts        # Integração Shopify
│   ├── process-emails/       # Edge Function principal (cron)
│   │   └── index.ts
│   └── migrate-passwords/    # Migração de senhas
│       └── index.ts
└── migrations/
    ├── 001_email_processing_schema.sql
    ├── 002_encrypt_existing_passwords.sql
    └── 003_setup_cron.sql
```

## Setup Passo a Passo

### 1. Configurar Variáveis de Ambiente

No Supabase Dashboard > Project Settings > Edge Functions, adicione:

```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
ANTHROPIC_API_KEY=sk-ant-...
EMAIL_ENCRYPTION_KEY=<gere com: openssl rand -hex 32>
```

### 2. Executar Migrations no Banco

Vá em SQL Editor no Supabase Dashboard e execute na ordem:

1. `001_email_processing_schema.sql` - Cria tabelas e funções
2. `002_encrypt_existing_passwords.sql` - Prepara migração de senhas
3. `003_setup_cron.sql` - Configura pg_cron

### 3. Deploy das Edge Functions

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Linkar projeto
supabase link --project-ref seu-projeto-ref

# Deploy das funções
supabase functions deploy process-emails
supabase functions deploy migrate-passwords
```

### 4. Migrar Senhas Existentes

Após configurar `EMAIL_ENCRYPTION_KEY`, execute:

```bash
curl -X POST https://seu-projeto.supabase.co/functions/v1/migrate-passwords \
  -H "Authorization: Bearer seu-anon-key"
```

Verifique o resultado:
```sql
SELECT * FROM get_encryption_migration_stats();
SELECT * FROM shops_pending_encryption;
```

### 5. Configurar Cron (Opção A - Supabase)

No Supabase Dashboard > Edge Functions > process-emails:

1. Clique em "Schedule"
2. Configure: `*/15 * * * *` (a cada 15 minutos)
3. Ative

### 5. Configurar Cron (Opção B - Vercel)

Adicione em `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/process-emails",
    "schedule": "*/15 * * * *"
  }]
}
```

Crie `/api/cron/process-emails.ts`:

```typescript
export default async function handler(req, res) {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/functions/v1/process-emails`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      },
    }
  );
  const data = await response.json();
  res.json(data);
}
```

## Monitoramento

### Verificar Saúde do Sistema

```sql
SELECT * FROM get_system_health();
```

### Ver Logs de Processamento

```sql
SELECT * FROM email_processing_logs
ORDER BY created_at DESC
LIMIT 50;
```

### Ver Execuções do Cron

```sql
SELECT * FROM cron_execution_log
ORDER BY started_at DESC
LIMIT 20;
```

### Ver Emails Pendentes

```sql
SELECT * FROM messages
WHERE status = 'pending'
ORDER BY created_at;
```

## Fluxo de Processamento

```
1. pg_cron dispara a cada 15 min
   ↓
2. Edge Function busca lojas ativas
   ↓
3. Para cada loja:
   a. Conecta IMAP
   b. Busca emails não lidos
   c. Salva no banco (status: pending)
   d. Agrupa em conversations
   ↓
4. Para cada mensagem pending:
   a. Verifica créditos
   b. Verifica rate limit
   c. Classifica com Claude
   d. Busca dados Shopify
   e. Gera resposta com Claude
   f. Envia via SMTP
   g. Atualiza status
   ↓
5. Log de eventos
```

## Categorias de Email

| Categoria | Descrição |
|-----------|-----------|
| rastreio | Onde está meu pedido?, código de rastreio |
| reembolso | Devolução, cancelamento, estorno |
| produto | Dúvidas sobre tamanho, cor, disponibilidade |
| pagamento | Problemas com boleto, cartão, parcelamento |
| entrega | Endereço errado, ausente, transportadora |
| suporte_humano | Pedido explícito de humano, ameaça legal |
| outros | Não se encaixa nas anteriores |

## Status de Mensagens

| Status | Descrição |
|--------|-----------|
| pending | Aguardando processamento |
| processing | Sendo processado |
| replied | Respondido com sucesso |
| pending_credits | Sem créditos |
| pending_human | Encaminhado para humano |
| failed | Erro no processamento |

## Rate Limiting

- 3 respostas por hora para o mesmo cliente
- Cooldown de 60 segundos entre respostas
- 100 emails processados por loja/hora

## Troubleshooting

### Emails não estão sendo processados

1. Verificar se a loja está ativa: `is_active = true`
2. Verificar se email está configurado: `mail_status = 'ok'`
3. Verificar logs: `SELECT * FROM email_processing_logs WHERE event_type = 'error'`

### Erro de conexão IMAP

1. Verificar credenciais encriptadas existem
2. Testar conexão manualmente no endpoint `/api/test-email`
3. Verificar se a porta 993 não está bloqueada

### Claude não está respondendo

1. Verificar `ANTHROPIC_API_KEY` está configurada
2. Verificar logs para erros de API
3. Verificar limites de uso da API

### Senhas não decriptam

1. Verificar `EMAIL_ENCRYPTION_KEY` é a mesma usada na migração
2. Re-executar migração se necessário
