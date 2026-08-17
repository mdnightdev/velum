# Handoff Report — Frontend Crypto Architecture & Signal Protocol Migration Survey

## 1. Observation
- **Frontend Crypto Services Inspected**:
  - `src/services/cryptoDbStore.ts` (lines 1-374): Direct WebCrypto P-256 JWK export/import (`subtle.importKey('jwk', ..., { name: 'ECDH', namedCurve: 'P-256' })` at lines 129-130, 267-268, 273), managing `velum_crypto_vault` IndexedDB stores `local_keys`, `conversation_states`, and `skipped_message_keys`.
  - `src/services/doubleRatchetService.ts` (lines 1-795): Custom X3DH handshake (lines 278-380), Double Ratchet chain derivation (lines 385-455), AES-GCM encryption with 12-byte random IV (lines 509-517), HMAC-SHA256 envelope signing (lines 547-552), out-of-order skipped key derivation (lines 698-708), and auto-heal rekeying `forceRekey()` (lines 760-791).
  - `src/services/encryptionService.ts` (lines 1-185): Single entrypoint `encryptMessage()` and `decryptMessage()`. Dispatches direct messages to `doubleRatchetService`, lounge rooms to UTF-8 XOR cipher (`VEL_E2EE[...]`), and traps decryption error sentinels (`activeHeals` set with 5-second cooldown at lines 91-120) to trigger background `forceRekey()`.
  - `src/services/skippedKeysStore.ts` (lines 1-233): Object store `skipped_message_keys` in `velum_crypto_vault` for storing AES-GCM keys for late message arrival, deleting upon consumption (`consumeSkippedMessageKey` at lines 128-179).
  - `src/services/localVaultEncryption.ts` (lines 1-102): AES-GCM-256 encryption layer for local message cache in `velum_local_storage`, with 24-hour periodic key rotation check (lines 72-83) and salt shredding.
  - `src/services/outboxEngine.ts` (lines 1-127): Protocol-agnostic offline message queue stored in `velum_local_storage` (store `outbox_messages`, keyPath `client_msg_id`).
- **UI & Lifecycle Integration**:
  - `src/components/Chat/hooks/useMessageDecryption.ts` (lines 1-135): Manages asynchronous decryption for rendered message lists with a 2000-item in-memory cache `cacheRef`.
  - `src/components/ChatArea.tsx` (lines 310-387): Embeds attachments (`[Attachment: ...]`) and voice notes (`[Voice Note ...]`) into message text, encrypts via `encryptOutgoingMessage()`, passes `ratchet:v2:...` envelope to WebSocket.
  - `src/hooks/useWebSocket.ts` (lines 515-594): Sends optimistic UI messages, enqueues to `outboxEngine`, emits `send_message` WebSocket frame, drains queue on reconnect via `drainOutboxQueue()`.
  - `src/context/AuthContext.tsx` (lines 53-111): On logout or identity mismatch, purges `velum_crypto_vault` (`purgeCryptoVault`), skipped keys (`purgeSkippedMessageKeys`), and message cache (`purgeLocalMessages`).
  - `src/components/DashboardLayout.tsx` (line 201): Initializes crypto keys on login via `doubleRatchetService.initializeLocalKeys()`.
- **Server Interfaces**:
  - `server/v2/routes/cryptoRoutes.ts` & `server/v2/routes/userRoutes.ts`: Endpoints `POST /v2/crypto/prekeys`, `GET /v2/crypto/prekeys/:userId`, `POST /v2/user/keys/prekey-bundle`, `GET /v2/user/:id/prekey-bundle`.
  - `server/v2/db/schema/keys.ts` & `server/v2/services/crypto/prekeyVaultService.ts`: `user_prekeys` table storing `identity_key`, `signed_prekey`, `signed_prekey_signature`, and `one_time_prekeys` (JSON array of JWK strings with atomic single-use consumption).

## 2. Logic Chain
1. *Observation*: The current crypto layer uses NIST P-256 WebCrypto JWK strings for key generation, storage, exchange, and derivation.
2. *Deduction*: `@signalapp/libsignal-client` requires Curve25519 (X25519 for DH, Ed25519 for signatures) and binary protobuf formats. A mathematical migration of existing P-256 keys/sessions is impossible.
3. *Deduction*: A clean reset of `velum_crypto_vault` object stores (`conversation_states`, `skipped_message_keys`, and `local_keys`) is necessary upon deploying `libsignal-client`.
4. *Observation*: The application presentation layer (`ChatArea.tsx`, `useMessageDecryption.ts`) only calls `encryptionService.ts` (`encryptMessage` / `decryptMessage`) and treats ciphertext envelopes as opaque strings (`ratchet:v2:...` or `signal:v1:...`).
5. *Deduction*: Replacing `doubleRatchetService.ts` with a Signal `SessionCipher` wrapper behind `encryptionService.ts` isolates all cryptographic changes from the React UI components, requiring zero UI markup refactoring.
6. *Observation*: Attachments and voice notes are encoded into plain text strings (`[Attachment: ...]` and `[Voice Note ...]`) prior to encryption in `ChatArea.tsx` line 350 and line 287.
7. *Deduction*: Attachment transport will remain 100% functional through `SessionCipher.encrypt` without needing separate binary attachment encryption pipelines.
8. *Observation*: `outboxEngine.ts` stores opaque `content` strings in `outbox_messages`.
9. *Deduction*: Offline queueing and message re-transmission will work out of the box with Signal Protocol ciphertext.

## 3. Caveats
- No changes were made to source files during this read-only investigation.
- Server-side prekey bundle endpoints currently expect JWK strings; backend schema and endpoints must be updated in tandem to handle Signal registration IDs and Ed25519 signatures.
- WASM bundling in Vite and test execution in Vitest/Node.js requires verification with `@signalapp/libsignal-client` package installation.

## 4. Conclusion
Velum's frontend crypto layer is cleanly isolated behind `src/services/encryptionService.ts` and `src/services/cryptoDbStore.ts`. Migrating to `@signalapp/libsignal-client` requires:
1. Implementing the standard Signal Protocol storage adapter in `cryptoDbStore.ts` (`IdentityKeyStore`, `PreKeyStore`, `SignedPreKeyStore`, `SessionStore`).
2. Replacing custom P-256 ECDH/HKDF Double Ratchet in `doubleRatchetService.ts` with `SessionCipher`, `SessionBuilder`, and `processPreKeyBundle`.
3. Updating backend schema (`user_prekeys`) and prekey endpoints to transport Signal prekey bundles.
4. Executing a clean reset of client `velum_crypto_vault` stores on boot.

## 5. Verification Method
1. Inspect the survey report at `/root/velum/.agents/survey_explorer_1/report.md`.
2. Verify all listed file paths and line numbers match `/root/velum/src/` via `view_file`.
3. Inspect `package.json` and `vite.config.ts` to confirm build and WASM readiness.
