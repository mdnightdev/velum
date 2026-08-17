# Milestone 3 Backend Architecture & Prekey Bundle Management Analysis

## Executive Summary
This analysis details the backend schema, services, routes, and concurrency guarantees required to support the Signal Protocol (`@signalapp/libsignal-client`) in Velum. The existing custom P-256 prekey implementation in `server/v2/db/schema/keys.ts`, `server/v2/services/crypto/prekeyVaultService.ts`, and `server/v2/routes/cryptoRoutes.ts` requires structural updates to store Signal-compliant bundles (`registrationId`, `deviceId`, `signedPrekeyId`, Base64 keys, and JSONB one-time prekeys pool) and implement transaction-isolated row-level locking (`SELECT ... FOR UPDATE`) to prevent race conditions during one-time prekey consumption.

---

## 1. Current State Investigation

### 1.1 Database Schema (`server/v2/db/schema/keys.ts`)
The current table definition is:
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
**Deficiencies Identified:**
1. **Missing Registration ID**: Signal requires a numerical `registrationId` (1–16380) per identity key to validate recipient identity restarts.
2. **Missing Device ID & Multi-Device Keying**: The table enforces `unique()` solely on `userId`. Multi-device Signal sessions require keys scoped by `(userId, deviceId)`.
3. **Missing Signed Prekey ID**: `signedPrekeyId` is needed by `libsignal-client` to look up the private signed prekey record corresponding to the published bundle.
4. **Untyped String Pool**: `oneTimePrekeys` is stored as a raw `text` string with `'[]'`, requiring manual string JSON parsing instead of PostgreSQL native `jsonb` array indexing.
5. **Key Format**: Stored strings previously contained raw WebCrypto JWKs instead of Base64-encoded Curve25519 / Ed25519 byte representations.

### 1.2 Prekey Vault Service (`server/v2/services/crypto/prekeyVaultService.ts`)
The current prekey service logic:
```typescript
// Current fetch implementation
export async function fetchPrekeyBundle(targetUserId: number) {
  const [record] = await executeWithRetry(() =>
    db.select()
      .from(userPrekeys)
      .where(eq(userPrekeys.userId, targetUserId))
      .limit(1)
  );
  if (!record) return null;

  let pool = JSON.parse(record.oneTimePrekeys || '[]');
  let consumedOneTimePrekey = undefined;

  if (pool.length > 0) {
    consumedOneTimePrekey = pool.shift();
    await executeWithRetry(() =>
      db.update(userPrekeys)
        .set({ oneTimePrekeys: JSON.stringify(pool), updatedAt: new Date() })
        .where(eq(userPrekeys.userId, targetUserId))
    );
  }
  ...
}
```
**Vulnerabilities Identified:**
1. **Critical Concurrency Hazard (Race Condition in OPK Consumption)**:
   A plain `db.select()` followed by in-memory `pool.shift()` and a subsequent `db.update()` is not atomic across concurrent requests. If Alice and Charlie simultaneously initiate a session with Bob:
   - Thread A selects Bob's record (pool: `[OPK1, OPK2]`).
   - Thread B selects Bob's record (pool: `[OPK1, OPK2]`).
   - Thread A shifts `OPK1` and updates pool to `[OPK2]`.
   - Thread B shifts `OPK1` and updates pool to `[OPK2]`.
   - Both Alice and Charlie receive the same `OPK1`.
   - Bob decrypts Alice's message, consumes and deletes `OPK1` from his local store.
   - When Charlie's message arrives, Bob fails to decrypt because `OPK1` has already been purged locally.
2. **Non-Atomic Upsert in `publishPrekeyBundle`**:
   The current code does a separate `SELECT` followed by `INSERT` or `UPDATE`. Drizzle's `.insert().values().onConflictDoUpdate()` provides an atomic upsert avoiding duplicate key errors under high concurrency.
3. **Empty Pool Handling**:
   When the one-time prekey pool is empty, the service should return `oneTimePrekey: null` and `oneTimePrekeysLeft: 0`, enabling the client to gracefully fall back to 3-DH (Identity Key + Signed Prekey).

### 1.3 Route Definitions & Mounting
1. **`server/v2/routes/cryptoRoutes.ts`**:
   - `POST /crypto/prekeys`: Publishes bundle using authenticated `req.user.userId`.
   - `GET /crypto/prekeys/:userId`: Retrieves bundle and pops 1 one-time prekey.
   - `POST /crypto/safety-number`: Calculates SHA-256 decimal fingerprint between two identity keys.
2. **`server/v2/routes/userRoutes.ts` (Duplicate / Legacy)**:
   - Contains `/v2/user/keys/prekey-bundle` and `/v2/user/:id/prekey-bundle`.
   - These legacy endpoints bypass `prekeyVaultService.ts`, do not consume one-time prekeys, and parse JWKs directly.
3. **Mounting Architecture**:
   - In `server/v2/app.ts`:
     - `app.use('/v2', cryptoRouter);`
     - `app.use('/api/v2', cryptoRouter);`
   - In `server/index.ts`:
     - `app.use(v2App);`
   - This makes canonical endpoints accessible at:
     - `POST /v2/crypto/prekeys` and `POST /api/v2/crypto/prekeys`
     - `GET /v2/crypto/prekeys/:userId` and `GET /api/v2/crypto/prekeys/:userId`

---

## 2. Updated Schema Design (`server/v2/db/schema/keys.ts`)

### 2.1 Proposed Drizzle Schema
```typescript
import { pgTable, serial, integer, text, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export interface OneTimePrekeyItem {
  keyId: number;
  publicKey: string; // Base64 (33 bytes)
}

export const userPrekeys = pgTable('user_prekeys', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  deviceId: integer('device_id').default(1).notNull(),
  registrationId: integer('registration_id').notNull(),
  identityKey: text('identity_key').notNull(), // Base64 Curve25519 public key (33 bytes)
  signedPrekeyId: integer('signed_prekey_id').notNull(),
  signedPrekey: text('signed_prekey').notNull(), // Base64 Curve25519 public key (33 bytes)
  signedPrekeySignature: text('signed_prekey_signature').notNull(), // Base64 Ed25519 signature (64 bytes)
  oneTimePrekeys: jsonb('one_time_prekeys').$type<OneTimePrekeyItem[]>().default([]).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => [
  uniqueIndex('idx_user_prekeys_user_device').on(table.userId, table.deviceId),
  index('idx_user_prekeys_user_id').on(table.userId)
]);

export type UserPrekey = typeof userPrekeys.$inferSelect;
export type NewUserPrekey = typeof userPrekeys.$inferInsert;
```

### 2.2 Field Descriptions
| Field | Type | Description |
|-------|------|-------------|
| `userId` | `integer` | Foreign key referencing `users.id` with `CASCADE` delete. |
| `deviceId` | `integer` | Device ID (default `1`), indexed with `userId` for uniqueness. |
| `registrationId` | `integer` | Signal Registration ID (1–16380). |
| `identityKey` | `text` | Base64-encoded 33-byte Curve25519 public key (`0x05` prefix + 32-byte key). |
| `signedPrekeyId` | `integer` | Numeric identifier for the signed prekey. |
| `signedPrekey` | `text` | Base64-encoded 33-byte Curve25519 public key. |
| `signedPrekeySignature` | `text` | Base64-encoded 64-byte Ed25519 signature over `signedPrekey`. |
| `oneTimePrekeys` | `jsonb` | JSONB array of `{ keyId: number, publicKey: string }`. |
| `updatedAt` | `timestamp` | Last update timestamp (`defaultNow()`). |

---

## 3. Atomic Prekey Consumption & Vault Service Design

### 3.1 Interface Contracts
```typescript
export interface OneTimePrekeyItem {
  keyId: number;
  publicKey: string; // Base64 (33 bytes)
}

export interface SignalPrekeyPublishDTO {
  registrationId: number;
  deviceId?: number;
  identityKey: string; // Base64 public key
  signedPrekey: {
    keyId: number;
    publicKey: string; // Base64 public key
    signature: string; // Base64 signature
  };
  oneTimePrekeys: OneTimePrekeyItem[];
}

export interface SignalPrekeyBundleDTO {
  userId: number;
  registrationId: number;
  deviceId: number;
  identityKey: string;           // Base64 (33 bytes)
  signedPrekeyId: number;        // integer
  signedPrekey: string;          // Base64 (33 bytes)
  signedPrekeySignature: string; // Base64 (64 bytes)
  oneTimePrekey: {
    keyId: number;
    publicKey: string;           // Base64 (33 bytes)
  } | null;
  oneTimePrekeysLeft: number;
}
```

### 3.2 Atomic Bundle Publish (`publishPrekeyBundle`)
Using atomic `onConflictDoUpdate` to ensure idempotent, race-free prekey bundle publishing:
```typescript
export async function publishPrekeyBundle(
  userId: number,
  bundle: SignalPrekeyPublishDTO
): Promise<void> {
  const deviceId = bundle.deviceId || 1;
  const otps = Array.isArray(bundle.oneTimePrekeys) ? bundle.oneTimePrekeys : [];

  await executeWithRetry(async () => {
    await db.insert(userPrekeys)
      .values({
        userId,
        deviceId,
        registrationId: bundle.registrationId,
        identityKey: bundle.identityKey,
        signedPrekeyId: bundle.signedPrekey.keyId,
        signedPrekey: bundle.signedPrekey.publicKey,
        signedPrekeySignature: bundle.signedPrekey.signature,
        oneTimePrekeys: otps,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [userPrekeys.userId, userPrekeys.deviceId],
        set: {
          registrationId: bundle.registrationId,
          identityKey: bundle.identityKey,
          signedPrekeyId: bundle.signedPrekey.keyId,
          signedPrekey: bundle.signedPrekey.publicKey,
          signedPrekeySignature: bundle.signedPrekey.signature,
          oneTimePrekeys: otps,
          updatedAt: new Date()
        }
      });
  });
}
```

### 3.3 Atomic `pool.shift()` Consumption (`fetchPrekeyBundle`)
To guarantee that no two concurrent callers ever receive the same one-time prekey, the operation is executed inside a transaction with PostgreSQL row-level locking (`SELECT ... FOR UPDATE`):
```typescript
export async function fetchPrekeyBundle(
  targetUserId: number,
  deviceId: number = 1
): Promise<SignalPrekeyBundleDTO | null> {
  return await executeWithRetry(async () => {
    return await db.transaction(async (tx) => {
      // 1. Acquire row lock on user_prekeys for this user + device
      const [record] = await tx
        .select()
        .from(userPrekeys)
        .where(and(eq(userPrekeys.userId, targetUserId), eq(userPrekeys.deviceId, deviceId)))
        .for('update')
        .limit(1);

      if (!record) return null;

      let pool: OneTimePrekeyItem[] = [];
      if (Array.isArray(record.oneTimePrekeys)) {
        pool = record.oneTimePrekeys;
      } else if (typeof record.oneTimePrekeys === 'string') {
        try {
          pool = JSON.parse(record.oneTimePrekeys);
        } catch {
          pool = [];
        }
      }

      let consumedOneTimePrekey: OneTimePrekeyItem | null = null;

      // 2. Atomically pop one prekey if pool is non-empty
      if (pool.length > 0) {
        consumedOneTimePrekey = pool.shift()!;
        
        // 3. Update the remaining pool within the locked transaction
        await tx
          .update(userPrekeys)
          .set({
            oneTimePrekeys: pool,
            updatedAt: new Date()
          })
          .where(eq(userPrekeys.id, record.id));
      }

      return {
        userId: record.userId,
        registrationId: record.registrationId,
        deviceId: record.deviceId,
        identityKey: record.identityKey,
        signedPrekeyId: record.signedPrekeyId,
        signedPrekey: record.signedPrekey,
        signedPrekeySignature: record.signedPrekeySignature,
        oneTimePrekey: consumedOneTimePrekey ? {
          keyId: consumedOneTimePrekey.keyId,
          publicKey: consumedOneTimePrekey.publicKey
        } : null,
        oneTimePrekeysLeft: pool.length
      };
    });
  });
}
```

### 3.4 Concurrency Mechanism Breakdown
```
Caller 1 (Alice)                         Caller 2 (Charlie)
     │                                        │
     ▼                                        ▼
BEGIN TRANSACTION                        BEGIN TRANSACTION
SELECT ... FOR UPDATE (locks row)        SELECT ... FOR UPDATE (waits for lock...)
Read pool [OPK1, OPK2, OPK3]                  │ (blocked)
Shift OPK1 -> pool is [OPK2, OPK3]            │
UPDATE pool = [OPK2, OPK3]                    │
COMMIT (releases lock)                        │
     │                                        ▼
Returns OPK1                             Lock Acquired!
                                         Read pool [OPK2, OPK3]
                                         Shift OPK2 -> pool is [OPK3]
                                         UPDATE pool = [OPK3]
                                         COMMIT
                                              │
                                         Returns OPK2
```
**Guarantees:**
- Alice gets `OPK1`, Charlie gets `OPK2`.
- No duplicate prekey distribution is possible.
- Pool count accurately reflects remaining keys.
- When empty, both callers safely receive `oneTimePrekey: null` without throwing or deadlocking.

---

## 4. REST Endpoints & Route Consolidation

### 4.1 Canonical Endpoints (`server/v2/routes/cryptoRoutes.ts`)
```typescript
// POST /v2/crypto/prekeys
cryptoRouter.post('/crypto/prekeys', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { registrationId, deviceId, identityKey, signedPrekey, oneTimePrekeys } = req.body;

    if (!registrationId || !identityKey || !signedPrekey) {
      return res.status(400).json({ error: 'Missing registrationId, identityKey, or signedPrekey.' });
    }

    if (!signedPrekey.keyId || !signedPrekey.publicKey || !signedPrekey.signature) {
      return res.status(400).json({ error: 'Invalid signedPrekey payload structure.' });
    }

    await publishPrekeyBundle(userId, {
      registrationId: Number(registrationId),
      deviceId: Number(deviceId) || 1,
      identityKey: String(identityKey),
      signedPrekey: {
        keyId: Number(signedPrekey.keyId),
        publicKey: String(signedPrekey.publicKey),
        signature: String(signedPrekey.signature)
      },
      oneTimePrekeys: Array.isArray(oneTimePrekeys) ? oneTimePrekeys : []
    });

    res.json({ status: 'ok', message: 'Prekey bundle published successfully.' });
  } catch (err) {
    next(err);
  }
});

// GET /v2/crypto/prekeys/:userId
cryptoRouter.get('/crypto/prekeys/:userId', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid userId parameter.' });
    }
    const deviceId = req.query.deviceId ? parseInt(req.query.deviceId as string, 10) : 1;

    const bundle = await fetchPrekeyBundle(targetUserId, deviceId);
    if (!bundle) {
      return res.status(404).json({ error: 'Prekey bundle not found for user.' });
    }

    res.json({ status: 'ok', bundle });
  } catch (err) {
    next(err);
  }
});
```

### 4.2 Route Unification & Legacy Route Redirection
In `server/v2/routes/userRoutes.ts`, replace the custom direct DB access with calls to `prekeyVaultService`:
- `/v2/user/keys/prekey-bundle` (POST) -> Normalizes body and calls `publishPrekeyBundle(req.user!.userId, payload)`.
- `/v2/user/:id/prekey-bundle` (GET) -> Calls `fetchPrekeyBundle(targetUserId)` and returns the bundle.
This ensures legacy client calls do not corrupt the database schema or bypass atomic consumption.

---

## 5. Verification & Test Plan

1. **Unit Test: Prekey Bundle Publishing & Storage**:
   - Verify `publishPrekeyBundle` saves all fields (`registrationId`, `deviceId`, `signedPrekeyId`, Base64 strings, JSONB array).
   - Verify subsequent publish with same `(userId, deviceId)` atomically replaces existing bundle without throwing duplicate key errors.
2. **Unit Test: Atomic Single-Use OPK Consumption**:
   - Publish bundle with 5 OPKs.
   - Fetch bundle 5 times sequentially: verify each response returns a distinct `keyId` and `oneTimePrekeysLeft` decrements from 4 to 0.
   - 6th fetch: verify `oneTimePrekey` is `null` and `oneTimePrekeysLeft` is 0.
3. **Integration Test: Concurrent Multi-Threaded Consumption**:
   - Publish bundle with 20 OPKs.
   - Launch 20 concurrent `fetchPrekeyBundle` requests via `Promise.all`.
   - Verify all 20 responses contain unique, non-overlapping `keyId` values.
   - Verify final pool in database is empty (`[]`).
4. **Integration Test: REST API via Supertest**:
   - `POST /v2/crypto/prekeys` with valid Bearer token returns 200 OK.
   - `POST /v2/crypto/prekeys` with missing fields returns 400 Bad Request.
   - `GET /v2/crypto/prekeys/:userId` returns 200 OK with `SignalPrekeyBundleDTO`.
   - `GET /v2/crypto/prekeys/99999` (non-existent) returns 404 Not Found.
