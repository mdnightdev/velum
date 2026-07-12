import { encryptE2E, decryptE2E } from '../types';

/**
 * Encrypt a text message with the room-specific symmetric key pattern.
 */
export function encryptMessage(content: string, roomId: string): string {
  if (!content) return '';
  return encryptE2E(content, 'VELUM_E2EE_' + roomId);
}

/**
 * Decrypt a message if it is encrypted, using the room-specific key.
 */
export function decryptMessage(content: string, roomId: string, isEncryptedHeader?: boolean): string {
  if (!content) return '';
  const isEncrypted = !!(isEncryptedHeader || content.startsWith('VEL_E2EE['));
  if (!isEncrypted) return content;

  let cleanCipher = content;
  if (cleanCipher.startsWith('VEL_E2EE[')) {
    cleanCipher = cleanCipher.substring(9, cleanCipher.length - 1);
  }
  return decryptE2E(cleanCipher, 'VELUM_E2EE_' + roomId);
}

/**
 * Computes SHA-256 client hash using Web Cryptography API.
 * Uses fallback to globalThis.crypto for Node-based test runners.
 */
export async function computeClientHash(secret: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + secret);
  const cryptoProvider = typeof window !== 'undefined' ? window.crypto : (globalThis as any).crypto;
  const hashBuffer = await cryptoProvider.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
