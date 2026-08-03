const DB_NAME = 'velum_local_storage';
const DB_VERSION = 1;
const STORE_NAME = 'media_blobs';

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
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Saves a binary Blob locally in IndexedDB under a unique key.
 */
export async function saveLocalMedia(key: string, blob: Blob): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(blob, key);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Failed to save local media asset: ${key}`));
    };
  });
}

/**
 * Retrieves a binary Blob from IndexedDB. Returns null if not found.
 */
export async function getLocalMedia(key: string): Promise<Blob | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error(`Failed to retrieve local media asset: ${key}`));
      };
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
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete local media asset: ${key}`));
      };
    });
  } catch (err) {
    console.warn('[IndexedDB] Local database deletion failed:', err);
  }
}
