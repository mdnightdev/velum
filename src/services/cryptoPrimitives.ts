import { x25519, ed25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';

export interface KeyPairBytes {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

// ---------------------------------------------------------------------------
// Byte & Encoding Helpers
// ---------------------------------------------------------------------------

export function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function fromHex(hex: string): Uint8Array {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function utf8ToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

export function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

// ---------------------------------------------------------------------------
// Asymmetric Key Operations: X25519 (Diffie-Hellman) & Ed25519 (Signatures)
// ---------------------------------------------------------------------------

export function generateX25519KeyPair(): KeyPairBytes {
  const { secretKey, publicKey } = x25519.keygen();
  return { privateKey: secretKey, publicKey };
}

export function deriveX25519KeyPairFromSeed(seed32: Uint8Array): KeyPairBytes {
  const privateKey = new Uint8Array(seed32.slice(0, 32));
  const publicKey = x25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

export function calculateX25519SharedSecret(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  return x25519.getSharedSecret(privateKey, publicKey);
}

export function generateEd25519KeyPair(): KeyPairBytes {
  const { secretKey, publicKey } = ed25519.keygen();
  return { privateKey: secretKey, publicKey };
}

export function deriveEd25519KeyPairFromSeed(seed32: Uint8Array): KeyPairBytes {
  const privateKey = new Uint8Array(seed32.slice(0, 32));
  const publicKey = ed25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

export function signEd25519(message: Uint8Array, privateKey: Uint8Array): Uint8Array {
  return ed25519.sign(message, privateKey);
}

export function verifyEd25519(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): boolean {
  try {
    return ed25519.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Symmetric Key Derivation: HKDF-SHA256
// ---------------------------------------------------------------------------

const INFO_ROOT = utf8ToBytes('VelumDoubleRatchetRootKDF');
const INFO_CHAIN = utf8ToBytes('VelumDoubleRatchetChainKDF');
const INFO_MESSAGE = utf8ToBytes('VelumDoubleRatchetMessageKey');

export function kdfRoot(rootKey: Uint8Array, dhSharedSecret: Uint8Array): { nextRootKey: Uint8Array; chainKey: Uint8Array } {
  // 64-byte derivation: first 32 bytes = next rootKey, last 32 bytes = chainKey
  const derived = hkdf(sha256, dhSharedSecret, rootKey, INFO_ROOT, 64);
  return {
    nextRootKey: derived.slice(0, 32),
    chainKey: derived.slice(32, 64)
  };
}

export function kdfChain(chainKey: Uint8Array): { nextChainKey: Uint8Array; messageKey: Uint8Array } {
  const derived = hkdf(sha256, chainKey, undefined, INFO_CHAIN, 64);
  return {
    nextChainKey: derived.slice(0, 32),
    messageKey: derived.slice(32, 64)
  };
}

export function deriveX3DHRKey(dhOutputs: Uint8Array[]): Uint8Array {
  // Concatenate all DH outputs
  const totalLength = dhOutputs.reduce((acc, curr) => acc + curr.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const dh of dhOutputs) {
    combined.set(dh, offset);
    offset += dh.length;
  }
  const salt = new Uint8Array(32); // All-zero 32-byte salt as per Signal X3DH standard
  return hkdf(sha256, combined, salt, utf8ToBytes('VelumX3DHInitialRootKey'), 32);
}

// ---------------------------------------------------------------------------
// Symmetric Authenticated Encryption: AES-256-GCM (via WebCrypto)
// ---------------------------------------------------------------------------

export async function encryptAesGcm(
  keyBytes: Uint8Array,
  plaintextBytes: Uint8Array,
  ivBytes: Uint8Array,
  associatedData?: Uint8Array
): Promise<{ ciphertext: Uint8Array; tag: Uint8Array }> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as any,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes as any,
      ...(associatedData ? { additionalData: associatedData as any } : {}),
      tagLength: 128
    },
    cryptoKey,
    plaintextBytes as any
  );

  const encryptedArray = new Uint8Array(encryptedBuffer);
  // WebCrypto appends the 16-byte authentication tag to the end of the ciphertext
  const tagStart = encryptedArray.length - 16;
  const ciphertext = encryptedArray.slice(0, tagStart);
  const tag = encryptedArray.slice(tagStart);

  return { ciphertext, tag };
}

export async function decryptAesGcm(
  keyBytes: Uint8Array,
  ciphertextBytes: Uint8Array,
  tagBytes: Uint8Array,
  ivBytes: Uint8Array,
  associatedData?: Uint8Array
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as any,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // Recombine ciphertext and 16-byte tag for WebCrypto
  const combined = new Uint8Array(ciphertextBytes.length + tagBytes.length);
  combined.set(ciphertextBytes, 0);
  combined.set(tagBytes, ciphertextBytes.length);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes as any,
      ...(associatedData ? { additionalData: associatedData as any } : {}),
      tagLength: 128
    },
    cryptoKey,
    combined as any
  );

  return new Uint8Array(decryptedBuffer);
}
