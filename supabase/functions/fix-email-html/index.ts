/**
 * Edge Function: Fix Email HTML
 *
 * Reprocessa emails antigos para extrair body_html do body_text
 * quando o body_text contém dados MIME raw.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Decodifica quoted-printable para UTF-8
 */
function decodeQuotedPrintable(text: string, charset: string = 'utf-8'): string {
  const withoutSoftBreaks = text.replace(/=\r?\n/g, '');
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
  try {
    const normalizedCharset = charset.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const decoder = new TextDecoder(normalizedCharset === 'utf8' ? 'utf-8' : normalizedCharset);
    return decoder.decode(new Uint8Array(bytes));
  } catch {
    try {
      return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    } catch {
      return text;
    }
  }
}

/**
 * Decodifica Base64 para UTF-8
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

interface MimeExtractResult {
  textContent: string;
  htmlContent: string | null;
  hasAttachments: boolean;
  attachmentCount: number;
}

/**
 * Extrai conteúdo text/plain e text/html de MIME multipart
 */
function extractFromMime(body: string): MimeExtractResult {
  const result: MimeExtractResult = {
    textContent: '',
    htmlContent: null,
    hasAttachments: false,
    attachmentCount: 0,
  };

  if (!body) return result;

  // Verificar se é MIME multipart
  const boundaryHeaderMatch = body.match(/Content-Type:\s*multipart\/[^;]+;\s*boundary=["']?([^"'\r\n;]+)/i);
  let boundary = '';

  if (boundaryHeaderMatch) {
    boundary = boundaryHeaderMatch[1].trim();
  } else {
    const boundaryMatch = body.match(/^--([^\r\n]+)/m);
    if (!boundaryMatch) {
      result.textContent = body;
      return result;
    }
    boundary = boundaryMatch[1].trim();
  }

  const escapedBoundary = boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = body.split(new RegExp(`--${escapedBoundary}(?:--)?`));

  let textContent = '';
  let htmlContent = '';

  for (const part of parts) {
    if (!part.trim()) continue;

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

    const charsetMatch = part.match(/charset=["']?([^"';\s\r\n]+)/i);
    const charset = charsetMatch ? charsetMatch[1] : 'utf-8';

    const isQuotedPrintable = /Content-Transfer-Encoding:\s*quoted-printable/i.test(part);
    const isBase64 = /Content-Transfer-Encoding:\s*base64/i.test(part);

    const contentMatch = part.match(/\r?\n\r?\n([\s\S]*)/);
    if (!contentMatch) continue;

    let content = contentMatch[1].trim();

    if (isQuotedPrintable) {
      content = decodeQuotedPrintable(content, charset);
    } else if (isBase64) {
      content = decodeBase64ToUtf8(content, charset);
    }

    // Recursão para multipart aninhado
    if (contentType.includes('multipart/')) {
      const nestedResult = extractFromMime(part);
      if (nestedResult.textContent) textContent = nestedResult.textContent;
      if (nestedResult.htmlContent) htmlContent = nestedResult.htmlContent;
      if (nestedResult.hasAttachments) {
        result.hasAttachments = true;
        result.attachmentCount += nestedResult.attachmentCount;
      }
      continue;
    }

    if (contentType.includes('text/plain')) {
      textContent = content;
    } else if (contentType.includes('text/html')) {
      htmlContent = content;
    }
  }

  if (textContent) {
    result.textContent = textContent;
  } else if (htmlContent) {
    // Converter HTML para texto se não tiver text/plain
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

  if (htmlContent) {
    result.htmlContent = htmlContent;
  }

  return result;
}

/**
 * Verifica se o body_text contém dados MIME que podem ser reprocessados
 */
function containsMimeData(text: string | null): boolean {
  if (!text) return false;
  return (
    /Content-Type:\s*multipart\//i.test(text) ||
    /Content-Type:\s*text\/html/i.test(text) ||
    /^--[A-Za-z0-9_-]+\r?\n/m.test(text)
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Parâmetros opcionais
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const shopId = url.searchParams.get('shop_id');
    const dryRun = url.searchParams.get('dry_run') === 'true';

    console.log(`Buscando mensagens para reprocessar (limit=${limit}, shop_id=${shopId || 'all'}, dry_run=${dryRun})`);

    // Buscar mensagens onde body_html é null e body_text contém dados MIME
    let query = supabase
      .from('messages')
      .select('id, body_text, body_html, conversation_id')
      .is('body_html', null)
      .not('body_text', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (shopId) {
      // Filtrar por shop_id através da conversation
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('shop_id', shopId);

      if (conversations && conversations.length > 0) {
        const conversationIds = conversations.map(c => c.id);
        query = query.in('conversation_id', conversationIds);
      }
    }

    const { data: messages, error } = await query;

    if (error) {
      throw error;
    }

    console.log(`Encontradas ${messages?.length || 0} mensagens para verificar`);

    const results = {
      total_checked: 0,
      updated: 0,
      skipped_no_mime: 0,
      skipped_no_html: 0,
      errors: 0,
      details: [] as { id: string; status: string; html_length?: number }[],
    };

    for (const message of messages || []) {
      results.total_checked++;

      // Verificar se contém dados MIME
      if (!containsMimeData(message.body_text)) {
        results.skipped_no_mime++;
        continue;
      }

      // Extrair HTML
      const extracted = extractFromMime(message.body_text!);

      if (!extracted.htmlContent) {
        results.skipped_no_html++;
        results.details.push({ id: message.id, status: 'no_html_found' });
        continue;
      }

      if (dryRun) {
        results.updated++;
        results.details.push({
          id: message.id,
          status: 'would_update',
          html_length: extracted.htmlContent.length,
        });
        continue;
      }

      // Atualizar no banco
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          body_html: extracted.htmlContent,
          has_attachments: extracted.hasAttachments,
          attachment_count: extracted.attachmentCount,
        })
        .eq('id', message.id);

      if (updateError) {
        console.error(`Erro ao atualizar mensagem ${message.id}:`, updateError);
        results.errors++;
        results.details.push({ id: message.id, status: 'error' });
      } else {
        results.updated++;
        results.details.push({
          id: message.id,
          status: 'updated',
          html_length: extracted.htmlContent.length,
        });
      }
    }

    console.log('Resultados:', results);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
