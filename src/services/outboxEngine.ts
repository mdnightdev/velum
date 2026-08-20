import { openCryptoDatabase, STORE_OUTBOX } from './cryptoDbStore';

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
    const db = await openCryptoDatabase(userId || 0);
    await db.put(STORE_OUTBOX, payload);
  } catch (err) {
    console.warn('[OUTBOX] Failed to enqueue message:', err);
  }
}

/**
 * Get all queued pending outbox messages sorted by timestamp
 */
export async function getQueuedOutboxMessages(userId?: number): Promise<OutboxPayload[]> {
  try {
    const db = await openCryptoDatabase(userId || 0);
    const items: OutboxPayload[] = await db.getAll(STORE_OUTBOX);
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
    const db = await openCryptoDatabase(userId || 0);
    await db.delete(STORE_OUTBOX, clientMsgId);
  } catch (err) {
    console.warn('[OUTBOX] Failed to remove outbox message:', err);
  }
}

/**
 * Drains and re-transmits outbox messages sequentially over an active WebSocket connection
 */
export async function drainOutboxQueue(sendWebSocketFrame: (payload: OutboxPayload) => boolean, userId?: number): Promise<number> {
  if (isDraining) return 0;
  isDraining = true;
  try {
    const pending = await getQueuedOutboxMessages(userId);
    if (pending.length === 0) return 0;

    let drainedCount = 0;
    for (const item of pending) {
      const success = sendWebSocketFrame(item);
      if (success) {
        await removeOutboxMessage(item.client_msg_id, userId);
        drainedCount++;
      } else {
        break; // Socket unable to send, stop draining
      }
    }

    return drainedCount;
  } finally {
    isDraining = false;
  }
}
