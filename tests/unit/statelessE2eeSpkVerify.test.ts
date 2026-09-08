import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  statelessE2eeService,
  verifyPeerSignedPrekey
} from '../../src/services/statelessE2eeService';
import {
  generateEd25519KeyPair,
  generateX25519KeyPair,
  signEd25519,
  toHex,
  fromHex
} from '../../src/services/cryptoPrimitives';

describe('E2EE peer signed prekey (SPK) verification', () => {
  beforeEach(() => {
    statelessE2eeService.clearCache();
    vi.restoreAllMocks();
  });

  it('accepts a valid SPK signature and rejects a tampered one', async () => {
    const signing = generateEd25519KeyPair();
    const dh = generateX25519KeyPair();
    const spk = generateX25519KeyPair();
    const signature = signEd25519(spk.publicKey, signing.privateKey);

    const validBundle = {
      identityKeyHex: toHex(dh.publicKey),
      signingIdentityKeyHex: toHex(signing.publicKey),
      signedPrekeyHex: toHex(spk.publicKey),
      signedPrekeySignatureHex: toHex(signature)
    };

    expect(verifyPeerSignedPrekey(validBundle)).toBe(true);

    const tamperedSig = new Uint8Array(signature);
    tamperedSig[0] ^= 0xff;
    expect(
      verifyPeerSignedPrekey({
        ...validBundle,
        signedPrekeySignatureHex: toHex(tamperedSig)
      })
    ).toBe(false);

    const tamperedSpk = new Uint8Array(spk.publicKey);
    tamperedSpk[0] ^= 0xff;
    expect(
      verifyPeerSignedPrekey({
        ...validBundle,
        signedPrekeyHex: toHex(tamperedSpk)
      })
    ).toBe(false);
  });

  it('rejects fetchPeerPublicKey when the server returns a tampered SPK signature', async () => {
    const peerUserId = 501;
    const signing = generateEd25519KeyPair();
    const dh = generateX25519KeyPair();
    const spk = generateX25519KeyPair();
    const signature = signEd25519(spk.publicKey, signing.privateKey);
    const tamperedSig = new Uint8Array(signature);
    tamperedSig[3] ^= 0xaa;

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          bundle: {
            identityKey: toHex(dh.publicKey),
            signingIdentityKey: toHex(signing.publicKey),
            signedPrekey: toHex(spk.publicKey),
            signedPrekeySignature: toHex(tamperedSig)
          }
        })
      }))
    );

    await expect(statelessE2eeService.fetchPeerPublicKey(peerUserId)).rejects.toThrow(
      /Invalid or tampered signed prekey/
    );

    // Valid signature succeeds and returns DH identity key
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          bundle: {
            identityKey: toHex(dh.publicKey),
            signingIdentityKey: toHex(signing.publicKey),
            signedPrekey: toHex(spk.publicKey),
            signedPrekeySignature: toHex(signature)
          }
        })
      }))
    );

    const keyHex = await statelessE2eeService.fetchPeerPublicKey(peerUserId);
    expect(keyHex).toBe(toHex(dh.publicKey));
    expect(fromHex(keyHex).length).toBe(32);
  });
});
