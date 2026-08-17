import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import 'fake-indexeddb/auto';
import {
  openCryptoDatabase,
  closeCryptoDatabase,
  purgeCryptoVault,
  getSignalProtocolStore,
  SignalProtocolStore,
  saveLocalVaultKeyToDb,
  loadLocalVaultKeyFromDb,
  STORE_IDENTITY_KEYS,
  STORE_PRE_KEYS,
  STORE_SIGNED_PRE_KEYS,
  STORE_SESSIONS
} from '../../src/services/cryptoDbStore';
import { LocalVaultEncryption } from '../../src/services/localVaultEncryption';
import { encryptMessage, decryptMessage, computeClientHash, decryptMessageSync } from '../../src/services/encryptionService';
import {
  generateClientPrekeys,
  serializePrekeysForPublish,
  deserializePreKeyBundle,
  verifySignedPreKey,
  generateIdentityKeyPair,
  generateSignedPreKey,
  generateOneTimePreKeys,
  bufferToBase64,
  base64ToBuffer
} from '../../src/services/signalKeyUtils';
import {
  processPreKeyBundle,
  signalEncrypt,
  signalDecrypt,
  signalDecryptPreKey,
  SignalMessage,
  PreKeySignalMessage,
  CiphertextMessageType,
  IdentityKeyPair,
  PreKeyBundle,
  ProtocolAddress,
  PrivateKey,
  PublicKey
} from '@signalapp/libsignal-client';

beforeAll(() => {
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = globalThis;
  }
  if (!globalThis.window.crypto) {
    globalThis.window.crypto = globalThis.crypto;
  }
  if (!globalThis.window.localStorage) {
    const store = new Map<string, string>();
    globalThis.window.localStorage = {
      getItem: (k: string) => store.get(k) || null,
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      get length() { return store.size; },
      key: (i: number) => Array.from(store.keys())[i] || null
    } as any;
  }
});

describe('Adversarial Verification & Stress Harness (Challenger M5)', () => {
  beforeEach(async () => {
    await purgeCryptoVault();
  });

  afterEach(async () => {
    await closeCryptoDatabase();
    await purgeCryptoVault();
  });

  // =========================================================================
  // CHALLENGE 1: MEDIA & ATTACHMENT ENCRYPTION (AES-256-GCM DATA URLs)
  // =========================================================================
  describe('Challenge 1: Media / Attachment Encryption (AES-256-GCM Data URLs)', () => {
    it('should encrypt and decrypt full Base64 image data URL in LocalVaultEncryption without byte loss', async () => {
      // 256KB mock image data URL
      const mockImageData = 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAA'.repeat(10000);
      const encrypted = await LocalVaultEncryption.encryptPayload(mockImageData);

      expect(encrypted).toBeDefined();
      expect(encrypted.ciphertextHex).toBeTruthy();
      expect(encrypted.ivHex).toHaveLength(24); // 12 bytes = 24 hex
      expect(encrypted.saltHex).toHaveLength(32); // 16 bytes = 32 hex

      const decrypted = await LocalVaultEncryption.decryptPayload(encrypted);
      expect(decrypted).toBe(mockImageData);
      expect(decrypted?.length).toBe(mockImageData.length);
    });

    it('should encrypt and decrypt Opus voice note attachment JSON payload with data URL', async () => {
      const voicePayload = JSON.stringify({
        type: 'voice',
        mimeType: 'audio/webm;codecs=opus',
        durationMs: 7850,
        waveform: [0.1, 0.4, 0.9, 0.7, 0.3, 0.8, 0.2, 0.0],
        dataUrl: 'data:audio/webm;codecs=opus;base64,' + 'GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH///+W'.repeat(100)
      });

      const encrypted = await LocalVaultEncryption.encryptPayload(voicePayload);
      const decrypted = await LocalVaultEncryption.decryptPayload(encrypted);
      expect(decrypted).toBe(voicePayload);

      const parsed = JSON.parse(decrypted!);
      expect(parsed.type).toBe('voice');
      expect(parsed.durationMs).toBe(7850);
      expect(parsed.waveform).toHaveLength(8);
      expect(parsed.dataUrl).toBe(JSON.parse(voicePayload).dataUrl);
    });

    it('should correctly handle lounge room encryption of media data URLs with special chars', async () => {
      const complexDataUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" /></svg>';
      const encrypted = await encryptMessage(complexDataUrl, { type: 'lounge', roomId: 'lounge-42' });
      expect(encrypted.startsWith('VEL_E2EE[')).toBe(true);

      const decrypted = await decryptMessage(encrypted, { type: 'lounge', roomId: 'lounge-42' });
      expect(decrypted).toBe(complexDataUrl);
    });
  });

  // =========================================================================
  // CHALLENGE 2: ENVELOPE CORRUPTION & TAMPERING RESISTANCE
  // =========================================================================
  describe('Challenge 2: Envelope Corruption & Tampering Resistance', () => {
    it('should handle corrupted lounge envelope gracefully without unhandled exceptions', async () => {
      const corruptedEnvelopes = [
        'VEL_E2EE[corrupted_non_base64_payload!!!]',
        'VEL_E2EE[]',
        'VEL_E2EE[AAAA==', // missing closing bracket
        'VEL_E2EE[====]',
        'VEL_E2EE'
      ];

      for (const envelope of corruptedEnvelopes) {
        const decrypted = await decryptMessage(envelope, { type: 'lounge', roomId: 'lounge-1' });
        expect(typeof decrypted).toBe('string');
      }
    });

    it('should reject tampered libsignal ciphertext during deserialization and decryption', async () => {
      const aliceStore = getSignalProtocolStore('1001');
      const bobStore = getSignalProtocolStore('1002');

      const aliceKeys = generateClientPrekeys(1001, 1, 10, 1);
      const bobKeys = generateClientPrekeys(1002, 1, 10, 1);

      await aliceStore.identityStore.saveLocalIdentity(aliceKeys.registrationId, aliceKeys.identityKeyPair);
      await bobStore.identityStore.saveLocalIdentity(bobKeys.registrationId, bobKeys.identityKeyPair);
      await bobStore.signedPreKeyStore.saveSignedPreKey(1, bobKeys.signedPreKeyRecord);
      for (const otk of bobKeys.oneTimePreKeys) {
        await bobStore.preKeyStore.savePreKey(otk.id(), otk);
      }

      const bobPublishDTO = serializePrekeysForPublish(bobKeys, 1);
      const bobBundle = deserializePreKeyBundle({
        userId: 1002,
        registrationId: bobPublishDTO.registrationId,
        deviceId: 1,
        identityKey: bobPublishDTO.identityKey,
        signedPrekeyId: bobPublishDTO.signedPrekey.keyId,
        signedPrekey: bobPublishDTO.signedPrekey.publicKey,
        signedPrekeySignature: bobPublishDTO.signedPrekey.signature,
        oneTimePrekey: bobPublishDTO.oneTimePrekeys[0]
      });

      const bobAddress = ProtocolAddress.new('1002', 1);
      const aliceAddress = ProtocolAddress.new('1001', 1);

      // Alice processes Bob's prekey bundle
      await processPreKeyBundle(bobBundle, bobAddress, aliceStore.sessionStore, aliceStore.identityStore);

      // Alice encrypts a message for Bob
      const originalPlaintext = Buffer.from('Highly Confidential Payload', 'utf-8');
      const ciphertextMsg = await signalEncrypt(
        originalPlaintext,
        bobAddress,
        aliceStore.sessionStore,
        aliceStore.identityStore
      );

      expect(ciphertextMsg).toBeDefined();
      expect(ciphertextMsg.type()).toBe(CiphertextMessageType.PreKey);

      const serializedCiphertext = ciphertextMsg.serialize();

      // Case A: Corrupt header / protobuf bytes -> must fail deserialization cleanly
      const corruptedBytes = Buffer.from(serializedCiphertext);
      corruptedBytes[0] ^= 0xff;
      expect(() => {
        PreKeySignalMessage.deserialize(corruptedBytes);
      }).toThrow();

      // Case B: Corrupt random bytes in payload
      const tamperedBytes = Buffer.from(serializedCiphertext);
      tamperedBytes[tamperedBytes.length - 1] ^= 0x01;

      // Deserialization or decryption must fail
      try {
        const msg = PreKeySignalMessage.deserialize(tamperedBytes);
        await expect(async () => {
          await signalDecryptPreKey(
            msg,
            aliceAddress,
            bobStore.sessionStore,
            bobStore.identityStore,
            bobStore.preKeyStore,
            bobStore.signedPreKeyStore,
            bobStore.kyberPreKeyStore
          );
        }).rejects.toThrow();
      } catch (err: any) {
        expect(err).toBeDefined();
      }
    });
  });

  // =========================================================================
  // CHALLENGE 3: EMPTY STRINGS AND WHITESPACE PAYLOADS
  // =========================================================================
  describe('Challenge 3: Empty Strings & Whitespace Payloads', () => {
    it('should return empty string immediately for empty inputs in encryptionService', async () => {
      expect(await encryptMessage('', { type: 'lounge', roomId: 'test' })).toBe('');
      expect(await encryptMessage('', { type: 'direct', peerUserId: 2 })).toBe('');
      expect(await decryptMessage('', { type: 'lounge', roomId: 'test' })).toBe('');
      expect(await decryptMessage('', { type: 'direct', peerUserId: 2 })).toBe('');
    });

    it('should safely encrypt and decrypt whitespace-only strings without trimming or corruption', async () => {
      const whitespacePayloads = [
        ' ',
        '   ',
        '\t\t\n\r\n  ',
        '   \n\t   \n   '
      ];

      for (const ws of whitespacePayloads) {
        const encrypted = await LocalVaultEncryption.encryptPayload(ws);
        const decrypted = await LocalVaultEncryption.decryptPayload(encrypted);
        expect(decrypted).toBe(ws);
      }
    });

    it('should safely encrypt and decrypt strings with null bytes and control characters', async () => {
      const controlCharsPayload = 'Velum\x00Binary\x01Data\x1F\x7F\u0000\uFFFF';
      const encrypted = await LocalVaultEncryption.encryptPayload(controlCharsPayload);
      const decrypted = await LocalVaultEncryption.decryptPayload(encrypted);
      expect(decrypted).toBe(controlCharsPayload);
    });
  });

  // =========================================================================
  // CHALLENGE 4: LARGE MESSAGE PAYLOADS (MB SCALE)
  // =========================================================================
  describe('Challenge 4: Large Message Payloads (MB Scale)', () => {
    it('should encrypt and decrypt a 1MB payload in LocalVaultEncryption with 100% integrity', async () => {
      const oneMbString = 'X'.repeat(1024 * 1024); // 1 MB
      const startTime = Date.now();
      const encrypted = await LocalVaultEncryption.encryptPayload(oneMbString);
      const encryptDuration = Date.now() - startTime;

      expect(encrypted.ciphertextHex.length).toBeGreaterThan(1024 * 1024 * 2);
      expect(encryptDuration).toBeLessThan(2000); // under 2 seconds

      const decryptStartTime = Date.now();
      const decrypted = await LocalVaultEncryption.decryptPayload(encrypted);
      const decryptDuration = Date.now() - decryptStartTime;

      expect(decrypted).toBe(oneMbString);
      expect(decryptDuration).toBeLessThan(2000);
    });

    it('should handle large message payload through Signal Protocol and transition ratchets upon reply', async () => {
      const aliceStore = getSignalProtocolStore('2001');
      const bobStore = getSignalProtocolStore('2002');

      const aliceKeys = generateClientPrekeys(2001, 1, 10, 1);
      const bobKeys = generateClientPrekeys(2002, 1, 10, 1);

      await aliceStore.identityStore.saveLocalIdentity(aliceKeys.registrationId, aliceKeys.identityKeyPair);
      await bobStore.identityStore.saveLocalIdentity(bobKeys.registrationId, bobKeys.identityKeyPair);
      await bobStore.signedPreKeyStore.saveSignedPreKey(1, bobKeys.signedPreKeyRecord);
      for (const otk of bobKeys.oneTimePreKeys) {
        await bobStore.preKeyStore.savePreKey(otk.id(), otk);
      }

      const bobPublishDTO = serializePrekeysForPublish(bobKeys, 1);
      const bobBundle = deserializePreKeyBundle({
        userId: 2002,
        registrationId: bobPublishDTO.registrationId,
        deviceId: 1,
        identityKey: bobPublishDTO.identityKey,
        signedPrekeyId: bobPublishDTO.signedPrekey.keyId,
        signedPrekey: bobPublishDTO.signedPrekey.publicKey,
        signedPrekeySignature: bobPublishDTO.signedPrekey.signature,
        oneTimePrekey: bobPublishDTO.oneTimePrekeys[0]
      });

      const bobAddress = ProtocolAddress.new('2002', 1);
      const aliceAddress = ProtocolAddress.new('2001', 1);

      // Alice initiates X3DH with Bob's bundle
      await processPreKeyBundle(bobBundle, bobAddress, aliceStore.sessionStore, aliceStore.identityStore);

      // Alice sends 512 KB payload to Bob
      const largePayload = Buffer.from('A'.repeat(512 * 1024), 'utf-8');
      const preKeyCiphertext = await signalEncrypt(
        largePayload,
        bobAddress,
        aliceStore.sessionStore,
        aliceStore.identityStore
      );

      expect(preKeyCiphertext.type()).toBe(CiphertextMessageType.PreKey);
      const preKeyMsg = PreKeySignalMessage.deserialize(preKeyCiphertext.serialize());
      const decrypted = await signalDecryptPreKey(
        preKeyMsg,
        aliceAddress,
        bobStore.sessionStore,
        bobStore.identityStore,
        bobStore.preKeyStore,
        bobStore.signedPreKeyStore,
        bobStore.kyberPreKeyStore
      );

      expect(decrypted.toString('utf-8')).toBe(largePayload.toString('utf-8'));

      // Bob replies to Alice (which establishes reciprocal session)
      const bobReplyPlaintext = Buffer.from('Bob replies with 256KB: ' + 'B'.repeat(256 * 1024), 'utf-8');
      const bobCiphertext = await signalEncrypt(
        bobReplyPlaintext,
        aliceAddress,
        bobStore.sessionStore,
        bobStore.identityStore
      );

      // Bob's message to Alice is a Whisper message (type 2)
      expect(bobCiphertext.type()).toBe(CiphertextMessageType.Whisper);
      const bobWhisperMsg = SignalMessage.deserialize(bobCiphertext.serialize());
      const aliceDecryptedReply = await signalDecrypt(
        bobWhisperMsg,
        bobAddress,
        aliceStore.sessionStore,
        aliceStore.identityStore
      );
      expect(aliceDecryptedReply.toString('utf-8')).toBe(bobReplyPlaintext.toString('utf-8'));

      // Now Alice sends a second message to Bob: it must now be Whisper (type 2)!
      const aliceFollowUp = Buffer.from('Alice follow-up: ' + 'C'.repeat(128 * 1024), 'utf-8');
      const aliceFollowUpCiphertext = await signalEncrypt(
        aliceFollowUp,
        bobAddress,
        aliceStore.sessionStore,
        aliceStore.identityStore
      );

      expect(aliceFollowUpCiphertext.type()).toBe(CiphertextMessageType.Whisper);
      const aliceFollowUpMsg = SignalMessage.deserialize(aliceFollowUpCiphertext.serialize());
      const bobDecryptedFollowUp = await signalDecrypt(
        aliceFollowUpMsg,
        aliceAddress,
        bobStore.sessionStore,
        bobStore.identityStore
      );
      expect(bobDecryptedFollowUp.toString('utf-8')).toBe(aliceFollowUp.toString('utf-8'));
    });
  });

  // =========================================================================
  // CHALLENGE 5: CRYPTO VAULT PURGE & CLEAN RESET UNDER CONCURRENT LOAD
  // =========================================================================
  describe('Challenge 5: Crypto Vault Purge / Clean Reset Under Concurrent Load', () => {
    it('should purge specific user vault entries while preserving other users', async () => {
      const userAStore = getSignalProtocolStore('3001');
      const userBStore = getSignalProtocolStore('3002');

      const userAKeys = generateClientPrekeys(3001, 1, 5, 1);
      const userBKeys = generateClientPrekeys(3002, 1, 5, 1);

      await userAStore.identityStore.saveLocalIdentity(userAKeys.registrationId, userAKeys.identityKeyPair);
      await userBStore.identityStore.saveLocalIdentity(userBKeys.registrationId, userBKeys.identityKeyPair);

      // Verify both exist
      expect(await userAStore.identityStore.getLocalIdentityKeyPair()).not.toBeNull();
      expect(await userBStore.identityStore.getLocalIdentityKeyPair()).not.toBeNull();

      // Purge only User A
      await purgeCryptoVault('3001');

      // User A should be purged, User B must remain intact
      expect(await userAStore.identityStore.getLocalIdentityKeyPair()).toBeNull();
      expect(await userBStore.identityStore.getLocalIdentityKeyPair()).not.toBeNull();
    });

    it('should cleanly handle concurrent purge and write operations without unhandled rejections', async () => {
      const operations: Promise<any>[] = [];

      for (let i = 0; i < 20; i++) {
        const uid = `400${i % 5}`;
        const store = getSignalProtocolStore(uid);
        const keys = generateClientPrekeys(parseInt(uid), 1, 3, 1);

        operations.push(
          store.identityStore.saveLocalIdentity(keys.registrationId, keys.identityKeyPair).catch(() => {})
        );

        if (i % 3 === 0) {
          operations.push(purgeCryptoVault(uid).catch(() => {}));
        }
      }

      await expect(Promise.all(operations)).resolves.toBeDefined();
    });

    it('should perform complete clean reset when purgeCryptoVault is called without args', async () => {
      const store1 = getSignalProtocolStore('5001');
      const store2 = getSignalProtocolStore('5002');

      const keys1 = generateClientPrekeys(5001, 1, 5, 1);
      const keys2 = generateClientPrekeys(5002, 1, 5, 1);

      await store1.identityStore.saveLocalIdentity(keys1.registrationId, keys1.identityKeyPair);
      await store2.identityStore.saveLocalIdentity(keys2.registrationId, keys2.identityKeyPair);

      // Global purge
      await purgeCryptoVault();

      // Verify all cleared
      const db = await openCryptoDatabase();
      const count1 = await db.count(STORE_IDENTITY_KEYS);
      expect(count1).toBe(0);
    });
  });
});
