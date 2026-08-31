import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { argon2id } from 'hash-wasm';

const scryptPromise = promisify(crypto.scrypt);

// OWASP ASVS v4.0 Recommended Argon2id Parameters (Memory: 15MiB, Iterations: 3, Parallelism: 1)
export const ARGON2_ITERATIONS = 3;
export const ARGON2_MEMORY = 15360; // 15 MiB in KiB
export const ARGON2_PARALLELISM = 1;
export const ARGON2_HASH_LENGTH = 32;

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
 * Hash plaintext string using Argon2id with OWASP ASVS v4.0 recommended configuration.
 */
export async function hashArgon2id(plainText: string, saltBuffer: Buffer): Promise<string> {
  return argon2id({
    password: plainText,
    salt: new Uint8Array(saltBuffer),
    parallelism: ARGON2_PARALLELISM,
    iterations: ARGON2_ITERATIONS,
    memorySize: ARGON2_MEMORY,
    hashLength: ARGON2_HASH_LENGTH,
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
 * Verifies a plain text password/input against an Argon2id hash.
 * Automatically handles:
 * - "argon2id:" algorithm prefix stripping.
 * - "argon2id:<saltHex>:<hashHex>" tuple parsing.
 * - Converting hex salt strings to Uint8Array/Buffer.
 * - Timing-safe comparison using safeCompare.
 */
export async function verifyArgon2id(
  plainText: string,
  salt: string | undefined,
  storedHash: string | undefined
): Promise<boolean> {
  if (!plainText || !storedHash) return false;
  
  let targetSalt = salt;
  let targetHash = storedHash;
  
  if (targetHash.startsWith('argon2id:')) {
    const parts = targetHash.split(':');
    if (parts.length === 3) {
      targetSalt = parts[1];
      targetHash = parts[2];
    } else if (parts.length === 2) {
      targetHash = parts[1];
    }
  }

  if (!targetSalt) return false;

  const saltBuffer = Buffer.from(targetSalt, 'hex');
  const computedHex = await hashArgon2id(plainText, saltBuffer);
  return safeCompare(computedHex, targetHash);
}

/**
 * Generate cryptographically secure random token string.
 */
export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Resolves the true client IP address behind proxies, Cloudflare, or local connections.
 */
export function getClientIp(req: any): string {
  const cfIp = req.headers?.['cf-connecting-ip'] as string;
  if (cfIp) return cfIp.trim();

  const realIp = req.headers?.['x-real-ip'] as string;
  if (realIp) return realIp.trim();

  const forwardedFor = req.headers?.['x-forwarded-for'] as string;
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(i => i.trim()).filter(Boolean);
    if (ips.length > 0) return ips[0];
  }

  if (req.ip) return req.ip;
  if (req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;

  return '127.0.0.1';
}

/**
 * Hash a session token using SHA-256 for persistent database matching.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

