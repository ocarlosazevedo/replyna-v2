# Caso Específico: Cancelamento - Jörn Petersen (#15201)

## 📧 Contexto do Email

**Cliente:** Jörn Petersen (nordlicht016@gmail.com)
**Pedido:** #15201
**Loja:** Klarwen (service@klarwen.com)
**Data:** 10/02/2026, 10:00
**Categoria:** Troca/Devolução/Reembolso

**Mensagem do Cliente:**
> "Cancelei o pedido dentro do prazo de 12 horas. Portanto, por favor, não o envie."

---

## ❌ Resposta ERRADA da Replyna

```
Olá Jörn,

Obrigado pela sua mensagem. Recebi seu pedido de cancelamento referente ao pedido nº 15201.

Conforme já informou, você solicita que o pedido não seja mais enviado, pois o cancelou dentro do prazo de 12 horas.

Recebi sua solicitação e garantirei que o pedido não seja mais enviado. ❌

Por favor, confirme se entendi corretamente o seu cancelamento. ❌

Caso tenha mais alguma dúvida, não hesite em me contatar.

Atenciosamente,
Michaela
```

---

## ⚠️ Problemas Identificados

### 1. Promessa Falsa de Garantia
❌ **"garantirei que o pedido não seja mais enviado"**
- A IA **NÃO pode garantir** isso
- Não tem acesso ao sistema de envio
- Cliente vai acreditar que o cancelamento foi processado

### 2. Pedido de Confirmação Indevido
❌ **"Por favor, confirme se entendi corretamente o seu cancelamento"**
- Dá a entender que já fez alguma ação
- Cliente não precisa confirmar - precisa que o pedido seja cancelado!

### 3. Não Encaminhou para Humano
❌ Não usou **[FORWARD_TO_HUMAN]**
❌ Não forneceu o **email de suporte**
❌ Cliente ficou sem saber **como realmente cancelar**

### 4. Falsa Sensação de Resolução
❌ Cliente vai pensar que está tudo resolvido
❌ Pedido vai ser **ENVIADO** de qualquer forma
❌ Cliente vai reclamar que **não cancelaram** mesmo "garantindo"

---

## ✅ Resposta CORRETA

```
[FORWARD_TO_HUMAN] Olá Jörn,

Recebi sua solicitação de cancelamento do pedido #15201.

Para processar o cancelamento dentro do prazo e garantir que o pedido
não seja enviado, por favor entre em contato IMEDIATAMENTE através do
email service@klarwen.com

Nossa equipe irá processar sua solicitação com urgência antes do envio.

Atenciosamente,
Michaela
```

---

## 🔧 Correção Implementada

### Adicionado ao Prompt (anthropic.ts):

```typescript
REGRA ESPECIAL - CANCELAMENTO URGENTE (CRÍTICO):
Se o cliente diz que cancelou dentro do prazo (12 horas, 24 horas, etc.)
e pede para NÃO ENVIAR:

❌ NUNCA diga: "garantirei que o pedido não seja enviado"
❌ NUNCA diga: "vou garantir", "I will ensure", "Ich werde sicherstellen"
❌ NUNCA diga: "recebi e processarei", "already processed"
❌ NUNCA pergunte "confirme se entendi corretamente" como se tivesse feito algo

✅ SEMPRE FAÇA:
1. Adicione [FORWARD_TO_HUMAN] no início da resposta
2. Confirme que recebeu a solicitação
3. Instrua a entrar em contato IMEDIATAMENTE pelo email de suporte
4. Enfatize a urgência para processar antes do envio
5. NÃO prometa que fará algo - apenas encaminhe
```

### Frases Proibidas Adicionadas:
- Português: "garantirei que o pedido não seja enviado", "vou garantir que não seja enviado"
- Inglês: "I will ensure the order is not shipped", "I'll make sure it's not sent"
- Alemão: "Ich werde sicherstellen, dass die Bestellung nicht versendet wird"
- Espanhol: "Me aseguraré de que no se envíe"
- Francês: "Je vais m'assurer qu'elle ne soit pas expédiée"
- Italiano: "Mi assicurerò che non venga spedito"

---

## 📊 Impacto

**Risco ALTO:**
- Cliente acredita que pedido foi cancelado
- Pedido é enviado de qualquer forma
- Cliente reclama: "vocês garantiram que não enviaria!"
- Dano à reputação da loja
- Possível devolução e reembolso forçado
- Perda de confiança do cliente

**Com a correção:**
- Cliente recebe orientação clara
- Entra em contato com suporte
- Cancelamento é processado corretamente
- Expectativa alinhada
- Sem promessas falsas

---

## ✅ Status

- [x] Problema identificado
- [x] Correção implementada no prompt
- [x] Deploy realizado
- [x] Documentação criada
- [ ] Testar com próximo caso similar

**Deploy:** 10/02/2026
**Arquivo:** `supabase/functions/_shared/anthropic.ts`
**Linhas:** ~2138-2172
