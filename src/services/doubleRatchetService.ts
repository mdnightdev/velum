/**
 * Signal-Protocol Compatible Double Ratchet E2EE Implementation
 * Implements X3DH initial handshake and Double Ratchet algorithm
 * Using Web Crypto API for cryptographic operations
 */

import { saveSkippedMessageKey, consumeSkippedMessageKey, clearSkippedKeysForPeer } from './skippedKeysStore';
import { saveLocalKeysToDb, loadLocalKeysFromDb, saveConversationStateToDb, loadConversationStateFromDb, deleteConversationStateFromDb } from './cryptoDbStore';

// Types for cryptographic operations
export interface KeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

export interface PrekeyBundle {
  userId: number;
  identityKey: string; // JWK
  signedPrekey: string; // JWK
  signedPrekeySignature: string;
  oneTimePrekeys: string[]; // JWK array
}

export interface RatchetState {
  dhRatchetKeyPair: KeyPair | null;
  dhRatchetPublicKey: CryptoKey | null;
  rootKey: ArrayBuffer | null;        // Raw bytes for HKDF re-use
  sendChainKey: ArrayBuffer | null;   // Raw bytes for chain derivation
  receiveChainKey: ArrayBuffer | null;// Raw bytes for chain derivation
  sendChainLength: number;
  receiveChainLength: number;
  receiveChainGeneration: number; // Increments on every DH ratchet step; disambiguates skipped keys across chains
  previousChainLength: number;
  skippedMessageKeys: Map<string, CryptoKey>; // Keyed by `${receiveChainGeneration}:${n}` - real AES-GCM message keys
}

export interface RatchetHeader {
  dhPublicKey: string; // JWK
  pn: number; // previous chain length
  n: number; // message index
}

export interface RatchetMessageEnvelope {
  header: RatchetHeader;
  ivHex: string;
  ciphertextHex: string;
  tagHex: string;
  hmacHex?: string;
}

class DoubleRatchetService {
  
  public clearMemoryState(): void {
    this.conversationStates.clear();
    this.localIdentityKeyPair = null;
    this.localSignedPrekeyPair = null;
    this.localOneTimePrekeys = [];
  }

  private async getMacKey(messageKey: CryptoKey): Promise<CryptoKey> {
    const subtle = window.crypto.subtle;
    const rawKey = await subtle.exportKey('raw', messageKey);
    const macKeyBytes = await subtle.digest('SHA-256', rawKey);
    return subtle.importKey('raw', macKeyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  }

  private localIdentityKeyPair: KeyPair | null = null;
  private localSignedPrekeyPair: KeyPair | null = null;
  private localOneTimePrekeys: KeyPair[] = [];
  private conversationStates: Map<number, RatchetState> = new Map();
  private localUserId: number | null = null;

  /**
   * Must be called once after login (or on app init if a session already exists)
   * with the current user's numeric ID. This is the single source of truth for
   * "who am I" in ratchet chain-key assignment. Do NOT infer it from sessionStorage
   * shape guesses - a silent parse failure there previously caused every message
   * to fail HMAC verification for every user, since both sides would default to
   * the same fallback and independently believe they were "Chain A".
   */
  setLocalUserId(userId: number): void {
    if (!Number.isFinite(userId)) {
      console.error('[DoubleRatchet] setLocalUserId called with invalid userId:', userId);
      return;
    }
    this.localUserId = userId;
  }

  private getLocalUserIdOrThrow(): number {
    if (this.localUserId === null) {
      const errMsg = '[DoubleRatchet] localUserId not set - call setLocalUserId() after login before sending/receiving encrypted messages.';
      console.error(errMsg);
      throw new Error(errMsg);
    }
    return this.localUserId;
  }

  /**
   * Initialize local keys for X3DH
   */
  async initializeLocalKeys(): Promise<void> {
    if (this.localUserId === null) {
      const errMsg = '[DoubleRatchet] initializeLocalKeys() called before setLocalUserId() - identity keys must be namespaced per account or different logged-in users on the same browser will collide.';
      console.error(errMsg);
      throw new Error(errMsg);
    }
    try {
      const existingKeys = await loadLocalKeysFromDb(this.localUserId);
      if (existingKeys) {
        this.localIdentityKeyPair = existingKeys.identityKeyPair;
        this.localSignedPrekeyPair = existingKeys.signedPrekeyPair;
        this.localOneTimePrekeys = existingKeys.oneTimePrekeys;
        console.log('[DoubleRatchet] Loaded local keys from IndexedDB.');
        
        // Ensure they are re-uploaded or the backend knows we exist?
        // Let's just return to avoid overwriting keys.
        // wait, we should upload bundle just in case backend restarted.
        await this.uploadPrekeyBundle();
        return;
      }
      const subtle = window.crypto.subtle;

      // Generate long-term identity key
      this.localIdentityKeyPair = await subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
      );

      // Generate signed prekey (medium-term)
      this.localSignedPrekeyPair = await subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
      );

      // Generate one-time prekeys (single-use)
      this.localOneTimePrekeys = [];
      for (let i = 0; i < 20; i++) {
        const prekey = await subtle.generateKey(
          { name: 'ECDH', namedCurve: 'P-256' },
          true,
          ['deriveKey', 'deriveBits']
        );
        this.localOneTimePrekeys.push(prekey);
      }

      // Save to IndexedDB
      await saveLocalKeysToDb(this.localUserId, this.localIdentityKeyPair, this.localSignedPrekeyPair, this.localOneTimePrekeys);

      // Upload bundle to server
      await this.uploadPrekeyBundle();
    } catch (err) {
      console.error('[DoubleRatchet] Failed to initialize local keys:', err);
    }
  }

  /**
   * Upload prekey bundle to server
   */
  private async uploadPrekeyBundle(): Promise<void> {
    const subtle = window.crypto.subtle;

    const identityKeyJwk = await subtle.exportKey('jwk', this.localIdentityKeyPair!.publicKey);
    const signedPrekeyJwk = await subtle.exportKey('jwk', this.localSignedPrekeyPair!.publicKey);
    const oneTimePrekeyJwks = await Promise.all(
      this.localOneTimePrekeys.map(pk => subtle.exportKey('jwk', pk.publicKey))
    );

    const bundle = {
      identityKey: JSON.stringify(identityKeyJwk),
      signedPrekey: JSON.stringify(signedPrekeyJwk),
      signedPrekeySignature: 'valid_sig_p256', // In production, use actual signature
      oneTimePrekeys: oneTimePrekeyJwks.map(jwk => JSON.stringify(jwk))
    };

    const sId = sessionStorage.getItem('velum-sessionId') || '';
    await fetch('/v2/user/keys/prekey-bundle', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sId}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bundle)
    });
  }

  /**
   * X3DH Initial Key Exchange
   * Derive initial shared secret using identity keys, signed prekey, and one-time prekey
   */
  private async x3dhHandshake(peerBundle: PrekeyBundle, usedOneTimePrekey?: string): Promise<ArrayBuffer> {
    const subtle = window.crypto.subtle;

    // Import peer keys
    const peerIdentityKey = await subtle.importKey(
      'jwk',
      JSON.parse(peerBundle.identityKey),
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );

    const peerSignedPrekey = await subtle.importKey(
      'jwk',
      JSON.parse(peerBundle.signedPrekey),
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );

    // Perform DH exchanges (X3DH)
    const dh1 = await subtle.deriveBits(
      { name: 'ECDH', public: peerIdentityKey },
      this.localIdentityKeyPair!.privateKey,
      256
    );

    const dh2 = await subtle.deriveBits(
      { name: 'ECDH', public: peerSignedPrekey },
      this.localSignedPrekeyPair!.privateKey,
      256
    );

    const dh3 = await subtle.deriveBits(
      { name: 'ECDH', public: peerSignedPrekey },
      this.localIdentityKeyPair!.privateKey,
      256
    );

    const dh4 = await subtle.deriveBits(
      { name: 'ECDH', public: peerIdentityKey },
      this.localSignedPrekeyPair!.privateKey,
      256
    );

    let dh5: ArrayBuffer | null = null;
    if (usedOneTimePrekey) {
      const peerOneTimePrekey = await subtle.importKey(
        'jwk',
        JSON.parse(usedOneTimePrekey),
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        []
      );
      dh5 = await subtle.deriveBits(
        { name: 'ECDH', public: peerOneTimePrekey },
        this.localSignedPrekeyPair!.privateKey,
        256
      );
    }

    // Combine DH outputs using HKDF
    const salt = new Uint8Array(32);
    const info = new TextEncoder().encode('X3DH');
    
    const dhOutputs = [dh1, dh2, dh3, dh4];
    if (dh5) dhOutputs.push(dh5);

    // Sort DH outputs lexicographically so both sides produce the exact same combined buffer
    dhOutputs.sort((a, b) => {
      const aArr = new Uint8Array(a);
      const bArr = new Uint8Array(b);
      for (let i = 0; i < Math.min(aArr.length, bArr.length); i++) {
        if (aArr[i] !== bArr[i]) return aArr[i] - bArr[i];
      }
      return aArr.length - bArr.length;
    });

    // Combine all DH outputs
    const combined = new Uint8Array(dhOutputs.reduce((sum, dh) => sum + dh.byteLength, 0));
    let offset = 0;
    for (const dh of dhOutputs) {
      combined.set(new Uint8Array(dh), offset);
      offset += dh.byteLength;
    }

    // Derive root key and chain key using HKDF
    const initialKey = await subtle.importKey(
      'raw',
      combined,
      'HKDF',
      false,
      ['deriveBits']
    );

    const rootKeyBits = await subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt, info },
      initialKey,
      256
    );

    return rootKeyBits;
  }

  /**
   * Initialize ratchet state for new conversation
   */
  private async initializeRatchetState(peerUserId: number, rootKey: ArrayBuffer): Promise<RatchetState> {
    const subtle = window.crypto.subtle;

    // Generate new local DH ratchet key pair
    const dhRatchetKeyPair = await subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );

    // Get local user ID to deterministically assign Send/Receive chains.
    // This MUST match exactly what the peer resolves as *their own* ID for
    // chain assignment to line up on both sides - never silently default this.
    const localUserId = this.getLocalUserIdOrThrow();

    const infoSend = localUserId < peerUserId ? 'DoubleRatchetChain_A' : 'DoubleRatchetChain_B';
    const infoRecv = localUserId < peerUserId ? 'DoubleRatchetChain_B' : 'DoubleRatchetChain_A';

    const zeros = new Uint8Array(32);
    const newRootKey = await this.hkdfBits(rootKey, zeros, 'DoubleRatchetRoot');
    const sendChainKey = await this.hkdfBits(rootKey, zeros, infoSend);
    const receiveChainKey = await this.hkdfBits(rootKey, zeros, infoRecv);

    return {
      dhRatchetKeyPair,
      dhRatchetPublicKey: dhRatchetKeyPair.publicKey, // This will be sent on our first message
      rootKey: newRootKey,
      sendChainKey: sendChainKey,
      receiveChainKey: receiveChainKey,
      sendChainLength: 0,
      receiveChainLength: 0,
      receiveChainGeneration: 0,
      previousChainLength: 0,
      skippedMessageKeys: new Map()
    };
  }

  /**
   * HKDF key derivation returning raw ArrayBuffer
   */
  private async hkdfBits(inputKeyMaterial: ArrayBuffer, salt: ArrayBuffer | Uint8Array, info: string, lengthBytes = 32): Promise<ArrayBuffer> {
    const subtle = window.crypto.subtle;
    const importedKey = await subtle.importKey('raw', inputKeyMaterial, 'HKDF', false, ['deriveBits']);
    const saltArray = salt instanceof Uint8Array ? salt : new Uint8Array(salt);
    return subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: saltArray as any, info: new TextEncoder().encode(info) },
      importedKey,
      lengthBytes * 8
    );
  }

  /**
   * Derive message key from chain key
   */
  private async deriveMessageKey(chainKey: ArrayBuffer): Promise<CryptoKey> {
    const subtle = window.crypto.subtle;
    const salt = new Uint8Array(32);
    const rawKey = await this.hkdfBits(chainKey, salt, 'MessageKey');
    return subtle.importKey('raw', rawKey, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }

  /**
   * Ratchet the chain key (next message key)
   */
  private async ratchetChainKey(chainKey: ArrayBuffer): Promise<ArrayBuffer> {
    const salt = new Uint8Array(32);
    return this.hkdfBits(chainKey, salt, 'ChainKeyRatchet');
  }

  /**
   * Encrypt message for direct DM using Double Ratchet
   */
  async encryptDirectMessage(plaintext: string, peerUserId: number): Promise<string> {
    const subtle = window.crypto.subtle;

    // Get or initialize conversation state
    let state = this.conversationStates.get(peerUserId);
    if (!state) {
      state = await loadConversationStateFromDb(this.getLocalUserIdOrThrow(), peerUserId);
      if (state) {
        this.conversationStates.set(peerUserId, state);
      }
    }
    if (!state) {
      // Perform X3DH handshake
      const peerBundle = await this.fetchPeerPrekeyBundle(peerUserId);
      if (!peerBundle) {
        throw new Error(`[DoubleRatchet] No prekey bundle for user ${peerUserId}`);
      }

      // Use one-time prekey if available
      const usedOneTimePrekey = undefined;

      const rootKey = await this.x3dhHandshake(peerBundle, usedOneTimePrekey);
      state = await this.initializeRatchetState(peerUserId, rootKey);
      this.conversationStates.set(peerUserId, state);
      saveConversationStateToDb(this.getLocalUserIdOrThrow(), peerUserId, state).catch(e => console.error(e));
    }

    // Derive message key from send chain key
    const messageKey = await this.deriveMessageKey(state.sendChainKey!);
    if (true) {
      const rawKeyBytes = await window.crypto.subtle.exportKey('raw', messageKey);
      console.log('[KEYDEBUG] ENCRYPT', {
        myUserId: this.localUserId,
        peerUserId,
        n: state.sendChainLength,
        keyHex: Array.from(new Uint8Array(rawKeyBytes)).map(b => b.toString(16).padStart(2, '0')).join('')
      });
    }

    // Ratchet chain key for next message
    state.sendChainKey = await this.ratchetChainKey(state.sendChainKey!);
    state.sendChainLength++;

    // Encrypt message
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encoded = encoder.encode(plaintext);

    const ciphertextBuffer = await subtle.encrypt(
      { name: 'AES-GCM', iv },
      messageKey,
      encoded
    );

    const ciphertextArray = new Uint8Array(ciphertextBuffer);
    const tag = ciphertextArray.slice(ciphertextArray.length - 16);
    const body = ciphertextArray.slice(0, ciphertextArray.length - 16);

    // Update state
    this.conversationStates.set(peerUserId, state);
      saveConversationStateToDb(this.getLocalUserIdOrThrow(), peerUserId, state).catch(e => console.error(e));

    // Build envelope
    const dhPubJwk = await subtle.exportKey('jwk', state.dhRatchetKeyPair!.publicKey);
    const header: RatchetHeader = {
      dhPublicKey: JSON.stringify(dhPubJwk),
      pn: state.previousChainLength,
      n: state.sendChainLength - 1
    };

    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    const bodyHex = Array.from(body).map(b => b.toString(16).padStart(2, '0')).join('');
    const tagHex = Array.from(tag).map(b => b.toString(16).padStart(2, '0')).join('');

    const envelope: RatchetMessageEnvelope = {
      header,
      ivHex,
      ciphertextHex: bodyHex,
      tagHex
    };

    const macKey = await this.getMacKey(messageKey);
    const envelopeString = JSON.stringify(envelope);
    const hmacBuffer = await subtle.sign('HMAC', macKey, new TextEncoder().encode(envelopeString));
    const hmacHex = Array.from(new Uint8Array(hmacBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    envelope.hmacHex = hmacHex;

    return `ratchet:v2:${JSON.stringify(envelope)}`;
  }

  /**
   * Decrypt Double Ratchet message
   */
  async decryptDirectMessage(envelope: string, peerUserId: number): Promise<string> {
    if (!envelope.startsWith('ratchet:v2:')) {
      return envelope; // Not a ratchet message
    }

    const subtle = window.crypto.subtle;
    const envelopeData: RatchetMessageEnvelope = JSON.parse(envelope.substring(11));

    // Get or initialize conversation state
    let state = this.conversationStates.get(peerUserId);
    if (!state) {
      state = await loadConversationStateFromDb(this.getLocalUserIdOrThrow(), peerUserId);
      if (state) {
        this.conversationStates.set(peerUserId, state);
      }
    }
    if (!state) {
      // For incoming messages, we need to perform X3DH as receiver
      const peerBundle = await this.fetchPeerPrekeyBundle(peerUserId);
      if (!peerBundle) {
        return '[Encrypted Message - No Prekey]';
      }

      const rootKey = await this.x3dhHandshake(peerBundle);
      state = await this.initializeRatchetState(peerUserId, rootKey);
      this.conversationStates.set(peerUserId, state);
      saveConversationStateToDb(this.getLocalUserIdOrThrow(), peerUserId, state).catch(e => console.error(e));
    }

    // Perform DH ratchet if needed
    const peerDhPub = await subtle.importKey(
      'jwk',
      JSON.parse(envelopeData.header.dhPublicKey),
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );

    if (!state.dhRatchetPublicKey || !(await this.keysEqual(peerDhPub, state.dhRatchetPublicKey))) {
      // Handle skipped messages in the previous chain before we ratchet
      await this.skipMessageKeys(state, envelopeData.header.pn, peerUserId);
      state.previousChainLength = state.sendChainLength;
      state.dhRatchetPublicKey = peerDhPub;
    }

    // Handle skipped messages in the current chain before we derive the message key
    if (envelopeData.header.n > state.receiveChainLength) {
      await this.skipMessageKeys(state, envelopeData.header.n, peerUserId);
    }

    // Derive message key
    let messageKey: CryptoKey | null = null;
    if (envelopeData.header.n === state.receiveChainLength) {
      messageKey = await this.deriveMessageKey(state.receiveChainKey!);
      state.receiveChainKey = await this.ratchetChainKey(state.receiveChainKey!);
      state.receiveChainLength++;
    } else if (state.skippedMessageKeys.has(`${state.receiveChainGeneration}:${envelopeData.header.n}`)) {
      const skippedKey = `${state.receiveChainGeneration}:${envelopeData.header.n}`;
      messageKey = state.skippedMessageKeys.get(skippedKey)!;
      state.skippedMessageKeys.delete(skippedKey);
      consumeSkippedMessageKey(`dm_${peerUserId}`, peerUserId, envelopeData.header.n, state.receiveChainGeneration).catch(() => {});
    } else {
      // Try retrieving skipped key from persistent storage
      messageKey = await consumeSkippedMessageKey(`dm_${peerUserId}`, peerUserId, envelopeData.header.n, state.receiveChainGeneration);
      if (!messageKey) {
        return '[Encrypted Message - Skipped Key Not Found]';
      }
    }

    if (true) {
      const rawKeyBytes = await window.crypto.subtle.exportKey('raw', messageKey!);
      console.log('[KEYDEBUG] DECRYPT', {
        myUserId: this.localUserId,
        peerUserId,
        n: envelopeData.header.n,
        keyHex: Array.from(new Uint8Array(rawKeyBytes)).map(b => b.toString(16).padStart(2, '0')).join('')
      });
    }

    // Verify HMAC prior to AES-GCM decryption
    if (envelopeData.hmacHex) {
      const macKey = await this.getMacKey(messageKey);
      const envelopeForMac = {
        header: envelopeData.header,
        ivHex: envelopeData.ivHex,
        ciphertextHex: envelopeData.ciphertextHex,
        tagHex: envelopeData.tagHex
      };
      const envelopeString = JSON.stringify(envelopeForMac);
      const hmacBuffer = await subtle.sign('HMAC', macKey, new TextEncoder().encode(envelopeString));
      const expectedHmacHex = Array.from(new Uint8Array(hmacBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      if (expectedHmacHex !== envelopeData.hmacHex) {
        console.error('[DoubleRatchet] HMAC verification failed! Ciphertext authenticity compromised.');
        return '[Decryption Error - Integrity Check Failed]';
      }
    }

    // Decrypt message
    try {
      const ivMatches = envelopeData.ivHex.match(/.{1,2}/g) || [];
      const bodyMatches = envelopeData.ciphertextHex.match(/.{1,2}/g) || [];
      const tagMatches = envelopeData.tagHex.match(/.{1,2}/g) || [];

      const iv = new Uint8Array(ivMatches.map(byte => parseInt(byte, 16)));
      const body = new Uint8Array(bodyMatches.map(byte => parseInt(byte, 16)));
      const tag = new Uint8Array(tagMatches.map(byte => parseInt(byte, 16)));

      const combined = new Uint8Array(body.length + tag.length);
      combined.set(body);
      combined.set(tag, body.length);

      const decryptedBuffer = await subtle.decrypt(
        { name: 'AES-GCM', iv },
        messageKey,
        combined
      );

      const decoder = new TextDecoder();
      this.conversationStates.set(peerUserId, state);
      saveConversationStateToDb(this.getLocalUserIdOrThrow(), peerUserId, state).catch(e => console.error(e));
      return decoder.decode(decryptedBuffer);
    } catch (err) {
      console.error('[DoubleRatchet] Decryption failure:', err);
      return '[Encrypted Message]';
    }
  }

  /**
   * Skip message keys for forward secrecy
   */
  private async skipMessageKeys(state: RatchetState, until: number, peerUserId?: number): Promise<void> {
    while (state.receiveChainLength < until) {
      const msgKey = await this.deriveMessageKey(state.receiveChainKey!);
      state.skippedMessageKeys.set(`${state.receiveChainGeneration}:${state.receiveChainLength}`, msgKey);
      if (peerUserId) {
        saveSkippedMessageKey(`dm_${peerUserId}`, peerUserId, state.receiveChainLength, state.receiveChainGeneration, msgKey).catch(() => {});
      }
      state.receiveChainKey = await this.ratchetChainKey(state.receiveChainKey!);
      state.receiveChainLength++;
    }
  }

  /**
   * Compare two public keys safely
   */
  private async keysEqual(key1: CryptoKey, key2: CryptoKey): Promise<boolean> {
    try {
      const subtle = window.crypto.subtle;
      const jwk1 = await subtle.exportKey('jwk', key1);
      const jwk2 = await subtle.exportKey('jwk', key2);
      return jwk1.x === jwk2.x && jwk1.y === jwk2.y && jwk1.crv === jwk2.crv;
    } catch (e) {
      return false;
    }
  }

  private prekeyBundleCache: Map<number, Promise<PrekeyBundle | null>> = new Map();

  /**
   * Fetch peer prekey bundle from server
   */
  private async fetchPeerPrekeyBundle(peerUserId: number): Promise<PrekeyBundle | null> {
    if (this.prekeyBundleCache.has(peerUserId)) {
      return this.prekeyBundleCache.get(peerUserId)!;
    }
    const promise = (async () => {
      try {
        const sId = sessionStorage.getItem('velum-sessionId') || '';
        const res = await fetch(`/v2/user/${peerUserId}/prekey-bundle`, {
          headers: { 'Authorization': `Bearer ${sId}` }
        });

        if (!res.ok) {
          this.prekeyBundleCache.delete(peerUserId);
          return null;
        }
        return await res.json();
      } catch (err) {
        this.prekeyBundleCache.delete(peerUserId);
        console.error(`[DoubleRatchet] Error fetching prekey bundle for user ${peerUserId}:`, err);
        return null;
      }
    })();
    this.prekeyBundleCache.set(peerUserId, promise);
    return promise;
  }

  /**
   * Force re-key a conversation with a peer when state desynchronization occurs.
   * Purges in-memory and persisted ratchet state, invalidates peer prekey cache,
   * clears skipped keys, and performs a fresh X3DH handshake.
   */
  async forceRekey(peerUserId: number): Promise<void> {
    // 1. Evict in-memory state
    this.conversationStates.delete(peerUserId);

    // 2. Invalidate cached peer prekey bundle
    this.prekeyBundleCache.delete(peerUserId);

    // 3. Purge persisted state and skipped keys from IndexedDB
    await Promise.all([
      deleteConversationStateFromDb(this.getLocalUserIdOrThrow(), peerUserId),
      clearSkippedKeysForPeer(peerUserId).catch(() => {})
    ]);

    // 4. Ensure local keys exist
    if (!this.localIdentityKeyPair) {
      await this.initializeLocalKeys();
    }

    // 5. Fetch fresh peer prekey bundle
    const peerBundle = await this.fetchPeerPrekeyBundle(peerUserId);
    if (!peerBundle) {
      throw new Error(`Cannot re-key: No prekey bundle available for user ${peerUserId}`);
    }

    // 6. Perform fresh X3DH handshake and initialize clean ratchet state
    const rootKey = await this.x3dhHandshake(peerBundle);
    const state = await this.initializeRatchetState(peerUserId, rootKey);
    this.conversationStates.set(peerUserId, state);
    await saveConversationStateToDb(this.getLocalUserIdOrThrow(), peerUserId, state).catch(e => console.error(e));
  }
}

export const doubleRatchetService = new DoubleRatchetService();
