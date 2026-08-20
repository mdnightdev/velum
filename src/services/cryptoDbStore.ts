import { openDB, IDBPDatabase, deleteDB } from 'idb';
import {
  KeyPairBytes,
  toHex,
  fromHex
} from './cryptoPrimitives.js';

export const DB_VERSION = 3;
export const STORE_IDENTITY = 'identity_keys';
export const STORE_SIGNED_PREKEY = 'signed_prekeys';
export const STORE_ONE_TIME_PREKEYS = 'one_time_prekeys';
export const STORE_SESSIONS = 'sessions';
export const STORE_SKIPPED_KEYS = 'skipped_message_keys';
export const STORE_VAULT_METADATA = 'vault_metadata';
export const STORE_MESSAGES = 'messages';
export const STORE_MEDIA = 'media_blobs';
export const STORE_OUTBOX = 'outbox_messages';
export const STORE_USER_KV = 'user_kv';

const dbInstances = new Map<number, IDBPDatabase>();
const dbPromises = new Map<number, Promise<IDBPDatabase>>();

export function getDatabaseName(userId: number): string {
  return `velum_db_${userId}`;
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
      if (!db.objectStoreNames.contains(STORE_ONE_TIME_PREKEYS)) {
        db.createObjectStore(STORE_ONE_TIME_PREKEYS, { keyPath: 'keyId' });
      }
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'peerUserId' });
      }
      if (!db.objectStoreNames.contains(STORE_SKIPPED_KEYS)) {
        const skippedStore = db.createObjectStore(STORE_SKIPPED_KEYS, { keyPath: 'id' });
        skippedStore.createIndex('by_peer', 'peerUserId', { unique: false });
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
  }).then((db) => {
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

export async function saveLocalIdentityKeys(userId: number, keys: LocalIdentityKeys): Promise<void> {
  const db = await openCryptoDatabase(userId);
  await db.put(STORE_IDENTITY, {
    id: 'local_identity',
    signingPrivateKeyHex: toHex(keys.signing.privateKey),
    signingPublicKeyHex: toHex(keys.signing.publicKey),
    dhPrivateKeyHex: toHex(keys.dh.privateKey),
    dhPublicKeyHex: toHex(keys.dh.publicKey),
    createdAt: Date.now()
  });
}

export async function loadLocalIdentityKeys(userId: number): Promise<LocalIdentityKeys | null> {
  const db = await openCryptoDatabase(userId);
  const record = await db.get(STORE_IDENTITY, 'local_identity');
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
// One-Time Prekey Storage
// ---------------------------------------------------------------------------

export async function saveOneTimePrekeys(
  userId: number,
  prekeys: Array<{ keyId: number; keyPair: KeyPairBytes }>
): Promise<void> {
  const db = await openCryptoDatabase(userId);
  const tx = db.transaction(STORE_ONE_TIME_PREKEYS, 'readwrite');
  for (const item of prekeys) {
    await tx.store.put({
      keyId: item.keyId,
      privateKeyHex: toHex(item.keyPair.privateKey),
      publicKeyHex: toHex(item.keyPair.publicKey),
      used: false,
      createdAt: Date.now()
    });
  }
  await tx.done;
}

export async function loadOneTimePrekey(userId: number, keyId: number): Promise<KeyPairBytes | null> {
  const db = await openCryptoDatabase(userId);
  const record = await db.get(STORE_ONE_TIME_PREKEYS, keyId);
  if (!record || !record.privateKeyHex || !record.publicKeyHex) return null;
  return {
    privateKey: fromHex(record.privateKeyHex),
    publicKey: fromHex(record.publicKeyHex)
  };
}

export async function markOneTimePrekeyUsed(userId: number, keyId: number): Promise<void> {
  const db = await openCryptoDatabase(userId);
  const record = await db.get(STORE_ONE_TIME_PREKEYS, keyId);
  if (record) {
    record.used = true;
    record.usedAt = Date.now();
    await db.put(STORE_ONE_TIME_PREKEYS, record);
  }
}

export async function countUnusedOneTimePrekeys(userId: number): Promise<number> {
  const db = await openCryptoDatabase(userId);
  const records = await db.getAll(STORE_ONE_TIME_PREKEYS);
  return records.filter(r => !r.used).length;
}

// ---------------------------------------------------------------------------
// Peer Double Ratchet Session Storage
// ---------------------------------------------------------------------------

export async function saveSessionState(userId: number, peerUserId: number, state: any): Promise<void> {
  const db = await openCryptoDatabase(userId);
  await db.put(STORE_SESSIONS, {
    peerUserId,
    state,
    updatedAt: Date.now()
  });
}

export async function loadSessionState(userId: number, peerUserId: number): Promise<any | null> {
  const db = await openCryptoDatabase(userId);
  const record = await db.get(STORE_SESSIONS, peerUserId);
  return record ? record.state : null;
}

export async function deleteSessionState(userId: number, peerUserId: number): Promise<void> {
  const db = await openCryptoDatabase(userId);
  await db.delete(STORE_SESSIONS, peerUserId);
  await clearSkippedKeysForPeer(userId, peerUserId);
}

// ---------------------------------------------------------------------------
// Skipped Message Keys Storage
// ---------------------------------------------------------------------------

export function getSkippedKeyId(peerUserId: number, chainGen: number, messageIndex: number): string {
  return `${peerUserId}:${chainGen}:${messageIndex}`;
}

export async function saveSkippedKey(
  userId: number,
  peerUserId: number,
  chainGen: number,
  messageIndex: number,
  messageKey: Uint8Array
): Promise<void> {
  const db = await openCryptoDatabase(userId);
  const id = getSkippedKeyId(peerUserId, chainGen, messageIndex);
  await db.put(STORE_SKIPPED_KEYS, {
    id,
    peerUserId,
    chainGen,
    messageIndex,
    messageKeyHex: toHex(messageKey),
    createdAt: Date.now()
  });
}

export async function consumeSkippedKey(
  userId: number,
  peerUserId: number,
  chainGen: number,
  messageIndex: number
): Promise<Uint8Array | null> {
  const db = await openCryptoDatabase(userId);
  const id = getSkippedKeyId(peerUserId, chainGen, messageIndex);
  const record = await db.get(STORE_SKIPPED_KEYS, id);
  if (!record || !record.messageKeyHex) return null;

  // Single-use guarantee: purge immediately upon retrieval
  await db.delete(STORE_SKIPPED_KEYS, id);
  return fromHex(record.messageKeyHex);
}

export async function clearSkippedKeysForPeer(userId: number, peerUserId: number): Promise<void> {
  const db = await openCryptoDatabase(userId);
  const tx = db.transaction(STORE_SKIPPED_KEYS, 'readwrite');
  const index = tx.store.index('by_peer');
  let cursor = await index.openCursor(IDBKeyRange.only(peerUserId));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
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
