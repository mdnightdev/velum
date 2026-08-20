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
} from './cryptoPrimitives';
import { loadLocalIdentityKeys } from './cryptoDbStore';
import { getSessionId } from '../utils/auth';

class StatelessE2eeService {
  private localUserId: number | null = null;
  private peerKeyCache = new Map<number, { keyHex: string; timestamp: number }>();
  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  public setLocalUserId(userId: number): void {
    this.localUserId = userId;
  }

  public getLocalUserId(): number | null {
    return this.localUserId;
  }

  public clearCache(): void {
    this.peerKeyCache.clear();
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
      headers: { Authorization: `Bearer ${sid}` }
    });

    if (!res.ok) {
      throw new Error(`[StatelessE2EE] Failed to fetch key for peer ${peerUserId} (Status: ${res.status})`);
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
   * Encrypts a message directly using an ephemeral ECDH keypair and AES-GCM
   * Wire format: e2ee:v1:<ephPubKeyHex>:<ivHex>:<tagHex>:<ciphertextHex>
   */
  public async encryptMessage(peerUserId: number, plaintext: string): Promise<string> {
    const peerPubKeyHex = await this.fetchPeerPublicKey(peerUserId);
    const peerPubKeyBytes = fromHex(peerPubKeyHex);

    // 1. Generate one-time ephemeral keypair
    const ephKeyPair = generateX25519KeyPair();

    // 2. Compute shared secret
    const sharedSecret = calculateX25519SharedSecret(ephKeyPair.privateKey, peerPubKeyBytes);

    // 3. Encrypt payload with AES-GCM
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
   * Decrypts a stateless e2ee:v1 message using local static private key and incoming ephemeral public key
   */
  public async decryptMessage(envelope: string): Promise<string> {
    if (!this.localUserId) {
      throw new Error('[StatelessE2EE] localUserId not set');
    }

    const parts = envelope.split(':');
    if (parts.length !== 6 || parts[0] !== 'e2ee' || parts[1] !== 'v1') {
      throw new Error('[StatelessE2EE] Invalid envelope format');
    }

    const [, , ephPubKeyHex, ivHex, tagHex, cipherHex] = parts;

    // Load local private identity key
    const localKeys = await loadLocalIdentityKeys(this.localUserId);
    if (!localKeys || !localKeys.dh) {
      throw new Error('[StatelessE2EE] Local identity key not found in storage');
    }

    const ephPubKeyBytes = fromHex(ephPubKeyHex);
    const iv = fromHex(ivHex);
    const tag = fromHex(tagHex);
    const ciphertext = fromHex(cipherHex);

    // Compute shared secret: ECDH(localPriv, ephPub)
    const sharedSecret = calculateX25519SharedSecret(localKeys.dh.privateKey, ephPubKeyBytes);

    const decryptedBytes = await decryptAesGcm(sharedSecret, ciphertext, tag, iv);
    return bytesToUtf8(decryptedBytes);
  }
}

export const statelessE2eeService = new StatelessE2eeService();
