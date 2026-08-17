# Handoff Report: Explorer 3 (Milestone 2 - Signal Protocol Store Adapter Test Suite)

**Agent**: Explorer 3  
**Working Directory**: `/root/velum/.agents/sub_orch_m2/explorer_3/`  
**Target Component**: `src/services/cryptoDbStore.ts` & `tests/unit/cryptoDbStore.test.ts`  
**Date**: 2026-08-15  

---

## 1. Observation

1. **Vitest & Toolchain Configuration**:
   - `package.json` (lines 18, 27, 35, 61, 71, 72):
     ```json
     "scripts": {
       "test": "vitest run"
     },
     "dependencies": {
       "@signalapp/libsignal-client": "^0.62.0",
       "idb": "^8.0.3"
     },
     "devDependencies": {
       "fake-indexeddb": "^6.0.0",
       "vite-plugin-wasm": "^3.4.1",
       "vitest": "^4.1.9"
     }
     ```
   - `vite.config.ts` (lines 24-28):
     ```typescript
     test: {
       globals: true,
       environment: 'node',
       testTimeout: 20000,
     }
     ```
   - `tsconfig.json` (lines 1-25): Target `ES2022`, Module `ESNext`, `moduleResolution: "bundler"`, `paths: { "@/*": ["./*"] }`, `skipLibCheck: true`.

2. **IndexedDB Handling**:
   - Existing e2e tests in `tests/e2e/helpers/testEnv.ts` (lines 6, 75, 91-93) instantiate a custom mock `MockIndexedDBFactory` defined in `tests/e2e/helpers/mockIndexedDB.ts`.
   - `mockIndexedDB.ts` is an incomplete mock lacking `IDBKeyRange`, transaction abort lifecycle, auto-commit microtask handling, compound index lookups, and full `idb` Promise wrapper compatibility.
   - `fake-indexeddb` `^6.0.0` is already installed in `devDependencies` and provides a 100% W3C-compliant in-memory IndexedDB engine via `import 'fake-indexeddb/auto'`.

3. **Signal Protocol Store Abstract Contracts**:
   - In `node_modules/@signalapp/libsignal-client/dist/index.d.ts` (lines 259-305):
     - `IdentityKeyStore`: `getIdentityKey()`, `getLocalRegistrationId()`, `saveIdentity(name, key)`, `isTrustedIdentity(name, key, direction)`, `getIdentity(name)`.
     - `PreKeyStore`: `savePreKey(id, record)`, `getPreKey(id)`, `removePreKey(id)`.
     - `SignedPreKeyStore`: `saveSignedPreKey(id, record)`, `getSignedPreKey(id)`.
     - `SessionStore`: `saveSession(name, record)`, `getSession(name)`, `getExistingSessions(addresses)`.
     - `SenderKeyStore`: `saveSenderKey(sender, distributionId, record)`, `getSenderKey(sender, distributionId)`.

4. **Existing Legacy Store (`src/services/cryptoDbStore.ts`)**:
   - Currently implements legacy P-256 WebCrypto logic (`STORE_LOCAL_KEYS`, `STORE_CONVERSATIONS`, `skipped_message_keys`, DB_VERSION 26).
   - Needs replacement/overhaul to implement the 5 Signal Protocol abstract store interfaces backed by IndexedDB (`idb`) with multi-account namespacing and purge support.

---

## 2. Logic Chain

1. **Step 1 (Test Runner & Environment Fidelity)**: Vitest runs with `environment: 'node'`. In this environment, `@signalapp/libsignal-client` loads its native/WASM bindings. However, Node does not provide a native `indexedDB` global.
   *(Referencing Observation §1 and §2)*

2. **Step 2 (Mock Selection for Unit Tests)**: While the codebase contains a custom `mockIndexedDB.ts`, the installed `fake-indexeddb` (`^6.0.0`) provides full W3C IndexedDB conformance, guaranteeing that all `idb` library transactions, schema migrations, and cursor operations behave identically to a real browser.
   *(Referencing Observation §1 and §2)*

3. **Step 3 (Store API Mapping)**: To satisfy the libsignal engine and milestone requirements, `src/services/cryptoDbStore.ts` must implement all 5 abstract store classes from `@signalapp/libsignal-client`. Storage must serialize records directly to binary `Buffer`/`Uint8Array` to avoid JSON key distortion.
   *(Referencing Observation §3)*

4. **Step 4 (Test Suite Coverage Structure)**: A robust unit test suite (`tests/unit/cryptoDbStore.test.ts`) requires 8 discrete suites (42 test cases) covering:
   - Identity key generation, TOFU trust evaluation, and key replacement detection
   - PreKey storage, consumption/removal, and missing key rejection
   - SignedPreKey storage, signature validation, and multi-key listing
   - Session storage, state update roundtrips, and batch retrieval
   - SenderKey group session storage and distribution ID isolation
   - Multi-user account isolation (User A vs User B having identical numeric key IDs)
   - User-scoped and global database purges (`purgeCryptoVault`)
   - Boundary values (max numeric IDs, complex address names, concurrency)
   *(Referencing Observation §3 and §4)*

---

## 3. Caveats

- **Network / Remote Vault**: This analysis focuses strictly on the local IndexedDB storage adapter (`cryptoDbStore.ts`) and its unit tests. Remote server prekey sync (`prekeyVaultService.ts` and `/v2/crypto/prekeys`) belongs to Milestone 3.
- **Quantum / Kyber PreKeys**: `@signalapp/libsignal-client` contains `KyberPreKeyStore` for PQXDH. It is optional for Milestone 2 baseline Curve25519/X3DH Double Ratchet, but `cryptoDbStore.ts` can optionally stub or implement it for forward compatibility.
- **Read-Only Explorer Boundary**: In accordance with the Velum Master Agent Protocol, no codebase files have been modified. All architecture and test plans are documented in `analysis.md` and this handoff.

---

## 4. Conclusion

1. **Test Infrastructure**: Standardize on `fake-indexeddb/auto` for unit testing IndexedDB storage adapters.
2. **Store Design**: Implement `SignalProtocolStore` in `src/services/cryptoDbStore.ts` as a unified adapter implementing `IdentityKeyStore`, `PreKeyStore`, `SignedPreKeyStore`, `SessionStore`, and `SenderKeyStore`, parameterized by `localUserId`.
3. **Unit Test Suite**: Implement `tests/unit/cryptoDbStore.test.ts` with the 42-case test matrix specified in `analysis.md`, verifying all store methods, binary serialization, multi-account isolation, and database purges.

---

## 5. Verification Method

To independently verify the test configuration and validate the unit test suite once implemented:

1. **Verify Dependencies & Types**:
   Inspect `package.json` for `fake-indexeddb` and `@signalapp/libsignal-client`.
   Inspect `node_modules/@signalapp/libsignal-client/dist/index.d.ts` for store definitions.

2. **Execute Unit Tests**:
   Run Vitest against the unit test suite:
   ```bash
   npx vitest run tests/unit/cryptoDbStore.test.ts
   ```

3. **Verify Overall Test Suite & Build**:
   ```bash
   npm run test
   npm run build
   npm run lint
   ```

4. **Invalidation Conditions**:
   - Any test failure in `tests/unit/cryptoDbStore.test.ts`.
   - Any unhandled promise rejection during store record operations.
   - Key collisions between distinct user IDs in multi-account tests.
   - Failure of `purgeCryptoVault(userId)` to isolate deleted user data.
