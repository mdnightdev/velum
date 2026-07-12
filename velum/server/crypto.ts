import crypto from 'crypto';
import { argon2id } from 'hash-wasm';
import { writeServerLog } from './utils/logger.js';

// OWASP ASVS v4.0 Recommended Argon2id Parameters (Memory: 15MiB, Iterations: 3, Parallelism: 1)
const ARGON2_ITERATIONS = 3;
const ARGON2_MEMORY = 15360; // 15 MiB in KiB
const ARGON2_PARALLELISM = 1;
const ARGON2_HASH_LENGTH = 32;

/**
 * Hash a plain text string using Argon2id with standard OWASP configuration.
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
 * Constant-time comparison of two strings to prevent timing leaks.
 */
export function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    // Perform dummy timing-safe comparison to consume constant time
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Validate username formatting (Alphanumeric, dots, underscores, length 3-30).
 */
export function isValidUsername(username: string): boolean {
  if (!username) return false;
  const clean = username.startsWith('@') ? username.substring(1) : username;
  return /^[a-zA-Z0-9._-]{3,30}$/.test(clean);
}

/**
 * Normalize username for consistent DB lookups.
 */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

// Single-use Nonce Cache for Challenge-Response Authentication
export interface LoginNonce {
  nonce: string;
  createdAt: number;
  used: boolean;
}

export const nonceCache = new Map<string, LoginNonce>();

/**
 * Prune expired nonces to prevent memory leaks.
 */
export function pruneNonceCache() {
  const now = Date.now();
  const TTL = 90 * 1000; // 90 seconds lifetime
  for (const [key, value] of nonceCache.entries()) {
    if (now - value.createdAt > TTL) {
      nonceCache.delete(key);
    }
  }
}

/**
 * Generate a cryptographically secure single-use nonce.
 */
export function generateLoginNonce(): string {
  pruneNonceCache();
  const nonce = crypto.randomBytes(32).toString('hex');
  nonceCache.set(nonce, {
    nonce,
    createdAt: Date.now(),
    used: false
  });
  writeServerLog(`[SYS-SECURE] [NONCE-GEN] Generated secure login nonce: ${nonce}`);
  return nonce;
}

/**
 * Verify and consume a nonce. Returns true if valid, single-use, and not expired.
 */
export function verifyAndConsumeNonce(nonce: string): boolean {
  pruneNonceCache();
  writeServerLog(`[SYS-SECURE] [NONCE-VERIFY] Verifying incoming nonce: ${nonce}. Cache size: ${nonceCache.size}`);
  const record = nonceCache.get(nonce);
  if (!record) {
    writeServerLog(`[SYS-SECURE] [NONCE-FAIL] Nonce ${nonce} not found in cache. Current keys: ${Array.from(nonceCache.keys()).join(', ')}`);
    return false;
  }

  const TTL = 90 * 1000;
  if (Date.now() - record.createdAt > TTL) {
    nonceCache.delete(nonce);
    return false;
  }

  if (record.used) {
    nonceCache.delete(nonce);
    return false;
  }

  record.used = true;
  nonceCache.delete(nonce);
  return true;
}

/**
 * Calculate progressive exponential backoff lockout milliseconds.
 */
export function calculateBackoffMs(attempts: number): number {
  if (attempts <= 5) return 0;
  const excess = attempts - 5;
  if (excess === 1) return 30 * 1000;      // 30 seconds
  if (excess === 2) return 120 * 1000;     // 2 minutes
  if (excess === 3) return 600 * 1000;     // 10 minutes
  return 1800 * 1000;                      // 30 minutes max
}
