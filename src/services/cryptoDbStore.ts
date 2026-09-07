import { openDB, IDBPDatabase, deleteDB } from 'idb';
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

const dbInstances = new Map<number, IDBPDatabase>();
const dbPromises = new Map<number, Promise<IDBPDatabase>>();

export function getDatabaseName(userId: number): string {
  const uid = (userId && !isNaN(userId)) ? userId : 0;
  return `v_${uid}`;
}


export async function openCryptoDatabase(userId: number = 0): Promise<IDBPDatabase> {
  const targetUserId = (userId && !isNaN(userId)) ? userId : 0;

  const existingInstance = dbInstances.get(targetUserId);
  if (existingInstance) {
    return existingInstance;
  }

  const existingPromise = dbPromises.get(targetUserId);
  if (existingPromise) {
    return existingPromise;
  }

  const dbName = getDatabaseName(targetUserId);
  const promise = openDB(dbName, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_IDENTITY)) {
        db.createObjectStore(STORE_IDENTITY, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SIGNED_PREKEY)) {
        db.createObjectStore(STORE_SIGNED_PREKEY, { keyPath: 'id' });
      }
	  if (!db.objectStoreNames.contains(STORE_VAULT_METADATA)) {
        db.createObjectStore(STORE_VAULT_METADATA, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const msgStore = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
        msgStore.createIndex('loungeId', 'loungeId', { unique: false });
        msgStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        db.createObjectStore(STORE_MEDIA);
      }
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        db.createObjectStore(STORE_OUTBOX, { keyPath: 'client_msg_id' });
      }
      if (!db.objectStoreNames.contains(STORE_USER_KV)) {
        db.createObjectStore(STORE_USER_KV, { keyPath: 'key' });
      }
    },
    blocking() {
      const db = dbInstances.get(targetUserId);
      if (db) {
        db.close();
        dbInstances.delete(targetUserId);
        dbPromises.delete(targetUserId);
      }
    },
    terminated() {
      dbInstances.delete(targetUserId);
      dbPromises.delete(targetUserId);
    }
  }).then(async (db) => {
    dbInstances.set(targetUserId, db);
    dbPromises.delete(targetUserId);
    return db;
  }).catch((err) => {
    dbPromises.delete(targetUserId);
    throw err;
  });

  dbPromises.set(targetUserId, promise);
  return promise;
}

export async function closeCryptoDatabase(userId?: number): Promise<void> {
  if (userId !== undefined) {
    const targetUserId = (userId && !isNaN(userId)) ? userId : 0;
    const db = dbInstances.get(targetUserId);
    if (db) {
      db.close();
      dbInstances.delete(targetUserId);
      dbPromises.delete(targetUserId);
    }
  } else {
    for (const [, db] of dbInstances.entries()) {
      db.close();
    }
    dbInstances.clear();
    dbPromises.clear();
  }
}

export async function purgeCryptoDatabase(userId?: number | string): Promise<void> {
  if (userId !== undefined) {
    const uid = typeof userId === 'string' ? parseInt(userId, 10) || 0 : userId;
    await closeCryptoDatabase(uid);
    const dbName = getDatabaseName(uid);
    await deleteDB(dbName);
  } else {
    for (const uid of Array.from(dbInstances.keys())) {
      await closeCryptoDatabase(uid);
      await deleteDB(getDatabaseName(uid));
    }
  }
}

// ---------------------------------------------------------------------------
// Identity Key Storage
// ---------------------------------------------------------------------------

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
      const db = await openCryptoDatabase(userId);
      await db.put(STORE_IDENTITY, payload);
    }
  } catch (err) {
    console.warn('[CryptoDB] Failed saving identity keys to IndexedDB:', err);
  }
}

export async function loadLocalIdentityKeys(userId: number): Promise<LocalIdentityKeys | null> {
  let record: any = null;

  try {
    if (typeof window !== 'undefined' && window.indexedDB) {
      const db = await openCryptoDatabase(userId);
      record = await db.get(STORE_IDENTITY, 'local_identity');
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

// ---------------------------------------------------------------------------
// Signed Prekey Storage
// ---------------------------------------------------------------------------

export async function saveSignedPrekey(
  userId: number,
  keyId: number,
  keyPair: KeyPairBytes,
  signature: Uint8Array
): Promise<void> {
  const db = await openCryptoDatabase(userId);
  await db.put(STORE_SIGNED_PREKEY, {
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
  const db = await openCryptoDatabase(userId);
  const record = await db.get(STORE_SIGNED_PREKEY, 'current_signed_prekey');
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


// ---------------------------------------------------------------------------
// Local Vault Encryption Key Storage (for local message storage)
// ---------------------------------------------------------------------------

export async function saveLocalVaultKeyToDb(key: CryptoKey, saltHex: string, userId: number = 0): Promise<void> {
  const db = await openCryptoDatabase(userId);
  const exported = await window.crypto.subtle.exportKey('jwk', key);
  await db.put(STORE_VAULT_METADATA, {
    id: 'local_vault_aes_key',
    keyJwk: JSON.stringify(exported),
    saltHex,
    createdAt: Date.now()
  });
}

export async function loadLocalVaultKeyFromDb(userId: number = 0): Promise<{ key: CryptoKey; saltHex: string } | null> {
  const db = await openCryptoDatabase(userId);
  const record = await db.get(STORE_VAULT_METADATA, 'local_vault_aes_key');
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
