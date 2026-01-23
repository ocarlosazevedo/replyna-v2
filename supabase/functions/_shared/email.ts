/**
 * Módulo de Email - IMAP e SMTP
 * Funções para ler e enviar emails
 *
 * Usa fetch para IMAP (sem bibliotecas externas problemáticas)
 */

import { decrypt, getEncryptionKey } from './encryption.ts';

// Tipos
export interface EmailCredentials {
  imap_host: string;
  imap_port: number;
  imap_user: string;
  imap_password: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
}

export interface IncomingEmail {
  message_id: string;
  from_email: string;
  from_name: string | null;
  reply_to: string | null; // Email de Reply-To (pode ser diferente do From)
  to_email: string;
  subject: string; // Sempre tem valor, default "(Sem assunto)" se vazio
  body_text: string | null;
  body_html: string | null;
  in_reply_to: string | null;
  references: string | null;
  received_at: Date;
  has_attachments: boolean;
  attachment_count: number;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  body_text: string;
  body_html?: string;
  in_reply_to?: string;
  references?: string;
  from_name?: string;
}

/**
 * Decripta as credenciais de email de uma loja
 */
export async function decryptEmailCredentials(shop: {
  imap_host: string | null;
  imap_port: string | null;
  imap_user: string | null;
  imap_password: string | null;
  imap_password_encrypted: string | null;
  smtp_host: string | null;
  smtp_port: string | null;
  smtp_user: string | null;
  smtp_password: string | null;
  smtp_password_encrypted: string | null;
}): Promise<EmailCredentials | null> {
  if (!shop.imap_host || !shop.imap_user) {
    return null;
  }

  const encryptionKey = getEncryptionKey();

  // Preferir senha encriptada, fallback para texto puro (migração pendente)
  let imapPassword = '';
  if (shop.imap_password_encrypted) {
    imapPassword = await decrypt(shop.imap_password_encrypted, encryptionKey);
  } else if (shop.imap_password) {
    imapPassword = shop.imap_password;
  }

  let smtpPassword = '';
  if (shop.smtp_password_encrypted) {
    smtpPassword = await decrypt(shop.smtp_password_encrypted, encryptionKey);
  } else if (shop.smtp_password) {
    smtpPassword = shop.smtp_password;
  } else {
    // SMTP geralmente usa mesma senha do IMAP
    smtpPassword = imapPassword;
  }

  if (!imapPassword) {
    return null;
  }

  return {
    imap_host: shop.imap_host,
    imap_port: parseInt(shop.imap_port || '993', 10),
    imap_user: shop.imap_user,
    imap_password: imapPassword,
    smtp_host: shop.smtp_host || shop.imap_host.replace('imap.', 'smtp.'),
    smtp_port: parseInt(shop.smtp_port || '465', 10),
    smtp_user: shop.smtp_user || shop.imap_user,
    smtp_password: smtpPassword,
  };
}

/**
 * Classe simples de cliente IMAP usando Deno.connect
 */
class SimpleImapClient {
  private conn: Deno.TlsConn | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private tagCounter = 0;
  private buffer = '';

  constructor(
    private host: string,
    private port: number,
    private user: string,
    private password: string
  ) {}

  private getTag(): string {
    return `A${++this.tagCounter}`;
  }

  private encode(text: string): Uint8Array {
    return new TextEncoder().encode(text);
  }

  private decode(data: Uint8Array): string {
    return new TextDecoder().decode(data);
  }

  async connect(): Promise<void> {
    this.conn = await Deno.connectTls({
      hostname: this.host,
      port: this.port,
    });

    this.reader = this.conn.readable.getReader();
    this.writer = this.conn.writable.getWriter();

    // Ler greeting
    await this.readResponse();

    // Login
    const loginTag = this.getTag();
    await this.sendCommand(`${loginTag} LOGIN "${this.user}" "${this.password}"`);
    const loginResponse = await this.readUntilTag(loginTag);

    if (!loginResponse.includes('OK')) {
      throw new Error('Login failed: ' + loginResponse);
    }
  }

  private async sendCommand(command: string): Promise<void> {
    if (!this.writer) throw new Error('Not connected');
    await this.writer.write(this.encode(command + '\r\n'));
  }

  private async readResponse(): Promise<string> {
    if (!this.reader) throw new Error('Not connected');

    const { value, done } = await this.reader.read();
    if (done || !value) return '';

    return this.decode(value);
  }

  private async readUntilTag(tag: string): Promise<string> {
    let response = '';
    const maxIterations = 100;
    let iterations = 0;

    while (iterations < maxIterations) {
      const chunk = await this.readResponse();
      response += chunk;

      // Verificar se recebemos a resposta completa (linha com o tag)
      if (response.includes(`${tag} OK`) || response.includes(`${tag} NO`) || response.includes(`${tag} BAD`)) {
        break;
      }
      iterations++;
    }

    return response;
  }

  async selectInbox(): Promise<{ exists: number }> {
    const tag = this.getTag();
    await this.sendCommand(`${tag} SELECT INBOX`);
    const response = await this.readUntilTag(tag);

    // Extrair número de mensagens
    const existsMatch = response.match(/\* (\d+) EXISTS/);
    const exists = existsMatch ? parseInt(existsMatch[1], 10) : 0;

    return { exists };
  }

  async searchUnseen(): Promise<number[]> {
    const tag = this.getTag();
    await this.sendCommand(`${tag} SEARCH UNSEEN`);
    const response = await this.readUntilTag(tag);

    // Parse dos UIDs
    const searchMatch = response.match(/\* SEARCH([\d\s]*)/);
    if (!searchMatch || !searchMatch[1].trim()) return [];

    return searchMatch[1].trim().split(/\s+/).map(n => parseInt(n, 10)).filter(n => !isNaN(n));
  }

  async fetchMessage(uid: number): Promise<{
    envelope: {
      messageId: string;
      from: string;
      fromName: string | null;
      replyTo: string | null;
      to: string;
      subject: string;
      date: string;
    };
    body: string;
    inReplyTo: string;
    references: string;
  }> {
    const tag = this.getTag();
    // Buscar headers From, To, Subject, Message-ID, Reply-To diretamente além do corpo
    await this.sendCommand(`${tag} FETCH ${uid} (BODY[HEADER.FIELDS (From To Subject Message-ID Date In-Reply-To References Reply-To)] BODY[TEXT])`);
    const response = await this.readUntilTag(tag);

    console.log('IMAP FETCH response (primeiros 2000 chars):', response.substring(0, 2000));

    let messageId = '';
    let from = '';
    let fromName: string | null = null;
    let replyTo: string | null = null;
    let to = '';
    let subject = '';
    let date = '';
    let inReplyTo = '';
    let references = '';
    let body = '';

    // Extrair headers
    const headerMatch = response.match(/BODY\[HEADER\.FIELDS[^\]]*\]\s*\{(\d+)\}\r\n([\s\S]*?)(?=BODY\[TEXT\]|\)\r\n)/i);
    if (headerMatch) {
      const headers = headerMatch[2];
      console.log('Headers extraídos:', headers);

      // From: "Name" <email@domain.com> ou From: email@domain.com
      const fromHeaderMatch = headers.match(/^From:\s*(.+?)(?:\r?\n(?!\s)|\r?\n$)/im);
      if (fromHeaderMatch) {
        const fromValue = fromHeaderMatch[1].trim();
        // Extrair email do formato "Name" <email> ou apenas email
        const emailMatch = fromValue.match(/<([^>]+)>/) || fromValue.match(/([^\s<>]+@[^\s<>]+)/);
        if (emailMatch) {
          from = emailMatch[1].toLowerCase();
        }
        // Extrair nome do remetente
        // Formatos: "Nome Sobrenome" <email>, Nome Sobrenome <email>, =?UTF-8?B?...?= <email>
        const nameMatch = fromValue.match(/^"?([^"<]+)"?\s*</);
        if (nameMatch && nameMatch[1].trim()) {
          // Decodificar nome se estiver em MIME encoding
          fromName = this.decodeSubject(nameMatch[1].trim());
        }
        console.log('From extraído:', from, 'Nome:', fromName, 'do valor:', fromValue);
      }

      // To
      const toHeaderMatch = headers.match(/^To:\s*(.+?)(?:\r?\n(?!\s)|\r?\n$)/im);
      if (toHeaderMatch) {
        const toValue = toHeaderMatch[1].trim();
        const emailMatch = toValue.match(/<([^>]+)>/) || toValue.match(/([^\s<>]+@[^\s<>]+)/);
        if (emailMatch) {
          to = emailMatch[1].toLowerCase();
        }
      }

      // Subject (pode ter encoding)
      const subjectHeaderMatch = headers.match(/^Subject:\s*(.+?)(?:\r?\n(?!\s)|\r?\n$)/im);
      if (subjectHeaderMatch) {
        subject = this.decodeSubject(subjectHeaderMatch[1].trim());
      }

      // Message-ID
      const msgIdHeaderMatch = headers.match(/^Message-ID:\s*(<[^>]+>)/im);
      if (msgIdHeaderMatch) {
        messageId = msgIdHeaderMatch[1];
      }

      // Date
      const dateHeaderMatch = headers.match(/^Date:\s*(.+?)(?:\r?\n(?!\s)|\r?\n$)/im);
      if (dateHeaderMatch) {
        date = dateHeaderMatch[1].trim();
      }

      // In-Reply-To
      const inReplyMatch = headers.match(/^In-Reply-To:\s*(<[^>]+>)/im);
      if (inReplyMatch) {
        inReplyTo = inReplyMatch[1];
      }

      // References
      const refMatch = headers.match(/^References:\s*(.+?)(?:\r?\n(?!\s)|\r?\n$)/im);
      if (refMatch) {
        references = refMatch[1].trim();
      }

      // Reply-To
      const replyToMatch = headers.match(/^Reply-To:\s*(.+?)(?:\r?\n(?!\s)|\r?\n$)/im);
      if (replyToMatch) {
        const replyToValue = replyToMatch[1].trim();
        const emailMatch = replyToValue.match(/<([^>]+)>/) || replyToValue.match(/([^\s<>]+@[^\s<>]+)/);
        if (emailMatch) {
          replyTo = emailMatch[1].toLowerCase();
        }
        console.log('Reply-To extraído:', replyTo, 'do valor:', replyToValue);
      }
    }

    // Extrair corpo
    const bodyMatch = response.match(/BODY\[TEXT\]\s*\{(\d+)\}\r\n([\s\S]*?)(?=\)\r\n|\r\n\))/);
    if (bodyMatch) {
      body = bodyMatch[2];
    }

    return {
      envelope: {
        messageId: messageId || `<${Date.now()}.${Math.random()}@generated>`,
        from,
        fromName,
        replyTo,
        to,
        subject,
        date: date || new Date().toISOString(),
      },
      body,
      inReplyTo,
      references,
    };
  }

  private decodeSubject(subject: string): string {
    // Decodificar =?UTF-8?B?...?= ou =?UTF-8?Q?...?=
    return subject.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (_, charset, encoding, text) => {
      try {
        const normalizedCharset = charset.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (encoding.toUpperCase() === 'B') {
          // Base64 decode - converter para bytes e depois para string UTF-8
          const binaryString = atob(text);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          // Usar TextDecoder para decodificar corretamente UTF-8
          const decoder = new TextDecoder(normalizedCharset === 'utf8' || normalizedCharset === 'utf-8' ? 'utf-8' : charset);
          return decoder.decode(bytes);
        } else {
          // Quoted-Printable - converter bytes hex para UTF-8
          const processedText = text.replace(/_/g, ' ');
          const bytes: number[] = [];
          let i = 0;
          while (i < processedText.length) {
            if (processedText[i] === '=' && i + 2 < processedText.length) {
              const hex = processedText.substring(i + 1, i + 3);
              if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
                bytes.push(parseInt(hex, 16));
                i += 3;
                continue;
              }
            }
            bytes.push(processedText.charCodeAt(i));
            i++;
          }
          const decoder = new TextDecoder(normalizedCharset === 'utf8' || normalizedCharset === 'utf-8' ? 'utf-8' : charset);
          return decoder.decode(new Uint8Array(bytes));
        }
      } catch {
        return text;
      }
    });
  }

  async markAsSeen(uid: number): Promise<void> {
    const tag = this.getTag();
    await this.sendCommand(`${tag} STORE ${uid} +FLAGS (\\Seen)`);
    await this.readUntilTag(tag);
  }

  async logout(): Promise<void> {
    try {
      const tag = this.getTag();
      await this.sendCommand(`${tag} LOGOUT`);
      await this.readUntilTag(tag);
    } catch {
      // Ignorar erros no logout
    } finally {
      try {
        this.reader?.releaseLock();
        this.writer?.releaseLock();
        this.conn?.close();
      } catch {
        // Ignorar erros ao fechar
      }
    }
  }

  /**
   * Seleciona uma pasta (mailbox)
   */
  async selectMailbox(mailbox: string): Promise<boolean> {
    const tag = this.getTag();
    await this.sendCommand(`${tag} SELECT "${mailbox}"`);
    const response = await this.readUntilTag(tag);
    return response.includes(`${tag} OK`);
  }

  /**
   * Lista as mailboxes disponíveis
   */
  async listMailboxes(): Promise<string[]> {
    const tag = this.getTag();
    await this.sendCommand(`${tag} LIST "" "*"`);
    const response = await this.readUntilTag(tag);

    const mailboxes: string[] = [];
    const lines = response.split('\r\n');
    for (const line of lines) {
      const match = line.match(/\* LIST \([^)]*\) "[^"]*" "?([^"\r\n]+)"?/);
      if (match) {
        mailboxes.push(match[1]);
      }
    }
    return mailboxes;
  }

  /**
   * Append uma mensagem a uma mailbox (para salvar em Sent)
   */
  async appendMessage(mailbox: string, message: string, flags: string[] = ['\\Seen']): Promise<boolean> {
    const tag = this.getTag();
    const flagsStr = flags.length > 0 ? `(${flags.join(' ')})` : '';
    const messageBytes = new TextEncoder().encode(message);

    // APPEND command com literal
    await this.sendCommand(`${tag} APPEND "${mailbox}" ${flagsStr} {${messageBytes.length}}`);

    // Aguardar continuation request (+)
    let response = await this.readResponse();
    if (!response.includes('+')) {
      // Ler mais se necessário
      response += await this.readResponse();
    }

    if (!response.includes('+')) {
      console.error('APPEND: Não recebeu continuation request:', response);
      return false;
    }

    // Enviar o conteúdo da mensagem
    if (!this.writer) throw new Error('Not connected');
    await this.writer.write(new TextEncoder().encode(message + '\r\n'));

    // Aguardar resposta final
    const finalResponse = await this.readUntilTag(tag);
    return finalResponse.includes(`${tag} OK`);
  }
}

/**
 * Busca emails não lidos via IMAP
 * @param credentials - Credenciais de email
 * @param maxEmails - Número máximo de emails a buscar
 * @param emailStartDate - Data mínima para processar emails (opcional). Emails anteriores a esta data serão ignorados.
 */
export async function fetchUnreadEmails(
  credentials: EmailCredentials,
  maxEmails: number = 50,
  emailStartDate?: Date | null
): Promise<IncomingEmail[]> {
  const client = new SimpleImapClient(
    credentials.imap_host,
    credentials.imap_port,
    credentials.imap_user,
    credentials.imap_password
  );

  const emails: IncomingEmail[] = [];

  try {
    console.log(`Conectando ao IMAP ${credentials.imap_host}:${credentials.imap_port}...`);
    await client.connect();
    console.log('Conectado! Selecionando INBOX...');

    const { exists } = await client.selectInbox();
    console.log(`INBOX tem ${exists} mensagens. Buscando não lidas...`);

    const unseenIds = await client.searchUnseen();
    console.log(`Encontradas ${unseenIds.length} mensagens não lidas`);

    // Limitar ao máximo
    const idsToFetch = unseenIds.slice(0, maxEmails);

    for (const uid of idsToFetch) {
      try {
        const msg = await client.fetchMessage(uid);
        const receivedAt = new Date(msg.envelope.date);

        // Filtrar por data se emailStartDate estiver definida
        if (emailStartDate && receivedAt < emailStartDate) {
          console.log(`Ignorando email ${uid} (${msg.envelope.subject}) - data ${receivedAt.toISOString()} anterior a ${emailStartDate.toISOString()}`);
          // Marcar como lida para não processar novamente
          await client.markAsSeen(uid);
          continue;
        }

        // Decodificar o corpo (texto e HTML)
        const decodedBody = decodeEmailBodyFull(msg.body);
        const bodyText = cleanEmailBody(decodedBody.text);

        emails.push({
          message_id: msg.envelope.messageId,
          from_email: msg.envelope.from,
          from_name: msg.envelope.fromName,
          reply_to: msg.envelope.replyTo,
          to_email: credentials.imap_user,
          subject: msg.envelope.subject?.trim() || '(Sem assunto)',
          body_text: bodyText || null,
          body_html: decodedBody.html,
          in_reply_to: msg.inReplyTo || null,
          references: msg.references || null,
          received_at: receivedAt,
          has_attachments: decodedBody.hasAttachments,
          attachment_count: decodedBody.attachmentCount,
        });

        // Marcar como lida
        await client.markAsSeen(uid);
        console.log(`Processada mensagem ${uid}: ${msg.envelope.subject}`);
      } catch (msgError) {
        console.error(`Erro ao processar mensagem ${uid}:`, msgError);
      }
    }
  } finally {
    await client.logout();
  }

  return emails;
}

/**
 * Decodifica quoted-printable para UTF-8
 */
function decodeQuotedPrintable(text: string, charset: string = 'utf-8'): string {
  // Remover soft line breaks primeiro
  const withoutSoftBreaks = text.replace(/=\r?\n/g, '');

  // Coletar todos os bytes (hex sequences viram bytes, resto vira ASCII)
  const bytes: number[] = [];
  let i = 0;
  while (i < withoutSoftBreaks.length) {
    if (withoutSoftBreaks[i] === '=' && i + 2 < withoutSoftBreaks.length) {
      const hex = withoutSoftBreaks.substring(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 3;
        continue;
      }
    }
    bytes.push(withoutSoftBreaks.charCodeAt(i));
    i++;
  }

  // Decodificar bytes usando o charset correto
  try {
    const normalizedCharset = charset.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const decoder = new TextDecoder(normalizedCharset === 'utf8' ? 'utf-8' : normalizedCharset);
    return decoder.decode(new Uint8Array(bytes));
  } catch {
    // Fallback para UTF-8
    try {
      return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    } catch {
      return text;
    }
  }
}

/**
 * Decodifica Base64 para UTF-8 corretamente
 */
function decodeBase64ToUtf8(base64: string, charset: string = 'utf-8'): string {
  try {
    const binaryString = atob(base64.replace(/\s/g, ''));
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const normalizedCharset = charset.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const decoder = new TextDecoder(normalizedCharset === 'utf8' ? 'utf-8' : normalizedCharset);
    return decoder.decode(bytes);
  } catch {
    // Fallback para UTF-8
    try {
      const binaryString = atob(base64.replace(/\s/g, ''));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      return base64;
    }
  }
}

/**
 * Extrai o charset de um header Content-Type
 */
function extractCharset(contentTypeHeader: string): string {
  const charsetMatch = contentTypeHeader.match(/charset=["']?([^"';\s]+)/i);
  return charsetMatch ? charsetMatch[1] : 'utf-8';
}

/**
 * Resultado da extração MIME contendo text e html separados
 */
interface MimeExtractResult {
  textContent: string;
  htmlContent: string | null;
  hasAttachments: boolean;
  attachmentCount: number;
}

/**
 * Extrai o conteúdo text/plain e text/html de um email MIME multipart
 */
function extractTextFromMime(body: string): MimeExtractResult {
  const result: MimeExtractResult = {
    textContent: '',
    htmlContent: null,
    hasAttachments: false,
    attachmentCount: 0,
  };

  if (!body) return result;

  // Verificar se é MIME multipart buscando Content-Type header com boundary
  const boundaryHeaderMatch = body.match(/Content-Type:\s*multipart\/[^;]+;\s*boundary=["']?([^"'\r\n;]+)/i);
  let boundary = '';

  if (boundaryHeaderMatch) {
    boundary = boundaryHeaderMatch[1].trim();
  } else {
    // Fallback: tentar encontrar boundary diretamente no corpo
    const boundaryMatch = body.match(/^--([^\r\n]+)/m);
    if (!boundaryMatch) {
      // Não é multipart, retornar corpo direto como texto
      result.textContent = body;
      return result;
    }
    boundary = boundaryMatch[1].trim();
  }

  console.log('MIME boundary encontrado:', boundary);

  // Dividir em partes usando o boundary
  const escapedBoundary = boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = body.split(new RegExp(`--${escapedBoundary}(?:--)?`));

  let textContent = '';
  let htmlContent = '';

  for (const part of parts) {
    if (!part.trim()) continue;

    // Verificar Content-Type da parte
    const contentTypeMatch = part.match(/Content-Type:\s*([^;\r\n]+)/i);
    if (!contentTypeMatch) continue;

    const contentType = contentTypeMatch[1].toLowerCase().trim();

    // Verificar se é attachment
    const isAttachment = /Content-Disposition:\s*attachment/i.test(part) ||
      (contentType.includes('image/') && !contentType.includes('text/')) ||
      contentType.includes('application/') ||
      contentType.includes('audio/') ||
      contentType.includes('video/');

    if (isAttachment) {
      result.hasAttachments = true;
      result.attachmentCount++;
      continue;
    }

    // Extrair charset
    const charsetMatch = part.match(/charset=["']?([^"';\s\r\n]+)/i);
    const charset = charsetMatch ? charsetMatch[1] : 'utf-8';

    // Verificar encoding
    const isQuotedPrintable = /Content-Transfer-Encoding:\s*quoted-printable/i.test(part);
    const isBase64 = /Content-Transfer-Encoding:\s*base64/i.test(part);

    // Extrair conteúdo após os headers (linha vazia dupla)
    const contentMatch = part.match(/\r?\n\r?\n([\s\S]*)/);
    if (!contentMatch) continue;

    let content = contentMatch[1].trim();

    // Decodificar se necessário
    if (isQuotedPrintable) {
      content = decodeQuotedPrintable(content, charset);
    } else if (isBase64) {
      content = decodeBase64ToUtf8(content, charset);
    }

    // Verificar se é multipart aninhado (recursão)
    if (contentType.includes('multipart/')) {
      const nestedResult = extractTextFromMime(part);
      if (nestedResult.textContent) {
        textContent = nestedResult.textContent;
      }
      if (nestedResult.htmlContent) {
        htmlContent = nestedResult.htmlContent;
      }
      if (nestedResult.hasAttachments) {
        result.hasAttachments = true;
        result.attachmentCount += nestedResult.attachmentCount;
      }
      continue;
    }

    // Guardar conteúdo baseado no tipo
    if (contentType.includes('text/plain')) {
      textContent = content;
      console.log('Conteúdo text/plain extraído do MIME:', content.substring(0, 200));
    } else if (contentType.includes('text/html')) {
      htmlContent = content;
      console.log('Conteúdo text/html extraído do MIME:', content.substring(0, 200));
    }
  }

  // Definir textContent
  if (textContent) {
    result.textContent = textContent;
  } else if (htmlContent) {
    // Converter HTML para texto simples se não tiver text/plain
    result.textContent = htmlContent
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } else {
    result.textContent = body;
  }

  // Guardar HTML se encontrado
  if (htmlContent) {
    result.htmlContent = htmlContent;
  }

  return result;
}

/**
 * Extrai apenas texto (compatibilidade com código existente)
 */
function extractTextOnlyFromMime(body: string): string {
  return extractTextFromMime(body).textContent;
}

/**
 * Remove citações de mensagens anteriores (linhas começando com >)
 * A mensagem nova geralmente vem ANTES das citações
 */
function removeQuotedContent(text: string): string {
  if (!text) return '';

  const lines = text.split(/\r?\n/);
  const cleanLines: string[] = [];

  for (const line of lines) {
    // Linha de citação (começa com >)
    if (/^\s*>/.test(line)) {
      // Parar ao encontrar primeira citação - conteúdo novo está acima
      break;
    }

    cleanLines.push(line);
  }

  const result = cleanLines.join('\n').trim();

  // Se não sobrou nada (todas as linhas eram citações),
  // tentar extrair o conteúdo das próprias citações
  if (!result) {
    console.log('Todas as linhas são citações, extraindo conteúdo citado...');
    const quotedLines: string[] = [];
    for (const line of lines) {
      // Remover prefixo de citação (> ou >>)
      const match = line.match(/^\s*>+\s*(.*)/);
      if (match && match[1].trim()) {
        quotedLines.push(match[1].trim());
      }
    }
    // Retornar apenas a primeira linha não-vazia (provavelmente a mensagem principal)
    const quotedContent = quotedLines.filter(l => l.trim()).join('\n');
    console.log('Conteúdo extraído das citações:', quotedContent.substring(0, 200));
    return quotedContent;
  }

  return result;
}

/**
 * Resultado da decodificação do corpo do email
 */
interface DecodedEmailBody {
  text: string;
  html: string | null;
  hasAttachments: boolean;
  attachmentCount: number;
}

/**
 * Decodifica o corpo do email (base64, quoted-printable, MIME multipart)
 * Retorna tanto texto quanto HTML quando disponíveis
 */
function decodeEmailBodyFull(body: string): DecodedEmailBody {
  const result: DecodedEmailBody = {
    text: '',
    html: null,
    hasAttachments: false,
    attachmentCount: 0,
  };

  if (!body) return result;

  // 1. Primeiro extrair conteúdo de MIME multipart se for o caso
  const mimeResult = extractTextFromMime(body);
  result.hasAttachments = mimeResult.hasAttachments;
  result.attachmentCount = mimeResult.attachmentCount;

  let textDecoded = mimeResult.textContent;
  let htmlDecoded = mimeResult.htmlContent;

  // 2. Se não era multipart, tentar decodificar base64 (apenas para texto)
  if (textDecoded === body && /^[A-Za-z0-9+/=\s]+$/.test(body.trim())) {
    textDecoded = decodeBase64ToUtf8(body, 'utf-8');
  }

  // 3. Decodificar quoted-printable (pode ter escapado do MIME)
  if (textDecoded === body) {
    textDecoded = decodeQuotedPrintable(body, 'utf-8');
  }

  // 4. Remover citações de mensagens anteriores (apenas no texto)
  result.text = removeQuotedContent(textDecoded);
  result.html = htmlDecoded;

  return result;
}

/**
 * Decodifica o corpo do email - versão legada que retorna apenas texto
 */
function decodeEmailBody(body: string): string {
  return decodeEmailBodyFull(body).text;
}

/**
 * Salva um email na pasta Sent via IMAP APPEND
 */
async function saveToSentFolder(
  credentials: EmailCredentials,
  email: OutgoingEmail,
  messageId: string
): Promise<void> {
  const client = new SimpleImapClient(
    credentials.imap_host,
    credentials.imap_port,
    credentials.imap_user,
    credentials.imap_password
  );

  try {
    await client.connect();

    // Listar mailboxes para encontrar a pasta Sent
    const mailboxes = await client.listMailboxes();
    console.log('Mailboxes disponíveis:', mailboxes);

    // Nomes comuns para pasta Sent
    const sentFolderNames = [
      'Sent',
      'INBOX.Sent',
      'Sent Items',
      'Sent Messages',
      'Enviados',
      'INBOX.Enviados',
      '[Gmail]/Sent Mail',
      '[Gmail]/Enviados',
    ];

    let sentFolder: string | null = null;
    for (const name of sentFolderNames) {
      if (mailboxes.some(m => m.toLowerCase() === name.toLowerCase())) {
        sentFolder = mailboxes.find(m => m.toLowerCase() === name.toLowerCase()) || null;
        break;
      }
    }

    if (!sentFolder) {
      // Procurar qualquer pasta que contenha "sent" ou "enviado"
      sentFolder = mailboxes.find(m =>
        m.toLowerCase().includes('sent') || m.toLowerCase().includes('enviado')
      ) || null;
    }

    if (!sentFolder) {
      console.log('Pasta Sent não encontrada, email não será salvo');
      return;
    }

    console.log(`Salvando email na pasta: ${sentFolder}`);

    // Construir mensagem RFC 2822
    const fromHeader = email.from_name
      ? `"${email.from_name}" <${credentials.smtp_user}>`
      : credentials.smtp_user;

    const date = new Date().toUTCString();

    let rawMessage = `From: ${fromHeader}\r\n`;
    rawMessage += `To: ${email.to}\r\n`;
    rawMessage += `Subject: ${email.subject}\r\n`;
    rawMessage += `Date: ${date}\r\n`;
    rawMessage += `Message-ID: ${messageId}\r\n`;
    rawMessage += `MIME-Version: 1.0\r\n`;
    rawMessage += `Content-Type: text/plain; charset=UTF-8\r\n`;

    if (email.in_reply_to) {
      rawMessage += `In-Reply-To: ${email.in_reply_to}\r\n`;
    }
    if (email.references) {
      rawMessage += `References: ${email.references}\r\n`;
    }

    rawMessage += `\r\n`;
    rawMessage += email.body_text;

    // Append na pasta Sent
    const success = await client.appendMessage(sentFolder, rawMessage, ['\\Seen']);
    if (success) {
      console.log('Email salvo na pasta Sent com sucesso');
    } else {
      console.error('Falha ao salvar email na pasta Sent');
    }
  } catch (error) {
    console.error('Erro ao salvar na pasta Sent:', error);
    // Não propagar erro - o email já foi enviado com sucesso
  } finally {
    await client.logout();
  }
}

/**
 * Envia um email via SMTP
 */
export async function sendEmail(
  credentials: EmailCredentials,
  email: OutgoingEmail
): Promise<{ success: boolean; message_id?: string; error?: string }> {
  // Importar nodemailer para Deno
  const nodemailer = await import('npm:nodemailer@6.9.16');

  // Criar transporter
  const transporter = nodemailer.default.createTransport({
    host: credentials.smtp_host,
    port: credentials.smtp_port,
    secure: credentials.smtp_port === 465,
    auth: {
      user: credentials.smtp_user,
      pass: credentials.smtp_password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  try {
    // Construir opções do email
    const mailOptions: {
      from: string;
      to: string;
      subject: string;
      text: string;
      html?: string;
      inReplyTo?: string;
      references?: string;
      headers?: Record<string, string>;
    } = {
      from: email.from_name
        ? `"${email.from_name}" <${credentials.smtp_user}>`
        : credentials.smtp_user,
      to: email.to,
      subject: email.subject,
      text: email.body_text,
    };

    if (email.body_html) {
      mailOptions.html = email.body_html;
    }

    // Headers para manter thread
    if (email.in_reply_to) {
      mailOptions.inReplyTo = email.in_reply_to;
      mailOptions.headers = {
        'In-Reply-To': email.in_reply_to,
      };
    }

    if (email.references) {
      mailOptions.references = email.references;
      if (!mailOptions.headers) mailOptions.headers = {};
      mailOptions.headers['References'] = email.references;
    }

    // Enviar
    const info = await transporter.sendMail(mailOptions);

    // Salvar cópia na pasta Sent (async, não bloqueia)
    saveToSentFolder(credentials, email, info.messageId).catch(err => {
      console.error('Erro ao salvar em Sent (não crítico):', err);
    });

    return {
      success: true,
      message_id: info.messageId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Gera os headers de reply para manter a thread
 */
export function buildReplyHeaders(
  originalMessageId: string,
  originalReferences: string | null
): { in_reply_to: string; references: string } {
  // References deve conter toda a cadeia + o message id original
  let references = originalReferences || '';
  if (references && !references.includes(originalMessageId)) {
    references = `${references} ${originalMessageId}`;
  } else if (!references) {
    references = originalMessageId;
  }

  return {
    in_reply_to: originalMessageId,
    references: references.trim(),
  };
}

/**
 * Gera subject de reply
 */
export function buildReplySubject(originalSubject: string | null): string {
  if (!originalSubject) return 'Re: (sem assunto)';

  // Remover Re:, Fwd: existentes e adicionar Re:
  const cleanSubject = originalSubject.replace(/^(Re:|Fwd:|Enc:|Fw:)\s*/gi, '').trim();
  return `Re: ${cleanSubject}`;
}

/**
 * Extrai email limpo de um endereço formatado
 * Ex: "Nome <email@test.com>" -> "email@test.com"
 */
export function extractEmail(emailString: string): string {
  const match = emailString.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase();
  return emailString.toLowerCase().trim();
}

/**
 * Extrai nome de um endereço formatado
 * Ex: "Nome <email@test.com>" -> "Nome"
 */
export function extractName(emailString: string): string | null {
  const match = emailString.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  return null;
}

/**
 * Extrai um nome "humanizado" a partir do endereço de email
 * Ex: "joao.silva@gmail.com" -> "Joao Silva"
 * Ex: "maria_santos123@example.com" -> "Maria Santos"
 * Usado como fallback quando não há display name no header From
 */
export function extractNameFromEmail(email: string): string | null {
  if (!email || !email.includes('@')) return null;

  // Pegar a parte antes do @
  const localPart = email.split('@')[0];
  if (!localPart) return null;

  // Remover números do final (ex: joao.silva123 -> joao.silva)
  const withoutTrailingNumbers = localPart.replace(/\d+$/, '');

  // Substituir separadores comuns por espaços
  const withSpaces = withoutTrailingNumbers
    .replace(/[._-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Se ficou muito curto ou só números, retornar null
  if (!withSpaces || withSpaces.length < 2) return null;

  // Capitalizar cada palavra
  const capitalized = withSpaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return capitalized;
}

/**
 * Limpa o corpo do email removendo assinaturas e quotes anteriores
 */
export function cleanEmailBody(body: string): string {
  if (!body) return '';

  // Remover conteúdo após marcadores de quote
  const quoteMarkers = [
    /^On .+ wrote:$/m, // "On ... wrote:"
    /^Em .+ escreveu:$/m, // "Em ... escreveu:"
    /^-+\s*Original Message\s*-+/im, // "Original Message"
    /^-+\s*Mensagem Original\s*-+/im, // "Mensagem Original"
    /^From:\s/m, // Headers de forward
    /^>+\s/m, // Quoted text
  ];

  let cleanBody = body;
  for (const marker of quoteMarkers) {
    const match = cleanBody.match(marker);
    if (match && match.index !== undefined) {
      cleanBody = cleanBody.substring(0, match.index).trim();
    }
  }

  // Remover assinaturas comuns
  const signatureMarkers = [
    /^--\s*$/m, // "--" padrão
    /^Enviado do meu iPhone/im,
    /^Sent from my /im,
    /^Get Outlook for /im,
  ];

  for (const marker of signatureMarkers) {
    const match = cleanBody.match(marker);
    if (match && match.index !== undefined) {
      cleanBody = cleanBody.substring(0, match.index).trim();
    }
  }

  return cleanBody.trim();
}
