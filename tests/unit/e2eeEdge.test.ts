import { describe, it, expect, beforeEach, vi } from 'vitest';
import { statelessE2eeService } from '../../src/services/statelessE2eeService';
import {
  generateX25519KeyPair,
  calculateX25519SharedSecret,
  deriveConversationKey,
  encryptAesGcm,
  getRandomBytes,
  utf8ToBytes,
  toHex,
  fromHex
} from '../../src/services/cryptoPrimitives';
import { saveLocalIdentityKeys } from '../../src/services/cryptoDbStore';

describe('E2EE edge cases (self-read, hex, legacy payloads)', () => {
  const aliceId = 601;
  const bobId = 602;

  beforeEach(() => {
    statelessE2eeService.clearCache();
    vi.restoreAllMocks();
  });

  async function seedPair() {
    const aliceKeys = generateX25519KeyPair();
    const bobKeys = generateX25519KeyPair();
    const pubKeyMap: Record<number, string> = {
      [aliceId]: toHex(aliceKeys.publicKey),
      [bobId]: toHex(bobKeys.publicKey)
    };

    vi.spyOn(statelessE2eeService as any, 'fetchPeerPublicKey').mockImplementation(async (peerId: number) => {
      const hex = pubKeyMap[peerId];
      if (!hex) throw new Error(`Key not found for ${peerId}`);
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

    return { aliceKeys, bobKeys };
  }

  it('self-reads own-sent v3 history with contextPeerUserId and fails without it', async () => {
    await seedPair();
    vi.spyOn(statelessE2eeService, 'getLocalUserId').mockReturnValue(aliceId);

    const plain = 'own-sent history self-read';
    const envelope = await statelessE2eeService.encryptDirectMessage(plain, bobId);

    // Self-read requires conversation peer context
    expect(await statelessE2eeService.decryptDirectMessage(envelope, bobId)).toBe(plain);

    await expect(statelessE2eeService.decryptDirectMessage(envelope)).rejects.toThrow(
      /Missing peer user ID/
    );
  });

  it('fromHex truncates odd-length hex and strips non-hex without throwing', () => {
    expect(Array.from(fromHex('ab'))).toEqual([0xab]);
    // Odd nibble dropped via integer length/2
    expect(fromHex('abc').length).toBe(1);
    expect(fromHex('abc').length).toBe(fromHex('ab').length);
    // Non-hex stripped → same as clean hex
    expect(toHex(fromHex('de:ad:be:ef'))).toBe('deadbeef');
    expect(fromHex('').length).toBe(0);
    expect(fromHex('zz').length).toBe(0);
  });

  it('rejects v3 envelopes with truncated or malformed hex field lengths', async () => {
    const { aliceKeys, bobKeys } = await seedPair();
    vi.spyOn(statelessE2eeService, 'getLocalUserId').mockReturnValue(bobId);

    const convKey = deriveConversationKey(
      calculateX25519SharedSecret(aliceKeys.privateKey, bobKeys.publicKey)
    );
    const iv = getRandomBytes(12);
    const aad = utf8ToBytes(`velum-e2ee-v3:${aliceId}:${bobId}`);
    const plain = 'truncated-hex-payload-long-enough';
    const { ciphertext, tag } = await encryptAesGcm(convKey, utf8ToBytes(plain), iv, aad);
    const good = `e2ee:v3:${aliceId}:${toHex(iv)}:${toHex(tag)}:${toHex(ciphertext)}`;

    expect(await statelessE2eeService.decryptDirectMessage(good, aliceId)).toBe(plain);

    const truncatedIv = `e2ee:v3:${aliceId}:${toHex(iv).slice(0, 8)}:${toHex(tag)}:${toHex(ciphertext)}`;
    await expect(statelessE2eeService.decryptDirectMessage(truncatedIv, aliceId)).rejects.toThrow();

    const truncatedTag = `e2ee:v3:${aliceId}:${toHex(iv)}:${toHex(tag).slice(0, 8)}:${toHex(ciphertext)}`;
    await expect(statelessE2eeService.decryptDirectMessage(truncatedTag, aliceId)).rejects.toThrow();

    expect(toHex(ciphertext).length).toBeGreaterThan(8);
    const truncatedCipher = `e2ee:v3:${aliceId}:${toHex(iv)}:${toHex(tag)}:${toHex(ciphertext).slice(0, 8)}`;
    await expect(statelessE2eeService.decryptDirectMessage(truncatedCipher, aliceId)).rejects.toThrow();
  });

  it('rejects unrecognized and malformed legacy envelope payloads', async () => {
    await seedPair();
    vi.spyOn(statelessE2eeService, 'getLocalUserId').mockReturnValue(aliceId);

    await expect(statelessE2eeService.decryptDirectMessage('not-an-envelope')).rejects.toThrow(
      /Unrecognized envelope format/
    );

    await expect(statelessE2eeService.decryptDirectMessage('e2ee:v9:a:b:c:d')).rejects.toThrow(
      /Unrecognized envelope format/
    );

    // Wrong field counts
    await expect(statelessE2eeService.decryptDirectMessage('e2ee:v3:1:aabb')).rejects.toThrow(
      /Invalid v3 envelope format/
    );

    await expect(
      statelessE2eeService.decryptDirectMessage('e2ee:v1:aa:bb:cc')
    ).rejects.toThrow(/Invalid v1 envelope format/);

    await expect(
      statelessE2eeService.decryptDirectMessage('e2ee:v2:a:b:c:d:e')
    ).rejects.toThrow(/Invalid v2 envelope format/);

    // Recognized prefix but garbage crypto material
    const garbageV1 = `e2ee:v1:${'00'.repeat(8)}:${'11'.repeat(6)}:${'22'.repeat(8)}:${'33'.repeat(8)}`;
    await expect(statelessE2eeService.decryptDirectMessage(garbageV1)).rejects.toThrow();
  });
});
