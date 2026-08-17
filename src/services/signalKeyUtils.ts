/**
 * Signal Protocol Key Generation, Serialization, and Verification Utilities
 * Using @signalapp/libsignal-client
 */

import {
  PrivateKey,
  PublicKey,
  IdentityKeyPair,
  PreKeyRecord,
  SignedPreKeyRecord,
  PreKeyBundle
} from '@signalapp/libsignal-client';

export interface OneTimePrekeyItem {
  keyId: number;
  publicKey: string; // Base64 (33 bytes)
}

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
 * Isomorphic conversion from Buffer / Uint8Array / ArrayBuffer to standard Base64 string.
 */
export function bufferToBase64(buffer: Buffer | Uint8Array | ArrayBuffer): string {
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(buffer)) {
    return buffer.toString('base64');
  }
  const bytes = buffer instanceof Uint8Array
    ? buffer
    : new Uint8Array(buffer);

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }

  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const bytesToBase64 = bufferToBase64;

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

export function base64ToBytes(base64: string): Uint8Array {
  const buf = base64ToBuffer(base64);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

/**
 * Generates a random Signal registration ID (1 to 16380).
 */
export function generateRegistrationId(): number {
  const cryptoObj = typeof window !== 'undefined' && window.crypto
    ? window.crypto
    : globalThis.crypto;
  const array = new Uint32Array(1);
  cryptoObj.getRandomValues(array);
  return (array[0] % 16380) + 1;
}

/**
 * Generates a fresh Curve25519 identity key pair.
 */
export function generateIdentityKeyPair(): IdentityKeyPair {
  return IdentityKeyPair.generate();
}

/**
 * Generates a medium-term Signed PreKey signed by the given IdentityKeyPair.
 */
export function generateSignedPreKey(
  identityKeyPair: IdentityKeyPair,
  keyId: number = 1,
  timestamp: number = Date.now()
): SignedPreKeyRecord {
  const spkPriv = PrivateKey.generate();
  const spkPub = spkPriv.getPublicKey();
  const spkSignature = identityKeyPair.privateKey.sign(spkPub.serialize());
  return SignedPreKeyRecord.new(
    keyId,
    timestamp,
    spkPub,
    spkPriv,
    spkSignature
  );
}

/**
 * Generates a batch of one-time prekeys starting at startKeyId.
 */
export function generateOneTimePreKeys(
  startKeyId: number,
  count: number
): PreKeyRecord[] {
  if (count <= 0) {
    return [];
  }
  const records: PreKeyRecord[] = [];
  for (let i = 0; i < count; i++) {
    const otkId = startKeyId + i;
    const priv = PrivateKey.generate();
    const pub = priv.getPublicKey();
    records.push(PreKeyRecord.new(otkId, pub, priv));
  }
  return records;
}

/**
 * Generates a complete client prekey set.
 */
export function generateClientPrekeys(
  registrationId?: number,
  signedPreKeyId: number = 1,
  oneTimePreKeysCount: number = 100,
  startOtkId: number = 1
): GeneratedPrekeys {
  const regId = registrationId ?? generateRegistrationId();
  const identityKeyPair = generateIdentityKeyPair();
  const signedPreKeyRecord = generateSignedPreKey(identityKeyPair, signedPreKeyId);
  const oneTimePreKeys = generateOneTimePreKeys(startOtkId, oneTimePreKeysCount);

  return {
    registrationId: regId,
    identityKeyPair,
    signedPreKeyRecord,
    oneTimePreKeys
  };
}

/**
 * Serializes generated prekeys for uploading to the backend API.
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
    oneTimePrekeys: keys.oneTimePreKeys.map((otk) => ({
      keyId: otk.id(),
      publicKey: bufferToBase64(otk.publicKey().serialize())
    }))
  };
}

export function createPrekeyPublishPayload(
  registrationId: number,
  deviceId: number,
  identityKeyPair: IdentityKeyPair,
  signedPreKey: SignedPreKeyRecord,
  oneTimePrekeys: PreKeyRecord[]
): SignalPrekeyPublishDTO {
  return serializePrekeysForPublish({
    registrationId,
    identityKeyPair,
    signedPreKeyRecord: signedPreKey,
    oneTimePreKeys: oneTimePrekeys
  }, deviceId);
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

export const bundleDtoToPreKeyBundle = deserializePreKeyBundle;

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
  } catch {
    return false;
  }
}

export function verifySignedPreKeySignature(
  identityPublicKey: PublicKey,
  signedPreKeyPublic: PublicKey,
  signature: Uint8Array | Buffer
): boolean {
  try {
    return identityPublicKey.verify(
      signedPreKeyPublic.serialize(),
      typeof Buffer !== 'undefined' && Buffer.isBuffer(signature) ? signature : Buffer.from(signature)
    );
  } catch {
    return false;
  }
}
