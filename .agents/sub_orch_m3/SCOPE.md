# Scope: Milestone 3 — Identity & Prekey Bundle Management

## Objectives
1. Client-Side Key Generation & Serialization:
   - Key generation utilities using `@signalapp/libsignal-client`:
     - IdentityKeyPair (Curve25519)
     - Registration ID (integer)
     - SignedPreKeyRecord (keyId, KeyPair Curve25519, Ed25519 signature generated with IdentityKey)
     - PreKeyRecord (One-Time Prekeys pool)
   - Serialization and deserialization to/from Base64 strings for REST API transmission according to SignalPrekeyBundleDTO.
2. Backend Prekey Storage & Exchange:
   - `server/v2/db/schema/keys.ts`: Update `user_prekeys` table schema to store registration ID, signed prekey (ID, public key, signature), and structured one-time prekeys pool (array/JSONB).
   - `server/v2/services/crypto/prekeyVaultService.ts`: Implement atomic prekey bundle publishing and one-time prekey consumption (`pool.shift()` / atomic pop).
   - `server/v2/routes/cryptoRoutes.ts`: Standard Express endpoints `/v2/crypto/prekeys` (POST to publish) and `/v2/crypto/prekeys/:userId` (GET to fetch prekey bundle with single one-time prekey). Consolidate any duplicate routes in `userRoutes.ts` or `routes/tickets.ts`.
3. Unit and Integration Tests:
   - Unit tests for key generation, signing, signature verification, and Base64 serialization/deserialization.
   - Integration tests for bundle upload and atomic one-time prekey consumption on the backend.

## Architecture & Interface Contracts

### Backend Prekey Bundle DTO (`SignalPrekeyBundleDTO`)
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

### Prekey Bundle Publish Payload (`SignalPrekeyPublishDTO`)
```typescript
interface SignalPrekeyPublishDTO {
  registrationId: number;
  deviceId: number;
  identityKey: string;           // Base64 public key
  signedPrekey: {
    keyId: number;
    publicKey: string;           // Base64 public key
    signature: string;           // Base64 signature
  };
  oneTimePrekeys: Array<{
    keyId: number;
    publicKey: string;           // Base64 public key
  }>;
}
```

## Code Layout Ownership
- `src/services/signalKeyUtils.ts` (or `src/services/keyManagement.ts`): Client key generation and serialization
- `server/v2/db/schema/keys.ts`: Database schema definition
- `server/v2/services/crypto/prekeyVaultService.ts`: Server-side service
- `server/v2/routes/cryptoRoutes.ts`: REST endpoints
- `tests/unit/signalKeys.test.ts` (or similar): Unit tests
- `tests/integration/prekeyVault.test.ts` (or similar): Integration tests
