/**
 * CORS Headers compartilhados
 * Segurança: restringe origens permitidas para prevenir CSRF
 */

/**
 * Lista de origens permitidas
 * Adicione novos domínios aqui conforme necessário
 */
const ALLOWED_ORIGINS = [
  'https://app.replyna.me',
  'https://replyna.me',
  'http://localhost:5173', // desenvolvimento Vite
  'http://localhost:3000', // desenvolvimento alternativo
];

/**
 * Obtém headers CORS dinâmicos baseado na origem da requisição
 * Se a origem não está na whitelist, usa a primeira origem permitida
 *
 * @param origin - Header Origin da requisição (pode ser null)
 * @returns Headers CORS configurados
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  // Se a origem está na whitelist, permite
  // Caso contrário, retorna a origem de produção (não permite a requisição)
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin || '')
    ? origin!
    : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Headers CORS legados para compatibilidade
 * @deprecated Use getCorsHeaders(origin) em vez disso
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

/**
 * Verifica se uma origem está na whitelist
 * @param origin - Origem a verificar
 * @returns true se a origem é permitida
 */
export function isAllowedOrigin(origin: string | null): boolean {
  return ALLOWED_ORIGINS.includes(origin || '');
}

/**
 * Retorna a lista de origens permitidas (para debug/logs)
 */
export function getAllowedOrigins(): string[] {
  return [...ALLOWED_ORIGINS];
}
