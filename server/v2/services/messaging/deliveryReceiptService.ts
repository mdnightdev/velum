import { db, executeWithRetry } from '../../db/client.js';
import { messages } from '../../db/schema/lounges.js';
import { eq, inArray } from 'drizzle-orm';

export interface DeliveryReceiptResult {
  messageId: number;
  recipientUserId: number;
  deliveredTo: string;
  timestamp: string;
}

export async function processDeliveryReceipt(
  messageId: number,
  recipientUserId: number
): Promise<DeliveryReceiptResult | null> {
  const now = new Date();
  const timestampIso = now.toISOString();

  const [msg] = await executeWithRetry(() =>
    db.select({ id: messages.id, deliveredTo: messages.deliveredTo })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1)
  );

  if (!msg) return null;

  const currentDelivered = msg.deliveredTo ? msg.deliveredTo.split(',').filter(Boolean) : [];
  const strUserId = String(recipientUserId);

  if (!currentDelivered.includes(strUserId)) {
    currentDelivered.push(strUserId);
    const newDeliveredTo = currentDelivered.join(',');

    await executeWithRetry(() =>
      db.update(messages)
        .set({ deliveredTo: newDeliveredTo })
        .where(eq(messages.id, messageId))
    );

    return {
      messageId,
      recipientUserId,
      deliveredTo: newDeliveredTo,
      timestamp: timestampIso
    };
  }

  return {
    messageId,
    recipientUserId,
    deliveredTo: msg.deliveredTo || strUserId,
    timestamp: timestampIso
  };
}

export async function processBatchDeliveryReceipts(
  messageIds: number[],
  recipientUserId: number
): Promise<DeliveryReceiptResult[]> {
  const results: DeliveryReceiptResult[] = [];
  for (const id of messageIds) {
    const res = await processDeliveryReceipt(id, recipientUserId);
    if (res) results.push(res);
  }
  return results;
}
