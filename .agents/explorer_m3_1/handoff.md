# Handoff Report: Milestone 3 Explorer 1 (Identity & Prekey Bundle Management)

## 1. Observation

1. **`@signalapp/libsignal-client` Exports & Key Classes**:
   - `node_modules/@signalapp/libsignal-client/dist/index.d.ts` (lines 5-6, 86-125):
     - `PrivateKey`: `PrivateKey.generate(): PrivateKey`, `priv.getPublicKey(): PublicKey`, `priv.serialize(): Buffer` (32 bytes), `priv.sign(msg: Buffer): Buffer` (64 bytes Ed25519 signature), `priv.agree(other_key: PublicKey): Buffer` (32 bytes X25519 DH).
     - `PublicKey`: `pub.serialize(): Buffer` (33 bytes with `0x05` prefix), `PublicKey.deserialize(buf: Buffer): PublicKey`, `pub.verify(msg: Buffer, sig: Buffer): boolean`.
     - `IdentityKeyPair`: `IdentityKeyPair.generate(): IdentityKeyPair`, `idPair.publicKey: PublicKey`, `idPair.privateKey: PrivateKey`, `idPair.serialize(): Buffer`, `IdentityKeyPair.deserialize(buf: Buffer): IdentityKeyPair`.
     - `SignedPreKeyRecord`: `SignedPreKeyRecord.new(id: number, timestamp: number, pubKey: PublicKey, privKey: PrivateKey, signature: Buffer): SignedPreKeyRecord`, `rec.serialize(): Buffer`, `SignedPreKeyRecord.deserialize(buf: Buffer): SignedPreKeyRecord`.
     - `PreKeyRecord`: `PreKeyRecord.new(id: number, pubKey: PublicKey, privKey: PrivateKey): PreKeyRecord`, `rec.serialize(): Buffer`, `PreKeyRecord.deserialize(buf: Buffer): PreKeyRecord`.
     - `PreKeyBundle`: `PreKeyBundle.new(registration_id: number, device_id: number, prekey_id: number | null, prekey: PublicKey | null, signed_prekey_id: number, signed_prekey: PublicKey, signed_prekey_signature: Buffer, identity_key: PublicKey, kyber_prekey_id?: number | null, kyber_prekey?: KEMPublicKey | null, kyber_prekey_signature?: Buffer | null): PreKeyBundle`.
2. **Existing Client Cryptographic Services**:
   - `src/services/cryptoDbStore.ts`: Currently uses WebCrypto P-256 with JWK storage in IndexedDB (`velum_crypto_vault`). M2 is upgrading this to direct `libsignal-client` abstract store implementations (`IndexedDbIdentityKeyStore`, `IndexedDbPreKeyStore`, `IndexedDbSignedPreKeyStore`, `IndexedDbKyberPreKeyStore`, `IndexedDbSessionStore`, `IndexedDbSenderKeyStore`).
   - `src/services/doubleRatchetService.ts`: Currently implements custom P-256 ECDH derivation (`x3dhHandshake`) and custom AES-GCM/HMAC packet wrapping. Calling `/v2/user/keys/prekey-bundle` and `/v2/user/:id/prekey-bundle`.
   - `server/v2/routes/cryptoRoutes.ts` & `server/v2/services/crypto/prekeyVaultService.ts`: Routes `POST /v2/crypto/prekeys` and `GET /v2/crypto/prekeys/:userId` exist, backed by PostgreSQL `user_prekeys` table (`server/v2/db/schema/keys.ts`).
3. **Existing Primitive Unit Tests**:
   - `tests/unit/libsignal-primitives.test.ts` confirms key generation, Protobuf serialization, Ed25519 signing/verification, and `PreKeyBundle` instantiation pass with the installed `@signalapp/libsignal-client` package.

---

## 2. Logic Chain

1. **Cryptographic Signing Contract**:
   - The Signal Protocol mandates that the long-term `IdentityKeyPair` signs the medium-term `SignedPreKey` public key to prevent MITM attacks during X3DH key exchange.
   - In `@signalapp/libsignal-client`, this is accomplished via `identityKeyPair.privateKey.sign(signedPreKeyPublic.serialize())`.
   - The signature is verified by `identityKeyPair.publicKey.verify(signedPreKeyPublic.serialize(), signature)`.
   - Both `SignedPreKeyRecord.new(...)` and `PreKeyBundle.new(...)` accept this 64-byte Ed25519 signature buffer.
2. **Wire-Format DTOs**:
   - The REST API communicates keys as Base64 strings.
   - Public keys are serialized via `PublicKey.serialize()` (33 bytes) -> Base64 (44 chars).
   - Signatures are 64 bytes -> Base64 (88 chars).
   - `SignalPrekeyPublishDTO` transmits `registrationId`, `deviceId`, `identityKey` (Base64), `signedPrekey` (`{ keyId, publicKey, signature }`), and `oneTimePrekeys` (`Array<{ keyId, publicKey }>`).
   - `SignalPrekeyBundleDTO` returns `registrationId`, `deviceId`, `identityKey`, `signedPrekeyId`, `signedPrekey`, `signedPrekeySignature`, and `oneTimePrekey: { keyId, publicKey } | null`.
3. **Client-Side Module Design**:
   - A dedicated module `src/services/signalKeyUtils.ts` encapsulates key generation (`generateClientPrekeys`), publish serialization (`serializePrekeysForPublish`), bundle deserialization (`deserializePreKeyBundle`), signature verification (`verifySignedPreKey`), and registration ID generation (`generateRegistrationId`).
   - This keeps cryptographic key management cleanly decoupled from transport routing and UI presentation.

---

## 3. Caveats

1. **Kyber Post-Quantum Prekeys**:
   - `@signalapp/libsignal-client` supports optional Kyber prekeys (`KEMKeyPair`, `KyberPreKeyRecord`). In `PreKeyBundle.new`, Kyber parameters are optional and can be set to `null`. Standard Curve25519 X3DH operates without Kyber.
2. **Buffer Compatibility**:
   - In browser environments, `Buffer` is polyfilled by Vite or backed by `Uint8Array`. The helper functions in `signalKeyUtils.ts` use isomorphic conversion (`btoa`/`atob` fallback) to guarantee compatibility across Node test runners and browser runtimes.

---

## 4. Conclusion

The exact API signatures and class structures for Signal Protocol key generation, signing, serialization, and prekey bundle management in `@signalapp/libsignal-client` have been fully investigated and specified in `/root/velum/.agents/explorer_m3_1/analysis.md`.

The proposed `src/services/signalKeyUtils.ts` utility satisfies all Milestone 3 requirements and integrates seamlessly with `cryptoDbStore.ts` and `prekeyVaultService.ts`.

---

## 5. Verification Method

To verify these findings and signatures:
1. Inspect `node_modules/@signalapp/libsignal-client/dist/index.d.ts` and `dist/EcKeys.d.ts`.
2. Run the existing primitive test suite:
   ```bash
   npx vitest run tests/unit/libsignal-primitives.test.ts
   ```
3. Verify that `PrivateKey.generate()`, `IdentityKeyPair.generate()`, `SignedPreKeyRecord.new()`, and `PreKeyBundle.new()` behave as documented.
