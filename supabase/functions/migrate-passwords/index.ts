/**
 * Edge Function: migrate-passwords
 *
 * Migra senhas em texto puro para encriptadas.
 * Execute uma vez após configurar EMAIL_ENCRYPTION_KEY.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
import { encrypt, getEncryptionKey } from '../_shared/encryption.ts';

serve(async (req) => {
  // Verificar método
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Headers CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const encryptionKey = getEncryptionKey();
    const supabase = getSupabaseClient();

    // Buscar lojas com senhas em texto puro
    const { data: shops, error: fetchError } = await supabase
      .from('shops')
      .select('id, name, imap_password, smtp_password, shopify_client_secret')
      .or(
        'imap_password.neq.,imap_password_encrypted.is.null,' +
          'shopify_client_secret.neq.,shopify_client_secret_encrypted.is.null'
      );

    if (fetchError) throw fetchError;

    const results = {
      total: shops?.length || 0,
      migrated: 0,
      errors: [] as string[],
    };

    for (const shop of shops || []) {
      try {
        const updates: Record<string, string | null> = {};

        // Encriptar senha IMAP
        if (shop.imap_password) {
          updates.imap_password_encrypted = await encrypt(shop.imap_password, encryptionKey);
          updates.imap_password = null; // Limpar texto puro
        }

        // Encriptar senha SMTP
        if (shop.smtp_password) {
          updates.smtp_password_encrypted = await encrypt(shop.smtp_password, encryptionKey);
          updates.smtp_password = null;
        }

        // Encriptar Shopify secret
        if (shop.shopify_client_secret) {
          updates.shopify_client_secret_encrypted = await encrypt(
            shop.shopify_client_secret,
            encryptionKey
          );
          updates.shopify_client_secret = null;
        }

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('shops')
            .update(updates)
            .eq('id', shop.id);

          if (updateError) throw updateError;
          results.migrated++;
        }
      } catch (error) {
        results.errors.push(
          `Loja ${shop.id} (${shop.name}): ${error instanceof Error ? error.message : 'Erro desconhecido'}`
        );
      }
    }

    return new Response(JSON.stringify(results), { headers: corsHeaders });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
