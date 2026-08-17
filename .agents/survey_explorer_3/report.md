# Velum Backend & Testing Infrastructure Survey Report

**Explorer**: survey_explorer_3  
**Target Project**: Velum (Migration to `@signalapp/libsignal-client`)  
**Scope**: Server codebase (`server/`), database schema and migrations (`server/v2/db/schema/`, `server/v2/db/migrations/`), prekey exchange mechanisms, REST/WebSocket routes, and testing infrastructure.

---

## 1. Executive Summary

Velum's backend is a modular TypeScript application running on Express and Node.js with PostgreSQL (managed via Drizzle ORM and `pg` pool with Neon resilience retries), Redis for active session caching and presence, and WebSocket (`ws`) for real-time messaging.

The current cryptographic key exchange implementation stores WebCrypto ECDH P-256 keys (serialized as JSON Web Keys / JWKs) in a dedicated PostgreSQL table `user_prekeys`. End-to-End Encrypted (E2EE) messages are exchanged over WebSocket, while prekey bundles are published and retrieved over authenticated REST endpoints.

Migrating to `@signalapp/libsignal-client` (Curve25519/X25519, Ed25519 signatures, 32-byte public keys) requires:
1. Augmenting the database schema `user_prekeys` with Signal-specific fields (`registration_id`, `signed_prekey_id`).
2. Updating the prekey bundle payload structures from P-256 JWKs to Base64/Hex raw Curve25519 keys with numerical key IDs (`keyId: number`).
3. Reconciling redundant prekey endpoints across `server/v2/routes/cryptoRoutes.ts` and `server/v2/routes/userRoutes.ts` to ensure atomic single-use one-time prekey consumption.
4. Integrating test scripts (`"test": "vitest run"`) into `package.json` and ensuring the Vitest test runner handles `@signalapp/libsignal-client` WebAssembly (WASM) modules without SSR or bundler errors.

---

## 2. Backend Codebase & Database Architecture

### 2.1 Directory Structure & Core Modules

The server codebase is centered in `server/` with the V2 engine located in `server/v2/`:

```
server/
├── index.ts                     # HTTP/Vite dev server bootstrap, WebSocket init, system bot activation
├── websocket.ts                 # Re-exports websocket engine from ./websocket/index.js
├── self-healing.ts              # Database schema validation and structural healing utility
├── websocket/
│   ├── index.ts                 # WebSocket server setup (/ws), authentication, session mapping, rate limits
│   ├── connectionManager.ts     # In-memory client maps (connectedClients, roomMembers), broadcast utilities
│   ├── rateLimiter.ts           # Sliding-window rate limiter per user
│   ├── unreadManager.ts         # DM room resolution (dm_${u1}_${u2}) & unread count tracking
│   └── handlers/
│       ├── messageHandler.ts    # Handlers for send_message, sync_request, mark_read, mark_delivered, reactions
│       └── roomHandler.ts       # Room join/leave logic
└── v2/
    ├── app.ts                   # Express application setup, security middleware, route registration
    ├── config.ts                # Environment variable parsing and defaults
    ├── db/
    │   ├── client.ts            # pg.Pool creation, Drizzle ORM client (db), executeWithRetry helper
    │   ├── redis.ts             # Redis connection manager
    │   ├── schema/              # Drizzle ORM schema definitions (19 files)
    │   │   ├── index.ts         # Central schema barrel export
    │   │   ├── keys.ts          # user_prekeys table definition
    │   │   ├── devices.ts       # devices, user_devices, ip_addresses tables
    │   │   ├── lounges.ts       # lounges, messages, lounge_members, message_reactions tables
    │   │   ├── tickets.ts       # tickets support/recovery table
    │   │   ├── users.ts         # users, support_admin_nominations tables
    │   │   └── sessions.ts      # sessions table (token_hash, expires_at)
    │   └── migrations/          # Drizzle migration SQL files & snapshots (0000_left_longshot.sql)
    ├── routes/                  # Express route controllers
    │   ├── cryptoRoutes.ts      # /v2/crypto/prekeys, /v2/crypto/safety-number
    │   ├── userRoutes.ts        # /v2/user/keys/prekey-bundle, /v2/user/:id/prekey-bundle
    │   ├── ticketRoutes.ts      # /v2/tickets, /v2/user/tickets
    │   ├── messagingRoutes.ts   # /v2/lounges/:id/read, /v2/messaging/delivery, /v2/messaging/typing
    │   └── authRoutes.ts        # /v2/auth/register, /v2/auth/login, /v2/auth/logout, /v2/auth/me
    ├── services/
    │   ├── crypto/
    │   │   └── prekeyVaultService.ts # publishPrekeyBundle, fetchPrekeyBundle, generateSafetyNumber
    │   ├── duress/
    │   │   └── panicService.ts       # Instant WAL cascade deletion of sensitive tables (including user_prekeys)
    │   └── messaging/
    │       ├── readReceiptService.ts
    │       └── deliveryReceiptService.ts
    └── tests/                   # Integration tests using Vitest & Supertest
        ├── auth.test.ts
        ├── bank.test.ts
        ├── market.test.ts
        └── media.test.ts
```

### 2.2 Database Layer & Connection Resilience

- **ORM & Dialect**: Drizzle ORM (`drizzle-orm/node-postgres`) configured via `drizzle.config.ts` (schema: `./server/v2/db/schema/index.ts`, dialect: `postgresql`).
- **Connection Management** (`server/v2/db/client.ts`):
  - Uses `pg.Pool` with SSL auto-negotiation (handling Neon and standard PostgreSQL).
  - Implements `executeWithRetry<T>(fn, maxRetries = 3, delayMs = 1000)` catching transient network errors (`ECONNRESET`, `57P01`, `ETIMEDOUT`, `EAI_AGAIN`).
- **Panic / Duress WAL Cascade Deletion** (`server/v2/services/duress/panicService.ts`):
  - When duress passcode is activated, line 41 purges `user_prekeys` (`tx.delete(userPrekeys).where(eq(userPrekeys.userId, userId))`) alongside `messages`, `sessions`, `push_subscriptions`, and `read_cursors`.

---

## 3. Current Prekey & Identity Key Storage and Exchange

### 3.1 Prekey Database Schema (`server/v2/db/schema/keys.ts`)

```typescript
export const userPrekeys = pgTable('user_prekeys', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  identityKey: text('identity_key').notNull(),
  signedPrekey: text('signed_prekey').notNull(),
  signedPrekeySignature: text('signed_prekey_signature').notNull(),
  oneTimePrekeys: text('one_time_prekeys').default('[]').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => [
  index('idx_user_prekeys_user_id').on(table.userId)
]);
```

### 3.2 Key Storage Format

Currently, the client exports WebCrypto P-256 keys to JWK format:
- `identityKey`: JSON-serialized JWK string (e.g. `{"kty":"EC","crv":"P-256","x":"...","y":"..."}`).
- `signedPrekey`: JSON-serialized JWK string.
- `signedPrekeySignature`: Mock string `'valid_sig_p256'` (identified as Critical Vulnerability #2 in `E2EE_SECURITY_AUDIT.md`).
- `oneTimePrekeys`: JSON-serialized string array of JWKs (e.g. `['{"kty":"EC",...}', '{"kty":"EC",...}']`).

### 3.3 REST Endpoints for Prekeys

There are currently two sets of endpoints handling prekeys:

| Route Path | File & Lines | Method | Behavior |
|---|---|---|---|
| `/v2/crypto/prekeys` | `server/v2/routes/cryptoRoutes.ts:30-50` | `POST` | Authenticated. Calls `publishPrekeyBundle` in `prekeyVaultService.ts` to upsert identity key, signed prekey, signature, and one-time prekeys pool into `user_prekeys`. |
| `/v2/crypto/prekeys/:userId` | `server/v2/routes/cryptoRoutes.ts:53-69` | `GET` | Authenticated. Calls `fetchPrekeyBundle` in `prekeyVaultService.ts`. **Atomically shifts 1 one-time prekey** from `one_time_prekeys` pool, updates remaining count in DB, and returns `{ bundle: { userId, identityKey, signedPrekey, signedPrekeySignature, oneTimePrekey, oneTimePrekeysLeft } }`. |
| `/v2/crypto/safety-number` | `server/v2/routes/cryptoRoutes.ts:72-107` | `POST` | Computes 6-block 5-digit decimal fingerprint from two public identity keys using SHA-256. |
| `/v2/user/keys/prekey-bundle` | `server/v2/routes/userRoutes.ts:35-70` | `POST` | Duplicate upload handler using inline Drizzle queries. |
| `/v2/user/:id/prekey-bundle` | `server/v2/routes/userRoutes.ts:72-102` | `GET` | Duplicate fetch handler that **does NOT consume** one-time prekeys (returns the entire un-shifted array). |

*Note on Tickets Route*: In the project prompt, `/api/tickets/prekeys` and `/api/tickets/bundle/:userId` were referenced. In the current codebase, `server/v2/routes/ticketRoutes.ts` is dedicated to support and recovery tickets (`/v2/tickets`), while prekey management is mounted under `/v2/crypto/prekeys` and `/v2/user/keys/prekey-bundle`.

### 3.4 WebSocket Message Exchange Flow

1. **Connection Setup** (`server/websocket/index.ts:85-152`):
   - Client connects to `ws://host:port/ws?userId=<id>&sessionId=<token>`.
   - Server verifies session token hash in `sessions` table.
   - Client is registered in `connectedClients` map (`ws -> ClientConnection`).
2. **Sending Messages** (`server/websocket/handlers/messageHandler.ts:377-535`):
   - Client emits `{ type: 'send_message', room_id: 'dm_1_2', content: '<ciphertext>', is_encrypted: true, client_msg_id: '...', nonce: '...' }`.
   - Server validates rate limit (5 burst, 1 msg/sec sustained).
   - Server verifies idempotency via `clientMsgId` against `messages` table.
   - Server increments lounge `currentSequenceId` and inserts message into `messages` table (`encrypted: true`, `content: message.content`).
   - Server responds to sender with `message_ack` (including `sequence_id`, `db_message_id`, `client_msg_id`).
   - Server broadcasts enriched message to recipient sockets (`broadcastToRoom` / `broadcastToUserDevices`).
   - If recipient is offline, triggers push notification via `dispatchPushNotification`.
3. **Synchronization & Offline Catch-up** (`server/websocket/handlers/messageHandler.ts:232-308`):
   - Client reconnects and sends `{ type: 'sync_request', room_id: 'dm_1_2', since_seq: 42 }`.
   - Server returns `{ type: 'sync_response', messages: [...], max_seq: N }` fetching all messages where `sequence_id > since_seq`.

---

## 4. Signal Protocol Schema & Endpoint Requirements

`@signalapp/libsignal-client` enforces strict data structures for X3DH / PQXDH prekey bundles:

### 4.1 Required Data Fields for Signal Prekey Bundle

| Field | Type | Description |
|---|---|---|
| `registrationId` | `number` (uint32, 1..16384) | Identifier generated upon identity creation to distinguish reinstalls / device resets. |
| `deviceId` | `number` (uint32) | Device index (default `1` for primary client device). |
| `identityKey` | `string` (Base64) | 32-byte Curve25519 / Ed25519 identity public key (or 33 bytes with 0x05 prefix). |
| `signedPreKey` | Object | `{ keyId: number, publicKey: string, signature: string }` |
| `signedPreKeyId` | `number` (uint32) | Numerical ID of the signed prekey (e.g., `1`, `2`). |
| `signedPreKeyPublic` | `string` (Base64) | 32-byte Curve25519 public key. |
| `signedPreKeySignature` | `string` (Base64) | 64-byte Ed25519 signature over `signedPreKeyPublic` by `identityKey`. |
| `oneTimePrekey` | Object | `{ keyId: number, publicKey: string }` |
| `preKeyId` | `number` (uint32) | Numerical ID of the consumed one-time prekey. |
| `preKeyPublic` | `string` (Base64) | 32-byte Curve25519 public key. |

### 4.2 Database Schema Adjustments

In `server/v2/db/schema/keys.ts`, update `user_prekeys`:

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
  oneTimePrekeys: text('one_time_prekeys').default('[]').notNull(), // JSON array: [{ keyId: number, publicKey: string }]
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => [
  index('idx_user_prekeys_user_id').on(table.userId)
]);
```

### 4.3 Endpoint Payload Upgrades

#### 1. Prekey Bundle Publish (`POST /v2/crypto/prekeys` and `/v2/user/keys/prekey-bundle`)
**Request Body**:
```json
{
  "registrationId": 14209,
  "deviceId": 1,
  "identityKey": "BQ3...==",
  "signedPrekey": {
    "keyId": 1,
    "publicKey": "BQ5...=="
  },
  "signedPrekeySignature": "dGVzdF9zaWduYXR1cmU...==",
  "oneTimePrekeys": [
    { "keyId": 1, "publicKey": "BQ7...==" },
    { "keyId": 2, "publicKey": "BQ8...==" }
  ]
}
```

#### 2. Prekey Bundle Retrieval (`GET /v2/crypto/prekeys/:userId`)
**Response Body**:
```json
{
  "status": "ok",
  "bundle": {
    "userId": 42,
    "registrationId": 14209,
    "deviceId": 1,
    "identityKey": "BQ3...==",
    "signedPrekeyId": 1,
    "signedPrekey": "BQ5...==",
    "signedPrekeySignature": "dGVzdF9zaWduYXR1cmU...==",
    "oneTimePrekey": {
      "keyId": 1,
      "publicKey": "BQ7...=="
    },
    "oneTimePrekeysLeft": 19
  }
}
```

#### 3. Endpoint Consolidation & Deprecation Cleanup
- `server/v2/routes/userRoutes.ts` duplicate endpoints (`/v2/user/keys/prekey-bundle` and `/v2/user/:id/prekey-bundle`) should be unified to invoke `publishPrekeyBundle` and `fetchPrekeyBundle` in `prekeyVaultService.ts` so that one-time prekeys are consistently consumed and counted.
- Support legacy route aliases (`/api/tickets/prekeys`, `/api/tickets/bundle/:userId`) via standard route aliasing if needed for older client versions.

---

## 5. Testing Infrastructure & Test Runners

### 5.1 Test Configuration & Tooling

- **Test Framework**: `vitest` (`^4.1.9`) installed in `devDependencies`.
- **Test Configuration**: Configured directly in `vite.config.ts`:
  ```typescript
  test: {
    testTimeout: 20000,
  }
  ```
- **HTTP / API Mocking**: `supertest` (`^7.2.2`) and `@types/supertest` (`^7.2.1`).
- **DOM / Browser Environment**: `jsdom` (`^29.1.1`).
- **Package Scripts in `package.json`**:
  - Existing scripts:
    - `"dev"`: `tsx watch ... server/index.ts`
    - `"build"`: `vite build && esbuild server/index.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`
    - `"lint"`: `tsc --noEmit`
  - Current Gap: No `"test"` script is defined in `package.json`.

### 5.2 Existing Test Suite Inventory

1. **`server/v2/tests/auth.test.ts`**:
   - Integration test exercising `/v2/auth/register`, `/v2/auth/login`, `/v2/auth/me`, and `/v2/auth/logout` using `supertest`.
2. **`server/v2/tests/bank.test.ts`**:
   - Integration test covering banking operations and balance checks.
3. **`server/v2/tests/market.test.ts`**:
   - Integration test for marketplace listings and transactions.
4. **`server/v2/tests/media.test.ts`**:
   - Security integration test testing `/v2/media/upload` against executable extension bypasses, path traversals, and size limits.
5. **`src/services/encryptionService.test.ts`**:
   - Unit tests for message encryption helper and SHA-256 client hash.
6. **`src/hooks/useAudioRecorder.test.ts`**:
   - Unit test with mock `MediaStream` and `MediaRecorder` testing audio recording state.
7. **`src/components/ProfileCard.test.tsx`**:
   - Type check test verifying component export.

### 5.3 Testing Infrastructure Recommendations for Libsignal Migration

1. **Add `package.json` Test Scripts**:
   ```json
   "scripts": {
     "test": "vitest run",
     "test:watch": "vitest",
     "test:e2e": "vitest run src/services/signalProtocol.test.ts"
   }
   ```
2. **WASM Compatibility in Vitest**:
   - `@signalapp/libsignal-client` compiles Rust to WebAssembly.
   - Vitest runs tests in Node.js by default. To support `@signalapp/libsignal-client` in Node test environments:
     - Ensure Node.js has WebAssembly enabled (default in Node >= 18).
     - If testing browser IndexedDB stores (`cryptoDbStore.ts`) inside Vitest, utilize `fake-indexeddb` or JSDOM environment in Vitest test files.
3. **Required Migration Test Suite Matrix**:
   - **Unit Tests**:
     1. Store Adapters: `IdentityKeyStore`, `PreKeyStore`, `SignedPreKeyStore`, `SessionStore` CRUD verification in IndexedDB.
     2. Prekey Bundle Generation: Verify 32-byte Curve25519 keys and 64-byte Ed25519 signature validity.
     3. Safety Number: Verify deterministic number generation from two identity keys.
   - **Integration / E2E Tests**:
     1. Prekey Bundle publish (`POST /v2/crypto/prekeys`) & fetch (`GET /v2/crypto/prekeys/:userId`).
     2. X3DH initial session creation between User A and User B.
     3. 10+ bidirectional message exchange with alternating ratchet steps (`SessionCipher.encrypt` / `SessionCipher.decrypt`).
     4. Out-of-order and skipped message handling.
     5. Reconnect & state persistence reload across browser sessions.

---

## 6. Synthesis & Architecture Matrix

| Component | Current State (P-256 WebCrypto) | Target State (@signalapp/libsignal-client) | Impact Level |
|---|---|---|---|
| **Identity Key** | P-256 ECDH JWK string | Curve25519 public key (32 bytes Base64) | High (Requires complete key regeneration) |
| **Signed Prekey** | P-256 ECDH JWK string | Curve25519 public key + `signedPrekeyId` | Medium (Schema update: `signed_prekey_id`) |
| **Signature** | Mock `'valid_sig_p256'` string | Ed25519 64-byte cryptographic signature | High (Fixes Critical Vulnerability #2) |
| **One-Time Prekeys** | Array of P-256 JWK strings | Array of `{ keyId: number, publicKey: string }` | Medium (Schema/Payload structure update) |
| **Registration ID** | None | uint32 integer (`registration_id`) | Medium (Schema update: `registration_id`) |
| **DB Schema (`user_prekeys`)** | `userId`, `identityKey`, `signedPrekey`, `signedPrekeySignature`, `oneTimePrekeys` | Add `registration_id`, `signed_prekey_id` | Low (Add nullable/default columns) |
| **REST Endpoints** | Redundant routes in `cryptoRoutes.ts` & `userRoutes.ts` | Consolidated `prekeyVaultService.ts` with atomic consumption | Medium (Unify handler logic) |
| **WebSocket Pipeline** | `send_message` / `sync_request` / `message_ack` passing ciphertext string | Unchanged wire format (payload content carries Signal ciphertext) | Low (Zero protocol breaking changes to WebSocket layer) |
| **Test Runner** | Vitest installed, missing `"test"` script in `package.json` | Add `"test": "vitest run"` and WASM-compatible E2E test suites | Low (Configuration only) |
