# Technical Analysis: Signal Protocol IndexedDB Storage Architecture

**Explorer**: Explorer 2 (Milestone 2 - Signal Protocol Store Adapter)  
**Date**: 2026-08-15  
**Target File**: `src/services/cryptoDbStore.ts`  
**Dependencies**: `@signalapp/libsignal-client` (^0.62.0), `idb` (^8.0.3)

---

## 1. Executive Summary

This document presents the detailed technical design for migrating Velum's client cryptographic storage in `src/services/cryptoDbStore.ts` to the official `@signalapp/libsignal-client` storage specifications using the `idb` library.

The legacy architecture used custom WebCrypto NIST P-256 keys, JSON Web Key (JWK) representations, and raw DOM `window.indexedDB` callbacks. The new architecture transitions to Curve25519 (X25519 / Ed25519) binary records, structured `idb` TypeScript schema typing, strict multi-account isolation namespaced by `${localUserId}`, and robust version upgrade/reset handling that cleanly eliminates legacy P-256 artifacts without crashing or leaving orphaned state.

---

## 2. Examination of Current IndexedDB Architecture

### 2.1 Current Database Map

Currently, Velum interacts with two IndexedDB databases across the frontend:

| Database Name | Current Version | Primary Stores | Callers / Touchpoints | Purpose & Format |
|---|---|---|---|---|
| `velum_crypto_vault` | 26 | `local_keys`, `conversation_states`, `skipped_message_keys` | `cryptoDbStore.ts`, `skippedKeysStore.ts`, `doubleRatchetService.ts`, `localVaultEncryption.ts`, `AuthContext.tsx`, `main.tsx` | Stores P-256 JWKs, Double Ratchet state records, skipped AES keys, and local vault master key. |
| `velum_local_storage` | 25 | `messages`, `media_blobs`, `outbox_messages` | `indexedDb.ts`, `outboxEngine.ts`, `useWebSocket.ts`, `AdminProfile.tsx`, `SettingsDrawer.tsx`, `main.tsx` | Stores cached UI messages, media blobs, and offline outbox messages. |

### 2.2 Existing `velum_crypto_vault` Schema & Weaknesses

1. **`local_keys` Store**:
   - Primary Key: `id` (e.g. `'local_keys_1'` or `'local_vault_key'`).
   - Format: Stores WebCrypto P-256 keypairs exported as JWK objects (`identityKeyPair`, `signedPrekeyPair`, `oneTimePrekeys`).
   - Incompatibility: `@signalapp/libsignal-client` operates on opaque binary protobuf representations (`PrivateKey`, `PublicKey`, `IdentityKeyPair`, `PreKeyRecord`, `SignedPreKeyRecord`). WebCrypto P-256 JWKs cannot be converted or used.
2. **`conversation_states` Store**:
   - Primary Key: `id` (`${localUserId}_${peerUserId}`).
   - Format: Custom JSON/ArrayBuffer object with DH ratchet keys, root key, chain keys, and skipped key maps.
   - Incompatibility: In `@signalapp/libsignal-client`, session state is encapsulated in `SessionRecord` (native C++/Rust/WASM structure serialized to binary `Buffer`). Custom chain derivation state is obsolete.
3. **`skipped_message_keys` Store**:
   - Primary Key: `id` (`${roomId}:${senderUserId}:${chainLength}:${messageIndex}`).
   - Incompatibility: Signal Double Ratchet internally manages skipped message keys inside `SessionRecord`. A separate userland store is unnecessary for Signal Protocol 1-on-1 sessions.
4. **`local_vault_key` Record (Inside `local_keys`)**:
   - Used by `src/services/localVaultEncryption.ts` to encrypt cached chat history in `velum_local_storage`.
   - Critical Requirement: Must be preserved or cleanly migrated to ensure message history caching remains functional.
5. **Connection & Promise Management**:
   - Current implementation relies on manual `window.indexedDB.open` event listeners, raw `IDBTransaction` objects, and manual promise callbacks.
   - Error handling is fragile during schema version transitions or blocked database connections.

---

## 3. Signal Protocol Store Adapter Architecture (`idb`)

### 3.1 Prototype Inheritance in `@signalapp/libsignal-client`

`@signalapp/libsignal-client` defines abstract base classes for storage:
- `IdentityKeyStore`
- `PreKeyStore`
- `SignedPreKeyStore`
- `KyberPreKeyStore` (required by libsignal v0.62 `signalDecryptPreKey`)
- `SessionStore`
- `SenderKeyStore`

Each abstract base class in `@signalapp/libsignal-client` provides private native trampoline methods (e.g., `_getIdentityKey`, `_saveSession`, `_getPreKey`) that invoke the public abstract methods (`getIdentityKey`, `saveSession`, `getPreKey`). 

Because JavaScript only supports single prototype inheritance (`extends`), attempting to create a single class that extends multiple abstract classes is impossible. Therefore, the optimal architecture consists of:
1. Dedicated store classes extending their respective libsignal base class:
   - `SignalIdentityKeyStore extends IdentityKeyStore`
   - `SignalPreKeyStore extends PreKeyStore`
   - `SignalSignedPreKeyStore extends SignedPreKeyStore`
   - `SignalKyberPreKeyStore extends KyberPreKeyStore`
   - `SignalSessionStore extends SessionStore`
   - `SignalSenderKeyStore extends SenderKeyStore`
2. A unified factory / container context:
   - `SignalProtocolStoreContext` (or `SignalProtocolStore`) that holds configured instances of each store for a given `localUserId` and provides convenience APIs (`clear()`, `purge()`, `getIdentityKeyPair()`).

### 3.2 Database Schema Design (`velum_crypto_vault` v30)

We bump the database version of `velum_crypto_vault` from `26` to `30` (or `DB_VERSION = 30`).

```typescript
import { DBSchema } from 'idb';

export interface IdentityKeyEntity {
  id: string;                  // Primary Key: `${localUserId}`
  localUserId: string;
  identityKeyPair: Uint8Array; // Serialized IdentityKeyPair
  registrationId: number;      // 32-bit integer
  createdAt: number;
}

export interface TrustedIdentityEntity {
  id: string;                  // Primary Key: `${localUserId}:${addressName}`
  localUserId: string;
  addressName: string;
  identityKey: Uint8Array;     // Serialized PublicKey (33 bytes)
  savedAt: number;
}

export interface PreKeyEntity {
  id: string;                  // Primary Key: `${localUserId}:${keyId}`
  localUserId: string;
  keyId: number;               // Numerical PreKey ID (e.g. 1..100)
  record: Uint8Array;          // Serialized PreKeyRecord
}

export interface SignedPreKeyEntity {
  id: string;                  // Primary Key: `${localUserId}:${keyId}`
  localUserId: string;
  keyId: number;               // Numerical SignedPreKey ID (e.g. 1)
  record: Uint8Array;          // Serialized SignedPreKeyRecord
}

export interface KyberPreKeyEntity {
  id: string;                  // Primary Key: `${localUserId}:${keyId}`
  localUserId: string;
  keyId: number;               // Numerical Kyber PreKey ID
  record: Uint8Array;          // Serialized KyberPreKeyRecord
  isUsed?: boolean;
}

export interface SessionEntity {
  id: string;                  // Primary Key: `${localUserId}:${addressName}:${deviceId}`
  localUserId: string;
  addressName: string;         // Remote user ID (e.g. '2')
  deviceId: number;            // Remote device ID (e.g. 1)
  record: Uint8Array;          // Serialized SessionRecord
  updatedAt: number;
}

export interface SenderKeyEntity {
  id: string;                  // Primary Key: `${localUserId}:${senderAddress}:${distributionId}`
  localUserId: string;
  senderAddress: string;       // Sender ProtocolAddress string
  distributionId: string;      // Group distribution UUID
  record: Uint8Array;          // Serialized SenderKeyRecord
  updatedAt: number;
}

export interface LocalVaultKeyEntity {
  id: string;                  // Primary Key: 'local_vault_key' or `vault_key_${localUserId}`
  localUserId?: string;
  jwk: JsonWebKey;
  saltHex: string;
}

export interface VelumCryptoVaultDB extends DBSchema {
  identity_keys: {
    key: string;
    value: IdentityKeyEntity;
    indexes: { by_user: string };
  };
  trusted_identities: {
    key: string;
    value: TrustedIdentityEntity;
    indexes: { by_user: string };
  };
  pre_keys: {
    key: string;
    value: PreKeyEntity;
    indexes: { by_user: string };
  };
  signed_pre_keys: {
    key: string;
    value: SignedPreKeyEntity;
    indexes: { by_user: string };
  };
  kyber_pre_keys: {
    key: string;
    value: KyberPreKeyEntity;
    indexes: { by_user: string };
  };
  sessions: {
    key: string;
    value: SessionEntity;
    indexes: { by_user: string };
  };
  sender_keys: {
    key: string;
    value: SenderKeyEntity;
    indexes: { by_user: string };
  };
  vault_keys: {
    key: string;
    value: LocalVaultKeyEntity;
    indexes: { by_user: string };
  };
}
```

---

## 4. Multi-Account Namespacing Strategy

### 4.1 Requirement & Threat Model

On a shared workstation or browser origin, multiple users (e.g., Alice with `userId = "1"` and Bob with `userId = "2"`) may log into Velum sequentially or switch accounts.
- If storage keys were solely `keyId` or `address`, User B would overwrite or read User A's identity keys, prekeys, and sessions.
- In `@signalapp/libsignal-client`, methods like `signalEncrypt` only receive the remote `ProtocolAddress` and the store instance; libsignal does not know the local user's ID.

### 4.2 Namespacing Architecture

1. **Store Construction with Context**:
   Every store instance (`SignalIdentityKeyStore`, `SignalSessionStore`, etc.) receives `localUserId: string` during initialization.
2. **Compound Primary Keys**:
   - `identity_keys`: `${localUserId}`
   - `trusted_identities`: `${localUserId}:${address.name()}`
   - `pre_keys`: `${localUserId}:${keyId}`
   - `signed_pre_keys`: `${localUserId}:${keyId}`
   - `kyber_pre_keys`: `${localUserId}:${keyId}`
   - `sessions`: `${localUserId}:${address.name()}:${address.deviceId()}`
   - `sender_keys`: `${localUserId}:${sender.name()}:${sender.deviceId()}:${distributionId}`
   - `vault_keys`: `vault_key_${localUserId}` (or default `'local_vault_key'`)
3. **`by_user` Secondary Indexes**:
   Every object store defines a secondary index on `localUserId` (`by_user`). This allows:
   - Quick querying of all records belonging to a user.
   - Atomic and efficient per-user account purges during logout or user switching (`purgeCryptoVault(localUserId)`).

---

## 5. Store Methods & Contract Implementation

### 5.1 `SignalIdentityKeyStore`
Extends `IdentityKeyStore`:
- `getIdentityKey(): Promise<PrivateKey>`:
  Loads `identity_keys.get(this.localUserId)`. If present, deserializes `IdentityKeyPair.deserialize(Buffer.from(record.identityKeyPair))` and returns `keyPair.privateKey`. If not found, throws an error.
- `getLocalRegistrationId(): Promise<number>`:
  Loads `identity_keys.get(this.localUserId)`. Returns `record.registrationId`. If not found, throws an error.
- `saveIdentity(name: ProtocolAddress, key: PublicKey): Promise<boolean>`:
  Loads `trusted_identities.get(`${this.localUserId}:${name.name()}`)`.
  - If no record exists: saves new `TrustedIdentityEntity` with `key.serialize()` and returns `false`.
  - If existing record exists and bytes equal `key.serialize()`: returns `false`.
  - If existing record exists and bytes differ: updates record with new public key and returns `true` (identity replaced).
- `isTrustedIdentity(name: ProtocolAddress, key: PublicKey, direction: Direction): Promise<boolean>`:
  Loads `trusted_identities.get(`${this.localUserId}:${name.name()}`)`.
  - If no record: returns `true` (Trust On First Use / TOFU).
  - If record exists: compares bytes. Returns `true` if identical, `false` if mismatch.
- `getIdentity(name: ProtocolAddress): Promise<PublicKey | null>`:
  Loads `trusted_identities.get(`${this.localUserId}:${name.name()}`)`. Returns `PublicKey.deserialize(Buffer.from(record.identityKey))` or `null`.
- Helper: `saveIdentityKeyPair(keyPair: IdentityKeyPair, registrationId: number): Promise<void>`:
  Stores `{ id: this.localUserId, localUserId: this.localUserId, identityKeyPair: keyPair.serialize(), registrationId, createdAt: Date.now() }`.

### 5.2 `SignalPreKeyStore`
Extends `PreKeyStore`:
- `savePreKey(id: number, record: PreKeyRecord): Promise<void>`:
  Puts `{ id: `${this.localUserId}:${id}`, localUserId: this.localUserId, keyId: id, record: record.serialize() }` into `pre_keys`.
- `getPreKey(id: number): Promise<PreKeyRecord>`:
  Gets `${this.localUserId}:${id}` from `pre_keys`. If not found, throws `new Error('PreKey not found: ' + id)`.
  Returns `PreKeyRecord.deserialize(Buffer.from(entity.record))`.
- `removePreKey(id: number): Promise<void>`:
  Deletes `${this.localUserId}:${id}` from `pre_keys`.
- Helper: `savePreKeys(records: PreKeyRecord[]): Promise<void>`:
  Performs batch write inside a single readwrite transaction.

### 5.3 `SignalSignedPreKeyStore`
Extends `SignedPreKeyStore`:
- `saveSignedPreKey(id: number, record: SignedPreKeyRecord): Promise<void>`:
  Puts `{ id: `${this.localUserId}:${id}`, localUserId: this.localUserId, keyId: id, record: record.serialize() }` into `signed_pre_keys`.
- `getSignedPreKey(id: number): Promise<SignedPreKeyRecord>`:
  Gets `${this.localUserId}:${id}` from `signed_pre_keys`. If not found, throws `new Error('SignedPreKey not found: ' + id)`.
  Returns `SignedPreKeyRecord.deserialize(Buffer.from(entity.record))`.
- Helper: `loadSignedPreKeys(): Promise<SignedPreKeyRecord[]>`:
  Uses `by_user` index to fetch all signed prekeys for `this.localUserId`.

### 5.4 `SignalKyberPreKeyStore`
Extends `KyberPreKeyStore`:
- `saveKyberPreKey(kyberPreKeyId: number, record: KyberPreKeyRecord): Promise<void>`:
  Puts `{ id: `${this.localUserId}:${kyberPreKeyId}`, localUserId: this.localUserId, keyId: kyberPreKeyId, record: record.serialize() }` into `kyber_pre_keys`.
- `getKyberPreKey(kyberPreKeyId: number): Promise<KyberPreKeyRecord>`:
  Gets record or throws if not found. Returns `KyberPreKeyRecord.deserialize(Buffer.from(entity.record))`.
- `markKyberPreKeyUsed(kyberPreKeyId: number): Promise<void>`:
  Marks record as used or removes it.

### 5.5 `SignalSessionStore`
Extends `SessionStore`:
- `saveSession(name: ProtocolAddress, record: SessionRecord): Promise<void>`:
  Puts `{ id: `${this.localUserId}:${name.name()}:${name.deviceId()}`, localUserId: this.localUserId, addressName: name.name(), deviceId: name.deviceId(), record: record.serialize(), updatedAt: Date.now() }` into `sessions`.
- `getSession(name: ProtocolAddress): Promise<SessionRecord | null>`:
  Gets `${this.localUserId}:${name.name()}:${name.deviceId()}` from `sessions`.
  If not found, returns `null`.
  Returns `SessionRecord.deserialize(Buffer.from(entity.record))`.
- `getExistingSessions(addresses: ProtocolAddress[]): Promise<SessionRecord[]>`:
  In a single readonly transaction, queries `sessions` for each address in `addresses`. Returns array of found `SessionRecord` instances.

### 5.6 `SignalSenderKeyStore`
Extends `SenderKeyStore`:
- `saveSenderKey(sender: ProtocolAddress, distributionId: Uuid, record: SenderKeyRecord): Promise<void>`:
  Puts `{ id: `${this.localUserId}:${sender.name()}:${sender.deviceId()}:${distributionId}`, localUserId: this.localUserId, senderAddress: sender.name(), deviceId: sender.deviceId(), distributionId, record: record.serialize(), updatedAt: Date.now() }` into `sender_keys`.
- `getSenderKey(sender: ProtocolAddress, distributionId: Uuid): Promise<SenderKeyRecord | null>`:
  Gets record. If not found, returns `null`. Returns `SenderKeyRecord.deserialize(Buffer.from(entity.record))`.

---

## 6. Purge, Reset & Migration Specifications

### 6.1 Version Upgrade Handler (`upgrade` callback in `idb.openDB`)

When `openDB(DB_NAME, 30, { upgrade(db, oldVersion, newVersion, transaction) { ... } })` runs:

```typescript
if (oldVersion < 30) {
  // 1. Drop obsolete WebCrypto P-256 stores
  if (db.objectStoreNames.contains('conversation_states')) {
    db.deleteObjectStore('conversation_states');
  }
  if (db.objectStoreNames.contains('skipped_message_keys')) {
    db.deleteObjectStore('skipped_message_keys');
  }
  if (db.objectStoreNames.contains('local_keys')) {
    // If local_vault_key exists in legacy local_keys, preserve it before deletion or drop
    db.deleteObjectStore('local_keys');
  }
}

// 2. Create Signal Protocol stores if not present
const stores: Array<{ name: StoreNames<VelumCryptoVaultDB>; indexed: boolean }> = [
  { name: 'identity_keys', indexed: true },
  { name: 'trusted_identities', indexed: true },
  { name: 'pre_keys', indexed: true },
  { name: 'signed_pre_keys', indexed: true },
  { name: 'kyber_pre_keys', indexed: true },
  { name: 'sessions', indexed: true },
  { name: 'sender_keys', indexed: true },
  { name: 'vault_keys', indexed: true },
];

for (const s of stores) {
  if (!db.objectStoreNames.contains(s.name)) {
    const store = db.createObjectStore(s.name, { keyPath: 'id' });
    if (s.indexed) {
      store.createIndex('by_user', 'localUserId', { unique: false });
    }
  }
}
```

### 6.2 Purge Logic (`purgeCryptoVault`)

The purge function supports both scoped per-user purge and full database deletion:

```typescript
export async function purgeCryptoVault(userId?: string | number): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return;
  }

  // Case 1: Targeted purge for a specific user ID
  if (userId !== undefined && userId !== null) {
    const localUserId = String(userId);
    const db = await openCryptoDatabase();
    const storeNames: StoreNames<VelumCryptoVaultDB>[] = [
      'identity_keys',
      'trusted_identities',
      'pre_keys',
      'signed_pre_keys',
      'kyber_pre_keys',
      'sessions',
      'sender_keys',
      'vault_keys',
    ];

    const tx = db.transaction(storeNames, 'readwrite');
    for (const name of storeNames) {
      const store = tx.objectStore(name);
      if (store.indexNames.contains('by_user')) {
        const index = store.index('by_user');
        const keys = await index.getAllKeys(localUserId);
        for (const key of keys) {
          await store.delete(key);
        }
      }
    }
    await tx.done;
    return;
  }

  // Case 2: Full database purge (logout, site reset, duress protocol)
  await closeCryptoDatabase();
  await deleteDB(DB_NAME, {
    blocked() {
      console.warn('[CryptoDbStore] Deletion blocked by open connection in another tab.');
    }
  });
}
```

### 6.3 LocalVaultEncryption Interoperability

`src/services/localVaultEncryption.ts` depends on `saveLocalVaultKeyToDb` and `loadLocalVaultKeyFromDb`.
To preserve full backward compatibility:
- `saveLocalVaultKeyToDb(key: CryptoKey, saltHex: string, userId?: string | number)`:
  Exports `key` as JWK and stores in `vault_keys` with `id: userId ? 'vault_key_' + userId : 'local_vault_key'`.
- `loadLocalVaultKeyFromDb(userId?: string | number)`:
  Loads from `vault_keys`, imports JWK to `CryptoKey` (`AES-GCM`), and returns `{ key, saltHex }`.

---

## 7. Connection Lifecycle & Node/SSR Resilience

1. **Connection Pooling**:
   A module-level cached connection promise (`let dbPromise: Promise<IDBPDatabase<VelumCryptoVaultDB>> | null = null`) ensures single connection reuse across all store instances and operations.
2. **Close & Blocked Handling**:
   - Register `blocking` callback to close connection if a version upgrade occurs in another tab.
   - Register `terminated` callback to clear cached promise if browser terminates connection.
   - Export `closeCryptoDatabase(): Promise<void>` to allow clean teardown in tests and before database deletion.
3. **SSR & Environment Safety**:
   - Check `typeof window === 'undefined' || !window.indexedDB` and fall back to `globalThis.indexedDB` (for Node.js test runners with `fake-indexeddb`).

---

## 8. Summary of Findings & Next Steps

1. **Schema & Stores**: `velum_crypto_vault` version 30 with 8 typed object stores (`identity_keys`, `trusted_identities`, `pre_keys`, `signed_pre_keys`, `kyber_pre_keys`, `sessions`, `sender_keys`, `vault_keys`), all indexed by `by_user`.
2. **Library**: Built using `idb` `^8.0.3` with full TypeScript `DBSchema` type safety.
3. **Libsignal Compliance**: Subclasses of `@signalapp/libsignal-client` abstract store classes (`IdentityKeyStore`, `PreKeyStore`, `SignedPreKeyStore`, `KyberPreKeyStore`, `SessionStore`, `SenderKeyStore`) wrapped in a clean context container.
4. **Multi-account Isolation**: Fully isolated by `${localUserId}` prefix and compound primary keys.
5. **Clean Reset & Migration**: Graceful migration handler dropping legacy P-256 stores during `upgrade`, preserving `LocalVaultEncryption` compatibility, and providing zero-crash boot healing.

This design is ready for implementation by the builder agent in Milestone 2.
