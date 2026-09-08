import Dexie from 'dexie';
import { getDexieDb } from './dexieDb.js';
import {
  KeyPairBytes,
  toHex,
  fromHex
} from './cryptoPrimitives.js';

export const DB_VERSION = 4;
export const STORE_IDENTITY = 'identity_keys';
export const STORE_SIGNED_PREKEY = 'signed_prekeys';
export const STORE_VAULT_METADATA = 'vault_metadata';
export const STORE_MESSAGES = 'messages';
export const STORE_MEDIA = 'media_blobs';
export const STORE_OUTBOX = 'outbox_messages';
export const STORE_USER_KV = 'user_kv';

export function getDatabaseName(userId: number): string {
  const uid = (userId && !isNaN(userId)) ? userId : 0;
  return `v_${uid}`;
}

export async function openCryptoDatabase(userId: number = 0): Promise<any> {
  return getDexieDb(userId);
}

export async function closeCryptoDatabase(userId?: number | string): Promise<void> {
  if (userId !== undefined) {
    const uid = typeof userId === 'string' ? parseInt(userId, 10) || 0 : userId;
    getDexieDb(uid).close();
  }
}

export async function purgeCryptoDatabase(userId?: number | string): Promise<void> {
  if (userId !== undefined) {
    const uid = typeof userId === 'string' ? parseInt(userId, 10) || 0 : userId;
    const db = getDexieDb(uid);
    db.close();
    await Dexie.delete(`v_${uid}`);
  } else {
    const db = getDexieDb(0);
    db.close();
    await Dexie.delete('v_0');
  }
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
  let record: any = null;

  try {
    if (typeof window !== 'undefined' && window.indexedDB) {
      const db = getDexieDb(userId);
      record = await db.identity_keys.get('local_identity');
    }
  } catch (err) {
    console.warn('[CryptoDB] Error loading identity keys from IndexedDB:', err);
  }

  if (!record || !record.signingPrivateKeyHex || !record.dhPrivateKeyHex) {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(`velum_identity_keys_${userId}`);
        if (stored) {
          record = JSON.parse(stored);
        }
      }
    } catch {}
  }

  if (!record || !record.signingPrivateKeyHex || !record.dhPrivateKeyHex) {
    record = memoryIdentityCache.get(userId);
  }

  if (!record || !record.signingPrivateKeyHex || !record.dhPrivateKeyHex) return null;

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
