/**
 * Edge Function: Test Shop Connection
 *
 * Testa a conexão IMAP de uma loja específica.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { ImapFlow } from 'npm:imapflow@1.0.162';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Função para descriptografar senha
function decryptPassword(encrypted: string): string {
  const key = Deno.env.get('ENCRYPTION_KEY');
  if (!key) {
    throw new Error('ENCRYPTION_KEY não configurada');
  }

  // Formato: iv:encrypted (hex)
  const [ivHex, encryptedHex] = encrypted.split(':');
  if (!ivHex || !encryptedHex) {
    // Se não está no formato criptografado, retorna como está
    return encrypted;
  }

  try {
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const encryptedBytes = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

    // Criar chave a partir da string
    const encoder = new TextEncoder();
    const keyBytes = encoder.encode(key.padEnd(32, '0').slice(0, 32));

    // Usar XOR simples para descriptografar (mesmo método usado na criptografia)
    const decrypted = new Uint8Array(encryptedBytes.length);
    for (let i = 0; i < encryptedBytes.length; i++) {
      decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length] ^ iv[i % iv.length];
    }

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch {
    // Se falhar a descriptografia, retorna o valor original
    return encrypted;
  }
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

    const { shop_id, shop_name } = await req.json();

    // Buscar loja pelo ID ou nome
    let query = supabase.from('shops').select('*');

    if (shop_id) {
      query = query.eq('id', shop_id);
    } else if (shop_name) {
      query = query.ilike('name', `%${shop_name}%`);
    } else {
      // Se não passar nenhum, buscar lojas que nunca sincronizaram
      query = query.eq('is_active', true).is('last_email_sync_at', null);
    }

    const { data: shops, error: shopError } = await query;

    if (shopError) {
      throw shopError;
    }

    if (!shops || shops.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma loja encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const shop of shops) {
      const result: Record<string, unknown> = {
        shop_name: shop.name,
        shop_id: shop.id,
        imap_host: shop.imap_host,
        imap_port: shop.imap_port,
        imap_user: shop.imap_user,
      };

      if (!shop.imap_host || !shop.imap_user) {
        result.status = 'error';
        result.error = 'Configuração IMAP incompleta';
        results.push(result);
        continue;
      }

      // Descriptografar senha
      let password = shop.imap_password;
      if (shop.imap_password_encrypted) {
        try {
          password = decryptPassword(shop.imap_password_encrypted);
        } catch (e) {
          result.status = 'error';
          result.error = 'Erro ao descriptografar senha: ' + e.message;
          results.push(result);
          continue;
        }
      }

      if (!password) {
        result.status = 'error';
        result.error = 'Senha IMAP não configurada';
        results.push(result);
        continue;
      }

      // Testar conexão IMAP
      const client = new ImapFlow({
        host: shop.imap_host,
        port: parseInt(shop.imap_port || '993'),
        secure: true,
        auth: {
          user: shop.imap_user,
          pass: password,
        },
        logger: false,
        tls: {
          rejectUnauthorized: false,
        },
      });

      try {
        console.log(`Testando conexão IMAP para ${shop.name}...`);

        await client.connect();

        // Verificar INBOX
        const mailbox = await client.getMailboxLock('INBOX');
        const mailboxInfo = client.mailbox;

        result.status = 'success';
        result.inbox_exists = mailboxInfo?.exists || 0;
        result.inbox_unseen = mailboxInfo?.unseen || 0;

        mailbox.release();
        await client.logout();

        console.log(`Conexão OK para ${shop.name}: ${result.inbox_exists} emails, ${result.inbox_unseen} não lidos`);

      } catch (imapError) {
        result.status = 'error';
        result.error = imapError.message;
        console.error(`Erro IMAP para ${shop.name}:`, imapError.message);

        try {
          await client.logout();
        } catch {
          // Ignorar erro de logout
        }
      }

      results.push(result);
    }

    return new Response(
      JSON.stringify({
        total: results.length,
        success: results.filter(r => r.status === 'success').length,
        errors: results.filter(r => r.status === 'error').length,
        results,
      }, null, 2),
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
