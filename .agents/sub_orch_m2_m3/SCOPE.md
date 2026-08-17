# Scope: Milestones 2 & 3 (Store Adapter & Prekey Bundle Management)

## Architecture
- **Client Storage Layer**: `src/services/cryptoDbStore.ts` implements libsignal-compatible storage adapters (`IdentityKeyStore`, `PreKeyStore`, `SignedPreKeyStore`, `SessionStore`, `SenderKeyStore`) backed by IndexedDB (`idb`), strictly namespaced by `${localUserId}` with purge capabilities (`purgeCryptoVault`).
- **Cryptographic Key Management**: Generation and serialization of Curve25519 identity keypairs, signed prekey records + Ed25519 signatures, and one-time prekeys (Base64 wire format).
- **Backend Key Vault & API**:
  - `server/v2/db/schema/keys.ts`: `user_prekeys` table schema supporting `registrationId`, `signedPrekeyId`, `signedPrekey`, `signedPrekeySignature`, `identityKey`, and `oneTimePrekeys` JSON/relational structure.
  - `server/v2/services/crypto/prekeyVaultService.ts`: Atomic bundle upload and consumption.
  - `server/v2/routes/cryptoRoutes.ts`: `/v2/crypto/prekeys` (POST/GET) endpoints for Signal-compliant prekey bundles. Consolidate any duplicate or legacy routes in `userRoutes.ts`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Signal Protocol Store Adapter | Implement `IdentityKeyStore`, `PreKeyStore`, `SignedPreKeyStore`, `SessionStore`, `SenderKeyStore` on IndexedDB in `src/services/cryptoDbStore.ts` | M2 | ORIGINAL_REQUEST §R2 |
| 2 | Storage Reset & Migration | Graceful clean reset / purge support via `purgeCryptoVault(userId?: string)` | M2 | ORIGINAL_REQUEST §R2, §AC |
| 3 | Key Generation & Prekey Bundles | Generate Curve25519 Identity, Signed Prekey + Ed25519 signature, One-Time Prekeys + Base64 serialization | M3 | ORIGINAL_REQUEST §R3 |
| 4 | Backend Prekey Vault & Schema | Update `server/v2/db/schema/keys.ts` (`user_prekeys`) and `server/v2/services/crypto/prekeyVaultService.ts` for registrationId and Signal bundles | M3 | ORIGINAL_REQUEST §R3 |
| 5 | Backend Bundle Exchange Routes | Update `server/v2/routes/cryptoRoutes.ts` & consolidate duplicate routes in `userRoutes.ts` | M3 | ORIGINAL_REQUEST §R3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M2 | Signal Protocol Store Adapter | IndexedDB Signal stores in `src/services/cryptoDbStore.ts` + `purgeCryptoVault` | M1 (WASM/libsignal configured) | IN_PROGRESS |
| M3 | Identity & Prekey Bundle Management | Key gen, serialization, `keys.ts` schema, `prekeyVaultService.ts`, `cryptoRoutes.ts` | M2 | IN_PROGRESS |

## Interface Contracts

### 1. Storage Adapter (`src/services/cryptoDbStore.ts`)
- `SignalProtocolStore` / store classes implementing:
  - `IdentityKeyStore`: `getIdentityKeyPair()`, `getLocalRegistrationId()`, `saveIdentity(address, key)`, `isTrustedIdentity(address, key, direction)`, `getIdentity(address)`
  - `PreKeyStore`: `savePreKey(keyId, keyRecord)`, `getPreKey(keyId)`, `removePreKey(keyId)`
  - `SignedPreKeyStore`: `saveSignedPreKey(keyId, keyRecord)`, `getSignedPreKey(keyId)`
  - `SessionStore`: `saveSession(address, sessionRecord)`, `getSession(address)`, `getExistingSessions(addresses)`
  - `SenderKeyStore`: `saveSenderKey(senderKeyName, senderKeyRecord)`, `getSenderKey(senderKeyName)`
- Reset method: `purgeCryptoVault(userId?: string): Promise<void>`

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

## Code Layout
- `src/services/cryptoDbStore.ts` - Client Signal Protocol storage adapter on IndexedDB.
- `server/v2/db/schema/keys.ts` - Database schema for user prekey bundles.
- `server/v2/services/crypto/prekeyVaultService.ts` - Server prekey vault management with atomic one-time prekey consumption.
- `server/v2/routes/cryptoRoutes.ts` - Prekey bundle exchange API routes.
- `server/v2/routes/userRoutes.ts` - User routes (consolidated to avoid duplicate endpoints).
