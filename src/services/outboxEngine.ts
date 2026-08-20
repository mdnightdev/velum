const DB_NAME = 'velum_local_storage';
const DB_VERSION = 26;
const STORE_OUTBOX = 'outbox_messages';

export interface OutboxPayload {
  client_msg_id: string;
  room_id: string;
  content: string;
  is_encrypted: boolean;
  expires_in?: number | null;
  reply_to?: string | number | null;
  timestamp: string | number;
  retryCount: number;
}

function openOutboxDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(new Error('Failed to open outbox database.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('media_blobs')) {
        db.createObjectStore('media_blobs');
      }
      if (!db.objectStoreNames.contains('messages')) {
        db.createObjectStore('messages');
      }
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        db.createObjectStore(STORE_OUTBOX, { keyPath: 'client_msg_id' });
      }
    };
  });
}

/**
 * Enqueue an outgoing message frame into the offline persistent outbox
 */
export async function enqueueOutboxMessage(payload: OutboxPayload): Promise<void> {
  try {
    const db = await openOutboxDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_OUTBOX], 'readwrite');
      const store = tx.objectStore(STORE_OUTBOX);
      const req = store.put(payload);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error(`Failed to enqueue outbox message ${payload.client_msg_id}`));
    });
  } catch (err) {
    console.warn('[OUTBOX] Failed to enqueue message:', err);
  }
}

/**
 * Get all queued pending outbox messages sorted by timestamp
 */
export async function getQueuedOutboxMessages(): Promise<OutboxPayload[]> {
  try {
    const db = await openOutboxDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_OUTBOX], 'readonly');
      const store = tx.objectStore(STORE_OUTBOX);
      const req = store.getAll();
      req.onsuccess = () => {
        const items: OutboxPayload[] = req.result || [];
        items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        resolve(items);
      };
      req.onerror = () => reject(new Error('Failed to read outbox messages'));
    });
  } catch (err) {
    console.warn('[OUTBOX] Failed to read outbox:', err);
    return [];
  }
}

/**
 * Remove an acknowledged or sent message from the outbox queue
 */
export async function removeOutboxMessage(clientMsgId: string): Promise<void> {
  try {
    const db = await openOutboxDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_OUTBOX], 'readwrite');
      const store = tx.objectStore(STORE_OUTBOX);
      const req = store.delete(clientMsgId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error(`Failed to remove outbox item ${clientMsgId}`));
    });
  } catch (err) {
    console.warn('[OUTBOX] Failed to remove outbox message:', err);
  }
}

/**
 * Drains and re-transmits outbox messages sequentially over an active WebSocket connection
 */
export async function drainOutboxQueue(sendWebSocketFrame: (payload: OutboxPayload) => boolean): Promise<number> {
  const pending = await getQueuedOutboxMessages();
  if (pending.length === 0) return 0;

  let drainedCount = 0;
  for (const item of pending) {
    const success = sendWebSocketFrame(item);
    if (success) {
      await removeOutboxMessage(item.client_msg_id);
      drainedCount++;
    } else {
      break; // Socket unable to send, stop draining
    }
  }

  return drainedCount;
}
