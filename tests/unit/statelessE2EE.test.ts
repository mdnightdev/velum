import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateX25519KeyPair,
  calculateX25519SharedSecret,
  encryptAesGcm,
  decryptAesGcm,
  getRandomBytes,
  utf8ToBytes,
  bytesToUtf8,
  toHex,
  fromHex
} from '../../src/services/cryptoPrimitives.js';

describe('Stateless Ephemeral ECDH + AES-256-GCM E2EE Suite', () => {
  it('performs clean end-to-end stateless encryption and decryption', async () => {
    // 1. Bob (Recipient) has a permanent DH identity key
    const bobIdentity = generateX25519KeyPair();

    // 2. Alice (Sender) wants to send a secret message to Bob
    const secretPlaintext = 'Hello Bob, this is a completely stateless secure message!';

    // Alice generates a single-use ephemeral keypair
    const aliceEphemeral = generateX25519KeyPair();

    // Alice calculates shared secret: S = ECDH(aliceEphPriv, bobIdentityPub)
    const aliceSharedSecret = calculateX25519SharedSecret(aliceEphemeral.privateKey, bobIdentity.publicKey);

    // Alice encrypts payload with AES-256-GCM
    const iv = getRandomBytes(12);
    const plaintextBytes = utf8ToBytes(secretPlaintext);
    const { ciphertext, tag } = await encryptAesGcm(aliceSharedSecret, plaintextBytes, iv);

    // Wire format payload: e2ee:v1:<ephPub>:<iv>:<tag>:<ciphertext>
    const envelope = `e2ee:v1:${toHex(aliceEphemeral.publicKey)}:${toHex(iv)}:${toHex(tag)}:${toHex(ciphertext)}`;

    // 3. Bob receives envelope
    const parts = envelope.split(':');
    assert.equal(parts[0], 'e2ee');
    assert.equal(parts[1], 'v1');

    const receivedEphPub = fromHex(parts[2]);
    const receivedIv = fromHex(parts[3]);
    const receivedTag = fromHex(parts[4]);
    const receivedCiphertext = fromHex(parts[5]);

    // Bob calculates shared secret: S = ECDH(bobIdentityPriv, aliceEphPub)
    const bobSharedSecret = calculateX25519SharedSecret(bobIdentity.privateKey, receivedEphPub);

    // Bob decrypts with AES-256-GCM
    const decryptedBytes = await decryptAesGcm(bobSharedSecret, receivedCiphertext, receivedTag, receivedIv);
    const decryptedText = bytesToUtf8(decryptedBytes);

    assert.equal(decryptedText, secretPlaintext);
  });

  it('rejects tampered ciphertexts with authentication tag mismatch', async () => {
    const bobIdentity = generateX25519KeyPair();
    const aliceEphemeral = generateX25519KeyPair();
    const aliceSharedSecret = calculateX25519SharedSecret(aliceEphemeral.privateKey, bobIdentity.publicKey);

    const iv = getRandomBytes(12);
    const { ciphertext, tag } = await encryptAesGcm(aliceSharedSecret, utf8ToBytes('Un-tampered text'), iv);

    // Tamper ciphertext byte
    const tamperedCipher = new Uint8Array(ciphertext);
    tamperedCipher[0] ^= 0xff;

    const bobSharedSecret = calculateX25519SharedSecret(bobIdentity.privateKey, aliceEphemeral.publicKey);

    await assert.rejects(
      async () => {
        await decryptAesGcm(bobSharedSecret, tamperedCipher, tag, iv);
      }
    );
  });
});
