import {
  generateX25519KeyPair,
  calculateX25519SharedSecret,
  deriveConversationKey,
  deriveIdentityKeyPairsFromMasterSeed,
  signEd25519,
  verifyEd25519,
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
import { getPlaintextByCiphertext } from '../utils/indexedDb.js';
import { getSessionId } from '../utils/auth.js';
import { storage } from './storageService';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha512 } from '@noble/hashes/sha2.js';

function buildV3Aad(senderId: number, recipientId: number): Uint8Array {
  return utf8ToBytes(`velum-e2ee-v3:${senderId}:${recipientId}`);
}

/** User IDs are non-negative integers; 0 is a valid ID (do not use truthiness). */
function isResolvedUserId(id: number | null | undefined): id is number {
  return typeof id === 'number' && Number.isInteger(id) && id >= 0 && !Number.isNaN(id);
}

/**
 * Resolve the peer whose public DH key is needed for v3 ECDH.
 * - Own-sent history (senderId === localUid): use contextPeerUserId.
 * - Received message (senderId !== localUid): use envelope senderId (including 0).
 * - Invalid/missing senderId: fall back to contextPeerUserId.
 */
function resolveV3TargetPeerId(
  senderId: number,
  localUid: number,
  contextPeerUserId?: number
): number | undefined {
  if (isResolvedUserId(senderId) && senderId === localUid) {
    return isResolvedUserId(contextPeerUserId) ? contextPeerUserId : undefined;
  }
  if (isResolvedUserId(senderId) && senderId !== localUid) {
    return senderId;
  }
  return isResolvedUserId(contextPeerUserId) ? contextPeerUserId : undefined;
}

export type PeerPrekeyBundle = {
  identityKeyHex: string;
  signingIdentityKeyHex: string;
  signedPrekeyHex: string;
  signedPrekeySignatureHex: string;
};

/** Verifies SPK was signed by the peer's Ed25519 identity key. */
export function verifyPeerSignedPrekey(bundle: PeerPrekeyBundle): boolean {
  if (
    !bundle.identityKeyHex ||
    !bundle.signingIdentityKeyHex ||
    !bundle.signedPrekeyHex ||
    !bundle.signedPrekeySignatureHex
  ) {
    return false;
  }
  try {
    return verifyEd25519(
      fromHex(bundle.signedPrekeySignatureHex),
      fromHex(bundle.signedPrekeyHex),
      fromHex(bundle.signingIdentityKeyHex)
    );
  } catch {
    return false;
  }
}

/** True when the bundle includes full SPK + Ed25519 material (post-migration peers). */
export function peerBundleHasSpkMaterial(bundle: PeerPrekeyBundle): boolean {
  return !!(
    bundle.signingIdentityKeyHex &&
    bundle.signedPrekeyHex &&
    bundle.signedPrekeySignatureHex
  );
}

/**
 * ECDH only needs DH identity. Strict SPK verify when material is present;
 * legacy bundles (no Ed/SPK) are accepted so decrypt does not hard-fail.
 */
export function acceptPeerBundleForEcdh(bundle: PeerPrekeyBundle): boolean {
  if (!bundle.identityKeyHex) return false;
  if (!peerBundleHasSpkMaterial(bundle)) return true;
  return verifyPeerSignedPrekey(bundle);
}

class StatelessE2eeService {
  private localUserId: number | null = null;
  private peerKeyCache = new Map<number, PeerPrekeyBundle & { timestamp: number }>();
  /** Keep peer DH keys warm across room opens — 1m was too short and re-hit the network. */
  private readonly CACHE_TTL_MS = 30 * 60 * 1000;

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
  public async initLocalIdentityKeys(
    userId?: number,
    seedMaterial?: string,
    userSaltHex?: string,
    sessionToken?: string | null
  ): Promise<void> {
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
      const { signing: edIdentity, dh: dhIdentity } = deriveIdentityKeyPairsFromMasterSeed(seedBytes);

      await saveLocalIdentityKeys(uid, { signing: edIdentity, dh: dhIdentity });
      identity = { signing: edIdentity, dh: dhIdentity };

      const existingSpk = await loadSignedPrekey(uid);
      const spkStillValid =
        !!existingSpk &&
        verifyEd25519(existingSpk.signature, existingSpk.keyPair.publicKey, identity.signing.publicKey);
      if (!spkStillValid) {
        const spk = generateX25519KeyPair();
        const spkSignature = signEd25519(spk.publicKey, identity.signing.privateKey);
        await saveSignedPrekey(uid, 1, spk, spkSignature);
      }
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
    const sid = (sessionToken && String(sessionToken).trim()) || getSessionId() || '';
    if (!sid) {
      if (typeof window !== 'undefined' && window.velumDebug) {
        window.velumDebug.e2eePublishStatus = 'no_session';
      }
      throw new Error('[StatelessE2EE] Prekey publication skipped: no session token');
    }
    let res: Response;
    try {
      res = await fetch('/v2/crypto/prekeys', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sid}`,
          'x-session-id': sid,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          identityKey: toHex(identity.dh.publicKey),
          signingIdentityKey: toHex(identity.signing.publicKey),
          signedPrekey: toHex(signedPrekey.keyPair.publicKey),
          signedPrekeyId: signedPrekey.keyId,
          signedPrekeySignature: toHex(signedPrekey.signature),
          oneTimePrekeys: []
        })
      });
    } catch (err) {
      if (typeof window !== 'undefined' && window.velumDebug) {
        window.velumDebug.e2eePublishStatus = 'network_error';
      }
      throw new Error(
        `[StatelessE2EE] Prekey publication network error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    if (!res.ok) {
      if (typeof window !== 'undefined' && window.velumDebug) {
        window.velumDebug.e2eePublishStatus = `http_${res.status}`;
      }
      throw new Error(`[StatelessE2EE] Prekey publication failed (${res.status})`);
    }
    if (typeof window !== 'undefined' && window.velumDebug) {
      window.velumDebug.e2eePublishStatus = 'ok';
    }
  }

  /**
   * Fetches peer's public DH identity key.
   * Verifies SPK when present; allows legacy identity-only bundles for ECDH.
   */
  public async fetchPeerPublicKey(peerUserId: number): Promise<string> {
    const cached = this.peerKeyCache.get(peerUserId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      if (!acceptPeerBundleForEcdh(cached)) {
        this.peerKeyCache.delete(peerUserId);
        throw new Error(`[StatelessE2EE] Cached signed prekey verification failed for peer ${peerUserId}`);
      }
      return cached.identityKeyHex;
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
    const raw = data.bundle || data;
    const identityKeyHex = raw.identityKey || raw.identityKeyHex || raw.dhIdentityKeyHex;
    const signingIdentityKeyHex =
      raw.signingIdentityKey || raw.signingIdentityKeyHex || raw.ed25519IdentityKeyHex;
    const signedPrekeyHex =
      typeof raw.signedPrekey === 'object' && raw.signedPrekey !== null
        ? raw.signedPrekey.publicKey
        : raw.signedPrekey || raw.signedPrekeyHex;
    const signedPrekeySignatureHex =
      typeof raw.signedPrekey === 'object' && raw.signedPrekey !== null
        ? raw.signedPrekey.signature
        : raw.signedPrekeySignature || raw.signedPrekeySignatureHex;

    if (!identityKeyHex) {
      throw new Error(`[StatelessE2EE] No public DH identity key found for peer ${peerUserId}`);
    }

    const bundle: PeerPrekeyBundle = {
      identityKeyHex: String(identityKeyHex),
      signingIdentityKeyHex: String(signingIdentityKeyHex || ''),
      signedPrekeyHex: String(signedPrekeyHex || ''),
      signedPrekeySignatureHex: String(signedPrekeySignatureHex || '')
    };

    if (!acceptPeerBundleForEcdh(bundle)) {
      throw new Error(`[StatelessE2EE] Invalid or tampered signed prekey for peer ${peerUserId}`);
    }

    this.peerKeyCache.set(peerUserId, { ...bundle, timestamp: Date.now() });
    return bundle.identityKeyHex;
  }

  /**
   * Warm peer DH keys in the background (friends list). Skips Velum system (999).
   * Bounded concurrency so list load does not stampede `/v2/crypto/prekeys`.
   */
  public async prefetchPeerPublicKeys(peerUserIds: number[], concurrency = 4): Promise<void> {
    const unique = [...new Set(peerUserIds.filter((id) => Number.isFinite(id) && id > 0 && id !== 999))];
    if (unique.length === 0) return;

    let idx = 0;
    const workers = Array.from({ length: Math.min(concurrency, unique.length) }, async () => {
      while (idx < unique.length) {
        const peerId = unique[idx++];
        try {
          await this.fetchPeerPublicKey(peerId);
        } catch {
          // Best-effort warm; open-chat path will retry.
        }
      }
    });
    await Promise.all(workers);
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
    let localKeys = isResolvedUserId(uid) ? await loadLocalIdentityKeys(uid) : null;
    
    if (!localKeys || !localKeys.dh) {
      throw new Error('[StatelessE2EE] Local identity key unavailable');
    }

    let peerPubKeyBytes: Uint8Array;
    if (isResolvedUserId(uid) && peerUserId === uid) {
      peerPubKeyBytes = localKeys.dh.publicKey;
    } else {
      const peerPubKeyHex = await this.fetchPeerPublicKey(peerUserId);
      peerPubKeyBytes = fromHex(peerPubKeyHex);
    }

    // 1. Calculate pairwise shared secret between sender and peer
    const sharedSecret = calculateX25519SharedSecret(localKeys.dh.privateKey, peerPubKeyBytes);

    // 2. Derive deterministic conversation key
    const convKey = deriveConversationKey(sharedSecret);

    // 3. Encrypt plaintext with fresh 12-byte IV via AES-256-GCM + AAD(senderId, recipientId)
    const senderId = isResolvedUserId(uid) ? uid : 0;
    const ivPayload = getRandomBytes(12);
    const plaintextBytes = utf8ToBytes(plaintext);
    const aad = buildV3Aad(senderId, peerUserId);
    const { ciphertext: payloadCipher, tag: payloadTag } = await encryptAesGcm(
      convKey,
      plaintextBytes,
      ivPayload,
      aad
    );

    return `e2ee:v3:${senderId}:${toHex(ivPayload)}:${toHex(payloadTag)}:${toHex(payloadCipher)}`;
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
    if (!isResolvedUserId(uid)) {
      throw new Error('[StatelessE2EE] Local user ID not initialized');
    }

    let localKeys = await loadLocalIdentityKeys(uid);
    
    if (!localKeys || !localKeys.dh) {
      // Check if local cache has already stored this envelope plaintext
      const fallback = await getPlaintextByCiphertext(envelope, uid);
      if (fallback) return fallback;
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
      const targetPeerId = resolveV3TargetPeerId(senderId, uid, contextPeerUserId);

      if (targetPeerId === undefined) {
        const fallback = await getPlaintextByCiphertext(envelope, uid);
        if (fallback) return fallback;
        throw new Error('[StatelessE2EE] Missing peer user ID for conversation key derivation');
      }

      try {
        let peerPubKeyBytes: Uint8Array;
        if (targetPeerId === uid) {
          peerPubKeyBytes = localKeys.dh.publicKey;
        } else {
          const peerPubKeyHex = await this.fetchPeerPublicKey(targetPeerId);
          peerPubKeyBytes = fromHex(peerPubKeyHex);
        }

        const sharedSecret = calculateX25519SharedSecret(localKeys.dh.privateKey, peerPubKeyBytes);
        const convKey = deriveConversationKey(sharedSecret);

        const ciphertext = fromHex(cipherPayloadHex);
        const tag = fromHex(tagPayloadHex);
        const iv = fromHex(ivPayloadHex);

        // recipientId: local user when receiving; context peer when reading own sent history
        const recipientId = senderId === uid ? targetPeerId : uid;
        const aad = buildV3Aad(senderId, recipientId);

        try {
          const decryptedBytes = await decryptAesGcm(convKey, ciphertext, tag, iv, aad);
          return bytesToUtf8(decryptedBytes);
        } catch {
          // Option A: legacy v3 envelopes sealed without AAD
          const decryptedBytes = await decryptAesGcm(convKey, ciphertext, tag, iv);
          return bytesToUtf8(decryptedBytes);
        }
      } catch (err) {
        const fallback = await getPlaintextByCiphertext(envelope, uid);
        if (fallback) return fallback;
        throw err;
      }
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

      // If not recipient, try decrypting sender key tuple (sender viewing their own history on any device)
      if (!payloadKey && senderKeyTuple) {
        const [sIvHex, sTagHex, sCipherHex] = senderKeyTuple.split('.');
        if (sIvHex && sTagHex && sCipherHex) {
          try {
            payloadKey = await decryptAesGcm(sharedSecret, fromHex(sCipherHex), fromHex(sTagHex), fromHex(sIvHex));
          } catch {}
        }
      }

      if (!payloadKey) {
        const fallback = await getPlaintextByCiphertext(envelope, uid);
        if (fallback) {
          return fallback;
        }
        throw new Error('[StatelessE2EE] Unable to decrypt payload key with local identity');
      }

      try {
        const decryptedBytes = await decryptAesGcm(payloadKey, fromHex(cipherPayloadHex), fromHex(tagPayloadHex), fromHex(ivPayloadHex));
        return bytesToUtf8(decryptedBytes);
      } catch (err) {
        const fallback = await getPlaintextByCiphertext(envelope, uid);
        if (fallback) return fallback;
        throw err;
      }
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

      try {
        const sharedSecret = calculateX25519SharedSecret(localKeys.dh.privateKey, ephPubKeyBytes);
        const decryptedBytes = await decryptAesGcm(sharedSecret, ciphertext, tag, iv);
        return bytesToUtf8(decryptedBytes);
      } catch (err) {
        const fallback = await getPlaintextByCiphertext(envelope, uid);
        if (fallback) return fallback;
        throw err;
      }
    }

    throw new Error('[StatelessE2EE] Unrecognized envelope format');
  }
}

export const statelessE2eeService = new StatelessE2eeService();
