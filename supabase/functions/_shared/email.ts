/**
 * Módulo de Email - IMAP e SMTP
 * Funções para ler e enviar emails
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
  to_email: string;
  subject: string | null;
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
 * Busca emails não lidos via IMAP
 * Usa a biblioteca imapflow para Deno
 */
export async function fetchUnreadEmails(
  credentials: EmailCredentials,
  maxEmails: number = 50
): Promise<IncomingEmail[]> {
  // Importar dinamicamente para Edge Functions
  const { ImapFlow } = await import('npm:imapflow@1.0.162');

  const client = new ImapFlow({
    host: credentials.imap_host,
    port: credentials.imap_port,
    secure: credentials.imap_port === 993,
    auth: {
      user: credentials.imap_user,
      pass: credentials.imap_password,
    },
    logger: false,
    tls: {
      rejectUnauthorized: false, // Para certificados auto-assinados
    },
  });

  const emails: IncomingEmail[] = [];

  try {
    await client.connect();

    // Selecionar INBOX
    const mailbox = await client.getMailboxLock('INBOX');

    try {
      // Buscar mensagens não lidas
      const messages = client.fetch(
        { seen: false },
        {
          uid: true,
          envelope: true,
          bodyStructure: true,
          source: true,
        },
        { changedSince: 0n }
      );

      let count = 0;
      for await (const message of messages) {
        if (count >= maxEmails) break;

        try {
          // Extrair dados do envelope
          const envelope = message.envelope;

          // Extrair corpo do email
          let bodyText = '';
          let bodyHtml = '';

          if (message.source) {
            const source = message.source.toString();
            // Parse básico do corpo
            const textMatch = source.match(
              /Content-Type: text\/plain[\s\S]*?\r\n\r\n([\s\S]*?)(?=\r\n--|\r\n\r\n)/i
            );
            const htmlMatch = source.match(
              /Content-Type: text\/html[\s\S]*?\r\n\r\n([\s\S]*?)(?=\r\n--|\r\n\r\n)/i
            );

            if (textMatch) bodyText = decodeEmailBody(textMatch[1]);
            if (htmlMatch) bodyHtml = decodeEmailBody(htmlMatch[1]);

            // Se não encontrou com Content-Type, tentar pegar o corpo direto
            if (!bodyText && !bodyHtml) {
              const bodyMatch = source.match(/\r\n\r\n([\s\S]+)$/);
              if (bodyMatch) {
                bodyText = decodeEmailBody(bodyMatch[1]);
              }
            }
          }

          // Verificar anexos
          const hasAttachments = message.bodyStructure?.childNodes?.some(
            (node: { disposition?: string }) => node.disposition === 'attachment'
          ) || false;
          const attachmentCount = message.bodyStructure?.childNodes?.filter(
            (node: { disposition?: string }) => node.disposition === 'attachment'
          ).length || 0;

          // Extrair headers de threading
          let inReplyTo = '';
          let references = '';

          if (message.source) {
            const source = message.source.toString();
            const inReplyToMatch = source.match(/In-Reply-To:\s*(<[^>]+>)/i);
            const referencesMatch = source.match(/References:\s*([^\r\n]+)/i);

            if (inReplyToMatch) inReplyTo = inReplyToMatch[1];
            if (referencesMatch) references = referencesMatch[1];
          }

          emails.push({
            message_id: envelope.messageId || `${Date.now()}-${Math.random()}`,
            from_email: envelope.from?.[0]?.address || '',
            from_name: envelope.from?.[0]?.name || null,
            to_email: envelope.to?.[0]?.address || '',
            subject: envelope.subject || null,
            body_text: bodyText || null,
            body_html: bodyHtml || null,
            in_reply_to: inReplyTo || null,
            references: references || null,
            received_at: envelope.date ? new Date(envelope.date) : new Date(),
            has_attachments: hasAttachments,
            attachment_count: attachmentCount,
          });

          // Marcar como lida
          await client.messageFlagsAdd({ uid: message.uid }, ['\\Seen']);

          count++;
        } catch (msgError) {
          console.error('Erro ao processar mensagem:', msgError);
          // Continuar com as outras mensagens
        }
      }
    } finally {
      mailbox.release();
    }
  } finally {
    await client.logout();
  }

  return emails;
}

/**
 * Decodifica o corpo do email (base64, quoted-printable)
 */
function decodeEmailBody(body: string): string {
  if (!body) return '';

  // Tentar decodificar base64
  if (/^[A-Za-z0-9+/=\s]+$/.test(body.trim())) {
    try {
      return atob(body.replace(/\s/g, ''));
    } catch {
      // Não é base64 válido
    }
  }

  // Decodificar quoted-printable
  return body
    .replace(/=\r?\n/g, '') // Soft line breaks
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
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
