import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateX25519KeyPair,
  calculateX25519SharedSecret,
  generateEd25519KeyPair,
  signEd25519,
  verifyEd25519,
  kdfRoot,
  kdfChain,
  deriveX3DHRKey,
  encryptAesGcm,
  decryptAesGcm,
  toHex,
  fromHex,
  toBase64,
  fromBase64,
  utf8ToBytes,
  bytesToUtf8,
  getRandomBytes
} from '../../src/services/cryptoPrimitives.js';

describe('Cryptographic Primitives (X25519 / Ed25519 / HKDF / AES-GCM)', () => {
  it('performs X25519 Diffie-Hellman key exchange matching both sides', () => {
    const alice = generateX25519KeyPair();
    const bob = generateX25519KeyPair();

    const sharedAlice = calculateX25519SharedSecret(alice.privateKey, bob.publicKey);
    const sharedBob = calculateX25519SharedSecret(bob.privateKey, alice.publicKey);

    assert.equal(toHex(sharedAlice), toHex(sharedBob));
    assert.equal(sharedAlice.length, 32);
  });

  it('signs and verifies messages using Ed25519', () => {
    const keyPair = generateEd25519KeyPair();
    const message = utf8ToBytes('Velum E2EE Protocol Verification');

    const signature = signEd25519(message, keyPair.privateKey);
    assert.equal(signature.length, 64);

    const valid = verifyEd25519(signature, message, keyPair.publicKey);
    assert.equal(valid, true);

    const tampered = utf8ToBytes('Tampered payload');
    const invalid = verifyEd25519(signature, tampered, keyPair.publicKey);
    assert.equal(invalid, false);
  });

  it('performs HKDF root and chain derivations deterministically', () => {
    const rootKey = getRandomBytes(32);
    const dhSecret = getRandomBytes(32);

    const step1 = kdfRoot(rootKey, dhSecret);
    assert.equal(step1.nextRootKey.length, 32);
    assert.equal(step1.chainKey.length, 32);

    const chain1 = kdfChain(step1.chainKey);
    assert.equal(chain1.nextChainKey.length, 32);
    assert.equal(chain1.messageKey.length, 32);

    // Deterministic check
    const step1Repeat = kdfRoot(rootKey, dhSecret);
    assert.equal(toHex(step1.nextRootKey), toHex(step1Repeat.nextRootKey));
    assert.equal(toHex(step1.chainKey), toHex(step1Repeat.chainKey));
  });

  it('encrypts and decrypts with AES-256-GCM authenticated tags with 100% byte fidelity', async () => {
    const key = getRandomBytes(32);
    const iv = getRandomBytes(12);
    const originalText = 'Highly confidential message across Velum E2EE network';
    const plaintext = utf8ToBytes(originalText);
    const aad = utf8ToBytes('header_metadata');

    const { ciphertext, tag } = await encryptAesGcm(key, plaintext, iv, aad);
    assert.equal(tag.length, 16);

    const decryptedBytes = await decryptAesGcm(key, ciphertext, tag, iv, aad);
    assert.equal(bytesToUtf8(decryptedBytes), originalText);
  });

  it('fails decryption if ciphertext or authentication tag is tampered', async () => {
    const key = getRandomBytes(32);
    const iv = getRandomBytes(12);
    const plaintext = utf8ToBytes('Secret message');

    const { ciphertext, tag } = await encryptAesGcm(key, plaintext, iv);

    const tamperedTag = new Uint8Array(tag);
    tamperedTag[0] ^= 0xff;

    await assert.rejects(async () => {
      await decryptAesGcm(key, ciphertext, tamperedTag, iv);
    });
  });
});
