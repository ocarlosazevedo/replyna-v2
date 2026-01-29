/**
 * Edge Function: Test Image Extraction
 *
 * Testa a extração de imagens de emails e opcionalmente envia para o Claude.
 * Útil para diagnosticar problemas com processamento de imagens.
 *
 * Modos de uso:
 * 1. POST com { shop_id } - busca último email com imagem da loja
 * 2. POST com { raw_email } - testa extração de um email raw
 * 3. POST com { test_claude: true, ... } - também testa envio para Claude
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { getCorsHeaders } from '../_shared/cors.ts';

// Tipos de mídia suportados
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

interface EmailImage {
  media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  data: string;
  filename?: string;
  size_kb: number;
}

interface ExtractionResult {
  success: boolean;
  images_found: number;
  images: Array<{
    filename?: string;
    media_type: string;
    size_kb: number;
    preview: string; // primeiros 50 chars do base64
  }>;
  has_attachments: boolean;
  attachment_count: number;
  text_preview: string;
  html_found: boolean;
  errors: string[];
}

/**
 * Extrai imagens de um email MIME
 */
function extractImagesFromEmail(body: string): {
  images: EmailImage[];
  hasAttachments: boolean;
  attachmentCount: number;
  textContent: string;
  htmlContent: string | null;
  errors: string[];
} {
  const result = {
    images: [] as EmailImage[],
    hasAttachments: false,
    attachmentCount: 0,
    textContent: '',
    htmlContent: null as string | null,
    errors: [] as string[],
  };

  if (!body) {
    result.errors.push('Email body está vazio');
    return result;
  }

  // Verificar se é MIME multipart
  const boundaryHeaderMatch = body.match(/Content-Type:\s*multipart\/[^;]+;\s*boundary=["']?([^"'\r\n;]+)/i);
  let boundary = '';

  if (boundaryHeaderMatch) {
    boundary = boundaryHeaderMatch[1].trim();
  } else {
    const boundaryMatch = body.match(/^--([^\r\n]+)/m);
    if (!boundaryMatch) {
      result.textContent = body;
      result.errors.push('Email não é multipart - sem boundary encontrado');
      return result;
    }
    boundary = boundaryMatch[1].trim();
  }

  // Dividir em partes
  const parts = body.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'));

  for (const part of parts) {
    if (!part.trim() || part.trim() === '--') continue;

    const contentTypeMatch = part.match(/Content-Type:\s*([^;\r\n]+)/i);
    if (!contentTypeMatch) continue;

    const contentType = contentTypeMatch[1].toLowerCase().trim();

    // Verificar se é uma imagem
    if (contentType.includes('image/')) {
      const mediaTypeMatch = contentType.match(/(image\/(?:jpeg|png|gif|webp))/i);

      if (mediaTypeMatch && SUPPORTED_IMAGE_TYPES.includes(mediaTypeMatch[1].toLowerCase())) {
        const mediaType = mediaTypeMatch[1].toLowerCase() as EmailImage['media_type'];

        // Extrair nome do arquivo
        const filenameMatch = part.match(/(?:filename=["']?([^"';\r\n]+)|name=["']?([^"';\r\n]+))/i);
        const filename = filenameMatch ? (filenameMatch[1] || filenameMatch[2])?.trim() : undefined;

        // Verificar se está em base64
        const isBase64Encoded = /Content-Transfer-Encoding:\s*base64/i.test(part);

        if (!isBase64Encoded) {
          result.errors.push(`Imagem ${filename || 'sem nome'} não está em base64`);
          result.hasAttachments = true;
          result.attachmentCount++;
          continue;
        }

        // Extrair conteúdo
        const imageContentMatch = part.match(/\r?\n\r?\n([\s\S]*)/);
        if (imageContentMatch) {
          const base64Data = imageContentMatch[1].replace(/[\r\n\s]/g, '').trim();
          const estimatedSize = (base64Data.length * 3) / 4;

          if (base64Data.length === 0) {
            result.errors.push(`Imagem ${filename || 'sem nome'} tem conteúdo vazio`);
          } else if (estimatedSize > MAX_IMAGE_SIZE) {
            result.errors.push(`Imagem ${filename || 'sem nome'} muito grande: ${Math.round(estimatedSize / 1024 / 1024)}MB (max 5MB)`);
          } else {
            result.images.push({
              media_type: mediaType,
              data: base64Data,
              filename,
              size_kb: Math.round(estimatedSize / 1024),
            });
          }
        } else {
          result.errors.push(`Imagem ${filename || 'sem nome'}: não foi possível extrair conteúdo`);
        }

        result.hasAttachments = true;
        result.attachmentCount++;
      } else {
        result.errors.push(`Tipo de imagem não suportado: ${contentType}`);
        result.hasAttachments = true;
        result.attachmentCount++;
      }
      continue;
    }

    // Verificar outros attachments
    const isAttachment = /Content-Disposition:\s*attachment/i.test(part) ||
      contentType.includes('application/') ||
      contentType.includes('audio/') ||
      contentType.includes('video/');

    if (isAttachment) {
      result.hasAttachments = true;
      result.attachmentCount++;
      continue;
    }

    // Extrair texto/html
    const contentMatch = part.match(/\r?\n\r?\n([\s\S]*)/);
    if (!contentMatch) continue;

    let content = contentMatch[1].trim();

    // Decodificar se necessário
    const isBase64 = /Content-Transfer-Encoding:\s*base64/i.test(part);
    if (isBase64) {
      try {
        const binaryString = atob(content.replace(/\s/g, ''));
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        content = new TextDecoder('utf-8').decode(bytes);
      } catch (e) {
        result.errors.push(`Erro ao decodificar base64: ${e}`);
      }
    }

    if (contentType.includes('text/plain')) {
      result.textContent = content;
    } else if (contentType.includes('text/html')) {
      result.htmlContent = content;
    }
  }

  return result;
}

/**
 * Testa envio de imagem para o Claude
 */
async function testClaudeVision(images: EmailImage[]): Promise<{ success: boolean; response?: string; error?: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return { success: false, error: 'ANTHROPIC_API_KEY não configurada' };
  }

  if (images.length === 0) {
    return { success: false, error: 'Nenhuma imagem para testar' };
  }

  try {
    const contentParts: Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }> = [];

    // Adicionar texto
    contentParts.push({
      type: 'text',
      text: 'Descreva brevemente o que você vê nesta(s) imagem(s). Responda em português.',
    });

    // Adicionar imagens (máximo 3 para o teste)
    for (const img of images.slice(0, 3)) {
      contentParts.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.media_type,
          data: img.data,
        },
      });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: contentParts,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `API error ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    const textResponse = data.content?.[0]?.text || 'Sem resposta';

    return { success: true, response: textResponse };
  } catch (e) {
    return { success: false, error: `Exceção: ${e}` };
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Use POST com { shop_id } ou { raw_email }' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const { shop_id, raw_email, test_claude } = body;

    let emailBody = '';
    let source = '';

    if (raw_email) {
      // Modo 2: email raw fornecido diretamente
      emailBody = raw_email;
      source = 'raw_email fornecido';
    } else if (shop_id) {
      // Modo 1: buscar último email da loja
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Buscar última mensagem inbound com attachments
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id, body_text, body_html, has_attachments, attachment_count, created_at, conversation_id')
        .eq('direction', 'inbound')
        .eq('has_attachments', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        return new Response(
          JSON.stringify({ error: `Erro ao buscar mensagens: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!messages || messages.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Nenhuma mensagem com attachments encontrada',
            hint: 'O sistema não salva o email raw no banco após processamento. Para testar, envie um email de teste para uma loja e verifique os logs em tempo real.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Retornar info das mensagens encontradas
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Mensagens com attachments encontradas (email raw não é salvo no banco)',
          messages: messages.map(m => ({
            id: m.id,
            conversation_id: m.conversation_id,
            has_attachments: m.has_attachments,
            attachment_count: m.attachment_count,
            created_at: m.created_at,
            text_preview: m.body_text?.substring(0, 200),
          })),
          hint: 'Para testar extração de imagens, envie { raw_email: "..." } com o conteúdo MIME do email',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({
          error: 'Forneça shop_id ou raw_email',
          usage: {
            'Opção 1': 'POST { shop_id: "uuid" } - lista mensagens com attachments',
            'Opção 2': 'POST { raw_email: "..." } - testa extração de email MIME',
            'Opção 3': 'POST { raw_email: "...", test_claude: true } - testa extração + visão do Claude',
          },
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extrair imagens do email
    const extraction = extractImagesFromEmail(emailBody);

    const result: ExtractionResult = {
      success: extraction.images.length > 0,
      images_found: extraction.images.length,
      images: extraction.images.map(img => ({
        filename: img.filename,
        media_type: img.media_type,
        size_kb: img.size_kb,
        preview: img.data.substring(0, 50) + '...',
      })),
      has_attachments: extraction.hasAttachments,
      attachment_count: extraction.attachmentCount,
      text_preview: extraction.textContent.substring(0, 500),
      html_found: !!extraction.htmlContent,
      errors: extraction.errors,
    };

    // Se solicitado, testar com Claude
    let claudeResult = null;
    if (test_claude && extraction.images.length > 0) {
      claudeResult = await testClaudeVision(extraction.images);
    }

    return new Response(
      JSON.stringify({
        source,
        extraction: result,
        claude_test: claudeResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no teste:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
