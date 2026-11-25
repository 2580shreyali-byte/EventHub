import crypto from 'crypto';

/**
 * Generates a cryptographically secure random token (256-bit entropy, 64 hex characters)
 */
export function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Computes a SHA-256 hash of a raw token
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generates a client-side or server-side scan UUID (v4)
 */
export function generateUuid() {
  return crypto.randomUUID();
}
