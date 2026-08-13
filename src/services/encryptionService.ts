import { doubleRatchetService } from './doubleRatchetService';

export type EncryptionContext = {
  type: 'direct' | 'lounge';
  roomId?: string;
  peerUserId?: number;
  isEncrypted?: boolean;
};

/**
 * Centralized encryption service - single source of truth for all encryption/decryption
 */

/**
 * Low-level XOR encryption (for lounge/room messages) - UTF-8 byte safe
 */
function encryptXOR(content: string, key: string): string {
  if (!content) return '';
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(content);
  const keyBytes = encoder.encode(key || 'VELUM_KEY');
  const xorBytes = new Uint8Array(textBytes.length);

  for (let i = 0; i < textBytes.length; i++) {
    xorBytes[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
  }

  // Convert Uint8Array to base64
  let binary = '';
  for (let i = 0; i < xorBytes.length; i++) {
    binary += String.fromCharCode(xorBytes[i]);
  }
  return btoa(binary);
}

/**
 * Low-level XOR decryption (for lounge/room messages) - UTF-8 byte safe
 */
function decryptXOR(cipher: string, key: string): string {
  if (!cipher) return '';
  try {
    const binary = atob(cipher);
    const cipherBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      cipherBytes[i] = binary.charCodeAt(i);
    }

    const encoder = new TextEncoder();
    const keyBytes = encoder.encode(key || 'VELUM_KEY');
    const textBytes = new Uint8Array(cipherBytes.length);

    for (let i = 0; i < cipherBytes.length; i++) {
      textBytes[i] = cipherBytes[i] ^ keyBytes[i % keyBytes.length];
    }

    const decoder = new TextDecoder('utf-8', { fatal: false });
    return decoder.decode(textBytes);
  } catch (e) {
    return cipher;
  }
}

/**
 * Encrypt message based on context
 * - Direct messages: Double Ratchet E2EE
 * - Lounge messages: XOR encryption with room key
 */
export async function encryptMessage(content: string, context: EncryptionContext): Promise<string> {
  if (!content) return '';

  if (context.type === 'direct' && context.peerUserId) {
    try {
      return await doubleRatchetService.encryptDirectMessage(content, context.peerUserId);
    } catch (err) {
      console.error('[encryptionService] Direct message encryption failed:', err);
      return content; // Fallback to plaintext on error
    }
  }

  if (context.type === 'lounge' && context.roomId) {
    return `VEL_E2EE[${encryptXOR(content, 'VELUM_E2EE_' + context.roomId)}]`;
  }

  return content; // Default to plaintext
}

/**
 * Decrypt message based on content format and context
 * Handles: Double Ratchet (ratchet:v2), Legacy Ratchet (ratchet:v1), Room XOR (VEL_E2EE), Plain text
 */
export async function decryptMessage(content: string, context: EncryptionContext): Promise<string> {
  if (!content) return '';

  // Double Ratchet v2 (current direct messages)
  if (content.startsWith('ratchet:v2:')) {
    if (context.peerUserId) {
      try {
        return await doubleRatchetService.decryptDirectMessage(content, context.peerUserId);
      } catch (err) {
        console.error('[encryptionService] Double Ratchet decryption error:', err);
        return '[Encrypted Message]';
      }
    }
    return '[Encrypted Message - No Peer]';
  }

  // Legacy Double Ratchet v1
  if (content.startsWith('ratchet:v1:')) {
    return '[Legacy Encrypted Message]';
  }

  // Room XOR encryption (lounge messages)
  if (content.startsWith('VEL_E2EE[')) {
    if (context.roomId) {
      try {
        let cleanCipher = content.slice(9);
        if (cleanCipher.endsWith(']')) {
          cleanCipher = cleanCipher.slice(0, -1);
        }
        return decryptXOR(cleanCipher, 'VELUM_E2EE_' + context.roomId);
      } catch (err) {
        console.error('[encryptionService] Room XOR decryption error:', err);
        return '[Encrypted Message]';
      }
    }
    return '[Encrypted Message - No Room]';
  }

  // Plain text (no encryption)
  return content;
}

/**
 * Legacy synchronous decryption for backward compatibility
 * @deprecated Use decryptMessage instead
 */
export function decryptMessageSync(content: string, roomId: string, isEncryptedHeader?: boolean): string {
  if (!content) return '';
  const isEncrypted = !!(isEncryptedHeader || content.startsWith('VEL_E2EE['));
  if (!isEncrypted) return content;

  let cleanCipher = content;
  if (cleanCipher.startsWith('VEL_E2EE[')) {
    cleanCipher = cleanCipher.substring(9, cleanCipher.length - 1);
  }
  return decryptXOR(cleanCipher, 'VELUM_E2EE_' + roomId);
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
