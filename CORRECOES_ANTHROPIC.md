# Correções dos Problemas Identificados no Relatório de Avaliação

## Problema 1: Comunicação interna e acionamento de equipes

**Problema:** Bot diz "vou verificar com a equipe de logística" mas não faz isso.

**Solução:**
- Adicionar regras MAIS FORTES proibindo frases como:
  - "vou verificar com a equipe"
  - "vou consultar a logística"
  - "vou entrar em contato com o setor de envios"
  - "I will check with our logistics team"
  - "Ich werde mit unserem Logistikteam sprechen"

- Instruir o bot a APENAS fornecer informações baseadas nos dados do Shopify
- Se não tiver a informação, fornecer o email de suporte ao invés de prometer verificar

## Problema 2: Alucinação e mudança de idioma

**Problema:** Bot muda de alemão para inglês no meio da conversa.

**Solução:**
- Fortalecer a instrução de idioma no INÍCIO do prompt (já existe mas precisa ser mais forte)
- Adicionar verificação TRIPLA:
  1. Detectar idioma do ASSUNTO do email atual
  2. Detectar idioma do CORPO do email atual
  3. IGNORAR completamente o idioma do histórico
- Adicionar avisos explícitos:
  ```
  CRITICAL WARNING:
  - The conversation history may contain messages in DIFFERENT languages
  - You MUST respond in the SAME language as the customer's CURRENT message
  - DO NOT switch languages mid-conversation
  - Example: If history is in Portuguese but current message is in German → respond in GERMAN
  ```

## Problema 3: Inconsistência no tratamento de casos simples

**Problema:** Para casos simples (cliente recebeu 1 de 3 carros), às vezes responde bem, às vezes escalona desnecessariamente.

**Solução:**
- Adicionar contexto no campo `store_description` da loja:
  ```
  "Vendemos kits de 3 produtos que são enviados em pacotes SEPARADOS.
  Quando o cliente reclamar que recebeu apenas 1 pacote, tranquilize-o
  informando que os outros pacotes estão a caminho e que é normal chegarem
  em datas diferentes. NÃO escale para atendimento humano nesse caso."
  ```
- Este contexto já está suportado no código (linhas 1716-1726)
- ORIENTAR O CLIENTE a usar este campo para casos específicos do negócio

## Problema 4: E-mails ignorados

**Problema:** Alguns emails foram "visualizados" mas não respondidos nem escalonados.

**Investigação NECESSÁRIA:**
- Verificar se esses emails têm `status='pending'` no banco
- Verificar se há jobs criados para essas mensagens
- Verificar se há erros de processamento nos logs
- Possível causa: emails sem `from_email` válido ou categorizados como spam

**Solução:**
- Investigar cada caso específico mencionado no relatório
- Verificar logs de processamento
- Criar jobs manualmente se necessário

## Problema 5: Promessa indevida de reembolso

**Problema:** Bot prometeu reembolso sem autorização.

**Solução:**
- Fortalecer regras existentes (linhas 2069-2080):
  ```
  - NUNCA diga "processarei um reembolso"
  - NUNCA diga "vou processar o reembolso"
  - NUNCA diga "você receberá o reembolso em X dias"
  - NUNCA diga "o reembolso foi aprovado"
  - NUNCA diga "seu reembolso está sendo processado"
  ```
- Adicionar exemplos de frases PROIBIDAS em TODOS os idiomas:
  - Português: "vou processar seu reembolso"
  - Inglês: "I will process your refund"
  - Alemão: "Ich werde Ihre Rückerstattung bearbeiten"
  - Espanhol: "Voy a procesar tu reembolso"
- Instruir a SEMPRE encaminhar casos de reembolso para suporte humano após 3 contatos de retenção

## Implementação das Correções

### 1. Editar `anthropic.ts`
- Adicionar seção "FRASES PROIBIDAS - TODOS OS IDIOMAS" com exemplos multilíngues
- Fortalecer instrução de idioma
- Adicionar regra específica para "verificar com equipe"

### 2. Orientar clientes
- Informar sobre o campo `store_description` para casos específicos
- Exemplo de uso para kits enviados separadamente

### 3. Investigar casos específicos
- Verificar os emails mencionados no relatório
- Analisar logs de processamento
- Identificar padrões de falha
