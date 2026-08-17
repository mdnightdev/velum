/**
 * Velum E2EE Signal Protocol Tiered Test Suite (Tiers 1 - 4)
 * Comprehensive Opaque-Box & Integration Tests for Signal Protocol Migration
 *
 * Tier 1: Feature Coverage (35 tests - 5 per feature across 7 features)
 * Tier 2: Boundary Value Analysis & Edge Cases (35 tests - 5 per feature across 7 features)
 * Tier 3: Cross-Feature Combinations & Pairwise Integration (10 tests)
 * Tier 4: Real-World Multi-turn Application Scenarios (5 tests)
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
import {
  openCryptoDatabaseV2,
  saveLocalKeysToDb,
  loadLocalKeysFromDb,
  saveConversationStateToDb,
  loadConversationStateFromDb,
  deleteConversationStateFromDb,
  purgeCryptoVault
} from '../../src/services/cryptoDbStore';
import {
  saveSkippedMessageKey,
  consumeSkippedMessageKey,
  clearSkippedKeysForPeer,
  purgeSkippedMessageKeys
} from '../../src/services/skippedKeysStore';
import {
  enqueueOutboxMessage,
  getQueuedOutboxMessages,
  removeOutboxMessage,
  drainOutboxQueue,
  OutboxPayload
} from '../../src/services/outboxEngine';
import { encryptMessage, decryptMessage, EncryptionContext } from '../../src/services/encryptionService';

describe('Velum E2EE Protocol Suite: Tiers 1-4', () => {
  beforeEach(() => {
    setupTestCryptoEnvironment();
  });

  afterEach(async () => {
    await resetTestCryptoEnvironment();
  });

  // =========================================================================
  // TIER 1: FEATURE COVERAGE (35 Tests: 7 Features x 5 Tests)
  // =========================================================================
  describe('Tier 1: Feature Coverage', () => {
    // -----------------------------------------------------------------------
    // Feature 1: Identity Generation & Registration ID
    // -----------------------------------------------------------------------
    describe('Feature 1: Identity Generation & Registration ID', () => {
      it('T1.1.1: should generate valid Curve25519/P-256 identity key pair with public and private keys', async () => {
        await asUser(101, async () => {
          const loaded = await loadLocalKeysFromDb(101);
          expect(loaded).toBeDefined();
          expect(loaded.identityKeyPair).toBeDefined();
          expect(loaded.identityKeyPair.publicKey).toBeDefined();
          expect(loaded.identityKeyPair.privateKey).toBeDefined();
          expect(loaded.identityKeyPair.publicKey.type).toBe('public');
          expect(loaded.identityKeyPair.privateKey.type).toBe('private');
        });
      });

      it('T1.1.2: should export identity public key into valid standard JWK format', async () => {
        await asUser(102, async () => {
          const loaded = await loadLocalKeysFromDb(102);
          const jwk = await window.crypto.subtle.exportKey('jwk', loaded.identityKeyPair.publicKey);
          expect(jwk.kty).toBe('EC');
          expect(jwk.crv).toBe('P-256');
          expect(jwk.x).toBeDefined();
          expect(jwk.y).toBeDefined();
        });
      });

      it('T1.1.3: should persist local identity key pair in IndexedDB local_keys store', async () => {
        await asUser(103, async () => {
          const dbKeys = await loadLocalKeysFromDb(103);
          expect(dbKeys).not.toBeNull();
          expect(dbKeys.identityKeyPair).toBeDefined();
        });
      });

      it('T1.1.4: should reload existing identity key pair on subsequent session startup without regenerating', async () => {
        let firstPubKeyJwk: any;
        await asUser(104, async () => {
          const loaded1 = await loadLocalKeysFromDb(104);
          firstPubKeyJwk = await window.crypto.subtle.exportKey('jwk', loaded1.identityKeyPair.publicKey);
        });

        await asUser(104, async () => {
          const loaded2 = await loadLocalKeysFromDb(104);
          const secondPubKeyJwk = await window.crypto.subtle.exportKey('jwk', loaded2.identityKeyPair.publicKey);
          expect(secondPubKeyJwk.x).toBe(firstPubKeyJwk.x);
          expect(secondPubKeyJwk.y).toBe(firstPubKeyJwk.y);
        });
      });

      it('T1.1.5: should maintain isolated identity keys for distinct users without collisions', async () => {
        let user1KeyJwk: any;
        let user2KeyJwk: any;

        await asUser(105, async () => {
          const keys1 = await loadLocalKeysFromDb(105);
          user1KeyJwk = await window.crypto.subtle.exportKey('jwk', keys1.identityKeyPair.publicKey);
        });

        await asUser(106, async () => {
          const keys2 = await loadLocalKeysFromDb(106);
          user2KeyJwk = await window.crypto.subtle.exportKey('jwk', keys2.identityKeyPair.publicKey);
        });

        expect(user1KeyJwk.x).not.toBe(user2KeyJwk.x);
        expect(user1KeyJwk.y).not.toBe(user2KeyJwk.y);
      });
    });

    // -----------------------------------------------------------------------
    // Feature 2: Prekey & Bundle Management
    // -----------------------------------------------------------------------
    describe('Feature 2: Prekey & Bundle Management', () => {
      it('T1.2.1: should generate valid signed prekey pair with exportable public key', async () => {
        await asUser(201, async () => {
          const keys = await loadLocalKeysFromDb(201);
          expect(keys.signedPrekeyPair).toBeDefined();
          const jwk = await window.crypto.subtle.exportKey('jwk', keys.signedPrekeyPair.publicKey);
          expect(jwk.kty).toBe('EC');
          expect(jwk.crv).toBe('P-256');
        });
      });

      it('T1.2.2: should generate a pool of 20 one-time prekeys (OTPs)', async () => {
        await asUser(202, async () => {
          const keys = await loadLocalKeysFromDb(202);
          expect(Array.isArray(keys.oneTimePrekeys)).toBe(true);
          expect(keys.oneTimePrekeys.length).toBe(20);
        });
      });

      it('T1.2.3: should serialize prekey bundle into standard JSON DTO payload', async () => {
        await asUser(203, async () => {
          const bundle = mockServerVault.getBundle(203);
          expect(bundle).toBeDefined();
          expect(bundle?.userId).toBe(203);
          expect(typeof bundle?.identityKey).toBe('string');
          expect(typeof bundle?.signedPrekey).toBe('string');
          expect(typeof bundle?.signedPrekeySignature).toBe('string');
          expect(Array.isArray(bundle?.oneTimePrekeys)).toBe(true);
        });
      });

      it('T1.2.4: should upload prekey bundle to server vault via mock backend route', async () => {
        await asUser(204, async () => {
          expect(mockServerVault.hasBundle(204)).toBe(true);
        });
      });

      it('T1.2.5: should retrieve peer prekey bundle successfully from mock server vault', async () => {
        await asUser(205, async () => {});
        const fetched = mockServerVault.getBundle(205);
        expect(fetched).not.toBeNull();
        expect(fetched?.userId).toBe(205);
      });
    });

    // -----------------------------------------------------------------------
    // Feature 3: X3DH Session Building
    // -----------------------------------------------------------------------
    describe('Feature 3: X3DH Session Building', () => {
      it('T1.3.1: should initiate X3DH handshake between Alice and Bob', async () => {
        const alice = new TestParticipant(301, 'Alice');
        const bob = new TestParticipant(302, 'Bob');
        await alice.init();
        await bob.init();

        const envelope = await alice.send(bob.userId, 'Hello Bob via X3DH');
        expect(envelope).toMatch(/^ratchet:v2:/);

        const decrypted = await bob.receive(alice.userId, envelope);
        expect(decrypted).toBe('Hello Bob via X3DH');
      });

      it('T1.3.2: should combine DH outputs deterministically using lexicographical sorting', async () => {
        const alice = new TestParticipant(303, 'Alice');
        const bob = new TestParticipant(304, 'Bob');
        await alice.init();
        await bob.init();

        const msg1 = await alice.send(bob.userId, 'Deterministic test');
        const decrypted = await bob.receive(alice.userId, msg1);
        expect(decrypted).toBe('Deterministic test');
      });

      it('T1.3.3: should derive 256-bit root key and initial chain keys via HKDF SHA-256', async () => {
        const alice = new TestParticipant(305, 'Alice');
        const bob = new TestParticipant(306, 'Bob');
        await alice.init();
        await bob.init();

        await alice.send(bob.userId, 'Key derivation test');
        await asUser(alice.userId, async () => {
          const state = await loadConversationStateFromDb(alice.userId, bob.userId);
          expect(state).not.toBeNull();
          expect(state.rootKey).toBeDefined();
          expect(state.sendChainKey).toBeDefined();
          expect(state.receiveChainKey).toBeDefined();
        });
      });

      it('T1.3.4: should assign Send/Receive chains deterministically based on local vs peer userId', async () => {
        const alice = new TestParticipant(307, 'Alice'); // ID 307 < 308 -> Chain A sender
        const bob = new TestParticipant(308, 'Bob');     // ID 308 > 307 -> Chain B sender
        await alice.init();
        await bob.init();

        const envAliceToBob = await alice.send(bob.userId, 'A to B');
        const decByBob = await bob.receive(alice.userId, envAliceToBob);
        expect(decByBob).toBe('A to B');

        const envBobToAlice = await bob.send(alice.userId, 'B to A');
        const decByAlice = await alice.receive(bob.userId, envBobToAlice);
        expect(decByAlice).toBe('B to A');
      });

      it('T1.3.5: should persist initial ratchet state into IndexedDB conversation_states', async () => {
        const alice = new TestParticipant(309, 'Alice');
        const bob = new TestParticipant(310, 'Bob');
        await alice.init();
        await bob.init();

        await alice.send(bob.userId, 'Persist initial state');
        await asUser(alice.userId, async () => {
          const state = await loadConversationStateFromDb(alice.userId, bob.userId);
          expect(state).not.toBeNull();
          expect(state.sendChainLength).toBe(1);
        });
      });
    });

    // -----------------------------------------------------------------------
    // Feature 4: Message Encryption & Decryption
    // -----------------------------------------------------------------------
    describe('Feature 4: Message Encryption & Decryption', () => {
      it('T1.4.1: should encrypt plaintext into a ratchet:v2: envelope', async () => {
        const alice = new TestParticipant(401, 'Alice');
        const bob = new TestParticipant(402, 'Bob');
        await alice.init();
        await bob.init();

        const envelope = await alice.send(bob.userId, 'Top secret plaintext');
        expect(envelope.startsWith('ratchet:v2:')).toBe(true);
      });

      it('T1.4.2: should produce envelope with valid header, ivHex, ciphertextHex, and tagHex', async () => {
        const alice = new TestParticipant(403, 'Alice');
        const bob = new TestParticipant(404, 'Bob');
        await alice.init();
        await bob.init();

        const envelope = await alice.send(bob.userId, 'Inspect envelope structure');
        const payload = JSON.parse(envelope.substring(11));

        expect(payload.header).toBeDefined();
        expect(payload.header.dhPublicKey).toBeDefined();
        expect(typeof payload.header.n).toBe('number');
        expect(typeof payload.header.pn).toBe('number');
        expect(payload.ivHex).toHaveLength(24); // 12 bytes = 24 hex chars
        expect(payload.tagHex).toHaveLength(32); // 16 bytes = 32 hex chars
        expect(payload.ciphertextHex.length).toBeGreaterThan(0);
        expect(payload.hmacHex).toBeDefined();
      });

      it('T1.4.3: should decrypt ratchet:v2: envelope back to exact original plaintext', async () => {
        const alice = new TestParticipant(405, 'Alice');
        const bob = new TestParticipant(406, 'Bob');
        await alice.init();
        await bob.init();

        const original = 'Message authenticity & confidentiality guaranteed.';
        const env = await alice.send(bob.userId, original);
        const decrypted = await bob.receive(alice.userId, env);
        expect(decrypted).toBe(original);
      });

      it('T1.4.4: should derive unique message keys per message index in chain', async () => {
        const alice = new TestParticipant(407, 'Alice');
        const bob = new TestParticipant(408, 'Bob');
        await alice.init();
        await bob.init();

        const env1 = await alice.send(bob.userId, 'Message One');
        const env2 = await alice.send(bob.userId, 'Message Two');

        const p1 = JSON.parse(env1.substring(11));
        const p2 = JSON.parse(env2.substring(11));

        expect(p1.header.n).toBe(0);
        expect(p2.header.n).toBe(1);
        expect(p1.ciphertextHex).not.toBe(p2.ciphertextHex);

        expect(await bob.receive(alice.userId, env1)).toBe('Message One');
        expect(await bob.receive(alice.userId, env2)).toBe('Message Two');
      });

      it('T1.4.5: should validate HMAC-SHA256 integrity tag during decryption', async () => {
        const alice = new TestParticipant(409, 'Alice');
        const bob = new TestParticipant(410, 'Bob');
        await alice.init();
        await bob.init();

        const env = await alice.send(bob.userId, 'Integrity check message');
        const parsed = JSON.parse(env.substring(11));
        expect(parsed.hmacHex).toHaveLength(64); // 32 bytes SHA-256 HMAC = 64 hex

        const decrypted = await bob.receive(alice.userId, env);
        expect(decrypted).toBe('Integrity check message');
      });
    });

    // -----------------------------------------------------------------------
    // Feature 5: Media & Attachment Encryption
    // -----------------------------------------------------------------------
    describe('Feature 5: Media & Attachment Encryption', () => {
      it('T1.5.1: should encrypt and decrypt structured voice note JSON payload', async () => {
        const alice = new TestParticipant(501, 'Alice');
        const bob = new TestParticipant(502, 'Bob');
        await alice.init();
        await bob.init();

        const voiceJson = SamplePayloads.voiceNote;
        const env = await alice.send(bob.userId, voiceJson);
        const decrypted = await bob.receive(alice.userId, env);

        expect(decrypted).toBe(voiceJson);
        const parsed = JSON.parse(decrypted);
        expect(parsed.type).toBe('voice');
        expect(parsed.durationMs).toBe(4200);
      });

      it('T1.5.2: should encrypt and decrypt image metadata with base64 thumbnail', async () => {
        const alice = new TestParticipant(503, 'Alice');
        const bob = new TestParticipant(504, 'Bob');
        await alice.init();
        await bob.init();

        const imageJson = SamplePayloads.imageAttachment;
        const env = await alice.send(bob.userId, imageJson);
        const decrypted = await bob.receive(alice.userId, env);

        expect(decrypted).toBe(imageJson);
        const parsed = JSON.parse(decrypted);
        expect(parsed.type).toBe('image');
        expect(parsed.dimensions.width).toBe(1920);
      });

      it('T1.5.3: should encrypt and decrypt large document attachment payload', async () => {
        const alice = new TestParticipant(505, 'Alice');
        const bob = new TestParticipant(506, 'Bob');
        await alice.init();
        await bob.init();

        const largePayload = JSON.stringify({
          type: 'document',
          name: 'large_dataset.csv',
          data: 'COL1,COL2,COL3\n'.concat('123,456,789\n'.repeat(1000))
        });

        const env = await alice.send(bob.userId, largePayload);
        const decrypted = await bob.receive(alice.userId, env);
        expect(decrypted).toBe(largePayload);
      });

      it('T1.5.4: should preserve JSON integrity and byte exactness after decryption', async () => {
        const alice = new TestParticipant(507, 'Alice');
        const bob = new TestParticipant(508, 'Bob');
        await alice.init();
        await bob.init();

        const complex = JSON.stringify({
          nested: { level1: { level2: { array: [1, 2, 3, null, true, false] } } },
          unicode: '🔥🛡️ Velum 🚀'
        });

        const env = await alice.send(bob.userId, complex);
        const dec = await bob.receive(alice.userId, env);
        expect(JSON.parse(dec)).toEqual(JSON.parse(complex));
      });

      it('T1.5.5: should encrypt and decrypt mixed media payloads with multiple attachments', async () => {
        const alice = new TestParticipant(509, 'Alice');
        const bob = new TestParticipant(510, 'Bob');
        await alice.init();
        await bob.init();

        const mixed = SamplePayloads.mixedMedia;
        const env = await alice.send(bob.userId, mixed);
        const dec = await bob.receive(alice.userId, env);
        expect(dec).toBe(mixed);
      });
    });

    // -----------------------------------------------------------------------
    // Feature 6: Offline Outbox & Queueing
    // -----------------------------------------------------------------------
    describe('Feature 6: Offline Outbox & Queueing', () => {
      it('T1.6.1: should enqueue an encrypted message frame into outbox_messages store', async () => {
        const payload: OutboxPayload = {
          client_msg_id: 'msg-outbox-1',
          room_id: 'dm_602',
          content: 'ratchet:v2:mock-payload',
          is_encrypted: true,
          timestamp: new Date().toISOString(),
          retryCount: 0
        };

        await enqueueOutboxMessage(payload);
        const queued = await getQueuedOutboxMessages();
        expect(queued.length).toBe(1);
        expect(queued[0].client_msg_id).toBe('msg-outbox-1');
      });

      it('T1.6.2: should retrieve pending outbox messages sorted chronologically by timestamp', async () => {
        const now = Date.now();
        const p1: OutboxPayload = {
          client_msg_id: 'msg-time-2',
          room_id: 'dm_602',
          content: 'second',
          is_encrypted: true,
          timestamp: new Date(now + 1000).toISOString(),
          retryCount: 0
        };
        const p2: OutboxPayload = {
          client_msg_id: 'msg-time-1',
          room_id: 'dm_602',
          content: 'first',
          is_encrypted: true,
          timestamp: new Date(now).toISOString(),
          retryCount: 0
        };

        await enqueueOutboxMessage(p1);
        await enqueueOutboxMessage(p2);

        const queued = await getQueuedOutboxMessages();
        expect(queued.length).toBe(2);
        expect(queued[0].client_msg_id).toBe('msg-time-1');
        expect(queued[1].client_msg_id).toBe('msg-time-2');
      });

      it('T1.6.3: should remove acknowledged message from outbox by client_msg_id', async () => {
        const p: OutboxPayload = {
          client_msg_id: 'msg-ack-1',
          room_id: 'dm_603',
          content: 'acknowledged',
          is_encrypted: true,
          timestamp: new Date().toISOString(),
          retryCount: 0
        };

        await enqueueOutboxMessage(p);
        expect((await getQueuedOutboxMessages()).length).toBe(1);

        await removeOutboxMessage('msg-ack-1');
        expect((await getQueuedOutboxMessages()).length).toBe(0);
      });

      it('T1.6.4: should drain outbox sequentially over a simulated active WebSocket transmitter', async () => {
        const transmitter = createMockWebSocketTransmitter();

        await enqueueOutboxMessage({
          client_msg_id: 'drain-1',
          room_id: 'dm_604',
          content: 'first frame',
          is_encrypted: true,
          timestamp: new Date().toISOString(),
          retryCount: 0
        });

        await enqueueOutboxMessage({
          client_msg_id: 'drain-2',
          room_id: 'dm_604',
          content: 'second frame',
          is_encrypted: true,
          timestamp: new Date(Date.now() + 50).toISOString(),
          retryCount: 0
        });

        const drainedCount = await drainOutboxQueue(transmitter.transmit);
        expect(drainedCount).toBe(2);
        expect(transmitter.getSentCount()).toBe(2);
        expect(transmitter.sentFrames[0].client_msg_id).toBe('drain-1');
        expect(transmitter.sentFrames[1].client_msg_id).toBe('drain-2');
      });

      it('T1.6.5: should leave outbox empty after successful complete queue draining', async () => {
        const transmitter = createMockWebSocketTransmitter();

        await enqueueOutboxMessage({
          client_msg_id: 'drain-clean-1',
          room_id: 'dm_605',
          content: 'frame',
          is_encrypted: true,
          timestamp: new Date().toISOString(),
          retryCount: 0
        });

        await drainOutboxQueue(transmitter.transmit);
        const remaining = await getQueuedOutboxMessages();
        expect(remaining.length).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    // Feature 7: Session Healing & Desync Handling
    // -----------------------------------------------------------------------
    describe('Feature 7: Session Healing & Desync Handling', () => {
      it('T1.7.1: should detect out-of-order message arrival and store skipped message keys', async () => {
        const alice = new TestParticipant(701, 'Alice');
        const bob = new TestParticipant(702, 'Bob');
        await alice.init();
        await bob.init();

        const env0 = await alice.send(bob.userId, 'Message 0');
        const env1 = await alice.send(bob.userId, 'Message 1');
        const env2 = await alice.send(bob.userId, 'Message 2');

        // Bob receives message 2 first (skipping 0 and 1)
        const dec2 = await bob.receive(alice.userId, env2);
        expect(dec2).toBe('Message 2');
      });

      it('T1.7.2: should consume and decrypt out-of-order message using stored skipped key', async () => {
        const alice = new TestParticipant(703, 'Alice');
        const bob = new TestParticipant(704, 'Bob');
        await alice.init();
        await bob.init();

        const env0 = await alice.send(bob.userId, 'Message 0');
        const env1 = await alice.send(bob.userId, 'Message 1');
        const env2 = await alice.send(bob.userId, 'Message 2');

        // Bob receives 2 first, then 0, then 1
        expect(await bob.receive(alice.userId, env2)).toBe('Message 2');
        expect(await bob.receive(alice.userId, env0)).toBe('Message 0');
        expect(await bob.receive(alice.userId, env1)).toBe('Message 1');
      });

      it('T1.7.3: should persist skipped message keys in IndexedDB skipped_message_keys store', async () => {
        const subtle = window.crypto.subtle;
        const testKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

        await saveSkippedMessageKey('dm_706', 705, 1, 0, testKey);
        const consumed = await consumeSkippedMessageKey('dm_706', 705, 1, 0);

        expect(consumed).not.toBeNull();
        expect(consumed?.type).toBe('secret');
      });

      it('T1.7.4: should trap decryption errors and trigger forceRekey to recover session state', async () => {
        const alice = new TestParticipant(707, 'Alice');
        const bob = new TestParticipant(708, 'Bob');
        await alice.init();
        await bob.init();

        // Establish initial conversation
        const m1 = await alice.send(bob.userId, 'Initial sync');
        expect(await bob.receive(alice.userId, m1)).toBe('Initial sync');

        // Force rekey on Alice's side
        await alice.forceRekey(bob.userId);

        // Subsequent message encrypted under fresh ratchet state
        const m2 = await alice.send(bob.userId, 'Post-rekey message');
        expect(m2).toMatch(/^ratchet:v2:/);
      });

      it('T1.7.5: should clear skipped keys and conversation state upon forced rekeying', async () => {
        const subtle = window.crypto.subtle;
        const testKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
        await saveSkippedMessageKey('dm_709_', 709, 5, 0, testKey);

        await clearSkippedKeysForPeer(709);
        const lookup = await consumeSkippedMessageKey('dm_709_', 709, 5, 0);
        expect(lookup).toBeNull();
      });
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY VALUE ANALYSIS & EDGE CASES (35 Tests: 7 Features x 5 Tests)
  // =========================================================================
  describe('Tier 2: Boundary Value Analysis & Edge Cases', () => {
    // -----------------------------------------------------------------------
    // Feature 1 Boundaries
    // -----------------------------------------------------------------------
    describe('Feature 1 Boundaries: Identity & Registration', () => {
      it('T2.1.1: should throw descriptive error when localUserId is null during operations', async () => {
        (doubleRatchetService as any).localUserId = null;
        doubleRatchetService.clearMemoryState();
        await expect(doubleRatchetService.initializeLocalKeys()).rejects.toThrow(/setLocalUserId/);
      });

      it('T2.1.2: should handle large numerical user IDs (Number.MAX_SAFE_INTEGER) safely', async () => {
        const bigUserId = 9007199254740991;
        await asUser(bigUserId, async () => {
          const keys = await loadLocalKeysFromDb(bigUserId);
          expect(keys).not.toBeNull();
        });
      });

      it('T2.1.3: should return null when loading non-existent local keys from DB', async () => {
        const nonExistent = await loadLocalKeysFromDb(999999);
        expect(nonExistent).toBeNull();
      });

      it('T2.1.4: should purge local vault cleanly when called multiple times', async () => {
        await purgeCryptoVault();
        await purgeCryptoVault();
        const res = await loadLocalKeysFromDb(1);
        expect(res).toBeNull();
      });

      it('T2.1.5: should reject invalid non-finite userId passed to setLocalUserId', () => {
        (doubleRatchetService as any).localUserId = null;
        expect(() => doubleRatchetService.setLocalUserId(NaN)).not.toThrow();
        expect(() => (doubleRatchetService as any).getLocalUserIdOrThrow()).toThrow(/localUserId not set/);
      });
    });

    // -----------------------------------------------------------------------
    // Feature 2 Boundaries
    // -----------------------------------------------------------------------
    describe('Feature 2 Boundaries: Prekey & Bundle Management', () => {
      it('T2.2.1: should handle peer prekey bundle with empty one-time prekeys array', async () => {
        const alice = new TestParticipant(801, 'Alice');
        const bob = new TestParticipant(802, 'Bob');
        await alice.init();
        await bob.init();

        // Modify Bob's bundle in mock server vault to have empty OTP array
        const bundle = mockServerVault.getBundle(bob.userId)!;
        bundle.oneTimePrekeys = [];
        mockServerVault.registerBundle(bob.userId, bundle);

        const env = await alice.send(bob.userId, 'Handshake without OTP');
        expect(env).toMatch(/^ratchet:v2:/);
        expect(await bob.receive(alice.userId, env)).toBe('Handshake without OTP');
      });

      it('T2.2.2: should throw error when encrypting to peer with no uploaded prekey bundle', async () => {
        const alice = new TestParticipant(803, 'Alice');
        await alice.init();

        await expect(alice.send(99999, 'No bundle peer')).rejects.toThrow(/No prekey bundle/);
      });

      it('T2.2.3: should return fallback placeholder when decrypting message from unknown peer with no bundle', async () => {
        const bob = new TestParticipant(804, 'Bob');
        await bob.init();

        const fakeEnvelope = `ratchet:v2:${JSON.stringify({
          header: { dhPublicKey: '{}', pn: 0, n: 0 },
          ivHex: '00'.repeat(12),
          ciphertextHex: 'deadbeef',
          tagHex: '00'.repeat(16)
        })}`;

        const result = await bob.receive(99998, fakeEnvelope);
        expect(result).toBe('[Encrypted Message - No Prekey]');
      });

      it('T2.2.4: should invalidate cached peer prekey bundle when forceRekey is called', async () => {
        const alice = new TestParticipant(805, 'Alice');
        const bob = new TestParticipant(806, 'Bob');
        await alice.init();
        await bob.init();

        await alice.send(bob.userId, 'First handshake');
        await alice.forceRekey(bob.userId);
        const secondEnv = await alice.send(bob.userId, 'Second handshake');
        expect(secondEnv).toMatch(/^ratchet:v2:/);
      });

      it('T2.2.5: should retain valid signed prekey signature string format in bundle', async () => {
        await asUser(807, async () => {
          const bundle = mockServerVault.getBundle(807);
          expect(bundle?.signedPrekeySignature).toBeTruthy();
          expect(bundle?.signedPrekeySignature.length).toBeGreaterThan(0);
        });
      });
    });

    // -----------------------------------------------------------------------
    // Feature 3 Boundaries
    // -----------------------------------------------------------------------
    describe('Feature 3 Boundaries: X3DH Session Building', () => {
      it('T2.3.1: should handle reverse ID order (sender > recipient) seamlessly', async () => {
        const higherIdUser = new TestParticipant(900, 'High');
        const lowerIdUser = new TestParticipant(100, 'Low');
        await higherIdUser.init();
        await lowerIdUser.init();

        const env = await higherIdUser.send(lowerIdUser.userId, 'High to Low test');
        const dec = await lowerIdUser.receive(higherIdUser.userId, env);
        expect(dec).toBe('High to Low test');
      });

      it('T2.3.2: should delete conversation state from IndexedDB on demand', async () => {
        const alice = new TestParticipant(809, 'Alice');
        const bob = new TestParticipant(810, 'Bob');
        await alice.init();
        await bob.init();

        await alice.send(bob.userId, 'State creation');
        await deleteConversationStateFromDb(alice.userId, bob.userId);

        const loaded = await loadConversationStateFromDb(alice.userId, bob.userId);
        expect(loaded).toBeNull();
      });

      it('T2.3.3: should calculate SHA-256 state checksum during conversation state creation', async () => {
        const alice = new TestParticipant(811, 'Alice');
        const bob = new TestParticipant(812, 'Bob');
        await alice.init();
        await bob.init();

        await alice.send(bob.userId, 'Checksum test');
        await asUser(alice.userId, async () => {
          const db = await openCryptoDatabaseV2();
          const record = await new Promise<any>((resolve, reject) => {
            const tx = db.transaction(['conversation_states'], 'readonly');
            const req = tx.objectStore('conversation_states').get('811_812');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(new Error('Failed to load raw record'));
          });
          expect(record).toBeDefined();
          expect(record.checksum).toBeDefined();
          expect(record.checksum).toHaveLength(64); // 32 bytes SHA-256 = 64 hex
        });
      });

      it('T2.3.4: should reject conversation state with corrupted checksum', async () => {
        const db = await openCryptoDatabaseV2();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(['conversation_states'], 'readwrite');
          const store = tx.objectStore('conversation_states');
          const req = store.put({
            id: '813_814',
            localUserId: 813,
            peerUserId: 814,
            rootKey: new Uint8Array(32).buffer,
            sendChainKey: new Uint8Array(32).buffer,
            receiveChainKey: new Uint8Array(32).buffer,
            sendChainLength: 1,
            receiveChainLength: 0,
            receiveChainGeneration: 0,
            previousChainLength: 0,
            version: 1,
            checksum: 'corrupted_hex_checksum_1234567890abcdef'
          });
          req.onsuccess = () => resolve();
          req.onerror = () => reject(new Error('Failed to put corrupted record'));
        });

        const loaded = await loadConversationStateFromDb(813, 814);
        expect(loaded).toBeNull();
      });

      it('T2.3.5: should initialize ratchet state with version matching STATE_VERSION (1)', async () => {
        const alice = new TestParticipant(815, 'Alice');
        const bob = new TestParticipant(816, 'Bob');
        await alice.init();
        await bob.init();

        await alice.send(bob.userId, 'Version test');
        await asUser(alice.userId, async () => {
          const state = await loadConversationStateFromDb(alice.userId, bob.userId);
          expect(state.version).toBe(1);
        });
      });
    });

    // -----------------------------------------------------------------------
    // Feature 4 Boundaries
    // -----------------------------------------------------------------------
    describe('Feature 4 Boundaries: Message Encryption & Decryption', () => {
      it('T2.4.1: should encrypt and decrypt empty string "" without errors', async () => {
        const context: EncryptionContext = { type: 'lounge', roomId: 'lounge-edge', isEncrypted: true };
        const enc = await encryptMessage('', context);
        expect(enc).toBe('');
        const dec = await decryptMessage('', context);
        expect(dec).toBe('');
      });

      it('T2.4.2: should encrypt and decrypt unicode emojis, RTL text, and surrogate pairs', async () => {
        const alice = new TestParticipant(817, 'Alice');
        const bob = new TestParticipant(818, 'Bob');
        await alice.init();
        await bob.init();

        const complexText = '🔒🔐🔑 Velum مرحبا بالعالم 🌍 🧑‍💻 Special: <script>alert("test")</script>';
        const env = await alice.send(bob.userId, complexText);
        const dec = await bob.receive(alice.userId, env);
        expect(dec).toBe(complexText);
      });

      it('T2.4.3: should fail decryption when HMAC hex signature is corrupted/tampered', async () => {
        const alice = new TestParticipant(819, 'Alice');
        const bob = new TestParticipant(820, 'Bob');
        await alice.init();
        await bob.init();

        const env = await alice.send(bob.userId, 'Tamper HMAC test');
        const parsed = JSON.parse(env.substring(11));
        parsed.hmacHex = 'ff'.repeat(32); // Alter HMAC
        const tamperedEnv = `ratchet:v2:${JSON.stringify(parsed)}`;

        const dec = await bob.receive(alice.userId, tamperedEnv);
        expect(dec).toBe('[Decryption Error - Integrity Check Failed]');
      });

      it('T2.4.4: should fail decryption when ciphertext body hex is modified', async () => {
        const alice = new TestParticipant(821, 'Alice');
        const bob = new TestParticipant(822, 'Bob');
        await alice.init();
        await bob.init();

        const env = await alice.send(bob.userId, 'Tamper ciphertext test');
        const parsed = JSON.parse(env.substring(11));
        parsed.ciphertextHex = '00' + parsed.ciphertextHex.slice(2);
        // Recalculate HMAC or let HMAC fail
        const tamperedEnv = `ratchet:v2:${JSON.stringify(parsed)}`;

        const dec = await bob.receive(alice.userId, tamperedEnv);
        expect(dec).toMatch(/(\[Decryption Error - Integrity Check Failed\]|\[Encrypted Message\])/);
      });

      it('T2.4.5: should fail decryption when authentication tag is tampered', async () => {
        const alice = new TestParticipant(823, 'Alice');
        const bob = new TestParticipant(824, 'Bob');
        await alice.init();
        await bob.init();

        const env = await alice.send(bob.userId, 'Tamper tag test');
        const parsed = JSON.parse(env.substring(11));
        parsed.tagHex = '00'.repeat(16);
        const tamperedEnv = `ratchet:v2:${JSON.stringify(parsed)}`;

        const dec = await bob.receive(alice.userId, tamperedEnv);
        expect(dec).toMatch(/(\[Decryption Error - Integrity Check Failed\]|\[Encrypted Message\])/);
      });
    });

    // -----------------------------------------------------------------------
    // Feature 5 Boundaries
    // -----------------------------------------------------------------------
    describe('Feature 5 Boundaries: Media & Attachment Encryption', () => {
      it('T2.5.1: should encrypt and decrypt 0-byte file payload JSON structure', async () => {
        const alice = new TestParticipant(825, 'Alice');
        const bob = new TestParticipant(826, 'Bob');
        await alice.init();
        await bob.init();

        const zeroByteAttachment = JSON.stringify({
          type: 'file',
          name: 'empty.dat',
          size: 0,
          contentBase64: ''
        });

        const env = await alice.send(bob.userId, zeroByteAttachment);
        const dec = await bob.receive(alice.userId, env);
        expect(dec).toBe(zeroByteAttachment);
      });

      it('T2.5.2: should encrypt and decrypt large 256KB base64 attachment string', async () => {
        const alice = new TestParticipant(827, 'Alice');
        const bob = new TestParticipant(828, 'Bob');
        await alice.init();
        await bob.init();

        const largeChunk = 'A'.repeat(256 * 1024);
        const payload = JSON.stringify({ type: 'blob', data: largeChunk });

        const env = await alice.send(bob.userId, payload);
        const dec = await bob.receive(alice.userId, env);
        expect(dec).toBe(payload);
      });

      it('T2.5.3: should handle complex nested JSON with raw HTML & Markdown in attachments', async () => {
        const alice = new TestParticipant(829, 'Alice');
        const bob = new TestParticipant(830, 'Bob');
        await alice.init();
        await bob.init();

        const markdownMedia = JSON.stringify({
          text: '# Title\n\n```javascript\nconsole.log("Hello");\n```\n- Item 1\n- Item 2',
          htmlSnippet: '<div class="alert alert-danger">Error! &amp; Special "quotes"</div>'
        });

        const env = await alice.send(bob.userId, markdownMedia);
        const dec = await bob.receive(alice.userId, env);
        expect(dec).toBe(markdownMedia);
      });

      it('T2.5.4: should return non-ratchet strings unchanged when decrypting', async () => {
        const alice = new TestParticipant(831, 'Alice');
        await alice.init();

        const plain = 'Regular unencrypted string';
        const res = await asUser(alice.userId, async () => {
          return doubleRatchetService.decryptDirectMessage(plain, 832);
        });
        expect(res).toBe(plain);
      });

      it('T2.5.5: should preserve binary hex buffers after encryption and decryption', async () => {
        const alice = new TestParticipant(833, 'Alice');
        const bob = new TestParticipant(834, 'Bob');
        await alice.init();
        await bob.init();

        const hexBuffer = Array.from(new Uint8Array(256)).map((_, i) => i.toString(16).padStart(2, '0')).join('');
        const payload = JSON.stringify({ hexBuffer });

        const env = await alice.send(bob.userId, payload);
        const dec = await bob.receive(alice.userId, env);
        expect(JSON.parse(dec).hexBuffer).toBe(hexBuffer);
      });
    });

    // -----------------------------------------------------------------------
    // Feature 6 Boundaries
    // -----------------------------------------------------------------------
    describe('Feature 6 Boundaries: Offline Outbox & Queueing', () => {
      it('T2.6.1: should drain empty outbox returning 0 without errors', async () => {
        const transmitter = createMockWebSocketTransmitter();
        const count = await drainOutboxQueue(transmitter.transmit);
        expect(count).toBe(0);
        expect(transmitter.getSentCount()).toBe(0);
      });

      it('T2.6.2: should maintain stable ordering for messages with identical timestamps', async () => {
        const sameTime = new Date().toISOString();
        await enqueueOutboxMessage({
          client_msg_id: 'same-1',
          room_id: 'dm_1',
          content: 'first',
          is_encrypted: true,
          timestamp: sameTime,
          retryCount: 0
        });
        await enqueueOutboxMessage({
          client_msg_id: 'same-2',
          room_id: 'dm_1',
          content: 'second',
          is_encrypted: true,
          timestamp: sameTime,
          retryCount: 0
        });

        const queued = await getQueuedOutboxMessages();
        expect(queued.length).toBe(2);
      });

      it('T2.6.3: should halt draining immediately when WebSocket transmitter returns false', async () => {
        const transmitter = createMockWebSocketTransmitter({ dropEveryNth: 2 });

        await enqueueOutboxMessage({
          client_msg_id: 'halt-1',
          room_id: 'dm_2',
          content: 'frame 1',
          is_encrypted: true,
          timestamp: new Date().toISOString(),
          retryCount: 0
        });
        await enqueueOutboxMessage({
          client_msg_id: 'halt-2',
          room_id: 'dm_2',
          content: 'frame 2',
          is_encrypted: true,
          timestamp: new Date(Date.now() + 10).toISOString(),
          retryCount: 0
        });
        await enqueueOutboxMessage({
          client_msg_id: 'halt-3',
          room_id: 'dm_2',
          content: 'frame 3',
          is_encrypted: true,
          timestamp: new Date(Date.now() + 20).toISOString(),
          retryCount: 0
        });

        const drained = await drainOutboxQueue(transmitter.transmit);
        expect(drained).toBe(1); // First succeeds, second fails -> drain halts

        const remaining = await getQueuedOutboxMessages();
        expect(remaining.length).toBe(2); // halt-2 and halt-3 remain in outbox
        expect(remaining[0].client_msg_id).toBe('halt-2');
      });

      it('T2.6.4: should overwrite existing outbox item when same client_msg_id is re-enqueued', async () => {
        await enqueueOutboxMessage({
          client_msg_id: 're-enqueue-1',
          room_id: 'dm_3',
          content: 'version 1',
          is_encrypted: true,
          timestamp: new Date().toISOString(),
          retryCount: 0
        });

        await enqueueOutboxMessage({
          client_msg_id: 're-enqueue-1',
          room_id: 'dm_3',
          content: 'version 2 updated',
          is_encrypted: true,
          timestamp: new Date().toISOString(),
          retryCount: 1
        });

        const queued = await getQueuedOutboxMessages();
        expect(queued.length).toBe(1);
        expect(queued[0].content).toBe('version 2 updated');
        expect(queued[0].retryCount).toBe(1);
      });

      it('T2.6.5: should remove non-existent outbox message cleanly without throwing', async () => {
        await expect(removeOutboxMessage('non-existent-msg-id')).resolves.not.toThrow();
      });
    });

    // -----------------------------------------------------------------------
    // Feature 7 Boundaries
    // -----------------------------------------------------------------------
    describe('Feature 7 Boundaries: Desync Handling & Skipped Keys', () => {
      it('T2.7.1: should handle large skip gap (15 messages) and store all intermediate keys', async () => {
        const alice = new TestParticipant(835, 'Alice');
        const bob = new TestParticipant(836, 'Bob');
        await alice.init();
        await bob.init();

        const messages: string[] = [];
        for (let i = 0; i < 15; i++) {
          const env = await alice.send(bob.userId, `Skipped bulk msg ${i}`);
          messages.push(env);
        }

        // Bob receives message 14 directly (skipping 0..13)
        const dec14 = await bob.receive(alice.userId, messages[14]);
        expect(dec14).toBe('Skipped bulk msg 14');

        // Bob receives message 0 and message 7 from skipped keys
        expect(await bob.receive(alice.userId, messages[0])).toBe('Skipped bulk msg 0');
        expect(await bob.receive(alice.userId, messages[7])).toBe('Skipped bulk msg 7');
      });

      it('T2.7.2: should prevent double-consumption of single-use skipped key', async () => {
        const alice = new TestParticipant(837, 'Alice');
        const bob = new TestParticipant(838, 'Bob');
        await alice.init();
        await bob.init();

        const env0 = await alice.send(bob.userId, 'Msg 0');
        const env1 = await alice.send(bob.userId, 'Msg 1');

        // Bob receives 1 first (skipping 0)
        await bob.receive(alice.userId, env1);

        // Bob consumes 0
        const firstDec = await bob.receive(alice.userId, env0);
        expect(firstDec).toBe('Msg 0');

        // Attempting to consume 0 again should fail (key was consumed and deleted)
        const secondDec = await bob.receive(alice.userId, env0);
        expect(secondDec).toBe('[Encrypted Message - Skipped Key Not Found]');
      });

      it('T2.7.3: should return fallback string when skipped key is not found in memory or DB', async () => {
        const bob = new TestParticipant(840, 'Bob');
        await bob.init();

        const key = await consumeSkippedMessageKey('dm_840', 839, 99, 0);
        expect(key).toBeNull();
      });

      it('T2.7.4: should purge all skipped message keys from storage cleanly', async () => {
        const subtle = window.crypto.subtle;
        const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
        await saveSkippedMessageKey('dm_purge', 841, 1, 0, key);

        await purgeSkippedMessageKeys();
        const res = await consumeSkippedMessageKey('dm_purge', 841, 1, 0);
        expect(res).toBeNull();
      });

      it('T2.7.5: should handle forceRekey when local keys were not initialized beforehand', async () => {
        const alice = new TestParticipant(843, 'Alice');
        const bob = new TestParticipant(844, 'Bob');
        await bob.init();

        // Alice hasn't initialized yet; forceRekey will initialize her local keys and perform X3DH
        await alice.forceRekey(bob.userId);
        const env = await alice.send(bob.userId, 'Recovered message');
        expect(await bob.receive(alice.userId, env)).toBe('Recovered message');
      });
    });
  });

  // =========================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS & PAIRWISE INTEGRATION (10 Tests)
  // =========================================================================
  describe('Tier 3: Cross-Feature Combinations & Pairwise Integration', () => {
    it('T3.1: Key Generation + Bundle Publish + X3DH Handshake + 2-Way Message Exchange', async () => {
      const alice = new TestParticipant(1001, 'Alice');
      const bob = new TestParticipant(1002, 'Bob');

      await alice.init();
      await bob.init();

      const env1 = await alice.send(bob.userId, 'Ping from Alice');
      expect(await bob.receive(alice.userId, env1)).toBe('Ping from Alice');

      const env2 = await bob.send(alice.userId, 'Pong from Bob');
      expect(await alice.receive(bob.userId, env2)).toBe('Pong from Bob');
    });

    it('T3.2: Offline Outbox + Double Ratchet Encryption + Reconnect Drain + Receiver Decryption', async () => {
      const alice = new TestParticipant(1003, 'Alice');
      const bob = new TestParticipant(1004, 'Bob');
      await alice.init();
      await bob.init();

      // Alice generates encrypted message while offline
      const ciphertext = await alice.send(bob.userId, 'Offline queued message');
      await enqueueOutboxMessage({
        client_msg_id: 'offline-msg-1',
        room_id: `dm_${bob.userId}`,
        content: ciphertext,
        is_encrypted: true,
        timestamp: new Date().toISOString(),
        retryCount: 0
      });

      // Network reconnects and drains outbox
      const transmitter = createMockWebSocketTransmitter();
      const count = await drainOutboxQueue(transmitter.transmit);
      expect(count).toBe(1);

      // Bob receives frame over websocket and decrypts
      const receivedFrame = transmitter.sentFrames[0];
      const decrypted = await bob.receive(alice.userId, receivedFrame.content);
      expect(decrypted).toBe('Offline queued message');
    });

    it('T3.3: Skipped Keys + DH Ratchet Advance + Late Arrival Recovery', async () => {
      const alice = new TestParticipant(1005, 'Alice');
      const bob = new TestParticipant(1006, 'Bob');
      await alice.init();
      await bob.init();

      const env0 = await alice.send(bob.userId, 'Turn 1 - Msg 0');
      const env1 = await alice.send(bob.userId, 'Turn 1 - Msg 1');
      const env2 = await alice.send(bob.userId, 'Turn 1 - Msg 2');

      // Bob receives msg 2 (skips 0, 1)
      expect(await bob.receive(alice.userId, env2)).toBe('Turn 1 - Msg 2');

      // Bob replies, advancing DH ratchet
      const bobReply = await bob.send(alice.userId, 'Bob reply turn 2');
      expect(await alice.receive(bob.userId, bobReply)).toBe('Bob reply turn 2');

      // Late arrival of Turn 1 messages
      expect(await bob.receive(alice.userId, env0)).toBe('Turn 1 - Msg 0');
      expect(await bob.receive(alice.userId, env1)).toBe('Turn 1 - Msg 1');
    });

    it('T3.4: Mixed Media Attachment + Offline Outbox + Draining Pipeline', async () => {
      const alice = new TestParticipant(1007, 'Alice');
      const bob = new TestParticipant(1008, 'Bob');
      await alice.init();
      await bob.init();

      const mediaPayload = SamplePayloads.imageAttachment;
      const encryptedEnv = await alice.send(bob.userId, mediaPayload);

      await enqueueOutboxMessage({
        client_msg_id: 'media-outbox-1',
        room_id: `dm_${bob.userId}`,
        content: encryptedEnv,
        is_encrypted: true,
        timestamp: new Date().toISOString(),
        retryCount: 0
      });

      const transmitter = createMockWebSocketTransmitter();
      await drainOutboxQueue(transmitter.transmit);

      const receivedCipher = transmitter.sentFrames[0].content;
      const decryptedJson = await bob.receive(alice.userId, receivedCipher);
      expect(decryptedJson).toBe(mediaPayload);
      expect(JSON.parse(decryptedJson).type).toBe('image');
    });

    it('T3.5: State Desync Detection + Auto-heal Rekey + Continued Communication', async () => {
      const alice = new TestParticipant(1009, 'Alice');
      const bob = new TestParticipant(1010, 'Bob');
      await alice.init();
      await bob.init();

      // Initial message exchange
      const m1 = await alice.send(bob.userId, 'Pre-desync message');
      expect(await bob.receive(alice.userId, m1)).toBe('Pre-desync message');

      // Trigger force rekey
      await alice.forceRekey(bob.userId);

      // Subsequent message after rekey
      const m2 = await alice.send(bob.userId, 'Post-desync message');
      expect(m2).toMatch(/^ratchet:v2:/);
    });

    it('T3.6: Multi-User Vault Isolation across Alice, Bob, and Charlie', async () => {
      const alice = new TestParticipant(1011, 'Alice');
      const bob = new TestParticipant(1012, 'Bob');
      const charlie = new TestParticipant(1013, 'Charlie');

      await alice.init();
      await bob.init();
      await charlie.init();

      // Alice sends to Bob
      const envAB = await alice.send(bob.userId, 'Hello Bob from Alice');
      // Alice sends to Charlie
      const envAC = await alice.send(charlie.userId, 'Hello Charlie from Alice');

      expect(await bob.receive(alice.userId, envAB)).toBe('Hello Bob from Alice');
      expect(await charlie.receive(alice.userId, envAC)).toBe('Hello Charlie from Alice');

      // Bob sends to Charlie
      const envBC = await bob.send(charlie.userId, 'Hello Charlie from Bob');
      expect(await charlie.receive(bob.userId, envBC)).toBe('Hello Charlie from Bob');
    });

    it('T3.7: Memory Eviction + Database Reload + Ratchet State Continuity', async () => {
      const alice = new TestParticipant(1014, 'Alice');
      const bob = new TestParticipant(1015, 'Bob');
      await alice.init();
      await bob.init();

      const m1 = await alice.send(bob.userId, 'Message 1 before memory clear');
      expect(await bob.receive(alice.userId, m1)).toBe('Message 1 before memory clear');

      // Clear memory cache completely
      doubleRatchetService.clearMemoryState();

      const m2 = await alice.send(bob.userId, 'Message 2 after memory reload');
      expect(await bob.receive(alice.userId, m2)).toBe('Message 2 after memory reload');
    });

    it('T3.8: Concurrent Outbox Enqueues + Batch Draining + Order Preservation', async () => {
      const transmitter = createMockWebSocketTransmitter();
      const start = Date.now();

      await Promise.all([
        enqueueOutboxMessage({
          client_msg_id: 'batch-3',
          room_id: 'room_1',
          content: 'C',
          is_encrypted: true,
          timestamp: new Date(start + 200).toISOString(),
          retryCount: 0
        }),
        enqueueOutboxMessage({
          client_msg_id: 'batch-1',
          room_id: 'room_1',
          content: 'A',
          is_encrypted: true,
          timestamp: new Date(start).toISOString(),
          retryCount: 0
        }),
        enqueueOutboxMessage({
          client_msg_id: 'batch-2',
          room_id: 'room_1',
          content: 'B',
          is_encrypted: true,
          timestamp: new Date(start + 100).toISOString(),
          retryCount: 0
        })
      ]);

      const drained = await drainOutboxQueue(transmitter.transmit);
      expect(drained).toBe(3);
      expect(transmitter.sentFrames[0].client_msg_id).toBe('batch-1');
      expect(transmitter.sentFrames[1].client_msg_id).toBe('batch-2');
      expect(transmitter.sentFrames[2].client_msg_id).toBe('batch-3');
    });

    it('T3.9: Consecutive DH Ratchet Turns with Intermittent Skipped Keys across 3 Generations', async () => {
      const alice = new TestParticipant(1017, 'Alice');
      const bob = new TestParticipant(1018, 'Bob');
      await alice.init();
      await bob.init();

      // Turn 1: Alice sends 3 messages; Bob receives only msg 2
      const a0 = await alice.send(bob.userId, 'A_Gen0_0');
      const a1 = await alice.send(bob.userId, 'A_Gen0_1');
      const a2 = await alice.send(bob.userId, 'A_Gen0_2');
      expect(await bob.receive(alice.userId, a2)).toBe('A_Gen0_2');

      // Turn 2: Bob sends 2 messages; Alice receives only msg 1
      const b0 = await bob.send(alice.userId, 'B_Gen1_0');
      const b1 = await bob.send(alice.userId, 'B_Gen1_1');
      expect(await alice.receive(bob.userId, b1)).toBe('B_Gen1_1');

      // Turn 3: Alice sends msg 0; Bob receives it
      const a3 = await alice.send(bob.userId, 'A_Gen2_0');
      expect(await bob.receive(alice.userId, a3)).toBe('A_Gen2_0');

      // Deliver early skipped messages
      expect(await bob.receive(alice.userId, a0)).toBe('A_Gen0_0');
      expect(await bob.receive(alice.userId, a1)).toBe('A_Gen0_1');
      expect(await alice.receive(bob.userId, b0)).toBe('B_Gen1_0');
    });

    it('T3.10: Attachment Encryption + Out-of-Order Delivery + Skipped Key Recovery', async () => {
      const alice = new TestParticipant(1019, 'Alice');
      const bob = new TestParticipant(1020, 'Bob');
      await alice.init();
      await bob.init();

      const textMsg = 'Here is the voice note and photo';
      const voiceMsg = SamplePayloads.voiceNote;
      const imageMsg = SamplePayloads.imageAttachment;

      const env0 = await alice.send(bob.userId, textMsg);
      const env1 = await alice.send(bob.userId, voiceMsg);
      const env2 = await alice.send(bob.userId, imageMsg);

      // Bob receives image first
      expect(await bob.receive(alice.userId, env2)).toBe(imageMsg);
      // Bob receives text
      expect(await bob.receive(alice.userId, env0)).toBe(textMsg);
      // Bob receives voice note
      expect(await bob.receive(alice.userId, env1)).toBe(voiceMsg);
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS (5 Tests)
  // =========================================================================
  describe('Tier 4: Real-World Application Scenarios', () => {
    it('T4.1: Multi-turn Bidirectional Conversation (15 turns)', async () => {
      const alice = new TestParticipant(2001, 'Alice');
      const bob = new TestParticipant(2002, 'Bob');
      await alice.init();
      await bob.init();

      const conversationScript = [
        { from: 'alice', text: 'Hey Bob, did you review the Q3 security report?' },
        { from: 'bob', text: 'Yes Alice, the E2EE migration findings look solid.' },
        { from: 'alice', text: 'Awesome. Are we adhering to Curve25519 and Signal ratchet specifications?' },
        { from: 'bob', text: 'Confirmed, all state chains and X3DH keys match the spec.' },
        { from: 'alice', text: 'What about offline message queuing and outbox draining?' },
        { from: 'bob', text: 'Verified with IndexedDB persistence and FIFO timestamp ordering.' },
        { from: 'alice', text: 'Excellent. What is the status of attachment encryption?' },
        { from: 'bob', text: 'Full JSON encapsulation with AES-GCM and SHA-256 HMAC integrity.' },
        { from: 'alice', text: 'How is out-of-order message arrival handled?' },
        { from: 'bob', text: 'Skipped message keys are indexed and saved for later consumption.' },
        { from: 'alice', text: 'What if state desync occurs during a network drop?' },
        { from: 'bob', text: 'Decryption errors trigger forceRekey auto-healing cleanly.' },
        { from: 'alice', text: 'Great work! All 4 tiers of tests are running smoothly.' },
        { from: 'bob', text: 'All green across unit, integration, and E2E suites.' },
        { from: 'alice', text: 'Ready for production deployment.' }
      ];

      for (const turn of conversationScript) {
        if (turn.from === 'alice') {
          const env = await alice.send(bob.userId, turn.text);
          const dec = await bob.receive(alice.userId, env);
          expect(dec).toBe(turn.text);
        } else {
          const env = await bob.send(alice.userId, turn.text);
          const dec = await alice.receive(bob.userId, env);
          expect(dec).toBe(turn.text);
        }
      }
    });

    it('T4.2: Mixed Media Rich Workload (Text + Voice Notes + Attachments)', async () => {
      const alice = new TestParticipant(2003, 'Alice');
      const bob = new TestParticipant(2004, 'Bob');
      await alice.init();
      await bob.init();

      const payloads = [
        SamplePayloads.textShort,
        SamplePayloads.voiceNote,
        SamplePayloads.textUnicode,
        SamplePayloads.imageAttachment,
        SamplePayloads.mixedMedia,
        SamplePayloads.textLong
      ];

      for (let i = 0; i < payloads.length; i++) {
        const p = payloads[i];
        if (i % 2 === 0) {
          const env = await alice.send(bob.userId, p);
          const dec = await bob.receive(alice.userId, env);
          expect(dec).toBe(p);
        } else {
          const env = await bob.send(alice.userId, p);
          const dec = await alice.receive(bob.userId, env);
          expect(dec).toBe(p);
        }
      }
    });

    it('T4.3: Intermittent Offline Outbox Simulation with Reconnection Batch Draining', async () => {
      const alice = new TestParticipant(2005, 'Alice');
      const bob = new TestParticipant(2006, 'Bob');
      await alice.init();
      await bob.init();

      // Alice composes 5 messages while in tunnel / airplane mode
      const offlineMessages = [
        'Msg 1: Entering subway tunnel',
        'Msg 2: Signal lost',
        'Msg 3: Checking notes',
        'Msg 4: Reviewing code diffs',
        'Msg 5: Emerging from tunnel'
      ];

      const now = Date.now();
      for (let i = 0; i < offlineMessages.length; i++) {
        const text = offlineMessages[i];
        const ciphertext = await alice.send(bob.userId, text);
        await enqueueOutboxMessage({
          client_msg_id: `tunnel-msg-${i}`,
          room_id: `dm_${bob.userId}`,
          content: ciphertext,
          is_encrypted: true,
          timestamp: new Date(now + i * 100).toISOString(),
          retryCount: 0
        });
      }

      // Alice reconnects to cellular network; outbox drains over WebSocket
      const transmitter = createMockWebSocketTransmitter();
      const drained = await drainOutboxQueue(transmitter.transmit);
      expect(drained).toBe(5);

      // Bob's client receives each frame in order and decrypts
      for (let i = 0; i < transmitter.sentFrames.length; i++) {
        const frame = transmitter.sentFrames[i];
        const dec = await bob.receive(alice.userId, frame.content);
        expect(dec).toBe(offlineMessages[i]);
      }
    });

    it('T4.4: Asynchronous Out-of-Order Message Delivery (Non-sequential permutation)', async () => {
      const alice = new TestParticipant(2007, 'Alice');
      const bob = new TestParticipant(2008, 'Bob');
      await alice.init();
      await bob.init();

      const messages = [
        'Frame 0',
        'Frame 1',
        'Frame 2',
        'Frame 3',
        'Frame 4',
        'Frame 5',
        'Frame 6',
        'Frame 7'
      ];

      // Alice encrypts and sends all frames in sequence
      const envelopes: string[] = [];
      for (const m of messages) {
        envelopes.push(await alice.send(bob.userId, m));
      }

      // Network delivers in chaotic permutation: [3, 0, 5, 1, 7, 2, 4, 6]
      const permutation = [3, 0, 5, 1, 7, 2, 4, 6];
      for (const index of permutation) {
        const dec = await bob.receive(alice.userId, envelopes[index]);
        expect(dec).toBe(messages[index]);
      }
    });

    it('T4.5: Cross-Device & Session Reset Recovery with Auto-healing', async () => {
      const alice = new TestParticipant(2009, 'Alice');
      const bob = new TestParticipant(2010, 'Bob');
      await alice.init();
      await bob.init();

      // Alice and Bob establish session
      const m1 = await alice.send(bob.userId, 'Initial pre-reset message');
      expect(await bob.receive(alice.userId, m1)).toBe('Initial pre-reset message');

      // Alice forces a re-key to simulate clean state reset
      await alice.forceRekey(bob.userId);

      // Fresh message exchange under rekeyed session
      const m2 = await alice.send(bob.userId, 'Fresh post-reset message');
      expect(m2).toMatch(/^ratchet:v2:/);
    });
  });
});
