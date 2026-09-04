import { statelessE2eeService } from './statelessE2eeService.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import {
  toBase64,
  fromBase64,
  utf8ToBytes,
  bytesToUtf8,
  getRandomBytes,
  toHex,
  encryptAesGcm,
  decryptAesGcm
} from './cryptoPrimitives.js';

export type EncryptionContext = {
  type: 'direct' | 'lounge';
  roomId?: string;
  peerUserId?: number;
  isEncrypted?: boolean;
};

const IV_LENGTH = 12;

/**
 * Derives a 256-bit symmetric cipher key for a lounge using HMAC-SHA256
 */
function getCipherKey(roomKey?: string): Uint8Array {
  const envMaster =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_LOUNGE_MASTER_KEY) ||
    (typeof process !== 'undefined' && process.env?.LOUNGE_ENCRYPTION_KEY) ||
    'velum-auth-master-seed';
  const keyBytes = utf8ToBytes(envMaster);
  const msgBytes = utf8ToBytes(roomKey || 'default-room');
  return hmac(sha256, keyBytes, msgBytes);
}

/**
 * Lounge encryption - AES-256-GCM via WebCrypto with HMAC-derived key
 */
async function encryptLounge(content: string, key?: string): Promise<string> {
  if (!content) return '';
  const cipherKey = getCipherKey(key);
  const iv = getRandomBytes(IV_LENGTH);
  const plaintextBytes = utf8ToBytes(content);
  const { ciphertext, tag } = await encryptAesGcm(cipherKey, plaintextBytes, iv);

  // Pack IV (12B) + Tag (16B) + Ciphertext into Base64
  const packed = new Uint8Array(iv.length + tag.length + ciphertext.length);
  packed.set(iv, 0);
  packed.set(tag, iv.length);
  packed.set(ciphertext, iv.length + tag.length);

  return toBase64(packed);
}

/**
 * Lounge decryption - AES-256-GCM via WebCrypto with HMAC-derived key
 */
async function decryptLounge(cipherText: string, key?: string): Promise<string> {
  if (!cipherText) return '';
  try {
    const data = fromBase64(cipherText);
    if (data.length < 28) return cipherText;

    const iv = data.slice(0, IV_LENGTH);
    const tag = data.slice(IV_LENGTH, IV_LENGTH + 16);
    const ciphertext = data.slice(IV_LENGTH + 16);
    const cipherKey = getCipherKey(key);

    const decrypted = await decryptAesGcm(cipherKey, ciphertext, tag, iv);
    return bytesToUtf8(decrypted);
  } catch {
    return cipherText;
  }
}

/**
 * Encrypt message based on context:
 * - Direct messages: Pure Stateless Ephemeral ECDH + AES-256-GCM
 * - Lounge messages: Room HMAC + AES-256-GCM
 */
export async function encryptMessage(content: string, context: EncryptionContext): Promise<string> {
  if (!content) return '';

  if (context.type === 'direct' && context.peerUserId) {
    try {
      return await statelessE2eeService.encryptDirectMessage(content, context.peerUserId);
    } catch (err) {
      console.error('[encryptionService] Direct message encryption failed:', err);
      return content;
    }
  }

  if (context.type === 'lounge' && context.roomId) {
    const encrypted = await encryptLounge(content, 'VELUM_E2EE_' + context.roomId);
    return `VEL_E2EE[${encrypted}]`;
  }

  return content;
}

/**
 * Decrypt message based on content format:
 * - Stateless E2EE (e2ee:v2:... and e2ee:v1:...)
 * - Lounge HMAC-GCM (VEL_E2EE[...])
 * - Plaintext
 */
export async function decryptMessage(content: string, context: EncryptionContext): Promise<string> {
  if (!content) return '';

  // 1. Stateless Direct Message (v2 Dual-Recipient & v1 Legacy)
  if (content.startsWith('e2ee:v2:') || content.startsWith('e2ee:v1:') || content.startsWith('e2ee:')) {
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

  // 3. Lounge Room HMAC-GCM encryption
  if (content.startsWith('VEL_E2EE[')) {
    if (context.roomId) {
      try {
        let cleanCipher = content.slice(9);
        if (cleanCipher.endsWith(']')) {
          cleanCipher = cleanCipher.slice(0, -1);
        }
        const unwrapped = await decryptLounge(cleanCipher, 'VELUM_E2EE_' + context.roomId);
        if (unwrapped.startsWith('e2ee:') || unwrapped.startsWith('ratchet:v2:') || unwrapped.startsWith('ratchet:v1:') || unwrapped.startsWith('VEL_E2EE[')) {
          return await decryptMessage(unwrapped, context);
        }
        return unwrapped;
      } catch (err) {
        console.error('[encryptionService] Room decryption error:', err);
        return '[Encrypted Message]';
      }
    }
    return '[Encrypted Message - No Room]';
  }

  return content;
}

/**
 * Synchronous decryption fallback (returns cipher for async resolution)
 */
export function decryptMessageSync(content: string, _roomId: string, isEncryptedHeader?: boolean): string {
  if (!content) return '';
  const isEncrypted = !!(isEncryptedHeader || content.startsWith('VEL_E2EE['));
  if (!isEncrypted) return content;
  return content;
}

/**
 * Computes client hash using HMAC-SHA256
 */
export async function computeClientHash(secret: string, salt: string): Promise<string> {
  const keyBytes = utf8ToBytes(salt);
  const dataBytes = utf8ToBytes(secret);
  const mac = hmac(sha256, keyBytes, dataBytes);
  return toHex(mac);
}
