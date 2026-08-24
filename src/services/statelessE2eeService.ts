import {
  generateX25519KeyPair,
  calculateX25519SharedSecret,
  generateEd25519KeyPair,
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
  public async initLocalIdentityKeys(userId?: number): Promise<void> {
    const uid = userId || this.getLocalUserId();
    if (!uid) return;

    this.localUserId = uid;
    let identity = await loadLocalIdentityKeys(uid);

    if (!identity) {
      const edIdentity = generateEd25519KeyPair();
      const dhIdentity = generateX25519KeyPair();
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
   * Encrypts a direct message using Ephemeral ECDH + AES-256-GCM
   * Wire format: e2ee:v1:<ephPubKeyHex>:<ivHex>:<tagHex>:<ciphertextHex>
   */
  public async encryptDirectMessage(plaintext: string, peerUserId: number): Promise<string> {
    const peerPubKeyHex = await this.fetchPeerPublicKey(peerUserId);
    const peerPubKeyBytes = fromHex(peerPubKeyHex);

    // 1. Generate fresh one-time ephemeral keypair
    const ephKeyPair = generateX25519KeyPair();

    // 2. Compute shared secret via Diffie-Hellman: S = ECDH(ephPriv, peerPub)
    const sharedSecret = calculateX25519SharedSecret(ephKeyPair.privateKey, peerPubKeyBytes);

    // 3. Encrypt payload with AES-256-GCM
    const iv = getRandomBytes(12);
    const plaintextBytes = utf8ToBytes(plaintext);
    const { ciphertext, tag } = await encryptAesGcm(sharedSecret, plaintextBytes, iv);

    const ephPubKeyHex = toHex(ephKeyPair.publicKey);
    const ivHex = toHex(iv);
    const tagHex = toHex(tag);
    const cipherHex = toHex(ciphertext);

    return `e2ee:v1:${ephPubKeyHex}:${ivHex}:${tagHex}:${cipherHex}`;
  }

  /**
   * Decrypts a stateless e2ee:v1 message using local private key and sender's ephemeral public key
   */
  public async decryptDirectMessage(envelope: string): Promise<string> {
    const uid = this.getLocalUserId();
    if (!uid) {
      throw new Error('[StatelessE2EE] Local user ID not initialized');
    }

    const parts = envelope.split(':');
    if (parts.length !== 6 || parts[0] !== 'e2ee' || parts[1] !== 'v1') {
      throw new Error('[StatelessE2EE] Invalid envelope format');
    }

    const [, , ephPubKeyHex, ivHex, tagHex, cipherHex] = parts;

    // Load local private identity key
    let localKeys = await loadLocalIdentityKeys(uid);
    if (!localKeys || !localKeys.dh) {
      await this.initLocalIdentityKeys(uid);
      localKeys = await loadLocalIdentityKeys(uid);
    }

    if (!localKeys || !localKeys.dh) {
      throw new Error('[StatelessE2EE] Local identity key not found in storage');
    }

    const ephPubKeyBytes = fromHex(ephPubKeyHex);
    const iv = fromHex(ivHex);
    const tag = fromHex(tagHex);
    const ciphertext = fromHex(cipherHex);

    // Compute shared secret: S = ECDH(localPriv, ephPub)
    const sharedSecret = calculateX25519SharedSecret(localKeys.dh.privateKey, ephPubKeyBytes);

    const decryptedBytes = await decryptAesGcm(sharedSecret, ciphertext, tag, iv);
    return bytesToUtf8(decryptedBytes);
  }
}

export const statelessE2eeService = new StatelessE2eeService();
