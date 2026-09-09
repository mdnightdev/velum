import { describe, it, expect, beforeEach, vi } from 'vitest';
import { encryptMessage, decryptMessage, computeClientHash, EncryptionContext } from './encryptionService';
import { statelessE2eeService } from './statelessE2eeService';
import {
  generateX25519KeyPair,
  calculateX25519SharedSecret,
  deriveConversationKey,
  encryptAesGcm,
  decryptAesGcm,
  deriveX25519KeyPairFromSeed,
  deriveEd25519KeyPairFromSeed,
  deriveIdentityKeyPairsFromMasterSeed,
  toHex,
  utf8ToBytes,
  bytesToUtf8,
  getRandomBytes
} from './cryptoPrimitives';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';

describe('encryptionService tests', () => {
  beforeEach(() => {
    statelessE2eeService.clearCache();
    vi.restoreAllMocks();
  });

  it('should encrypt and decrypt a lounge message correctly', async () => {
    const plain = 'Hello world, secure E2EE!';
    const context: EncryptionContext = { type: 'lounge', roomId: 'lounge-123', isEncrypted: true };
    const encrypted = await encryptMessage(plain, context);
    expect(encrypted).not.toBe(plain);
    expect(encrypted.startsWith('VEL_E2EE[')).toBe(true);

    const decrypted = await decryptMessage(encrypted, context);
    expect(decrypted).toBe(plain);
  });

  it('should pass through unencrypted content', async () => {
    const plain = 'Standard message';
    const context: EncryptionContext = { type: 'lounge', roomId: 'lounge-123', isEncrypted: false };
    const result = await decryptMessage(plain, context);
    expect(result).toBe(plain);
  });

  it('should compute SHA-256 client hash correctly', async () => {
    const secret = 'my-secret-password';
    const salt = 'some-salt-value';
    const hash = await computeClientHash(secret, salt);
    expect(hash).toBeDefined();
    expect(hash).toHaveLength(64);

    const secondHash = await computeClientHash(secret, salt);
    expect(secondHash).toBe(hash);

    const differentHash = await computeClientHash(secret + '1', salt);
    expect(differentHash).not.toBe(hash);
  });

  it('should execute full pairwise Diffie-Hellman math: Alice <-> Bob', async () => {
    // 1. Generate keypairs for Alice and Bob
    const aliceKeys = generateX25519KeyPair();
    const bobKeys = generateX25519KeyPair();

    // 2. Both derive pairwise shared secret
    const sharedSecretAlice = calculateX25519SharedSecret(aliceKeys.privateKey, bobKeys.publicKey);
    const sharedSecretBob = calculateX25519SharedSecret(bobKeys.privateKey, aliceKeys.publicKey);

    // 3. Mathematical identity guarantee: Alice and Bob have the exact same shared secret
    expect(toHex(sharedSecretAlice)).toBe(toHex(sharedSecretBob));

    // 4. Both derive the exact same conversation key
    const convKeyAlice = deriveConversationKey(sharedSecretAlice);
    const convKeyBob = deriveConversationKey(sharedSecretBob);
    expect(toHex(convKeyAlice)).toBe(toHex(convKeyBob));

    // 5. Alice encrypts message for Bob
    const plaintext = 'Direct message from Alice to Bob';
    const iv = getRandomBytes(12);
    const { ciphertext, tag } = await encryptAesGcm(convKeyAlice, utf8ToBytes(plaintext), iv);

    // 6. Bob decrypts message from Alice
    const decryptedByBob = await decryptAesGcm(convKeyBob, ciphertext, tag, iv);
    expect(bytesToUtf8(decryptedByBob)).toBe(plaintext);

    // 7. Alice can decrypt her own sent message using the same conversation key
    const decryptedByAlice = await decryptAesGcm(convKeyAlice, ciphertext, tag, iv);
    expect(bytesToUtf8(decryptedByAlice)).toBe(plaintext);
  });

  it('should guarantee multi-device determinism via password seed derivation', async () => {
    const password = 'UserMasterPass123!';
    const saltHex = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
    const saltBytes = utf8ToBytes(saltHex);

    // Device 1 (e.g. Phone) derives identity keys with domain separation
    const seedDevice1 = pbkdf2(sha512, password, saltBytes, { c: 10000, dkLen: 32 });
    const keysDevice1 = deriveIdentityKeyPairsFromMasterSeed(seedDevice1);

    // Device 2 (e.g. Laptop) derives identity keys
    const seedDevice2 = pbkdf2(sha512, password, saltBytes, { c: 10000, dkLen: 32 });
    const keysDevice2 = deriveIdentityKeyPairsFromMasterSeed(seedDevice2);

    // Both devices derive identical signing and DH keys
    expect(toHex(keysDevice1.dh.privateKey)).toBe(toHex(keysDevice2.dh.privateKey));
    expect(toHex(keysDevice1.dh.publicKey)).toBe(toHex(keysDevice2.dh.publicKey));
    expect(toHex(keysDevice1.signing.privateKey)).toBe(toHex(keysDevice2.signing.privateKey));
    expect(toHex(keysDevice1.signing.publicKey)).toBe(toHex(keysDevice2.signing.publicKey));

    // Device 2 can compute conversation key with peer (Bob) and decrypt Device 1's messages
    const bobKeys = generateX25519KeyPair();
    const convKeyDevice1 = deriveConversationKey(calculateX25519SharedSecret(keysDevice1.dh.privateKey, bobKeys.publicKey));
    const convKeyDevice2 = deriveConversationKey(calculateX25519SharedSecret(keysDevice2.dh.privateKey, bobKeys.publicKey));

    expect(toHex(convKeyDevice1)).toBe(toHex(convKeyDevice2));
  });

  it('derives Ed25519 and X25519 identity keys deterministically and independently', () => {
    const masterSeed = pbkdf2(sha512, 'domain-sep-pass', utf8ToBytes('salt'), { c: 10000, dkLen: 32 });

    const first = deriveIdentityKeyPairsFromMasterSeed(masterSeed);
    const second = deriveIdentityKeyPairsFromMasterSeed(masterSeed);

    // Deterministic re-derivation
    expect(toHex(first.signing.privateKey)).toBe(toHex(second.signing.privateKey));
    expect(toHex(first.dh.privateKey)).toBe(toHex(second.dh.privateKey));

    // Domain separation: signing and DH private keys must not be identical raw bytes
    expect(toHex(first.signing.privateKey)).not.toBe(toHex(first.dh.privateKey));
    expect(toHex(first.signing.publicKey)).not.toBe(toHex(first.dh.publicKey));

    // Explicit HKDF info strings produce the independent seeds used by each curve
    const edSeed = hkdf(sha256, masterSeed, undefined, utf8ToBytes('velum-ed25519'), 32);
    const xSeed = hkdf(sha256, masterSeed, undefined, utf8ToBytes('velum-x25519'), 32);
    expect(toHex(edSeed)).not.toBe(toHex(xSeed));
    expect(toHex(deriveEd25519KeyPairFromSeed(edSeed).privateKey)).toBe(toHex(first.signing.privateKey));
    expect(toHex(deriveX25519KeyPairFromSeed(xSeed).privateKey)).toBe(toHex(first.dh.privateKey));

    // Seeding both curves from the raw master seed (pre-fix path) collides — must not match domain-separated keys
    const reusedEd = deriveEd25519KeyPairFromSeed(masterSeed);
    const reusedX = deriveX25519KeyPairFromSeed(masterSeed);
    expect(toHex(reusedEd.privateKey)).toBe(toHex(reusedX.privateKey));
    expect(toHex(first.signing.privateKey)).not.toBe(toHex(reusedEd.privateKey));
    expect(toHex(first.dh.privateKey)).not.toBe(toHex(reusedX.privateKey));
  });

  it('should prevent unauthorized third party (Charlie) from decrypting', async () => {
    const aliceKeys = generateX25519KeyPair();
    const bobKeys = generateX25519KeyPair();
    const charlieKeys = generateX25519KeyPair();

    const convKeyAlice = deriveConversationKey(calculateX25519SharedSecret(aliceKeys.privateKey, bobKeys.publicKey));
    const convKeyCharlie = deriveConversationKey(calculateX25519SharedSecret(charlieKeys.privateKey, aliceKeys.publicKey));

    // Charlie's key does not match Alice & Bob's conversation key
    expect(toHex(convKeyCharlie)).not.toBe(toHex(convKeyAlice));

    // Charlie fails to decrypt Alice's message to Bob
    const plaintext = 'Secret between Alice and Bob';
    const iv = getRandomBytes(12);
    const { ciphertext, tag } = await encryptAesGcm(convKeyAlice, utf8ToBytes(plaintext), iv);

    await expect(decryptAesGcm(convKeyCharlie, ciphertext, tag, iv)).rejects.toThrow();
  });

  it('should handle direct message encryption and decryption via statelessE2eeService', async () => {
    const aliceId = 101;
    const bobId = 102;
    const aliceKeys = generateX25519KeyPair();
    const bobKeys = generateX25519KeyPair();

    // Mock key store and public key fetcher
    const pubKeyMap: Record<number, string> = {
      [aliceId]: toHex(aliceKeys.publicKey),
      [bobId]: toHex(bobKeys.publicKey)
    };

    vi.spyOn(statelessE2eeService as any, 'fetchPeerPublicKey').mockImplementation(async (peerId: number) => {
      const hex = pubKeyMap[peerId];
      if (!hex) throw new Error('Key not found');
      return hex;
    });

    // Mock Alice's session
    vi.spyOn(statelessE2eeService, 'getLocalUserId').mockReturnValue(aliceId);
    vi.spyOn(statelessE2eeService as any, 'initLocalIdentityKeys').mockImplementation(async () => {});

    // Save Alice's identity in test
    const { saveLocalIdentityKeys } = await import('./cryptoDbStore');
    await saveLocalIdentityKeys(aliceId, {
      signing: { privateKey: new Uint8Array(32), publicKey: new Uint8Array(32) },
      dh: aliceKeys
    });

    // Alice encrypts for Bob
    const plain = 'Direct message via E2EE v3';
    const envelope = await statelessE2eeService.encryptDirectMessage(plain, bobId);

    expect(envelope.startsWith('e2ee:v3:101:')).toBe(true);

    // Alice decrypts her own sent message
    const aliceDecrypted = await statelessE2eeService.decryptDirectMessage(envelope, bobId);
    expect(aliceDecrypted).toBe(plain);

    // Switch to Bob's session
    vi.spyOn(statelessE2eeService, 'getLocalUserId').mockReturnValue(bobId);
    await saveLocalIdentityKeys(bobId, {
      signing: { privateKey: new Uint8Array(32), publicKey: new Uint8Array(32) },
      dh: bobKeys
    });

    // Bob decrypts message received from Alice
    const bobDecrypted = await statelessE2eeService.decryptDirectMessage(envelope, aliceId);
    expect(bobDecrypted).toBe(plain);
  });

  it('should bind v3 AES-GCM AAD to senderId and recipientId', async () => {
    const aliceId = 201;
    const bobId = 202;
    const charlieId = 203;
    const aliceKeys = generateX25519KeyPair();
    const bobKeys = generateX25519KeyPair();

    const convKey = deriveConversationKey(
      calculateX25519SharedSecret(aliceKeys.privateKey, bobKeys.publicKey)
    );
    const plaintext = 'AAD-bound payload';
    const iv = getRandomBytes(12);
    const aad = utf8ToBytes(`velum-e2ee-v3:${aliceId}:${bobId}`);
    const { ciphertext, tag } = await encryptAesGcm(convKey, utf8ToBytes(plaintext), iv, aad);

    const ok = await decryptAesGcm(convKey, ciphertext, tag, iv, aad);
    expect(bytesToUtf8(ok)).toBe(plaintext);

    const wrongPeerAad = utf8ToBytes(`velum-e2ee-v3:${aliceId}:${charlieId}`);
    await expect(decryptAesGcm(convKey, ciphertext, tag, iv, wrongPeerAad)).rejects.toThrow();

    await expect(decryptAesGcm(convKey, ciphertext, tag, iv)).rejects.toThrow();
  });

  it('should decrypt legacy v3 envelopes sealed without AAD (option A fallback)', async () => {
    const aliceId = 301;
    const bobId = 302;
    const aliceKeys = generateX25519KeyPair();
    const bobKeys = generateX25519KeyPair();

    const pubKeyMap: Record<number, string> = {
      [aliceId]: toHex(aliceKeys.publicKey),
      [bobId]: toHex(bobKeys.publicKey)
    };

    vi.spyOn(statelessE2eeService as any, 'fetchPeerPublicKey').mockImplementation(async (peerId: number) => {
      const hex = pubKeyMap[peerId];
      if (!hex) throw new Error('Key not found');
      return hex;
    });

    const { saveLocalIdentityKeys } = await import('./cryptoDbStore');
    await saveLocalIdentityKeys(bobId, {
      signing: { privateKey: new Uint8Array(32), publicKey: new Uint8Array(32) },
      dh: bobKeys
    });

    const convKey = deriveConversationKey(
      calculateX25519SharedSecret(aliceKeys.privateKey, bobKeys.publicKey)
    );
    const plain = 'Legacy v3 without AAD';
    const iv = getRandomBytes(12);
    const { ciphertext, tag } = await encryptAesGcm(convKey, utf8ToBytes(plain), iv);
    const envelope = `e2ee:v3:${aliceId}:${toHex(iv)}:${toHex(tag)}:${toHex(ciphertext)}`;

    vi.spyOn(statelessE2eeService, 'getLocalUserId').mockReturnValue(bobId);
    const decrypted = await statelessE2eeService.decryptDirectMessage(envelope, aliceId);
    expect(decrypted).toBe(plain);
  });
});
