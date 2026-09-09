import { sha256 } from '@noble/hashes/sha2.js';
import { isUsablePlaintext } from './messagePlaintext.js';

/** In-memory ciphertext → plaintext for the current session (single source for UI + crypto). */
const memoryCache = new Map<string, string>();

const MAX_MEMORY_ENTRIES = 4000;

function utf8ToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

/** Stable key for IndexedDB plaintext_cache (avoids indexing full ciphertext blobs). */
export function hashCiphertext(ciphertext: string): string {
  return toHex(sha256(utf8ToBytes(ciphertext)));
}

export function getMemoryPlaintext(ciphertext: string | null | undefined): string | undefined {
  if (!ciphertext) return undefined;
  const pt = memoryCache.get(ciphertext);
  return isUsablePlaintext(pt) ? pt : undefined;
}

export function setMemoryPlaintext(ciphertext: string, plaintext: string): void {
  if (!ciphertext || !isUsablePlaintext(plaintext)) return;
  memoryCache.set(ciphertext, plaintext);
  if (memoryCache.size > MAX_MEMORY_ENTRIES) {
    const excess = memoryCache.size - 3000;
    let i = 0;
    for (const key of memoryCache.keys()) {
      memoryCache.delete(key);
      if (++i >= excess) break;
    }
  }
}

export function warmMemoryPlaintexts(
  entries: Array<{ content?: string | null; plaintext?: string | null }>
): void {
  for (const e of entries) {
    if (e.content && isUsablePlaintext(e.plaintext)) {
      setMemoryPlaintext(e.content, e.plaintext as string);
    }
  }
}

/** Test helper */
export function clearMemoryPlaintextCache(): void {
  memoryCache.clear();
}
