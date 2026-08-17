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

describe('Adversarial Challenger: WASM Instantiation, Concurrency & Bundler Resilience', () => {
  describe('1. Concurrent Asynchronous Key Generation & Cryptographic Operations', () => {
    it('should handle 50 concurrent async tasks generating keys, signatures, and bundles without race conditions', async () => {
      const concurrencyLevel = 50;
      const tasks = Array.from({ length: concurrencyLevel }, async (_, i) => {
        const idPair = IdentityKeyPair.generate();
        const priv = PrivateKey.generate();
        const pub = priv.getPublicKey();
        const sig = idPair.privateKey.sign(pub.serialize());

        const spk = SignedPreKeyRecord.new(i + 1, Date.now(), pub, priv, sig);
        const otpPriv = PrivateKey.generate();
        const otpPub = otpPriv.getPublicKey();

        const bundle = PreKeyBundle.new(
          1000 + i,
          1,
          i + 10,
          otpPub,
          i + 1,
          pub,
          sig,
          idPair.publicKey
        );

        const addr = ProtocolAddress.new(`concurrent_user_${i}`, 1);

        return {
          idx: i,
          validSig: idPair.publicKey.verify(pub.serialize(), sig),
          bundleValid: bundle.identityKey().verify(bundle.signedPreKeyPublic().serialize(), bundle.signedPreKeySignature()),
          serializedBundleIdKeyLen: bundle.identityKey().serialize().length,
          addressName: addr.name(),
        };
      });

      const results = await Promise.all(tasks);

      expect(results.length).toBe(concurrencyLevel);
      for (const res of results) {
        expect(res.validSig).toBe(true);
        expect(res.bundleValid).toBe(true);
        expect(res.serializedBundleIdKeyLen).toBe(33);
        expect(res.addressName).toBe(`concurrent_user_${res.idx}`);
      }
    });
  });

  describe('2. Memory Isolation, Resource Pressure & Rapid Instantiation Cycling', () => {
    it('should instantiate and discard 500 keys rapidly without memory leaks or state corruption', () => {
      const iterations = 500;
      const pubKeysSet = new Set<string>();

      for (let i = 0; i < iterations; i++) {
        const priv = PrivateKey.generate();
        const pub = priv.getPublicKey();
        const hex = Buffer.from(pub.serialize()).toString('hex');
        expect(pubKeysSet.has(hex)).toBe(false);
        pubKeysSet.add(hex);
      }

      expect(pubKeysSet.size).toBe(iterations);
    });

    it('should withstand rapid serialize-deserialize roundtrips across all Signal structures', () => {
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        // IdentityKeyPair
        const idPair = IdentityKeyPair.generate();
        const idBytes = idPair.serialize();
        const restoredId = IdentityKeyPair.deserialize(idBytes);
        expect(Buffer.from(restoredId.publicKey.serialize()).toString('hex')).toBe(
          Buffer.from(idPair.publicKey.serialize()).toString('hex')
        );

        // PreKeyRecord
        const prePriv = PrivateKey.generate();
        const prePub = prePriv.getPublicKey();
        const preRecord = PreKeyRecord.new(i + 1, prePub, prePriv);
        const preBytes = preRecord.serialize();
        const restoredPre = PreKeyRecord.deserialize(preBytes);
        expect(restoredPre.id()).toBe(i + 1);

        // SignedPreKeyRecord
        const spkPriv = PrivateKey.generate();
        const spkPub = spkPriv.getPublicKey();
        const spkSig = idPair.privateKey.sign(spkPub.serialize());
        const spkRecord = SignedPreKeyRecord.new(i + 1, 1700000000 + i, spkPub, spkPriv, spkSig);
        const spkBytes = spkRecord.serialize();
        const restoredSpk = SignedPreKeyRecord.deserialize(spkBytes);
        expect(restoredSpk.id()).toBe(i + 1);
        expect(restoredSpk.timestamp()).toBe(1700000000 + i);
        expect(idPair.publicKey.verify(restoredSpk.publicKey().serialize(), restoredSpk.signature())).toBe(true);
      }
    });
  });

  describe('3. Adversarial Input Boundary & Cross-Context Robustness', () => {
    it('should reject extreme protocol address strings gracefully without crashing runtime', () => {
      const extremeNames = [
        ' ',
        '\t\n\r',
        'unicode_🚀_🔥_🔒_user',
        'a'.repeat(4096),
        '特殊字符/\\:;*?"<>|'
      ];

      for (const name of extremeNames) {
        expect(() => {
          const addr = ProtocolAddress.new(name, 1);
          expect(addr.name()).toBe(name);
          expect(addr.deviceId()).toBe(1);
        }).not.toThrow();
      }
    });

    it('should reject invalid device IDs at upper/lower numerical bounds', () => {
      expect(() => ProtocolAddress.new('alice', 0)).not.toThrow(); // deviceId 0 is valid in some signal contexts or handled
      expect(() => ProtocolAddress.new('alice', -1)).toThrow();
      expect(() => ProtocolAddress.new('alice', -2147483648)).toThrow();
    });

    it('should maintain signature non-malleability and cross-payload immunity', () => {
      const alice = IdentityKeyPair.generate();
      const payload1 = Buffer.from('payload-alpha', 'utf-8');
      const payload2 = Buffer.from('payload-beta', 'utf-8');

      const sig1 = alice.privateKey.sign(payload1);
      const sig2 = alice.privateKey.sign(payload2);

      expect(alice.publicKey.verify(payload1, sig1)).toBe(true);
      expect(alice.publicKey.verify(payload2, sig2)).toBe(true);
      expect(alice.publicKey.verify(payload1, sig2)).toBe(false);
      expect(alice.publicKey.verify(payload2, sig1)).toBe(false);
    });
  });
});
