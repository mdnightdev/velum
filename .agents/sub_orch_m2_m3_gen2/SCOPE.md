# Scope: Milestones 2 & 3 (Signal Protocol Store Adapter & Identity / Prekey Management)

## Architecture
- Client Storage: IndexedDB (`idb`) wrapping `@signalapp/libsignal-client` types and records under namespace `velum_signal_store_<userId>`.
- Client Key Generation: Curve25519 IdentityKey, PreKeys, SignedPreKey with Ed25519 signatures, Base64 bundle serialization/deserialization.
- Server Prekey Vault: Drizzle schema (`server/v2/db/schema/keys.ts`), atomic transactional prekey consumption and bundle fetching/publishing (`server/v2/services/crypto/prekeyVaultService.ts`), and API routes (`server/v2/routes/cryptoRoutes.ts`).

## Features
| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 1 | `src/services/cryptoDbStore.ts` | IdentityKeyStore, PreKeyStore, SignedPreKeyStore, SessionStore, SenderKeyStore, purgeCryptoVault | IN_PROGRESS |
| 2 | `src/services/signalKeyUtils.ts` | Curve25519 key gen, Ed25519 signed prekey signing, one-time prekeys, Base64 serialization | IN_PROGRESS |
| 3 | `server/v2/db/schema/keys.ts` | Schema for user_prekeys (registrationId, deviceId, signedPrekeyId, signedPrekey, signedPrekeySignature, identityKey, oneTimePrekeys) | IN_PROGRESS |
| 4 | `server/v2/services/crypto/prekeyVaultService.ts` | Atomic one-time prekey consumption, prekey bundle storage and retrieval | IN_PROGRESS |
| 5 | `server/v2/routes/cryptoRoutes.ts` | Endpoints for `/v2/crypto/prekeys` and `/v2/crypto/safety-number` | IN_PROGRESS |
| 6 | Unit & Integration Tests | Comprehensive vitest test suite for all stores, utilities, and server endpoints | IN_PROGRESS |

## Interface Contracts
### Client Store (`src/services/cryptoDbStore.ts`)
- Implements:
  - `IdentityKeyStore`: getIdentityKeyPair, getLocalRegistrationId, saveIdentity, isTrustedIdentity
  - `PreKeyStore`: getPreKey, savePreKey, removePreKey
  - `SignedPreKeyStore`: getSignedPreKey, saveSignedPreKey
  - `SessionStore`: getSession, saveSession
  - `SenderKeyStore`: getSenderKey, saveSenderKey
- Function `purgeCryptoVault(userId?: string): Promise<void>`
- Database name: `velum_signal_store_${localUserId}` or namespaced object stores

### Key Utils (`src/services/signalKeyUtils.ts`)
- Functions for generating complete prekey bundles, verifying signatures, converting keys/records to/from Base64/Uint8Array.

### Server API
- `POST /v2/crypto/prekeys`: publish bundle
- `GET /v2/crypto/prekeys/:userId`: fetch bundle and atomically consume one-time prekey
- `POST /v2/crypto/safety-number`: calculate/verify safety number
