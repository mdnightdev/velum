// import { describe, it, beforeEach, afterEach } from 'vitest';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import 'fake-indexeddb/auto';
import { doubleRatchetService } from '../../src/services/doubleRatchetService.js';
import { encryptMessage, decryptMessage } from '../../src/services/encryptionService.js';
import { purgeCryptoDatabase } from '../../src/services/cryptoDbStore.js';
import {
  generateX25519KeyPair,
  calculateX25519SharedSecret,
  generateEd25519KeyPair,
  signEd25519,
  verifyEd25519,
  encryptAesGcm,
  decryptAesGcm,
  toHex,
  utf8ToBytes,
  bytesToUtf8,
  getRandomBytes
} from '../../src/services/cryptoPrimitives.js';

describe('Curve25519 / Double Ratchet E2EE Suite', () => {
  beforeEach(async () => {
    doubleRatchetService.clearMemoryState();
    await purgeCryptoDatabase(1);
    await purgeCryptoDatabase(2);
  });

  afterEach(async () => {
    await doubleRatchetService.closeDatabaseConnections();
    await purgeCryptoDatabase(1);
    await purgeCryptoDatabase(2);
  });

  describe('Cryptographic Primitives', () => {
    it('generates deterministic X25519 Diffie-Hellman shared secret', () => {
      const alice = generateX25519KeyPair();
      const bob = generateX25519KeyPair();

      const ssAlice = calculateX25519SharedSecret(alice.privateKey, bob.publicKey);
      const ssBob = calculateX25519SharedSecret(bob.privateKey, alice.publicKey);

      assert.strictEqual(toHex(ssAlice), toHex(ssBob));
      assert.strictEqual(ssAlice.length, 32);
    });

    it('signs and verifies Ed25519 signatures', () => {
      const idKey = generateEd25519KeyPair();
      const payload = utf8ToBytes('Identity Authentication Payload');

      const sig = signEd25519(payload, idKey.privateKey);
      assert.strictEqual(sig.length, 64);

      const isValid = verifyEd25519(sig, payload, idKey.publicKey);
      assert.strictEqual(isValid, true);

      const invalidPayload = utf8ToBytes('Tampered payload');
      const isInvalid = verifyEd25519(sig, invalidPayload, idKey.publicKey);
      assert.strictEqual(isInvalid, false);
    });

    it('performs AES-256-GCM encryption and decryption with authentication tags', async () => {
      const key = getRandomBytes(32);
      const iv = getRandomBytes(12);
      const aad = utf8ToBytes('aad_context');
      const plaintext = utf8ToBytes('Top secret plaintext payload');

      const { ciphertext, tag } = await encryptAesGcm(key, plaintext, iv, aad);
      assert.strictEqual(tag.length, 16);

      const decrypted = await decryptAesGcm(key, ciphertext, tag, iv, aad);
      assert.strictEqual(bytesToUtf8(decrypted), 'Top secret plaintext payload');
    });
  });

  describe('Full Double Ratchet Protocol Flow', () => {
    it('establishes session via X3DH and exchanges multi-step ratcheted messages', async () => {
      // 1. Initialize Alice (userId: 1)
      doubleRatchetService.setLocalUserId(1);
      await doubleRatchetService.initializeLocalKeys();
      const aliceBundle = await doubleRatchetService.getPrekeyBundleForPublishing();
      assert.ok(aliceBundle.identityKeyHex);

      // 2. Initialize Bob (userId: 2)
      doubleRatchetService.setLocalUserId(2);
      await doubleRatchetService.initializeLocalKeys();
      const bobBundle = await doubleRatchetService.getPrekeyBundleForPublishing();
      assert.ok(bobBundle.identityKeyHex);

      // 3. Alice initiates session using Bob's prekey bundle
      doubleRatchetService.setLocalUserId(1);
      const bobDTO = {
        userId: 2,
        identityKeyHex: bobBundle.identityKeyHex,
        dhIdentityKeyHex: bobBundle.dhIdentityKeyHex,
        signedPrekeyHex: bobBundle.signedPrekeyHex,
        signedPrekeyId: bobBundle.signedPrekeyId,
        signedPrekeySignatureHex: bobBundle.signedPrekeySignatureHex,
        oneTimePrekeyHex: bobBundle.oneTimePrekeys[0]?.publicKeyHex,
        oneTimePrekeyId: bobBundle.oneTimePrekeys[0]?.keyId
      };
      await doubleRatchetService.initOutboundSessionWithBundle(2, bobDTO);

      // 4. Alice sends Message 1
      const msg1 = 'Hello Bob, this is message 1';
      const cipher1 = await encryptMessage(msg1, { type: 'direct', peerUserId: 2 });
      assert.ok(cipher1.startsWith('ratchet:v2:'));

      // 5. Bob receives and decrypts Message 1
      doubleRatchetService.setLocalUserId(2);
      const decrypted1 = await decryptMessage(cipher1, { type: 'direct', peerUserId: 1 });
      assert.strictEqual(decrypted1, msg1);

      // 6. Bob replies to Alice
      const msg2 = 'Hello Alice, replying over ratchet';
      const cipher2 = await encryptMessage(msg2, { type: 'direct', peerUserId: 1 });

      // 7. Alice decrypts Bob's reply
      doubleRatchetService.setLocalUserId(1);
      const decrypted2 = await decryptMessage(cipher2, { type: 'direct', peerUserId: 2 });
      assert.strictEqual(decrypted2, msg2);

      // 8. 6-turn continuous conversation verifying symmetric & asymmetric ratcheting
      for (let i = 3; i <= 8; i++) {
        const text = `Ratchet step #${i}`;
        const sender = i % 2 === 1 ? 1 : 2;
        const receiver = i % 2 === 1 ? 2 : 1;

        doubleRatchetService.setLocalUserId(sender);
        const c = await encryptMessage(text, { type: 'direct', peerUserId: receiver });

        doubleRatchetService.setLocalUserId(receiver);
        const d = await decryptMessage(c, { type: 'direct', peerUserId: sender });
        assert.strictEqual(d, text);
      }
    });

    it('decrypts out-of-order and delayed messages using skipped keys', async () => {
      doubleRatchetService.setLocalUserId(1);
      await doubleRatchetService.initializeLocalKeys();

      doubleRatchetService.setLocalUserId(2);
      await doubleRatchetService.initializeLocalKeys();
      const bobBundle = await doubleRatchetService.getPrekeyBundleForPublishing();

      doubleRatchetService.setLocalUserId(1);
      await doubleRatchetService.initOutboundSessionWithBundle(2, {
        userId: 2,
        identityKeyHex: bobBundle.identityKeyHex,
        dhIdentityKeyHex: bobBundle.dhIdentityKeyHex,
        signedPrekeyHex: bobBundle.signedPrekeyHex,
        signedPrekeyId: bobBundle.signedPrekeyId,
        signedPrekeySignatureHex: bobBundle.signedPrekeySignatureHex
      });

      // Alice sends 3 messages in sequence
      const c1 = await encryptMessage('Order 1', { type: 'direct', peerUserId: 2 });
      const c2 = await encryptMessage('Order 2', { type: 'direct', peerUserId: 2 });
      const c3 = await encryptMessage('Order 3', { type: 'direct', peerUserId: 2 });

      doubleRatchetService.setLocalUserId(2);

      // Bob receives message 3 first
      const d3 = await decryptMessage(c3, { type: 'direct', peerUserId: 1 });
      assert.strictEqual(d3, 'Order 3');

      // Bob receives message 1 second
      const d1 = await decryptMessage(c1, { type: 'direct', peerUserId: 1 });
      assert.strictEqual(d1, 'Order 1');

      // Bob receives message 2 last
      const d2 = await decryptMessage(c2, { type: 'direct', peerUserId: 1 });
      assert.strictEqual(d2, 'Order 2');
    });
  });
});
