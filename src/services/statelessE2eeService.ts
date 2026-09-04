import {
  generateX25519KeyPair,
  deriveX25519KeyPairFromSeed,
  calculateX25519SharedSecret,
  generateEd25519KeyPair,
  deriveEd25519KeyPairFromSeed,
  signEd25519,
  encryptAesGcm,
  decryptAesGcm,
  getRandomBytes,
  utf8ToBytes,
  bytesToUtf8,
  toHex,
  fromHex
} from './cryptoPrimitives.js';
import {
  loadLocalIdentityKeys,
  saveLocalIdentityKeys,
  saveSignedPrekey,
  loadSignedPrekey
} from './cryptoDbStore.js';
import { getSessionId } from '../utils/auth.js';
import { storage } from './storageService';

class StatelessE2eeService {
  private localUserId: number | null = null;
  private peerKeyCache = new Map<number, { keyHex: string; timestamp: number }>();
  private readonly CACHE_TTL_MS = 60 * 1000; // 1 minute fresh cache

    public setLocalUserId(userId: number | null): void {
    this.localUserId = userId;
    this.peerKeyCache.clear();
  }

  public getLocalUserId(): number | null {
    try {
      if (typeof window !== 'undefined') {
        const cached = storage.getItem<any>('velum-user');
        if (cached) {
          const u = typeof cached === 'string' ? JSON.parse(cached) : cached;
          const id = u?.id || u?.userId;
          if (id) {
            this.localUserId = Number(id);
            return this.localUserId;
          }
        }
      }
    } catch {}
    return this.localUserId;
  }

  public clearCache(): void {
    this.localUserId = null;
    this.peerKeyCache.clear();
  }

  /**
   * Initializes local identity keys in user IndexedDB and publishes public keys to server
   */
  public async initLocalIdentityKeys(userId?: number, seedMaterial?: string, userSaltHex?: string): Promise<void> {
    const uid = userId || this.getLocalUserId();
    if (!uid) return;

    this.localUserId = uid;
    let identity = await loadLocalIdentityKeys(uid);

    if (!identity) {
      let edIdentity;
      let dhIdentity;

      if (seedMaterial && window.crypto?.subtle) {
        const enc = new TextEncoder();
        const baseKey = await window.crypto.subtle.importKey(
          'raw',
          enc.encode(seedMaterial),
          { name: 'PBKDF2' },
          false,
          ['deriveBits']
        );
        let saltBytes: Uint8Array;
        if (userSaltHex && /^[0-9a-fA-F]+$/.test(userSaltHex)) {
          saltBytes = fromHex(userSaltHex);
        } else {
          // Fallback to high-entropy user-scoped salt
          const cachedUser = storage.getItem<any>('velum-user');
          const rawSalt = cachedUser?.salt || (typeof cachedUser === 'string' ? JSON.parse(cachedUser)?.salt : '');
          if (rawSalt && /^[0-9a-fA-F]+$/.test(rawSalt)) {
            saltBytes = fromHex(rawSalt);
          } else {
            saltBytes = enc.encode(`velum_identity_salt_uid_${uid}_x25519`);
          }
        }
        const bits = await window.crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: saltBytes as unknown as BufferSource, iterations: 100000, hash: 'SHA-512' },
          baseKey,
          256
        );
        const seedBytes = new Uint8Array(bits);
        edIdentity = deriveEd25519KeyPairFromSeed(seedBytes);
        dhIdentity = deriveX25519KeyPairFromSeed(seedBytes);
      } else {
        edIdentity = generateEd25519KeyPair();
        dhIdentity = generateX25519KeyPair();
      }

      await saveLocalIdentityKeys(uid, { signing: edIdentity, dh: dhIdentity });
      identity = { signing: edIdentity, dh: dhIdentity };

      const spk = generateX25519KeyPair();
      const spkSignature = signEd25519(spk.publicKey, identity.signing.privateKey);
      await saveSignedPrekey(uid, 1, spk, spkSignature);
    }

    let signedPrekey = await loadSignedPrekey(uid);
    if (!signedPrekey) {
      const spk = generateX25519KeyPair();
      const spkSignature = signEd25519(spk.publicKey, identity.signing.privateKey);
      await saveSignedPrekey(uid, 1, spk, spkSignature);
      signedPrekey = { keyId: 1, keyPair: spk, signature: spkSignature };
    }

    // Publish public identity key and signed prekey to backend
    try {
      const sid = getSessionId() || '';
      const res = await fetch('/v2/crypto/prekeys', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sid}`,
          'x-session-id': sid,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          identityKey: toHex(identity.dh.publicKey),
          signedPrekey: toHex(signedPrekey.keyPair.publicKey),
          signedPrekeyId: signedPrekey.keyId,
          signedPrekeySignature: toHex(signedPrekey.signature),
          oneTimePrekeys: []
        })
      });
      if (!res.ok) {
        console.warn('[StatelessE2EE] Prekey publication response:', res.status);
      }
    } catch (err) {
      console.warn('[StatelessE2EE] Prekey publication error:', err);
    }
  }

  /**
   * Fetches peer's public DH identity key
   */
  public async fetchPeerPublicKey(peerUserId: number): Promise<string> {
    const cached = this.peerKeyCache.get(peerUserId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.keyHex;
    }

    const sid = getSessionId() || '';
    const res = await fetch(`/v2/crypto/prekeys/${peerUserId}`, {
      headers: {
        'Authorization': `Bearer ${sid}`,
        'x-session-id': sid
      }
    });

    if (!res.ok) {
      throw new Error(`[StatelessE2EE] Peer ${peerUserId} has not published their identity key yet.`);
    }

    const data = await res.json();
    const bundle = data.bundle || data;
    const pubKeyHex = bundle.identityKey || bundle.identityKeyHex || bundle.dhIdentityKeyHex;

    if (!pubKeyHex) {
      throw new Error(`[StatelessE2EE] No public DH identity key found for peer ${peerUserId}`);
    }

    this.peerKeyCache.set(peerUserId, { keyHex: pubKeyHex, timestamp: Date.now() });
    return pubKeyHex;
  }

  /**
   * Encrypts a direct message using Dual-Recipient Ephemeral ECDH + AES-256-GCM.
   * Wire format: e2ee:v2:<ephPubKeyHex>:<senderKeyTuple>:<recipientKeyTuple>:<ivHex>:<tagHex>:<cipherPayloadHex>
   */
  public async encryptDirectMessage(plaintext: string, peerUserId: number): Promise<string> {
    const uid = this.getLocalUserId();
    let localKeys = uid ? await loadLocalIdentityKeys(uid) : null;
    if (!localKeys || !localKeys.dh) {
      if (uid) await this.initLocalIdentityKeys(uid);
      localKeys = uid ? await loadLocalIdentityKeys(uid) : null;
    }

    const peerPubKeyHex = await this.fetchPeerPublicKey(peerUserId);
    const peerPubKeyBytes = fromHex(peerPubKeyHex);

    // 1. Generate fresh one-time ephemeral keypair
    const ephKeyPair = generateX25519KeyPair();
    const ephPubKeyHex = toHex(ephKeyPair.publicKey);

    // 2. Generate random 256-bit symmetric payload key
    const payloadKey = getRandomBytes(32);

    // 3. Encrypt payloadKey for Recipient (Peer)
    const sharedRecipient = calculateX25519SharedSecret(ephKeyPair.privateKey, peerPubKeyBytes);
    const ivRecipient = getRandomBytes(12);
    const { ciphertext: encKeyRecipient, tag: tagRecipient } = await encryptAesGcm(sharedRecipient, payloadKey, ivRecipient);
    const recipientKeyTuple = `${toHex(ivRecipient)}.${toHex(tagRecipient)}.${toHex(encKeyRecipient)}`;

    // 4. Encrypt payloadKey for Sender (Self) if local identity keys exist
    let senderKeyTuple = '';
    if (localKeys?.dh) {
      const sharedSender = calculateX25519SharedSecret(ephKeyPair.privateKey, localKeys.dh.publicKey);
      const ivSender = getRandomBytes(12);
      const { ciphertext: encKeySender, tag: tagSender } = await encryptAesGcm(sharedSender, payloadKey, ivSender);
      senderKeyTuple = `${toHex(ivSender)}.${toHex(tagSender)}.${toHex(encKeySender)}`;
    }

    // 5. Encrypt actual plaintext with the payloadKey
    const ivPayload = getRandomBytes(12);
    const plaintextBytes = utf8ToBytes(plaintext);
    const { ciphertext: payloadCipher, tag: payloadTag } = await encryptAesGcm(payloadKey, plaintextBytes, ivPayload);

    return `e2ee:v2:${ephPubKeyHex}:${senderKeyTuple}:${recipientKeyTuple}:${toHex(ivPayload)}:${toHex(payloadTag)}:${toHex(payloadCipher)}`;
  }

  /**
   * Decrypts a stateless e2ee message using local private key and sender's ephemeral public key
   * Supports both e2ee:v2 (dual-recipient) and e2ee:v1 (legacy).
   */
  public async decryptDirectMessage(envelope: string): Promise<string> {
    const uid = this.getLocalUserId();
    if (!uid) {
      throw new Error('[StatelessE2EE] Local user ID not initialized');
    }

    let localKeys = await loadLocalIdentityKeys(uid);
    if (!localKeys || !localKeys.dh) {
      await this.initLocalIdentityKeys(uid);
      localKeys = await loadLocalIdentityKeys(uid);
    }

    if (!localKeys || !localKeys.dh) {
      throw new Error('[StatelessE2EE] Local identity key not found in storage');
    }

    // Handle v2 Dual-Recipient Envelope
    if (envelope.startsWith('e2ee:v2:')) {
      const parts = envelope.split(':');
      if (parts.length !== 8) {
        throw new Error('[StatelessE2EE] Invalid v2 envelope format');
      }

      const [, , ephPubKeyHex, senderKeyTuple, recipientKeyTuple, ivPayloadHex, tagPayloadHex, cipherPayloadHex] = parts;
      const ephPubKeyBytes = fromHex(ephPubKeyHex);
      const sharedSecret = calculateX25519SharedSecret(localKeys.dh.privateKey, ephPubKeyBytes);

      let payloadKey: Uint8Array | null = null;

      // Try decrypting recipient key tuple
      if (recipientKeyTuple) {
        const [rIvHex, rTagHex, rCipherHex] = recipientKeyTuple.split('.');
        if (rIvHex && rTagHex && rCipherHex) {
          try {
            payloadKey = await decryptAesGcm(sharedSecret, fromHex(rCipherHex), fromHex(rTagHex), fromHex(rIvHex));
          } catch {}
        }
      }

      // If not recipient, try decrypting sender key tuple (sender viewing their own history on any device!)
      if (!payloadKey && senderKeyTuple) {
        const [sIvHex, sTagHex, sCipherHex] = senderKeyTuple.split('.');
        if (sIvHex && sTagHex && sCipherHex) {
          try {
            payloadKey = await decryptAesGcm(sharedSecret, fromHex(sCipherHex), fromHex(sTagHex), fromHex(sIvHex));
          } catch {}
        }
      }

      if (!payloadKey) {
        throw new Error('[StatelessE2EE] Unable to decrypt payload key with local identity');
      }

      const decryptedBytes = await decryptAesGcm(payloadKey, fromHex(cipherPayloadHex), fromHex(tagPayloadHex), fromHex(ivPayloadHex));
      return bytesToUtf8(decryptedBytes);
    }

    // Handle v1 Legacy Envelope
    if (envelope.startsWith('e2ee:v1:')) {
      const parts = envelope.split(':');
      if (parts.length !== 6) {
        throw new Error('[StatelessE2EE] Invalid v1 envelope format');
      }

      const [, , ephPubKeyHex, ivHex, tagHex, cipherHex] = parts;
      const ephPubKeyBytes = fromHex(ephPubKeyHex);
      const iv = fromHex(ivHex);
      const tag = fromHex(tagHex);
      const ciphertext = fromHex(cipherHex);

      const sharedSecret = calculateX25519SharedSecret(localKeys.dh.privateKey, ephPubKeyBytes);
      const decryptedBytes = await decryptAesGcm(sharedSecret, ciphertext, tag, iv);
      return bytesToUtf8(decryptedBytes);
    }

    throw new Error('[StatelessE2EE] Unrecognized envelope format');
  }
}

export const statelessE2eeService = new StatelessE2eeService();
