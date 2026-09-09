import { getDexieDb, getDexieDatabaseName, deleteDexieDb, DEXIE_DB_VERSION } from './dexieDb.js';
import {
  KeyPairBytes,
  toHex,
  fromHex
} from './cryptoPrimitives.js';

/** @deprecated Use DEXIE_DB_VERSION — kept as alias so callers stay aligned with Dexie verno. */
export const DB_VERSION = DEXIE_DB_VERSION;
export { DEXIE_DB_VERSION };
export const STORE_IDENTITY = 'identity_keys';
export const STORE_SIGNED_PREKEY = 'signed_prekeys';
export const STORE_VAULT_METADATA = 'vault_metadata';
export const STORE_MESSAGES = 'messages';
export const STORE_MEDIA = 'media_blobs';
export const STORE_OUTBOX = 'outbox_messages';
export const STORE_USER_KV = 'user_kv';

export function getDatabaseName(userId: number): string {
  return getDexieDatabaseName(userId);
}

export async function openCryptoDatabase(userId: number = 0): Promise<any> {
  return getDexieDb(userId);
}

export async function closeCryptoDatabase(userId?: number | string): Promise<void> {
  if (userId !== undefined) {
    const uid =
      typeof userId === 'string'
        ? (() => {
            const parsed = parseInt(userId, 10);
            return Number.isFinite(parsed) ? parsed : 0;
          })()
        : userId;
    getDexieDb(uid).close();
  }
}

export async function purgeCryptoDatabase(userId?: number | string): Promise<void> {
  const uid =
    userId === undefined
      ? 0
      : typeof userId === 'string'
        ? (() => {
            const parsed = parseInt(userId, 10);
            return Number.isFinite(parsed) ? parsed : 0;
          })()
        : userId;
  await deleteDexieDb(uid);
}

// Identity Key Storage

export interface LocalIdentityKeys {
  signing: KeyPairBytes; // Ed25519
  dh: KeyPairBytes;      // X25519
}

const memoryIdentityCache = new Map<number, any>();

export async function saveLocalIdentityKeys(userId: number, keys: LocalIdentityKeys): Promise<void> {
  const payload = {
    id: 'local_identity',
    signingPrivateKeyHex: toHex(keys.signing.privateKey),
    signingPublicKeyHex: toHex(keys.signing.publicKey),
    dhPrivateKeyHex: toHex(keys.dh.privateKey),
    dhPublicKeyHex: toHex(keys.dh.publicKey),
    createdAt: Date.now()
  };

  memoryIdentityCache.set(userId, payload);

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`velum_identity_keys_${userId}`, JSON.stringify(payload));
    }
  } catch {}

  try {
    if (typeof window !== 'undefined' && window.indexedDB) {
      const db = getDexieDb(userId);
      await db.identity_keys.put(payload);
    }
  } catch (err) {
    console.warn('[CryptoDB] Failed saving identity keys to IndexedDB:', err);
  }
}

export async function loadLocalIdentityKeys(userId: number): Promise<LocalIdentityKeys | null> {
  const candidates: any[] = [];

  try {
    if (typeof window !== 'undefined' && window.indexedDB) {
      const db = getDexieDb(userId);
      const idbRecord = await db.identity_keys.get('local_identity');
      if (idbRecord?.signingPrivateKeyHex && idbRecord?.dhPrivateKeyHex) {
        candidates.push(idbRecord);
      }
    }
  } catch (err) {
    console.warn('[CryptoDB] Error loading identity keys from IndexedDB:', err);
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(`velum_identity_keys_${userId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.signingPrivateKeyHex && parsed?.dhPrivateKeyHex) {
          candidates.push(parsed);
        }
      }
    }
  } catch {}

  const mem = memoryIdentityCache.get(userId);
  if (mem?.signingPrivateKeyHex && mem?.dhPrivateKeyHex) {
    candidates.push(mem);
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
  const record = candidates[0];

  return {
    signing: {
      privateKey: fromHex(record.signingPrivateKeyHex),
      publicKey: fromHex(record.signingPublicKeyHex)
    },
    dh: {
      privateKey: fromHex(record.dhPrivateKeyHex),
      publicKey: fromHex(record.dhPublicKeyHex)
    }
  };
}

// Signed Prekey Storage

export async function saveSignedPrekey(
  userId: number,
  keyId: number,
  keyPair: KeyPairBytes,
  signature: Uint8Array
): Promise<void> {
  const db = getDexieDb(userId);
  await db.signed_prekeys.put({
    id: 'current_signed_prekey',
    keyId,
    privateKeyHex: toHex(keyPair.privateKey),
    publicKeyHex: toHex(keyPair.publicKey),
    signatureHex: toHex(signature),
    createdAt: Date.now()
  });
}

export async function loadSignedPrekey(userId: number): Promise<{
  keyId: number;
  keyPair: KeyPairBytes;
  signature: Uint8Array;
} | null> {
  const db = getDexieDb(userId);
  const record = await db.signed_prekeys.get('current_signed_prekey');
  if (!record || !record.privateKeyHex || !record.publicKeyHex || !record.signatureHex) return null;
  return {
    keyId: record.keyId,
    keyPair: {
      privateKey: fromHex(record.privateKeyHex),
      publicKey: fromHex(record.publicKeyHex)
    },
    signature: fromHex(record.signatureHex)
  };
}

// Local Vault Encryption Key Storage (for local message storage)

export async function saveLocalVaultKeyToDb(key: CryptoKey, saltHex: string, userId: number = 0): Promise<void> {
  const db = getDexieDb(userId);
  const exported = await window.crypto.subtle.exportKey('jwk', key);
  await db.vault_metadata.put({
    id: 'local_vault_aes_key',
    keyJwk: JSON.stringify(exported),
    saltHex,
    createdAt: Date.now()
  });
}

export async function loadLocalVaultKeyFromDb(userId: number = 0): Promise<{ key: CryptoKey; saltHex: string } | null> {
  const db = getDexieDb(userId);
  const record = await db.vault_metadata.get('local_vault_aes_key');
  if (!record || !record.keyJwk || !record.saltHex) return null;
  const jwk = JSON.parse(record.keyJwk);
  const key = await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  return { key, saltHex: record.saltHex };
}

export const purgeCryptoVault = purgeCryptoDatabase;
