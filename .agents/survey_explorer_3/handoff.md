# Handoff Report — Backend & Testing Infrastructure Survey

## 1. Observation

1. **Prekey Database Schema**:
   - `server/v2/db/schema/keys.ts` lines 4-17:
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
   - Schema currently lacks dedicated columns for `registration_id` and `signed_prekey_id`.

2. **Prekey Storage & Endpoints**:
   - `server/v2/routes/cryptoRoutes.ts` lines 30-69:
     - `POST /v2/crypto/prekeys`: calls `publishPrekeyBundle` in `server/v2/services/crypto/prekeyVaultService.ts`.
     - `GET /v2/crypto/prekeys/:userId`: calls `fetchPrekeyBundle` in `prekeyVaultService.ts`.
     - `POST /v2/crypto/safety-number`: generates 6-digit decimal code via SHA-256 fingerprinting of two identity keys.
   - `server/v2/services/crypto/prekeyVaultService.ts` lines 54-101:
     - `fetchPrekeyBundle(targetUserId)` parses `oneTimePrekeys` JSON array, shifts 1 element atomically (`pool.shift()`), updates `userPrekeys` in PostgreSQL, and returns `{ userId, identityKey, signedPrekey, signedPrekeySignature, oneTimePrekey, oneTimePrekeysLeft }`.
   - `server/v2/routes/userRoutes.ts` lines 35-102:
     - Contains duplicate handlers `POST /keys/prekey-bundle` and `GET /:id/prekey-bundle` which directly query `userPrekeys` table and do not pop/consume one-time prekeys.

3. **Duress / Panic Cascade Deletion**:
   - `server/v2/services/duress/panicService.ts` lines 40-42:
     ```typescript
     // 2. Purge prekeys
     await tx.delete(userPrekeys).where(eq(userPrekeys.userId, userId));
     purgedTables.push('user_prekeys');
     ```
     `user_prekeys` is already integrated into WAL cascade purge operations.

4. **WebSocket Real-time Messaging**:
   - `server/websocket/index.ts` lines 85-152:
     - WebSocket server mounted on path `/ws`.
     - Authenticates connection query params `userId` and `sessionId` against table `sessions`.
   - `server/websocket/handlers/messageHandler.ts` lines 377-508:
     - Handles `send_message` with `{ room_id, content, is_encrypted, client_msg_id, nonce }`.
     - Stores ciphertext in table `messages` (`encrypted: !!message.is_encrypted`, `content: message.content`).
     - Broadcasts enriched message payload to recipient sockets and sends `message_ack` to sender.
     - Handles `sync_request` (lines 232-308) for offline catch-up using `sequenceId > sinceSeq`.

5. **Test Runners & Configuration**:
   - `package.json` lines 47-67:
     - `vitest` (`^4.1.9`), `supertest` (`^7.2.2`), and `jsdom` (`^29.1.1`) are present in `devDependencies`.
     - `package.json` scripts currently include `"dev"`, `"start"`, `"build"`, `"lint"`, but no `"test"` script is defined.
   - `vite.config.ts` lines 23-25:
     ```typescript
     test: {
       testTimeout: 20000,
     },
     ```
   - Existing test files: `server/v2/tests/auth.test.ts`, `server/v2/tests/bank.test.ts`, `server/v2/tests/market.test.ts`, `server/v2/tests/media.test.ts`, `src/services/encryptionService.test.ts`, `src/hooks/useAudioRecorder.test.ts`, `src/components/ProfileCard.test.tsx`.

---

## 2. Logic Chain

1. **Signal Protocol Compatibility**:
   - From Observation #1, the current `user_prekeys` table only stores string values for `identity_key`, `signed_prekey`, `signed_prekey_signature`, and `one_time_prekeys`.
   - In `@signalapp/libsignal-client`, establishing a session via `PreKeyBundle.new(...)` requires `registrationId: number`, `deviceId: number`, `signedPreKeyId: number`, and `{ keyId: number, publicKey: string }` for one-time prekeys.
   - Therefore, the database schema must be augmented with `registration_id` and `signed_prekey_id` (or store structured JSON objects), and the prekey upload/retrieval handlers must accept and return these fields.

2. **Endpoint Consolidation**:
   - From Observation #2, `server/v2/routes/cryptoRoutes.ts` properly uses `prekeyVaultService.ts` to atomically pop single-use prekeys, whereas `server/v2/routes/userRoutes.ts` bypasses this service and returns un-popped pools.
   - Therefore, unifying both routes to use `prekeyVaultService.ts` will ensure protocol-correct one-time prekey consumption for X3DH session setup.

3. **WebSocket Pipeline Safety**:
   - From Observation #4, WebSocket message exchange treats message `content` as an opaque text payload (storing the ciphertext envelope string) and manages synchronization via `sequenceId`.
   - Therefore, switching the client crypto layer to `@signalapp/libsignal-client` requires zero protocol modifications to the server WebSocket pipeline.

4. **Testing Infrastructure Readiness**:
   - From Observation #5, `vitest` is already installed and configured in `vite.config.ts`, but lacks a run script in `package.json`.
   - Adding `"test": "vitest run"` and WASM-compatible integration tests will enable automated verification of identity key generation, prekey bundle uploads, X3DH session establishment, and ratchet message exchanges.

---

## 3. Caveats

- **Multi-Device Scope**: Current Velum schema associates 1 prekey bundle per `userId` (unique constraint `user_prekeys_user_id_unique`). Multi-device support can use `deviceId: 1` as standard until multi-device bundle indexing is required.
- **Client Key Migration Reset**: In accordance with `pending.migration.md`, existing P-256 keys in IndexedDB are mathematically incompatible with Curve25519; migrating to libsignal-client requires wiping old client-side crypto state and re-uploading new Signal prekey bundles.
- **Post-Quantum Kyber Prekeys**: If libsignal PQXDH (Kyber) is enabled, additional optional fields (`kyberPreKeyId`, `kyberPreKeyPublic`, `kyberPreKeySignature`) may be added to prekey bundles; however, standard X3DH Curve25519 bundles operate without them.

---

## 4. Conclusion

The Velum backend architecture is well-structured for the `@signalapp/libsignal-client` migration. The required changes are localized to:
1. Adding `registration_id` and `signed_prekey_id` to `server/v2/db/schema/keys.ts` and updating `prekeyVaultService.ts`.
2. Standardizing the prekey bundle payload format to Base64 Curve25519 keys with numerical key IDs.
3. Unifying redundant prekey endpoints across `cryptoRoutes.ts` and `userRoutes.ts`.
4. Adding `"test": "vitest run"` to `package.json` and implementing automated X3DH/Double Ratchet test suites.

---

## 5. Verification Method

1. **Schema & Endpoint Inspection**:
   - View `server/v2/db/schema/keys.ts` to confirm `user_prekeys` definition.
   - View `server/v2/routes/cryptoRoutes.ts` and `server/v2/services/crypto/prekeyVaultService.ts` to inspect prekey upload and consumption logic.
2. **Build and Lint Validation**:
   - Run `npm run lint` (`tsc --noEmit`) to verify TypeScript type compliance across backend and frontend.
   - Run `npm run build` (`vite build && esbuild server/index.ts ...`) to confirm build integrity.
3. **Test Runner Execution**:
   - Execute `npx vitest run` to run existing backend and frontend test suites.
   - Invalidation conditions: Any test failure or failure of `publishPrekeyBundle` to store or retrieve Curve25519 bundles.
