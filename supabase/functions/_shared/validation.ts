/**
 * Funções de validação compartilhadas
 * Segurança: validação de email e senha
 */

/**
 * Regex RFC 5322 simplificado para validação de email
 * Valida formato básico de email com domínio válido
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Valida se um email é válido
 * @param email - Email a ser validado
 * @returns true se o email é válido
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;

  // RFC 5321 limita emails a 254 caracteres
  if (email.length > 254) return false;

  // Parte local (antes do @) tem limite de 64 caracteres
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  if (parts[0].length > 64) return false;

  return EMAIL_REGEX.test(email);
}

/**
 * Resultado da validação de senha
 */
export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valida requisitos de senha forte
 * - Mínimo 8 caracteres
 * - Pelo menos uma letra maiúscula
 * - Pelo menos uma letra minúscula
 * - Pelo menos um número
 *
 * @param password - Senha a ser validada
 * @returns Objeto com valid e error (se inválida)
 */
export function validatePassword(password: string): PasswordValidationResult {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Senha é obrigatória' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Senha deve ter no mínimo 8 caracteres' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Senha deve ter no máximo 128 caracteres' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Senha deve ter pelo menos uma letra maiúscula' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Senha deve ter pelo menos uma letra minúscula' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Senha deve ter pelo menos um número' };
  }

  return { valid: true };
}

/**
 * Sanitiza string removendo caracteres potencialmente perigosos
 * Útil para prevenir injection attacks em logs
 * @param input - String a ser sanitizada
 * @param maxLength - Tamanho máximo (default: 1000)
 * @returns String sanitizada
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') return '';

  return input
    .slice(0, maxLength)
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove caracteres de controle
    .trim();
}

/**
 * Valida UUID v4
 * @param uuid - UUID a ser validado
 * @returns true se é um UUID válido
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') return false;

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return UUID_REGEX.test(uuid);
}
