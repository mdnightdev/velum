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

describe('Adversarial Stress Test: @signalapp/libsignal-client Primitives & WASM', () => {
  describe('1. High-Volume Key Generation & Entropy / Collision Testing', () => {
    it('should generate 150 unique Curve25519 keypairs without collision or memory corruption', () => {
      const count = 150;
      const seenPublicKeys = new Set<string>();
      const seenPrivateKeys = new Set<string>();

      for (let i = 0; i < count; i++) {
        const priv = PrivateKey.generate();
        const pub = priv.getPublicKey();
        const pubHex = Buffer.from(pub.serialize()).toString('hex');
        const privHex = Buffer.from(priv.serialize()).toString('hex');

        expect(pub.serialize().length).toBe(33);
        expect(priv.serialize().length).toBe(32);
        expect(seenPublicKeys.has(pubHex)).toBe(false);
        expect(seenPrivateKeys.has(privHex)).toBe(false);

        seenPublicKeys.add(pubHex);
        seenPrivateKeys.add(privHex);
      }

      expect(seenPublicKeys.size).toBe(count);
      expect(seenPrivateKeys.size).toBe(count);
    });

    it('should generate 100 unique IdentityKeyPairs and verify bidirectional distinctness', () => {
      const count = 100;
      const seenKeys = new Set<string>();

      for (let i = 0; i < count; i++) {
        const idPair = IdentityKeyPair.generate();
        const pub = idPair.publicKey.serialize();
        const priv = idPair.privateKey.serialize();
        const pubHex = Buffer.from(pub).toString('hex');
        const privHex = Buffer.from(priv).toString('hex');

        expect(seenKeys.has(pubHex)).toBe(false);
        seenKeys.add(pubHex);
        seenKeys.add(privHex);

        const serialized = idPair.serialize();
        const restored = IdentityKeyPair.deserialize(serialized);
        expect(Buffer.from(restored.publicKey.serialize()).toString('hex')).toBe(pubHex);
      }

      expect(seenKeys.size).toBe(count * 2);
    });

    it('should generate 100 SignedPreKeyRecords with monotonically increasing or arbitrary IDs and valid timestamps', () => {
      const count = 100;
      const idPair = IdentityKeyPair.generate();
      const baseTime = Date.now();

      for (let i = 0; i < count; i++) {
        const priv = PrivateKey.generate();
        const pub = priv.getPublicKey();
        const sig = idPair.privateKey.sign(pub.serialize());
        const record = SignedPreKeyRecord.new(i + 1, baseTime + i, pub, priv, sig);

        expect(record.id()).toBe(i + 1);
        expect(record.timestamp()).toBe(baseTime + i);
        expect(idPair.publicKey.verify(pub.serialize(), record.signature())).toBe(true);

        const serialized = record.serialize();
        const deserialized = SignedPreKeyRecord.deserialize(serialized);
        expect(deserialized.id()).toBe(i + 1);
        expect(deserialized.timestamp()).toBe(baseTime + i);
      }
    });
  });

  describe('2. Signature Tampering, Fuzzing & Forgery Resistance', () => {
    it('should reject tampered messages with single-bit modifications', () => {
      const idPair = IdentityKeyPair.generate();
      const originalMessage = Buffer.from('Velum-Secure-E2EE-Authorization-Token-2026', 'utf-8');
      const signature = idPair.privateKey.sign(originalMessage);

      expect(idPair.publicKey.verify(originalMessage, signature)).toBe(true);

      for (let byteIdx = 0; byteIdx < originalMessage.length; byteIdx++) {
        for (let bit = 0; bit < 8; bit++) {
          const tampered = Buffer.from(originalMessage);
          tampered[byteIdx] ^= (1 << bit);
          expect(idPair.publicKey.verify(tampered, signature)).toBe(false);
        }
      }
    });

    it('should reject signatures with single-bit corruptions', () => {
      const idPair = IdentityKeyPair.generate();
      const message = Buffer.from('Velum-Critical-Prekey-Signature-Payload', 'utf-8');
      const signature = idPair.privateKey.sign(message);

      // Verify original signature
      expect(idPair.publicKey.verify(message, signature)).toBe(true);

      // Mutate single bits across various positions in 64-byte signature
      const testOffsets = [0, 1, 15, 31, 32, 45, 62, 63];
      for (const offset of testOffsets) {
        for (let bit = 0; bit < 8; bit++) {
          const corruptedSig = new Uint8Array(signature);
          corruptedSig[offset] ^= (1 << bit);
          expect(idPair.publicKey.verify(message, corruptedSig)).toBe(false);
        }
      }
    });

    it('should reject cross-key signature verification (signatures from different identities)', () => {
      const alice = IdentityKeyPair.generate();
      const bob = IdentityKeyPair.generate();
      const payload = Buffer.from('Velum-E2EE-Cross-Identity-Check', 'utf-8');

      const aliceSig = alice.privateKey.sign(payload);
      const bobSig = bob.privateKey.sign(payload);

      expect(alice.publicKey.verify(payload, aliceSig)).toBe(true);
      expect(bob.publicKey.verify(payload, bobSig)).toBe(true);

      // Cross verification MUST fail
      expect(alice.publicKey.verify(payload, bobSig)).toBe(false);
      expect(bob.publicKey.verify(payload, aliceSig)).toBe(false);
    });

    it('should reject signatures of invalid lengths without crashing WASM runtime', () => {
      const idPair = IdentityKeyPair.generate();
      const message = Buffer.from('Velum-Signature-Length-Test', 'utf-8');

      const invalidLengths = [0, 1, 32, 63, 65, 128];
      for (const len of invalidLengths) {
        const dummySig = new Uint8Array(len);
        expect(() => {
          const res = idPair.publicKey.verify(message, dummySig);
          expect(res).toBe(false);
        }).not.toThrow();
      }
    });
  });

  describe('3. Malformed Binary Deserialization & Robustness', () => {
    it('should cleanly throw on truncated or malformed IdentityKeyPair deserialization', () => {
      const malformedPayloads = [
        new Uint8Array(0),
        new Uint8Array(10),
        new Uint8Array(32),
        new Uint8Array([0xff, 0x00, 0x12, 0x34]),
        Buffer.from('corrupted-non-protobuf-identity-bytes', 'utf-8')
      ];

      for (const payload of malformedPayloads) {
        expect(() => {
          IdentityKeyPair.deserialize(payload);
        }).toThrow();
      }
    });

    it('should cleanly throw on malformed PreKeyRecord deserialization', () => {
      const malformedPayloads = [
        new Uint8Array(0),
        new Uint8Array([1, 2, 3]),
        new Uint8Array(64).fill(0xaa)
      ];

      for (const payload of malformedPayloads) {
        expect(() => {
          PreKeyRecord.deserialize(payload);
        }).toThrow();
      }
    });

    it('should cleanly throw on malformed SignedPreKeyRecord deserialization', () => {
      const malformedPayloads = [
        new Uint8Array(0),
        new Uint8Array(16),
        new Uint8Array(128).fill(0x55)
      ];

      for (const payload of malformedPayloads) {
        expect(() => {
          SignedPreKeyRecord.deserialize(payload);
        }).toThrow();
      }
    });

    it('should reject invalid public key bytes deserialization', () => {
      const invalidPubKeys = [
        new Uint8Array(0),
        new Uint8Array(32), // Curve25519 public key in libsignal has 1 byte prefix (33 bytes)
        new Uint8Array(34),
        new Uint8Array(33).fill(0) // 0 prefix is not a valid 0x05 prefix
      ];

      for (const raw of invalidPubKeys) {
        expect(() => {
          PublicKey.deserialize(raw);
        }).toThrow();
      }
    });
  });

  describe('4. ProtocolAddress Boundary & Edge Cases', () => {
    it('should handle alphanumeric, uuid, and special character address names', () => {
      const validNames = [
        'user_123',
        '00000000-0000-0000-0000-000000000000',
        'alice@velum.local',
        'a'.repeat(256),
        'user+sub!#$*_-'
      ];

      for (const name of validNames) {
        const addr = ProtocolAddress.new(name, 1);
        expect(addr.name()).toBe(name);
        expect(addr.deviceId()).toBe(1);
      }
    });

    it('should handle device ID ranges (1 to 2^31 - 1)', () => {
      const deviceIds = [1, 2, 255, 65535, 2147483647];
      for (const devId of deviceIds) {
        const addr = ProtocolAddress.new('alice', devId);
        expect(addr.deviceId()).toBe(devId);
      }
    });

    it('should reject invalid or negative device IDs', () => {
      expect(() => {
        ProtocolAddress.new('alice', -1);
      }).toThrow();
    });
  });

  describe('5. PreKeyBundle Assembly and Validation', () => {
    it('should construct PreKeyBundle with optional OTP missing (null/undefined)', () => {
      const aliceId = IdentityKeyPair.generate();
      const spkPriv = PrivateKey.generate();
      const spkPub = spkPriv.getPublicKey();
      const spkSig = aliceId.privateKey.sign(spkPub.serialize());

      const bundleWithoutOtp = PreKeyBundle.new(
        999,
        1,
        null as any,
        null as any,
        55,
        spkPub,
        spkSig,
        aliceId.publicKey
      );

      expect(bundleWithoutOtp.registrationId()).toBe(999);
      expect(bundleWithoutOtp.deviceId()).toBe(1);
      expect(bundleWithoutOtp.signedPreKeyId()).toBe(55);
      expect(bundleWithoutOtp.preKeyId()).toBeNull();
      expect(bundleWithoutOtp.preKeyPublic()).toBeNull();
    });

    it('should accurately verify signedPreKey signature from bundle', () => {
      const aliceId = IdentityKeyPair.generate();
      const spkPriv = PrivateKey.generate();
      const spkPub = spkPriv.getPublicKey();
      const spkSig = aliceId.privateKey.sign(spkPub.serialize());

      const bundle = PreKeyBundle.new(
        1001,
        1,
        1,
        PrivateKey.generate().getPublicKey(),
        10,
        spkPub,
        spkSig,
        aliceId.publicKey
      );

      // Verify the signature on the signed prekey inside the bundle
      const isSigValid = bundle.identityKey().verify(
        bundle.signedPreKeyPublic().serialize(),
        bundle.signedPreKeySignature()
      );
      expect(isSigValid).toBe(true);

      // Tampered public key verification
      const otherPub = PrivateKey.generate().getPublicKey();
      const isTamperedValid = bundle.identityKey().verify(
        otherPub.serialize(),
        bundle.signedPreKeySignature()
      );
      expect(isTamperedValid).toBe(false);
    });
  });
});
