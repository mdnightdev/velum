import { LocalVaultEncryption } from '../services/localVaultEncryption.js';
import { getDexieDb } from '../services/dexieDb.js';
import { purgeCryptoDatabase } from '../services/cryptoDbStore.js';
import { isUsablePlaintext, mergeMessagePlaintext } from './messagePlaintext.js';

const MAX_MESSAGE_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — keep in sync with localCacheMaintenance

export async function saveLocalMessages(messages: any[], userId?: number): Promise<void> {
  if (!messages || messages.length === 0) return;
  try {
    const db = getDexieDb(userId || 0);
    const now = Date.now();

    await db.transaction('rw', db.messages, async () => {
      for (const msg of messages) {
        if (!msg) continue;

        const dbId = msg.db_message_id ?? (typeof msg.id === 'number' || (typeof msg.id === 'string' && /^\d+$/.test(msg.id)) ? Number(msg.id) : undefined);
        const clientNonce = msg.client_msg_id || msg.nonce;
        const canonicalId = dbId ? String(dbId) : String(clientNonce || msg.id || crypto.randomUUID());
        const rawLounge = msg.loungeId ?? msg.room_id ?? msg.roomId ?? msg.lounge_id ?? '';
        const loungeId = String(rawLounge);
        const rawTime = msg.timestamp ?? msg.createdAt ?? msg.created_at ?? new Date().toISOString();
        const msgTime = new Date(rawTime).getTime();

        if (!isNaN(msgTime) && (now - msgTime) > MAX_MESSAGE_AGE_MS) {
          continue;
        }

        if (clientNonce && String(clientNonce) !== canonicalId) {
          await db.messages.delete(String(clientNonce));
        }

        let storedPlaintext: string | undefined;
        const existing = await db.messages.get(canonicalId);
        if (isUsablePlaintext(existing?.plaintext)) {
          storedPlaintext = existing.plaintext;
        } else if (clientNonce) {
          const optExisting = await db.messages.get(String(clientNonce));
          if (isUsablePlaintext(optExisting?.plaintext)) {
            storedPlaintext = optExisting.plaintext;
          }
        }

        const mergedPlaintext = mergeMessagePlaintext(storedPlaintext, msg.plaintext);

        const record = {
          id: canonicalId,
          db_message_id: dbId,
          loungeId,
          room_id: loungeId,
          senderId: msg.senderId ?? msg.user_id,
          user_id: msg.user_id ?? msg.senderId,
          username: msg.username || '',
          avatar: msg.avatar || '',
          content: msg.content || '',
          plaintext: mergedPlaintext,
          is_encrypted: Boolean(msg.is_encrypted || msg.encrypted || msg.isEncrypted),
          sequenceId: msg.sequenceId ?? msg.sequence_id ?? 0,
          sequence_id: msg.sequenceId ?? msg.sequence_id ?? 0,
          client_msg_id: clientNonce,
          createdAt: rawTime,
          timestamp: rawTime,
        };

        await db.messages.put(record);
      }
    });
  } catch (err) {
    console.warn('[IndexedDB] saveLocalMessages error:', err);
  }
}

export async function getLocalMessages(loungeId: string, limit = 100, userId?: number): Promise<any[]> {
  try {
    const db = getDexieDb(userId || 0);
    const now = Date.now();
    const all: any[] = await db.messages.toArray();
    const targetRoom = String(loungeId || '');
    const cleanTarget = targetRoom.replace(/^#\s*/, '');
    const allowedSlugs = new Set<string>([cleanTarget]);

    if (cleanTarget.startsWith('dm_')) {
      const parts = cleanTarget.replace('dm_', '').split('_');
      if (parts.length === 2) {
        allowedSlugs.add(`dm_${parts[1]}_${parts[0]}`);
        allowedSlugs.add(`dm_${parts[0]}`);
        allowedSlugs.add(`dm_${parts[1]}`);
      } else if (parts.length === 1 && userId) {
        const peerId = parseInt(parts[0], 10);
        if (peerId) {
          allowedSlugs.add(`dm_${Math.min(userId, peerId)}_${Math.max(userId, peerId)}`);
          allowedSlugs.add(`dm_${userId}_${peerId}`);
          allowedSlugs.add(`dm_${peerId}_${userId}`);
        }
      }
    }

    const valid = all
      .filter((m) => {
        const mRoom = String(m.loungeId || m.room_id || m.roomId || '').replace(/^#\s*/, '');
        const roomMatches = allowedSlugs.has(mRoom);
        if (!roomMatches) return false;
        const msgTime = new Date(m.timestamp || m.createdAt || 0).getTime();
        return isNaN(msgTime) || (now - msgTime) <= MAX_MESSAGE_AGE_MS;
      })
      .map((m) => ({
        ...m,
        // Drop poison placeholders so decrypt can retry; never surface them as body text
        plaintext: isUsablePlaintext(m.plaintext) ? m.plaintext : undefined,
      }))
      .sort((a, b) => {
        const tA = new Date(a.timestamp || a.createdAt || 0).getTime();
        const tB = new Date(b.timestamp || b.createdAt || 0).getTime();
        return tA - tB;
      });

    const seen = new Set<string>();
    const deduplicated: any[] = [];
    for (let i = valid.length - 1; i >= 0; i--) {
      const m = valid[i];
      const keys = [m.db_message_id, m.id, m.client_msg_id]
        .filter(Boolean)
        .map(String);
      const isDuplicate = keys.some((k) => seen.has(k));
      if (!isDuplicate) {
        keys.forEach((k) => seen.add(k));
        deduplicated.unshift(m);
      }
    }

    return deduplicated.slice(-limit);
  } catch (err) {
    console.error('[IndexedDB] getLocalMessages error:', err);
    return [];
  }
}

export async function deleteLocalMessage(messageId: string | number, userId?: number): Promise<void> {
  if (!messageId) return;
  try {
    const db = getDexieDb(userId || 0);
    const target = String(messageId);

    await db.transaction('rw', db.messages, async () => {
      await db.messages.delete(target);
      const all = await db.messages.toArray();
      for (const rec of all) {
        const candidateIds = [rec.id, rec.db_message_id, rec.client_msg_id]
          .filter(Boolean)
          .map(String);
        if (candidateIds.includes(target)) {
          await db.messages.delete(rec.id);
        }
      }
    });
  } catch (err) {
    console.warn('[IndexedDB] deleteLocalMessage error:', err);
  }
}

export async function flushLoungeCache(loungeId: string, userId?: number): Promise<void> {
  if (!loungeId) return;
  try {
    const db = getDexieDb(userId || 0);
    const target = String(loungeId);

    const candidateSlugs = new Set<string>([target]);
    if (target.startsWith('dm_') && !target.startsWith('dm_velum_')) {
      const parts = target.replace('dm_', '').split('_');
      if (parts.length === 2) {
        candidateSlugs.add(`dm_${parts[1]}_${parts[0]}`);
        candidateSlugs.add(`dm_${parts[0]}`);
        candidateSlugs.add(`dm_${parts[1]}`);
      } else if (parts.length === 1 && userId) {
        const peerId = Number(parts[0]);
        if (peerId) {
          candidateSlugs.add(`dm_${Math.min(userId, peerId)}_${Math.max(userId, peerId)}`);
          candidateSlugs.add(`dm_${userId}_${peerId}`);
          candidateSlugs.add(`dm_${peerId}_${userId}`);
        }
      }
    }

    await db.transaction('rw', db.messages, async () => {
      const all = await db.messages.toArray();
      for (const m of all) {
        const mRoom = String(m.loungeId || m.room_id || m.roomId || '').replace(/^#\s*/, '');
        if (candidateSlugs.has(mRoom)) {
          await db.messages.delete(m.id);
        }
      }
    });
  } catch (err) {
    console.warn('[IndexedDB] flushLoungeCache error:', err);
  }
}

export async function purgeDmMessages(peerId: number, userId?: number): Promise<void> {
  if (!peerId) return;
  try {
    const db = getDexieDb(userId || 0);
    const myId = userId || 0;

    const targetSlugs = new Set<string>([
      `dm_${peerId}`,
      `dm_${Math.min(myId, peerId)}_${Math.max(myId, peerId)}`,
      `dm_${myId}_${peerId}`,
      `dm_${peerId}_${myId}`,
    ]);

    await db.transaction('rw', db.messages, async () => {
      const all = await db.messages.toArray();
      for (const m of all) {
        const mRoom = String(m.loungeId || m.room_id || m.roomId || '').replace(/^#\s*/, '');
        const sId = Number(m.senderId || m.user_id || 0);
        const isPeer = sId === peerId || targetSlugs.has(mRoom);
        if (isPeer) {
          await db.messages.delete(m.id);
        }
      }
    });
  } catch (err) {
    console.warn('[IndexedDB] purgedDmMessages error:', err);
  }
}

export async function purgeLocalUserStorage(userId?: number): Promise<void> {
  await purgeCryptoDatabase(userId || 0);
}

export async function purgeLocalMessages(userId?: number): Promise<void> {
  await purgeCryptoDatabase(userId || 0);
}

export async function saveLocalMedia(
  id: string,
  blob: Blob | ArrayBuffer,
  mimeType?: string,
  userId?: number
): Promise<void> {
  try {
    const db = getDexieDb(userId || 0);
    const resolvedMime = mimeType || (blob instanceof Blob ? blob.type : 'application/octet-stream');
    await db.media_blobs.put({
      id,
      data: blob,
      mimeType: resolvedMime,
      createdAt: Date.now(),
    });
  } catch (err) {
    console.warn('[IndexedDB] saveLocalMedia error:', err);
  }
}

export async function getLocalMedia(id: string, userId?: number): Promise<Blob | null> {
  try {
    const db = getDexieDb(userId || 0);
    const item = await db.media_blobs.get(id);
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

export async function deleteLocalMedia(id: string, userId?: number): Promise<void> {
  try {
    const db = getDexieDb(userId || 0);
    await db.media_blobs.delete(id);
  } catch (err) {
    console.warn('[IndexedDB] deleteLocalMedia error:', err);
  }
}

export async function setLocalKV(key: string, value: any, userId?: number): Promise<void> {
  try {
    const db = getDexieDb(userId || 0);
    await db.user_kv.put({ key, value, updatedAt: Date.now() });
  } catch (err) {
    console.warn('[IndexedDB] setLocalKV error:', err);
  }
}

export async function getLocalKV<T = any>(key: string, userId?: number): Promise<T | null> {
  try {
    const db = getDexieDb(userId || 0);
    const record = await db.user_kv.get(key);
    return record ? (record.value as T) : null;
  } catch (err) {
    console.warn('[IndexedDB] getLocalKV error:', err);
    return null;
  }
}

export async function getPlaintextByCiphertext(ciphertext: string, userId?: number): Promise<string | null> {
  if (!ciphertext) return null;
  try {
    const db = getDexieDb(userId || 0);
    const match = await db.messages
      .filter((m) => m && m.content === ciphertext && isUsablePlaintext(m.plaintext))
      .first();
    return match?.plaintext || null;
  } catch {
    return null;
  }
}
