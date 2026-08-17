# Handoff Report: Milestone 3 Backend Architecture & Prekey Vault Investigation

## 1. Observation
1. **Schema (`server/v2/db/schema/keys.ts`)**:
   - Lines 4–17 define `userPrekeys` table:
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
   - Observed missing fields: `registrationId` (integer), `deviceId` (integer), `signedPrekeyId` (integer), and JSONB typing for `oneTimePrekeys`.
2. **Service (`server/v2/services/crypto/prekeyVaultService.ts`)**:
   - Lines 62–91 implement `fetchPrekeyBundle`:
     ```typescript
     const [record] = await executeWithRetry(() =>
       db.select()
         .from(userPrekeys)
         .where(eq(userPrekeys.userId, targetUserId))
         .limit(1)
     );
     ...
     if (pool.length > 0) {
       consumedOneTimePrekey = pool.shift();
       await executeWithRetry(() =>
         db.update(userPrekeys)
           .set({
             oneTimePrekeys: JSON.stringify(pool),
             updatedAt: new Date()
           })
           .where(eq(userPrekeys.userId, targetUserId))
       );
     }
     ```
   - This read-then-write sequence lacks database-level locks, permitting concurrent requests to pop the identical prekey.
3. **Route Definitions (`server/v2/routes/cryptoRoutes.ts` & `server/v2/routes/userRoutes.ts`)**:
   - `cryptoRoutes.ts` (lines 30–69) exposes `/crypto/prekeys` (POST) and `/crypto/prekeys/:userId` (GET) mounted under `/v2` and `/api/v2` via `server/v2/app.ts` (lines 67–68).
   - `userRoutes.ts` (lines 35–102) contains duplicate endpoints `/keys/prekey-bundle` (POST) and `/:id/prekey-bundle` (GET) mounted under `/v2/user`. These duplicate routes perform uncoordinated direct DB writes and return the entire OPK array without consumption.
4. **App Mounting (`server/v2/app.ts` & `server/index.ts`)**:
   - `server/v2/app.ts` mounts `cryptoRouter` at `/v2` and `/api/v2`, and `v2UserRouter` at `/v2/user`.
   - `server/index.ts` mounts `v2App` with `app.use(v2App)`.

## 2. Logic Chain
1. *From Observation 1*: The Signal client library (`@signalapp/libsignal-client`) requires `registrationId`, `deviceId`, `signedPrekeyId`, Base64-encoded keys, and numerical `keyId` indexing for OPKs to establish X3DH sessions.
2. *From Observation 2*: In X3DH, a One-Time Prekey must never be issued to more than one initiating peer. Because `fetchPrekeyBundle` executes a non-locking `SELECT` followed by an `UPDATE`, concurrent requests race and receive duplicate OPKs. Bob's client will delete the OPK upon receiving the first message, causing the second message to fail decryption.
3. *Therefore*: Wrapping `fetchPrekeyBundle` in a PostgreSQL transaction with `SELECT ... FOR UPDATE` (or Drizzle `.for('update')`) locks the target row and enforces sequential, isolated key consumption.
4. *From Observation 3*: The duplicate routes in `userRoutes.ts` risk client desync if client code uses `/v2/user/...` instead of `/v2/crypto/...`. Unifying or aliasing these routes to `prekeyVaultService` eliminates divergence.

## 3. Caveats
- Multi-device sessions currently assume `deviceId = 1` as default when unsupplied. The schema supports arbitrary `deviceId` integers with a composite unique index on `(userId, deviceId)`.
- When all one-time prekeys are exhausted (`pool.length === 0`), `fetchPrekeyBundle` returns `oneTimePrekey: null` and `oneTimePrekeysLeft: 0`. The client X3DH implementation must support standard 3-DH fallback when no OPK is present.

## 4. Conclusion
1. **Schema Update**: Update `user_prekeys` in `server/v2/db/schema/keys.ts` with `deviceId` (integer), `registrationId` (integer), `signedPrekeyId` (integer), Base64 key columns, `jsonb` array for `oneTimePrekeys`, and a unique index on `(userId, deviceId)`.
2. **Service Hardening**: Implement atomic upsert with `onConflictDoUpdate` in `publishPrekeyBundle`, and atomic row-level locking with `tx.select().from(userPrekeys)...for('update')` in `fetchPrekeyBundle`.
3. **Route Unification**: Maintain canonical routes in `server/v2/routes/cryptoRoutes.ts` (`POST /v2/crypto/prekeys`, `GET /v2/crypto/prekeys/:userId`), and alias legacy endpoints in `userRoutes.ts` to `prekeyVaultService`.

## 5. Verification Method
- **Unit/Integration Test Commands**:
  - Run `npm test` or `npx vitest run tests/e2e/e2ee-protocol-tiers.test.ts` to verify protocol test passes.
  - Execute dedicated concurrency test launching 20 parallel `fetchPrekeyBundle` calls against a single prekey bundle to verify zero duplicate OPK distributions and pool exhaustion to 0.
- **Files to Inspect**:
  - `/root/velum/.agents/explorer_m3_2/analysis.md`
  - `server/v2/db/schema/keys.ts`
  - `server/v2/services/crypto/prekeyVaultService.ts`
  - `server/v2/routes/cryptoRoutes.ts`
