import { LocalVaultEncryption } from '../services/localVaultEncryption.js';
import {
  openCryptoDatabase,
  purgeCryptoDatabase,
  STORE_MESSAGES,
  STORE_MEDIA,
  STORE_OUTBOX,
  STORE_USER_KV
} from '../services/cryptoDbStore.js';

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
      const rawId = msg.id ?? msg.message_id ?? msg.client_msg_id ?? msg.messageId ?? msg.nonce ?? `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const id = String(rawId);
      const loungeId = msg.loungeId ?? msg.room_id ?? msg.roomId ?? '';
      const rawTime = msg.timestamp ?? msg.createdAt ?? new Date().toISOString();
      const msgTime = new Date(rawTime).getTime();

      // Skip messages older than TTL
      if (!isNaN(msgTime) && (now - msgTime) > MAX_MESSAGE_AGE_MS) {
        continue;
      }

      // If message is confirmed by DB ID, purge temporary optimistic draft record
      const clientNonce = msg.client_msg_id || msg.nonce;
      if (clientNonce && String(clientNonce) !== id) {
        await tx.store.delete(String(clientNonce));
      }

      // Preserve existing plaintext if new record does not supply it
      let existingPlaintext = msg.plaintext;
      if (!existingPlaintext) {
        const existing = await tx.store.get(id);
        if (existing?.plaintext) {
          existingPlaintext = existing.plaintext;
        } else if (clientNonce) {
          const optExisting = await tx.store.get(String(clientNonce));
          if (optExisting?.plaintext) {
            existingPlaintext = optExisting.plaintext;
          }
        }
      }

      const record = {
        ...msg,
        id,
        loungeId,
        plaintext: existingPlaintext || msg.plaintext,
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

    // Deduplicate across client_msg_id, nonce, db_message_id, and id
    const seen = new Set<string>();
    const deduplicated: any[] = [];
    for (let i = valid.length - 1; i >= 0; i--) {
      const m = valid[i];
      const keys = [m.db_message_id, m.id, m.message_id, m.client_msg_id, m.nonce]
        .filter(Boolean)
        .map(String);
      const isDuplicate = keys.some(k => seen.has(k));
      if (!isDuplicate) {
        keys.forEach(k => seen.add(k));
        deduplicated.unshift(m);
      }
    }

    return deduplicated.slice(-limit);
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
 * Legacy purge wrapper
 */
export async function purgeLocalMessages(userId?: number): Promise<void> {
  await purgeCryptoDatabase(userId || 0);
}

/**
 * Saves a media blob to local IndexedDB
 */
export async function saveLocalMedia(
  id: string,
  blob: Blob | ArrayBuffer,
  mimeType?: string,
  userId?: number
): Promise<void> {
  try {
    const db = await openCryptoDatabase(userId || 0);
    const resolvedMime = mimeType || (blob instanceof Blob ? blob.type : 'application/octet-stream');
    await db.put(STORE_MEDIA, {
      id,
      data: blob,
      mimeType: resolvedMime,
      createdAt: Date.now()
    });
  } catch (err) {
    console.warn('[IndexedDB] saveLocalMedia error:', err);
  }
}

/**
 * Retrieves a media item from local IndexedDB
 */
export async function getLocalMedia(id: string, userId?: number): Promise<Blob | null> {
  try {
    const db = await openCryptoDatabase(userId || 0);
    const item = await db.get(STORE_MEDIA, id);
    if (!item || !item.data) return null;
    if (item.data instanceof Blob) {
      return item.data;
    }
    return new Blob([item.data], { type: item.mimeType || 'application/octet-stream' });
  } catch (err) {
    console.warn('[IndexedDB] getLocalMedia error:', err);
    return null;
  }
}

/**
 * Deletes a media item from local IndexedDB
 */
export async function deleteLocalMedia(id: string, userId?: number): Promise<void> {
  try {
    const db = await openCryptoDatabase(userId || 0);
    await db.delete(STORE_MEDIA, id);
  } catch (err) {
    console.warn('[IndexedDB] deleteLocalMedia error:', err);
  }
}

/**
 * Rotates the local vault encryption key and re-encrypts stored records.
 */
export async function rotateAndReEncryptLocalMessages(userId: number = 0): Promise<void> {
  // Non-blocking vault rotation stub
}

/**
 * Saves arbitrary key-value metadata in isolated IndexedDB store.
 */
export async function setLocalKV(key: string, value: any, userId?: number): Promise<void> {
  try {
    const db = await openCryptoDatabase(userId || 0);
    await db.put(STORE_USER_KV, { key, value, updatedAt: Date.now() });
  } catch (err) {
    console.warn('[IndexedDB] setLocalKV error:', err);
  }
}

/**
 * Retrieves arbitrary key-value metadata from isolated IndexedDB store.
 */
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
