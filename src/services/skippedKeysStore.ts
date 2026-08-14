const DB_NAME = 'velum_crypto_vault';
const DB_VERSION = 1;
const STORE_SKIPPED_KEYS = 'skipped_message_keys';

// In-memory fallback if IndexedDB is blocked or unavailable
const memoryFallbackMap = new Map<string, SkippedMessageKeyRecord>();

export interface SkippedMessageKeyRecord {
  roomId: string;
  senderUserId: number;
  messageIndex: number;
  chainLength: number;
  keyJwk: string; // Serialized CryptoKey in JWK format
  createdAt: string;
}

function openCryptoDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is unavailable.'));
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(new Error('Failed to open crypto vault IndexedDB database.'));
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_SKIPPED_KEYS)) {
          db.createObjectStore(STORE_SKIPPED_KEYS, { keyPath: 'id' });
        }
      };
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Save a skipped message decryption key to IndexedDB (or in-memory) for late out-of-order message arrival
 */
export async function saveSkippedMessageKey(
  roomId: string,
  senderUserId: number,
  messageIndex: number,
  chainLength: number,
  key: CryptoKey
): Promise<void> {
  const id = `${roomId}:${senderUserId}:${chainLength}:${messageIndex}`;
  try {
    const subtle = window.crypto.subtle;
    const jwk = await subtle.exportKey('jwk', key);

    const record: SkippedMessageKeyRecord & { id: string } = {
      id,
      roomId,
      senderUserId,
      messageIndex,
      chainLength,
      keyJwk: JSON.stringify(jwk),
      createdAt: new Date().toISOString()
    };

    memoryFallbackMap.set(id, record);

    const db = await openCryptoDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SKIPPED_KEYS], 'readwrite');
      const store = tx.objectStore(STORE_SKIPPED_KEYS);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error(`Failed to store skipped key for ${id}`));
    });
  } catch (err) {
    console.warn('[SKIPPED_KEYS_STORE] Using memory fallback for key save:', id);
  }
}

/**
 * Retrieve and consume (delete) a skipped message key for decrypting an out-of-order message frame
 */
export async function consumeSkippedMessageKey(
  roomId: string,
  senderUserId: number,
  messageIndex: number,
  chainLength: number
): Promise<CryptoKey | null> {
  const id = `${roomId}:${senderUserId}:${chainLength}:${messageIndex}`;
  try {
    let record: SkippedMessageKeyRecord | null = null;

    try {
      const db = await openCryptoDatabase();
      record = await new Promise<SkippedMessageKeyRecord | null>((resolve, reject) => {
        const tx = db.transaction([STORE_SKIPPED_KEYS], 'readonly');
        const store = tx.objectStore(STORE_SKIPPED_KEYS);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(new Error(`Failed to read skipped key ${id}`));
      });

      if (record) {
        // Delete once consumed (single use key)
        const tx = db.transaction([STORE_SKIPPED_KEYS], 'readwrite');
        tx.objectStore(STORE_SKIPPED_KEYS).delete(id);
      }
    } catch (dbErr) {
      // Fallback to memory store
      record = memoryFallbackMap.get(id) || null;
    }

    if (!record) {
      record = memoryFallbackMap.get(id) || null;
    }

    memoryFallbackMap.delete(id);

    if (!record) return null;

    const subtle = window.crypto.subtle;
    const jwk = JSON.parse(record.keyJwk);
    return await subtle.importKey(
      'jwk',
      jwk,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  } catch (err) {
    console.error('[SKIPPED_KEYS_STORE] Error consuming skipped key:', err);
    return null;
  }
}

export async function clearSkippedKeysForPeer(peerUserId: number): Promise<void> {
  const prefix = `dm_${peerUserId}_`;
  for (const key of memoryFallbackMap.keys()) {
    if (key.startsWith(prefix)) {
      memoryFallbackMap.delete(key);
    }
  }

  try {
    const db = await openCryptoDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SKIPPED_KEYS], 'readwrite');
      const store = tx.objectStore(STORE_SKIPPED_KEYS);
      const req = store.openCursor();
      req.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor) {
          const key = cursor.key as string;
          if (key.startsWith(prefix)) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
      req.onerror = () => {
        resolve(); // resolve on error instead of throwing to prevent crashing the flow
      };
      tx.oncomplete = () => resolve();
    });
  } catch (err) {
    console.error('[SKIPPED_KEYS_STORE] Error clearing skipped keys for peer:', err);
  }
}

/**
 * Purges all local skipped keys from storage (e.g., during duress or logout)
 */
export async function purgeSkippedMessageKeys(): Promise<void> {
  memoryFallbackMap.clear();
  try {
    const db = await openCryptoDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SKIPPED_KEYS], 'readwrite');
      const store = tx.objectStore(STORE_SKIPPED_KEYS);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('Failed to purge skipped key vault.'));
    });
  } catch (err) {
    console.error('[SKIPPED_KEYS_STORE] Error purging skipped keys:', err);
  }
}
