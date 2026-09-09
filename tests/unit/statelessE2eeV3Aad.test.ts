import { describe, it, expect, beforeEach, vi } from 'vitest';
import { statelessE2eeService } from '../../src/services/statelessE2eeService';
import {
  generateX25519KeyPair,
  calculateX25519SharedSecret,
  deriveConversationKey,
  encryptAesGcm,
  decryptAesGcm,
  getRandomBytes,
  utf8ToBytes,
  bytesToUtf8,
  toHex
} from '../../src/services/cryptoPrimitives';
import { saveLocalIdentityKeys } from '../../src/services/cryptoDbStore';

function buildV3Aad(senderId: number, recipientId: number): Uint8Array {
  return utf8ToBytes(`velum-e2ee-v3:${senderId}:${recipientId}`);
}

describe('E2EE v3 AAD binding (senderId + peerId)', () => {
  const aliceId = 401;
  const bobId = 402;
  const charlieId = 403;

  beforeEach(() => {
    statelessE2eeService.clearCache();
    vi.restoreAllMocks();
  });

  it('encrypts and decrypts with AAD bound to senderId and peerId', async () => {
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

    await saveLocalIdentityKeys(aliceId, {
      signing: { privateKey: new Uint8Array(32), publicKey: new Uint8Array(32) },
      dh: aliceKeys
    });
    await saveLocalIdentityKeys(bobId, {
      signing: { privateKey: new Uint8Array(32), publicKey: new Uint8Array(32) },
      dh: bobKeys
    });

    vi.spyOn(statelessE2eeService, 'getLocalUserId').mockReturnValue(aliceId);
    const plain = 'v3 AAD round-trip';
    const envelope = await statelessE2eeService.encryptDirectMessage(plain, bobId);
    expect(envelope.startsWith(`e2ee:v3:${aliceId}:`)).toBe(true);

    // Sender self-read (recipientId = peerId from context)
    expect(await statelessE2eeService.decryptDirectMessage(envelope, bobId)).toBe(plain);

    // Recipient decrypt (recipientId = local uid)
    vi.spyOn(statelessE2eeService, 'getLocalUserId').mockReturnValue(bobId);
    expect(await statelessE2eeService.decryptDirectMessage(envelope, aliceId)).toBe(plain);
  });

  it('rejects decryption when senderId or peerId in AAD is tampered', async () => {
    const aliceKeys = generateX25519KeyPair();
    const bobKeys = generateX25519KeyPair();
    const convKey = deriveConversationKey(
      calculateX25519SharedSecret(aliceKeys.privateKey, bobKeys.publicKey)
    );

    const plaintext = 'tamper-sensitive payload';
    const iv = getRandomBytes(12);
    const authenticAad = buildV3Aad(aliceId, bobId);
    const { ciphertext, tag } = await encryptAesGcm(
      convKey,
      utf8ToBytes(plaintext),
      iv,
      authenticAad
    );

    expect(bytesToUtf8(await decryptAesGcm(convKey, ciphertext, tag, iv, authenticAad))).toBe(
      plaintext
    );

    // Tampered senderId, correct peerId
    await expect(
      decryptAesGcm(convKey, ciphertext, tag, iv, buildV3Aad(charlieId, bobId))
    ).rejects.toThrow();

    // Correct senderId, tampered peerId
    await expect(
      decryptAesGcm(convKey, ciphertext, tag, iv, buildV3Aad(aliceId, charlieId))
    ).rejects.toThrow();

    // Both IDs swapped (wrong binding)
    await expect(
      decryptAesGcm(convKey, ciphertext, tag, iv, buildV3Aad(bobId, aliceId))
    ).rejects.toThrow();
  });

  it('decrypts when envelope senderId is 0 (own-sent history and recipient)', async () => {
    const senderId = 0;
    const peerId = bobId;
    const senderKeys = generateX25519KeyPair();
    const peerKeys = generateX25519KeyPair();
    const pubKeyMap: Record<number, string> = {
      [senderId]: toHex(senderKeys.publicKey),
      [peerId]: toHex(peerKeys.publicKey)
    };

    vi.spyOn(statelessE2eeService as any, 'fetchPeerPublicKey').mockImplementation(async (id: number) => {
      const hex = pubKeyMap[id];
      if (!hex) throw new Error(`Key not found for ${id}`);
      return hex;
    });

    await saveLocalIdentityKeys(senderId, {
      signing: { privateKey: new Uint8Array(32), publicKey: new Uint8Array(32) },
      dh: senderKeys
    });
    await saveLocalIdentityKeys(peerId, {
      signing: { privateKey: new Uint8Array(32), publicKey: new Uint8Array(32) },
      dh: peerKeys
    });

    vi.spyOn(statelessE2eeService, 'getLocalUserId').mockReturnValue(senderId);
    const plain = 'senderId zero must not be treated as missing';
    const envelope = await statelessE2eeService.encryptDirectMessage(plain, peerId);
    expect(envelope.startsWith('e2ee:v3:0:')).toBe(true);

    // Own-sent history: localUid === 0, contextPeerUserId === peer
    expect(await statelessE2eeService.decryptDirectMessage(envelope, peerId)).toBe(plain);

    // Recipient: envelope senderId 0 must resolve as ECDH peer (not falsy fallback)
    vi.spyOn(statelessE2eeService, 'getLocalUserId').mockReturnValue(peerId);
    expect(await statelessE2eeService.decryptDirectMessage(envelope, senderId)).toBe(plain);
  });
});
