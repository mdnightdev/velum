import { LocalVaultEncryption } from '../services/localVaultEncryption';
const DB_NAME = 'velum_local_storage';
const DB_VERSION = 26;
const STORE_MEDIA = 'media_blobs';
const STORE_MESSAGES = 'messages';
const STORE_OUTBOX = 'outbox_messages';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported on this platform.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open local storage database.'));
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        db.createObjectStore(STORE_MEDIA);
      }
     if (db.objectStoreNames.contains(STORE_MESSAGES)) {
  db.deleteObjectStore(STORE_MESSAGES);
}
const msgStore = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
msgStore.createIndex('loungeId', 'loungeId', { unique: false });
msgStore.createIndex('lounge_time', ['loungeId', 'timestamp'], { unique: false });
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        db.createObjectStore(STORE_OUTBOX, { keyPath: 'client_msg_id' });
      }
    };
  });
}

/**
 * Saves or updates messages in IndexedDB individually without loading the whole array.
 */
export async function saveLocalMessages(messages: any[]): Promise<void> {
  if (!messages || messages.length === 0) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction= db.transaction([STORE_MESSAGES], 'readwrite');
    const store = transaction.objectStore(STORE_MESSAGES);

    for (const msg of messages) {
      store.put(msg);
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('Failed to save messages to local storage'));
  });
}

/**
 * Retrieves the most recent messages for a lounge using the compound index.
 */
export async function getLocalMessages(loungeId: string, limit = 50): Promise<any[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_MESSAGES], 'readonly');
      const store = transaction.objectStore(STORE_MESSAGES);
      const index = store.index('lounge_time');
      
      // Query all messages matching loungeId across any timestamp
      const range = IDBKeyRange.bound([loungeId, -Infinity], [loungeId, Infinity]);
      const request = index.openCursor(range, 'prev'); // Most recent first
      
      const results: any[] = [];
      request.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results.reverse()); // Chronological order
        }
      };
      request.onerror = () => reject(new Error(`Failed to load messages for lounge: ${loungeId}`));
    });
  } catch (err) {
    console.error('getLocalMessages error:', err);
    return [];
  }
}

/**
 * Saves a binary Blob locally in IndexedDB under a unique key.
 */
export async function saveLocalMedia(key: string, blob: Blob): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_MEDIA], 'readwrite');
    const store = transaction.objectStore(STORE_MEDIA);
    const request = store.put(blob, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to save local media asset: ${key}`));
  });
}

/**
 * Retrieves a binary Blob from IndexedDB. Returns null if not found.
 */
export async function getLocalMedia(key: string): Promise<Blob | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_MEDIA], 'readonly');
      const store = transaction.objectStore(STORE_MEDIA);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(`Failed to retrieve local media asset: ${key}`));
    });
  } catch (err) {
    console.warn('[IndexedDB] Local database is unavailable:', err);
    return null;
  }
}

/**
 * Deletes a binary Blob from IndexedDB.
 */
export async function deleteLocalMedia(key: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_MEDIA], 'readwrite');
      const store = transaction.objectStore(STORE_MEDIA);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete local media asset: ${key}`));
    });
  } catch (err) {
    console.warn('[IndexedDB] Local database deletion failed:', err);
  }
}

export async function rotateAndReEncryptLocalMessages(): Promise<void> {
  try {
    const db = await openDatabase();
    const allRecords = await new Promise<{ key: IDBValidKey, value: any }[]>((resolve, reject) => {
      const tx = db.transaction([STORE_MESSAGES], 'readonly');
      const store = tx.objectStore(STORE_MESSAGES);
      const req = store.getAll();
      const keysReq = store.getAllKeys();
      
      req.onsuccess = () => {
        keysReq.onsuccess = () => {
          const records = keysReq.result.map((key, i) => ({ key, value: req.result[i] }));
          resolve(records);
        };
      };
      req.onerror = () => reject(new Error('Failed to fetch messages for re-encryption'));
    });

    const decryptedData = [];
    // Decrypt all possible records with the current key
    for (const record of allRecords) {
      if (record.value._encrypted) {
        const str = await LocalVaultEncryption.decryptPayload(record.value);
        if (str) {
          decryptedData.push({ key: record.key, plaintext: str });
        }
      } else if (Array.isArray(record.value)) {
        decryptedData.push({ key: record.key, plaintext: JSON.stringify(record.value) });
      }
    }

    // Now rotate the key
    await LocalVaultEncryption.rotateVaultKey();

    // Re-encrypt and overwrite
    const tx = db.transaction([STORE_MESSAGES], 'readwrite');
    const store = tx.objectStore(STORE_MESSAGES);

    for (const data of decryptedData) {
      const encrypted = await LocalVaultEncryption.encryptPayload(data.plaintext);
      store.put({ _encrypted: true, ...encrypted }, data.key);
    }
    
    // We can also return a promise for the transaction completion if needed.
  } catch (err) {
    console.error('[IndexedDB] Failed to rotate and re-encrypt local messages', err);
  }
}


export function purgeLocalMessages(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDatabase();
      const tx = db.transaction([STORE_MESSAGES, STORE_MEDIA], 'readwrite');
      const storeMsgs = tx.objectStore(STORE_MESSAGES);
      const storeMedia = tx.objectStore(STORE_MEDIA);
      storeMsgs.clear();
      storeMedia.clear();
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (e) {
      reject(e);
    }
  });
}
