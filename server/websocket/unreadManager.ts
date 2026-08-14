import { db, executeWithRetry } from '../v2/db/client.js';
import { userUnreadCounts } from '../v2/db/schema/index.js';
import { lounges, messages as dbMessages } from '../v2/db/schema/lounges.js';
import { eq, and, sql, ne } from 'drizzle-orm';
import { getRedisClient } from '../v2/db/redis.js';

export async function getOrCreateDMLounge(roomId: string): Promise<number | null> {
  try {
    return await executeWithRetry(async () => {
      const [existing] = await db.select().from(lounges).where(eq(lounges.slug, roomId)).limit(1);
      if (existing) {
        return existing.id;
      }
      const [inserted] = await db.insert(lounges).values({
        slug: roomId,
        name: 'Direct Message',
        type: 'dm',
        isPrivate: true,
        isOfficial: false,
        isSystem: false
      }).onConflictDoNothing({ target: lounges.slug }).returning();

      if (inserted) {
        return inserted.id;
      }

      // If concurrent insert occurred and onConflictDoNothing triggered, retrieve newly created row
      const [reCheck] = await db.select().from(lounges).where(eq(lounges.slug, roomId)).limit(1);
      return reCheck ? reCheck.id : null;
    });
  } catch (err) {
    console.error('getOrCreateDMLounge error:', err);
    return null;
  }
}

export async function getLoungeIdFromRoomId(roomId: string): Promise<number | null> {
  if (roomId.startsWith('dm_')) {
    return await getOrCreateDMLounge(roomId);
  }
  const [targetLounge] = await executeWithRetry(() => 
    db.select().from(lounges).where(eq(lounges.slug, roomId)).limit(1)
  );
  if (targetLounge) {
    return targetLounge.id;
  }
  const numericId = parseInt(roomId, 10);
  if (!isNaN(numericId)) {
    const [loungeById] = await executeWithRetry(() =>
      db.select().from(lounges).where(eq(lounges.id, numericId)).limit(1)
    );
    if (loungeById) return loungeById.id;
  }
  return null;
}

export async function incrementUnread(userId: number, roomId: string) {
  try {
    const redis = await getRedisClient();
    if (redis) {
      const key = `unread:${userId}:${roomId}`;
      await redis.incr(key);
      await redis.expire(key, 86400); // Expire after 24 hours
    }

    const loungeId = await getLoungeIdFromRoomId(roomId);
    if (loungeId !== null) {
      await db.insert(userUnreadCounts)
        .values({ userId, loungeId, unreadCount: 1 })
        .onConflictDoUpdate({
          target: [userUnreadCounts.userId, userUnreadCounts.loungeId],
          set: { 
            unreadCount: sql`${userUnreadCounts.unreadCount} + 1`,
            updatedAt: new Date()
          }
        });
    }
  } catch (err) {
    console.error('[WS] Failed to increment unread count:', err);
  }
}

export async function resetUnread(userId: number, roomId: string) {
  try {
    const redis = await getRedisClient();
    if (redis) {
      const key = `unread:${userId}:${roomId}`;
      await redis.del(key);
    }

    const loungeId = await getLoungeIdFromRoomId(roomId);
    if (loungeId !== null) {
      await db.insert(userUnreadCounts)
        .values({ userId, loungeId, unreadCount: 0 })
        .onConflictDoUpdate({
          target: [userUnreadCounts.userId, userUnreadCounts.loungeId],
          set: { 
            unreadCount: 0,
            updatedAt: new Date()
          }
        });
    }
  } catch (err) {
    console.error('[WS] Failed to reset unread count:', err);
  }
}

export async function markAllMessagesRead(userId: number, roomId: string) {
  try {
    const loungeId = await getLoungeIdFromRoomId(roomId);
    if (!loungeId) return;

    const unreadMessages = await db.select({ id: dbMessages.id, readBy: dbMessages.readBy })
      .from(dbMessages)
      .where(and(eq(dbMessages.loungeId, loungeId), ne(dbMessages.senderId, userId)));

    for (const msg of unreadMessages) {
      const readBy = msg.readBy ? msg.readBy.split(',').map(Number).filter(id => !isNaN(id)) : [];
      if (!readBy.includes(userId)) {
        readBy.push(userId);
        await db.update(dbMessages)
          .set({ readBy: readBy.join(',') })
          .where(eq(dbMessages.id, msg.id));
      }
    }

    await resetUnread(userId, roomId);
  } catch (err) {
    console.error('[WS] Failed to mark all messages read:', err);
  }
}

export async function getUnreadCount(userId: number, roomId: string): Promise<number> {
  try {
    const redis = await getRedisClient();
    if (redis) {
      const key = `unread:${userId}:${roomId}`;
      const count = await redis.get(key);
      if (count && typeof count === 'string') {
        return parseInt(count, 10);
      }
    }

    const loungeId = await getLoungeIdFromRoomId(roomId);
    if (loungeId !== null) {
      const [dbCount] = await executeWithRetry(() =>
        db.select()
          .from(userUnreadCounts)
          .where(and(eq(userUnreadCounts.userId, userId), eq(userUnreadCounts.loungeId, loungeId)))
          .limit(1)
      );
      return dbCount ? dbCount.unreadCount : 0;
    }
  } catch (err) {
    console.error('[WS] Failed to get unread count:', err);
  }
  return 0;
}

export async function getAllUnreadCounts(userId: number): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  try {
    const redis = await getRedisClient();
    if (redis) {
      const pattern = `unread:${userId}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        for (const key of keys) {
          const roomId = key.split(':')[2];
          const count = await redis.get(key);
          if (count && typeof count === 'string') {
            counts[roomId] = parseInt(count, 10);
          }
        }
        return counts;
      }
    }

    const dbCounts = await executeWithRetry(() =>
      db.select({
        loungeId: userUnreadCounts.loungeId,
        unreadCount: userUnreadCounts.unreadCount,
        slug: lounges.slug
      })
      .from(userUnreadCounts)
      .innerJoin(lounges, eq(userUnreadCounts.loungeId, lounges.id))
      .where(and(eq(userUnreadCounts.userId, userId), sql`${userUnreadCounts.unreadCount} > 0`))
    );

    for (const row of dbCounts) {
      const roomId = row.slug || String(row.loungeId);
      counts[roomId] = row.unreadCount;
      if (redis) {
        const key = `unread:${userId}:${roomId}`;
        await redis.set(key, String(row.unreadCount));
        await redis.expire(key, 86400);
      }
    }
  } catch (err) {
    console.error('[WS] Failed to get all unread counts:', err);
  }
  return counts;
}
