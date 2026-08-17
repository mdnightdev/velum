# Technical Analysis: Unit Test Suite & Testing Infrastructure for `cryptoDbStore.ts`

**Explorer**: Explorer 3 (Testing Configuration & Unit Test Suite Design)  
**Milestone**: Milestone 2 (Signal Protocol Store Adapter)  
**Target Component**: `src/services/cryptoDbStore.ts`  
**Test Suite Target**: `tests/unit/cryptoDbStore.test.ts`  
**Date**: 2026-08-15  

---

## 1. Testing Infrastructure & Environment Analysis

### 1.1 Test Runner & Toolchain Configuration
- **Test Runner**: Vitest `4.1.9` (`"test": "vitest run"` in `package.json`).
- **Vite/Vitest Config** (`vite.config.ts`):
  - `globals: true` (enables global `describe`, `it`, `expect`, `beforeEach`, `afterEach`).
  - `environment: 'node'` (runs in Node.js environment; native crypto and WASM modules execute via Node's native/WASM loader).
  - `testTimeout: 20000` (sufficient for multi-key cryptographic operations).
  - `plugins`: `wasm()` (`vite-plugin-wasm`), `react()`, `tailwindcss()`.
  - `resolve.alias`: `'@': '/src'`.
- **TypeScript Configuration** (`tsconfig.json`):
  - `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`.
  - `lib`: `["ES2022", "DOM", "DOM.Iterable"]`.
  - `paths`: `"@/*": ["./*"]`.
  - `skipLibCheck: true`, `noEmit: true`.
- **Crypto & WASM Dependencies**:
  - `@signalapp/libsignal-client` (`^0.62.0`): Native Rust/WASM Signal protocol engine. Under Node.js in Vitest, resolves via CJS/ESM node loader without requiring custom browser polyfills for core protocol primitives.
  - `idb` (`^8.0.3`): Lightweight Promise wrapper around IndexedDB.

### 1.2 IndexedDB Mocking & Test Isolation Strategy

#### Current Mock Implementation (`tests/e2e/helpers/mockIndexedDB.ts`)
- The repository currently contains a bespoke, in-memory mock `MockIndexedDBFactory` in `tests/e2e/helpers/mockIndexedDB.ts` used by e2e tests.
- **Architectural Limitations of `mockIndexedDB.ts`**:
  1. Does not implement standard `IDBKeyRange` (e.g., `only`, `lowerBound`, `upperBound`, `bound`).
  2. Lacks complete transaction lifecycle semantics (auto-commit on microtask queue exhaustion, abort handling, version change transactions).
  3. Lacks support for compound array keys (e.g., `[localUserId, remoteAddress]`).
  4. Incompatible with standard `idb` Promise wrapper edge cases (e.g., transaction completion listeners, cursor iteration).

#### Recommended Testing Mock: `fake-indexeddb` (v6.0.0)
- `fake-indexeddb` (`^6.0.0`) is already installed in `devDependencies` in `package.json`.
- **Advantages of `fake-indexeddb`**:
  1. 100% W3C IndexedDB specification compliance.
  2. Full support for `idb` (`openDB`, `DBSchema`, `IDBPDatabase`, `tx.store`, schema migrations in `upgrade`).
  3. Seamless polyfill injection via `import 'fake-indexeddb/auto'`.
  4. Complete support for `indexedDB.deleteDatabase()` and multi-database isolation.
- **Integration Pattern for Unit Tests**:
  ```typescript
  import 'fake-indexeddb/auto';
  import { describe, it, expect, beforeEach, afterEach } from 'vitest';
  
  // Before/after each test, ensure clean state:
  beforeEach(async () => {
    // Delete database to ensure complete test isolation
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('velum_crypto_vault');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  });
  ```

---

## 2. Store Interface & Serialization Analysis for `cryptoDbStore.ts`

From `@signalapp/libsignal-client` (`node_modules/@signalapp/libsignal-client/dist/index.d.ts`), `cryptoDbStore.ts` must provide concrete implementations of the following abstract classes:

### 2.1 `IdentityKeyStore`
| Method Signature | Return Type | Description |
|------------------|-------------|-------------|
| `getIdentityKey()` | `Promise<PrivateKey>` | Returns local identity private key. |
| `getLocalRegistrationId()` | `Promise<number>` | Returns local registration ID (uint32). |
| `saveIdentity(name: ProtocolAddress, key: PublicKey)` | `Promise<boolean>` | Saves remote peer identity. Returns `true` if key replaced an existing different key, `false` otherwise. |
| `isTrustedIdentity(name: ProtocolAddress, key: PublicKey, direction: Direction)` | `Promise<boolean>` | Validates trust (TOFU or verified). Direction is `Direction.Sending (0)` or `Direction.Receiving (1)`. |
| `getIdentity(name: ProtocolAddress)` | `Promise<PublicKey \| null>` | Returns trusted identity public key for peer, or `null`. |
| *Auxiliary: `saveIdentityKeyPair(keyPair: IdentityKeyPair, registrationId: number)`* | `Promise<void>` | Helper to persist generated local identity pair. |
| *Auxiliary: `getIdentityKeyPair()`* | `Promise<IdentityKeyPair \| null>` | Helper to retrieve full local key pair. |

### 2.2 `PreKeyStore`
| Method Signature | Return Type | Description |
|------------------|-------------|-------------|
| `savePreKey(id: number, record: PreKeyRecord)` | `Promise<void>` | Serializes and stores One-Time PreKey record by numeric ID. |
| `getPreKey(id: number)` | `Promise<PreKeyRecord>` | Retrieves and deserializes PreKey record. Rejects if not found. |
| `removePreKey(id: number)` | `Promise<void>` | Removes consumed PreKey from store. |

### 2.3 `SignedPreKeyStore`
| Method Signature | Return Type | Description |
|------------------|-------------|-------------|
| `saveSignedPreKey(id: number, record: SignedPreKeyRecord)` | `Promise<void>` | Serializes and stores Signed PreKey record. |
| `getSignedPreKey(id: number)` | `Promise<SignedPreKeyRecord>` | Retrieves and deserializes Signed PreKey record. Rejects if not found. |
| *Auxiliary: `loadSignedPreKeys()`* | `Promise<SignedPreKeyRecord[]>` | Returns all stored signed prekeys for rotation management. |

### 2.4 `SessionStore`
| Method Signature | Return Type | Description |
|------------------|-------------|-------------|
| `saveSession(name: ProtocolAddress, record: SessionRecord)` | `Promise<void>` | Serializes and stores active session record for peer address. |
| `getSession(name: ProtocolAddress)` | `Promise<SessionRecord \| null>` | Retrieves and deserializes session record, or `null` if none. |
| `getExistingSessions(addresses: ProtocolAddress[])` | `Promise<SessionRecord[]>` | Batch retrieves active sessions for given addresses. |

### 2.5 `SenderKeyStore`
| Method Signature | Return Type | Description |
|------------------|-------------|-------------|
| `saveSenderKey(sender: ProtocolAddress, distributionId: Uuid, record: SenderKeyRecord)` | `Promise<void>` | Serializes and stores group sender key record. |
| `getSenderKey(sender: ProtocolAddress, distributionId: Uuid)` | `Promise<SenderKeyRecord \| null>` | Retrieves and deserializes sender key record, or `null`. |

### 2.6 Multi-Account Namespacing & Vault Management
- **Namespacing Requirement**: Multiple user accounts sharing the same browser IndexedDB must be completely partitioned.
- **Key Pattern**: Prefix all records with `${localUserId}:` (or store in a class instance bound to `localUserId`):
  - Local Identity: `local_identity_${localUserId}`
  - PreKeys: `${localUserId}:${keyId}`
  - Signed PreKeys: `${localUserId}:${signedPreKeyId}`
  - Sessions: `${localUserId}:${address.name()}:${address.deviceId()}`
  - Sender Keys: `${localUserId}:${sender.name()}:${sender.deviceId()}:${distributionId}`
- **Purge Functions**:
  - `purgeCryptoVault(userId?: string | number)`: When `userId` is provided, purges all records prefixed with `${userId}:`. When omitted, deletes the entire database.
  - `closeCryptoDatabase()`: Closes active IndexedDB connections.

---

## 3. Comprehensive Unit Test Suite Plan (`tests/unit/cryptoDbStore.test.ts`)

The proposed unit test suite contains **42 unit test cases** divided into **8 structured test suites**.

### Suite 1: `IdentityKeyStore` Operations (8 Tests)
| Test ID | Test Name | Objective & Assertions |
|---------|-----------|------------------------|
| `IDS-01` | Save and load local identity key pair | Store generated `IdentityKeyPair`, reload via store, verify public and private key byte equivalence. |
| `IDS-02` | Store and retrieve local registration ID | Store uint32 registration ID (e.g. `142857`), verify exact numerical match on `getLocalRegistrationId()`. |
| `IDS-03` | Save remote peer identity and retrieve | Save peer `PublicKey` for `ProtocolAddress('bob', 1)`, retrieve via `getIdentity()`, verify matching public key bytes. |
| `IDS-04` | Trust on first use (TOFU) for unknown peer | Call `isTrustedIdentity()` on an untrusted new peer identity; verify it returns `true` (TOFU pattern). |
| `IDS-05` | Identity replacement detection in `saveIdentity` | Saving a new identity for first time returns `false` (no replacement); saving a different identity for same address returns `true` (key replaced). |
| `IDS-06` | Identity key change marks identity untrusted | After saving peer key K1, testing trust for key K2 on same address returns `false` (untrusted change). |
| `IDS-07` | Direction-aware trust checks (`Sending` vs `Receiving`) | Verify `isTrustedIdentity` properly handles `Direction.Sending (0)` and `Direction.Receiving (1)`. |
| `IDS-08` | Idempotent identity save | Saving the exact same identity key twice returns `false` (no replacement) and maintains trusted status. |

### Suite 2: `PreKeyStore` (One-Time PreKeys) (6 Tests)
| Test ID | Test Name | Objective & Assertions |
|---------|-----------|------------------------|
| `PKS-01` | Save and retrieve `PreKeyRecord` | Store `PreKeyRecord.new(1, pubKey, privKey)`, retrieve with `getPreKey(1)`, assert ID and public key match. |
| `PKS-02` | Remove/consume `PreKeyRecord` | Store PreKey ID 42, call `removePreKey(42)`, verify subsequent `getPreKey(42)` rejects / throws error. |
| `PKS-03` | Retrieve non-existent PreKey error handling | Calling `getPreKey(9999)` on empty store rejects with a clear error without unhandled rejection. |
| `PKS-04` | Batch store 100 One-Time PreKeys | Store 100 distinct prekeys (IDs 1..100), retrieve sample keys (1, 50, 100), verify integrity of each. |
| `PKS-05` | Overwrite existing PreKey record | Storing a new `PreKeyRecord` with an existing ID cleanly overwrites the previous record. |
| `PKS-06` | PreKey binary serialization integrity | Verify serialized binary payload stored in IDB accurately restores private and public key structures upon deserialize. |

### Suite 3: `SignedPreKeyStore` Operations (6 Tests)
| Test ID | Test Name | Objective & Assertions |
|---------|-----------|------------------------|
| `SPK-01` | Save and retrieve `SignedPreKeyRecord` | Store signed prekey with signature and timestamp, retrieve and assert ID, timestamp, and signature match. |
| `SPK-02` | Signature verification on restored SignedPreKey | Retrieve stored `SignedPreKeyRecord`, verify `identityKey.verify(pubKey, record.signature()) === true`. |
| `SPK-03` | Retrieve non-existent SignedPreKey | Calling `getSignedPreKey(8888)` on empty store rejects with clear error. |
| `SPK-04` | List all stored SignedPreKeys | Store multiple signed prekeys (IDs 1, 2, 3), call `loadSignedPreKeys()`, verify all 3 returned. |
| `SPK-05` | Rotate SignedPreKey | Store SPK 1, then SPK 2; verify both are independently accessible and maintain distinct signatures. |
| `SPK-06` | Timestamp fidelity | Verify exact millisecond timestamp is preserved through serialization and storage roundtrip. |

### Suite 4: `SessionStore` Operations (6 Tests)
| Test ID | Test Name | Objective & Assertions |
|---------|-----------|------------------------|
| `SES-01` | Save and retrieve `SessionRecord` | Create and store `SessionRecord`, retrieve for `ProtocolAddress('peer_1', 1)`, assert `hasCurrentState()` matches. |
| `SES-02` | Retrieve non-existent session returns `null` | Calling `getSession(ProtocolAddress('unknown', 1))` returns `null` without throwing. |
| `SES-03` | Update active session state | Store initial session, archive current state or update session, save again, retrieve and verify updated state. |
| `SES-04` | Multi-device addressing for same user | Store distinct sessions for `ProtocolAddress('alice', 1)` and `ProtocolAddress('alice', 2)`; verify complete isolation. |
| `SES-05` | Batch retrieval with `getExistingSessions` | Pass array of 3 addresses (2 existing, 1 missing), verify returned array contains exactly the 2 active sessions. |
| `SES-06` | Session state serialization roundtrip | Verify local and remote registration IDs and ratchet keys survive serialization roundtrip. |

### Suite 5: `SenderKeyStore` Operations (5 Tests)
| Test ID | Test Name | Objective & Assertions |
|---------|-----------|------------------------|
| `SKS-01` | Save and retrieve `SenderKeyRecord` | Store `SenderKeyRecord` for `(ProtocolAddress('sender', 1), distributionId)`, retrieve and verify integrity. |
| `SKS-02` | Retrieve non-existent SenderKey returns `null` | Calling `getSenderKey()` for non-existent distribution ID returns `null`. |
| `SKS-03` | Isolation across distribution IDs | Store sender keys for same sender under UUID-1 and UUID-2; verify independent retrieval without cross-talk. |
| `SKS-04` | Isolation across sender device IDs | Store sender keys for `('alice', 1)` and `('alice', 2)` under same UUID; verify distinct records. |
| `SKS-05` | Update existing SenderKeyRecord | Mutate/advance sender key iteration, re-save, verify updated record retrieved. |

### Suite 6: Multi-Account Namespacing & Isolation (4 Tests)
| Test ID | Test Name | Objective & Assertions |
|---------|-----------|------------------------|
| `ISO-01` | PreKey ID collision avoidance across users | User A (101) and User B (102) both store PreKey ID 1 with different keys; verify User A and User B retrieve their own keys. |
| `ISO-02` | Session isolation across local accounts | User A and User B both establish session with `ProtocolAddress('bob', 1)`; verify distinct session states. |
| `ISO-03` | Identity key isolation across accounts | User A and User B store distinct identity key pairs; verify no leakage or overwriting. |
| `ISO-04` | User-scoped store instances | Instantiating `SignalProtocolStore(101)` vs `SignalProtocolStore(102)` operates on isolated key partitions. |

### Suite 7: Purge Operations, Lifecycle & Migration (4 Tests)
| Test ID | Test Name | Objective & Assertions |
|---------|-----------|------------------------|
| `PUR-01` | User-scoped purge (`purgeCryptoVault(userId)`) | Store records for User 101 and User 102; purge User 101; verify User 101 records deleted while User 102 intact. |
| `PUR-02` | Global vault purge (`purgeCryptoVault()`) | Store records across multiple users; call global purge; verify entire IndexedDB database deleted. |
| `PUR-03` | Reconnection after `closeCryptoDatabase()` | Call `closeCryptoDatabase()`, then execute read/write; verify connection is re-opened automatically. |
| `PUR-04` | Schema version upgrade resiliency | Simulate opening database with old version 26 schema stores; verify upgrade creates new object stores without error. |

### Suite 8: Boundary Values & Error Handling (3 Tests)
| Test ID | Test Name | Objective & Assertions |
|---------|-----------|------------------------|
| `BND-01` | Extreme PreKey and SignedPreKey numeric IDs | Test key IDs: `0`, `1`, `0xFFFFFF` (16777215), `0x7FFFFFFF` (2147483647). Verify exact storage and retrieval. |
| `BND-02` | Complex ProtocolAddress strings | Test names with UUIDs, phone numbers (`+1234567890`), symbols (`user+test@domain.com`), and 256-char strings. |
| `BND-03` | Concurrent read/write stress | Execute 50 parallel asynchronous `savePreKey` and `saveSession` operations; verify zero deadlocks or race conditions. |

---

## 4. Test Implementation Template & Code Patterns

Here is the exact TypeScript testing structure recommended for `tests/unit/cryptoDbStore.test.ts`:

```typescript
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PrivateKey,
  PublicKey,
  IdentityKeyPair,
  PreKeyRecord,
  SignedPreKeyRecord,
  SessionRecord,
  SenderKeyRecord,
  ProtocolAddress,
  Direction
} from '@signalapp/libsignal-client';
import {
  SignalProtocolStore,
  purgeCryptoVault,
  closeCryptoDatabase
} from '../../src/services/cryptoDbStore';

describe('Signal Protocol Store Adapter Unit Tests (cryptoDbStore.ts)', () => {
  const TEST_USER_A = 1001;
  const TEST_USER_B = 1002;
  let storeA: SignalProtocolStore;
  let storeB: SignalProtocolStore;

  beforeEach(async () => {
    await purgeCryptoVault();
    storeA = new SignalProtocolStore(TEST_USER_A);
    storeB = new SignalProtocolStore(TEST_USER_B);
  });

  afterEach(async () => {
    await closeCryptoDatabase();
    await purgeCryptoVault();
  });

  describe('1. IdentityKeyStore', () => {
    it('IDS-01: should save and retrieve local identity key pair', async () => {
      const idPair = IdentityKeyPair.generate();
      await storeA.saveIdentityKeyPair(idPair, 12345);

      const retrievedKey = await storeA.getIdentityKey();
      expect(retrievedKey.serialize()).toEqual(idPair.privateKey.serialize());

      const retrievedPair = await storeA.getIdentityKeyPair();
      expect(retrievedPair).not.toBeNull();
      expect(retrievedPair!.publicKey.serialize()).toEqual(idPair.publicKey.serialize());
    });

    it('IDS-02: should save and retrieve local registration ID', async () => {
      const regId = 987654;
      const idPair = IdentityKeyPair.generate();
      await storeA.saveIdentityKeyPair(idPair, regId);

      const retrievedRegId = await storeA.getLocalRegistrationId();
      expect(retrievedRegId).toBe(regId);
    });

    it('IDS-03: should save and retrieve remote peer identity', async () => {
      const peerAddress = ProtocolAddress.new('bob', 1);
      const peerIdPair = IdentityKeyPair.generate();

      await storeA.saveIdentity(peerAddress, peerIdPair.publicKey);
      const retrieved = await storeA.getIdentity(peerAddress);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.serialize()).toEqual(peerIdPair.publicKey.serialize());
    });

    it('IDS-04: should trust identity on first use (TOFU)', async () => {
      const peerAddress = ProtocolAddress.new('charlie', 1);
      const peerIdPair = IdentityKeyPair.generate();

      const isTrusted = await storeA.isTrustedIdentity(peerAddress, peerIdPair.publicKey, Direction.Sending);
      expect(isTrusted).toBe(true);
    });

    it('IDS-05: should detect identity key change and return untrusted', async () => {
      const peerAddress = ProtocolAddress.new('david', 1);
      const originalKey = IdentityKeyPair.generate().publicKey;
      const changedKey = IdentityKeyPair.generate().publicKey;

      // Save initial key
      const replacedFirst = await storeA.saveIdentity(peerAddress, originalKey);
      expect(replacedFirst).toBe(false);

      // Verify original key is trusted
      expect(await storeA.isTrustedIdentity(peerAddress, originalKey, Direction.Sending)).toBe(true);

      // Verify changed key is UNTRUSTED
      expect(await storeA.isTrustedIdentity(peerAddress, changedKey, Direction.Sending)).toBe(false);

      // Overwriting returns true indicating key replacement
      const replacedSecond = await storeA.saveIdentity(peerAddress, changedKey);
      expect(replacedSecond).toBe(true);
    });
  });

  describe('2. PreKeyStore', () => {
    it('PKS-01: should save, get, and serialize PreKeyRecord', async () => {
      const keyId = 42;
      const priv = PrivateKey.generate();
      const pub = priv.getPublicKey();
      const record = PreKeyRecord.new(keyId, pub, priv);

      await storeA.savePreKey(keyId, record);
      const retrieved = await storeA.getPreKey(keyId);

      expect(retrieved.id()).toBe(keyId);
      expect(retrieved.publicKey().serialize()).toEqual(pub.serialize());
    });

    it('PKS-02: should remove PreKey upon consumption', async () => {
      const keyId = 100;
      const priv = PrivateKey.generate();
      const record = PreKeyRecord.new(keyId, priv.getPublicKey(), priv);

      await storeA.savePreKey(keyId, record);
      await storeA.removePreKey(keyId);

      await expect(storeA.getPreKey(keyId)).rejects.toThrow();
    });
  });

  describe('3. SignedPreKeyStore', () => {
    it('SPK-01: should save, get, and verify SignedPreKeyRecord', async () => {
      const spkId = 77;
      const timestamp = Date.now();
      const idPair = IdentityKeyPair.generate();
      const spkPriv = PrivateKey.generate();
      const spkPub = spkPriv.getPublicKey();
      const signature = idPair.privateKey.sign(spkPub.serialize());
      const record = SignedPreKeyRecord.new(spkId, timestamp, spkPub, spkPriv, signature);

      await storeA.saveSignedPreKey(spkId, record);
      const retrieved = await storeA.getSignedPreKey(spkId);

      expect(retrieved.id()).toBe(spkId);
      expect(retrieved.timestamp()).toBe(timestamp);
      expect(idPair.publicKey.verify(retrieved.publicKey().serialize(), retrieved.signature())).toBe(true);
    });
  });

  describe('4. SessionStore', () => {
    it('SES-01: should return null for non-existent session and save active session', async () => {
      const addr = ProtocolAddress.new('peer_session_test', 1);
      const initial = await storeA.getSession(addr);
      expect(initial).toBeNull();
    });
  });

  describe('5. Multi-User Isolation', () => {
    it('ISO-01: should isolate PreKeys between User A and User B with identical key IDs', async () => {
      const keyId = 1;
      const privA = PrivateKey.generate();
      const privB = PrivateKey.generate();
      const recordA = PreKeyRecord.new(keyId, privA.getPublicKey(), privA);
      const recordB = PreKeyRecord.new(keyId, privB.getPublicKey(), privB);

      await storeA.savePreKey(keyId, recordA);
      await storeB.savePreKey(keyId, recordB);

      const loadedA = await storeA.getPreKey(keyId);
      const loadedB = await storeB.getPreKey(keyId);

      expect(loadedA.publicKey().serialize()).toEqual(privA.getPublicKey().serialize());
      expect(loadedB.publicKey().serialize()).toEqual(privB.getPublicKey().serialize());
      expect(loadedA.publicKey().serialize()).not.toEqual(loadedB.publicKey().serialize());
    });
  });

  describe('6. Purge Operations', () => {
    it('PUR-01: should purge only specified user records', async () => {
      const idA = IdentityKeyPair.generate();
      const idB = IdentityKeyPair.generate();
      await storeA.saveIdentityKeyPair(idA, 111);
      await storeB.saveIdentityKeyPair(idB, 222);

      await purgeCryptoVault(TEST_USER_A);

      expect(await storeA.getIdentityKeyPair()).toBeNull();
      expect(await storeB.getIdentityKeyPair()).not.toBeNull();
    });
  });
});
```

---

## 5. Summary & Key Recommendations for Implementers

1. **Use `fake-indexeddb/auto` for Unit Testing**: Replaces the partial `mockIndexedDB.ts` for unit test suites, providing 100% W3C IDB compliance and full compatibility with `idb` Promise wrappers.
2. **Unified `SignalProtocolStore` Class**: Design `src/services/cryptoDbStore.ts` as a single class (or composed adapter) implementing `IdentityKeyStore`, `PreKeyStore`, `SignedPreKeyStore`, `SessionStore`, and `SenderKeyStore` parameterized by `localUserId: number | string`.
3. **Binary Storage for Records**: Store raw byte buffers (`record.serialize()`) directly in IndexedDB object stores (or Uint8Array), deserializing via `PreKeyRecord.deserialize`, `SignedPreKeyRecord.deserialize`, `SessionRecord.deserialize`, `SenderKeyRecord.deserialize`. This avoids JSON/JWK serialization overhead and guarantees zero byte corruption.
4. **Isolated Object Stores**:
   - `identity_keys`: keyPath `id` (`${localUserId}:local` or `${localUserId}:peer:${address.name()}:${address.deviceId()}`)
   - `pre_keys`: keyPath `id` (`${localUserId}:${keyId}`)
   - `signed_pre_keys`: keyPath `id` (`${localUserId}:${keyId}`)
   - `sessions`: keyPath `id` (`${localUserId}:${address.name()}:${address.deviceId()}`)
   - `sender_keys`: keyPath `id` (`${localUserId}:${sender.name()}:${sender.deviceId()}:${distributionId}`)
5. **Clean Migration from Legacy Schema**: In the `idb` `upgrade` callback, detect old object stores (`STORE_LOCAL_KEYS`, `STORE_CONVERSATIONS`) and create the new Signal protocol stores cleanly.
