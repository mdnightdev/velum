# Handoff Report: Specification & Dependency Mining for `@signalapp/libsignal-client` Migration

**Agent**: `survey_spec_miner_2`  
**Working Directory**: `/root/velum/.agents/survey_spec_miner_2/`  
**Report Artifact**: `/root/velum/.agents/survey_spec_miner_2/report.md`  
**Recipient**: Parent (`539de353-74bf-41f6-aece-2f48dda312b6`)

---

## 1. Observation

1. **Repository Toolchain & Configuration**:
   - `package.json`: Vite `^8.1.3`, Vitest `^4.1.9`, TypeScript `^5.4.5`, `idb` `^8.0.3`, `hash-wasm` `^4.11.0`, Drizzle ORM `^0.45.2`.
   - `vite.config.ts`: React + TailwindCSS plugins; aliased `@` -> `/src`; manual vendor chunking in Rollup.
   - `tsconfig.json`: `"target": "ES2022"`, `"module": "ESNext"`, `"moduleResolution": "bundler"`, `"skipLibCheck": true`.
2. **Current Crypto Architecture**:
   - `src/services/cryptoDbStore.ts`: Custom IndexedDB key/state store using WebCrypto JWKs.
   - `src/services/doubleRatchetService.ts`: Custom P-256 Double Ratchet implementation with SHA-256 checksums and custom state serialization.
   - `src/services/encryptionService.ts`: Routes direct messages through `doubleRatchetService` (`ratchet:v2:` prefix) and room messages through XOR `VEL_E2EE[...]`.
   - `server/v2/routes/cryptoRoutes.ts` & `prekeyVaultService.ts`: Stores prekey bundles in PostgreSQL `user_prekeys` table (`userId`, `identityKey`, `signedPrekey`, `signedPrekeySignature`, `oneTimePrekeys`).
3. **`@signalapp/libsignal-client` Specification Mined**:
   - Authoritative package version: `0.101.0` (ESM module with prebuilt native `.node` binaries for Darwin/Linux/Windows ARM64/x64).
   - Core Abstract Stores: `IdentityKeyStore`, `PreKeyStore`, `SignedPreKeyStore`, `SessionStore`, `SenderKeyStore`, `KyberPreKeyStore`.
   - Core Protocol Functions: `processPreKeyBundle`, `signalEncrypt`, `signalDecrypt`, `signalDecryptPreKey`, `groupEncrypt`, `groupDecrypt`.
   - Key & Record Types: `IdentityKeyPair`, `PrivateKey`, `PublicKey`, `PreKeyRecord`, `SignedPreKeyRecord`, `SessionRecord`, `SenderKeyRecord`, `ProtocolAddress`, `PreKeyBundle`.
   - Cryptographic Formats: Curve25519 public keys serialize to 33-byte `Uint8Array` (0x05 prefix), private keys to 32 bytes, signatures to 64 bytes.

---

## 2. Logic Chain

1. **From Package Analysis to Runtime Strategy**:
   - Observation: `@signalapp/libsignal-client` distributes precompiled `.node` native addons for Node.js environments and TypeScript declarations in `dist/index.d.ts`.
   - Inference: In Node.js (backend, CLI, Vitest), native prebuilds execute directly. In browser frontend environments (Vite), native modules cannot execute directly and require WASM compilation or an appropriate bundler loader.
2. **From Store Contracts to IndexedDB Adapter Design**:
   - Observation: The protocol functions require concrete classes implementing `IdentityKeyStore`, `PreKeyStore`, `SignedPreKeyStore`, and `SessionStore`.
   - Inference: `src/services/cryptoDbStore.ts` can be rewritten to implement these exact abstract classes using `idb`, storing serialized `Uint8Array` binary records keyed by `${localUserId}_${address}` and key IDs.
3. **From Key Serialization to Backend Schema Compatibility**:
   - Observation: All Signal protocol keys and messages serialize to `Uint8Array` (binary/protobuf format).
   - Inference: HTTP transmission over `/v2/crypto/prekeys` and `/v2/crypto/prekeys/:userId` should encode `Uint8Array` bytes to standard Base64 strings. The existing `user_prekeys` table schema (`identity_key text`, `signed_prekey text`, `signed_prekey_signature text`, `one_time_prekeys text`) can store these Base64 representations without requiring disruptive schema alterations.

---

## 3. Caveats

1. **WASM vs Native Execution**: `@signalapp/libsignal-client` is published with Node.js native prebuilds; browser deployment requires either the WASM web build / bundler configuration or ensuring tests run in Node/Vitest while client interfaces are polyfilled.
2. **Backward Compatibility / Database Reset**: Changing from WebCrypto P-256 JWKs to Signal Curve25519 protobuf records is a breaking storage migration; existing client IndexedDB stores (`velum_crypto_vault`) will require a clean version bump and key reset.
3. **No Caveats on API Completeness**: All TypeScript types, method parameters, and error types have been mined directly from authoritative definition files.

---

## 4. Conclusion

The specification mining for `@signalapp/libsignal-client` integration is complete and documented in `/root/velum/.agents/survey_spec_miner_2/report.md`. The exact store interfaces, serialization rules, and encryption pipelines are mapped and ready for subsequent implementation phases.

---

## 5. Verification Method

To independently verify these findings:
1. Inspect the comprehensive report:
   ```bash
   cat /root/velum/.agents/survey_spec_miner_2/report.md
   ```
2. Verify `@signalapp/libsignal-client` definitions on npm:
   ```bash
   curl -s https://unpkg.com/@signalapp/libsignal-client@0.101.0/dist/index.d.ts | head -n 40
   ```
3. Inspect the current codebase configuration:
   - `package.json`, `vite.config.ts`, `tsconfig.json`
   - `src/services/cryptoDbStore.ts`, `src/services/doubleRatchetService.ts`, `server/v2/routes/cryptoRoutes.ts`
