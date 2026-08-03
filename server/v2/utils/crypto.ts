import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { argon2id } from 'hash-wasm';

const scryptPromise = promisify(crypto.scrypt);

/**
 * Non-blocking key derivation using scrypt asynchronously on Node threadpool.
 */
export async function deriveKeyAsync(
  secret: string | Buffer,
  salt: string | Buffer,
  keylen = 32
): Promise<Buffer> {
  const derived = await scryptPromise(secret, salt, keylen);
  return derived as Buffer;
}

/**
 * Asynchronous AES-256-GCM symmetric data encryption.
 * Returns envelope string: "ivHex:encryptedHex:tagHex"
 */
export async function encryptAsync(text: string, key: Buffer): Promise<string> {
  if (key.length !== 32) {
    throw new Error('[CRYPTO v2] Key must be 32 bytes for AES-256-GCM.');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${encrypted}:${tag}`;
}

/**
 * Asynchronous AES-256-GCM symmetric data decryption.
 * Accepts envelope string: "ivHex:encryptedHex:tagHex"
 */
export async function decryptAsync(envelope: string, key: Buffer): Promise<string> {
  if (!envelope) {
    throw new Error('[CRYPTO v2] Decryption error: Payload is empty.');
  }
  const parts = envelope.split(':');
  if (parts.length !== 3) {
    throw new Error('[CRYPTO v2] Decryption error: Invalid GCM envelope format.');
  }
  
  const [ivHex, encryptedHex, tagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Hash plaintext string using Argon2id with OWASP recommended configuration.
 */
export async function hashArgon2id(plainText: string, saltBuffer: Buffer): Promise<string> {
  return argon2id({
    password: plainText,
    salt: new Uint8Array(saltBuffer),
    parallelism: 1,
    iterations: 3,
    memorySize: 15360, // 15 MiB
    hashLength: 32,
    outputType: 'hex'
  });
}

/**
 * Constant-time comparison of two strings to prevent timing side-channel leaks.
 */
export function safeCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Generate cryptographically secure random token string.
 */
export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}
