/**
 * Signal Protocol Storage Adapter for IndexedDB
 * Backed by @signalapp/libsignal-client and idb
 */

import {
  IdentityKeyStore,
  PreKeyStore,
  SignedPreKeyStore,
  KyberPreKeyStore,
  SessionStore,
  SenderKeyStore,
  PrivateKey,
  PublicKey,
  IdentityKeyPair,
  PreKeyRecord,
  SignedPreKeyRecord,
  KyberPreKeyRecord,
  SessionRecord,
  SenderKeyRecord,
  ProtocolAddress,
  Direction,
  Uuid
} from '@signalapp/libsignal-client';
import { openDB, IDBPDatabase, deleteDB } from 'idb';

export const DB_NAME = 'velum_crypto_vault';
export const DB_VERSION = 30;

export const STORE_IDENTITY_KEYS = 'identity_keys';
export const STORE_PRE_KEYS = 'pre_keys';
export const STORE_SIGNED_PRE_KEYS = 'signed_pre_keys';
export const STORE_KYBER_PRE_KEYS = 'kyber_pre_keys';
export const STORE_SESSIONS = 'sessions';
export const STORE_SENDER_KEYS = 'sender_keys';
export const STORE_VAULT_METADATA = 'vault_metadata';

let dbInstance: IDBPDatabase | null = null;
let dbPromise: Promise<IDBPDatabase> | null = null;

function toBuffer(data: Uint8Array | ArrayBuffer | Buffer): Buffer {
  if (typeof Buffer !== 'undefined') {
    if (Buffer.isBuffer(data)) {
      return data;
    }
    if (data instanceof Uint8Array) {
      return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    }
    if (data instanceof ArrayBuffer) {
      return Buffer.from(data);
    }
  }
  return data as unknown as Buffer;
}

export async function openCryptoDatabase(): Promise<IDBPDatabase> {
  if (dbInstance) {
    return dbInstance;
  }
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Clean up legacy P-256 stores if upgrading from older schema
      const legacyStores = ['local_keys', 'conversation_states', 'skipped_message_keys'];
      for (const legacy of legacyStores) {
        if (db.objectStoreNames.contains(legacy)) {
          db.deleteObjectStore(legacy);
        }
      }

      if (!db.objectStoreNames.contains(STORE_IDENTITY_KEYS)) {
        db.createObjectStore(STORE_IDENTITY_KEYS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PRE_KEYS)) {
        db.createObjectStore(STORE_PRE_KEYS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SIGNED_PRE_KEYS)) {
        db.createObjectStore(STORE_SIGNED_PRE_KEYS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_KYBER_PRE_KEYS)) {
        db.createObjectStore(STORE_KYBER_PRE_KEYS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SENDER_KEYS)) {
        db.createObjectStore(STORE_SENDER_KEYS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_VAULT_METADATA)) {
        db.createObjectStore(STORE_VAULT_METADATA, { keyPath: 'id' });
      }
    },
    blocked() {
      console.warn('[CryptoDbStore] IndexedDB upgrade blocked by active connection.');
    },
    blocking() {
      if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
        dbPromise = null;
      }
    },
    terminated() {
      dbInstance = null;
      dbPromise = null;
    }
  }).then((db) => {
    dbInstance = db;
    dbPromise = null;
    return db;
  }).catch((err) => {
    dbPromise = null;
    throw err;
  });

  return dbPromise;
}

export async function closeCryptoDatabase(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbPromise = null;
  }
}

export class IndexedDbIdentityKeyStore extends IdentityKeyStore {
  constructor(private localUserId: string) {
    super();
  }

  public async saveLocalIdentity(registrationId: number, identityKeyPair: IdentityKeyPair): Promise<void> {
    const db = await openCryptoDatabase();
    const serialized = identityKeyPair.serialize();
    await db.put(STORE_IDENTITY_KEYS, {
      id: `${this.localUserId}:local`,
      localUserId: this.localUserId,
      registrationId,
      serializedKeyPair: new Uint8Array(serialized)
    });
  }

  public async getLocalIdentityKeyPair(): Promise<IdentityKeyPair | null> {
    const db = await openCryptoDatabase();
    const record = await db.get(STORE_IDENTITY_KEYS, `${this.localUserId}:local`);
    if (!record || !record.serializedKeyPair) {
      return null;
    }
    return IdentityKeyPair.deserialize(toBuffer(record.serializedKeyPair));
  }

  public async getIdentityKey(): Promise<PrivateKey> {
    const keyPair = await this.getLocalIdentityKeyPair();
    if (!keyPair) {
      throw new Error(`Identity key pair not found for user ${this.localUserId}`);
    }
    return keyPair.privateKey;
  }

  public async getLocalRegistrationId(): Promise<number> {
    const db = await openCryptoDatabase();
    const record = await db.get(STORE_IDENTITY_KEYS, `${this.localUserId}:local`);
    if (!record || typeof record.registrationId !== 'number') {
      throw new Error(`Registration ID not found for user ${this.localUserId}`);
    }
    return record.registrationId;
  }

  public async saveIdentity(name: ProtocolAddress, key: PublicKey): Promise<boolean> {
    const db = await openCryptoDatabase();
    const addressStr = `${name.name()}.${name.deviceId()}`;
    const id = `${this.localUserId}:remote:${addressStr}`;
    const existing = await db.get(STORE_IDENTITY_KEYS, id);

    if (existing && existing.serializedPublicKey) {
      const existingKey = PublicKey.deserialize(toBuffer(existing.serializedPublicKey));
      if (existingKey.compare(key) === 0) {
        return false;
      }
    }

    await db.put(STORE_IDENTITY_KEYS, {
      id,
      localUserId: this.localUserId,
      address: addressStr,
      serializedPublicKey: new Uint8Array(key.serialize())
    });
    return true;
  }

  public async isTrustedIdentity(name: ProtocolAddress, key: PublicKey, _direction: Direction): Promise<boolean> {
    const db = await openCryptoDatabase();
    const addressStr = `${name.name()}.${name.deviceId()}`;
    const id = `${this.localUserId}:remote:${addressStr}`;
    const existing = await db.get(STORE_IDENTITY_KEYS, id);

    if (!existing || !existing.serializedPublicKey) {
      // Trust on first use
      return true;
    }

    const existingKey = PublicKey.deserialize(toBuffer(existing.serializedPublicKey));
    return existingKey.compare(key) === 0;
  }

  public async getIdentity(name: ProtocolAddress): Promise<PublicKey | null> {
    const db = await openCryptoDatabase();
    const addressStr = `${name.name()}.${name.deviceId()}`;
    const id = `${this.localUserId}:remote:${addressStr}`;
    const record = await db.get(STORE_IDENTITY_KEYS, id);
    if (!record || !record.serializedPublicKey) {
      return null;
    }
    return PublicKey.deserialize(toBuffer(record.serializedPublicKey));
  }
}

export class IndexedDbPreKeyStore extends PreKeyStore {
  constructor(private localUserId: string) {
    super();
  }

  public async savePreKey(id: number, record: PreKeyRecord): Promise<void> {
    const db = await openCryptoDatabase();
    await db.put(STORE_PRE_KEYS, {
      id: `${this.localUserId}:${id}`,
      localUserId: this.localUserId,
      keyId: id,
      serializedRecord: new Uint8Array(record.serialize())
    });
  }

  public async getPreKey(id: number): Promise<PreKeyRecord> {
    const db = await openCryptoDatabase();
    const record = await db.get(STORE_PRE_KEYS, `${this.localUserId}:${id}`);
    if (!record || !record.serializedRecord) {
      throw new Error(`PreKey with id ${id} not found for user ${this.localUserId}`);
    }
    return PreKeyRecord.deserialize(toBuffer(record.serializedRecord));
  }

  public async removePreKey(id: number): Promise<void> {
    const db = await openCryptoDatabase();
    await db.delete(STORE_PRE_KEYS, `${this.localUserId}:${id}`);
  }
}

export class IndexedDbSignedPreKeyStore extends SignedPreKeyStore {
  constructor(private localUserId: string) {
    super();
  }

  public async saveSignedPreKey(id: number, record: SignedPreKeyRecord): Promise<void> {
    const db = await openCryptoDatabase();
    await db.put(STORE_SIGNED_PRE_KEYS, {
      id: `${this.localUserId}:${id}`,
      localUserId: this.localUserId,
      keyId: id,
      serializedRecord: new Uint8Array(record.serialize())
    });
  }

  public async getSignedPreKey(id: number): Promise<SignedPreKeyRecord> {
    const db = await openCryptoDatabase();
    const record = await db.get(STORE_SIGNED_PRE_KEYS, `${this.localUserId}:${id}`);
    if (!record || !record.serializedRecord) {
      throw new Error(`SignedPreKey with id ${id} not found for user ${this.localUserId}`);
    }
    return SignedPreKeyRecord.deserialize(toBuffer(record.serializedRecord));
  }
}

export class IndexedDbKyberPreKeyStore extends KyberPreKeyStore {
  constructor(private localUserId: string) {
    super();
  }

  public async saveKyberPreKey(kyberPreKeyId: number, record: KyberPreKeyRecord): Promise<void> {
    const db = await openCryptoDatabase();
    await db.put(STORE_KYBER_PRE_KEYS, {
      id: `${this.localUserId}:${kyberPreKeyId}`,
      localUserId: this.localUserId,
      keyId: kyberPreKeyId,
      serializedRecord: new Uint8Array(record.serialize()),
      used: false
    });
  }

  public async getKyberPreKey(kyberPreKeyId: number): Promise<KyberPreKeyRecord> {
    const db = await openCryptoDatabase();
    const record = await db.get(STORE_KYBER_PRE_KEYS, `${this.localUserId}:${kyberPreKeyId}`);
    if (!record || !record.serializedRecord) {
      throw new Error(`KyberPreKey with id ${kyberPreKeyId} not found for user ${this.localUserId}`);
    }
    return KyberPreKeyRecord.deserialize(toBuffer(record.serializedRecord));
  }

  public async markKyberPreKeyUsed(kyberPreKeyId: number): Promise<void> {
    const db = await openCryptoDatabase();
    const record = await db.get(STORE_KYBER_PRE_KEYS, `${this.localUserId}:${kyberPreKeyId}`);
    if (record) {
      record.used = true;
      await db.put(STORE_KYBER_PRE_KEYS, record);
    }
  }
}

export class IndexedDbSessionStore extends SessionStore {
  constructor(private localUserId: string) {
    super();
  }

  public async saveSession(name: ProtocolAddress, record: SessionRecord): Promise<void> {
    const db = await openCryptoDatabase();
    const addressStr = `${name.name()}.${name.deviceId()}`;
    await db.put(STORE_SESSIONS, {
      id: `${this.localUserId}:${addressStr}`,
      localUserId: this.localUserId,
      address: addressStr,
      serializedRecord: new Uint8Array(record.serialize()),
      updatedAt: Date.now()
    });
  }

  public async getSession(name: ProtocolAddress): Promise<SessionRecord | null> {
    const db = await openCryptoDatabase();
    const addressStr = `${name.name()}.${name.deviceId()}`;
    const record = await db.get(STORE_SESSIONS, `${this.localUserId}:${addressStr}`);
    if (!record || !record.serializedRecord) {
      return null;
    }
    return SessionRecord.deserialize(toBuffer(record.serializedRecord));
  }

  public async getExistingSessions(addresses: ProtocolAddress[]): Promise<SessionRecord[]> {
    const results: SessionRecord[] = [];
    for (const address of addresses) {
      const session = await this.getSession(address);
      if (session) {
        results.push(session);
      }
    }
    return results;
  }
}

export class IndexedDbSenderKeyStore extends SenderKeyStore {
  constructor(private localUserId: string) {
    super();
  }

  public async saveSenderKey(sender: ProtocolAddress, distributionId: Uuid, record: SenderKeyRecord): Promise<void> {
    const db = await openCryptoDatabase();
    const addressStr = `${sender.name()}.${sender.deviceId()}`;
    await db.put(STORE_SENDER_KEYS, {
      id: `${this.localUserId}:${addressStr}:${distributionId}`,
      localUserId: this.localUserId,
      address: addressStr,
      distributionId: String(distributionId),
      serializedRecord: new Uint8Array(record.serialize()),
      updatedAt: Date.now()
    });
  }

  public async getSenderKey(sender: ProtocolAddress, distributionId: Uuid): Promise<SenderKeyRecord | null> {
    const db = await openCryptoDatabase();
    const addressStr = `${sender.name()}.${sender.deviceId()}`;
    const record = await db.get(STORE_SENDER_KEYS, `${this.localUserId}:${addressStr}:${distributionId}`);
    if (!record || !record.serializedRecord) {
      return null;
    }
    return SenderKeyRecord.deserialize(toBuffer(record.serializedRecord));
  }
}

export class SignalProtocolStore {
  public readonly localUserId: string;
  public readonly identityStore: IndexedDbIdentityKeyStore;
  public readonly preKeyStore: IndexedDbPreKeyStore;
  public readonly signedPreKeyStore: IndexedDbSignedPreKeyStore;
  public readonly kyberPreKeyStore: IndexedDbKyberPreKeyStore;
  public readonly sessionStore: IndexedDbSessionStore;
  public readonly senderKeyStore: IndexedDbSenderKeyStore;

  constructor(localUserId: string | number) {
    this.localUserId = String(localUserId);
    this.identityStore = new IndexedDbIdentityKeyStore(this.localUserId);
    this.preKeyStore = new IndexedDbPreKeyStore(this.localUserId);
    this.signedPreKeyStore = new IndexedDbSignedPreKeyStore(this.localUserId);
    this.kyberPreKeyStore = new IndexedDbKyberPreKeyStore(this.localUserId);
    this.sessionStore = new IndexedDbSessionStore(this.localUserId);
    this.senderKeyStore = new IndexedDbSenderKeyStore(this.localUserId);
  }
}

const storeInstances = new Map<string, SignalProtocolStore>();

export function getSignalProtocolStore(localUserId: string | number): SignalProtocolStore {
  const uid = String(localUserId);
  let store = storeInstances.get(uid);
  if (!store) {
    store = new SignalProtocolStore(uid);
    storeInstances.set(uid, store);
  }
  return store;
}

export async function purgeCryptoVault(userId?: string | number): Promise<void> {
  if (userId !== undefined && userId !== null) {
    const uid = String(userId);
    storeInstances.delete(uid);
    const db = await openCryptoDatabase();
    const stores = [
      STORE_IDENTITY_KEYS,
      STORE_PRE_KEYS,
      STORE_SIGNED_PRE_KEYS,
      STORE_KYBER_PRE_KEYS,
      STORE_SESSIONS,
      STORE_SENDER_KEYS,
      STORE_VAULT_METADATA
    ];
    const prefix = `${uid}:`;
    const tx = db.transaction(stores, 'readwrite');
    await Promise.all(
      stores.map(async (storeName) => {
        const store = tx.objectStore(storeName);
        let cursor = await store.openCursor();
        while (cursor) {
          if (typeof cursor.key === 'string' && cursor.key.startsWith(prefix)) {
            await cursor.delete();
          }
          cursor = await cursor.continue();
        }
      })
    );
    await tx.done;
    return;
  }

  // Purge entire database
  storeInstances.clear();
  await closeCryptoDatabase();
  try {
    await deleteDB(DB_NAME);
  } catch (err) {
    try {
      const db = await openCryptoDatabase();
      const tx = db.transaction(db.objectStoreNames, 'readwrite');
      for (const storeName of db.objectStoreNames) {
        await tx.objectStore(storeName).clear();
      }
      await tx.done;
    } catch (_) {}
  }
}

export async function saveLocalVaultKeyToDb(key: CryptoKey, saltHex: string): Promise<void> {
  const subtle = (typeof window !== 'undefined' ? window.crypto : globalThis.crypto).subtle;
  const jwk = await subtle.exportKey('jwk', key);
  const db = await openCryptoDatabase();
  await db.put(STORE_VAULT_METADATA, { id: 'local_vault_key', jwk, saltHex });
}

export async function loadLocalVaultKeyFromDb(): Promise<{ key: CryptoKey; saltHex: string } | null> {
  try {
    const db = await openCryptoDatabase();
    const record = await db.get(STORE_VAULT_METADATA, 'local_vault_key');
    if (!record || !record.jwk) return null;
    const subtle = (typeof window !== 'undefined' ? window.crypto : globalThis.crypto).subtle;
    const key = await subtle.importKey('jwk', record.jwk, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    return { key, saltHex: record.saltHex };
  } catch {
    return null;
  }
}
