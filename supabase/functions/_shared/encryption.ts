/**
 * Módulo de Encriptação AES-256-GCM
 * Usado para proteger senhas de email e secrets do Shopify
 */

// Deno/Edge Function environment
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Deriva uma chave de encriptação a partir da chave mestra
 */
async function deriveKey(masterKey: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterKey),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('replyna-v2-salt'), // Salt fixo - ok para este caso de uso
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encripta uma string usando AES-256-GCM
 * Retorna: iv:ciphertext (base64)
 */
export async function encrypt(plaintext: string, masterKey: string): Promise<string> {
  if (!plaintext) return '';
  if (!masterKey) throw new Error('EMAIL_ENCRYPTION_KEY não configurada');

  const key = await deriveKey(masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV para GCM

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );

  // Combinar IV + ciphertext e converter para base64
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decripta uma string encriptada com AES-256-GCM
 * Espera formato: iv:ciphertext (base64)
 */
export async function decrypt(encryptedData: string, masterKey: string): Promise<string> {
  if (!encryptedData) return '';
  if (!masterKey) throw new Error('EMAIL_ENCRYPTION_KEY não configurada');

  const key = await deriveKey(masterKey);

  // Decodificar base64
  const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));

  // Extrair IV (primeiros 12 bytes) e ciphertext (resto)
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return decoder.decode(plaintext);
}

/**
 * Verifica se uma string está encriptada (formato base64 válido com tamanho mínimo)
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  // Valor encriptado tem pelo menos 12 bytes de IV + algum ciphertext
  // Em base64, isso é pelo menos ~20 caracteres
  if (value.length < 20) return false;

  try {
    atob(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper para obter a chave de encriptação do ambiente
 */
export function getEncryptionKey(): string {
  const key = Deno.env.get('EMAIL_ENCRYPTION_KEY');
  if (!key) {
    throw new Error(
      'EMAIL_ENCRYPTION_KEY não está configurada. ' +
        'Adicione nas variáveis de ambiente do Supabase Edge Functions.'
    );
  }
  return key;
}

// Tipos exportados
export interface EncryptedCredentials {
  imap_password: string;
  smtp_password: string;
  shopify_client_secret?: string;
}

export interface DecryptedCredentials {
  imap_password: string;
  smtp_password: string;
  shopify_client_secret?: string;
}
