# Quality Review & Adversarial Challenge Report — Milestone 5 (Signal E2EE Verification)

## Review Summary

**Verdict**: REQUEST_CHANGES
**Overall Risk Assessment**: CRITICAL

---

## 1. Observation

### Observation 1: Incomplete Signal Protocol Migration in `src/services/doubleRatchetService.ts`
- **File**: `src/services/doubleRatchetService.ts`
- **Lines 1-5**:
  ```typescript
  /**
   * Signal-Protocol Compatible Double Ratchet E2EE Implementation
   * Implements X3DH initial handshake and Double Ratchet algorithm
   * Using Web Crypto API for cryptographic operations
   */
  ```
- **Lines 209-214**:
  ```typescript
  // Generate long-term identity key
  this.localIdentityKeyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  ```
- **Line 259**:
  ```typescript
  signedPrekeySignature: 'valid_sig_p256', // In production, use actual signature
  ```
- **Line 553**:
  ```typescript
  return `ratchet:v2:${JSON.stringify(envelope)}`;
  ```
- `doubleRatchetService.ts` does NOT import or utilize `@signalapp/libsignal-client` (`SessionCipher`, `signalEncrypt`, `signalDecrypt`, `signalDecryptPreKey`, `ProtocolAddress`, or `PreKeyBundle`).

### Observation 2: Broken TypeScript Module Imports from `src/services/cryptoDbStore.ts`
- **File**: `src/services/doubleRatchetService.ts`
- **Line 8**:
  ```typescript
  import { saveLocalKeysToDb, loadLocalKeysFromDb, saveConversationStateToDb, loadConversationStateFromDb, deleteConversationStateFromDb, closeCryptoDatabase } from './cryptoDbStore';
  ```
- **File**: `tests/e2e/e2ee-protocol-tiers.test.ts`
- **Lines 23-30**:
  ```typescript
  import {
    openCryptoDatabaseV2,
    saveLocalKeysToDb,
    loadLocalKeysFromDb,
    saveConversationStateToDb,
    loadConversationStateFromDb,
    deleteConversationStateFromDb,
    purgeCryptoVault
  } from '../../src/services/cryptoDbStore';
  ```
- **File**: `tests/e2e/e2ee-signal.test.ts`
- **Line 33**:
  ```typescript
  import { loadConversationStateFromDb, loadLocalKeysFromDb } from '../../src/services/cryptoDbStore';
  ```
- **File**: `src/services/cryptoDbStore.ts` (Lines 1-479):
  `saveLocalKeysToDb`, `loadLocalKeysFromDb`, `saveConversationStateToDb`, `loadConversationStateFromDb`, `deleteConversationStateFromDb`, and `openCryptoDatabaseV2` do not exist in `src/services/cryptoDbStore.ts`. The exported members are `IndexedDbIdentityKeyStore`, `IndexedDbPreKeyStore`, `IndexedDbSignedPreKeyStore`, `IndexedDbKyberPreKeyStore`, `IndexedDbSessionStore`, `IndexedDbSenderKeyStore`, `SignalProtocolStore`, `getSignalProtocolStore`, `purgeCryptoVault`, `openCryptoDatabase`, `closeCryptoDatabase`, `saveLocalVaultKeyToDb`, and `loadLocalVaultKeyFromDb`.

### Observation 3: IndexedDB Schema Version & Store Conflict
- **File**: `src/services/skippedKeysStore.ts`
- **Lines 1-3**:
  ```typescript
  const DB_NAME = 'velum_crypto_vault';
  const DB_VERSION = 26; // Match cryptoDbStore version
  const STORE_SKIPPED_KEYS = 'skipped_message_keys';
  ```
- **File**: `src/services/cryptoDbStore.ts`
- **Lines 27-28 & 67-72**:
  ```typescript
  export const DB_NAME = 'velum_crypto_vault';
  export const DB_VERSION = 30;
  ...
  // Clean up legacy P-256 stores if upgrading from older schema
  const legacyStores = ['local_keys', 'conversation_states', 'skipped_message_keys'];
  for (const legacy of legacyStores) {
    if (db.objectStoreNames.contains(legacy)) {
      db.deleteObjectStore(legacy);
    }
  }
  ```

### Observation 4: Non-strict Type Annotations (`any`) in Backend Prekey Vault Service
- **File**: `server/v2/services/crypto/prekeyVaultService.ts`
- **Line 18**: `oneTimePrekeys?: any[] | string;`
- **Lines 108-109**: `typeof (query as any).for === 'function'`, `[record] = await (query as any).for('update');`
- **Line 123**: `let pool: any[] = [];`
- **Line 137**: `const rawOtp = pool.shift();`

### Observation 5: E2E Test Suite Encapsulation Mismatch
- **Files**: `tests/e2e/e2ee-signal.test.ts` and `tests/e2e/e2ee-protocol-tiers.test.ts`
- The E2E test harness (`tests/e2e/helpers/testEnv.ts` line 7, 26, 184) exercises `doubleRatchetService.encryptDirectMessage` and `doubleRatchetService.decryptDirectMessage`. Because `doubleRatchetService.ts` was not upgraded to `@signalapp/libsignal-client`, the 95 E2E tests execute against the legacy WebCrypto P-256 implementation rather than `@signalapp/libsignal-client` `SessionCipher`.

---

## 2. Logic Chain

1. **Premise 1**: Requirement R4 (`ORIGINAL_REQUEST.md`) and Feature 6 (`PROJECT.md`) mandate: *"Replace `doubleRatchetService.ts` ratchet logic with `libsignal-client` session cipher (`SessionCipher.encrypt` and `SessionCipher.decrypt`)."*
2. **Premise 2**: Direct inspection of `src/services/doubleRatchetService.ts` (Observation 1) shows that the service is still running the legacy WebCrypto ECDH P-256, custom HKDF, and hardcoded dummy signatures (`'valid_sig_p256'`), and has not integrated `@signalapp/libsignal-client`.
3. **Premise 3**: While `cryptoDbStore.ts` (M2) and `signalKeyUtils.ts` (M3) correctly implement the `@signalapp/libsignal-client` store adapters and bundle serializers, the runtime messaging pipeline (`doubleRatchetService.ts` and `encryptionService.ts`) does not consume them.
4. **Premise 4**: Direct inspection of imports across `doubleRatchetService.ts`, `e2ee-signal.test.ts`, and `e2ee-protocol-tiers.test.ts` (Observation 2) shows that they import functions (`saveLocalKeysToDb`, `loadLocalKeysFromDb`, `saveConversationStateToDb`, `loadConversationStateFromDb`, `deleteConversationStateFromDb`) that were removed from `cryptoDbStore.ts` during M2 refactoring.
5. **Premise 5**: This causes TypeScript type-checking / linting (`tsc --noEmit` / `npm run lint`) to fail with TS2305 missing export errors.
6. **Premise 6**: The E2E tests in `tests/e2e/` (Observation 5) test the legacy P-256 ratchet rather than `@signalapp/libsignal-client`, meaning real Signal Protocol message encryption/decryption is unverified in end-to-end multi-turn scenarios.
7. **Conclusion**: The codebase has critical discrepancies between the declared Signal Protocol architecture (M2/M3) and the actual messaging pipeline (M4/M5), preventing build/lint passing and failing requirement R4.

---

## 3. Findings & Required Remediations

### [Critical] Finding 1: INTEGRITY VIOLATION / INCOMPLETE MIGRATION — `doubleRatchetService.ts` retains legacy WebCrypto P-256 (R4)
- **What**: `src/services/doubleRatchetService.ts` contains legacy P-256 WebCrypto code with dummy signatures (`'valid_sig_p256'`) instead of `@signalapp/libsignal-client` (`signalEncrypt`, `signalDecrypt`, `signalDecryptPreKey`, `SessionCipher`, `SessionRecord`).
- **Where**: `src/services/doubleRatchetService.ts:1-795`, `src/services/encryptionService.ts:63-130`.
- **Why**: Bypasses the required `@signalapp/libsignal-client` engine. Signal Protocol stores in `cryptoDbStore.ts` are unused during actual messaging.
- **Suggestion**: Re-implement `doubleRatchetService.ts` (or replace with `signalSessionService.ts`) to use `signalEncrypt`, `signalDecrypt`, and `signalDecryptPreKey` from `@signalapp/libsignal-client` backed by `getSignalProtocolStore(localUserId)`.

### [Critical] Finding 2: COMPILATION / LINT ERROR — Missing exports from `cryptoDbStore.ts`
- **What**: Import failures in `src/services/doubleRatchetService.ts`, `tests/e2e/e2ee-protocol-tiers.test.ts`, and `tests/e2e/e2ee-signal.test.ts` due to removed functions in `src/services/cryptoDbStore.ts`.
- **Where**: `src/services/doubleRatchetService.ts:8`, `tests/e2e/e2ee-protocol-tiers.test.ts:23-30`, `tests/e2e/e2ee-signal.test.ts:33`.
- **Why**: `tsc --noEmit` will fail on TS2305.
- **Suggestion**: Update `doubleRatchetService.ts` and test suites to interact with `getSignalProtocolStore(localUserId)` and remove references to legacy database methods.

### [Major] Finding 3: DATABASE CONFLICT — `skippedKeysStore.ts` version mismatch with `cryptoDbStore.ts`
- **What**: `skippedKeysStore.ts` references `DB_VERSION = 26` and store `skipped_message_keys`, which is dropped in `cryptoDbStore.ts` v30 upgrade.
- **Where**: `src/services/skippedKeysStore.ts:1-3`, `src/services/cryptoDbStore.ts:27-28, 67-72`.
- **Why**: Causes IndexedDB version errors. In Signal Protocol, skipped keys are stored inside `SessionRecord` records in `STORE_SESSIONS`.
- **Suggestion**: Deprecate `skippedKeysStore.ts` in favor of `@signalapp/libsignal-client` session persistence.

### [Major] Finding 4: TYPE SAFETY — Unconstrained `any` types in backend service
- **What**: `server/v2/services/crypto/prekeyVaultService.ts` uses `any[] | string` and `(query as any)` casts.
- **Where**: `server/v2/services/crypto/prekeyVaultService.ts` lines 18, 108-109, 123.
- **Why**: Violates strict type safety conventions.
- **Suggestion**: Use typed `OneTimePrekeyItem[]` and proper Drizzle query types.

---

## 4. Caveats

- Unit test suite `tests/unit/libsignal-primitives.test.ts` accurately tests `@signalapp/libsignal-client` primitives in isolation.
- `src/services/cryptoDbStore.ts` and `src/services/signalKeyUtils.ts` are well-written and correctly implement `@signalapp/libsignal-client` contracts. The break is in their integration with the upper messaging and ratchet layers (`doubleRatchetService.ts`, `encryptionService.ts`, and `tests/e2e/`).

---

## 5. Conclusion

Verdict is **REQUEST_CHANGES**.
The implementation of Milestone 2 (`cryptoDbStore.ts`) and Milestone 3 (`signalKeyUtils.ts`, `prekeyVaultService.ts`, `cryptoRoutes.ts`) is structurally sound, but Milestone 4 (`doubleRatchetService.ts` migration to `SessionCipher`) remains incomplete and retains legacy P-256 logic with broken module imports.

---

## 6. Verification Method

To verify these findings independently:
1. Inspect `src/services/doubleRatchetService.ts` line 8 and check against `src/services/cryptoDbStore.ts` export declarations to verify TS2305 missing export errors.
2. Inspect `src/services/doubleRatchetService.ts` lines 209-214 and 259 to verify the presence of WebCrypto P-256 and `'valid_sig_p256'` dummy signature string.
3. Inspect `tests/e2e/helpers/testEnv.ts` lines 7 and 184 to confirm that the E2E test suite executes the legacy `doubleRatchetService` rather than `@signalapp/libsignal-client`.
4. Invalidation condition: If `doubleRatchetService.ts` is rewritten with `signalEncrypt`/`signalDecrypt` using `SignalProtocolStore`, imports are resolved, and E2E tests verify libsignal session cipher directly with 0 TypeScript/lint errors, this verdict will be updated to APPROVE.
