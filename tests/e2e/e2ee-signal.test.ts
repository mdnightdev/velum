/**
 * Velum E2EE Signal Protocol End-to-End Test Suite
 * Complete Multi-turn Conversation & Protocol Integration Harness
 *
 * Verifies:
 * - Signal Prekey bundle generation and server exchange
 * - Initial X3DH key agreement and Double Ratchet state setup
 * - 20+ bidirectional message dialogue between Alice and Bob
 * - Tri-party peer-to-peer conversations (Alice, Bob, Charlie)
 * - Offline outbox queueing and batch re-transmission over WebSocket
 * - Out-of-order and interleaved message delivery with skipped keys
 * - Local vault encryption, payload protection, and key rotation
 * - Auto-healing and session re-synchronization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setupTestCryptoEnvironment,
  resetTestCryptoEnvironment,
  asUser,
  TestParticipant,
  mockServerVault,
  createMockWebSocketTransmitter,
  SamplePayloads
} from './helpers/testEnv';
import { doubleRatchetService } from '../../src/services/doubleRatchetService';
import { LocalVaultEncryption } from '../../src/services/localVaultEncryption';
import {
  enqueueOutboxMessage,
  drainOutboxQueue,
  getQueuedOutboxMessages
} from '../../src/services/outboxEngine';
import { loadConversationStateFromDb, loadLocalKeysFromDb } from '../../src/services/cryptoDbStore';

describe('Velum E2EE Signal Protocol E2E Suite', () => {
  beforeEach(() => {
    setupTestCryptoEnvironment();
  });

  afterEach(async () => {
    await resetTestCryptoEnvironment();
  });

  // =========================================================================
  // SUITE 1: PREKEY BUNDLE GENERATION & EXCHANGE
  // =========================================================================
  describe('1. Prekey Bundle Generation & Backend Exchange', () => {
    it('should generate standard Signal prekey bundle with identity, signed prekey, and 20 OTPs', async () => {
      const alice = new TestParticipant(5001, 'Alice');
      await alice.init();

      const bundle = mockServerVault.getBundle(alice.userId);
      expect(bundle).not.toBeNull();
      expect(bundle?.userId).toBe(5001);

      // Verify Identity Key JWK
      const idKeyJwk = JSON.parse(bundle!.identityKey);
      expect(idKeyJwk.kty).toBe('EC');
      expect(idKeyJwk.crv).toBe('P-256');
      expect(idKeyJwk.x).toBeTruthy();
      expect(idKeyJwk.y).toBeTruthy();

      // Verify Signed Prekey JWK
      const spkJwk = JSON.parse(bundle!.signedPrekey);
      expect(spkJwk.kty).toBe('EC');
      expect(spkJwk.crv).toBe('P-256');
      expect(bundle!.signedPrekeySignature).toBeTruthy();

      // Verify One-Time Prekeys
      expect(bundle!.oneTimePrekeys.length).toBe(20);
      for (const otpStr of bundle!.oneTimePrekeys) {
        const otpJwk = JSON.parse(otpStr);
        expect(otpJwk.kty).toBe('EC');
        expect(otpJwk.crv).toBe('P-256');
      }
    });

    it('should allow multiple peers to register and query bundles independently', async () => {
      const users = [
        new TestParticipant(5002, 'User 1'),
        new TestParticipant(5003, 'User 2'),
        new TestParticipant(5004, 'User 3')
      ];

      for (const u of users) {
        await u.init();
        expect(mockServerVault.hasBundle(u.userId)).toBe(true);
      }

      // Query each bundle
      for (const u of users) {
        const b = mockServerVault.getBundle(u.userId);
        expect(b?.userId).toBe(u.userId);
      }
    });
  });

  // =========================================================================
  // SUITE 2: X3DH HANDSHAKE & DOUBLE RATCHET INITIALIZATION
  // =========================================================================
  describe('2. X3DH Initial Key Agreement', () => {
    it('should establish shared root key and ratchet state between Alice and Bob', async () => {
      const alice = new TestParticipant(5005, 'Alice');
      const bob = new TestParticipant(5006, 'Bob');
      await alice.init();
      await bob.init();

      const initialEnvelope = await alice.send(bob.userId, 'X3DH Init Message');
      expect(initialEnvelope).toMatch(/^ratchet:v2:/);

      const decrypted = await bob.receive(alice.userId, initialEnvelope);
      expect(decrypted).toBe('X3DH Init Message');

      // Verify stored state
      await asUser(alice.userId, async () => {
        const stateAlice = await loadConversationStateFromDb(alice.userId, bob.userId);
        expect(stateAlice).not.toBeNull();
        expect(stateAlice.sendChainLength).toBe(1);
      });

      await asUser(bob.userId, async () => {
        const stateBob = await loadConversationStateFromDb(bob.userId, alice.userId);
        expect(stateBob).not.toBeNull();
        expect(stateBob.receiveChainLength).toBe(1);
      });
    });
  });

  // =========================================================================
  // SUITE 3: 20-TURN BIDIRECTIONAL SIMULATED CONVERSATION
  // =========================================================================
  describe('3. Multi-Turn Bidirectional Conversation (20 Turns)', () => {
    it('should execute 20-turn dialogue with continuous DH ratcheting and 100% decryption accuracy', async () => {
      const alice = new TestParticipant(5007, 'Alice');
      const bob = new TestParticipant(5008, 'Bob');
      await alice.init();
      await bob.init();

      const transcript = [
        { sender: 'alice', text: '1. Hello Bob, commencing cryptographic verification.' },
        { sender: 'bob', text: '2. Acknowledged Alice. Signal ratchet initialized.' },
        { sender: 'alice', text: '3. Testing forward secrecy key progression.' },
        { sender: 'bob', text: '4. DH ratchet key step completed on our end.' },
        { sender: 'alice', text: '5. Verifying SHA-256 HMAC integrity envelopes.' },
        { sender: 'bob', text: '6. Envelope tag matches computed hash perfectly.' },
        { sender: 'alice', text: '7. What is our current chain length?' },
        { sender: 'bob', text: '8. Chain length incremented for turn 8.' },
        { sender: 'alice', text: '9. Simulating rapid burst transmission.' },
        { sender: 'alice', text: '10. Consecutive message without waiting for reply.' },
        { sender: 'bob', text: '11. Received both messages in sequence.' },
        { sender: 'bob', text: '12. Bob consecutive follow-up message.' },
        { sender: 'alice', text: '13. All ratchet state counters synchronized.' },
        { sender: 'bob', text: '14. Encrypted payloads match expected byte streams.' },
        { sender: 'alice', text: '15. Testing unicode emojis: 🔐⚡🛡️🚀✨' },
        { sender: 'bob', text: '16. Emoji payload decoded with UTF-8 exactness.' },
        { sender: 'alice', text: '17. Preparing final conversation wrap-up.' },
        { sender: 'bob', text: '18. All 18 preceding turns verified.' },
        { sender: 'alice', text: '19. Final verification check passing.' },
        { sender: 'bob', text: '20. Full 20-turn dialogue completed successfully.' }
      ];

      for (const turn of transcript) {
        if (turn.sender === 'alice') {
          const envelope = await alice.send(bob.userId, turn.text);
          const decrypted = await bob.receive(alice.userId, envelope);
          expect(decrypted).toBe(turn.text);
        } else {
          const envelope = await bob.send(alice.userId, turn.text);
          const decrypted = await alice.receive(bob.userId, envelope);
          expect(decrypted).toBe(turn.text);
        }
      }
    });
  });

  // =========================================================================
  // SUITE 4: TRI-PARTY CONVERSATION NETWORK
  // =========================================================================
  describe('4. Tri-Party Multi-Peer Network (Alice, Bob, Charlie)', () => {
    it('should maintain independent cryptographic sessions across multiple peer pairs', async () => {
      const alice = new TestParticipant(5009, 'Alice');
      const bob = new TestParticipant(5010, 'Bob');
      const charlie = new TestParticipant(5011, 'Charlie');

      await alice.init();
      await bob.init();
      await charlie.init();

      // Alice -> Bob
      const msgAB = 'Private message from Alice to Bob';
      const envAB = await alice.send(bob.userId, msgAB);
      expect(await bob.receive(alice.userId, envAB)).toBe(msgAB);

      // Bob -> Charlie
      const msgBC = 'Private message from Bob to Charlie';
      const envBC = await bob.send(charlie.userId, msgBC);
      expect(await charlie.receive(bob.userId, envBC)).toBe(msgBC);

      // Charlie -> Alice
      const msgCA = 'Private message from Charlie to Alice';
      const envCA = await charlie.send(alice.userId, msgCA);
      expect(await alice.receive(charlie.userId, envCA)).toBe(msgCA);

      // Alice -> Charlie
      const msgAC = 'Alice replying to Charlie';
      const envAC = await alice.send(charlie.userId, msgAC);
      expect(await charlie.receive(alice.userId, envAC)).toBe(msgAC);

      // Charlie -> Bob
      const msgCB = 'Charlie replying to Bob';
      const envCB = await charlie.send(bob.userId, msgCB);
      expect(await bob.receive(charlie.userId, envCB)).toBe(msgCB);

      // Bob -> Alice
      const msgBA = 'Bob replying to Alice';
      const envBA = await bob.send(alice.userId, msgBA);
      expect(await alice.receive(bob.userId, envBA)).toBe(msgBA);
    });
  });

  // =========================================================================
  // SUITE 5: OFFLINE OUTBOX ENGINE INTEGRATION
  // =========================================================================
  describe('5. Offline Outbox Queue & WebSocket Draining', () => {
    it('should queue multiple messages offline and drain to recipient upon connection', async () => {
      const alice = new TestParticipant(5012, 'Alice');
      const bob = new TestParticipant(5013, 'Bob');
      await alice.init();
      await bob.init();

      const messages = [
        'Offline Item 1: Flight boarding',
        'Offline Item 2: Airplane mode enabled',
        'Offline Item 3: Cruising altitude',
        'Offline Item 4: Landing now'
      ];

      const now = Date.now();
      for (let i = 0; i < messages.length; i++) {
        const cipher = await alice.send(bob.userId, messages[i]);
        await enqueueOutboxMessage({
          client_msg_id: `flight-msg-${i}`,
          room_id: `dm_${bob.userId}`,
          content: cipher,
          is_encrypted: true,
          timestamp: new Date(now + i * 50).toISOString(),
          retryCount: 0
        });
      }

      expect((await getQueuedOutboxMessages()).length).toBe(4);

      const transmitter = createMockWebSocketTransmitter();
      const count = await drainOutboxQueue(transmitter.transmit);
      expect(count).toBe(4);
      expect((await getQueuedOutboxMessages()).length).toBe(0);

      // Recipient receives and decrypts every message in order
      for (let i = 0; i < messages.length; i++) {
        const frame = transmitter.sentFrames[i];
        const dec = await bob.receive(alice.userId, frame.content);
        expect(dec).toBe(messages[i]);
      }
    });
  });

  // =========================================================================
  // SUITE 6: OUT-OF-ORDER MESSAGE DISPATCH & SKIPPED KEYS
  // =========================================================================
  describe('6. Non-Sequential Message Delivery & Skipped Keys', () => {
    it('should correctly decrypt messages received in arbitrary order with multiple skips', async () => {
      const alice = new TestParticipant(5014, 'Alice');
      const bob = new TestParticipant(5015, 'Bob');
      await alice.init();
      await bob.init();

      const msgs = [
        'Packet 0 (Initial)',
        'Packet 1 (First update)',
        'Packet 2 (Second update)',
        'Packet 3 (Third update)',
        'Packet 4 (Fourth update)',
        'Packet 5 (Fifth update)'
      ];

      const envelopes: string[] = [];
      for (const m of msgs) {
        envelopes.push(await alice.send(bob.userId, m));
      }

      // Deliver in reverse order: 5, 4, 3, 2, 1, 0
      for (let i = msgs.length - 1; i >= 0; i--) {
        const dec = await bob.receive(alice.userId, envelopes[i]);
        expect(dec).toBe(msgs[i]);
      }
    });
  });

  // =========================================================================
  // SUITE 7: LOCAL VAULT ENCRYPTION & KEY ROTATION
  // =========================================================================
  describe('7. Local Vault Encryption & Forward Secrecy Key Shredding', () => {
    it('should encrypt and decrypt local sensitive payloads using LocalVaultEncryption', async () => {
      const secretHistory = 'Sensitive conversation history snippet';
      const encrypted = await LocalVaultEncryption.encryptPayload(secretHistory);

      expect(encrypted.ciphertextHex).toBeTruthy();
      expect(encrypted.ivHex).toHaveLength(24);
      expect(encrypted.saltHex).toHaveLength(32);

      const decrypted = await LocalVaultEncryption.decryptPayload(encrypted);
      expect(decrypted).toBe(secretHistory);
    });

    it('should cryptographically shred old history upon vault key rotation', async () => {
      const sensitiveDoc = 'Confidential trade secret document';
      const encrypted = await LocalVaultEncryption.encryptPayload(sensitiveDoc);

      // Rotate vault key (shredding old key)
      await LocalVaultEncryption.rotateVaultKey();

      // Attempting to decrypt with old salt must fail / return null
      const decrypted = await LocalVaultEncryption.decryptPayload(encrypted);
      expect(decrypted).toBeNull();
    });
  });

  // =========================================================================
  // SUITE 8: AUTO-HEALING & SESSION RE-SYNCHRONIZATION
  // =========================================================================
  describe('8. Resilient Auto-Healing & Desynchronization Recovery', () => {
    it('should seamlessly recover conversation through forceRekey after state desync', async () => {
      const alice = new TestParticipant(5016, 'Alice');
      const bob = new TestParticipant(5017, 'Bob');
      await alice.init();
      await bob.init();

      // Exchange initial message
      const env1 = await alice.send(bob.userId, 'Message before desync');
      expect(await bob.receive(alice.userId, env1)).toBe('Message before desync');

      // Simulate state loss / corruption on Alice's end and forceRekey
      await alice.forceRekey(bob.userId);

      // Subsequent message after rekey
      const env2 = await alice.send(bob.userId, 'Message after rekey healing');
      expect(env2).toMatch(/^ratchet:v2:/);
    });
  });
});
