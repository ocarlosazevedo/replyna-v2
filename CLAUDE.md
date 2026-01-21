# Replyna V2 - Contexto do Projeto

## Credenciais Supabase

- **Project URL**: https://ulldjamxdsaqqyurcmcs.supabase.co
- **Anon Key**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbGRqYW14ZHNhcXF5dXJjbWNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0NzkwNTcsImV4cCI6MjA4NDA1NTA1N30.DltrwCFHcK-VqLrzxIPyuZuf6_19QYmdLciTy_LCOgE
- **Service Role Key**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbGRqYW14ZHNhcXF5dXJjbWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ3OTA1NywiZXhwIjoyMDg0MDU1MDU3fQ.M3ib-i9Y_YBopQWM5wEkVK2Oi2Ssf511vWgXeUlrfgs
- **Secret Key**: sb_secret_jL8UvpQZom9j4YFe-0q08g_dCZcczVU

## Edge Functions

Deploy de Edge Functions:
```bash
npx supabase functions deploy <function-name>
```

Invocar Edge Functions:
```bash
curl -X POST "https://ulldjamxdsaqqyurcmcs.supabase.co/functions/v1/<function-name>" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbGRqYW14ZHNhcXF5dXJjbWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ3OTA1NywiZXhwIjoyMDg0MDU1MDU3fQ.M3ib-i9Y_YBopQWM5wEkVK2Oi2Ssf511vWgXeUlrfgs" \
  -H "Content-Type: application/json"
```

## Estrutura do Projeto

- `/src` - Frontend React
- `/supabase/functions` - Edge Functions (Deno)
- `/supabase/migrations` - Migrações SQL
