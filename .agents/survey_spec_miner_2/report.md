# Specification & Dependency Mining Report: `@signalapp/libsignal-client` Integration

**Date**: 2026-08-15  
**Target Project**: Velum End-to-End Encryption Migration  
**Author**: `survey_spec_miner_2`

---

## Executive Summary

This report delivers the complete technical specification, TypeScript API contracts, packaging details, WASM / bundler integration constraints, cryptographic byte structures, and storage interface requirements for migrating Velum from its custom WebCrypto P-256 layer to `@signalapp/libsignal-client`.

---

## 1. Project & Build Environment Inspection

### 1.1 Current Architecture & Toolchain
- **Runtime & Bundler**: Vite `^8.1.3`, Rollup, ESBuild `^0.28.1`, TSX `^4.22.4`, Node.js (ESM `"type": "module"`).
- **TypeScript**: TypeScript `^5.4.5`, configured with `"moduleResolution": "bundler"`, `"target": "ES2022"`, `"module": "ESNext"`, `"skipLibCheck": true`.
- **Database & Storage**:
  - Client: `idb` `^8.0.3` (IndexedDB wrapper), currently maintaining `velum_crypto_vault` (version 26).
  - Server: PostgreSQL / Neon Serverless (`@neondatabase/serverless` `^1.1.0`), Drizzle ORM (`drizzle-orm` `^0.45.2`), Express `^4.19.2`.
- **Crypto Services**:
  - `src/services/cryptoDbStore.ts`: Custom IndexedDB key and conversation state storage.
  - `src/services/doubleRatchetService.ts`: Custom WebCrypto P-256 / AES-GCM Double Ratchet implementation.
  - `src/services/encryptionService.ts`: Encryption dispatcher handling direct messages (`ratchet:v2:`) and lounge rooms (`VEL_E2EE[...]`).
  - `server/v2/routes/cryptoRoutes.ts`: Prekey bundle upload/download and safety number generation.
  - `server/v2/services/crypto/prekeyVaultService.ts`: Prekey database management.
  - `server/v2/db/schema/keys.ts`: `user_prekeys` PostgreSQL table schema.

---

## 2. Packaging, Import & WASM / Native Initialization

### 2.1 Package Distribution Structure
`@signalapp/libsignal-client` is published on npm as an ESM package with the following layout:
- **`main`**: `dist/index.js`
- **`types`**: `dist/index.d.ts`
- **Native Binaries (`node-gyp-build`)**:
  - `prebuilds/linux-x64/@signalapp+libsignal-client.node`
  - `prebuilds/linux-arm64/@signalapp+libsignal-client.node`
  - `prebuilds/darwin-x64/@signalapp+libsignal-client.node`
  - `prebuilds/darwin-arm64/@signalapp+libsignal-client.node`
  - `prebuilds/win32-x64/@signalapp+libsignal-client.node`
  - `prebuilds/win32-arm64/@signalapp+libsignal-client.node`
- **Dependencies**: `node-gyp-build` (`^4.8.0`), `type-fest` (`^4.26.0`).

### 2.2 Execution Contexts: Node.js vs Browser

| Environment | Loading Mechanism | Constraints & Requirements |
|---|---|---|
| **Node.js (Backend / CLI / Test Runner)** | Loaded dynamically via `node-gyp-build` from prebuilt binary. | Works natively in Node.js 16+, 20+, 24+ without compilation. |
| **Browser (Vite / Rollup Frontend)** | Browser cannot execute `.node` native binary addons directly. | Requires Vite bundler configuration (WASM build, `@signalapp/libsignal-client` browser bundle, or WASM bridge with top-level await). |

### 2.3 Bundler & Polyfill Requirements for Vite (`vite.config.ts`)
To prevent Vite from breaking on native Node imports or WASM modules:
1. Configure Vite `optimizeDeps.exclude` for `@signalapp/libsignal-client` if loaded dynamically.
2. If bundling for web with WASM: Enable `vite-plugin-wasm` and `vite-plugin-top-level-await` (or use Webpack/Rollup WASM loader).
3. Ensure `globalThis.crypto` and `Uint8Array` / `ArrayBuffer` compatibility.
4. Ensure SSR / Node builds externalize `@signalapp/libsignal-client`.

---

## 3. Storage Adapters Contract (`idb` Integration)

The `@signalapp/libsignal-client` protocol engine relies on 5 core store abstractions:

### 3.1 `IdentityKeyStore`
```typescript
export declare enum Direction {
    Sending = 0,
    Receiving = 1
}

export declare enum IdentityChange {
    NewOrUnchanged = 0,
    ReplacedExisting = 1
}

export declare abstract class IdentityKeyStore {
    abstract getIdentityKey(): Promise<PrivateKey>;
    getIdentityKeyPair(): Promise<IdentityKeyPair>;
    abstract getLocalRegistrationId(): Promise<number>;
    abstract saveIdentity(name: ProtocolAddress, key: PublicKey): Promise<IdentityChange>;
    abstract isTrustedIdentity(name: ProtocolAddress, key: PublicKey, direction: Direction): Promise<boolean>;
    abstract getIdentity(name: ProtocolAddress): Promise<PublicKey | null>;
}
```

### 3.2 `PreKeyStore`
```typescript
export declare abstract class PreKeyStore {
    abstract savePreKey(id: number, record: PreKeyRecord): Promise<void>;
    abstract getPreKey(id: number): Promise<PreKeyRecord>;
    abstract removePreKey(id: number): Promise<void>;
}
```

### 3.3 `SignedPreKeyStore`
```typescript
export declare abstract class SignedPreKeyStore {
    abstract saveSignedPreKey(id: number, record: SignedPreKeyRecord): Promise<void>;
    abstract getSignedPreKey(id: number): Promise<SignedPreKeyRecord>;
}
```

### 3.4 `SessionStore`
```typescript
export declare abstract class SessionStore {
    abstract saveSession(name: ProtocolAddress, record: SessionRecord): Promise<void>;
    abstract getSession(name: ProtocolAddress): Promise<SessionRecord | null>;
    abstract getExistingSessions(addresses: ProtocolAddress[]): Promise<SessionRecord[]>;
}
```

### 3.5 `SenderKeyStore` (Group / Sublounge Channels)
```typescript
export declare abstract class SenderKeyStore {
    abstract saveSenderKey(sender: ProtocolAddress, distributionId: Uuid, record: SenderKeyRecord): Promise<void>;
    abstract getSenderKey(sender: ProtocolAddress, distributionId: Uuid): Promise<SenderKeyRecord | null>;
}
```

---

## 4. Cryptographic Types & Serialization Formats

### 4.1 Key Formats and Byte Encodings
- **`PublicKey`**:
  - `PublicKey.deserialize(buf: Uint8Array)`: Accepts 33-byte serialized public key (Curve25519 coordinate prefixed by `0x05` DJB type byte).
  - `publicKey.serialize()`: Returns `Uint8Array` (33 bytes).
  - `publicKey.getPublicKeyBytes()`: Returns raw 32 bytes or 33 bytes.
  - `publicKey.verify(msg: Uint8Array, sig: Uint8Array)`: Verifies 64-byte signature.
- **`PrivateKey`**:
  - `PrivateKey.generate()`: Generates random Curve25519 private key.
  - `PrivateKey.deserialize(buf: Uint8Array)`: Deserializes 32-byte private key.
  - `privateKey.serialize()`: Returns `Uint8Array` (32 bytes).
  - `privateKey.getPublicKey()`: Returns associated `PublicKey`.
  - `privateKey.sign(msg: Uint8Array)`: Produces 64-byte signature (`Uint8Array`).
  - `privateKey.agree(otherKey: PublicKey)`: Computes 32-byte X25519 shared secret.
- **`IdentityKeyPair`**:
  - `new IdentityKeyPair(publicKey: PublicKey, privateKey: PrivateKey)`.
  - `IdentityKeyPair.generate()`.
  - `IdentityKeyPair.deserialize(buf: Uint8Array)`.
  - `identityKeyPair.serialize()`: Returns serialized binary structure.
- **`PreKeyRecord`**:
  - `PreKeyRecord.new(id: number, pubKey: PublicKey, privKey: PrivateKey)`.
  - `PreKeyRecord.deserialize(buf: Uint8Array)`.
  - `preKeyRecord.serialize()`: Returns protobuf-encoded binary record.
- **`SignedPreKeyRecord`**:
  - `SignedPreKeyRecord.new(id: number, timestamp: number, pubKey: PublicKey, privKey: PrivateKey, signature: Uint8Array)`.
  - `SignedPreKeyRecord.deserialize(buf: Uint8Array)`.
  - `signedPreKeyRecord.serialize()`: Returns protobuf-encoded binary record.
- **`SessionRecord`**:
  - `SessionRecord.deserialize(buf: Uint8Array)`.
  - `sessionRecord.serialize()`: Returns protobuf-encoded session state.
- **`ProtocolAddress`**:
  - `ProtocolAddress.new(name: string, deviceId: number)`.
  - In Velum: `name` is `${userId}` (e.g. `"42"`), `deviceId` is `1` (or device integer 1-127).

### 4.2 Wire & API JSON Serialization Format
For HTTP exchanges with `/v2/crypto/prekeys` and `/v2/crypto/prekeys/:userId`:
- All binary byte arrays (`Uint8Array`) MUST be encoded as standard **Base64** strings.
- **Prekey Bundle Payload**:
  ```typescript
  interface PrekeyBundlePayload {
    registrationId: number;
    deviceId: number;
    identityKey: string;           // Base64 (33 bytes)
    signedPrekeyId: number;        // integer
    signedPrekey: string;          // Base64 (33 bytes)
    signedPrekeySignature: string; // Base64 (64 bytes)
    oneTimePrekeys: Array<{
      keyId: number;
      publicKey: string;           // Base64 (33 bytes)
    }>;
  }
  ```

---

## 5. Encryption & Decryption Pipeline

### 5.1 X3DH Session Initiation
```typescript
// Receiver publishes bundle to server:
const identityKeyPair = IdentityKeyPair.generate();
const signedPreKey = SignedPreKeyRecord.new(
  1,
  Date.now(),
  signedKeyPair.publicKey,
  signedKeyPair.privateKey,
  identityKeyPair.privateKey.sign(signedKeyPair.publicKey.serialize())
);
const oneTimePreKeys = Array.from({ length: 50 }, (_, i) => 
  PreKeyRecord.new(i + 1, otKeyPair.publicKey, otKeyPair.privateKey)
);

// Sender fetches PreKeyBundle from server:
const remoteAddress = ProtocolAddress.new(String(peerUserId), 1);
const localAddress = ProtocolAddress.new(String(myUserId), 1);

const bundle = PreKeyBundle.new(
  remoteRegId,
  1, // deviceId
  oneTimePreKeyId, // or null if exhausted
  oneTimePreKeyPublic, // or null
  signedPreKeyId,
  signedPreKeyPublic,
  signedPreKeySignature,
  remoteIdentityKey
);

await processPreKeyBundle(bundle, remoteAddress, localAddress, sessionStore, identityStore);
```

### 5.2 Sending Messages
```typescript
const ciphertextMsg = await signalEncrypt(
  new TextEncoder().encode(plaintext),
  remoteAddress,
  localAddress,
  sessionStore,
  identityStore
);

const serializedBytes = ciphertextMsg.serialize();
const msgType = ciphertextMsg.type(); // 2: Whisper (SignalMessage), 3: PreKey (PreKeySignalMessage)
const envelopePayload = `ratchet:v3:${msgType}:${bytesToBase64(serializedBytes)}`;
```

### 5.3 Receiving Messages
```typescript
if (msgType === CiphertextMessageType.PreKey) {
  const preKeyMsg = PreKeySignalMessage.deserialize(bytes);
  const decryptedBytes = await signalDecryptPreKey(
    preKeyMsg,
    remoteAddress,
    localAddress,
    sessionStore,
    identityStore,
    prekeyStore,
    signedPrekeyStore
  );
  return new TextDecoder().decode(decryptedBytes);
} else if (msgType === CiphertextMessageType.Whisper) {
  const signalMsg = SignalMessage.deserialize(bytes);
  const decryptedBytes = await signalDecrypt(
    signalMsg,
    remoteAddress,
    localAddress,
    sessionStore,
    identityStore
  );
  return new TextDecoder().decode(decryptedBytes);
}
```

---

## 6. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Keys | `IdentityKeyPair` | Long-term identity key pair (Curve25519) | None / `Uint8Array` | `IdentityKeyPair` | Throws on invalid buffer | `dist/EcKeys.d.ts` |
| 2 | Keys | `PrivateKey.generate` | Generate random X25519 / Ed25519 private key | None | `PrivateKey` | N/A | `dist/EcKeys.d.ts` |
| 3 | Keys | `PrivateKey.sign` | Ed25519 digital signature over message bytes | `msg: Uint8Array` | `Uint8Array` (64 bytes) | Throws on invalid state | `dist/EcKeys.d.ts` |
| 4 | Keys | `PublicKey.verify` | Signature verification over message | `msg: Uint8Array, sig: Uint8Array` | `boolean` | Returns `false` on mismatch | `dist/EcKeys.d.ts` |
| 5 | Keys | `PrivateKey.agree` | ECDH key agreement over Curve25519 | `otherKey: PublicKey` | `Uint8Array` (32 bytes) | Throws on invalid public key | `dist/EcKeys.d.ts` |
| 6 | Storage | `IdentityKeyStore` | Abstract interface for local & remote identity keys | Local keys, remote addresses | Promises with keys / trust bool | Throws on storage failure | `dist/index.d.ts` |
| 7 | Storage | `PreKeyStore` | Abstract interface for One-Time Prekeys | Key ID (`number`), `PreKeyRecord` | `void` / `PreKeyRecord` | Throws if key ID not found | `dist/index.d.ts` |
| 8 | Storage | `SignedPreKeyStore` | Abstract interface for Signed Prekeys | Key ID (`number`), `SignedPreKeyRecord` | `void` / `SignedPreKeyRecord` | Throws if key ID not found | `dist/index.d.ts` |
| 9 | Storage | `SessionStore` | Abstract interface for Ratchet session state | `ProtocolAddress`, `SessionRecord` | `void` / `SessionRecord` | Throws on DB read/write error | `dist/index.d.ts` |
| 10 | Storage | `SenderKeyStore` | Abstract interface for group sender keys | `ProtocolAddress`, `Uuid`, `SenderKeyRecord` | `void` / `SenderKeyRecord` | Throws on DB read/write error | `dist/index.d.ts` |
| 11 | Handshake | `PreKeyBundle.new` | Constructs a prekey bundle for X3DH handshake | Registration ID, device ID, prekeys, signatures, identity key | `PreKeyBundle` | Throws on parameter validation error | `dist/ProtocolTypes.d.ts` |
| 12 | Handshake | `processPreKeyBundle` | Establishes outbound Signal session from bundle | `PreKeyBundle`, `address`, `localAddress`, stores | `Promise<void>` | Throws `UntrustedIdentityError` or `InvalidSessionError` | `dist/index.d.ts` |
| 13 | Messaging | `signalEncrypt` | Encrypts plaintext using established Double Ratchet session | `message: Uint8Array`, addresses, stores | `Promise<CiphertextMessage>` | Throws `InvalidSessionError` if no session | `dist/index.d.ts` |
| 14 | Messaging | `signalDecrypt` | Decrypts normal `SignalMessage` (Whisper) | `SignalMessage`, addresses, stores | `Promise<Uint8Array>` | Throws `DuplicatedMessageError` / `VerificationFailedError` | `dist/index.d.ts` |
| 15 | Messaging | `signalDecryptPreKey` | Decrypts initial `PreKeySignalMessage` | `PreKeySignalMessage`, addresses, stores | `Promise<Uint8Array>` | Throws `InvalidRegistrationIdError` / `UntrustedIdentityError` | `dist/index.d.ts` |
| 16 | Group | `groupEncrypt` | Encrypts group message using Sender Keys | `sender: ProtocolAddress`, `Uuid`, `SenderKeyStore`, `Uint8Array` | `Promise<CiphertextMessage>` | Throws `InvalidSenderKeySessionError` | `dist/index.d.ts` |
| 17 | Group | `groupDecrypt` | Decrypts group message using Sender Keys | `sender: ProtocolAddress`, `SenderKeyStore`, `Uint8Array` | `Promise<Uint8Array>` | Throws `InvalidSenderKeySessionError` | `dist/index.d.ts` |
| 18 | Fingerprint | `Fingerprint.new` | Generates displayable and scannable safety numbers | Iterations, version, identifiers, keys | `Fingerprint` | Throws on invalid input length | `dist/index.d.ts` |
| 19 | Post-Quantum | `KyberPreKeyStore` | PQ KEM Prekey storage (ML-KEM / Kyber-1024) | Key ID, `KyberPreKeyRecord` | `void` / `KyberPreKeyRecord` | Throws on store failure | `dist/index.d.ts` |

---

## 7. Edge Cases & Operational Considerations

| # | Feature | Input / Condition | Observed / Documented Behavior |
|---|---------|-------------------|--------------------------------|
| 1 | `processPreKeyBundle` | `preKeyId` and `preKeyPublic` are `null` (One-time prekeys exhausted on server) | Protocol gracefully falls back to X3DH without one-time prekey using only Signed Prekey + Identity Key. |
| 2 | `signalDecrypt` | Out-of-order message arrival | The Double Ratchet handles skipped message keys automatically in `SessionRecord` up to the max skip threshold (2000). |
| 3 | `signalDecrypt` | Duplicate message replay | Throws `DuplicatedMessageError` (`ErrorCode.DuplicatedMessage = 1`). Must be caught and safely ignored. |
| 4 | `isTrustedIdentity` | Remote peer identity key changes (app reinstall) | Returns `false` or throws `UntrustedIdentityError` (`ErrorCode.UntrustedIdentity = 3`). Auto-heal or security prompt required. |
| 5 | `SessionStore.getSession` | No prior session exists with peer | Must return `null`. If `null`, sending fails until `processPreKeyBundle` is called; receiving requires `signalDecryptPreKey`. |
| 6 | `PreKeyStore.getPreKey` | Prekey ID has already been deleted / consumed | Must throw an error so the protocol knows this one-time prekey cannot be reused. |
| 7 | Multi-user Isolation | Multiple user accounts logging in on same browser origin | Storage keys in IndexedDB must be strictly namespaced by `${localUserId}` to prevent cross-account session corruption. |
| 8 | Large Attachments | File upload payload > 64KB | Attachments should use symmetric AES-GCM media keys encrypted via the Signal ratchet channel, rather than raw ratchet serialization. |

---

## 8. Summary of Migration Blueprint for Subsequent Steps

1. **Step 1 (Package & Bundler)**:
   - Configure `@signalapp/libsignal-client` and Vite/Rollup polyfills / WASM resolution in `vite.config.ts`.
2. **Step 2 (Store Adapter)**:
   - Rewrite `src/services/cryptoDbStore.ts` to implement `IdentityKeyStore`, `PreKeyStore`, `SignedPreKeyStore`, `SessionStore`, `SenderKeyStore`.
3. **Step 3 (Backend Key Exchange)**:
   - Update `server/v2/routes/cryptoRoutes.ts` and `prekeyVaultService.ts` to handle base64-encoded Curve25519 bundles and registration IDs.
4. **Step 4 (Ratchet Service & Dispatcher)**:
   - Replace `doubleRatchetService.ts` internals with `processPreKeyBundle`, `signalEncrypt`, `signalDecrypt`, `signalDecryptPreKey`.
5. **Step 5 (Verification & Test Harness)**:
   - Add automated end-to-end tests for bidirectional messaging, out-of-order delivery, and build verification (`npm run build`).
