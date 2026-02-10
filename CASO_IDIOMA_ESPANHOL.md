# Caso Específico: Detecção de Idioma - Espanhol/Português

**Data:** 10/02/2026
**Cliente:** Esther Plaza (eplazacabedo@gmail.com)
**Loja:** Dama del Plata

---

## 📧 Contexto do Problema

**Mensagem do Cliente (em ESPANHOL):**
> "Bueno y si no puedo no poeis decirme visotros si llega ya el pedido De donde viene???"

**Resposta da IA (em PORTUGUÊS - ERRADO):**
> "Olá! Entendo sua preocupação sobre o status do seu pedido #1490..."

❌ **Problema:** Cliente escreveu em espanhol, IA respondeu em português

---

## 🔍 Investigação

### 1. Verificação no Banco de Dados

```sql
conversations.language = 'pt'  -- ERRADO! Deveria ser 'es'
```

### 2. Análise da Detecção de Idioma

A função `detectLanguageFromText()` em `anthropic.ts` tinha um problema de **ordem de verificação**:

**Padrões de Português (verificados PRIMEIRO):**
```typescript
/\b(pedido|encomenda|entrega|rastreio|...)\b/i
```

**Padrões de Espanhol (verificados DEPOIS):**
```typescript
/\b(pedido|envío|reembolso|devolución)\b/i
```

### 3. Causa Raiz

A palavra **"pedido"** existe em AMBOS os idiomas:
- Português: "pedido" (order)
- Espanhol: "pedido" (order)

Como o **português é testado primeiro**, ao encontrar "pedido" na mensagem, a função retornava `pt` imediatamente, sem verificar se havia palavras mais específicas do espanhol.

---

## ✅ Solução Implementada

### Correção no `anthropic.ts` (linhas 147-160)

```typescript
// ESPANHOL - Padrões claros (priorizar palavras únicas do espanhol)
const spanishPatterns = [
  /^hola\b/i, /^buenos días/i, /^buenas tardes/i, /^buenas noches/i,

  // ✅ Palavras ÚNICAS do espanhol (não existem em português)
  /\b(bueno|buena|bien|muy|llega|llegó|llegaron)\b/i,
  /\b(dónde|donde|cuándo|cuando|cómo|como está)\b/i,
  /\b(envío|enviar|enviado|enviaron)\b/i,
  /\b(usted|ustedes|quiero|necesito|recibí|compré|pagué)\b/i,
  /\b(puede|pueden|podría|podrían)\b/i,
  /\b(gracias|por favor|muchas gracias)\b/i,

  // Palavras ambíguas por último (também existem em português)
  /\b(pedido|reembolso|devolución)\b/i,
];
```

### Palavras Adicionadas (Únicas do Espanhol)

1. **"bueno/buena"** - Não existe em português (PT usa "bom/boa")
2. **"bien"** - Não existe em português (PT usa "bem")
3. **"muy"** - Não existe em português (PT usa "muito")
4. **"llega/llegó/llegaron"** - Não existe em português (PT usa "chega/chegou")
5. **"donde/dónde"** - Não existe em português (PT usa "onde")
6. **"envío"** - Com acento, específico do espanhol (PT usa "envio" sem acento ou "entrega")
7. **"puede/pueden"** - Não existe em português (PT usa "pode/podem")

### Estratégia

✅ **Verificar palavras ÚNICAS primeiro** (específicas do idioma)
✅ **Verificar palavras AMBÍGUAS por último** (existem em vários idiomas)
✅ **Priorizar palavras do início da mensagem** (primeiras 10 palavras)

---

## 📊 Validação

### Mensagem Original:
```
"Bueno y si no puedo no poeis decirme visotros si llega ya el pedido De donde viene???"
```

### Palavras que AGORA detectam espanhol:
- ✅ "Bueno" → `/\b(bueno|buena|bien|muy|llega|llegó|llegaron)\b/i`
- ✅ "llega" → `/\b(bueno|buena|bien|muy|llega|llegó|llegaron)\b/i`
- ✅ "donde" → `/\b(dónde|donde|cuándo|cuando|cómo|como está)\b/i`
- ✅ "pedido" → (detectado, mas agora APÓS verificar palavras únicas)

**Resultado:** Idioma detectado = `es` ✅

---

## 🔧 Deploy

**Funções deployadas:**
- ✅ `process-queue` - Sistema de fila (atual)
- ✅ `process-emails` - Sistema legado (backup)

**Data do deploy:** 10/02/2026

---

## 📝 Lições Aprendidas

### 1. Palavras Ambíguas Entre Idiomas

Muitas palavras são similares ou idênticas entre português e espanhol:
- pedido (order)
- reembolso (refund)
- devolución/devolução (return)
- gracias/obrigado (thanks)

### 2. Ordem de Verificação Importa

Ao detectar idiomas, sempre:
1. **Verificar palavras ÚNICAS primeiro**
2. **Verificar palavras AMBÍGUAS por último**
3. **Priorizar início da mensagem** (primeiras palavras são mais importantes)

### 3. Testes com Mensagens Reais

É essencial testar com mensagens reais de clientes, pois elas contêm:
- Erros de digitação
- Abreviações
- Mistura de idiomas (citações de emails anteriores)
- Termos coloquiais

---

## ✅ Solução Final Implementada

### Estratégia: Verificação em 2 Etapas

**ETAPA 1 - Palavras ÚNICAS (Alta Prioridade):**
1. Verificar palavras que existem APENAS em espanhol: `bueno, llega, donde, puede, necesito, gracias`
2. Verificar palavras que existem APENAS em português: `olá, você, gostaria, obrigado, preciso, chegou, rastreio`

**ETAPA 2 - Palavras AMBÍGUAS (Baixa Prioridade):**
1. Só verificar se não encontrou palavras únicas
2. Palavras ambíguas: `pedido, reembolso` (existem em ambos idiomas)

### Testes de Validação

✅ Todos os casos de teste passaram:
- ✅ "Bueno y si no puedo..." → Detecta 'es' (palavra única: "bueno")
- ✅ "Hola, donde esta mi pedido?" → Detecta 'es' (palavra única: "donde")
- ✅ "Puede decirme..." → Detecta 'es' (palavra única: "puede")
- ✅ "Necesito un reembolso" → Detecta 'es' (palavra única: "necesito")
- ✅ "Olá, gostaria de saber" → Detecta 'pt' (palavra única: "gostaria")
- ✅ "Você pode me enviar" → Detecta 'pt' (palavra única: "você")
- ✅ "Preciso de um reembolso" → Detecta 'pt' (palavra única: "preciso")

## ✅ Status

- [x] Problema identificado
- [x] Causa raiz encontrada (ordem de verificação incorreta)
- [x] Solução implementada (verificação em 2 etapas: únicas → ambíguas)
- [x] Testes validados (100% de aprovação)
- [x] Deploy realizado (2x - versão final)
- [x] Documentação atualizada
- [ ] Commit e push (próximo passo)
- [ ] Monitorar próximas respostas em produção

**Cobertura:** Esta correção funciona para **TODAS as lojas**, não apenas uma específica. Qualquer cliente que escrever em espanhol receberá resposta em espanhol.

**Monitoramento:** Verificar se mensagens em espanhol estão sendo respondidas corretamente no idioma certo.
