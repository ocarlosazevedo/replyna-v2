/**
 * Módulo de Email - IMAP e SMTP
 * Funções para ler e enviar emails
 *
 * Usa fetch para IMAP (sem bibliotecas externas problemáticas)
 */

import { decrypt, getEncryptionKey } from './encryption.ts';

/**
 * Mascara um email para log seguro (ex: j***n@gmail.com)
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '[vazio]';
  const parts = email.split('@');
  if (parts.length !== 2) return '[email-inválido]';
  const [local, domain] = parts;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

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

export interface EmailImage {
  media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  data: string; // base64 encoded
  filename?: string;
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
  images: EmailImage[]; // Imagens extraídas do email para análise visual
  imap_uid?: number; // UID do IMAP para marcar como lido após salvar no DB
}

export interface EmailAttachment {
  filename: string;
  content_type: string;
  url: string; // Public URL to download from (e.g. Supabase Storage)
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  body_text: string;
  body_html?: string;
  in_reply_to?: string;
  references?: string;
  from_name?: string;
  attachments?: EmailAttachment[];
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

  private streamClosed = false;

  private async readResponse(): Promise<string> {
    if (!this.reader) throw new Error('Not connected');

    const { value, done } = await this.reader.read();
    if (done || !value) {
      this.streamClosed = true;
      return '';
    }

    return this.decode(value);
  }

  private async readUntilTag(tag: string): Promise<string> {
    let response = '';
    const maxIterations = 200;
    let iterations = 0;
    let emptyReads = 0;
    const maxEmptyReads = 10; // Máximo de leituras vazias consecutivas antes de desistir

    while (iterations < maxIterations) {
      const chunk = await this.readResponse();

      if (chunk) {
        response += chunk;
        emptyReads = 0; // Reset contador de leituras vazias
      } else {
        emptyReads++;
        // Se o stream fechou ou muitas leituras vazias, parar
        if (this.streamClosed) {
          console.warn(`[IMAP] Stream closed while waiting for tag ${tag}. Response so far (${response.length} chars): ${response.substring(0, 500)}`);
          break;
        }
        if (emptyReads >= maxEmptyReads) {
          console.warn(`[IMAP] ${maxEmptyReads} empty reads in a row waiting for tag ${tag}. Response so far (${response.length} chars): ${response.substring(0, 500)}`);
          break;
        }
      }

      // Verificar se recebemos a resposta completa (linha com o tag)
      if (response.includes(`${tag} OK`) || response.includes(`${tag} NO`) || response.includes(`${tag} BAD`)) {
        break;
      }
      iterations++;
    }

    if (iterations >= maxIterations) {
      console.warn(`[IMAP] Max iterations (${maxIterations}) reached waiting for tag ${tag}. Response (${response.length} chars): ${response.substring(0, 500)}`);
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

  /**
   * Busca emails SEEN (já lidos) recebidos desde uma data específica.
   * Usado para backfill quando cliente sai do free trial para plano pago.
   */
  async searchSeenSince(sinceDate: Date): Promise<number[]> {
    const tag = this.getTag();
    // Formato de data IMAP: DD-Mon-YYYY
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dateStr = `${sinceDate.getDate()}-${months[sinceDate.getMonth()]}-${sinceDate.getFullYear()}`;
    await this.sendCommand(`${tag} SEARCH SEEN SINCE ${dateStr}`);
    const response = await this.readUntilTag(tag);

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
    // Buscar headers e corpo SEM marcar como lido (BODY.PEEK em vez de BODY)
    // BODY[...] marca automaticamente como \Seen no IMAP, o que faz o email "desaparecer"
    // antes de ser processado. BODY.PEEK[...] lê sem alterar flags.
    await this.sendCommand(`${tag} FETCH ${uid} (BODY.PEEK[HEADER.FIELDS (From To Subject Message-ID Date In-Reply-To References Reply-To)] BODY.PEEK[TEXT])`);
    const response = await this.readUntilTag(tag);

    console.log('IMAP FETCH response (primeiros 2000 chars):', response.substring(0, 2000));

    // Detectar respostas IMAP vazias ou truncadas (comum com Zoho)
    if (!response || response.trim().length < 10) {
      console.error(`[IMAP] FETCH retornou resposta vazia/truncada para UID ${uid} (${response.length} chars). Conexão pode ter sido fechada pelo servidor.`);
    }
    if (!response.includes(`${tag} OK`)) {
      console.warn(`[IMAP] FETCH para UID ${uid} não contém tag OK - resposta possivelmente incompleta`);
    }

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

    // Extrair headers - tentar múltiplos formatos de resposta IMAP
    // Formato 1: BODY[HEADER.FIELDS ...] {N}\r\n<headers> (padrão)
    // Formato 2: Sem \r, apenas \n (alguns servidores como Zoho)
    // Formato 3: Sem literal {N}, headers direto após ]
    let headerMatch = response.match(/BODY\[HEADER\.FIELDS[^\]]*\]\s*\{(\d+)\}\r?\n([\s\S]*?)(?=BODY\[TEXT\]|\)\r?\n)/i);
    if (!headerMatch) {
      // Fallback: tentar sem literal size {N} - alguns servidores retornam headers diretamente
      headerMatch = response.match(/BODY\[HEADER\.FIELDS[^\]]*\]\s*\r?\n?([\s\S]*?)(?=BODY\[TEXT\]|\)\r?\n)/i);
      if (headerMatch && !headerMatch[2]) {
        // Ajustar grupos de captura - neste regex, grupo 1 é o conteúdo
        headerMatch = [headerMatch[0], '0', headerMatch[1]] as unknown as RegExpMatchArray;
      }
    }
    if (!headerMatch) {
      // Último fallback: procurar headers diretamente no response
      console.log('[IMAP] Header regex falhou, tentando fallback direto no response');
      // Criar um "headerMatch" fake com o response inteiro para parsing de headers
      headerMatch = [response, '0', response] as unknown as RegExpMatchArray;
    }
    if (headerMatch) {
      const headers = headerMatch[2] || response;
      console.log('Headers extraídos:', headers.substring(0, 500));

      // From: "Name" <email@domain.com> ou From: email@domain.com
      // Suporte a headers multi-linha (folded) onde continuação começa com espaço/tab
      const fromHeaderMatch = headers.match(/^From:\s*((?:.+?)(?:\r?\n[ \t]+.+?)*)\s*(?:\r?\n(?![ \t])|\r?\n?$)/im);
      if (fromHeaderMatch) {
        // Unfoldar header multi-linha: remover quebras seguidas de espaço
        const fromValue = fromHeaderMatch[1].replace(/\r?\n[ \t]+/g, ' ').trim();
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
      } else {
        // Fallback: procurar qualquer email no response associado ao From
        console.log('[IMAP] From header regex falhou, tentando fallback...');
        const fallbackFrom = response.match(/From:\s*(?:"[^"]*"\s*)?<?([^\s<>@]+@[^\s<>]+)>?/i);
        if (fallbackFrom) {
          from = fallbackFrom[1].toLowerCase();
          console.log('From extraído via fallback:', from);
        }
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

      // Subject (pode ter encoding, pode ser multi-linha)
      const subjectHeaderMatch = headers.match(/^Subject:\s*((?:.+?)(?:\r?\n[ \t]+.+?)*)\s*(?:\r?\n(?![ \t])|\r?\n?$)/im);
      if (subjectHeaderMatch) {
        subject = this.decodeSubject(subjectHeaderMatch[1].replace(/\r?\n[ \t]+/g, ' ').trim());
      } else {
        // Fallback: procurar Subject diretamente no response
        const fallbackSubject = response.match(/Subject:\s*(.+)/i);
        if (fallbackSubject) {
          subject = this.decodeSubject(fallbackSubject[1].trim());
          console.log('Subject extraído via fallback:', subject);
        }
      }

      // Message-ID
      const msgIdHeaderMatch = headers.match(/^Message-ID:\s*(<[^>]+>)/im);
      if (msgIdHeaderMatch) {
        messageId = msgIdHeaderMatch[1];
      } else {
        // Fallback: procurar Message-ID diretamente no response
        const fallbackMsgId = response.match(/Message-ID:\s*(<[^>]+>)/i);
        if (fallbackMsgId) {
          messageId = fallbackMsgId[1];
          console.log('Message-ID extraído via fallback:', messageId);
        }
      }

      // Date
      const dateHeaderMatch = headers.match(/^Date:\s*((?:.+?)(?:\r?\n[ \t]+.+?)*)\s*(?:\r?\n(?![ \t])|\r?\n?$)/im);
      if (dateHeaderMatch) {
        date = dateHeaderMatch[1].replace(/\r?\n[ \t]+/g, ' ').trim();
      } else {
        // Fallback: procurar Date diretamente no response
        const fallbackDate = response.match(/Date:\s*([A-Za-z]{3},\s.+)/i);
        if (fallbackDate) {
          date = fallbackDate[1].trim();
        }
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

    // Extrair corpo - formatos flexíveis (CRLF e LF)
    // Estratégia 1: Usar literal size {N} para extrair exatamente N bytes
    const literalMatch = response.match(/BODY\[TEXT\]\s*\{(\d+)\}\r?\n/);
    if (literalMatch) {
      const literalSize = parseInt(literalMatch[1], 10);
      const startIndex = (literalMatch.index ?? 0) + literalMatch[0].length;
      body = response.substring(startIndex, startIndex + literalSize);
      console.log(`[IMAP] Body extraído via literal size {${literalSize}}, resultado: ${body.length} chars`);
    }

    // Estratégia 2: Regex padrão com terminador IMAP
    if (!body) {
      const bodyMatch = response.match(/BODY\[TEXT\]\s*\{(\d+)\}\r?\n([\s\S]*?)(?=\)\r?\n|\r?\n\))/);
      if (bodyMatch) {
        body = bodyMatch[2] || '';
        console.log(`[IMAP] Body extraído via regex padrão: ${body.length} chars`);
      }
    }

    // Estratégia 3: Sem literal size, regex mais flexível
    if (!body) {
      const bodyMatch2 = response.match(/BODY\[TEXT\]\s*(?:\{(\d+)\}\r?\n)?([\s\S]*?)(?=\)\s*$|\n\))/);
      if (bodyMatch2) {
        body = bodyMatch2[2] || '';
        console.log(`[IMAP] Body extraído via regex flexível: ${body.length} chars`);
      }
    }

    // Estratégia 4: Extrair tudo após BODY[TEXT] até o final (último recurso)
    if (!body) {
      const lastResort = response.match(/BODY\[TEXT\]\s*(?:\{?\d*\}?\r?\n)?([\s\S]+)/);
      if (lastResort) {
        // Remover trailing IMAP response (última linha com tag ou ")")
        body = lastResort[1].replace(/\)\s*$/, '').replace(/\r?\n[A-Z0-9]+ OK .*$/m, '').trim();
        console.log(`[IMAP] Body extraído via último recurso: ${body.length} chars`);
      }
    }

    // Estratégia 5: Se BODY[TEXT] falhou e temos remetente, tentar BODY[] (mensagem completa)
    if (!body && from) {
      console.log(`[IMAP] BODY[TEXT] vazio para mensagem ${uid} de ${from}, tentando BODY[] como fallback...`);
      try {
        const tag2 = this.getTag();
        await this.sendCommand(`${tag2} FETCH ${uid} (BODY.PEEK[])`);
        const fullResponse = await this.readUntilTag(tag2);

        // Extrair corpo completo da resposta
        const fullBodyLiteralMatch = fullResponse.match(/BODY\[\]\s*\{(\d+)\}\r?\n/);
        let fullRaw = '';
        if (fullBodyLiteralMatch) {
          const literalSize2 = parseInt(fullBodyLiteralMatch[1], 10);
          const startIdx = (fullBodyLiteralMatch.index ?? 0) + fullBodyLiteralMatch[0].length;
          fullRaw = fullResponse.substring(startIdx, startIdx + literalSize2);
        } else {
          // Fallback: extrair tudo entre BODY[] e o final
          const fullBodyMatch = fullResponse.match(/BODY\[\]\s*(?:\{?\d*\}?\r?\n)?([\s\S]+)/);
          if (fullBodyMatch) {
            fullRaw = fullBodyMatch[1].replace(/\)\s*$/, '').replace(/\r?\n[A-Z0-9]+ OK .*$/m, '').trim();
          }
        }

        if (fullRaw) {
          // Separar headers do corpo: procurar linha vazia que separa headers de body
          const headerBodySplit = fullRaw.match(/^([\s\S]*?)\r?\n\r?\n([\s\S]*)$/);
          if (headerBodySplit && headerBodySplit[2]) {
            body = headerBodySplit[2];
            console.log(`[IMAP] Body extraído via BODY[] fallback: ${body.length} chars`);
          } else {
            // Se não conseguiu separar, usar o raw inteiro (pode conter headers)
            body = fullRaw;
            console.log(`[IMAP] Body extraído via BODY[] (raw inteiro): ${body.length} chars`);
          }
        }
      } catch (fetchBodyError) {
        console.error(`[IMAP] Falha no fallback BODY[] para mensagem ${uid}:`, fetchBodyError);
      }
    }

    if (!body) {
      console.error(`[IMAP] FALHA ao extrair body da mensagem UID ${uid}. Response (2000 chars):`, response.substring(0, 2000));
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

        // Decodificar o corpo (texto, HTML e imagens)
        const decodedBody = decodeEmailBodyFull(msg.body);
        const bodyText = cleanEmailBody(decodedBody.text || '', decodedBody.html || '');

        // Limitar a 5 imagens para evitar excesso de tokens
        const limitedImages = decodedBody.images.slice(0, 5);
        if (decodedBody.images.length > 5) {
          console.log(`Limitando imagens de ${decodedBody.images.length} para 5`);
        }

        if (!bodyText && !decodedBody.html) {
          console.warn(`[fetchUnreadEmails] AVISO: Mensagem ${uid} (${msg.envelope.subject}) tem body_text e body_html vazios! msg.body length: ${msg.body?.length ?? 0}`);
        }

        // Filtrar mensagens fantasma: sem remetente, sem corpo e sem assunto real
        // Zoho IMAP às vezes retorna entradas vazias (rascunhos, calendário, etc.)
        const hasNoFrom = !msg.envelope.from || !msg.envelope.from.includes('@');
        const hasNoBody = !bodyText && !decodedBody.html && (!msg.body || msg.body.trim().length === 0);
        const hasNoSubject = !msg.envelope.subject || msg.envelope.subject.trim() === '' || msg.envelope.subject === '(Sem assunto)';
        const isGenerated = msg.envelope.messageId.includes('@generated');

        if (hasNoFrom && hasNoBody) {
          console.warn(`[fetchUnreadEmails] SKIP mensagem fantasma ${uid}: sem remetente e sem corpo (subject: "${msg.envelope.subject}", messageId: ${msg.envelope.messageId})`);
          // Marcar como lida para não buscar novamente
          await client.markAsSeen(uid);
          continue;
        }

        // Se não tem remetente E o messageId é gerado, provavelmente o FETCH falhou (resposta truncada/vazia do IMAP)
        // NÃO marcar como lido - tentar novamente na próxima execução
        if (hasNoFrom && isGenerated) {
          console.warn(`[fetchUnreadEmails] SKIP UID ${uid}: FETCH provavelmente falhou (sem remetente, messageId gerado). Será re-tentado.`);
          continue;
        }

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
          images: limitedImages,
          imap_uid: uid,
        });

        console.log(`Fetched mensagem ${uid}: ${msg.envelope.subject}`);
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
 * Busca emails já lidos (SEEN) no IMAP recebidos nos últimos N dias.
 * Usado para backfill quando cliente sai do free trial para plano pago.
 * Emails já existentes no banco serão filtrados pela deduplicação (message_id).
 *
 * @param credentials - Credenciais de email
 * @param maxEmails - Número máximo de emails a buscar
 * @param sinceDaysAgo - Buscar emails dos últimos N dias (default: 30)
 */
export async function fetchSeenEmails(
  credentials: EmailCredentials,
  maxEmails: number = 100,
  sinceDaysAgo: number = 30
): Promise<IncomingEmail[]> {
  const client = new SimpleImapClient(
    credentials.imap_host,
    credentials.imap_port,
    credentials.imap_user,
    credentials.imap_password
  );

  const emails: IncomingEmail[] = [];

  try {
    console.log(`[Backfill] Conectando ao IMAP ${credentials.imap_host}:${credentials.imap_port}...`);
    await client.connect();
    console.log('[Backfill] Conectado! Selecionando INBOX...');

    await client.selectInbox();

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - sinceDaysAgo);
    console.log(`[Backfill] Buscando emails SEEN desde ${sinceDate.toISOString()}...`);

    const seenIds = await client.searchSeenSince(sinceDate);
    console.log(`[Backfill] Encontrados ${seenIds.length} emails SEEN`);

    const idsToFetch = seenIds.slice(0, maxEmails);

    for (const uid of idsToFetch) {
      try {
        const msg = await client.fetchMessage(uid);
        const receivedAt = new Date(msg.envelope.date);

        const decodedBody = decodeEmailBodyFull(msg.body);
        const bodyText = cleanEmailBody(decodedBody.text || '', decodedBody.html || '');
        const limitedImages = decodedBody.images.slice(0, 5);

        const hasNoFrom = !msg.envelope.from || !msg.envelope.from.includes('@');
        const hasNoBody = !bodyText && !decodedBody.html && (!msg.body || msg.body.trim().length === 0);

        if (hasNoFrom && hasNoBody) {
          continue;
        }

        if (hasNoFrom && msg.envelope.messageId.includes('@generated')) {
          continue;
        }

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
          images: limitedImages,
          imap_uid: uid,
        });

        console.log(`[Backfill] Fetched mensagem ${uid}: ${msg.envelope.subject}`);
      } catch (msgError) {
        console.error(`[Backfill] Erro ao processar mensagem ${uid}:`, msgError);
      }
    }
  } finally {
    await client.logout();
  }

  return emails;
}

/**
 * Marca emails como lidos no IMAP após terem sido salvos no banco de dados.
 * Deve ser chamada APÓS saveAndEnqueueEmail/saveIncomingEmail para evitar perda de emails.
 *
 * @param credentials - Credenciais de email
 * @param uids - Lista de UIDs IMAP para marcar como lidos
 */
export async function markEmailsAsSeen(
  credentials: EmailCredentials,
  uids: number[]
): Promise<void> {
  if (uids.length === 0) return;

  const client = new SimpleImapClient(
    credentials.imap_host,
    credentials.imap_port,
    credentials.imap_user,
    credentials.imap_password
  );

  try {
    await client.connect();
    await client.selectInbox();

    for (const uid of uids) {
      try {
        await client.markAsSeen(uid);
      } catch (err) {
        console.error(`Erro ao marcar email ${uid} como lido:`, err);
      }
    }
  } catch (err) {
    console.error(`Erro ao conectar IMAP para marcar emails como lidos:`, err);
  } finally {
    try {
      await client.logout();
    } catch {
      // Ignorar erro no logout
    }
  }
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
 * Resultado da extração MIME contendo text, html e imagens
 */
interface MimeExtractResult {
  textContent: string;
  htmlContent: string | null;
  hasAttachments: boolean;
  attachmentCount: number;
  images: EmailImage[];
}

/**
 * Tipos de mídia suportados para análise visual com Claude
 */
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * Tamanho máximo de imagem em bytes (5MB)
 */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/**
 * Extrai o conteúdo text/plain, text/html e imagens de um email MIME multipart
 */
function extractTextFromMime(body: string): MimeExtractResult {
  const result: MimeExtractResult = {
    textContent: '',
    htmlContent: null,
    hasAttachments: false,
    attachmentCount: 0,
    images: [],
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

    // Verificar se é uma imagem suportada para análise visual
    const isImage = contentType.includes('image/');
    if (isImage) {
      // Extrair tipo de mídia
      const mediaTypeMatch = contentType.match(/(image\/(?:jpeg|png|gif|webp))/i);
      if (mediaTypeMatch && SUPPORTED_IMAGE_TYPES.includes(mediaTypeMatch[1].toLowerCase())) {
        const mediaType = mediaTypeMatch[1].toLowerCase() as EmailImage['media_type'];

        // Extrair nome do arquivo se disponível
        const filenameMatch = part.match(/(?:filename=["']?([^"';\r\n]+)|name=["']?([^"';\r\n]+))/i);
        const filename = filenameMatch ? (filenameMatch[1] || filenameMatch[2])?.trim() : undefined;

        // Verificar se está em base64
        const isBase64Encoded = /Content-Transfer-Encoding:\s*base64/i.test(part);

        // Extrair conteúdo da imagem
        const imageContentMatch = part.match(/\r?\n\r?\n([\s\S]*)/);
        if (imageContentMatch && isBase64Encoded) {
          // Remover espaços e quebras de linha do base64
          const base64Data = imageContentMatch[1].replace(/[\r\n\s]/g, '').trim();

          // Verificar tamanho aproximado (base64 é ~33% maior que o original)
          const estimatedSize = (base64Data.length * 3) / 4;

          if (base64Data.length > 0 && estimatedSize <= MAX_IMAGE_SIZE) {
            result.images.push({
              media_type: mediaType,
              data: base64Data,
              filename,
            });
            console.log(`Imagem extraída: ${filename || 'sem nome'} (${mediaType}, ~${Math.round(estimatedSize / 1024)}KB)`);
          } else if (estimatedSize > MAX_IMAGE_SIZE) {
            console.log(`Imagem ignorada (muito grande): ${filename || 'sem nome'} (~${Math.round(estimatedSize / 1024 / 1024)}MB)`);
          }
        }
      }
      result.hasAttachments = true;
      result.attachmentCount++;
      continue;
    }

    // Verificar se é outro tipo de attachment (não imagem)
    const isAttachment = /Content-Disposition:\s*attachment/i.test(part) ||
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
      // Propagar imagens de multipart aninhado
      if (nestedResult.images.length > 0) {
        result.images.push(...nestedResult.images);
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
  images: EmailImage[];
}

/**
 * Decodifica o corpo do email (base64, quoted-printable, MIME multipart)
 * Retorna tanto texto quanto HTML e imagens quando disponíveis
 */
function decodeEmailBodyFull(body: string): DecodedEmailBody {
  const result: DecodedEmailBody = {
    text: '',
    html: null,
    hasAttachments: false,
    attachmentCount: 0,
    images: [],
  };

  if (!body) return result;

  // 1. Primeiro extrair conteúdo de MIME multipart se for o caso
  const mimeResult = extractTextFromMime(body);
  result.hasAttachments = mimeResult.hasAttachments;
  result.attachmentCount = mimeResult.attachmentCount;
  result.images = mimeResult.images;

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
      attachments?: Array<{ filename: string; content: Buffer | Uint8Array; contentType: string }>;
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
    } else if (email.body_text) {
      // Auto-gerar HTML a partir do texto puro para preservar formatação
      const escaped = email.body_text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      mailOptions.html = escaped
        .split('\n\n')
        .map((para: string) => `<p style="margin:0 0 12px 0">${para.replace(/\n/g, '<br>')}</p>`)
        .join('');
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

    // Anexos — baixar de URLs públicas e anexar ao email via Nodemailer
    if (email.attachments && email.attachments.length > 0) {
      const nodemailerAttachments: Array<{ filename: string; content: Uint8Array; contentType: string }> = [];
      for (const att of email.attachments) {
        try {
          console.log(`[sendEmail] Baixando anexo: ${att.filename} de ${att.url}`);
          const res = await fetch(att.url);
          if (res.ok) {
            const arrayBuf = await res.arrayBuffer();
            const buf = new Uint8Array(arrayBuf);
            console.log(`[sendEmail] Anexo baixado: ${att.filename} (${buf.length} bytes, tipo: ${att.content_type})`);
            nodemailerAttachments.push({
              filename: att.filename,
              content: buf,
              contentType: att.content_type,
            });
          } else {
            console.error(`[sendEmail] Falha ao baixar anexo ${att.filename}: HTTP ${res.status}`);
          }
        } catch (err) {
          console.error(`[sendEmail] Erro ao baixar anexo ${att.filename}:`, err);
        }
      }
      if (nodemailerAttachments.length > 0) {
        mailOptions.attachments = nodemailerAttachments;
        console.log(`[sendEmail] ${nodemailerAttachments.length} anexo(s) adicionado(s) ao email`);
      }

      // Registrar se algum anexo falhou
      const requestedCount = email.attachments.length;
      const sentCount = nodemailerAttachments.length;
      if (sentCount < requestedCount) {
        console.warn(`[sendEmail] ${requestedCount - sentCount} anexo(s) falharam no download`);
      }
    }

    // Enviar
    const info = await transporter.sendMail(mailOptions);

    // Salvar cópia na pasta Sent (async, não bloqueia)
    saveToSentFolder(credentials, email, info.messageId).catch(err => {
      console.error('Erro ao salvar em Sent (não crítico):', err);
    });

    // Calcular anexos enviados vs pedidos
    const attachmentsRequested = email.attachments?.length ?? 0;
    const attachmentsSent = (mailOptions.attachments as any[])?.length ?? 0;

    return {
      success: true,
      message_id: info.messageId,
      attachments_requested: attachmentsRequested,
      attachments_sent: attachmentsSent,
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
  originalMessageId: string | null | undefined,
  originalReferences: string | null | undefined
): { in_reply_to: string; references: string } {
  // Garantir que temos valores válidos
  const messageId = originalMessageId || '';
  const originalRefs = originalReferences || '';

  // References deve conter toda a cadeia + o message id original
  let references = originalRefs;
  if (messageId) {
    if (references && !references.includes(messageId)) {
      references = `${references} ${messageId}`;
    } else if (!references) {
      references = messageId;
    }
  }

  return {
    in_reply_to: messageId,
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
 * Converte HTML para texto plano
 */
function htmlToPlainText(html: string): string {
  if (!html) return '';

  let text = html
    // Remover scripts e styles
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Converter <br> e <p> para quebras de linha
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    // Remover todas as outras tags
    .replace(/<[^>]+>/g, '')
    // Decodificar entidades HTML
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    // Limpar espaços extras
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

/**
 * Limpa o corpo do email removendo assinaturas e quotes anteriores
 * Aceita body_text e body_html - prioriza texto, usa HTML como fallback
 */
export function cleanEmailBody(bodyText: string, bodyHtml?: string): string {
  // Priorizar body_text, usar HTML convertido como fallback
  let body = bodyText || '';

  // Se body_text está vazio ou é muito curto, tentar extrair do HTML
  if ((!body || body.trim().length < 10) && bodyHtml) {
    body = htmlToPlainText(bodyHtml);
  }

  if (!body) return '';

  // CRÍTICO: Detectar e extrair texto ORIGINAL de emails traduzidos automaticamente pelo Gmail
  // Gmail insere "Traduzido para [idioma]" antes da tradução e "Ver original" antes do texto original
  const gmailTranslationPatterns = [
    // Português: "Traduzido para Português/Portugues" ... "Ver original" ... [TEXTO ORIGINAL]
    /Traduzido para\s+(?:Português|Portugues|Portuguese)[\s\S]*?Ver original\s*\n+([\s\S]+)/i,
    // Inglês: "Translated to English" ... "View original" ... [ORIGINAL TEXT]
    /Translated to\s+(?:English|Portuguese|Spanish|French|German|Italian)[\s\S]*?View original\s*\n+([\s\S]+)/i,
    // Espanhol: "Traducido al español" ... "Ver original" ... [TEXTO ORIGINAL]
    /Traducido al?\s+(?:español|inglés|portugués)[\s\S]*?Ver original\s*\n+([\s\S]+)/i,
    // Alemão: "Übersetzt nach Deutsch" ... "Original anzeigen" ... [ORIGINALTEXT]
    /Übersetzt (?:nach|ins)\s+(?:Deutsch|Englisch|Spanisch)[\s\S]*?Original anzeigen\s*\n+([\s\S]+)/i,
    // Francês: "Traduit en français" ... "Voir l'original" ... [TEXTE ORIGINAL]
    /Traduit en\s+(?:français|anglais|espagnol)[\s\S]*?Voir l'original\s*\n+([\s\S]+)/i,
    // Italiano: "Tradotto in italiano" ... "Visualizza originale" ... [TESTO ORIGINALE]
    /Tradotto in\s+(?:italiano|inglese|spagnolo)[\s\S]*?Visualizza originale\s*\n+([\s\S]+)/i,
  ];

  for (const pattern of gmailTranslationPatterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      const originalText = match[1].trim();
      console.log('[cleanEmailBody] Gmail auto-translation detected! Extracting ORIGINAL text.');
      console.log('[cleanEmailBody] Original text (first 200 chars):', originalText.substring(0, 200));
      body = originalText; // Usar o texto ORIGINAL, não o traduzido
      break;
    }
  }

  // Também detectar padrão onde o email começa com a tradução inline
  // Formato: "[Traduzido para Português]" ou similar no início
  const inlineTranslationPattern = /^\s*\[?Traduzido para\s+\w+\]?\s*\n/i;
  if (inlineTranslationPattern.test(body)) {
    // Remover apenas a linha de aviso, manter o resto
    body = body.replace(inlineTranslationPattern, '');
  }

  // Detectar e extrair comentário de formulários de contato do Shopify
  // Formato: "Nova mensagem de cliente... Country Code: X, Name: X, Email: X, Phone: X, Comment: X"
  // Também: "You received a new message from your online store's contact form."
  const shopifyFormPattern = /(?:Nova mensagem de cliente|New customer message|New message from customer|received a new message from.*(?:contact form|online store)|new message from your online store)/i;
  if (shopifyFormPattern.test(body)) {
    // Tentar extrair o campo Comment/Comentário/Message/Body/Corpo
    const commentPatterns = [
      /(?:Comment|Comentário|Message|Mensagem|Body|Corpo):\s*\n?\s*(.+?)(?:\n\n|\n(?:Country|Name|Email|Phone|--|$))/is,
      /(?:Comment|Comentário|Message|Mensagem|Body|Corpo):\s*\n?\s*(.+)$/is,
    ];

    for (const pattern of commentPatterns) {
      const match = body.match(pattern);
      if (match && match[1] && match[1].trim().length > 2) {
        // Retornar apenas o comentário do cliente
        return match[1].trim();
      }
    }

    // Se não encontrou comentário, retornar indicação de formulário vazio
    return '[FORMULÁRIO DE CONTATO SEM MENSAGEM]';
  }

  // Remover conteúdo após marcadores de quote
  const quoteMarkers = [
    /^On .+wrote:\s*$/m, // "On ... wrote:" (com ou sem espaço antes de wrote)
    /^On .+ wrote:/m, // "On ... wrote:" (sem exigir fim de linha)
    /^Em .+ escreveu:\s*$/m, // "Em ... escreveu:"
    /^Em .+ escreveu:/m, // "Em ... escreveu:" (sem exigir fim de linha)
    /^Em \d{1,2}\/\d{1,2}\/\d{2,4}/m, // "Em DD/MM/YY" ou "Em DD/MM/YYYY" (início de citação)
    /^Am .+ schrieb/im, // Alemão: "Am ... schrieb"
    /^Le .+ a écrit/im, // Francês: "Le ... a écrit"
    /^El .+ escribió/im, // Espanhol: "El ... escribió"
    /^Il .+ ha scritto/im, // Italiano: "Il ... ha scritto"
    /^Op .+ schreef/im, // Holandês: "Op ... schreef"
    /^-+\s*Original Message\s*-+/im, // "Original Message"
    /^-+\s*Mensagem Original\s*-+/im, // "Mensagem Original"
    /^-+\s*Ursprüngliche Nachricht\s*-+/im, // "Ursprüngliche Nachricht" (Alemão)
    /^-+\s*Message d'origine\s*-+/im, // "Message d'origine" (Francês)
    /^-+\s*Původní e-mail\s*-+/im, // "Původní e-mail" (Tcheco)
    /^-+\s*Pôvodná správa\s*-+/im, // "Pôvodná správa" (Eslovaco)
    /^-+\s*Oorspronkelijk bericht\s*-+/im, // "Oorspronkelijk bericht" (Holandês)
    /^-+\s*Messaggio originale\s*-+/im, // "Messaggio originale" (Italiano)
    /^-+\s*Mensaje original\s*-+/im, // "Mensaje original" (Espanhol)
    /^From:\s/m, // Headers de forward
    /^Von:\s/m, // Headers de forward (Alemão)
    /^De:\s/m, // Headers de forward (Português/Espanhol/Francês)
    /^>+\s/m, // Quoted text
    // Citações inline com data/hora (Gmail mobile, webmail)
    // Ex: "Na segunda-feira, 9 de fevereiro de 2026, às 21h17, John <email@example.com> escreveu:"
    /^(Na |On |Am |Le |El |Op )?(segunda|terça|quarta|quinta|sexta|sábado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/im,
    // Citações com formato de data genérico seguido de email: "9 de fevereiro de 2026, ... <email>"
    /^\d{1,2}\s+de\s+\w+\s+de\s+\d{4}/m,
    // Formato inline com < email > (citação com endereço de email entre < >)
    /^.{0,80}<\s*[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\s*>\s*(escreveu|wrote|schrieb|a écrit|escribió|ha scritto|schreef)\s*:/im,
  ];

  let cleanBody = body;
  for (const marker of quoteMarkers) {
    const match = cleanBody.match(marker);
    if (match && match.index !== undefined) {
      const candidate = cleanBody.substring(0, match.index).trim();
      // Só remover citação se sobrar conteúdo significativo
      if (candidate.length >= 3) {
        cleanBody = candidate;
      }
    }
  }

  // Remover assinaturas comuns
  const signatureMarkers = [
    /^--\s*$/m, // "--" padrão
    /^Enviado do meu iPhone/im,
    /^Enviado com o aplicativo/im, // "Enviado com o aplicativo de e-mail GMX", etc.
    /^Sent from my /im,
    /^Gesendet von /im, // Alemão: "Gesendet von meinem iPhone"
    /^Envoyé de mon /im, // Francês: "Envoyé de mon iPhone"
    /^Enviado desde mi /im, // Espanhol: "Enviado desde mi iPhone"
    /^Get Outlook for /im,
    /^Von meinem .+ gesendet/im, // Alemão: "Von meinem iPhone gesendet"
    /^Gesendet mit der .+ App/im, // Alemão: "Gesendet mit der GMX Mail App"
    /^Mit freundlichen Grüßen/im, // Alemão: saudação formal
    /^Atenciosamente,?\s*$/im, // Português: assinatura
    /^Regards,?\s*$/im, // Inglês: assinatura
    /^Best regards,?\s*$/im, // Inglês: assinatura
  ];

  for (const marker of signatureMarkers) {
    const match = cleanBody.match(marker);
    if (match && match.index !== undefined) {
      const candidate = cleanBody.substring(0, match.index).trim();
      // Só remover assinatura se sobrar conteúdo significativo
      if (candidate.length >= 3) {
        cleanBody = candidate;
      }
    }
  }

  // FALLBACK: Se após limpeza o texto ficou vazio mas o body original tinha conteúdo,
  // manter o body original (melhor responder a conteúdo citado do que não responder)
  if (cleanBody.trim().length < 3 && body.trim().length >= 3) {
    console.log('[cleanEmailBody] Limpeza removeu todo conteúdo, mantendo corpo original');
    cleanBody = body;
  }

  return cleanBody.trim();
}
