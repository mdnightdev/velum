# Technical Analysis: Signal Protocol Identity & Prekey Bundle Management

## 1. Executive Summary

This report provides the architectural specification and concrete implementation blueprints for **Milestone 3 (M3: Identity & Prekey Bundle Management)** of the Velum E2EE migration from WebCrypto P-256 to `@signalapp/libsignal-client` (v0.62.0).

The investigation analyzed:
1. Native and wrapper classes in `@signalapp/libsignal-client` (`PrivateKey`, `PublicKey`, `IdentityKeyPair`, `PreKeyRecord`, `SignedPreKeyRecord`, `PreKeyBundle`, `ProtocolAddress`).
2. Exact signatures, constructors, signing methods, and Protobuf serialization mechanisms.
3. High-performance isomorphic Base64/Buffer conversion utilities.
4. Schema and contract alignment between client-side prekey generation, IndexedDB storage adapters (`cryptoDbStore.ts`), and server-side prekey vault distribution (`/v2/crypto/prekeys`).

---

## 2. @signalapp/libsignal-client Key Primitives & API Contracts

### 2.1 `PrivateKey` & `PublicKey` (Curve25519 / X25519 & Ed25519)

In `@signalapp/libsignal-client`, Curve25519 keys serve dual roles: X25519 Diffie-Hellman key agreement and Ed25519 digital signatures (via XEd25519 / 25519 conversions).

#### Class Definition: `PrivateKey`
```typescript
export class PrivateKey {
  static generate(): PrivateKey;
  static deserialize(buf: Buffer): PrivateKey;
  serialize(): Buffer;            // 32 bytes raw private key
  getPublicKey(): PublicKey;      // Derives associated PublicKey
  sign(msg: Buffer): Buffer;      // Generates 64-byte Ed25519 signature
  agree(other_key: PublicKey): Buffer; // Performs X25519 ECDH agreement (32 bytes)
}
```

#### Class Definition: `PublicKey`
```typescript
export class PublicKey {
  static deserialize(buf: Buffer): PublicKey;
  serialize(): Buffer;            // 33 bytes: 0x05 prefix byte + 32-byte X25519 key
  getPublicKeyBytes(): Buffer;    // 32 bytes raw public key (without 0x05 prefix)
  verify(msg: Buffer, sig: Buffer): boolean; // Verifies 64-byte signature over msg
  compare(other: PublicKey): number;         // -1, 0, or 1 (lexicographical order)
}
```

**Key Serialization Details:**
- `PublicKey.serialize()` always prepends the single-byte `0x05` Signal Curve25519 type identifier (`DJB_TYPE`). The serialized buffer is exactly **33 bytes**.
- `PublicKey.deserialize(buf)` requires the 33-byte format starting with `0x05`.
- Base64 encoding of a 33-byte `PublicKey` produces a 44-character string (e.g., `BQq...=`).
- `PrivateKey.sign(msg)` produces a **64-byte** digital signature. Base64 encoding produces an 88-character string (e.g., `abc...==`).

---

### 2.2 `IdentityKeyPair`

```typescript
export class IdentityKeyPair {
  readonly publicKey: PublicKey;
  readonly privateKey: PrivateKey;

  constructor(publicKey: PublicKey, privateKey: PrivateKey);
  static generate(): IdentityKeyPair;
  static deserialize(buffer: Buffer): IdentityKeyPair;
  serialize(): Buffer; // Protobuf encoding containing public & private keys
  signAlternateIdentity(other: PublicKey): Buffer;
}
```

**Usage Notes:**
- `IdentityKeyPair.generate()` generates a fresh `PrivateKey` and binds its derived `PublicKey`.
- `identityKeyPair.publicKey.serialize()` returns the 33-byte public key uploaded to the server as `identityKey`.
- `identityKeyPair.privateKey.sign(signedPreKeyPublic.serialize())` creates the cryptographic signature binding the medium-term signed prekey to this long-term identity.

---

### 2.3 `PreKeyRecord` (One-Time Prekeys)

```typescript
export class PreKeyRecord {
  static new(id: number, pubKey: PublicKey, privKey: PrivateKey): PreKeyRecord;
  static deserialize(buffer: Buffer): PreKeyRecord;
  id(): number;
  publicKey(): PublicKey;
  privateKey(): PrivateKey;
  serialize(): Buffer; // Protobuf encoding
}
```

**Creation Workflow:**
```typescript
const priv = PrivateKey.generate();
const pub = priv.getPublicKey();
const record = PreKeyRecord.new(keyId, pub, priv);
```

---

### 2.4 `SignedPreKeyRecord` (Signed Prekeys)

```typescript
export class SignedPreKeyRecord {
  static new(
    id: number,
    timestamp: number,
    pubKey: PublicKey,
    privKey: PrivateKey,
    signature: Buffer
  ): SignedPreKeyRecord;
  static deserialize(buffer: Buffer): SignedPreKeyRecord;
  id(): number;
  timestamp(): number; // Integer timestamp in milliseconds or seconds
  publicKey(): PublicKey;
  privateKey(): PrivateKey;
  signature(): Buffer; // 64-byte Ed25519 signature
  serialize(): Buffer; // Protobuf encoding
}
```

**Creation & Signing Workflow:**
```typescript
const spkPriv = PrivateKey.generate();
const spkPub = spkPriv.getPublicKey();
// Sign the serialized 33-byte public key using the local identity private key
const signature = identityKeyPair.privateKey.sign(spkPub.serialize());
const timestamp = Date.now();
const record = SignedPreKeyRecord.new(signedPreKeyId, timestamp, spkPub, spkPriv, signature);
```

**Verification:**
```typescript
const isValid = identityKeyPair.publicKey.verify(record.publicKey().serialize(), record.signature());
// returns true
```

---

### 2.5 `PreKeyBundle`

```typescript
export class PreKeyBundle {
  static new(
    registration_id: number,
    device_id: number,
    prekey_id: number | null,
    prekey: PublicKey | null,
    signed_prekey_id: number,
    signed_prekey: PublicKey,
    signed_prekey_signature: Buffer,
    identity_key: PublicKey,
    kyber_prekey_id?: number | null,
    kyber_prekey?: KEMPublicKey | null,
    kyber_prekey_signature?: Buffer | null
  ): PreKeyBundle;

  deviceId(): number;
  identityKey(): PublicKey;
  preKeyId(): number | null;
  preKeyPublic(): PublicKey | null;
  registrationId(): number;
  signedPreKeyId(): number;
  signedPreKeyPublic(): PublicKey;
  signedPreKeySignature(): Buffer;
  kyberPreKeyId(): number | null;
  kyberPreKeyPublic(): KEMPublicKey | null;
  kyberPreKeySignature(): Buffer | null;
}
```

---

## 3. Data Transfer Objects (DTOs) & Wire Formats

### 3.1 `SignalPrekeyBundleDTO` (Server -> Client)

Retrieved via `GET /v2/crypto/prekeys/:userId` when initiating an X3DH conversation.

```typescript
export interface SignalPrekeyBundleDTO {
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

### 3.2 `SignalPrekeyPublishDTO` (Client -> Server)

Published via `POST /v2/crypto/prekeys` upon login or key replenishment.

```typescript
export interface SignalPrekeyPublishDTO {
  registrationId: number;
  deviceId: number;
  identityKey: string;           // Base64 (33 bytes)
  signedPrekey: {
    keyId: number;
    publicKey: string;           // Base64 (33 bytes)
    signature: string;           // Base64 (64 bytes)
  };
  oneTimePrekeys: Array<{
    keyId: number;
    publicKey: string;           // Base64 (33 bytes)
  }>;
}
```

---

## 4. Client-Side Key Management Architecture (`src/services/signalKeyUtils.ts`)

The following complete implementation module provides all necessary key generation, serialization, signature verification, and DTO conversion utilities.

```typescript
import {
  PrivateKey,
  PublicKey,
  IdentityKeyPair,
  PreKeyRecord,
  SignedPreKeyRecord,
  PreKeyBundle
} from '@signalapp/libsignal-client';

export interface SignalPrekeyBundleDTO {
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

export interface SignalPrekeyPublishDTO {
  registrationId: number;
  deviceId: number;
  identityKey: string;           // Base64 (33 bytes)
  signedPrekey: {
    keyId: number;
    publicKey: string;           // Base64 (33 bytes)
    signature: string;           // Base64 (64 bytes)
  };
  oneTimePrekeys: Array<{
    keyId: number;
    publicKey: string;           // Base64 (33 bytes)
  }>;
}

export interface GeneratedPrekeys {
  registrationId: number;
  identityKeyPair: IdentityKeyPair;
  signedPreKeyRecord: SignedPreKeyRecord;
  oneTimePreKeys: PreKeyRecord[];
}

/**
 * Isomorphic conversion from Buffer / Uint8Array to standard Base64 string.
 */
export function bufferToBase64(buffer: Buffer | Uint8Array | ArrayBuffer): string {
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(buffer)) {
    return buffer.toString('base64');
  }
  const bytes = buffer instanceof Uint8Array
    ? buffer
    : new Uint8Array(buffer);
  
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Isomorphic conversion from Base64 string to Buffer.
 */
export function base64ToBuffer(base64: string): Buffer {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64');
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes as unknown as Buffer;
}

/**
 * Generates a random Signal registration ID (1 to 16380).
 */
export function generateRegistrationId(): number {
  const array = new Uint32Array(1);
  (typeof window !== 'undefined' ? window.crypto : globalThis.crypto).getRandomValues(array);
  return (array[0] % 16380) + 1;
}

/**
 * Generates a full set of Signal keys: IdentityKeyPair, SignedPreKeyRecord, and One-Time PreKeyRecords.
 */
export function generateClientPrekeys(
  registrationId?: number,
  signedPreKeyId: number = 1,
  oneTimePreKeysCount: number = 100,
  startOtkId: number = 1
): GeneratedPrekeys {
  const regId = registrationId ?? generateRegistrationId();
  
  // 1. Long-term Identity Key Pair (Curve25519)
  const identityKeyPair = IdentityKeyPair.generate();

  // 2. Medium-term Signed PreKey (Curve25519) signed by Identity Key
  const spkPriv = PrivateKey.generate();
  const spkPub = spkPriv.getPublicKey();
  const spkSignature = identityKeyPair.privateKey.sign(spkPub.serialize());
  const timestamp = Date.now();
  const signedPreKeyRecord = SignedPreKeyRecord.new(
    signedPreKeyId,
    timestamp,
    spkPub,
    spkPriv,
    spkSignature
  );

  // 3. One-Time Prekeys pool (Curve25519)
  const oneTimePreKeys: PreKeyRecord[] = [];
  for (let i = 0; i < oneTimePreKeysCount; i++) {
    const otkId = startOtkId + i;
    const otkPriv = PrivateKey.generate();
    const otkPub = otkPriv.getPublicKey();
    const otkRecord = PreKeyRecord.new(otkId, otkPub, otkPriv);
    oneTimePreKeys.push(otkRecord);
  }

  return {
    registrationId: regId,
    identityKeyPair,
    signedPreKeyRecord,
    oneTimePreKeys
  };
}

/**
 * Serializes generated prekeys into a publish payload for the backend REST API.
 */
export function serializePrekeysForPublish(
  keys: GeneratedPrekeys,
  deviceId: number = 1
): SignalPrekeyPublishDTO {
  return {
    registrationId: keys.registrationId,
    deviceId,
    identityKey: bufferToBase64(keys.identityKeyPair.publicKey.serialize()),
    signedPrekey: {
      keyId: keys.signedPreKeyRecord.id(),
      publicKey: bufferToBase64(keys.signedPreKeyRecord.publicKey().serialize()),
      signature: bufferToBase64(keys.signedPreKeyRecord.signature())
    },
    oneTimePrekeys: keys.oneTimePreKeys.map(otk => ({
      keyId: otk.id(),
      publicKey: bufferToBase64(otk.publicKey().serialize())
    }))
  };
}

/**
 * Deserializes a backend prekey bundle DTO into a PreKeyBundle instance for X3DH session initiation.
 */
export function deserializePreKeyBundle(dto: SignalPrekeyBundleDTO): PreKeyBundle {
  const identityKeyBuf = base64ToBuffer(dto.identityKey);
  const identityKey = PublicKey.deserialize(identityKeyBuf);

  const signedPrekeyBuf = base64ToBuffer(dto.signedPrekey);
  const signedPrekey = PublicKey.deserialize(signedPrekeyBuf);

  const signedPrekeySignature = base64ToBuffer(dto.signedPrekeySignature);

  let prekeyId: number | null = null;
  let prekey: PublicKey | null = null;

  if (dto.oneTimePrekey && dto.oneTimePrekey.publicKey) {
    prekeyId = dto.oneTimePrekey.keyId;
    prekey = PublicKey.deserialize(base64ToBuffer(dto.oneTimePrekey.publicKey));
  }

  return PreKeyBundle.new(
    dto.registrationId,
    dto.deviceId ?? 1,
    prekeyId,
    prekey,
    dto.signedPrekeyId,
    signedPrekey,
    signedPrekeySignature,
    identityKey
  );
}

/**
 * Validates the cryptographic signature of a remote signed prekey against its identity key.
 */
export function verifySignedPreKey(
  identityKeyBase64: string,
  signedPrekeyBase64: string,
  signatureBase64: string
): boolean {
  try {
    const identityKey = PublicKey.deserialize(base64ToBuffer(identityKeyBase64));
    const signedPrekeyBuf = base64ToBuffer(signedPrekeyBase64);
    const signatureBuf = base64ToBuffer(signatureBase64);
    return identityKey.verify(signedPrekeyBuf, signatureBuf);
  } catch (err) {
    return false;
  }
}
```

---

## 5. Integration Call Flow

### 5.1 Client Initialization & Bundle Publish
```
Client (App Startup)
  └─> generateClientPrekeys(registrationId, 1, 100)
        ├─> IdentityKeyPair.generate()
        ├─> SignedPreKeyRecord.new(1, ts, spkPub, spkPriv, sig)
        └─> PreKeyRecord.new(1..100, pub, priv)
  └─> Persist to IndexedDB (SignalProtocolStore)
        ├─> identityStore.saveLocalIdentity(regId, identityKeyPair)
        ├─> signedPreKeyStore.saveSignedPreKey(1, signedPreKeyRecord)
        └─> preKeyStore.savePreKey(1..100, preKeyRecord)
  └─> serializePrekeysForPublish(keys, 1)
  └─> POST /v2/crypto/prekeys (SignalPrekeyPublishDTO)
```

### 5.2 Direct Message Session Establishment (X3DH)
```
Sender (Alice)
  └─> GET /v2/crypto/prekeys/${bobUserId}
        └─> Returns SignalPrekeyBundleDTO (with single consumed OTP)
  └─> verifySignedPreKey(dto.identityKey, dto.signedPrekey, dto.signedPrekeySignature)
  └─> deserializePreKeyBundle(dto) -> PreKeyBundle
  └─> processPreKeyBundle(bundle, bobAddress, sessionStore, identityStore)
        └─> Generates initial SessionRecord in IndexedDB
  └─> signalEncrypt(plaintextBuffer, bobAddress, sessionStore, identityStore)
        └─> Produces CiphertextMessage (PreKeySignalMessage)
```

---

## 6. Verification and Test Suite Plan

1. **Key Generation & Curve25519 Formats (`tests/unit/signalKeys.test.ts`)**:
   - Verify `generateClientPrekeys` produces valid 33-byte `PublicKey`s and 64-byte signatures.
   - Verify `verifySignedPreKey` succeeds on valid keys and fails on tampered signatures or mismatched keys.
   - Verify Base64 serialization and deserialization roundtrips without byte corruption.
2. **PreKeyBundle Creation (`tests/unit/signalKeys.test.ts`)**:
   - Verify `deserializePreKeyBundle` creates a valid `PreKeyBundle` with and without an OTP.
3. **Session Processing Compatibility (`tests/unit/signalKeys.test.ts`)**:
   - Verify passing deserialized `PreKeyBundle` into `processPreKeyBundle` establishes an active `SessionRecord` ready for `signalEncrypt`.
