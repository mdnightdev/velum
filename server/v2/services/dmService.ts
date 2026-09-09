import { eq, and, or, gt, inArray, desc, asc, sql, isNull } from 'drizzle-orm';
import { db, executeWithRetry } from '../db/client.js';
import { dms, dmClears, dmReactions, type Dm } from '../db/schema/dms.js';
import { users } from '../db/schema/users.js';
import { getBlockPairState, isBlockedBetween as checkBlockedBetween } from './blockService.js';

/** SQL: row is not past expires_at (or has none). */
export function dmNotExpiredClause() {
  return or(isNull(dms.expiresAt), sql`${dms.expiresAt} > NOW()`);
}

export type PurgedDmRow = {
  id: number;
  sender: number;
  peer: number;
  readAt: Date | null;
};

export class DmService {
  /** True if either user has blocked the other (messaging blocked both ways). */
  async isBlockedBetween(userA: number, userB: number): Promise<boolean> {
    return checkBlockedBetween(userA, userB);
  }

  async getBlockPairState(viewerId: number, peerId: number) {
    return getBlockPairState(viewerId, peerId);
  }

  /**
   * Delete expired DMs. Optional pair scope; omit both for global sweep.
   * Returns deleted rows for unread recount + client notify.
   */
  async purgeExpiredDms(opts?: {
    userA?: number;
    userB?: number;
    /** Any expired row where this user is sender or peer. */
    involvingUserId?: number;
  }): Promise<PurgedDmRow[]> {
    await this.ensureExpiresAtColumn();
    return executeWithRetry(async () => {
      const pair =
        opts?.userA != null && opts?.userB != null
          ? or(
              and(eq(dms.sender, opts.userA), eq(dms.peer, opts.userB)),
              and(eq(dms.sender, opts.userB), eq(dms.peer, opts.userA))
            )
          : undefined;

      const involving =
        opts?.involvingUserId != null
          ? or(eq(dms.sender, opts.involvingUserId), eq(dms.peer, opts.involvingUserId))
          : undefined;

      const deleted = await db
        .delete(dms)
        .where(
          and(
            sql`${dms.expiresAt} IS NOT NULL`,
            sql`${dms.expiresAt} <= NOW()`,
            pair,
            involving
          )
        )
        .returning({
          id: dms.id,
          sender: dms.sender,
          peer: dms.peer,
          readAt: dms.readAt,
        });

      return deleted;
    });
  }

  /**
   * Purge expired rows, recount Redis unread for affected recipients, notify both peers.
   */
  async purgeExpiredDmsAndSync(opts?: {
    userA?: number;
    userB?: number;
    involvingUserId?: number;
  }): Promise<PurgedDmRow[]> {
    const purged = await this.purgeExpiredDms(opts);
    if (purged.length === 0) return purged;

    try {
      const { setDmUnreadFromDb, getPrimaryDmRoomIdForPair } = await import(
        '../../websocket/unreadManager.js'
      );
      const { broadcastToUserDevices } = await import(
        '../../websocket/connectionManager.js'
      );

      const recountKeys = new Set<string>();

      for (const row of purged) {
        const roomSender = getPrimaryDmRoomIdForPair(row.sender, row.peer);
        const roomPeer = getPrimaryDmRoomIdForPair(row.peer, row.sender);

        broadcastToUserDevices(row.sender, {
          type: 'message_deleted',
          message_id: String(row.id),
          room_id: roomSender,
        });
        broadcastToUserDevices(row.peer, {
          type: 'message_deleted',
          message_id: String(row.id),
          room_id: roomPeer,
        });

        // Unread lives on the recipient (peer) until read
        if (!row.readAt) {
          recountKeys.add(`${row.peer}:${row.sender}`);
        }
      }

      for (const key of recountKeys) {
        const [recipientId, fromPeerId] = key.split(':').map(Number);
        if (!Number.isFinite(recipientId) || !Number.isFinite(fromPeerId)) continue;
        await setDmUnreadFromDb(recipientId, fromPeerId);
      }
    } catch (err) {
      console.error('[dmService] purge sync failed:', err);
    }

    return purged;
  }

  /**
   * Fetches message history between two users, respecting the requesting user's monotonic clear cutoff.
   */
  async getConversation(userId: number, peerId: number, limit = 100): Promise<Dm[]> {
    return executeWithRetry(async () => {
      await this.ensureExpiresAtColumn();
      await this.purgeExpiredDmsAndSync({ userA: userId, userB: peerId });

      const [clearRecord] = await db
        .select({ lastId: dmClears.lastId })
        .from(dmClears)
        .where(and(eq(dmClears.userId, userId), eq(dmClears.peer, peerId)))
        .limit(1);

      const cutoffId = clearRecord?.lastId || 0;

      const messages = await db
        .select()
        .from(dms)
        .where(
          and(
            or(
              and(eq(dms.sender, userId), eq(dms.peer, peerId)),
              and(eq(dms.sender, peerId), eq(dms.peer, userId))
            ),
            gt(dms.id, cutoffId),
            dmNotExpiredClause()
          )
        )
        .orderBy(asc(dms.id))
        .limit(limit);

      const messageIds = messages.map(m => m.id);
      const reactionsMap: Record<number, Record<string, string[]>> = {};
      if (messageIds.length > 0) {
        const reactionsList = await db
          .select({
            messageId: dmReactions.messageId,
            emoji: dmReactions.emoji,
            username: users.username
          })
          .from(dmReactions)
          .innerJoin(users, eq(dmReactions.userId, users.id))
          .where(inArray(dmReactions.messageId, messageIds));

        for (const react of reactionsList) {
          if (!reactionsMap[react.messageId]) {
            reactionsMap[react.messageId] = {};
          }
          if (!reactionsMap[react.messageId][react.emoji]) {
            reactionsMap[react.messageId][react.emoji] = [];
          }
          reactionsMap[react.messageId][react.emoji].push(react.username);
        }
      }

      return messages.map(m => ({
        ...m,
        expires_at: m.expiresAt ? m.expiresAt.toISOString() : null,
        reactions: reactionsMap[m.id] || {}
      })) as any[];
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
    replyTo?: number,
    expiresInSeconds?: number | null
  ): Promise<Dm> {
    if (await this.isBlockedBetween(senderId, peerId)) {
      const state = await getBlockPairState(senderId, peerId);
      const err = new Error('BLOCKED');
      (err as Error & { code?: string; blockReason?: string }).code = 'BLOCKED';
      (err as Error & { blockReason?: string }).blockReason = state.iBlocked ? 'self' : 'peer';
      throw err;
    }

    await this.ensureExpiresAtColumn();

    const expiresAt =
      expiresInSeconds != null && Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
        ? new Date(Date.now() + expiresInSeconds * 1000)
        : null;

    return executeWithRetry(async () => {
      const [created] = await db
        .insert(dms)
        .values({
          sender: senderId,
          peer: peerId,
          body,
          encrypted,
          replyTo: replyTo || null,
          expiresAt,
        })
        .returning();

      return created;
    });
  }

  private expiresColReady: Promise<void> | null = null;

  private async ensureExpiresAtColumn(): Promise<void> {
    if (!this.expiresColReady) {
      this.expiresColReady = executeWithRetry(async () => {
        await db.execute(sql`ALTER TABLE dms ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_dms_expires_at ON dms (expires_at)`);
      }).catch((err) => {
        this.expiresColReady = null;
        throw err;
      });
    }
    await this.expiresColReady;
  }

  /**
   * Clears chat history for the requesting user up to the latest current message ID.
   * Does NOT delete messages from the database (the peer retains their history).
   */
  async clearConversation(userId: number, peerId: number): Promise<{ lastId: number }> {
    return executeWithRetry(async () => {
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
            sql`${dms.readAt} IS NULL`,
            dmNotExpiredClause()
          )
        );
    });
  }

  /** Count unread incoming DMs from peer (excludes expired). */
  async countUnreadFromPeer(userId: number, peerId: number, cutoffId = 0): Promise<number> {
    const [row] = await executeWithRetry(() =>
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(dms)
        .where(
          and(
            eq(dms.sender, peerId),
            eq(dms.peer, userId),
            gt(dms.id, cutoffId),
            sql`${dms.readAt} IS NULL`,
            dmNotExpiredClause()
          )
        )
    );
    return row?.count || 0;
  }
}

export const dmService = new DmService();
