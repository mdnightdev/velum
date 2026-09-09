import { getDexieDb } from './dexieDb.js';

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

let isDraining = false;

/**
 * Enqueue an outgoing message frame into the offline persistent outbox
 */
export async function enqueueOutboxMessage(payload: OutboxPayload, userId?: number): Promise<void> {
  try {
    const db = getDexieDb(userId || 0);
    await db.outbox_messages.put(payload);
  } catch (err) {
    console.warn('[OUTBOX] Failed to enqueue message:', err);
  }
}

/**
 * Get all queued pending outbox messages sorted by timestamp
 */
export async function getQueuedOutboxMessages(userId?: number): Promise<OutboxPayload[]> {
  try {
    const db = getDexieDb(userId || 0);
    const items: OutboxPayload[] = await db.outbox_messages.toArray();
    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return items;
  } catch (err) {
    console.warn('[OUTBOX] Failed to read outbox:', err);
    return [];
  }
}

/**
 * Remove an acknowledged or sent message from the outbox queue
 */
export async function removeOutboxMessage(clientMsgId: string, userId?: number): Promise<void> {
  try {
    const db = getDexieDb(userId || 0);
    await db.outbox_messages.delete(clientMsgId);
  } catch (err) {
    console.warn('[OUTBOX] Failed to remove outbox message:', err);
  }
}

/**
 * Drains and re-transmits outbox messages sequentially over an active WebSocket connection
 */
export async function drainOutboxQueue(
  sendWebSocketFrame: (payload: OutboxPayload) => boolean,
  userId?: number,
  onPermanentFailure?: (clientMsgId: string) => void
): Promise<number> {
  if (isDraining) return 0;
  isDraining = true;
  try {
    const pending = await getQueuedOutboxMessages(userId);
    if (pending.length === 0) return 0;

    const now = Date.now();
    const MAX_STALE_MS = 5 * 60 * 1000; // 5 minutes max age
    const MAX_RETRIES = 5;

    let drainedCount = 0;
    for (const item of pending) {
      const itemAge = now - new Date(item.timestamp).getTime();
      const currentRetries = (item.retryCount || 0) + 1;

      if (itemAge > MAX_STALE_MS || currentRetries > MAX_RETRIES) {
        await removeOutboxMessage(item.client_msg_id, userId);
        if (onPermanentFailure) {
          onPermanentFailure(item.client_msg_id);
        }
        continue;
      }

      try {
        const db = getDexieDb(userId || 0);
        await db.outbox_messages.put({ ...item, retryCount: currentRetries });
      } catch {}

      const success = sendWebSocketFrame(item);
      if (success) {
        drainedCount++;
      } else {
        break;
      }
    }

    return drainedCount;
  } finally {
    isDraining = false;
  }
}
