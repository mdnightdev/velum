const DB_NAME = 'velum_local_storage';
const DB_VERSION = 3;
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
      resolve(request.result);
    };

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        db.createObjectStore(STORE_MEDIA);
      }
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        db.createObjectStore(STORE_MESSAGES);
      }
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        db.createObjectStore(STORE_OUTBOX, { keyPath: 'client_msg_id' });
      }
    };
  });
}

/**
 * Saves messages array for a specific lounge/room in IndexedDB.
 */
export async function saveLocalMessages(loungeId: string, messages: any[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_MESSAGES], 'readwrite');
    const store = transaction.objectStore(STORE_MESSAGES);
    const request = store.put(messages, loungeId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to save cached messages for lounge: ${loungeId}`));
  });
}

/**
 * Retrieves cached messages for a lounge from IndexedDB.
 */
export async function getLocalMessages(loungeId: string): Promise<any[] | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_MESSAGES], 'readonly');
      const store = transaction.objectStore(STORE_MESSAGES);
      const request = store.get(loungeId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(`Failed to get cached messages for lounge: ${loungeId}`));
    });
  } catch (err) {
    console.warn('[IndexedDB] Local database is unavailable:', err);
    return null;
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
