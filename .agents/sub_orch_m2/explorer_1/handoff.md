# Milestone 2 Explorer 1 Handoff Report

## 1. Observation

1. **Abstract Store Classes in `@signalapp/libsignal-client`**:
   - `node_modules/@signalapp/libsignal-client/dist/index.d.ts` lines 259–305 export:
     - `export declare abstract class SessionStore implements Native.SessionStore`
     - `export declare abstract class IdentityKeyStore implements Native.IdentityKeyStore`
     - `export declare abstract class PreKeyStore implements Native.PreKeyStore`
     - `export declare abstract class SignedPreKeyStore implements Native.SignedPreKeyStore`
     - `export declare abstract class KyberPreKeyStore implements Native.KyberPreKeyStore`
     - `export declare abstract class SenderKeyStore implements Native.SenderKeyStore`
   - `node_modules/@signalapp/libsignal-client/dist/index.js` lines 622–713 implement prototype bridge methods:
     - `SessionStore._saveSession(name, record)` -> `this.saveSession(ProtocolAddress._fromNativeHandle(name), SessionRecord._fromNativeHandle(record))`
     - `SessionStore._getSession(name)` -> calls `this.getSession(ProtocolAddress._fromNativeHandle(name))` and unwraps `sess._nativeHandle`.
     - `IdentityKeyStore._getIdentityKey()` -> calls `this.getIdentityKey()` and unwraps `key._nativeHandle`.
     - `IdentityKeyStore._saveIdentity(name, key)` -> calls `this.saveIdentity(ProtocolAddress._fromNativeHandle(name), PublicKey._fromNativeHandle(key))`.
     - `IdentityKeyStore._isTrustedIdentity(name, key, sending)` -> maps `sending` boolean to `Direction.Sending` or `Direction.Receiving`.
     - `PreKeyStore._savePreKey(id, record)`, `PreKeyStore._getPreKey(id)`, `PreKeyStore._removePreKey(id)`.
     - `SignedPreKeyStore._saveSignedPreKey(id, record)`, `SignedPreKeyStore._getSignedPreKey(id)`.
     - `KyberPreKeyStore._saveKyberPreKey(id, record)`, `KyberPreKeyStore._getKyberPreKey(id)`, `KyberPreKeyStore._markKyberPreKeyUsed(id)`.
     - `SenderKeyStore._saveSenderKey(sender, distributionId, record)`, `SenderKeyStore._getSenderKey(sender, distributionId)`.

2. **Record Serialization & Deserialization Methods**:
   - `node_modules/@signalapp/libsignal-client/dist/EcKeys.d.ts` lines 3–33:
     - `PublicKey.serialize(): Buffer`, `PublicKey.deserialize(buf: Buffer): PublicKey`
     - `PrivateKey.serialize(): Buffer`, `PrivateKey.deserialize(buf: Buffer): PrivateKey`
     - `IdentityKeyPair.serialize(): Buffer`, `IdentityKeyPair.deserialize(buffer: Buffer): IdentityKeyPair`
   - `node_modules/@signalapp/libsignal-client/dist/index.d.ts` lines 102–197:
     - `PreKeyRecord.serialize(): Buffer`, `PreKeyRecord.deserialize(buffer: Buffer): PreKeyRecord`
     - `SignedPreKeyRecord.serialize(): Buffer`, `SignedPreKeyRecord.deserialize(buffer: Buffer): SignedPreKeyRecord`
     - `KyberPreKeyRecord.serialize(): Buffer`, `KyberPreKeyRecord.deserialize(buffer: Buffer): KyberPreKeyRecord`
     - `SessionRecord.serialize(): Buffer`, `SessionRecord.deserialize(buffer: Buffer): SessionRecord`
     - `SenderKeyRecord.serialize(): Buffer`, `SenderKeyRecord.deserialize(buffer: Buffer): SenderKeyRecord`

3. **Current Legacy Storage in `src/services/cryptoDbStore.ts`**:
   - Uses `velum_crypto_vault` version 26 with stores `local_keys` and `conversation_states` storing WebCrypto JWK format and custom ratchet states.
   - Must be upgraded cleanly to schema version 30 to store `@signalapp/libsignal-client` binary records and eliminate legacy P-256 state corruption.

4. **Dependencies**:
   - `package.json` includes `"@signalapp/libsignal-client": "^0.62.0"`, `"idb": "^8.0.3"`, `"fake-indexeddb": "^6.0.0"`.

---

## 2. Logic Chain

1. **Abstract Class Inheritance Requirement**:
   - From Observation 1, the JavaScript runtime of `@signalapp/libsignal-client` invokes internal underscored methods (`_saveSession`, `_getSession`, `_getIdentityKey`, etc.) located on the base class prototype.
   - Therefore, custom store implementations in `src/services/cryptoDbStore.ts` must inherit via `class ... extends SessionStore` (and corresponding base classes) rather than merely fulfilling a TypeScript interface shape.

2. **Binary Storage Efficiency**:
   - From Observation 2, all libsignal keys and records expose `.serialize(): Buffer` and static `.deserialize(buffer: Buffer)`.
   - IndexedDB structured cloning supports `Uint8Array` natively. Storing raw `Uint8Array` binary records in IndexedDB avoids Base64/JSON encoding overhead and guarantees zero data corruption across browsers.

3. **Store Architecture and Modularization**:
   - Because libsignal protocol operations (`signalEncrypt`, `signalDecryptPreKey`, etc.) accept separate store parameters (`sessionStore`, `identityStore`, `prekeyStore`, `signedPrekeyStore`, `kyberPrekeyStore`), each store should be an independent class extending its respective libsignal abstract class.
   - A unified `SignalProtocolStore` class aggregates these store instances per `localUserId`, providing multi-account namespacing and lifecycle management.

4. **Schema Upgrade & Resiliency**:
   - From Observation 3, upgrading the database to version 30 and dropping old WebCrypto stores (`conversation_states`, `local_keys`, `skipped_message_keys`) prevents legacy schema collisions and provides a clean slate for Signal Protocol operations.

---

## 3. Caveats

- In `IdentityKeyStore.getIdentityKey()`, the return type must be `PrivateKey`, representing the private half of the identity keypair, whereas `saveIdentity` receives a `PublicKey`.
- `signalDecryptPreKey` requires a `KyberPreKeyStore` instance even when processing classical Curve25519 prekey messages; a functional `IndexedDbKyberPreKeyStore` must be included.
- TOFU (Trust On First Use) in `isTrustedIdentity` returns `true` when no identity key has been stored yet for a given remote address.

---

## 4. Conclusion

The recommended architecture for `src/services/cryptoDbStore.ts` consists of:
1. Six store classes extending libsignal abstract classes: `IndexedDbIdentityKeyStore`, `IndexedDbPreKeyStore`, `IndexedDbSignedPreKeyStore`, `IndexedDbKyberPreKeyStore`, `IndexedDbSessionStore`, and `IndexedDbSenderKeyStore`.
2. A unified `SignalProtocolStore` container namespaced by `${localUserId}`.
3. IndexedDB database `velum_crypto_vault` (version 30) with 7 object stores (`identity_keys`, `pre_keys`, `signed_pre_keys`, `kyber_pre_keys`, `sessions`, `sender_keys`, `vault_metadata`) storing native `Uint8Array` binary blobs.
4. Comprehensive multi-account isolation and `purgeCryptoVault(userId?: string | number)` support.

---

## 5. Verification Method

- Inspect `src/services/cryptoDbStore.ts` implementation to confirm inheritance from `@signalapp/libsignal-client` abstract classes.
- Run unit test suite:
  ```bash
  npx vitest run tests/unit/cryptoDbStore.test.ts
  ```
- Invalidation condition: If any store method throws a TypeError indicating missing `_nativeHandle` or missing underscored prototype method, the class does not properly inherit from `@signalapp/libsignal-client` abstract classes.
