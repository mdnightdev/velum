import { eq, and, or, gt, desc, asc, sql } from 'drizzle-orm';
import { db, executeWithRetry } from '../db/client.js';
import { dms, dmClears, type Dm, type NewDm } from '../db/schema/dms.js';
import { users } from '../db/schema/users.js';

export class DmService {
  /**
   * Fetches message history between two users, respecting the requesting user's monotonic clear cutoff.
   */
  async getConversation(userId: number, peerId: number, limit = 100): Promise<Dm[]> {
    return executeWithRetry(async () => {
      // 1. Fetch requesting user's clear cutoff
      const [clearRecord] = await db
        .select({ lastId: dmClears.lastId })
        .from(dmClears)
        .where(and(eq(dmClears.userId, userId), eq(dmClears.peer, peerId)))
        .limit(1);

      const cutoffId = clearRecord?.lastId || 0;

      // 2. Query messages between pair with id > cutoffId
      const messages = await db
        .select()
        .from(dms)
        .where(
          and(
            or(
              and(eq(dms.sender, userId), eq(dms.peer, peerId)),
              and(eq(dms.sender, peerId), eq(dms.peer, userId))
            ),
            gt(dms.id, cutoffId)
          )
        )
        .orderBy(asc(dms.id))
        .limit(limit);

      return messages;
    });
  }

  /**
   * Inserts a new direct message.
   */
  async sendMessage(
    senderId: number,
    peerId: number,
    body: string,
    encrypted = false,
    replyTo?: number
  ): Promise<Dm> {
    return executeWithRetry(async () => {
      const [created] = await db
        .insert(dms)
        .values({
          sender: senderId,
          peer: peerId,
          body,
          encrypted,
          replyTo: replyTo || null
        })
        .returning();

      return created;
    });
  }

  /**
   * Clears chat history for the requesting user up to the latest current message ID.
   * Does NOT delete messages from the database (the peer retains their history).
   */
  async clearConversation(userId: number, peerId: number): Promise<{ lastId: number }> {
    return executeWithRetry(async () => {
      // 1. Find latest message ID between this pair
      const [latest] = await db
        .select({ id: dms.id })
        .from(dms)
        .where(
          or(
            and(eq(dms.sender, userId), eq(dms.peer, peerId)),
            and(eq(dms.sender, peerId), eq(dms.peer, userId))
          )
        )
        .orderBy(desc(dms.id))
        .limit(1);

      const maxId = latest?.id || 0;

      // 2. Upsert cutoff into dm_clears
      await db
        .insert(dmClears)
        .values({
          userId,
          peer: peerId,
          lastId: maxId,
          updated: new Date()
        })
        .onConflictDoUpdate({
          target: [dmClears.userId, dmClears.peer],
          set: {
            lastId: maxId,
            updated: new Date()
          }
        });

      return { lastId: maxId };
    });
  }

  /**
   * Marks direct messages from a peer as read.
   */
  async markAsRead(userId: number, peerId: number): Promise<void> {
    await executeWithRetry(async () => {
      await db
        .update(dms)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(dms.sender, peerId),
            eq(dms.peer, userId),
            sql`${dms.readAt} IS NULL`
          )
        );
    });
  }
}

export const dmService = new DmService();
