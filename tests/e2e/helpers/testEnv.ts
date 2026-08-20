/**
 * E2E Test Environment & Signal Protocol Test Harness
 * Sets up WebCrypto, in-memory IndexedDB, sessionStorage, and Mock Prekey Vault backend.
 */

import { MockIndexedDBFactory } from './mockIndexedDB';
import { statelessE2eeService } from '../../../src/services/statelessE2eeService';
import { purgeCryptoVault, closeCryptoDatabase } from '../../../src/services/cryptoDbStore';
import { OutboxPayload } from '../../../src/services/outboxEngine';

export interface MockPrekeyBundle {
  userId: number;
  identityKey: string;
  signedPrekey: string;
  signedPrekeySignature: string;
  oneTimePrekeys: string[];
}

export class MockPrekeyVaultServer {
  private bundles: Map<number, MockPrekeyBundle> = new Map();

  registerBundle(userId: number, bundle: Omit<MockPrekeyBundle, 'userId'>): void {
    this.bundles.set(userId, { userId, ...bundle });
  }

  getBundle(userId: number): MockPrekeyBundle | null {
    const bundle = this.bundles.get(userId);
    if (!bundle) return null;
    return structuredClone(bundle);
  }

  hasBundle(userId: number): boolean {
    return this.bundles.has(userId);
  }

  deleteBundle(userId: number): void {
    this.bundles.delete(userId);
  }

  clear(): void {
    this.bundles.clear();
  }
}

class MockStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] || null;
  }
}

export const mockServerVault = new MockPrekeyVaultServer();
let mockIdbFactory: MockIndexedDBFactory;

export function setupTestCryptoEnvironment(): void {
  // Polyfill window and WebCrypto
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = globalThis;
  }

  if (!globalThis.window.crypto) {
    globalThis.window.crypto = (globalThis as any).crypto;
  }

  // Ensure subtle is available in global scope for direct subtle references
  (globalThis as any).subtle = globalThis.crypto?.subtle || globalThis.window.crypto?.subtle;
  (globalThis.window as any).subtle = (globalThis as any).subtle;

  mockIdbFactory = new MockIndexedDBFactory();
  globalThis.window.indexedDB = mockIdbFactory as any;
  (globalThis as any).indexedDB = mockIdbFactory as any;

  const sessionStorage = new MockStorage();
  const localStorage = new MockStorage();
  globalThis.window.sessionStorage = sessionStorage as any;
  globalThis.window.localStorage = localStorage as any;
  (globalThis as any).sessionStorage = sessionStorage as any;
  (globalThis as any).localStorage = localStorage as any;

  // Mock fetch to route prekey bundle requests to mockServerVault
  globalThis.window.fetch = (async (url: string | URL, options?: RequestInit): Promise<Response> => {
    const urlStr = url.toString();

    // POST /v2/user/keys/prekey-bundle
    if (urlStr.includes('/v2/user/keys/prekey-bundle') && options?.method === 'POST') {
      const auth = (options.headers as any)?.Authorization || (options.headers as any)?.authorization || '';
      let userId = 1;
      if (auth.startsWith('Bearer user_')) {
        userId = parseInt(auth.replace('Bearer user_', ''), 10) || 1;
      }
      const body = JSON.parse(options.body as string);
      mockServerVault.registerBundle(userId, body);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // GET /v2/user/:userId/prekey-bundle
    const getMatch = urlStr.match(/\/v2\/user\/(\d+)\/prekey-bundle/);
    if (getMatch) {
      const requestedUserId = parseInt(getMatch[1], 10);
      const bundle = mockServerVault.getBundle(requestedUserId);
      if (!bundle) {
        return new Response(JSON.stringify({ error: 'Prekey bundle not found' }), { status: 404 });
      }
      return new Response(JSON.stringify(bundle), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({}), { status: 200 });
  }) as any;
}

export async function resetTestCryptoEnvironment(): Promise<void> {
  await closeCryptoDatabase();
  statelessE2eeService.clearCache();
  await purgeCryptoVault();
  mockServerVault.clear();
  if (mockIdbFactory) {
    mockIdbFactory._clearAll();
  }
}

/**
 * Execute an action in the isolated context of a specific user.
 * Loads their distinct keys, sets their sessionId, and manages memory state.
 */
export async function asUser<T>(userId: number, action: () => Promise<T>): Promise<T> {
  // Flush previous state
  await closeCryptoDatabase();
  statelessE2eeService.clearCache();

  // Set session ID header for fetch
  window.sessionStorage.setItem('velum-sessionId', `user_${userId}`);
  statelessE2eeService.setLocalUserId(userId);

  // Initialize/load user's keys from DB and publish bundle
  await statelessE2eeService.initLocalIdentityKeys(userId);

  const result = await action();

  // Flush any queued state changes
  await closeCryptoDatabase();
  return result;
}

/**
 * High-level Actor simulation helper for multi-party tests
 */
export class TestParticipant {
  constructor(public userId: number, public name: string) {}

  async init(): Promise<void> {
    await asUser(this.userId, async () => {
      // Keys initialized and uploaded
    });
  }

  async send(recipientId: number, text: string): Promise<string> {
    return asUser(this.userId, async () => {
      return statelessE2eeService.encryptDirectMessage(text, recipientId);
    });
  }

  async receive(senderId: number, envelope: string): Promise<string> {
    return asUser(this.userId, async () => {
      return statelessE2eeService.decryptDirectMessage(envelope);
    });
  }

  async forceRekey(peerId: number): Promise<void> {
    statelessE2eeService.clearCache();
  }
}

/**
 * Create a mock Outbox WebSocket transmitter
 */
export function createMockWebSocketTransmitter(options?: { shouldFail?: boolean; dropEveryNth?: number }) {
  const sentFrames: OutboxPayload[] = [];
  let frameCounter = 0;

  const transmit = (payload: OutboxPayload): boolean => {
    frameCounter++;
    if (options?.shouldFail) return false;
    if (options?.dropEveryNth && frameCounter % options.dropEveryNth === 0) return false;
    sentFrames.push(structuredClone(payload));
    return true;
  };

  return {
    transmit,
    sentFrames,
    getSentCount: () => sentFrames.length,
    reset: () => { sentFrames.length = 0; frameCounter = 0; }
  };
}

/**
 * Generates sample attachments and payloads for testing
 */
export const SamplePayloads = {
  textShort: 'Hello Alice, how are you?',
  textLong: 'A'.repeat(4096),
  textUnicode: '🔒 Velum E2EE 🔑 こんにちは мир 🚀 🛡️ Special: <>&"\'`',
  voiceNote: JSON.stringify({
    type: 'voice',
    durationMs: 4200,
    mimeType: 'audio/webm;codecs=opus',
    waveform: [0.1, 0.4, 0.8, 0.9, 0.6, 0.2, 0.0],
    dataBase64: 'GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH///+W'
  }),
  imageAttachment: JSON.stringify({
    type: 'image',
    fileName: 'screenshot_2026_08_15.png',
    fileSize: 1048576,
    dimensions: { width: 1920, height: 1080 },
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    thumbnailBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  }),
  mixedMedia: JSON.stringify({
    type: 'mixed',
    text: 'Check out this document and voice note',
    attachments: [
      { id: 'att-1', name: 'contract.pdf', size: 524288, hash: 'a1b2c3d4e5' },
      { id: 'att-2', name: 'recording.opus', duration: 15, hash: 'f6e7d8c9b0' }
    ]
  })
};
