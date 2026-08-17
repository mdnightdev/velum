# Milestone 2 Handoff Report: Signal Protocol Store Adapter & IndexedDB Schema

**Agent**: Explorer 2  
**Role**: Teamwork Explorer (IndexedDB Storage & Migration Architecture)  
**Date**: 2026-08-15  
**Target Module**: `src/services/cryptoDbStore.ts`

---

## 1. Observation

1. **Existing IndexedDB Infrastructure**:
   - `src/services/cryptoDbStore.ts` (lines 1-5): Defines `DB_NAME = 'velum_crypto_vault'` at `DB_VERSION = 26` with stores `STORE_LOCAL_KEYS = 'local_keys'` and `STORE_CONVERSATIONS = 'conversation_states'`.
   - `src/services/cryptoDbStore.ts` (lines 87-142): Exports/imports WebCrypto NIST P-256 keys as JWK structures (`{ name: 'ECDH', namedCurve: 'P-256' }`).
   - `src/services/cryptoDbStore.ts` (lines 144-301): Stores custom Double Ratchet session state records containing P-256 JWKs, root keys, send/receive chain keys, and serialized skipped message key JWKs.
   - `src/services/cryptoDbStore.ts` (lines 342-374): Manages `local_vault_key` for `LocalVaultEncryption` (`AES-GCM` 256-bit).
   - `src/services/cryptoDbStore.ts` (lines 326-339): Exposes `purgeCryptoVault()` using raw `window.indexedDB.deleteDatabase('velum_crypto_vault')`.
   - `src/services/skippedKeysStore.ts` (lines 1-67): Defines `STORE_SKIPPED_KEYS = 'skipped_message_keys'` in `velum_crypto_vault`.
   - `src/utils/indexedDb.ts` (lines 1-40): Defines `velum_local_storage` (`DB_VERSION = 25`) with stores `media_blobs`, `messages`, and `outbox_messages`.

2. **Dependencies**:
   - `package.json` (lines 27, 35, 61): Confirms `@signalapp/libsignal-client` (`^0.62.0`), `idb` (`^8.0.3`), and `fake-indexeddb` (`^6.0.0`) are installed.
   - `node_modules/@signalapp/libsignal-client/dist/index.d.ts` (lines 259-305): Defines abstract base classes `SessionStore`, `IdentityKeyStore`, `PreKeyStore`, `SignedPreKeyStore`, `KyberPreKeyStore`, and `SenderKeyStore` with native private trampoline methods (`_getIdentityKey`, `_saveSession`, `_getPreKey`, etc.).

---

## 2. Logic Chain

1. **Protocol Disconnect**:
   - WebCrypto P-256 JWK keys and custom ratchet state structures are mathematically incompatible with `@signalapp/libsignal-client` Curve25519 / X25519 binary protobuf records (`PrivateKey`, `PublicKey`, `IdentityKeyPair`, `PreKeyRecord`, `SignedPreKeyRecord`, `SessionRecord`).
   - Attempting in-place key conversion is impossible; existing `conversation_states`, `skipped_message_keys`, and P-256 `local_keys` must be safely dropped or reset during upgrade.

2. **Store Subclassing Requirement**:
   - `@signalapp/libsignal-client`'s native bridge requires storage instances to inherit from specific abstract classes (`IdentityKeyStore`, `PreKeyStore`, `SignedPreKeyStore`, `KyberPreKeyStore`, `SessionStore`, `SenderKeyStore`).
   - Because JavaScript only supports single class inheritance, creating dedicated subclasses (`SignalIdentityKeyStore`, `SignalPreKeyStore`, `SignalSignedPreKeyStore`, `SignalKyberPreKeyStore`, `SignalSessionStore`, `SignalSenderKeyStore`) and a composite context container (`SignalProtocolStoreContext`) provides 100% type safety and zero prototype collisions.

3. **Multi-Account Namespacing**:
   - Multiple users sharing the same browser origin requires isolating all keys, sessions, and prekeys by `${localUserId}`.
   - Using compound primary keys (`${localUserId}:${keyId}`, `${localUserId}:${address}:${deviceId}`) combined with a `by_user` index on all stores enables atomic, complete per-user purges (`purgeCryptoVault(localUserId)`).

4. **Schema Versioning & Migration**:
   - Bumping `velum_crypto_vault` version to 30 allows `idb.openDB`'s `upgrade` callback to detect `oldVersion < 30`, delete obsolete P-256 stores (`conversation_states`, `skipped_message_keys`, legacy `local_keys`), and create the 8 typed Signal Protocol stores.
   - Preserving `saveLocalVaultKeyToDb` and `loadLocalVaultKeyFromDb` via a dedicated `vault_keys` store ensures `LocalVaultEncryption` and cached message history continue to work without regression.

---

## 3. Caveats

1. **Kyber Hybrid Post-Quantum Keys**: `@signalapp/libsignal-client` v0.62.0 includes `KyberPreKeyStore` and requires it in `signalDecryptPreKey`. Even if Kyber keys are optional in current prekey bundles, the store must be implemented to satisfy libsignal-client method signatures.
2. **Buffer in Browser**: `@signalapp/libsignal-client` methods accept and return `Buffer` / `Uint8Array`. In browser runtime, `Uint8Array` can be cast to `Buffer` or `Buffer.from(uint8Array)` is used.
3. **Database Concurrency & Blocked Events**: If a user has multiple tabs open while an upgrade or purge occurs, `blocked` and `blocking` callbacks must close open connections gracefully to prevent hung transactions.

---

## 4. Conclusion

1. Implement `src/services/cryptoDbStore.ts` using `idb` (`^8.0.3`) targeting `velum_crypto_vault` database version 30.
2. Define 8 typed object stores (`identity_keys`, `trusted_identities`, `pre_keys`, `signed_pre_keys`, `kyber_pre_keys`, `sessions`, `sender_keys`, `vault_keys`), all indexed by `by_user`.
3. Provide dedicated subclasses extending `@signalapp/libsignal-client` base classes (`SignalIdentityKeyStore`, `SignalPreKeyStore`, `SignalSignedPreKeyStore`, `SignalKyberPreKeyStore`, `SignalSessionStore`, `SignalSenderKeyStore`), instantiated with `localUserId`.
4. Implement `purgeCryptoVault(userId?: string | number)` supporting both scoped per-user purges via `by_user` index and full database deletion via `deleteDB`.
5. Support backward-compatible `saveLocalVaultKeyToDb` and `loadLocalVaultKeyFromDb` methods in `vault_keys`.

Detailed technical design and schema specifications are documented in `/root/velum/.agents/sub_orch_m2/explorer_2/analysis.md`.

---

## 5. Verification Method

1. **File Inspection**:
   - Check `/root/velum/.agents/sub_orch_m2/explorer_2/analysis.md` for complete schema definitions, type contracts, and code blueprints.
2. **Schema Upgrade Verification**:
   - Open an existing database at version 26 using `fake-indexeddb` in Vitest, apply version 30 upgrade handler, and verify legacy stores are deleted and new stores are created.
3. **Multi-User Isolation Verification**:
   - Store identity keys, prekeys, and sessions for User 1 and User 2; verify User 1 cannot access User 2's keys.
   - Execute `purgeCryptoVault("1")` and verify User 2's data remains intact while User 1's data is wiped.
4. **Build & Test Command**:
   - `npm run test` and `npm run lint` when builder implements the module.
