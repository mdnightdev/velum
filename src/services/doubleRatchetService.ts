/**
 * Pure X25519 / Ed25519 Double Ratchet E2EE Service
 * Implements Signal-compatible X3DH handshake and Double Ratchet algorithm
 * with per-user namespaced IndexedDB storage and per-peer concurrency serialization.
 */
import { getSessionId } from '../utils/auth';
import {
  KeyPairBytes,
  generateX25519KeyPair,
  calculateX25519SharedSecret,
  generateEd25519KeyPair,
  signEd25519,
  verifyEd25519,
  kdfRoot,
  kdfChain,
  deriveX3DHRKey,
  encryptAesGcm,
  decryptAesGcm,
  toHex,
  fromHex,
  utf8ToBytes,
  bytesToUtf8,
  getRandomBytes
} from './cryptoPrimitives.js';

import {
  saveLocalIdentityKeys,
  loadLocalIdentityKeys,
  saveSignedPrekey,
  loadSignedPrekey,
  saveOneTimePrekeys,
  loadOneTimePrekey,
  markOneTimePrekeyUsed,
  countUnusedOneTimePrekeys,
  saveSessionState,
  loadSessionState,
  deleteSessionState,
  saveSkippedKey,
  consumeSkippedKey,
  clearSkippedKeysForPeer,
  closeCryptoDatabase
} from './cryptoDbStore.js';

export interface PrekeyBundleDTO {
  userId: number;
  identityKeyHex: string; // Ed25519 public key (32 bytes hex)
  dhIdentityKeyHex: string; // X25519 public key (32 bytes hex)
  signedPrekeyHex: string; // X25519 public key (32 bytes hex)
  signedPrekeyId: number;
  signedPrekeySignatureHex: string; // Ed25519 signature (64 bytes hex)
  oneTimePrekeyHex?: string; // X25519 public key (32 bytes hex)
  oneTimePrekeyId?: number;
}

export interface SerializedRatchetState {
  peerUserId: number;
  dhRatchetPrivateKeyHex: string | null;
  dhRatchetPublicKeyHex: string | null;
  remoteDhPublicKeyHex: string | null;
  rootKeyHex: string;
  sendChainKeyHex: string | null;
  receiveChainKeyHex: string | null;
  sendChainLength: number;
  receiveChainLength: number;
  previousChainLength: number;
  receiveChainGeneration: number;
  version: number;
  pendingX3DH?: {
    senderDhIdentityKeyHex: string;
    senderEphemeralKeyHex: string;
    recipientPrekeyId?: number;
  };
}

export interface RatchetHeader {
  dhPublicKeyHex: string;
  pn: number; // Previous chain length
  n: number;  // Message index in current chain
  // X3DH initial handshake parameters (only present on first initiation message)
  x3dh?: {
    senderDhIdentityKeyHex: string;
    senderEphemeralKeyHex: string;
    recipientPrekeyId?: number;
  };
}

export interface RatchetEnvelope {
  header: RatchetHeader;
  ivHex: string;
  ciphertextHex: string;
  tagHex: string;
}

const MAX_SKIP = 2000; // Maximum number of skipped message keys allowed per chain to prevent DoS
const BATCH_ONE_TIME_KEYS = 50;

class DoubleRatchetService {
  private localUserId: number | null = null;
  private peerLocks = new Map<number, Promise<any>>();
  private cachedSessions = new Map<number, SerializedRatchetState>();

  public setLocalUserId(userId: number): void {
    if (this.localUserId !== userId) {
      this.localUserId = userId;
      this.cachedSessions.clear();
      this.peerLocks.clear();
    }
  }

  public getLocalUserId(): number | null {
    return this.localUserId;
  }

  public clearMemoryState(): void {
    this.cachedSessions.clear();
    this.peerLocks.clear();
  }

  public async closeDatabaseConnections(): Promise<void> {
    if (this.localUserId) {
      await closeCryptoDatabase(this.localUserId);
    }
  }

  /**
   * Per-peer asynchronous FIFO mutex to guarantee sequential ratchet execution
   */
  private async withPeerLock<T>(peerUserId: number, fn: () => Promise<T>): Promise<T> {
    const currentLock = this.peerLocks.get(peerUserId) || Promise.resolve();
    let releaseLock!: () => void;
    const nextLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.peerLocks.set(peerUserId, currentLock.then(() => nextLock));

    try {
      await currentLock;
      return await fn();
    } finally {
      releaseLock();
    }
  }

  // ---------------------------------------------------------------------------
  // Key Initialization & Prekey Management
  // ---------------------------------------------------------------------------

  public async initializeLocalKeys(): Promise<void> {
    const userId = this.requireLocalUserId();
    let identity = await loadLocalIdentityKeys(userId);

    if (!identity) {
      // Generate Ed25519 signing keypair and X25519 DH identity keypair
      const edIdentity = generateEd25519KeyPair();
      const dhIdentity = generateX25519KeyPair();
      await saveLocalIdentityKeys(userId, { signing: edIdentity, dh: dhIdentity });
      identity = { signing: edIdentity, dh: dhIdentity };
    }

    let signedPrekey = await loadSignedPrekey(userId);
    if (!signedPrekey) {
      const spk = generateX25519KeyPair();
      const spkSignature = signEd25519(spk.publicKey, identity.signing.privateKey);
      await saveSignedPrekey(userId, 1, spk, spkSignature);
    }

    const unusedCount = await countUnusedOneTimePrekeys(userId);
    if (unusedCount < 10) {
      const opks: Array<{ keyId: number; keyPair: KeyPairBytes }> = [];
      for (let i = 0; i < BATCH_ONE_TIME_KEYS; i++) {
        const keyId = Math.floor(Math.random() * 10000000) + 1;
        opks.push({
          keyId,
          keyPair: generateX25519KeyPair()
        });
      }
      await saveOneTimePrekeys(userId, opks);
    }
  }

  public async getPrekeyBundleForPublishing(): Promise<{
    identityKeyHex: string;
    dhIdentityKeyHex: string;
    signedPrekeyHex: string;
    signedPrekeyId: number;
    signedPrekeySignatureHex: string;
    oneTimePrekeys: Array<{ keyId: number; publicKeyHex: string }>;
  }> {
    const userId = this.requireLocalUserId();
    const identity = await loadLocalIdentityKeys(userId);
    if (!identity) throw new Error('[DoubleRatchet] Local identity key not initialized');

    const signedPrekey = await loadSignedPrekey(userId);
    if (!signedPrekey) throw new Error('[DoubleRatchet] Signed prekey not initialized');

    // Retrieve unused one-time prekeys
    const db = await (await import('./cryptoDbStore.js')).openCryptoDatabase(userId);
    const opks = await db.getAll('one_time_prekeys');
    const availableOpks = opks
      .filter((k: any) => !k.used)
      .map((k: any) => ({
        keyId: k.keyId,
        publicKeyHex: k.publicKeyHex
      }));

    return {
      identityKeyHex: toHex(identity.signing.publicKey),
      dhIdentityKeyHex: toHex(identity.dh.publicKey),
      signedPrekeyHex: toHex(signedPrekey.keyPair.publicKey),
      signedPrekeyId: signedPrekey.keyId,
      signedPrekeySignatureHex: toHex(signedPrekey.signature),
      oneTimePrekeys: availableOpks
    };
  }

  // ---------------------------------------------------------------------------
  // Session Ratchet Operations
  // ---------------------------------------------------------------------------

  public async encryptDirectMessage(plaintext: string, peerUserId: number): Promise<string> {
    return this.withPeerLock(peerUserId, async () => {
      const userId = this.requireLocalUserId();
      let state = await this.getOrInitOutboundSession(peerUserId);

      // Check if send chain needs initiation
      if (!state.sendChainKeyHex) {
        if (!state.dhRatchetPrivateKeyHex) {
          const newDhPair = generateX25519KeyPair();
          state.dhRatchetPrivateKeyHex = toHex(newDhPair.privateKey);
          state.dhRatchetPublicKeyHex = toHex(newDhPair.publicKey);
        }

        if (state.remoteDhPublicKeyHex) {
          const dhSecret = calculateX25519SharedSecret(
            fromHex(state.dhRatchetPrivateKeyHex),
            fromHex(state.remoteDhPublicKeyHex)
          );
          const { nextRootKey, chainKey } = kdfRoot(fromHex(state.rootKeyHex), dhSecret);
          state.rootKeyHex = toHex(nextRootKey);
          state.sendChainKeyHex = toHex(chainKey);
        } else {
          throw new Error(`[DoubleRatchet] Remote DH public key missing for peer ${peerUserId}`);
        }
      }

      // Symmetric KDF chain advance
      const currentChainKey = fromHex(state.sendChainKeyHex);
      const { nextChainKey, messageKey } = kdfChain(currentChainKey);
      state.sendChainKeyHex = toHex(nextChainKey);

      const messageIndex = state.sendChainLength;
      state.sendChainLength++;

      // Authenticated AES-256-GCM encryption
      const iv = getRandomBytes(12);
      const plaintextBytes = utf8ToBytes(plaintext);
      const aad = utf8ToBytes(`velum:ratchet:${peerUserId}:${messageIndex}`);
      const { ciphertext, tag } = await encryptAesGcm(messageKey, plaintextBytes, iv, aad);

      // Build header & envelope
      const header: RatchetHeader = {
        dhPublicKeyHex: state.dhRatchetPublicKeyHex!,
        pn: state.previousChainLength,
        n: messageIndex,
        x3dh: state.pendingX3DH
      };

      const envelope: RatchetEnvelope = {
        header,
        ivHex: toHex(iv),
        ciphertextHex: toHex(ciphertext),
        tagHex: toHex(tag)
      };

      await this.saveSession(state);
      return `ratchet:v2:${JSON.stringify(envelope)}`;
    });
  }

  public async decryptDirectMessage(ciphertextEnvelope: string, peerUserId: number): Promise<string> {
    return this.withPeerLock(peerUserId, async () => {
      const userId = this.requireLocalUserId();

      if (!ciphertextEnvelope.startsWith('ratchet:v2:')) {
        throw new Error('[DoubleRatchet] Unsupported envelope version');
      }

      const rawJson = ciphertextEnvelope.substring('ratchet:v2:'.length);
      const envelope: RatchetEnvelope = JSON.parse(rawJson);
      const { header, ivHex, ciphertextHex, tagHex } = envelope;

      const iv = fromHex(ivHex);
      const ciphertext = fromHex(ciphertextHex);
      const tag = fromHex(tagHex);

      let state = await this.loadSession(peerUserId);

      // Inbound Session Initiation via X3DH if this is the first message
      if (!state && header.x3dh) {
        state = await this.initInboundSessionFromX3DH(peerUserId, header);
      }

      if (!state) {
        throw new Error(`[DoubleRatchet] No existing cryptographic session with peer ${peerUserId}`);
      }

      // 1. Check if message key was previously skipped and stored
      const skippedKey = await consumeSkippedKey(
        userId,
        peerUserId,
        state.receiveChainGeneration,
        header.n
      );

      if (skippedKey) {
        const aad = utf8ToBytes(`velum:ratchet:${userId}:${header.n}`);
        const decryptedBytes = await decryptAesGcm(skippedKey, ciphertext, tag, iv, aad);
        return bytesToUtf8(decryptedBytes);
      }

      // 2. Perform DH Ratchet Step if remote DH public key changed
      if (!state.remoteDhPublicKeyHex || state.remoteDhPublicKeyHex !== header.dhPublicKeyHex) {
        // Skip unreceived messages on current receive chain before ratcheting
        if (state.receiveChainKeyHex) {
          await this.skipMessageKeys(state, header.pn);
        }

        // Receive DH Step
        state.remoteDhPublicKeyHex = header.dhPublicKeyHex;
        if (!state.dhRatchetPrivateKeyHex) {
          const newDhPair = generateX25519KeyPair();
          state.dhRatchetPrivateKeyHex = toHex(newDhPair.privateKey);
          state.dhRatchetPublicKeyHex = toHex(newDhPair.publicKey);
        }

        const dhRecvSecret = calculateX25519SharedSecret(
          fromHex(state.dhRatchetPrivateKeyHex),
          fromHex(state.remoteDhPublicKeyHex)
        );
        const recvKdf = kdfRoot(fromHex(state.rootKeyHex), dhRecvSecret);
        state.rootKeyHex = toHex(recvKdf.nextRootKey);
        state.receiveChainKeyHex = toHex(recvKdf.chainKey);

        // Generate new DH ratchet keypair for next send chain
        const nextDhPair = generateX25519KeyPair();
        state.dhRatchetPrivateKeyHex = toHex(nextDhPair.privateKey);
        state.dhRatchetPublicKeyHex = toHex(nextDhPair.publicKey);

        const dhSendSecret = calculateX25519SharedSecret(
          nextDhPair.privateKey,
          fromHex(state.remoteDhPublicKeyHex)
        );
        const sendKdf = kdfRoot(fromHex(state.rootKeyHex), dhSendSecret);
        state.rootKeyHex = toHex(sendKdf.nextRootKey);
        state.sendChainKeyHex = toHex(sendKdf.chainKey);

        state.previousChainLength = state.sendChainLength;
        state.sendChainLength = 0;
        state.receiveChainLength = 0;
        state.receiveChainGeneration++;
      }

      // 3. Skip missing messages in current receive chain up to header.n
      await this.skipMessageKeys(state, header.n);

      // 4. Derive message key from current receive chain
      const currentChainKey = fromHex(state.receiveChainKeyHex!);
      const { nextChainKey, messageKey } = kdfChain(currentChainKey);
      state.receiveChainKeyHex = toHex(nextChainKey);
      state.receiveChainLength++;

      // 5. Decrypt payload
      const aad = utf8ToBytes(`velum:ratchet:${userId}:${header.n}`);
      const decryptedBytes = await decryptAesGcm(messageKey, ciphertext, tag, iv, aad);

      if (state.pendingX3DH) {
        delete state.pendingX3DH;
      }

      await this.saveSession(state);
      return bytesToUtf8(decryptedBytes);
    });
  }

  // ---------------------------------------------------------------------------
  // Skipped Message Keys Management
  // ---------------------------------------------------------------------------

  private async skipMessageKeys(state: SerializedRatchetState, untilIndex: number): Promise<void> {
    const userId = this.requireLocalUserId();
    if (!state.receiveChainKeyHex) return;

    if (state.receiveChainLength + MAX_SKIP < untilIndex) {
      throw new Error(`[DoubleRatchet] Exceeded maximum skipped message keys limit (${MAX_SKIP})`);
    }

    let currentChain = fromHex(state.receiveChainKeyHex);
    while (state.receiveChainLength < untilIndex) {
      const { nextChainKey, messageKey } = kdfChain(currentChain);
      currentChain = nextChainKey;

      await saveSkippedKey(
        userId,
        state.peerUserId,
        state.receiveChainGeneration,
        state.receiveChainLength,
        messageKey
      );

      state.receiveChainLength++;
    }

    state.receiveChainKeyHex = toHex(currentChain);
  }

  // ---------------------------------------------------------------------------
  // X3DH Session Initialization
  // ---------------------------------------------------------------------------

  private async getOrInitOutboundSession(peerUserId: number): Promise<SerializedRatchetState> {
    const existing = await this.loadSession(peerUserId);
    if (existing) return existing;

    const peerBundle = await this.fetchPeerPrekeyBundle(peerUserId);
    return await this.initOutboundSessionWithBundle(peerUserId, peerBundle);
  }

  public async initOutboundSessionWithBundle(
    peerUserId: number,
    bundle: PrekeyBundleDTO
  ): Promise<SerializedRatchetState> {
    const userId = this.requireLocalUserId();
    const identity = await loadLocalIdentityKeys(userId);
    if (!identity) throw new Error('[DoubleRatchet] Local identity key not initialized');

    // Verify remote signed prekey with remote identity key (Ed25519)
    const remoteIdentityKey = fromHex(bundle.identityKeyHex);
    const remoteSignedPrekey = fromHex(bundle.signedPrekeyHex);
    const remoteSignature = fromHex(bundle.signedPrekeySignatureHex);

    const isSigValid = verifyEd25519(remoteSignature, remoteSignedPrekey, remoteIdentityKey);
    if (!isSigValid) {
      throw new Error(`[DoubleRatchet] Invalid signed prekey signature from peer ${peerUserId}`);
    }

    // Ephemeral Key Pair
    const ephemeralKey = generateX25519KeyPair();

    // X3DH DH Computations
    const dh1 = calculateX25519SharedSecret(identity.dh.privateKey, remoteSignedPrekey);
    const dh2 = calculateX25519SharedSecret(ephemeralKey.privateKey, remoteSignedPrekey);
    const dhOutputs = [dh1, dh2];

    if (bundle.oneTimePrekeyHex) {
      const remoteOneTimePrekey = fromHex(bundle.oneTimePrekeyHex);
      const dh3 = calculateX25519SharedSecret(ephemeralKey.privateKey, remoteOneTimePrekey);
      dhOutputs.push(dh3);
    }

    const masterSecret = deriveX3DHRKey(dhOutputs);

    // Initial DH Ratchet Key Pair for Alice
    const dhRatchetKey = generateX25519KeyPair();
    const dhInit = calculateX25519SharedSecret(dhRatchetKey.privateKey, remoteSignedPrekey);
    const { nextRootKey, chainKey } = kdfRoot(masterSecret, dhInit);

    const newState: SerializedRatchetState = {
      peerUserId,
      dhRatchetPrivateKeyHex: toHex(dhRatchetKey.privateKey),
      dhRatchetPublicKeyHex: toHex(dhRatchetKey.publicKey),
      remoteDhPublicKeyHex: bundle.signedPrekeyHex,
      rootKeyHex: toHex(nextRootKey),
      sendChainKeyHex: toHex(chainKey),
      receiveChainKeyHex: null,
      sendChainLength: 0,
      receiveChainLength: 0,
      previousChainLength: 0,
      receiveChainGeneration: 1,
      version: 2,
      pendingX3DH: {
        senderDhIdentityKeyHex: toHex(identity.dh.publicKey),
        senderEphemeralKeyHex: toHex(ephemeralKey.publicKey),
        recipientPrekeyId: bundle.oneTimePrekeyId
      }
    };

    await this.saveSession(newState);
    return newState;
  }

  private async initInboundSessionFromX3DH(
    peerUserId: number,
    header: RatchetHeader
  ): Promise<SerializedRatchetState> {
    const userId = this.requireLocalUserId();
    const identity = await loadLocalIdentityKeys(userId);
    const signedPrekey = await loadSignedPrekey(userId);

    if (!identity || !signedPrekey) {
      throw new Error('[DoubleRatchet] Local identity/signed prekey uninitialized');
    }

    const senderEphemeralKey = fromHex(header.x3dh!.senderEphemeralKeyHex);
    const senderDhIdentity = fromHex(header.x3dh!.senderDhIdentityKeyHex);

    const dh1 = calculateX25519SharedSecret(signedPrekey.keyPair.privateKey, senderDhIdentity);
    const dh2 = calculateX25519SharedSecret(signedPrekey.keyPair.privateKey, senderEphemeralKey);
    const dhOutputs = [dh1, dh2];

    if (header.x3dh!.recipientPrekeyId) {
      const opk = await loadOneTimePrekey(userId, header.x3dh!.recipientPrekeyId);
      if (opk) {
        const dh3 = calculateX25519SharedSecret(opk.privateKey, senderEphemeralKey);
        dhOutputs.push(dh3);
        await markOneTimePrekeyUsed(userId, header.x3dh!.recipientPrekeyId);
      }
    }

    const masterSecret = deriveX3DHRKey(dhOutputs);

    const dhInit = calculateX25519SharedSecret(
      signedPrekey.keyPair.privateKey,
      fromHex(header.dhPublicKeyHex)
    );
    const { nextRootKey, chainKey } = kdfRoot(masterSecret, dhInit);

    const newState: SerializedRatchetState = {
      peerUserId,
      dhRatchetPrivateKeyHex: null,
      dhRatchetPublicKeyHex: null,
      remoteDhPublicKeyHex: header.dhPublicKeyHex,
      rootKeyHex: toHex(nextRootKey),
      sendChainKeyHex: null,
      receiveChainKeyHex: toHex(chainKey),
      sendChainLength: 0,
      receiveChainLength: 0,
      previousChainLength: 0,
      receiveChainGeneration: 1,
      version: 2
    };

    await this.saveSession(newState);
    return newState;
  }

  // ---------------------------------------------------------------------------
  // Persistence & Remote Fetching
  // ---------------------------------------------------------------------------

  private async loadSession(peerUserId: number): Promise<SerializedRatchetState | null> {
    if (this.cachedSessions.has(peerUserId)) {
      return this.cachedSessions.get(peerUserId)!;
    }
    const userId = this.requireLocalUserId();
    const state = await loadSessionState(userId, peerUserId);
    if (state) {
      this.cachedSessions.set(peerUserId, state);
    }
    return state;
  }

  private async saveSession(state: SerializedRatchetState): Promise<void> {
    const userId = this.requireLocalUserId();
    this.cachedSessions.set(state.peerUserId, state);
    await saveSessionState(userId, state.peerUserId, state);
  }

  public async deleteSession(peerUserId: number): Promise<void> {
    const userId = this.requireLocalUserId();
    this.cachedSessions.delete(peerUserId);
    await deleteSessionState(userId, peerUserId);
  }

  public async forceRekey(peerUserId: number): Promise<void> {
    await this.deleteSession(peerUserId);
    await this.getOrInitOutboundSession(peerUserId);
  }

  public async publishPrekeyBundle(): Promise<void> {
    const bundle = await this.getPrekeyBundleForPublishing();
    const sid = getSessionId() || '';
    const res = await fetch('/v2/crypto/prekeys', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sid}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        identityKey: bundle.identityKeyHex,
        signedPrekey: bundle.signedPrekeyHex,
        signedPrekeyId: bundle.signedPrekeyId,
        signedPrekeySignature: bundle.signedPrekeySignatureHex,
        oneTimePrekeys: bundle.oneTimePrekeys.map(k => ({ keyId: k.keyId, publicKey: k.publicKeyHex }))
      })
    });

    if (!res.ok) {
      console.warn('[DoubleRatchet] Failed to publish prekey bundle to server:', res.status);
    }
  }

  private async fetchPeerPrekeyBundle(peerUserId: number): Promise<PrekeyBundleDTO> {
    const sid = getSessionId() || '';
    const res = await fetch(`/v2/crypto/prekeys/${peerUserId}`, {
      headers: { 'Authorization': `Bearer ${sid}` }
    });

    if (!res.ok) {
      throw new Error(`[DoubleRatchet] Failed to fetch prekey bundle for peer ${peerUserId} (Status: ${res.status})`);
    }

    const data = await res.json();
    const b = data.bundle || data;
    return {
      userId: peerUserId,
      identityKeyHex: b.identityKey,
      dhIdentityKeyHex: b.identityKey,
      signedPrekeyHex: typeof b.signedPrekey === 'object' ? b.signedPrekey.publicKey : b.signedPrekey,
      signedPrekeyId: b.signedPrekeyId || (typeof b.signedPrekey === 'object' ? b.signedPrekey.keyId : 1),
      signedPrekeySignatureHex: b.signedPrekeySignature || (typeof b.signedPrekey === 'object' ? b.signedPrekey.signature : ''),
      oneTimePrekeyHex: b.oneTimePrekey?.publicKey,
      oneTimePrekeyId: b.oneTimePrekey?.keyId
    };
  }

  private requireLocalUserId(): number {
    if (!this.localUserId) {
      throw new Error('[DoubleRatchet] Local userId not set. Call setLocalUserId(userId) before cryptographic operations.');
    }
    return this.localUserId;
  }
}

export const doubleRatchetService = new DoubleRatchetService();
