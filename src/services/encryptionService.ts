import { statelessE2eeService } from './statelessE2eeService.js';
import crypto from 'node:crypto';

export type EncryptionContext = {
  type: 'direct' | 'lounge';
  roomId?: string;
  peerUserId?: number;
  isEncrypted?: boolean;
};

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getCipherKey(roomKey?: string): Buffer {
  const master = process.env.LOUNGE_ENCRYPTION_KEY || 'velum-default-fallback-key-32b';
  return crypto.createHash('sha256').update((roomKey || '') + master).digest();
}

/**
 * Lounge encryption - AES-256-GCM
 */
function encryptXOR(content: string, key?: string): string {
  if (!content) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getCipherKey(key), iv);
  const encrypted = Buffer.concat([cipher.update(content, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Pack IV (12B) + Tag (16B) + Ciphertext into Base64
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Lounge decryption - AES-256-GCM
 */
function decryptXOR(cipherText: string, key?: string): string {
  if (!cipherText) return '';
  try {
    const data = Buffer.from(cipherText, 'base64');
    if (data.length < 28) return cipherText; // Not a valid GCM payload

    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + 16);
    const text = data.subarray(IV_LENGTH + 16);

    const decipher = crypto.createDecipheriv(ALGORITHM, getCipherKey(key), iv);
    decipher.setAuthTag(tag);
    return decipher.update(text, undefined, 'utf8') + decipher.final('utf8');
  } catch {
    return cipherText;
  }
}
/**
 * Encrypt message based on context:
 * - Direct messages: Pure Stateless Ephemeral ECDH + AES-256-GCM
 * - Lounge messages: Room XOR encryption
 */
export async function encryptMessage(content: string, context: EncryptionContext): Promise<string> {
  if (!content) return '';

  if (context.type === 'direct' && context.peerUserId) {
    try {
      return await statelessE2eeService.encryptDirectMessage(content, context.peerUserId);
    } catch (err) {
      console.error('[encryptionService] Direct message encryption failed:', err);
      return content; // Fallback to plaintext on network error
    }
  }

  if (context.type === 'lounge' && context.roomId) {
    return `VEL_E2EE[${encryptXOR(content, 'VELUM_E2EE_' + context.roomId)}]`;
  }

  return content;
}

/**
 * Decrypt message based on content format:
 * - Stateless E2EE (e2ee:v1:...)
 * - Lounge XOR (VEL_E2EE[...])
 * - Plaintext
 */
export async function decryptMessage(content: string, context: EncryptionContext): Promise<string> {
  if (!content) return '';

  // 1. Stateless Direct Message
  if (content.startsWith('e2ee:v1:')) {
    try {
      return await statelessE2eeService.decryptDirectMessage(content);
    } catch (err) {
      console.error('[encryptionService] Stateless E2EE decryption error:', err);
      return '[Encrypted Message]';
    }
  }

  // 2. Legacy ratchet payload fallback
  if (content.startsWith('ratchet:v2:') || content.startsWith('ratchet:v1:')) {
    return '[Legacy Encrypted Message]';
  }

  // 3. Lounge Room XOR encryption
  if (content.startsWith('VEL_E2EE[')) {
    if (context.roomId) {
      try {
        let cleanCipher = content.slice(9);
        if (cleanCipher.endsWith(']')) {
          cleanCipher = cleanCipher.slice(0, -1);
        }
        const unwrapped = decryptXOR(cleanCipher, 'VELUM_E2EE_' + context.roomId);
        // Defense-in-depth: if a message was accidentally double-encrypted
        // (e.g. a stateless DM envelope mistakenly wrapped in lounge XOR),
        // the XOR layer will "successfully" unwrap to another cipher-prefixed
        // string rather than real plaintext. Never surface that as the final
        // result - recurse so the inner layer gets properly decrypted too.
        if (unwrapped.startsWith('e2ee:v1:') || unwrapped.startsWith('ratchet:v2:') || unwrapped.startsWith('ratchet:v1:') || unwrapped.startsWith('VEL_E2EE[')) {
          return await decryptMessage(unwrapped, context);
        }
        return unwrapped;
      } catch (err) {
        console.error('[encryptionService] Room XOR decryption error:', err);
        return '[Encrypted Message]';
      }
    }
    return '[Encrypted Message - No Room]';
  }

  return content;
}

/**
 * Legacy synchronous decryption for backward compatibility
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
 */
export async function computeClientHash(secret: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + secret);
  const cryptoProvider = typeof window !== 'undefined' ? window.crypto : (globalThis as any).crypto;
  const hashBuffer = await cryptoProvider.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
