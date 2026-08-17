# Handoff Report: Milestone 3 Test Specification & Interface Architecture

**Agent**: Explorer 3 (Specification Miner)  
**Milestone**: M3 — Identity & Prekey Bundle Management  
**Handoff Type**: Hard (Task complete)  
**Target Recipient**: Parent (`82da5259-8d41-4d16-88bd-19ef84d571a3`)  
**Date**: 2026-08-15  

---

## 1. Observation

1. **Test Runner & Environment**:
   - `vite.config.ts` (lines 24–28):
     ```typescript
     test: {
       globals: true,
       environment: 'node',
       testTimeout: 20000,
     }
     ```
   - `package.json` (lines 18, 27, 61, 66, 72):
     `"test": "vitest run"`, `@signalapp/libsignal-client` (`^0.62.0`), `fake-indexeddb` (`^6.0.0`), `supertest` (`^7.2.2`), `vitest` (`^4.1.9`).
2. **Signal Protocol Primitives**:
   - `node_modules/@signalapp/libsignal-client/dist/EcKeys.d.ts` (lines 3–33):
     `PublicKey.serialize(): Buffer` (33 bytes with 0x05 prefix), `PublicKey.verify(msg: Buffer, sig: Buffer): boolean`.
     `PrivateKey.sign(msg: Buffer): Buffer` (64-byte Ed25519 signature).
     `IdentityKeyPair.generate()`, `IdentityKeyPair.serialize()`, `IdentityKeyPair.deserialize(buffer: Buffer)`.
   - `node_modules/@signalapp/libsignal-client/dist/index.d.ts` (lines 89, 106, 117):
     `PreKeyBundle.new(registration_id: number, device_id: number, prekey_id: number | null, prekey: PublicKey | null, signed_prekey_id: number, signed_prekey: PublicKey, signed_prekey_signature: Buffer, identity_key: PublicKey)`
     `PreKeyRecord.new(id: number, pubKey: PublicKey, privKey: PrivateKey)`
     `SignedPreKeyRecord.new(id: number, timestamp: number, pubKey: PublicKey, privKey: PrivateKey, signature: Buffer)`
3. **Database Schema & Server Routes**:
   - `server/v2/db/schema/keys.ts` (lines 4–17): `userPrekeys` table with `userId`, `identityKey`, `signedPrekey`, `signedPrekeySignature`, `oneTimePrekeys`, `updatedAt`. Missing explicit `registrationId`, `deviceId`, `signedPrekeyId` columns or structured types.
   - `server/v2/services/crypto/prekeyVaultService.ts` (lines 13–101): `publishPrekeyBundle` and `fetchPrekeyBundle`. Currently shifts from string array and lacks explicit `SignalPrekeyBundleDTO` / `SignalPrekeyPublishDTO` adherence.
   - `server/v2/routes/cryptoRoutes.ts` (lines 30–69): Routes `POST /crypto/prekeys` and `GET /crypto/prekeys/:userId` mounted at `/v2` and `/api/v2` in `server/v2/app.ts` (lines 67–68).
   - `server/v2/routes/userRoutes.ts` (lines 35–102): Contains legacy un-migrated `/keys/prekey-bundle` endpoints that need consolidation.
   - Existing integration tests in `server/v2/tests/auth.test.ts` demonstrate `supertest(app)` testing against live Express routes with Bearer authentication.

---

## 2. Logic Chain

1. From Observation 1, the test infrastructure uses Vitest with `node` environment, resolving `@signalapp/libsignal-client` and `@neondatabase/serverless` / `pg` seamlessly.
2. From Observation 2, `@signalapp/libsignal-client` mandates 33-byte public keys (`0x05` prefix) and 64-byte Ed25519 signatures. Converting to Base64 requires standard 44-character strings for 33-byte keys and 88-character strings for 64-byte signatures.
3. From Observation 3, the database currently stores prekeys in `user_prekeys`, but needs alignment with the `SignalPrekeyPublishDTO` and `SignalPrekeyBundleDTO` contracts defined in `PROJECT.md` and `SCOPE.md`.
4. From Observations 2 and 3, when a client calls `GET /v2/crypto/prekeys/:userId`, the server must atomically pop one OTP from the user's pool, return `{ keyId, publicKey }`, and update the remaining pool in the database. If the pool is empty (0 OTPs remaining), the server must return `oneTimePrekey: null` and `oneTimePrekeysLeft: 0` without error, which is valid under X3DH specifications.
5. Therefore, a complete specification requires:
   - A client key management utility (`src/services/signalKeyUtils.ts`) covering generation, serialization, signature verification, and bundle assembly.
   - Server updates in `server/v2/db/schema/keys.ts`, `prekeyVaultService.ts`, and `cryptoRoutes.ts`.
   - Two comprehensive test suites: `tests/unit/signalKeyUtils.test.ts` (16 unit tests) and `server/v2/tests/cryptoPrekeys.test.ts` (14 integration tests).

---

## 3. Caveats

- In SQLite/Postgres test environments, concurrency tests must account for transaction isolation levels to prevent deadlocks when locking rows for update.
- Kyber post-quantum prekeys (`KyberPreKeyRecord`) are supported in `@signalapp/libsignal-client` v0.62.0 but are optional for M3 (standard Curve25519 X3DH prekeys are the required baseline per `ORIGINAL_REQUEST.md`).

---

## 4. Conclusion

The specification and test suite design for Milestone 3 (Identity & Prekey Bundle Management) is fully mapped and documented in `/root/velum/.agents/explorer_m3_3/analysis.md`. The design provides exact interface contracts for client key generation, Base64 serialization, signature verification, backend prekey storage, atomic single-use OTP consumption, empty-pool handling, and end-to-end integration tests.

---

## 5. Verification Method

To independently verify the findings and test definitions:
1. Inspect analysis document: `view_file` on `/root/velum/.agents/explorer_m3_3/analysis.md`.
2. Inspect schema and services: `view_file` on `server/v2/db/schema/keys.ts` and `server/v2/services/crypto/prekeyVaultService.ts`.
3. Verify test runner execution:
   `npx vitest run tests/unit/libsignal-primitives.test.ts`
   `npx vitest run tests/unit/libsignal-concurrency-bundler.test.ts`
