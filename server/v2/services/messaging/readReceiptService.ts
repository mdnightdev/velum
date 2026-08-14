import { db, executeWithRetry } from '../../db/client.js';
import { userReadCursors } from '../../db/schema/read_cursors.js';
import { messages, userUnreadCounts, lounges } from '../../db/schema/lounges.js';
import { eq, and, lte, sql } from 'drizzle-orm';

export interface ReadReceiptResult {
  loungeId: number;
  userId: number;
  lastReadMsgId: number;
  lastReadSeq: number;
  updatedMessageIds: number[];
  timestamp: string;
}

export async function processReadReceipt(
  userId: number,
  loungeId: number,
  lastReadMsgId: number,
  lastReadSeq?: number
): Promise<ReadReceiptResult> {
  const now = new Date();
  const timestampIso = now.toISOString();

  let targetSeq = lastReadSeq || 0;

  // If lastReadSeq not passed, query target message sequence
  if (!targetSeq && lastReadMsgId) {
    const [msg] = await executeWithRetry(() =>
      db.select({ sequenceId: messages.sequenceId })
        .from(messages)
        .where(eq(messages.id, lastReadMsgId))
        .limit(1)
    );
    if (msg) {
      targetSeq = msg.sequenceId;
    }
  }

  // 1. Upsert read cursor
  await executeWithRetry(() =>
    db.insert(userReadCursors)
      .values({
        userId,
        loungeId,
        lastReadMsgId,
        lastReadSeq: targetSeq,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [userReadCursors.userId, userReadCursors.loungeId],
        set: {
          lastReadMsgId,
          lastReadSeq: targetSeq,
          updatedAt: now
        }
      })
  );

  // 2. Reset unread count for user in lounge
  await executeWithRetry(() =>
    db.insert(userUnreadCounts)
      .values({
        userId,
        loungeId,
        unreadCount: 0,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [userUnreadCounts.userId, userUnreadCounts.loungeId],
        set: {
          unreadCount: 0,
          updatedAt: now
        }
      })
  );

  // 3. Update readBy string on unread messages up to lastReadMsgId/targetSeq
  const unreadMsgs = await executeWithRetry(() =>
    db.select({ id: messages.id, readBy: messages.readBy })
      .from(messages)
      .where(and(
        eq(messages.loungeId, loungeId),
        targetSeq > 0 ? lte(messages.sequenceId, targetSeq) : lte(messages.id, lastReadMsgId)
      ))
  );

  const updatedIds: number[] = [];
  const strUserId = String(userId);

  for (const m of unreadMsgs) {
    const currentRead = m.readBy ? m.readBy.split(',').filter(Boolean) : [];
    if (!currentRead.includes(strUserId)) {
      currentRead.push(strUserId);
      const newReadBy = currentRead.join(',');
      await executeWithRetry(() =>
        db.update(messages)
          .set({ readBy: newReadBy })
          .where(eq(messages.id, m.id))
      );
      updatedIds.push(m.id);
    }
  }

  return {
    loungeId,
    userId,
    lastReadMsgId,
    lastReadSeq: targetSeq,
    updatedMessageIds: updatedIds,
    timestamp: timestampIso
  };
}
