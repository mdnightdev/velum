import { describe, it, expect } from 'vitest';
import {
  PrivateKey,
  PublicKey,
  IdentityKeyPair,
  PreKeyRecord,
  SignedPreKeyRecord,
  PreKeyBundle,
  ProtocolAddress
} from '@signalapp/libsignal-client';

describe('Signal Protocol Primitives Verification (@signalapp/libsignal-client)', () => {
  it('should generate Curve25519 / X25519 private keys and derive public keys', () => {
    const privKey = PrivateKey.generate();
    expect(privKey).toBeDefined();

    const pubKey = privKey.getPublicKey();
    expect(pubKey).toBeDefined();

    const pubBytes = pubKey.serialize();
    expect(pubBytes).toBeInstanceOf(Uint8Array);
    expect(pubBytes.length).toBe(33); // 1-byte type prefix + 32-byte key
  });

  it('should generate and serialize IdentityKeyPairs', () => {
    const idKeyPair = IdentityKeyPair.generate();
    expect(idKeyPair).toBeDefined();
    expect(idKeyPair.publicKey).toBeDefined();
    expect(idKeyPair.privateKey).toBeDefined();

    const pubBytes = idKeyPair.publicKey.serialize();
    expect(pubBytes.length).toBe(33);

    const serializedPair = idKeyPair.serialize();
    expect(serializedPair).toBeInstanceOf(Uint8Array);
    expect(serializedPair.length).toBeGreaterThan(32);

    const deserialized = IdentityKeyPair.deserialize(serializedPair);
    expect(deserialized.publicKey.serialize()).toEqual(pubBytes);
  });

  it('should sign and verify payloads using IdentityKeyPair', () => {
    const idKeyPair = IdentityKeyPair.generate();
    const message = Buffer.from('velum-protocol-handshake-payload', 'utf-8');

    const signature = idKeyPair.privateKey.sign(message);
    expect(signature).toBeDefined();
    expect(signature.length).toBe(64);

    const isValid = idKeyPair.publicKey.verify(message, signature);
    expect(isValid).toBe(true);

    // Tampered verification
    const tampered = Buffer.from('velum-protocol-handshake-tampered', 'utf-8');
    const isTamperedValid = idKeyPair.publicKey.verify(tampered, signature);
    expect(isTamperedValid).toBe(false);
  });

  it('should create, serialize, and deserialize PreKeyRecords', () => {
    const keyId = 42;
    const priv = PrivateKey.generate();
    const pub = priv.getPublicKey();

    const preKeyRecord = PreKeyRecord.new(keyId, pub, priv);
    expect(preKeyRecord.id()).toBe(keyId);
    expect(preKeyRecord.publicKey().serialize()).toEqual(pub.serialize());

    const serialized = preKeyRecord.serialize();
    expect(serialized).toBeInstanceOf(Uint8Array);

    const deserialized = PreKeyRecord.deserialize(serialized);
    expect(deserialized.id()).toBe(keyId);
    expect(deserialized.publicKey().serialize()).toEqual(pub.serialize());
  });

  it('should create, serialize, and deserialize SignedPreKeyRecords with signature', () => {
    const spkId = 101;
    const timestamp = Date.now();
    const priv = PrivateKey.generate();
    const pub = priv.getPublicKey();
    const idKeyPair = IdentityKeyPair.generate();

    const signature = idKeyPair.privateKey.sign(pub.serialize());
    const spkRecord = SignedPreKeyRecord.new(spkId, timestamp, pub, priv, signature);

    expect(spkRecord.id()).toBe(spkId);
    expect(spkRecord.timestamp()).toBe(timestamp);
    expect(spkRecord.signature()).toEqual(signature);

    const isValidSig = idKeyPair.publicKey.verify(pub.serialize(), spkRecord.signature());
    expect(isValidSig).toBe(true);

    const serialized = spkRecord.serialize();
    const deserialized = SignedPreKeyRecord.deserialize(serialized);
    expect(deserialized.id()).toBe(spkId);
    expect(deserialized.timestamp()).toBe(timestamp);
    expect(deserialized.signature()).toEqual(signature);
  });

  it('should construct valid PreKeyBundle instances for X3DH agreement', () => {
    const regId = 12345;
    const deviceId = 1;
    const aliceId = IdentityKeyPair.generate();
    const spkPriv = PrivateKey.generate();
    const spkPub = spkPriv.getPublicKey();
    const spkSig = aliceId.privateKey.sign(spkPub.serialize());
    const otpPriv = PrivateKey.generate();
    const otpPub = otpPriv.getPublicKey();

    const bundle = PreKeyBundle.new(
      regId,
      deviceId,
      1,
      otpPub,
      10,
      spkPub,
      spkSig,
      aliceId.publicKey
    );

    expect(bundle.registrationId()).toBe(regId);
    expect(bundle.deviceId()).toBe(deviceId);
    expect(bundle.preKeyId()).toBe(1);
    expect(bundle.signedPreKeyId()).toBe(10);
    expect(bundle.identityKey().serialize()).toEqual(aliceId.publicKey.serialize());
  });

  it('should format and validate ProtocolAddress names and device IDs', () => {
    const address = ProtocolAddress.new('alice_vault_user', 1);
    expect(address.name()).toBe('alice_vault_user');
    expect(address.deviceId()).toBe(1);
  });
});
