# Technical Specification & Test Architecture: Milestone 3 (Identity & Prekey Bundle Management)

**Explorer**: Explorer 3 (Specification Miner & Test Infrastructure Analyst)  
**Milestone**: M3 — Identity & Prekey Bundle Management  
**Working Directory**: `/root/velum/.agents/explorer_m3_3`  
**Date**: 2026-08-15  

---

## 1. Executive Summary & Specification Sources

This document defines the cryptographic specification, API contracts, data transfer objects (DTOs), database schema updates, and comprehensive test suite design for Milestone 3 (M3).

### Specification Sources
1. `ORIGINAL_REQUEST.md` (§R3: Identity & Prekey Bundle Management, §R5: Verification & Test Suite, §AC: Acceptance Criteria).
2. `PROJECT.md` (§Interface Contracts #2: Backend Prekey Bundle Payload, §Code Layout).
3. `SCOPE.md` (Milestone 3 Sub-Orchestrator Scope & Interface Contracts).
4. `@signalapp/libsignal-client` TypeScript Type Definitions (`node_modules/@signalapp/libsignal-client/dist/index.d.ts`, `EcKeys.d.ts`).
5. Existing Test Suites (`tests/unit/libsignal-primitives.test.ts`, `tests/unit/libsignal-concurrency-bundler.test.ts`, `server/v2/tests/`).

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Client Keygen | Identity Key Pair Generation | Generates Curve25519 identity key pair (33-byte public key with 0x05 prefix, 32-byte private key) | None | `IdentityKeyPair` instance | Throws if crypto RNG fails | `@signalapp/libsignal-client` EcKeys |
| 2 | Client Keygen | Registration ID Generation | Generates random 32-bit positive integer (uint32 / 1..2147483647 or 1..16380) | None (optional max range) | `number` | Returns valid positive integer | Signal Protocol standard |
| 3 | Client Keygen | Signed PreKey Generation | Generates ephemeral Curve25519 key pair, signs serialized public key with Identity private key, and wraps into record | `identityKeyPair: IdentityKeyPair`, `keyId: number`, `timestamp?: number` | `SignedPreKeyRecord` instance with 64-byte Ed25519 signature | Throws on invalid keyId or signing error | `@signalapp/libsignal-client` SignedPreKeyRecord |
| 4 | Client Keygen | One-Time Prekey (OTP) Pool Generation | Generates array of `count` ephemeral Curve25519 key pairs starting at `startKeyId` | `startKeyId: number`, `count: number` | `PreKeyRecord[]` array | Throws if count < 0 or invalid keyId | `@signalapp/libsignal-client` PreKeyRecord |
| 5 | Crypto Verification | Signed PreKey Signature Verification | Verifies 64-byte Ed25519 signature on signed prekey public key using identity public key | `identityPubKey: PublicKey`, `signedPreKeyPub: PublicKey`, `signature: Buffer/Uint8Array` | `boolean` (true if valid) | Returns false on bit-flip, tampering, or key mismatch | `PublicKey.verify()` in libsignal-client |
| 6 | Serialization | Client Publish Payload Serialization | Formats identity key, signed prekey + signature, and OTP pool into Base64 strings matching `SignalPrekeyPublishDTO` | `registrationId: number`, `deviceId: number`, `identityKeyPair: IdentityKeyPair`, `signedPreKey: SignedPreKeyRecord`, `oneTimePrekeys: PreKeyRecord[]` | `SignalPrekeyPublishDTO` object | Throws if key records are missing or corrupted | M3 SCOPE.md & PROJECT.md |
| 7 | Deserialization | Server Bundle DTO to PreKeyBundle | Deserializes `SignalPrekeyBundleDTO` Base64 fields into libsignal `PreKeyBundle` for X3DH agreement | `bundleDto: SignalPrekeyBundleDTO` | `PreKeyBundle` instance | Throws on malformed Base64 or invalid key lengths | `@signalapp/libsignal-client` PreKeyBundle.new |
| 8 | Backend Schema | Prekeys Storage Schema (`user_prekeys`) | PostgreSQL schema storing user identity, registration ID, device ID, signed prekey, signature, and OTP JSON array | User prekey record data | `user_prekeys` table row | Database constraint violation on duplicate userId | `server/v2/db/schema/keys.ts` |
| 9 | Backend Service | Prekey Bundle Publishing | Upserts user prekeys row with identity key, registrationId, deviceId, signed prekey, signature, and OTP pool | `userId: number`, `bundle: SignalPrekeyPublishDTO` | `Promise<void>` | Rejects on invalid fields or DB error | `server/v2/services/crypto/prekeyVaultService.ts` |
| 10 | Backend Service | Atomic OTP Consumption | Fetches bundle and pops 1 OTP from pool atomically in database; returns bundle with single OTP and remaining count | `targetUserId: number` | `Promise<SignalPrekeyBundleDTO \| null>` | Returns null if user record not found | `prekeyVaultService.ts` |
| 11 | Backend Service | Depleted OTP Pool Handling | When user's OTP pool is empty (0 OTPs), returns bundle with `oneTimePrekey: null` and `oneTimePrekeysLeft: 0` without failing | `targetUserId: number` | `Promise<SignalPrekeyBundleDTO>` (with `oneTimePrekey: null`) | Non-fatal; valid X3DH bundle without OTP | `prekeyVaultService.ts` & Signal X3DH spec |
| 12 | Backend Route | `POST /v2/crypto/prekeys` | Express authenticated endpoint for clients to publish/rotate prekey bundles | HTTP POST with Bearer token & `SignalPrekeyPublishDTO` body | HTTP 200 `{ status: 'ok', message: '...' }` | 401 Unauthorized, 400 Bad Request | `server/v2/routes/cryptoRoutes.ts` |
| 13 | Backend Route | `GET /v2/crypto/prekeys/:userId` | Express authenticated endpoint to fetch prekey bundle for session initiation with single-use OTP | HTTP GET with Bearer token & `:userId` param | HTTP 200 `{ status: 'ok', bundle: SignalPrekeyBundleDTO }` | 401 Unauthorized, 400 Bad Request, 404 Not Found | `server/v2/routes/cryptoRoutes.ts` |
| 14 | Identity Verification | Safety Number Fingerprint Generation | Generates 6-block 5-digit decimal string from two public identity keys for out-of-band verification | `identityKeyA: string`, `identityKeyB: string` (Base64) | `string` (e.g. `12345 67890 12345 67890 12345 67890`) | Symmetric across key order; throws if keys empty | `prekeyVaultService.generateSafetyNumber` |

---

## 3. Edge Cases & Observed Behaviors

| # | Feature | Input / Scenario | Observed / Required Behavior |
|---|---------|------------------|------------------------------|
| E1 | Client Keygen | Generating OTP pool with `count = 0` | Returns empty array `[]`; valid for clients operating without one-time prekeys. |
| E2 | Client Keygen | Large OTP pool generation (`count = 100`) | Successfully generates 100 unique `PreKeyRecord` instances with zero key collisions. |
| E3 | Signature Verification | Single-bit flipped in signed prekey public key | `identityKey.verify()` returns `false` strictly, preventing MITM public key substitution. |
| E4 | Signature Verification | Corrupted 64-byte signature (1 bit altered) | `identityKey.verify()` returns `false`. |
| E5 | Signature Verification | Cross-identity signature verification | Signature created with Identity A verified against Identity B returns `false`. |
| E6 | Bundle Deserialization | `oneTimePrekey` is `null` or `undefined` | Constructs valid `PreKeyBundle` with `preKeyId() === null` and `preKeyPublic() === null`. |
| E7 | Bundle Deserialization | Invalid Base64 string in `identityKey` | Throws runtime error / `PublicKey.deserialize` throws on malformed bytes without WASM crash. |
| E8 | Bundle Deserialization | Public key with incorrect byte length (e.g. 32 bytes missing 0x05 prefix) | `PublicKey.deserialize` throws error indicating invalid key length (expected 33 bytes). |
| E9 | Backend Publishing | Missing required fields (`identityKey`, `signedPrekey`, `signedPrekeySignature`) | Endpoint returns HTTP 400 Bad Request with descriptive JSON error. |
| E10 | Backend Publishing | Re-publishing / key rotation by same user | Performs atomic SQL UPDATE replacing identity/signed prekey and resetting OTP pool. |
| E11 | Backend Retrieval | Target user has never published keys | Endpoint returns HTTP 404 Not Found `{ error: 'Prekey bundle not found for user.' }`. |
| E12 | Backend Retrieval | Target user has 1 OTP left; fetched once | Returns bundle with `oneTimePrekey` populated, `oneTimePrekeysLeft: 0`. DB updated to `[]`. |
| E13 | Backend Retrieval | Target user has 0 OTPs left; fetched again | Returns bundle with `oneTimePrekey: null`, `oneTimePrekeysLeft: 0`. DB remains `[]`. |
| E14 | Backend Retrieval | Non-numeric or negative `:userId` param (e.g. `/v2/crypto/prekeys/invalid`) | Endpoint returns HTTP 400 Bad Request. |
| E15 | Atomic Concurrency | 10 simultaneous GET requests for user with 10 OTPs | DB transaction / atomic update ensures each requester receives a unique OTP; final count is 0. |

---

## 4. Test Infrastructure & Mocking Analysis

### 4.1 Test Runner Configuration
- **Runner**: Vitest `4.1.9` (`npm test` / `vitest run`).
- **Configuration** (`vite.config.ts`):
  - `globals: true`
  - `environment: 'node'`
  - `testTimeout: 20000`
  - `plugins`: `wasm()` (`vite-plugin-wasm`), `react()`, `tailwindcss()`.
  - `alias`: `@` -> `/src`.

### 4.2 Unit Testing Environment (Client Primitives & Utilities)
- Native Node.js / WASM environment executes `@signalapp/libsignal-client` directly without browser shims.
- Fast, deterministic in-memory cryptographic operations.
- Base64 encoding/decoding: Node `Buffer.from(..., 'base64')` or standard Web standard `btoa`/`atob` / `Uint8Array`.

### 4.3 Integration Testing Environment (Express & PostgreSQL)
- **HTTP Engine**: `supertest` (`^7.2.2`) with `app` imported from `server/v2/app.ts`.
- **Database**: Runs against PostgreSQL via `drizzle-orm` and `pg.Pool` (`server/v2/db/client.ts`).
- **Authentication in Tests**:
  - Helpers register test users via `POST /v2/auth/register` or generate valid session tokens.
  - Set header: `.set('Authorization', `Bearer ${token}`)`.
  - Clean test data isolation per test case using unique timestamps/user IDs or cleanup routines.

---

## 5. Exact Cryptographic Specification & Interface Contracts

### 5.1 Client-Side Data Transfer Objects (DTOs)

#### 1. `SignalPrekeyPublishDTO` (Client -> Server: `POST /v2/crypto/prekeys`)
```typescript
export interface SignalPrekeyPublishDTO {
  registrationId: number;         // uint32 (e.g. 1..2147483647 or 1..16380)
  deviceId: number;                 // integer (typically 1 for primary device)
  identityKey: string;              // Base64-encoded 33-byte Curve25519 public key (44 chars)
  signedPrekey: {
    keyId: number;                  // integer (e.g. 1)
    publicKey: string;              // Base64-encoded 33-byte public key (44 chars)
    signature: string;              // Base64-encoded 64-byte Ed25519 signature (88 chars)
  };
  oneTimePrekeys: Array<{
    keyId: number;                  // integer
    publicKey: string;              // Base64-encoded 33-byte public key (44 chars)
  }>;
}
```

#### 2. `SignalPrekeyBundleDTO` (Server -> Client: `GET /v2/crypto/prekeys/:userId`)
```typescript
export interface SignalPrekeyBundleDTO {
  userId: number;                   // target user ID
  registrationId: number;         // target registration ID
  deviceId: number;                 // target device ID (default 1)
  identityKey: string;              // Base64-encoded 33-byte identity public key
  signedPrekeyId: number;           // signed prekey ID
  signedPrekey: string;             // Base64-encoded 33-byte signed prekey public key
  signedPrekeySignature: string;    // Base64-encoded 64-byte signature
  oneTimePrekey?: {
    keyId: number;                  // one-time prekey ID
    publicKey: string;              // Base64-encoded 33-byte public key
  } | null;
  oneTimePrekeysLeft?: number;      // count of remaining OTPs in server pool
}
```

### 5.2 Client Utility Functions (`src/services/signalKeyUtils.ts` / `src/services/keyManagement.ts`)

1. **`generateIdentityKeyPair(): IdentityKeyPair`**
   - Invokes `IdentityKeyPair.generate()`.
   - Returns key pair with 33-byte public key and 32-byte private key.

2. **`generateRegistrationId(): number`**
   - Returns random positive integer `Math.floor(Math.random() * 16380) + 1`.

3. **`generateSignedPreKey(identityKeyPair: IdentityKeyPair, keyId: number, timestamp?: number): SignedPreKeyRecord`**
   - Generates private key: `priv = PrivateKey.generate()`.
   - Derives public key: `pub = priv.getPublicKey()`.
   - Generates Ed25519 signature: `sig = identityKeyPair.privateKey.sign(pub.serialize())`.
   - Constructs record: `SignedPreKeyRecord.new(keyId, timestamp || Date.now(), pub, priv, sig)`.

4. **`generateOneTimePreKeys(startKeyId: number, count: number): PreKeyRecord[]`**
   - Loops `i` from `startKeyId` to `startKeyId + count - 1`:
     - `priv = PrivateKey.generate()`
     - `pub = priv.getPublicKey()`
     - `PreKeyRecord.new(i, pub, priv)`
   - Returns array of `PreKeyRecord`.

5. **`createPrekeyPublishPayload(registrationId: number, deviceId: number, identityKeyPair: IdentityKeyPair, signedPreKey: SignedPreKeyRecord, oneTimePrekeys: PreKeyRecord[]): SignalPrekeyPublishDTO`**
   - Converts serialized public keys and signatures to Base64.
   - Packages into `SignalPrekeyPublishDTO`.

6. **`verifySignedPreKeySignature(identityPublicKey: PublicKey, signedPreKeyPublic: PublicKey, signature: Uint8Array | Buffer): boolean`**
   - Calls `identityPublicKey.verify(signedPreKeyPublic.serialize(), Buffer.from(signature))`.

7. **`bundleDtoToPreKeyBundle(dto: SignalPrekeyBundleDTO): PreKeyBundle`**
   - Deserializes Base64 identityKey, signedPrekey, signedPrekeySignature, and optional oneTimePrekey.
   - Returns `PreKeyBundle.new(dto.registrationId, dto.deviceId, dto.oneTimePrekey?.keyId ?? null, otpPub, dto.signedPrekeyId, spkPub, spkSig, idPub)`.

### 5.3 Backend Database Schema (`server/v2/db/schema/keys.ts`)

```typescript
export const userPrekeys = pgTable('user_prekeys', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  registrationId: integer('registration_id').default(1).notNull(),
  deviceId: integer('device_id').default(1).notNull(),
  identityKey: text('identity_key').notNull(),
  signedPrekeyId: integer('signed_prekey_id').default(1).notNull(),
  signedPrekey: text('signed_prekey').notNull(),
  signedPrekeySignature: text('signed_prekey_signature').notNull(),
  oneTimePrekeys: text('one_time_prekeys').default('[]').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => [
  index('idx_user_prekeys_user_id').on(table.userId)
]);
```

---

## 6. Comprehensive Test Design & Test Cases

### 6.1 Unit Test Suite (`tests/unit/signalKeyUtils.test.ts`)

#### Group 1: Identity Key Pair & Registration ID Generation
- **Test 1.1: `should generate valid Curve25519 identity key pair`**
  - Generate identity key pair using `generateIdentityKeyPair()`.
  - Assert public key serialize length is 33 bytes (starts with `0x05`).
  - Assert private key serialize length is 32 bytes.
- **Test 1.2: `should generate valid registration ID within range`**
  - Call `generateRegistrationId()`.
  - Assert result is integer > 0 and <= 2147483647.
- **Test 1.3: `should serialize and deserialize identity key pair without loss`**
  - Serialize to bytes using `.serialize()`.
  - Deserialize using `IdentityKeyPair.deserialize()`.
  - Assert public and private keys match original byte-for-byte.
- **Test 1.4: `should generate unique identity keys across multiple invocations`**
  - Generate 50 identity key pairs.
  - Collect public key Base64 strings in a Set.
  - Assert Set size is exactly 50.

#### Group 2: Signed Prekey Generation & Signature Verification
- **Test 2.1: `should generate SignedPreKeyRecord with valid signature`**
  - Generate identity key pair and signed prekey (ID = 1).
  - Assert `record.id() === 1`.
  - Assert `record.signature().length === 64`.
  - Assert `record.timestamp() > 0`.
- **Test 2.2: `should verify valid signature using identity public key`**
  - Call `verifySignedPreKeySignature(idPair.publicKey, record.publicKey(), record.signature())`.
  - Assert result is `true`.
- **Test 2.3: `should reject tampered signed prekey public key`**
  - Generate another random key pair and substitute its public key.
  - Assert `verifySignedPreKeySignature(idPair.publicKey, otherPub, record.signature())` is `false`.
- **Test 2.4: `should reject signature verified with wrong identity key`**
  - Generate identity key pair B.
  - Assert `verifySignedPreKeySignature(idPairB.publicKey, record.publicKey(), record.signature())` is `false`.
- **Test 2.5: `should serialize and deserialize SignedPreKeyRecord accurately`**
  - Serialize record, deserialize via `SignedPreKeyRecord.deserialize()`.
  - Assert restored ID, timestamp, public key, and signature match.

#### Group 3: One-Time Prekey Pool Generation
- **Test 3.1: `should generate pool of N one-time prekeys with sequential IDs`**
  - Call `generateOneTimePreKeys(100, 20)`.
  - Assert array length is 20.
  - Assert IDs range from 100 to 119.
- **Test 3.2: `should ensure all one-time prekeys in pool have unique keys`**
  - Generate pool of 50 OTPs.
  - Collect serialized public keys in a Set.
  - Assert Set size is 50.
- **Test 3.3: `should handle empty OTP pool generation (count = 0)`**
  - Call `generateOneTimePreKeys(1, 0)`.
  - Assert return is `[]`.

#### Group 4: Serialization to SignalPrekeyPublishDTO
- **Test 4.1: `should serialize keys to SignalPrekeyPublishDTO with Base64 strings`**
  - Generate ID, SPK, and 5 OTPs.
  - Call `createPrekeyPublishPayload(12345, 1, idPair, spk, otps)`.
  - Assert `dto.registrationId === 12345`.
  - Assert `dto.deviceId === 1`.
  - Assert `dto.identityKey` is valid Base64 string of 33-byte key (length 44).
  - Assert `dto.signedPrekey.publicKey` is valid Base64 string (length 44).
  - Assert `dto.signedPrekey.signature` is valid Base64 string of 64-byte sig (length 88).
  - Assert `dto.oneTimePrekeys.length === 5`.
- **Test 4.2: `should serialize payload with empty OTP pool`**
  - Call with `otps = []`.
  - Assert `dto.oneTimePrekeys` is `[]`.

#### Group 5: PreKeyBundle Assembly from SignalPrekeyBundleDTO
- **Test 5.1: `should assemble PreKeyBundle with one-time prekey`**
  - Create `SignalPrekeyBundleDTO` with valid Base64 keys and 1 OTP.
  - Call `bundleDtoToPreKeyBundle(dto)`.
  - Assert `bundle.registrationId() === dto.registrationId`.
  - Assert `bundle.deviceId() === dto.deviceId`.
  - Assert `bundle.signedPreKeyId() === dto.signedPrekeyId`.
  - Assert `bundle.preKeyId() === dto.oneTimePrekey.keyId`.
  - Assert `bundle.identityKey().verify(bundle.signedPreKeyPublic().serialize(), bundle.signedPreKeySignature()) === true`.
- **Test 5.2: `should assemble PreKeyBundle when oneTimePrekey is null`**
  - Create `SignalPrekeyBundleDTO` with `oneTimePrekey: null`.
  - Call `bundleDtoToPreKeyBundle(dto)`.
  - Assert `bundle.preKeyId() === null`.
  - Assert `bundle.preKeyPublic() === null`.
- **Test 5.3: `should throw descriptive error on corrupted Base64 in bundle DTO`**
  - Pass invalid Base64 string (`"not_base_64!!!"`) in `dto.identityKey`.
  - Assert function throws Error.

---

### 6.2 Integration Test Suite (`server/v2/tests/cryptoPrekeys.test.ts`)

#### Group 1: Bundle Publishing (`POST /v2/crypto/prekeys`)
- **Test 1.1: `POST /v2/crypto/prekeys - should publish prekey bundle for authenticated user`**
  - Register/login User A, obtain token.
  - Send `POST /v2/crypto/prekeys` with valid `SignalPrekeyPublishDTO` (20 OTPs).
  - Expect `res.status === 200`.
  - Expect `res.body.status === 'ok'`.
- **Test 1.2: `POST /v2/crypto/prekeys - should update existing bundle on subsequent publish`**
  - Send updated `SignalPrekeyPublishDTO` (rotated SPK and new OTPs) for User A.
  - Expect `res.status === 200`.
- **Test 1.3: `POST /v2/crypto/prekeys - should reject unauthenticated request`**
  - Send request without Authorization header.
  - Expect `res.status === 401`.
- **Test 1.4: `POST /v2/crypto/prekeys - should reject missing mandatory fields`**
  - Send payload missing `signedPrekeySignature`.
  - Expect `res.status === 400`.

#### Group 2: Bundle Retrieval & Atomic OTP Consumption (`GET /v2/crypto/prekeys/:userId`)
- **Test 2.1: `GET /v2/crypto/prekeys/:userId - should fetch bundle with single OTP`**
  - User B fetches User A's bundle.
  - Expect `res.status === 200`.
  - Expect `res.body.bundle.userId === userA.id`.
  - Expect `res.body.bundle.identityKey` matches User A's identity key.
  - Expect `res.body.bundle.oneTimePrekey` is an object `{ keyId, publicKey }`.
  - Expect `res.body.bundle.oneTimePrekeysLeft === 19` (decremented from 20).
- **Test 2.2: `GET /v2/crypto/prekeys/:userId - sequential fetches return distinct OTPs and decrement pool`**
  - User A publishes 3 OTPs (IDs 1, 2, 3).
  - Fetch 1: returns OTP 1, `oneTimePrekeysLeft === 2`.
  - Fetch 2: returns OTP 2, `oneTimePrekeysLeft === 1`.
  - Fetch 3: returns OTP 3, `oneTimePrekeysLeft === 0`.
- **Test 2.3: `GET /v2/crypto/prekeys/:userId - returns oneTimePrekey: null when pool is exhausted`**
  - Fetch 4 (after 3 OTPs consumed):
  - Expect `res.status === 200`.
  - Expect `res.body.bundle.oneTimePrekey === null`.
  - Expect `res.body.bundle.oneTimePrekeysLeft === 0`.
  - Expect `identityKey` and `signedPrekey` remain intact and valid.
- **Test 2.4: `GET /v2/crypto/prekeys/:userId - returns 404 for non-existent user or un-published keys`**
  - Fetch for `userId = 999999`.
  - Expect `res.status === 404`.
  - Expect `res.body.error` contains 'not found'.
- **Test 2.5: `GET /v2/crypto/prekeys/:userId - returns 400 for invalid userId param`**
  - Fetch for `userId = "abc"`.
  - Expect `res.status === 400`.

#### Group 3: Atomic Concurrency Validation
- **Test 3.1: `should atomically consume OTPs concurrently without duplicate key assignment`**
  - User A publishes bundle with 10 OTPs (IDs 101..110).
  - Issue 10 concurrent `GET /v2/crypto/prekeys/${userA.id}` requests via `Promise.all`.
  - Collect all returned `oneTimePrekey.keyId` values.
  - Assert 10 unique keyIds received (zero duplicates).
  - 11th request receives `oneTimePrekey: null`.

#### Group 4: Safety Number Generation (`POST /v2/crypto/safety-number`)
- **Test 4.1: `POST /v2/crypto/safety-number - should compute symmetric 6-block safety number`**
  - Both User A and User B have published identity keys.
  - User A requests safety number with User B -> gets string e.g. `12345 67890 ...`.
  - User B requests safety number with User A -> gets identical string.
  - Expect both strings to match exactly.

---

## 7. Builder Implementation Checklist for M3

1. **Client Utility (`src/services/signalKeyUtils.ts`)**:
   - Implement `generateIdentityKeyPair()`, `generateRegistrationId()`, `generateSignedPreKey()`, `generateOneTimePreKeys()`.
   - Implement `createPrekeyPublishPayload()`, `verifySignedPreKeySignature()`, `bundleDtoToPreKeyBundle()`.
   - Implement Base64 conversion helpers (`bytesToBase64`, `base64ToBytes`).

2. **Database Schema (`server/v2/db/schema/keys.ts`)**:
   - Ensure `registrationId`, `deviceId`, `signedPrekeyId`, `signedPrekeySignature`, `signedPrekey`, `identityKey`, `oneTimePrekeys` fields exist with proper types.

3. **Backend Service (`server/v2/services/crypto/prekeyVaultService.ts`)**:
   - Update `publishPrekeyBundle` to handle `SignalPrekeyPublishDTO`.
   - Update `fetchPrekeyBundle` to return `SignalPrekeyBundleDTO` with atomic `oneTimePrekeys` shift and depletion handling (`oneTimePrekey: null`).

4. **Backend Routes (`server/v2/routes/cryptoRoutes.ts`)**:
   - Standardize `POST /v2/crypto/prekeys` and `GET /v2/crypto/prekeys/:userId` to use `SignalPrekeyPublishDTO` and `SignalPrekeyBundleDTO`.
   - Remove/deprecate conflicting duplicate endpoints in `userRoutes.ts`.

5. **Test Files**:
   - Create `tests/unit/signalKeyUtils.test.ts` (16+ unit tests).
   - Create `server/v2/tests/cryptoPrekeys.test.ts` (14+ integration tests).
   - Ensure all tests pass with exit code 0 via `npx vitest run`.
