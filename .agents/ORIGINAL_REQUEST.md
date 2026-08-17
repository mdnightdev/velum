# Original User Request

## 2026-08-15T00:38:24Z

# Teamwork Project Prompt

> Requested team: Full team (Builds, Crypto Architecture, Storage Adapters, Testing)

Migrate Velum's end-to-end encryption (E2EE) layer from the custom WebCrypto/P-256 implementation to the official `@signalapp/libsignal-client` library (Curve25519/X25519, AES-256-GCM/CBC, HMAC-SHA256, and proper Signal Protocol sessions).

Working directory: `/root/velum`

## Requirements

### R1. Package & WASM Bundler Configuration
- Install and configure `@signalapp/libsignal-client` (or compatible web distribution).
- Ensure Vite, Rollup, and Node.js test runners properly resolve and instantiate the underlying WASM / native crypto modules without build or SSR breakage.

### R2. Signal Protocol Store Adapter (`cryptoDbStore.ts`)
- Implement the required Signal Protocol storage interfaces backed by IndexedDB (`idb`):
  - `IdentityKeyStore` (Local identity key pair, registration ID, trusted peer identities).
  - `PreKeyStore` (One-Time Prekeys generation, storage, removal).
  - `SignedPreKeyStore` (Signed Prekey generation, signature verification, rotation).
  - `SessionStore` (Record/session state serialization and deserialization per peer).
  - `SenderKeyStore` (if group/sublounge channels require Signal Sender Keys).

### R3. Identity & Prekey Bundle Management
- Generate standard Signal prekey bundles: Identity Key (X25519), Signed Prekey + Signature, One-Time Prekeys.
- Update `/api/tickets/prekeys` and `/api/tickets/bundle/:userId` backend endpoints / schemas if necessary to exchange Signal-compliant prekey bundles.

### R4. Message Encryption & Decryption Pipeline
- Replace `doubleRatchetService.ts` ratchet logic with `libsignal-client` session cipher (`SessionCipher.encrypt` and `SessionCipher.decrypt`).
- Maintain compatibility with Velum's offline queue, attachment encryption, and auto-heal / re-key fallback triggers.
- Ensure strict type safety and zero unhandled rejections during decryption.

### R5. Verification & Test Suite
- Provide unit and integration tests verifying:
  1. Successful identity creation and prekey bundle publish.
  2. Initial X3DH session establishment between two test users.
  3. Continuous bidirectional messaging without HMAC or ratchet desync.
  4. Out-of-order and skipped message handling.
- Verify `npm run build` and `npm run lint` pass without errors.

## Acceptance Criteria

### Automated Verification
- [ ] `npm run build` succeeds with zero WASM/bundler errors.
- [ ] Automated end-to-end test executes a simulated conversation between Alice and Bob with 10+ bidirectional messages and verifies 100% successful decryption.
- [ ] Key bundles uploaded to the backend conform strictly to Signal serialization format.

### Quality & Operational Safety
- [ ] Clean separation between protocol storage, crypto primitives, and UI messaging components.
- [ ] Graceful migration plan / clean state reset for existing local crypto IndexedDB databases.
