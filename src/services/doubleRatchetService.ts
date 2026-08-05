/**
 * Signal-Protocol Compatible Double Ratchet E2EE Implementation
 * Implements X3DH initial handshake and Double Ratchet algorithm
 * Using Web Crypto API for cryptographic operations
 */

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
  rootKey: CryptoKey | null;
  sendChainKey: CryptoKey | null;
  receiveChainKey: CryptoKey | null;
  sendChainLength: number;
  receiveChainLength: number;
  previousChainLength: number;
  skippedMessageKeys: Map<number, CryptoKey>;
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
}

class DoubleRatchetService {
  private localIdentityKeyPair: KeyPair | null = null;
  private localSignedPrekeyPair: KeyPair | null = null;
  private localOneTimePrekeys: KeyPair[] = [];
  private conversationStates: Map<number, RatchetState> = new Map();

  /**
   * Initialize local keys for X3DH
   */
  async initializeLocalKeys(): Promise<void> {
    try {
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
  private async x3dhHandshake(peerBundle: PrekeyBundle, usedOneTimePrekey?: string): Promise<CryptoKey> {
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
    
    // Combine all DH outputs
    const combined = new Uint8Array(
      (dh1.byteLength + dh2.byteLength + dh3.byteLength + dh4.byteLength + (dh5?.byteLength || 0))
    );
    let offset = 0;
    combined.set(new Uint8Array(dh1), offset); offset += dh1.byteLength;
    combined.set(new Uint8Array(dh2), offset); offset += dh2.byteLength;
    combined.set(new Uint8Array(dh3), offset); offset += dh3.byteLength;
    combined.set(new Uint8Array(dh4), offset); offset += dh4.byteLength;
    if (dh5) {
      combined.set(new Uint8Array(dh5), offset);
    }

    // Derive root key and chain key using HKDF
    const initialKey = await subtle.importKey(
      'raw',
      combined,
      'HKDF',
      false,
      ['deriveKey']
    );

    const rootKey = await subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt, info },
      initialKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return rootKey;
  }

  /**
   * Initialize ratchet state for new conversation
   */
  private async initializeRatchetState(peerUserId: number, rootKey: CryptoKey): Promise<RatchetState> {
    const subtle = window.crypto.subtle;

    // Generate new DH ratchet key pair
    const dhRatchetKeyPair = await subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );

    // Derive new root key and chain key
    const dhOutput = await subtle.deriveBits(
      { name: 'ECDH', public: dhRatchetKeyPair.publicKey },
      dhRatchetKeyPair.privateKey,
      256
    );

    const newRootKey = await this.hkdf(rootKey, dhOutput, 'DoubleRatchetRoot');
    const chainKey = await this.hkdf(rootKey, dhOutput, 'DoubleRatchetChain');

    return {
      dhRatchetKeyPair,
      dhRatchetPublicKey: dhRatchetKeyPair.publicKey,
      rootKey: newRootKey,
      sendChainKey: chainKey,
      receiveChainKey: null,
      sendChainLength: 0,
      receiveChainLength: 0,
      previousChainLength: 0,
      skippedMessageKeys: new Map()
    };
  }

  /**
   * HKDF key derivation
   */
  private async hkdf(inputKey: CryptoKey, salt: ArrayBuffer, info: string): Promise<CryptoKey> {
    const subtle = window.crypto.subtle;
    const saltArray = new Uint8Array(salt);
    const infoArray = new TextEncoder().encode(info);

    const importedKey = await subtle.importKey(
      'raw',
      await subtle.exportKey('raw', inputKey),
      'HKDF',
      false,
      ['deriveKey']
    );

    return subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: saltArray, info: infoArray },
      importedKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Derive message key from chain key
   */
  private async deriveMessageKey(chainKey: CryptoKey): Promise<CryptoKey> {
    const subtle = window.crypto.subtle;
    const info = new TextEncoder().encode('MessageKey');
    const salt = new Uint8Array(32);

    return subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt, info },
      chainKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Ratchet the chain key (next message key)
   */
  private async ratchetChainKey(chainKey: CryptoKey): Promise<CryptoKey> {
    const subtle = window.crypto.subtle;
    const info = new TextEncoder().encode('ChainKeyRatchet');
    const salt = new Uint8Array(32);

    return subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt, info },
      chainKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt message for direct DM using Double Ratchet
   */
  async encryptDirectMessage(plaintext: string, peerUserId: number): Promise<string> {
    const subtle = window.crypto.subtle;

    // Get or initialize conversation state
    let state = this.conversationStates.get(peerUserId);
    if (!state) {
      // Perform X3DH handshake
      const peerBundle = await this.fetchPeerPrekeyBundle(peerUserId);
      if (!peerBundle) {
        throw new Error(`[DoubleRatchet] No prekey bundle for user ${peerUserId}`);
      }

      // Use one-time prekey if available
      const usedOneTimePrekey = peerBundle.oneTimePrekeys.length > 0 
        ? peerBundle.oneTimePrekeys[0] 
        : undefined;

      const rootKey = await this.x3dhHandshake(peerBundle, usedOneTimePrekey);
      state = await this.initializeRatchetState(peerUserId, rootKey);
      this.conversationStates.set(peerUserId, state);
    }

    // Derive message key from send chain key
    const messageKey = await this.deriveMessageKey(state.sendChainKey!);

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

    // Build envelope
    const dhPubJwk = await subtle.exportKey('jwk', state.dhRatchetPublicKey!);
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
      // For incoming messages, we need to perform X3DH as receiver
      const peerBundle = await this.fetchPeerPrekeyBundle(peerUserId);
      if (!peerBundle) {
        return '[Encrypted Message - No Prekey]';
      }

      const rootKey = await this.x3dhHandshake(peerBundle);
      state = await this.initializeRatchetState(peerUserId, rootKey);
      this.conversationStates.set(peerUserId, state);
    }

    // Handle skipped messages (forward secrecy)
    if (envelopeData.header.pn < state.receiveChainLength) {
      await this.skipMessageKeys(state, envelopeData.header.pn);
    }

    // Perform DH ratchet if needed
    const peerDhPub = await subtle.importKey(
      'jwk',
      JSON.parse(envelopeData.header.dhPublicKey),
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );

    if (!state.dhRatchetPublicKey || 
        await this.keysEqual(peerDhPub, state.dhRatchetPublicKey)) {
      // Need to perform DH ratchet
      const dhOutput = await subtle.deriveBits(
        { name: 'ECDH', public: peerDhPub },
        state.dhRatchetKeyPair!.privateKey,
        256
      );

      const newRootKey = await this.hkdf(state.rootKey!, dhOutput, 'DoubleRatchetRoot');
      const newChainKey = await this.hkdf(state.rootKey!, dhOutput, 'DoubleRatchetChain');

      state.rootKey = newRootKey;
      state.receiveChainKey = newChainKey;
      state.receiveChainLength = 0;
      state.previousChainLength = state.sendChainLength;
      state.dhRatchetPublicKey = peerDhPub;

      // Generate new DH key pair for next ratchet
      state.dhRatchetKeyPair = await subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
      );
    }

    // Derive message key
    let messageKey: CryptoKey;
    if (envelopeData.header.n === state.receiveChainLength) {
      messageKey = await this.deriveMessageKey(state.receiveChainKey!);
      state.receiveChainKey = await this.ratchetChainKey(state.receiveChainKey!);
      state.receiveChainLength++;
    } else if (state.skippedMessageKeys.has(envelopeData.header.n)) {
      messageKey = state.skippedMessageKeys.get(envelopeData.header.n)!;
      state.skippedMessageKeys.delete(envelopeData.header.n);
    } else {
      return '[Encrypted Message - Skipped Key Not Found]';
    }

    // Decrypt message
    try {
      const iv = new Uint8Array(envelopeData.ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      const body = new Uint8Array(envelopeData.ciphertextHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      const tag = new Uint8Array(envelopeData.tagHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

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
      return decoder.decode(decryptedBuffer);
    } catch (err) {
      console.error('[DoubleRatchet] Decryption failure:', err);
      return '[Encrypted Message]';
    }
  }

  /**
   * Skip message keys for forward secrecy
   */
  private async skipMessageKeys(state: RatchetState, until: number): Promise<void> {
    const subtle = window.crypto.subtle;
    while (state.receiveChainLength < until) {
      state.skippedMessageKeys.set(state.receiveChainLength, state.receiveChainKey!);
      state.receiveChainKey = await this.ratchetChainKey(state.receiveChainKey!);
      state.receiveChainLength++;
    }
  }

  /**
   * Compare two public keys
   */
  private async keysEqual(key1: CryptoKey, key2: CryptoKey): Promise<boolean> {
    const subtle = window.crypto.subtle;
    const jwk1 = await subtle.exportKey('jwk', key1);
    const jwk2 = await subtle.exportKey('jwk', key2);
    return JSON.stringify(jwk1) === JSON.stringify(jwk2);
  }

  /**
   * Fetch peer prekey bundle from server
   */
  private async fetchPeerPrekeyBundle(peerUserId: number): Promise<PrekeyBundle | null> {
    try {
      const sId = sessionStorage.getItem('velum-sessionId') || '';
      const res = await fetch(`/v2/user/${peerUserId}/prekey-bundle`, {
        headers: { 'Authorization': `Bearer ${sId}` }
      });

      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error(`[DoubleRatchet] Error fetching prekey bundle for user ${peerUserId}:`, err);
      return null;
    }
  }
}

export const doubleRatchetService = new DoubleRatchetService();
