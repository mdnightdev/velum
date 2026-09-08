import { db, executeWithRetry } from '../v2/db/client.js';
import { userUnreadCounts } from '../v2/db/schema/index.js';
import { lounges, messages as dbMessages } from '../v2/db/schema/lounges.js';
import { eq, and, sql, ne } from 'drizzle-orm';
import { getRedisClient } from '../v2/db/redis.js';
import { dmService } from '../v2/services/dmService.js';

export function getPeerIdFromDmRoom(roomId: string, currentUserId: number): number | null {
  if (!roomId || !roomId.startsWith('dm_')) return null;
  if (roomId.startsWith('dm_velum_')) return 999;
  if (roomId === 'dm_999') return 999;
  const parts = roomId.replace('dm_', '').split('_').map(Number).filter(n => !isNaN(n));
  if (parts.length === 1) {
    return parts[0];
  }
  if (parts.length >= 2) {
    return parts[0] === currentUserId ? parts[1] : parts[0];
  }
  return null;
}

/** Room-id aliases for a DM peer (must stay aligned with client roomUtils). */
export function getDmRoomAliases(peerId: number, currentUserId: number): string[] {
  if (!Number.isFinite(peerId)) return [];
  if (peerId === 999) {
    return [`dm_velum_${currentUserId}`, 'dm_999'];
  }
  const a = Math.min(currentUserId, peerId);
  const b = Math.max(currentUserId, peerId);
  return Array.from(new Set([
    `dm_${peerId}`,
    `dm_${a}_${b}`,
    `dm_${currentUserId}_${peerId}`,
    `dm_${peerId}_${currentUserId}`
  ]));
}

export async function getLoungeIdFromRoomId(roomId: string): Promise<number | null> {
  if (!roomId) return null;
  const cleanRoom = roomId.toString().replace(/^#\s*/, '').trim();

  // Try exact slug or clean slug match
  const [targetLounge] = await executeWithRetry(() => 
    db.select().from(lounges).where(eq(lounges.slug, cleanRoom)).limit(1)
  );
  if (targetLounge) {
    return targetLounge.id;
  }

  // Try numeric id match
  const numericId = parseInt(cleanRoom, 10);
  if (!isNaN(numericId) && numericId > 0) {
    const [loungeById] = await executeWithRetry(() =>
      db.select().from(lounges).where(eq(lounges.id, numericId)).limit(1)
    );
    if (loungeById) return loungeById.id;
  }

  // Fallback: check raw roomId if cleanRoom didn't match
  if (cleanRoom !== roomId) {
    const [rawLounge] = await executeWithRetry(() =>
      db.select().from(lounges).where(eq(lounges.slug, roomId)).limit(1)
    );
    if (rawLounge) return rawLounge.id;
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
    if (roomId.startsWith('dm_')) {
      const peerId = getPeerIdFromDmRoom(roomId, userId);
      if (peerId) {
        await dmService.markAsRead(userId, peerId);
      }
    }

    const redis = await getRedisClient();
    if (redis) {
      const key = `unread:${userId}:${roomId}`;
      await redis.del(key);

      if (roomId.startsWith('dm_')) {
        const peerId = getPeerIdFromDmRoom(roomId, userId);
        if (peerId) {
          for (const alias of getDmRoomAliases(peerId, userId)) {
            await redis.del(`unread:${userId}:${alias}`);
          }
        }
      }
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
    if (roomId.startsWith('dm_')) {
      const peerId = getPeerIdFromDmRoom(roomId, userId);
      if (peerId) {
        await dmService.markAsRead(userId, peerId);
      }
      await resetUnread(userId, roomId);
      return;
    }

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
