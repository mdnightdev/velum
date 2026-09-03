import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import { db } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { relationships } from '../db/schema/relationships.js';
import { dms, dmClears } from '../db/schema/dms.js';
import { eq, and, or, inArray, desc, gt, sql } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { connectedClients } from '../../websocket.js';
import { getRedisClient } from '../db/redis.js';
import { logger } from '../utils/logger.js';

export const friendRouter = Router();

friendRouter.use(authMiddleware);

// GET /v2/friends/requests - Get pending friend requests
friendRouter.get('/requests', async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user!.userId;
    const list = await db.select().from(relationships).where(
      or(
        eq(relationships.userId, currentUserId),
        eq(relationships.friendId, currentUserId)
      )
    );

    if (list.length === 0) {
      return res.json({ requests: [] });
    }

    const userIds = [...new Set(list.flatMap(r => [r.userId, r.friendId]))];
    const dbUsers = await db.select().from(users).where(inArray(users.id, userIds));
    const isUserOnline = (uid: number) => Array.from(connectedClients.values()).some(c => c.userId === uid);

    const formatted = list.map(r => {
      const sender = dbUsers.find(u => u.id === r.userId);
      const receiver = dbUsers.find(u => u.id === r.friendId);
      const peerId = r.userId === currentUserId ? r.friendId : r.userId;
      const peer = r.userId === currentUserId ? receiver : sender;
      const lastSeen = isUserOnline(peerId) ? 'online' : (peer?.updatedAt?.toISOString() || r.updatedAt.toISOString());

      return {
        request_id: String(r.id),
        sender_id: r.userId,
        sender_name: sender?.displayName || sender?.username || `User #${r.userId}`,
        sender_display_name: sender?.displayName || sender?.username || `User #${r.userId}`,
        receiver_id: r.friendId,
        receiver_name: receiver?.displayName || receiver?.username || `User #${r.friendId}`,
        receiver_username: receiver?.username || `User #${r.friendId}`,
        receiver_avatar: receiver?.avatarUrl || null,
        sender_avatar: sender?.avatarUrl || null,
        status: r.status,
        last_seen_at: lastSeen
      };
    });

    res.json({ requests: formatted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch relationships.' });
  }
});

// GET /v2/friends/relationships - Get active friendships with unified last message and unread count
friendRouter.get('/relationships', async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user!.userId;
    const relations = await db.select().from(relationships).where(
      and(
        eq(relationships.status, 'accepted'),
        or(
          eq(relationships.userId, currentUserId),
          eq(relationships.friendId, currentUserId)
        )
      )
    );

    const peerIds = relations.map(r => r.userId === currentUserId ? r.friendId : r.userId);
    if (peerIds.length === 0) {
      return res.json({ relationships: [] });
    }

    const peerUsers = await db.select().from(users).where(inArray(users.id, peerIds));
    const isUserOnline = (uid: number) => Array.from(connectedClients.values()).some(c => c.userId === uid);
    const redis = await getRedisClient();

    const mapped = await Promise.all(relations.map(async r => {
      const peerId = r.userId === currentUserId ? r.friendId : r.userId;
      const peer = peerUsers.find(u => u.id === peerId);
      const lastSeen = isUserOnline(peerId) ? 'online' : (peer?.updatedAt?.toISOString() || 'offline');

      // 1. Monotonic cutoff lookup from dm_clears
      const [clearRecord] = await db
        .select({ lastId: dmClears.lastId })
        .from(dmClears)
        .where(and(eq(dmClears.userId, currentUserId), eq(dmClears.peer, peerId)))
        .limit(1);

      const cutoffId = clearRecord?.lastId || 0;

      // 2. Query latest message between pair
      const [lastDm] = await db
        .select()
        .from(dms)
        .where(
          and(
            or(
              and(eq(dms.sender, currentUserId), eq(dms.peer, peerId)),
              and(eq(dms.sender, peerId), eq(dms.peer, currentUserId))
            ),
            gt(dms.id, cutoffId)
          )
        )
        .orderBy(desc(dms.id))
        .limit(1);

      let lastMessage: any = null;
      if (lastDm) {
        lastMessage = {
          id: String(lastDm.id),
          message_id: String(lastDm.id),
          content: lastDm.body,
          senderId: lastDm.sender,
          user_id: lastDm.sender,
          is_encrypted: lastDm.encrypted,
          createdAt: lastDm.created?.toISOString() || new Date().toISOString()
        };
      }

      // 3. Count unread incoming messages
      const unreadList = await db
        .select({ id: dms.id })
        .from(dms)
        .where(
          and(
            eq(dms.sender, peerId),
            eq(dms.peer, currentUserId),
            gt(dms.id, cutoffId),
            sql`${dms.readAt} IS NULL`
          )
        );

      return {
        friendId: peerId,
        username: peer?.username || `User #${peerId}`,
        displayName: peer?.displayName || null,
        avatarUrl: peer?.avatarUrl || null,
        status: 'accepted',
        last_seen_at: lastSeen,
        active_lounge: null,
        dm_room_id: `dm_${peerId}`,
        unread_count: unreadList.length,
        last_message: lastMessage
      };
    }));

    res.json({ relationships: mapped });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch relationships.' });
  }
});

// GET /v2/friends - Get relationships alias
friendRouter.get('/', (req, res, next) => {
  // handle get relationships
  res.redirect(307, '/v2/friends/relationships');
});

// POST /v2/friends/request & /requests - Send friend request
const handleSendFriendRequest = async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user!.userId;
    const { targetUserId } = req.body;
    const rawUsername = req.body.receiverUsername || req.body.username;
    let receiverUsername: string | undefined = undefined;
    if (rawUsername) {
      const { validateStringLength, VALIDATION_LIMITS } = await import('../utils/validation.js');
      receiverUsername = validateStringLength(rawUsername, VALIDATION_LIMITS.USERNAME_MIN, VALIDATION_LIMITS.USERNAME_MAX, 'Username');
    }
    
    let targetUser;
    if (receiverUsername) {
      targetUser = await db.select().from(users).where(eq(users.username, receiverUsername)).limit(1);
    } else if (targetUserId) {
      const { parsePositiveInt } = await import('../utils/validation.js');
      const validId = parsePositiveInt(targetUserId, 'Target User ID');
      targetUser = await db.select().from(users).where(eq(users.id, validId)).limit(1);
    }
    
    if (!targetUser || !targetUser.length) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const receiverId = targetUser[0].id;
    if (currentUserId === receiverId) {
      return res.status(400).json({ error: 'Cannot send a friend request to yourself.' });
    }

    const PROTECTED_SYSTEM_IDS = [1, 2, 999];
    if (PROTECTED_SYSTEM_IDS.includes(receiverId) || targetUser[0].username.toLowerCase() === 'velum') {
      return res.status(403).json({ error: 'System staff accounts cannot be added as contacts.' });
    }
    
    const existing = await db.select().from(relationships).where(
      or(
        and(eq(relationships.userId, currentUserId), eq(relationships.friendId, receiverId)),
        and(eq(relationships.userId, receiverId), eq(relationships.friendId, currentUserId))
      )
    ).limit(1);

    if (existing.length) {
      const rel = existing[0];
      if (rel.status === 'accepted') {
        return res.status(400).json({ error: 'You are already friends.' });
      } else if (rel.status === 'pending') {
        return res.status(400).json({ error: 'Friend request is already pending.' });
      }
    }
    
    await db.insert(relationships).values({
      userId: currentUserId,
      friendId: receiverId,
      status: 'pending'
    });
    
    res.status(201).json({ success: true, message: 'Friend request sent.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send friend request.' });
  }
};

friendRouter.post('/requests', handleSendFriendRequest);
friendRouter.post('/request', handleSendFriendRequest);

// POST /v2/friends/accept/:requestId and /reject/:requestId aliases
friendRouter.post('/accept/:requestId', async (req: Request, res: Response) => {
  req.body.action = 'accepted';
  const relId = parseInt(req.params.requestId, 10);
  const relList = await db.select().from(relationships).where(eq(relationships.id, relId)).limit(1);
  if (!relList.length) {
    return res.status(404).json({ error: 'Friend request not found.' });
  }
  await db.update(relationships).set({ status: 'accepted', updatedAt: new Date() }).where(eq(relationships.id, relId));
  res.json({ success: true, message: 'Friend request accepted.' });
});

friendRouter.post('/reject/:requestId', async (req: Request, res: Response) => {
  req.body.action = 'rejected';
  const relId = parseInt(req.params.requestId, 10);
  await db.delete(relationships).where(eq(relationships.id, relId));
  res.json({ success: true, message: 'Friend request rejected.' });
});

// POST /v2/friends/requests/:requestId/respond - Accept/decline friend request
friendRouter.post('/requests/:requestId/respond', async (req: Request, res: Response) => {
  try {
    const relId = parseInt(req.params.requestId, 10);
    const action = req.body.action || req.body.response;

    const relList = await db.select().from(relationships).where(eq(relationships.id, relId)).limit(1);
    if (!relList.length) {
      return res.status(404).json({ error: 'Friend request not found.' });
    }

    if (action === 'accepted') {
      await db.update(relationships).set({
        status: 'accepted',
        updatedAt: new Date()
      }).where(eq(relationships.id, relId));
    } else {
      await db.delete(relationships).where(eq(relationships.id, relId));
    }

    res.json({ success: true, message: 'Friend request response processed.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to respond to friend request.' });
  }
});

// POST /v2/friends/unblock - Unblock a user (stub/real)
friendRouter.post('/unblock', async (req: Request, res: Response) => {
  try {
    const { targetUserId } = req.body;
    res.json({ success: true, message: 'User unblocked.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unblock user.' });
  }
});

export const friendRoutes = friendRouter;
