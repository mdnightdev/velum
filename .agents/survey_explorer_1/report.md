# Technical Survey Report: Velum Frontend Crypto Architecture & Signal Protocol Migration Analysis

## 1. Executive Summary

This report delivers a comprehensive technical survey of Velum's existing cryptographic subsystem across the frontend (`src/`) and backend key exchange interfaces (`server/v2/`). It catalogs all data models, state flows, ratchet mechanisms, IndexedDB persistence layouts, WebCrypto/P-256 touchpoints, offline queue semantics, and auto-healing fallbacks to provide an authoritative specification for migrating to `@signalapp/libsignal-client`.

---

## 2. Crypto Architecture & API Topology Map

Velum divides encryption responsibilities into direct 1:1 communications (E2EE Double Ratchet) and multi-user group communications (Lounge XOR encryption), backed by client-side encrypted IndexedDB storage.

### 2.1 Component Interaction Graph

```
[UI Presentation Layer: ChatArea / MessageList / Sidebar]
                      │
                      ▼
[Decryption Hook: useMessageDecryption] <──> [Cache (Ref, 2000 max)]
                      │
                      ▼
[Central Service: encryptionService.ts]
      │                               │
      │ (type: 'direct')              │ (type: 'lounge')
      ▼                               ▼
[doubleRatchetService.ts]      [XOR UTF-8 cipher]
      │
      ├── [X3DH Handshake & DH Ratchet]
      ├── [HKDF-SHA256 & AES-GCM-256 + HMAC-SHA256]
      ├── [Persistence: cryptoDbStore.ts] ──> IndexedDB: velum_crypto_vault
      └── [Out-of-Order: skippedKeysStore.ts] ──> IndexedDB: velum_crypto_vault (skipped_message_keys)

[Network & Offline Layer: useWebSocket.ts]
      │
      ├── [outboxEngine.ts] ──> IndexedDB: velum_local_storage (outbox_messages)
      └── [localVaultEncryption.ts] ──> IndexedDB: velum_local_storage (messages)
```

---

## 3. Comprehensive File-by-File Crypto Inventory

| File Path | Role & Responsibilities | Cryptographic Primitives Used | Key Data Structures |
|---|---|---|---|
| `src/services/cryptoDbStore.ts` | IndexedDB abstraction for `velum_crypto_vault`. Manages local key pairs, Double Ratchet conversation state records, checksum validation, and local vault key. | WebCrypto `SubtleCrypto` (`exportKey`, `importKey`, `digest` SHA-256), ECDH P-256 JWK, AES-GCM 256 JWK | `local_keys` store (keyPath `id`), `conversation_states` store (keyPath `id`), `skipped_message_keys` store |
| `src/services/doubleRatchetService.ts` | Custom Double Ratchet and X3DH protocol implementation. Manages ratchet chains, message key derivation, AES-GCM encryption/decryption, HMAC authentication, prekey bundles, and re-key healing. | ECDH P-256, HKDF-SHA256, AES-GCM 256, HMAC-SHA256, `window.crypto.getRandomValues` | `KeyPair`, `PrekeyBundle`, `RatchetState`, `RatchetHeader`, `RatchetMessageEnvelope` |
| `src/services/encryptionService.ts` | Unified dispatcher for encryption and decryption. Dispatches direct messages to `doubleRatchetService`, lounge messages to XOR cipher, traps decryption errors to invoke `forceRekey`. | WebCrypto `SubtleCrypto.digest` SHA-256 (`computeClientHash`), XOR bitwise cipher | `EncryptionContext` (`{ type, roomId, peerUserId, isEncrypted }`) |
| `src/services/skippedKeysStore.ts` | Persistence store for skipped message keys enabling out-of-order message decryption with forward secrecy. Deletes keys once consumed. | WebCrypto `SubtleCrypto` (`exportKey`, `importKey` AES-GCM 256 JWK) | `SkippedMessageKeyRecord` (`id: ${roomId}:${senderUserId}:${chainLength}:${messageIndex}`) |
| `src/services/localVaultEncryption.ts` | Forward-secrecy encryption layer for local message cache in `velum_local_storage`. Supports 24-hour key rotation and salt validation. | WebCrypto `SubtleCrypto` (`generateKey`, `encrypt`, `decrypt` AES-GCM 256), `getRandomValues` | `{ ciphertextHex, ivHex, saltHex }`, `local_vault_key` record in `velum_crypto_vault` |
| `src/services/outboxEngine.ts` | Persistent offline message queue backed by IndexedDB. Drains and re-transmits queued frames upon WebSocket reconnection. | Plain JSON / Binary storage in IndexedDB (`velum_local_storage`) | `OutboxPayload` (`client_msg_id`, `room_id`, `content`, `is_encrypted`, `timestamp`, `retryCount`) |
| `src/hooks/useWebSocket.ts` | WebSocket lifecycle, optimistic message insertion, outbox integration, periodic vault rotation invocation. | Calls `encryptMessage`, `drainOutboxQueue`, `LocalVaultEncryption.checkAndRotatePeriodically` | WebSocket messages, active connection state |
| `src/components/Chat/hooks/useMessageDecryption.ts` | Asynchronous decryption pipeline hook for message lists with memory-bounded LRU cache (2000 entries). | Calls `decryptMessage` and `encryptMessage` | `decryptedMap: Record<string, string>`, `cacheRef` |
| `src/components/ChatArea.tsx` | UI chat container. Formats attachments and voice notes into standard payload strings, triggers DM encryption via `encryptOutgoingMessage`. | Prepares `[Attachment: ...]` / `[Voice Note ...]` strings, invokes encryption hook | `Attachment`, `Message` |
| `src/context/AuthContext.tsx` | Authentication state, session boot verification, logout/identity switch purge routines. | Calls `purgeCryptoVault`, `purgeSkippedMessageKeys`, `purgeLocalMessages`, `clearMemoryState` | `AuthUser`, session tokens |
| `src/utils/safetyNumber.ts` | Computes Signal-style 30-digit Safety Numbers (6 blocks of 5 digits) from two public identity keys. | WebCrypto `crypto.subtle.digest('SHA-256')`, JWK canonicalization | 6-block 5-digit string (`00000 00000 00000 00000 00000 00000`) |
| `src/utils/indexedDb.ts` | Local storage DB wrapper (`velum_local_storage`) for message caches and media blobs with vault encryption. | Integrated with `LocalVaultEncryption` | `messages`, `media_blobs`, `outbox_messages` |
| `src/components/Auth/utils/crypto.ts` | Client-side password hashing before transmission. | `window.crypto.subtle.digest('SHA-256')` | SHA-256 hex string |
| `src/utils/mediaMetadata.ts` | Computes file checksums and blurhashes. | `crypto.subtle.digest('SHA-256')` | SHA-256 checksum string |
| `src/utils/deviceFingerprint.ts` | Generates stable device identifier from hardware characteristics. | `crypto.subtle.digest('SHA-256')` | 32-char hex string |
| `server/v2/routes/cryptoRoutes.ts` | Express router for prekey publishing (`POST /v2/crypto/prekeys`), prekey retrieval (`GET /v2/crypto/prekeys/:userId`), and safety number computation. | Relies on `prekeyVaultService.ts` | `PrekeyBundlePayload`, `user_prekeys` table |
| `server/v2/routes/userRoutes.ts` | Redundant user prekey endpoints (`POST /v2/user/keys/prekey-bundle`, `GET /v2/user/:id/prekey-bundle`). | Drizzle ORM queries against `user_prekeys` | `user_prekeys` schema |
| `server/v2/services/crypto/prekeyVaultService.ts` | Backend prekey store service. Atomic single-use consumption of One-Time Prekeys from JSON pool. | Node.js `crypto.createHash('sha256')` | `userPrekeys` table interactions |

---

## 4. Line-by-Line WebCrypto / P-256 Touchpoint Catalog

The following is an exhaustive line-by-line index of WebCrypto APIs, P-256 curves, ECDH operations, and JWK serialization that must be adapted during migration:

### `src/services/cryptoDbStore.ts`
- **Line 89**: `const subtle = window.crypto.subtle;`
- **Line 91**: `await subtle.exportKey('jwk', kp.publicKey)` — Exports ECDH P-256 public key.
- **Line 92**: `await subtle.exportKey('jwk', kp.privateKey)` — Exports ECDH P-256 private key.
- **Line 127**: `const subtle = window.crypto.subtle;`
- **Line 129**: `await subtle.importKey('jwk', kp.publicKey, { name: 'ECDH', namedCurve: 'P-256' }, true, [])` — Imports ECDH P-256 public key.
- **Line 130**: `await subtle.importKey('jwk', kp.privateKey, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits'])` — Imports ECDH P-256 private key.
- **Line 146**: `const subtle = window.crypto.subtle;`
- **Line 163**: `await subtle.exportKey('jwk', state.dhRatchetKeyPair.publicKey)` — Exports DH ratchet public key.
- **Line 164**: `await subtle.exportKey('jwk', state.dhRatchetKeyPair.privateKey)` — Exports DH ratchet private key.
- **Line 169**: `await subtle.exportKey('jwk', state.dhRatchetPublicKey)` — Exports remote DH ratchet public key.
- **Line 176**: `await subtle.exportKey('jwk', cryptoKey)` — Exports skipped message key (AES-GCM).
- **Line 195**: `await subtle.digest('SHA-256', dataBytes)` — Calculates conversation state checksum.
- **Line 235-236**: `await subtle.digest('SHA-256', dataBytes)` — Validates conversation state checksum.
- **Line 267**: `await subtle.importKey('jwk', record.dhRatchetKeyPair.publicKey, { name: 'ECDH', namedCurve: 'P-256' }, true, [])` — Imports local DH ratchet public key.
- **Line 268**: `await subtle.importKey('jwk', record.dhRatchetKeyPair.privateKey, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits'])` — Imports local DH ratchet private key.
- **Line 273**: `await subtle.importKey('jwk', record.dhRatchetPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, true, [])` — Imports remote DH ratchet public key.
- **Line 281**: `await subtle.importKey('jwk', keyJwk, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])` — Imports skipped message key.
- **Line 343-344**: `await subtle.exportKey('jwk', key)` — Exports local vault AES-GCM key.
- **Line 367-368**: `await subtle.importKey('jwk', record.jwk, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])` — Imports local vault AES-GCM key.

### `src/services/doubleRatchetService.ts`
- **Line 69-72**: `getMacKey`: Exports raw AES key, hashes with SHA-256, imports as HMAC-SHA256 key (`subtle.importKey('raw', macKeyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])`).
- **Line 91-101**: `calculateStateChecksum`: Computes SHA-256 digest of ratchet state.
- **Line 210-214**: Generates local identity key pair with `{ name: 'ECDH', namedCurve: 'P-256' }`.
- **Line 217-221**: Generates signed prekey pair with `{ name: 'ECDH', namedCurve: 'P-256' }`.
- **Line 226-230**: Generates 20 one-time prekeys with `{ name: 'ECDH', namedCurve: 'P-256' }`.
- **Line 250-254**: Exports local identity, signed prekey, and one-time prekeys to JWK strings.
- **Line 282-288**: Imports peer identity key from JWK with `{ name: 'ECDH', namedCurve: 'P-256' }`.
- **Line 290-296**: Imports peer signed prekey from JWK with `{ name: 'ECDH', namedCurve: 'P-256' }`.
- **Line 299-303**: `subtle.deriveBits({ name: 'ECDH', public: peerIdentityKey }, this.localIdentityKeyPair.privateKey, 256)` (DH1).
- **Line 305-309**: `subtle.deriveBits({ name: 'ECDH', public: peerSignedPrekey }, this.localSignedPrekeyPair.privateKey, 256)` (DH2).
- **Line 311-315**: `subtle.deriveBits({ name: 'ECDH', public: peerSignedPrekey }, this.localIdentityKeyPair.privateKey, 256)` (DH3).
- **Line 317-321**: `subtle.deriveBits({ name: 'ECDH', public: peerIdentityKey }, this.localSignedPrekeyPair.privateKey, 256)` (DH4).
- **Line 325-337**: Imports peer one-time prekey and derives DH5 bits.
- **Line 365-377**: Imports combined DH bits as HKDF key, derives 256-bit root key with salt and info `'X3DH'`.
- **Line 389-393**: Generates DH ratchet key pair with `{ name: 'ECDH', namedCurve: 'P-256' }`.
- **Line 404-406**: Derives initial root key, sendChainKey, and receiveChainKey using HKDF with info `'DoubleRatchetRoot'`, `'DoubleRatchetChain_A'`, `'DoubleRatchetChain_B'`.
- **Line 427-434**: `hkdfBits`: Imports raw key into HKDF and derives bits.
- **Line 441-444**: `deriveMessageKey`: Derives 256-bit raw key from chain key and imports as `AES-GCM` 256 key.
- **Line 450-453**: `ratchetChainKey`: Derives next chain key via HKDF with info `'ChainKeyRatchet'`.
- **Line 509**: `window.crypto.getRandomValues(new Uint8Array(12))` — Generates 12-byte IV for AES-GCM.
- **Line 513-517**: `subtle.encrypt({ name: 'AES-GCM', iv }, messageKey, encoded)` — Encrypts message payload.
- **Line 529**: `subtle.exportKey('jwk', state.dhRatchetKeyPair.publicKey)` — Exports local DH ratchet public key for envelope header.
- **Line 549**: `subtle.sign('HMAC', macKey, new TextEncoder().encode(envelopeString))` — Generates envelope HMAC-SHA256.
- **Line 596-602**: `subtle.importKey('jwk', JSON.parse(envelopeData.header.dhPublicKey), { name: 'ECDH', namedCurve: 'P-256' }, true, [])` — Imports peer DH ratchet public key from envelope header.
- **Line 655**: `subtle.sign('HMAC', macKey, new TextEncoder().encode(envelopeString))` — Verifies envelope HMAC.
- **Line 678-682**: `subtle.decrypt({ name: 'AES-GCM', iv }, messageKey, combined)` — Decrypts message body.
- **Line 715-718**: `subtle.exportKey('jwk', key)` — Compares public keys via JWK coordinates `x`, `y`, `crv`.

### `src/services/skippedKeysStore.ts`
- **Line 97-98**: `subtle.exportKey('jwk', key)` — Exports skipped message key.
- **Line 166-174**: `subtle.importKey('jwk', jwk, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])` — Imports skipped message key.

### `src/utils/safetyNumber.ts`
- **Line 31**: `crypto.subtle.digest('SHA-256', data)` — Hashes canonicalized JWK strings.

---

## 5. Message Encryption & Decryption Lifecycle

### 5.1 Outgoing Direct Message Flow
1. **User Action**: User submits message (text, attachment, voice note) in `ChatArea.tsx`.
2. **Attachment Formatting**: Attachments and voice notes are uploaded to cloud storage or converted to base64 DataURLs and represented as:
   - `[Attachment: <fileName> size:<size> type:<mime> url:<storageUrl>] <captionText>`
   - `[Voice Note duration:<seconds>s url:<storageUrl>]`
3. **Dispatcher**: `ChatArea.tsx` invokes `encryptOutgoingMessage(textToSend, { type: 'direct', peerUserId })` which calls `encryptionService.encryptMessage()`.
4. **Ratchet Encryption**: `doubleRatchetService.encryptDirectMessage()` executes:
   - Checks in-memory `conversationStates` or loads from `cryptoDbStore.ts`.
   - If no state exists: fetches peer prekey bundle from `/v2/user/${peerUserId}/prekey-bundle`, runs `x3dhHandshake()`, initializes ratchet state, and saves to IndexedDB.
   - Derives `messageKey` from `sendChainKey`.
   - Advances `sendChainKey` and increments `sendChainLength`.
   - AES-GCM encrypts plaintext (12-byte IV).
   - Generates header containing local DH public key (JWK), `pn`, `n`.
   - Assembles JSON envelope, signs with HMAC-SHA256 key derived from `messageKey`, appends `hmacHex`.
   - Returns envelope prefixed with `ratchet:v2:`.
5. **Optimistic Queue & Outbox**:
   - `useWebSocket.ts` creates optimistic `Message` object with `status: 'sending'`.
   - Enqueues envelope in IndexedDB outbox queue (`outboxEngine.ts`).
   - Sends `send_message` WebSocket frame over the socket.
   - Sets 10-second ACK timer transitioning status to `failed` if unacknowledged.
6. **Server ACK**:
   - WebSocket receives `ack_message` or `message_received` with server assigned `db_message_id` and `sequence_id`.
   - `useMessageLifecycle.ts` transitions message status from `sending` to `sent`.
   - `outboxEngine.removeOutboxMessage(clientMsgId)` removes frame from persistent queue.

### 5.2 Incoming Direct Message Flow
1. **WebSocket Ingestion**: Frame received by `useWebSocket.ts` and appended to `messages` state.
2. **Decryption Hook**: `useMessageDecryption.ts` receives updated `messages` array:
   - Checks `cacheRef` (in-memory map) to avoid re-decrypting identical ciphertext.
   - Dispatches pending decryption promises to `encryptionService.decryptMessage()`.
3. **Ratchet Decryption**: `doubleRatchetService.decryptDirectMessage()`:
   - Strips `ratchet:v2:` prefix, parses JSON envelope.
   - Loads/initializes conversation state.
   - Compares envelope DH ratchet key with stored `dhRatchetPublicKey`. If different, records skipped keys for prior chain and advances DH ratchet.
   - If `n > receiveChainLength`, derives and records intermediate skipped keys to memory and `skippedKeysStore.ts`.
   - Resolves `messageKey` (either current chain key or consumed from `skippedKeysStore`).
   - Derives MAC key and verifies `hmacHex`. If mismatch, returns `'[Decryption Error - Integrity Check Failed]'`.
   - Decrypts AES-GCM ciphertext. If failure, returns `'[Encrypted Message]'`.
4. **Auto-Healing Trap**: If decryption output equals an error sentinel (`'[Encrypted Message - Skipped Key Not Found]'`, `'[Decryption Error - Integrity Check Failed]'`, or `'[Encrypted Message - No Prekey]'`), `encryptionService.ts` intercepts it:
   - Checks `activeHeals` set (prevents thundering herd with a 5-second cooldown).
   - Fires background `doubleRatchetService.forceRekey(peerId)`.
   - `forceRekey` deletes in-memory state, cached peer prekeys, IndexedDB conversation record, and skipped keys; fetches fresh bundle and re-handshakes X3DH.
5. **UI Rendering**: `useMessageDecryption` updates `decryptedMap`. `ChatArea.tsx` / `MessageItem.tsx` renders decrypted text, parsing `[Attachment: ...]` into interactive image/file cards or `[Voice Note ...]` into `AudioMessagePlayer`.

---

## 6. IndexedDB Schemas & Persistence Analysis

Velum maintains two separate IndexedDB databases on the client origin:

### Database 1: `velum_crypto_vault` (DB_VERSION = 26)

| Object Store | Key Path | Record Schema | Purpose |
|---|---|---|---|
| `local_keys` | `id` | `{ id: 'local_keys_${userId}', localUserId: number, identityKeyPair: JWKPair, signedPrekeyPair: JWKPair, oneTimePrekeys: JWKPair[] }` or `{ id: 'local_vault_key', jwk: JWK, saltHex: string }` | Stores long-term local crypto keys and local vault master key. |
| `conversation_states` | `id` | `{ id: '${localUserId}_${peerUserId}', localUserId: number, peerUserId: number, rootKey: ArrayBuffer, sendChainKey: ArrayBuffer, receiveChainKey: ArrayBuffer, sendChainLength: number, receiveChainLength: number, receiveChainGeneration: number, previousChainLength: number, dhRatchetKeyPair: JWKPair, dhRatchetPublicKey: JWK, skippedMessageKeys: Array<{ key: string, keyJwk: string }>, version: number, checksum: string }` | Persists Double Ratchet state per peer session. |
| `skipped_message_keys` | `id` | `{ id: '${roomId}:${senderUserId}:${chainLength}:${messageIndex}', roomId: string, senderUserId: number, messageIndex: number, chainLength: number, keyJwk: string, createdAt: string }` | Stores unconsumed skipped message decryption keys for out-of-order delivery. |

### Database 2: `velum_local_storage` (DB_VERSION = 25)

| Object Store | Key Path | Record Schema | Purpose |
|---|---|---|---|
| `messages` | (Out-of-line key: `roomId`) | `Array<Message>` or `{ _encrypted: true, ciphertextHex: string, ivHex: string, saltHex: string }` | Local message cache per room/lounge/DM. |
| `media_blobs` | (Out-of-line key: string) | `Blob` | Local cached avatars and downloaded media. |
| `outbox_messages` | `client_msg_id` | `OutboxPayload` (`{ client_msg_id, room_id, content, is_encrypted, expires_in, reply_to, timestamp, retryCount }`) | Offline queue for pending outgoing messages. |

---

## 7. Protocol Discrepancies & Migration Strategy to `@signalapp/libsignal-client`

### 7.1 Key Incompatibilities: WebCrypto/P-256 vs Signal Protocol

| Dimension | Existing Implementation | `@signalapp/libsignal-client` | Migration Impact |
|---|---|---|---|
| **Curve & Cryptography** | NIST P-256 (secp256r1) via WebCrypto | Curve25519 (X25519 for DH, Ed25519 for signatures) | Complete hard reset required. Old P-256 keys cannot handshake with Signal Protocol Curve25519 keys. |
| **Key Representation** | JSON Web Key (JWK) strings | Binary Protobuf / Uint8Array (`PublicKey`, `PrivateKey`, `IdentityKeyPair`) | Key serialization in DB and network endpoints must change from JWK strings to base64 / binary payloads. |
| **Session State** | Custom JSON/ArrayBuffer state object (`RatchetState`) with manual chain key derivation | `SessionRecord` (opaque serialized binary structure managed by Signal Rust/WASM core) | `conversation_states` table replaced by Signal `SessionStore`. |
| **Signed Prekeys** | Static dummy signature string (`'valid_sig_p256'`) | Cryptographically verified Ed25519 signature over X25519 public key | Backend and client must generate and verify true 64-byte Ed25519 signatures. |
| **Prekey Bundles** | JSON array of JWKs without numeric IDs | Key IDs (`registrationId`, `preKeyId`, `signedPreKeyId`, `signedPreKeySignature`) | Database schema `user_prekeys` and endpoints need numeric ID fields. |
| **Message Ciphertext** | Custom JSON envelope `ratchet:v2:{ header, ivHex, ciphertextHex, tagHex, hmacHex }` | Signal Protobuf binary messages (`PreKeySignalMessage` / `SignalMessage`) serialized as base64 string | Envelope format changes to Signal wire format (e.g. `signal:v1:${base64}`). |
| **Runtime Engine** | Browser WebCrypto API (`window.crypto.subtle`) | Rust compiled to WebAssembly (WASM) | Requires Vite WASM bundler plugin and Node.js test environment WASM compatibility. |

### 7.2 Protocol Store Architecture Requirements (`cryptoDbStore.ts`)

`@signalapp/libsignal-client` requires a storage adapter implementing the following interfaces backed by IndexedDB:

1. **`IdentityKeyStore`**:
   - `getIdentityKeyPair(): Promise<IdentityKeyPair>`
   - `getLocalRegistrationId(): Promise<number>`
   - `saveIdentity(address: ProtocolAddress, identityKey: PublicKey): Promise<boolean>`
   - `isTrustedIdentity(address: ProtocolAddress, identityKey: PublicKey, direction: Direction): Promise<boolean>`
   - `getIdentity(address: ProtocolAddress): Promise<PublicKey | null>`
2. **`PreKeyStore`**:
   - `getPreKey(preKeyId: number): Promise<PreKeyRecord>`
   - `savePreKey(preKeyId: number, record: PreKeyRecord): Promise<void>`
   - `removePreKey(preKeyId: number): Promise<void>`
3. **`SignedPreKeyStore`**:
   - `getSignedPreKey(signedPreKeyId: number): Promise<SignedPreKeyRecord>`
   - `saveSignedPreKey(signedPreKeyId: number, record: SignedPreKeyRecord): Promise<void>`
4. **`SessionStore`**:
   - `getSession(address: ProtocolAddress): Promise<SessionRecord | null>`
   - `saveSession(address: ProtocolAddress, record: SessionRecord): Promise<void>`
5. **`SenderKeyStore`** (optional for group channels if Signal Sender Keys are adopted).

### 7.3 Clean State Reset & Data Migration Procedure

1. **Database Version Bump**: Bump `velum_crypto_vault` DB version to 30.
2. **Schema Upgrade**:
   - Drop legacy stores: `conversation_states`, `skipped_message_keys`.
   - Preserve `local_keys` for `local_vault_key` (message history encryption) or migrate `local_vault_key` cleanly.
   - Create Signal Protocol stores:
     - `signal_identity_keys` (keyPath: `id`)
     - `signal_prekeys` (keyPath: `keyId`)
     - `signal_signed_prekeys` (keyPath: `keyId`)
     - `signal_sessions` (keyPath: `address`)
     - `signal_trusted_identities` (keyPath: `name`)
3. **Boot Initialization Reset**:
   - Detect legacy P-256 keys in `local_keys` on startup. If found, clear store, generate new Signal `IdentityKeyPair`, `RegistrationId`, `SignedPreKeyPair`, and 100 `PreKeyRecord`s.
   - Automatically publish fresh Curve25519 prekey bundle to backend.
   - Purge stale conversation session records to trigger fresh X3DH handshakes upon first message transmission.

---

## 8. Summary of Findings & Actionable Next Steps

1. **Clean Decoupling**: The presentation layer (`ChatArea.tsx`, `MessageItem.tsx`, `useMessageDecryption.ts`) interacts with crypto exclusively through `encryptionService.ts`. Swapping `doubleRatchetService.ts` with `libsignal-client` `SessionCipher` will require zero UI markup changes.
2. **Attachment & Voice Note Safety**: Attachment and voice note data URLs/links are embedded into the message text string before passing to the encryption pipeline. As long as `SessionCipher.encrypt` receives UTF-8 encoded text and returns a string envelope, media transport remains 100% intact.
3. **Offline Queue & Outbox**: `outboxEngine.ts` operates on opaque strings (`OutboxPayload.content`). It is fully protocol-agnostic and will seamlessly queue Signal Protocol ciphertext frames.
4. **Auto-Heal Triggering**: `encryptionService.ts` currently traps decryption error sentinels to invoke `forceRekey()`. This mechanism can be directly hooked into `SessionCipher.decrypt` exceptions to automatically invalidate sessions and re-initialize Signal sessions.
5. **Backend Alignment**: The backend `user_prekeys` table and endpoints in `server/v2/routes/cryptoRoutes.ts` and `server/v2/services/crypto/prekeyVaultService.ts` will need to support Signal prekey structures (registration ID, numeric prekey IDs, and true 64-byte Ed25519 signatures).
