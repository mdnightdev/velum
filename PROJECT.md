# Project: Velum E2EE Migration to @signalapp/libsignal-client

## Architecture
- **Cryptographic Engine**: `@signalapp/libsignal-client` (Curve25519/X25519, AES-256-GCM/CBC, HMAC-SHA256, Ed25519 signatures, Signal Double Ratchet & X3DH).
- **Storage Subsystem**: IndexedDB via `idb` implementing abstract Signal store contracts (`IdentityKeyStore`, `PreKeyStore`, `SignedPreKeyStore`, `SessionStore`, `SenderKeyStore`), namespaced by `${localUserId}`.
- **Key Distribution**: Server-side prekey vault (`server/v2/services/crypto/prekeyVaultService.ts`) managing PostgreSQL `user_prekeys` with atomic one-time prekey consumption.
- **Messaging Integration**: Transparent encryption and decryption behind `src/services/encryptionService.ts` and `src/services/doubleRatchetService.ts`, fully preserving UI component contracts, offline outbox queuing (`outboxEngine.ts`), and media attachments.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Package & WASM Configuration | Setup `@signalapp/libsignal-client` and configure Vite / Rollup / Vitest bundler resolution | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Signal Protocol Store Adapter | Implement `IdentityKeyStore`, `PreKeyStore`, `SignedPreKeyStore`, `SessionStore`, `SenderKeyStore` on IndexedDB | M2 | ORIGINAL_REQUEST §R2 |
| 3 | Storage Reset & Migration | Graceful clean reset / schema version upgrade for `velum_crypto_vault` | M2 | ORIGINAL_REQUEST §R2, §AC |
| 4 | Key Generation & Prekey Bundles | Generate Curve25519 Identity, Signed Prekey + Ed25519 signature, One-Time Prekeys | M3 | ORIGINAL_REQUEST §R3 |
| 5 | Backend Bundle Exchange Routes | Update `server/v2/routes/cryptoRoutes.ts` & `prekeyVaultService.ts` for registrationId and Signal bundles | M3 | ORIGINAL_REQUEST §R3 |
| 6 | Session Cipher & Ratchet Pipeline | Replace custom P-256 ratchet with `signalEncrypt`, `signalDecrypt`, `signalDecryptPreKey` in `doubleRatchetService.ts` | M4 | ORIGINAL_REQUEST §R4 |
| 7 | Offline Queue & Attachment Safety | Ensure `outboxEngine.ts` offline queues and media string embeddings operate seamlessly with Signal ciphertext | M4 | ORIGINAL_REQUEST §R4 |
| 8 | Auto-heal & Rekey Fallback | Ensure decryption failure detection cleanly triggers bundle re-fetch and session re-establishment | M4 | ORIGINAL_REQUEST §R4 |
| 9 | Multi-turn E2E Test Suite | Comprehensive simulated Alice-Bob conversations, out-of-order delivery, skipped keys, and ratchet desync tests | M5 | ORIGINAL_REQUEST §R5 |
| 10 | Build & Lint Validation | Zero WASM/bundler errors on `npm run build` and `npm run lint` | M5 | ORIGINAL_REQUEST §R5, §AC |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Package & WASM Bundler Configuration | Install `@signalapp/libsignal-client`, configure Vite / Rollup / Vitest bundler & WASM resolution, register test script | none | IN_PROGRESS |
| M2 | Signal Protocol Store Adapter | Implement `cryptoDbStore.ts` Signal stores (`IdentityKeyStore`, `PreKeyStore`, `SignedPreKeyStore`, `SessionStore`, `SenderKeyStore`) and vault reset | M1 | IN_PROGRESS |
| M3 | Identity & Prekey Bundle Management | Key generation, serialization (Base64), backend `user_prekeys` schema & `prekeyVaultService.ts` / `cryptoRoutes.ts` updates | M1, M2 | IN_PROGRESS |
| M4 | Message Pipeline & Session Cipher | `doubleRatchetService.ts` & `encryptionService.ts` integration with `SessionCipher`, offline queue, auto-heal | M2, M3 | PLANNED |
| M5 | E2E Test Pass & Adversarial Hardening | Pass 100% E2E test suite (Tiers 1-4), adversarial test hardening (Tier 5), lint & build verification | M4, E2E Track | PLANNED |

## Interface Contracts

### 1. Storage Adapter (`src/services/cryptoDbStore.ts`)
- `SignalProtocolStore`: implements `IdentityKeyStore`, `PreKeyStore`, `SignedPreKeyStore`, `SessionStore`, `SenderKeyStore`.
- Key lookup format: `${userId}_${deviceId}` for session records; numerical `keyId` for prekeys and signed prekeys.
- Clear/Purge API: `purgeCryptoVault(userId?: string): Promise<void>` cleans local stores upon logout or identity invalidation.

### 2. Backend Prekey Bundle Payload (`/v2/crypto/prekeys`)
```typescript
interface SignalPrekeyBundleDTO {
  userId: number;
  registrationId: number;
  deviceId: number;
  identityKey: string;           // Base64 (33 bytes)
  signedPrekeyId: number;        // integer
  signedPrekey: string;          // Base64 (33 bytes)
  signedPrekeySignature: string; // Base64 (64 bytes)
  oneTimePrekey?: {
    keyId: number;
    publicKey: string;           // Base64 (33 bytes)
  } | null;
  oneTimePrekeysLeft?: number;
}
```

### 3. Encryption Service (`src/services/encryptionService.ts`)
- Envelope format: `signal:v1:${messageType}:${base64Ciphertext}` or `ratchet:v3:${messageType}:${base64Ciphertext}`.
- Public method signatures:
  - `encryptMessage(recipientId: string | number, plaintext: string, options?: EncryptOptions): Promise<string>`
  - `decryptMessage(senderId: string | number, envelope: string): Promise<string>`

## Code Layout
- `src/services/cryptoDbStore.ts` - Signal Protocol storage adapter on IndexedDB.
- `src/services/doubleRatchetService.ts` - Signal session manager, X3DH handshake, and cipher wrapper.
- `src/services/encryptionService.ts` - Top-level encryption routing and error-handling facade.
- `src/services/skippedKeysStore.ts` - Auxiliary storage cleanup or legacy deprecation.
- `server/v2/routes/cryptoRoutes.ts` - Express routes for Signal prekey bundle upload and retrieval.
- `server/v2/services/crypto/prekeyVaultService.ts` - Server-side atomic prekey store service.
- `server/v2/db/schema/keys.ts` - Drizzle PostgreSQL schema for user prekeys.
- `tests/e2e/e2ee-signal.test.ts` - End-to-end integration and conversation simulation test suite.
