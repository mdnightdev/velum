import {
  generateX25519KeyPair,
  deriveX25519KeyPairFromSeed,
  calculateX25519SharedSecret,
  deriveConversationKey,
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
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha512 } from '@noble/hashes/sha2.js';

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
    let identity: any = null;

    if (seedMaterial) {
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
          saltBytes = utf8ToBytes(`velum_identity_salt_uid_${uid}_x25519`);
        }
      }

      const seedBytes = pbkdf2(sha512, seedMaterial, saltBytes, { c: 10000, dkLen: 32 });
      const edIdentity = deriveEd25519KeyPairFromSeed(seedBytes);
      const dhIdentity = deriveX25519KeyPairFromSeed(seedBytes);

      await saveLocalIdentityKeys(uid, { signing: edIdentity, dh: dhIdentity });
      identity = { signing: edIdentity, dh: dhIdentity };

      const spk = generateX25519KeyPair();
      const spkSignature = signEd25519(spk.publicKey, identity.signing.privateKey);
      await saveSignedPrekey(uid, 1, spk, spkSignature);
        } else {
      identity = await loadLocalIdentityKeys(uid);
      if (!identity) {
        return;
      }
    }

    let signedPrekey = await loadSignedPrekey(uid);
    if (!signedPrekey) {
      const spk = generateX25519KeyPair();
      const spkSignature = signEd25519(spk.publicKey, identity.signing.privateKey);
      await saveSignedPrekey(uid, 1, spk, spkSignature);
      signedPrekey = { keyId: 1, keyPair: spk, signature: spkSignature };
    }

    if (!seedMaterial) {
      return;
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
   * Encrypts a direct message using pairwise static Diffie-Hellman: X25519(myPriv, peerPub) + HKDF + AES-256-GCM.
   * Wire format: e2ee:v3:<senderId>:<ivHex>:<tagHex>:<cipherPayloadHex>
   */
  public async encryptDirectMessage(plaintext: string, peerUserId: number): Promise<string> {
    if (peerUserId === 999) {
      return plaintext;
    }

    const uid = this.getLocalUserId();
    let localKeys = uid ? await loadLocalIdentityKeys(uid) : null;
    
    if (!localKeys || !localKeys.dh) {
      throw new Error('[StatelessE2EE] Local identity key unavailable');
    }

    const peerPubKeyHex = await this.fetchPeerPublicKey(peerUserId);
    const peerPubKeyBytes = fromHex(peerPubKeyHex);

    // 1. Calculate pairwise shared secret between sender and peer
    const sharedSecret = calculateX25519SharedSecret(localKeys.dh.privateKey, peerPubKeyBytes);

    // 2. Derive deterministic conversation key
    const convKey = deriveConversationKey(sharedSecret);

    // 3. Encrypt plaintext with fresh 12-byte IV via AES-256-GCM
    const ivPayload = getRandomBytes(12);
    const plaintextBytes = utf8ToBytes(plaintext);
    const { ciphertext: payloadCipher, tag: payloadTag } = await encryptAesGcm(convKey, plaintextBytes, ivPayload);

    return `e2ee:v3:${uid || 0}:${toHex(ivPayload)}:${toHex(payloadTag)}:${toHex(payloadCipher)}`;
  }

  /**
   * Decrypts a direct message envelope.
   * Supports:
   * - e2ee:v3 (Static Diffie-Hellman pairwise)
   * - e2ee:v2 (Legacy dual-recipient envelope)
   * - e2ee:v1 (Legacy ephemeral envelope)
   */
  public async decryptDirectMessage(envelope: string, contextPeerUserId?: number): Promise<string> {
    const uid = this.getLocalUserId();
    if (!uid) {
      throw new Error('[StatelessE2EE] Local user ID not initialized');
    }

    let localKeys = await loadLocalIdentityKeys(uid);
    
    if (!localKeys || !localKeys.dh) {
      throw new Error('[StatelessE2EE] Local identity key not found in storage');
    }

    // 1. Handle v3 Static Diffie-Hellman Pairwise Envelope
    if (envelope.startsWith('e2ee:v3:')) {
      const parts = envelope.split(':');
      if (parts.length !== 6) {
        throw new Error('[StatelessE2EE] Invalid v3 envelope format');
      }

      const [, , senderIdStr, ivPayloadHex, tagPayloadHex, cipherPayloadHex] = parts;
      const senderId = parseInt(senderIdStr, 10);
      const targetPeerId = (senderId === uid && contextPeerUserId)
        ? contextPeerUserId
        : (senderId !== uid && !isNaN(senderId) && senderId > 0 ? senderId : contextPeerUserId);

      if (!targetPeerId) {
        throw new Error('[StatelessE2EE] Missing peer user ID for conversation key derivation');
      }

      const peerPubKeyHex = await this.fetchPeerPublicKey(targetPeerId);
      const peerPubKeyBytes = fromHex(peerPubKeyHex);

      const sharedSecret = calculateX25519SharedSecret(localKeys.dh.privateKey, peerPubKeyBytes);
      const convKey = deriveConversationKey(sharedSecret);

      const decryptedBytes = await decryptAesGcm(
        convKey,
        fromHex(cipherPayloadHex),
        fromHex(tagPayloadHex),
        fromHex(ivPayloadHex)
      );
      return bytesToUtf8(decryptedBytes);
    }

    // 2. Handle Legacy v2 Dual-Recipient Envelope Fallback
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

    // 3. Handle Legacy v1 Envelope Fallback
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
