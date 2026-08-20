import { LocalVaultEncryption } from '../services/localVaultEncryption';
import {
  openCryptoDatabase,
  purgeCryptoDatabase,
  STORE_MESSAGES,
  STORE_MEDIA,
  STORE_OUTBOX,
  STORE_USER_KV
} from '../services/cryptoDbStore';

const MAX_MESSAGE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours TTL

/**
 * Saves or updates messages in user-isolated IndexedDB and prunes stale records.
 */
export async function saveLocalMessages(messages: any[], userId?: number): Promise<void> {
  if (!messages || messages.length === 0) return;
  try {
    const db = await openCryptoDatabase(userId || 0);
    const tx = db.transaction(STORE_MESSAGES, 'readwrite');
    const now = Date.now();

    for (const msg of messages) {
      if (!msg) continue;
      const id = msg.id ?? msg.message_id ?? msg.client_msg_id ?? msg.messageId ?? msg.nonce ?? `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const loungeId = msg.loungeId ?? msg.room_id ?? msg.roomId ?? '';
      const rawTime = msg.timestamp ?? msg.createdAt ?? new Date().toISOString();
      const msgTime = new Date(rawTime).getTime();

      // Skip messages older than TTL
      if (!isNaN(msgTime) && (now - msgTime) > MAX_MESSAGE_AGE_MS) {
        continue;
      }

      const record = {
        ...msg,
        id: String(id),
        loungeId,
        timestamp: rawTime
      };
      await tx.store.put(record);
    }

    await tx.done;
  } catch (err) {
    console.warn('[IndexedDB] saveLocalMessages error:', err);
  }
}

/**
 * Retrieves the most recent messages for a room from the user's isolated store.
 */
export async function getLocalMessages(loungeId: string, limit = 100, userId?: number): Promise<any[]> {
  try {
    const db = await openCryptoDatabase(userId || 0);
    const now = Date.now();
    const all: any[] = await db.getAllFromIndex(STORE_MESSAGES, 'loungeId', loungeId);
    
    const valid = all
      .filter((m) => {
        const matchesRoom = m.loungeId === loungeId || m.room_id === loungeId || m.roomId === loungeId;
        if (!matchesRoom) return false;
        const msgTime = new Date(m.timestamp || m.createdAt || 0).getTime();
        return isNaN(msgTime) || (now - msgTime) <= MAX_MESSAGE_AGE_MS;
      })
      .sort((a, b) => {
        const tA = new Date(a.timestamp || a.createdAt || 0).getTime();
        const tB = new Date(b.timestamp || b.createdAt || 0).getTime();
        return tA - tB;
      });

    return valid.slice(-limit);
  } catch (err) {
    console.error('[IndexedDB] getLocalMessages error:', err);
    return [];
  }
}

/**
 * Flushes cache for a specific room.
 */
export async function flushLoungeCache(loungeId: string, userId?: number): Promise<void> {
  try {
    const db = await openCryptoDatabase(userId || 0);
    const tx = db.transaction(STORE_MESSAGES, 'readwrite');
    const all: any[] = await tx.store.index('loungeId').getAll(loungeId);
    for (const m of all) {
      await tx.store.delete(m.id);
    }
    await tx.done;
  } catch (err) {
    console.warn('[IndexedDB] flushLoungeCache error:', err);
  }
}

/**
 * Purges the entire local IndexedDB storage for a specific user on logout.
 */
export async function purgeLocalUserStorage(userId?: number): Promise<void> {
  await purgeCryptoDatabase(userId || 0);
}

/**
 * Saves a binary Blob locally in IndexedDB under a unique key.
 */
export async function saveLocalMedia(key: string, blob: Blob, userId?: number): Promise<void> {
  const db = await openCryptoDatabase(userId || 0);
  await db.put(STORE_MEDIA, blob, key);
}

/**
 * Deletes a binary Blob by key from IndexedDB.
 */
export async function deleteLocalMedia(key: string, userId?: number): Promise<void> {
  try {
    const db = await openCryptoDatabase(userId || 0);
    await db.delete(STORE_MEDIA, key);
  } catch (err) {
    console.error('[IndexedDB] deleteLocalMedia error:', err);
  }
}

/**
 * Retrieves a binary Blob by key from IndexedDB.
 */
export async function getLocalMedia(key: string, userId?: number): Promise<Blob | null> {
  try {
    const db = await openCryptoDatabase(userId || 0);
    const res = await db.get(STORE_MEDIA, key);
    return res || null;
  } catch (err) {
    console.error('[IndexedDB] getLocalMedia error:', err);
    return null;
  }
}

/**
 * Queues an unsent message in IndexedDB outbox.
 */
export async function enqueueOutboxMessage(payload: any, userId?: number): Promise<void> {
  try {
    const db = await openCryptoDatabase(userId || 0);
    await db.put(STORE_OUTBOX, payload);
  } catch (err) {
    console.error('[IndexedDB] enqueueOutboxMessage error:', err);
  }
}

/**
 * Retrieves all pending outbox messages from IndexedDB.
 */
export async function getOutboxMessages(userId?: number): Promise<any[]> {
  try {
    const db = await openCryptoDatabase(userId || 0);
    return await db.getAll(STORE_OUTBOX);
  } catch (err) {
    console.error('[IndexedDB] getOutboxMessages error:', err);
    return [];
  }
}

/**
 * Removes a message from the outbox queue.
 */
export async function removeOutboxMessage(clientMsgId: string, userId?: number): Promise<void> {
  try {
    const db = await openCryptoDatabase(userId || 0);
    await db.delete(STORE_OUTBOX, clientMsgId);
  } catch (err) {
    console.error('[IndexedDB] removeOutboxMessage error:', err);
  }
}

/**
 * Key-Value helper for persistent client cache / settings.
 */
export async function setLocalKV(key: string, value: any, userId?: number): Promise<void> {
  try {
    const db = await openCryptoDatabase(userId || 0);
    await db.put(STORE_USER_KV, { key, value, updatedAt: Date.now() });
  } catch (err) {
    console.warn('[IndexedDB] setLocalKV error:', err);
  }
}

export async function getLocalKV<T = any>(key: string, userId?: number): Promise<T | null> {
  try {
    const db = await openCryptoDatabase(userId || 0);
    const record = await db.get(STORE_USER_KV, key);
    return record ? record.value : null;
  } catch (err) {
    console.warn('[IndexedDB] getLocalKV error:', err);
    return null;
  }
}

export async function rotateAndReEncryptLocalMessages(userId?: number): Promise<void> {
  try {
    const db = await openCryptoDatabase(userId || 0);
    const msgs = await db.getAll(STORE_MESSAGES);
    if (msgs.length === 0) return;

    await LocalVaultEncryption.rotateVaultKey();

    const tx = db.transaction(STORE_MESSAGES, 'readwrite');
    for (const data of msgs) {
      if (data && data.plaintext) {
        const encrypted = await LocalVaultEncryption.encryptPayload(data.plaintext);
        await tx.store.put({
          ...data,
          content: encrypted
        });
      }
    }
    await tx.done;
  } catch (err) {
    console.error('[IndexedDB] rotateAndReEncryptLocalMessages error:', err);
  }
}

export const purgeLocalMessages = purgeLocalUserStorage;
