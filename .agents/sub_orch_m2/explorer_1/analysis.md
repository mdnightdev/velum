# Technical Analysis: @signalapp/libsignal-client Storage Architecture & cryptoDbStore.ts Design

## 1. Executive Summary

This report documents the architectural investigation of `@signalapp/libsignal-client` (v0.62.0) storage interfaces, serialization mechanisms, class contracts, error handling semantics, and namespacing requirements for Milestone 2 (Signal Protocol Store Adapter).

The investigation verified that `@signalapp/libsignal-client` exposes abstract JavaScript/TypeScript classes for all protocol stores. Because the library's internal bridge translates native Rust handles to JavaScript wrapper classes via prototype methods (`_saveSession`, `_getSession`, `_getIdentityKey`, etc.), all storage implementations **must inherit directly from libsignal abstract base classes**.

---

## 2. @signalapp/libsignal-client Storage Architecture & Class Contracts

### 2.1 Abstract Store Classes

`@signalapp/libsignal-client` exports the following six abstract store classes from `node_modules/@signalapp/libsignal-client/dist/index.d.ts`:

1. `IdentityKeyStore`
2. `PreKeyStore`
3. `SignedPreKeyStore`
4. `KyberPreKeyStore`
5. `SessionStore`
6. `SenderKeyStore`

#### Prototype Dispatch Mechanism
In `dist/index.js`, the native Rust-WASM layer interacts with JavaScript stores by calling internal underscored methods on the store instance:
- Rust calls `store._saveSession(nativeAddress, nativeRecord)` -> JS calls `this.saveSession(ProtocolAddress._fromNativeHandle(nativeAddress), SessionRecord._fromNativeHandle(nativeRecord))`
- Rust calls `store._getSession(nativeAddress)` -> JS calls `this.getSession(...)`, unwraps `record._nativeHandle`, and returns it to Rust.
- Rust calls `store._getIdentityKey()` -> JS calls `this.getIdentityKey()`, unwraps `key._nativeHandle`, and returns `PrivateKey` native handle.

**Critical Architectural Rule**: Storage adapters cannot simply satisfy a structural TypeScript interface; they must extend the abstract class (`class IndexedDbSessionStore extends SessionStore`) so that the internal `_` dispatch methods are present on the prototype chain.

---

## 3. Store Method Signatures, Parameters & Error Semantics

### 3.1 `IdentityKeyStore`

```typescript
export abstract class IdentityKeyStore {
  abstract getIdentityKey(): Promise<PrivateKey>;
  abstract getLocalRegistrationId(): Promise<number>;
  abstract saveIdentity(name: ProtocolAddress, key: PublicKey): Promise<boolean>;
  abstract isTrustedIdentity(name: ProtocolAddress, key: PublicKey, direction: Direction): Promise<boolean>;
  abstract getIdentity(name: ProtocolAddress): Promise<PublicKey | null>;
}
```

- **`getIdentityKey(): Promise<PrivateKey>`**: Returns the local user's private identity key (`PrivateKey`). Note: Although local storage maintains the `IdentityKeyPair`, this method must return `identityKeyPair.privateKey`.
- **`getLocalRegistrationId(): Promise<number>`**: Returns the local user's 32-bit unsigned registration ID (1 to 2147483647).
- **`saveIdentity(name: ProtocolAddress, key: PublicKey): Promise<boolean>`**: Persists the remote user's identity `PublicKey`. Returns `true` if this was a new identity key or if the key replaced an existing one; returns `false` if the key was identical to the already-stored key.
- **`isTrustedIdentity(name: ProtocolAddress, key: PublicKey, direction: Direction): Promise<boolean>`**: Validates if `key` is trusted for `name` under `direction` (`Direction.Sending = 0`, `Direction.Receiving = 1`). Standard TOFU (Trust On First Use) logic:
  - If no existing identity key: store or trust key (`true`).
  - If existing key matches: `storedKey.compare(key) === 0` -> `true`.
  - If key differs: untrusted key change -> `false`.
- **`getIdentity(name: ProtocolAddress): Promise<PublicKey | null>`**: Retrieves stored remote identity `PublicKey`, or `null` if not found.

### 3.2 `PreKeyStore`

```typescript
export abstract class PreKeyStore {
  abstract savePreKey(id: number, record: PreKeyRecord): Promise<void>;
  abstract getPreKey(id: number): Promise<PreKeyRecord>;
  abstract removePreKey(id: number): Promise<void>;
}
```

- **`savePreKey(id: number, record: PreKeyRecord): Promise<void>`**: Stores a One-Time PreKey by numeric `id`.
- **`getPreKey(id: number): Promise<PreKeyRecord>`**: Retrieves `PreKeyRecord` for `id`. If `id` is not present, throws `Error(`PreKey with id ${id} not found`)`.
- **`removePreKey(id: number): Promise<void>`**: Deletes one-time prekey upon consumption during X3DH processing.

### 3.3 `SignedPreKeyStore`

```typescript
export abstract class SignedPreKeyStore {
  abstract saveSignedPreKey(id: number, record: SignedPreKeyRecord): Promise<void>;
  abstract getSignedPreKey(id: number): Promise<SignedPreKeyRecord>;
}
```

- **`saveSignedPreKey(id: number, record: SignedPreKeyRecord): Promise<void>`**: Stores `SignedPreKeyRecord` under numeric `id`.
- **`getSignedPreKey(id: number): Promise<SignedPreKeyRecord>`**: Retrieves `SignedPreKeyRecord` for `id`. If not present, throws `Error(`SignedPreKey with id ${id} not found`)`.

### 3.4 `KyberPreKeyStore`

```typescript
export abstract class KyberPreKeyStore {
  abstract saveKyberPreKey(kyberPreKeyId: number, record: KyberPreKeyRecord): Promise<void>;
  abstract getKyberPreKey(kyberPreKeyId: number): Promise<KyberPreKeyRecord>;
  abstract markKyberPreKeyUsed(kyberPreKeyId: number): Promise<void>;
}
```

- **Requirement Context**: `signalDecryptPreKey` takes `kyberPrekeyStore: KyberPreKeyStore` as its 7th parameter in `@signalapp/libsignal-client` v0.62.0.
- A functional implementation backed by IndexedDB must be provided to avoid runtime null-pointer exceptions during PreKey message decryption.

### 3.5 `SessionStore`

```typescript
export abstract class SessionStore {
  abstract saveSession(name: ProtocolAddress, record: SessionRecord): Promise<void>;
  abstract getSession(name: ProtocolAddress): Promise<SessionRecord | null>;
  abstract getExistingSessions(addresses: ProtocolAddress[]): Promise<SessionRecord[]>;
}
```

- **`saveSession(name: ProtocolAddress, record: SessionRecord): Promise<void>`**: Stores serialized session state for remote `ProtocolAddress`.
- **`getSession(name: ProtocolAddress): Promise<SessionRecord | null>`**: Retrieves `SessionRecord` for `name`, or `null` if no session exists.
- **`getExistingSessions(addresses: ProtocolAddress[]): Promise<SessionRecord[]>`**: Returns an array of `SessionRecord` instances for all addresses in `addresses` that have active sessions (used by Sealed Sender Multi-Recipient encryption).

### 3.6 `SenderKeyStore`

```typescript
export abstract class SenderKeyStore {
  abstract saveSenderKey(sender: ProtocolAddress, distributionId: Uuid, record: SenderKeyRecord): Promise<void>;
  abstract getSenderKey(sender: ProtocolAddress, distributionId: Uuid): Promise<SenderKeyRecord | null>;
}
```

- **`saveSenderKey(sender: ProtocolAddress, distributionId: Uuid, record: SenderKeyRecord): Promise<void>`**: Stores `SenderKeyRecord` for a group channel distribution ID.
- **`getSenderKey(sender: ProtocolAddress, distributionId: Uuid): Promise<SenderKeyRecord | null>`**: Returns `SenderKeyRecord` or `null`.

---

## 4. Key & Record Serialization / Deserialization Matrix

All cryptographic keys and protocol records in `@signalapp/libsignal-client` expose symmetric serialization and deserialization APIs:

| Type | Generation / Construction | Serialization | Deserialization | Binary Wire Format / Size |
|---|---|---|---|---|
| `PrivateKey` | `PrivateKey.generate()` | `priv.serialize()` | `PrivateKey.deserialize(buf)` | 32 bytes raw X25519 secret |
| `PublicKey` | `priv.getPublicKey()` | `pub.serialize()` | `PublicKey.deserialize(buf)` | 33 bytes (0x05 prefix + 32 bytes X25519) |
| `IdentityKeyPair` | `IdentityKeyPair.generate()` | `idPair.serialize()` | `IdentityKeyPair.deserialize(buf)` | Protobuf (Pub + Priv keys) |
| `PreKeyRecord` | `PreKeyRecord.new(id, pub, priv)` | `rec.serialize()` | `PreKeyRecord.deserialize(buf)` | Protobuf (ID, KeyPair) |
| `SignedPreKeyRecord` | `SignedPreKeyRecord.new(id, ts, pub, priv, sig)` | `rec.serialize()` | `SignedPreKeyRecord.deserialize(buf)` | Protobuf (ID, KeyPair, Sig, Timestamp) |
| `KyberPreKeyRecord` | `KyberPreKeyRecord.new(id, ts, kemPair, sig)` | `rec.serialize()` | `KyberPreKeyRecord.deserialize(buf)` | Protobuf (ID, KyberPair, Sig, Timestamp) |
| `SessionRecord` | `SessionRecord._fromNativeHandle(...)` | `rec.serialize()` | `SessionRecord.deserialize(buf)` | Protobuf (Chains, Ratchets, States) |
| `SenderKeyRecord` | `SenderKeyRecord._fromNativeHandle(...)` | `rec.serialize()` | `SenderKeyRecord.deserialize(buf)` | Protobuf (Group Sender Chains) |
| `ProtocolAddress` | `ProtocolAddress.new(name, deviceId)` | `addr.toString()` | `ProtocolAddress.new(name, deviceId)` | String (`"${name}.${deviceId}"`) |

### Storage Format in IndexedDB
IndexedDB natively supports cloning `Uint8Array` / `ArrayBuffer` without JSON or Base64 stringification.
Storing raw `Uint8Array` binary blobs:
1. Minimizes serialization overhead and memory footprint.
2. Preserves exact byte integrity without string encoding pitfalls.
3. Allows instant reconstruction via `Class.deserialize(Buffer.from(data))`.

---

## 5. Recommended Architecture for `src/services/cryptoDbStore.ts`

### 5.1 Schema Design (`velum_crypto_vault`)

IndexedDB database: `velum_crypto_vault` (Schema Version `30`)

#### Object Stores:
1. `identity_keys` (keyPath: `id`)
   - Local Record: `{ id: '${localUserId}:local', localUserId, registrationId: number, serializedKeyPair: Uint8Array }`
   - Remote Records: `{ id: '${localUserId}:remote:${address}', localUserId, address: string, serializedPublicKey: Uint8Array }`
2. `pre_keys` (keyPath: `id`)
   - `{ id: '${localUserId}:${keyId}', localUserId, keyId: number, serializedRecord: Uint8Array }`
3. `signed_pre_keys` (keyPath: `id`)
   - `{ id: '${localUserId}:${keyId}', localUserId, keyId: number, serializedRecord: Uint8Array }`
4. `kyber_pre_keys` (keyPath: `id`)
   - `{ id: '${localUserId}:${keyId}', localUserId, keyId: number, serializedRecord: Uint8Array }`
5. `sessions` (keyPath: `id`)
   - `{ id: '${localUserId}:${address}', localUserId, address: string, serializedRecord: Uint8Array, updatedAt: number }`
6. `sender_keys` (keyPath: `id`)
   - `{ id: '${localUserId}:${address}:${distributionId}', localUserId, address: string, distributionId: string, serializedRecord: Uint8Array }`
7. `vault_metadata` (keyPath: `id`)
   - `{ id: '${localUserId}:local_vault_key', localUserId, jwk: any, saltHex: string }`

### 5.2 Store Implementation Pattern

```typescript
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
  Direction
} from '@signalapp/libsignal-client';
import { openDB, IDBPDatabase } from 'idb';

export class IndexedDbIdentityKeyStore extends IdentityKeyStore {
  constructor(private localUserId: string | number) {
    super();
  }
  // Implement getIdentityKey, getLocalRegistrationId, saveIdentity, isTrustedIdentity, getIdentity
}

export class IndexedDbPreKeyStore extends PreKeyStore {
  constructor(private localUserId: string | number) {
    super();
  }
  // Implement savePreKey, getPreKey, removePreKey
}

export class IndexedDbSignedPreKeyStore extends SignedPreKeyStore {
  constructor(private localUserId: string | number) {
    super();
  }
  // Implement saveSignedPreKey, getSignedPreKey
}

export class IndexedDbKyberPreKeyStore extends KyberPreKeyStore {
  constructor(private localUserId: string | number) {
    super();
  }
  // Implement saveKyberPreKey, getKyberPreKey, markKyberPreKeyUsed
}

export class IndexedDbSessionStore extends SessionStore {
  constructor(private localUserId: string | number) {
    super();
  }
  // Implement saveSession, getSession, getExistingSessions
}

export class IndexedDbSenderKeyStore extends SenderKeyStore {
  constructor(private localUserId: string | number) {
    super();
  }
  // Implement saveSenderKey, getSenderKey
}
```

### 5.3 Unified Store Adapter Container

```typescript
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
```

### 5.4 Multi-Account Namespacing & Purge API

- **Instance Caching**: Maintain a `Map<string, SignalProtocolStore>` so store instances are reused per `localUserId`.
- **`purgeCryptoVault(userId?: string | number): Promise<void>`**:
  - If `userId` is provided: Deletes all records in all 7 object stores matching prefix `${userId}:`.
  - If `userId` is omitted: Clears all object stores or calls `deleteDB('velum_crypto_vault')`.
- **Schema Migration & Upgrade Resiliency**:
  - In `openDB('velum_crypto_vault', 30, { upgrade(db, oldVersion) { ... } })`:
  - If legacy stores (`local_keys`, `conversation_states`, `skipped_message_keys`) exist from the P-256 WebCrypto era (versions < 30), delete them cleanly to prevent schema collision.
  - Create the new 7 object stores with `{ keyPath: 'id' }`.

---

## 6. Verification Plan & Test Strategy

1. **Unit Tests (`tests/unit/cryptoDbStore.test.ts`)**:
   - `IdentityKeyStore`: Verify storing identity keypair, retrieving private key, saving remote identities, and TOFU trust evaluation.
   - `PreKeyStore`: Verify storing multiple OTPs, loading by ID, deleting on consumption, and error throwing on nonexistent IDs.
   - `SignedPreKeyStore`: Verify storing and retrieving signed prekeys with timestamps and signatures.
   - `KyberPreKeyStore`: Verify saving, loading, and marking Kyber prekeys as used.
   - `SessionStore`: Verify saving session records, deserializing session state, loading single sessions, and batch loading via `getExistingSessions`.
   - `SenderKeyStore`: Verify group sender key persistence and retrieval per distribution ID.
   - Multi-User Isolation: Verify user A and user B maintain separate records with identical key IDs without crosstalk.
   - `purgeCryptoVault`: Verify targeted user purge vs complete database deletion.
2. **Integration Verification with `libsignal-client` Primitives**:
   - Verify that passing `IndexedDbSessionStore` and `IndexedDbIdentityKeyStore` into `signalEncrypt`, `signalDecrypt`, `signalDecryptPreKey`, and `processPreKeyBundle` functions without errors.
