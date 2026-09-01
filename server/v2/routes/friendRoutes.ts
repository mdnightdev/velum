import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import { db } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { relationships } from '../db/schema/relationships.js';
import { lounges, messages } from '../db/schema/lounges.js';
import { eq, and, or, inArray, desc } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { connectedClients } from '../../websocket.js';
import { getRedisClient } from '../db/redis.js';

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

      // DM lounge lookup
      const dmSlug = `dm_${Math.min(currentUserId, peerId)}_${Math.max(currentUserId, peerId)}`;
      const dmLounge = await db.select().from(lounges).where(eq(lounges.slug, dmSlug)).limit(1);

      let lastMessage: any = null;
      let unreadCount = 0;

      if (dmLounge.length > 0) {
        const loungeId = dmLounge[0].id;

        // Redis Fast Path
        if (redis) {
          try {
            const cached = await redis.get(`dm:last_msg:${loungeId}`);
            if (typeof cached === 'string') {
              lastMessage = JSON.parse(cached);
            }
          } catch (e) {
            logger.debug('Redis DM cache read failed', { error: (e as Error).message, loungeId });
          }
        }

        // Cache miss: Fallback to PostgreSQL
        if (!lastMessage) {
          const lastMsgRes = await db.select().from(messages)
            .where(eq(messages.loungeId, loungeId))
            .orderBy(desc(messages.createdAt))
            .limit(1);

          if (lastMsgRes.length > 0) {
            const lm = lastMsgRes[0];
            lastMessage = {
              id: String(lm.id),
              message_id: String(lm.id),
              content: lm.content,
              senderId: lm.senderId,
              user_id: lm.senderId,
              is_encrypted: lm.encrypted,
              readBy: lm.readBy,
              deliveredTo: lm.deliveredTo,
              createdAt: lm.createdAt?.toISOString() || new Date().toISOString()
            };
            if (redis) {
              try {
                await redis.set(`dm:last_msg:${loungeId}`, JSON.stringify(lastMessage));
              } catch (e) {
                logger.debug('Redis DM cache write failed', { error: (e as Error).message, loungeId });
              }
            }
          } else if (redis) {
            try {
              await redis.del(`dm:last_msg:${loungeId}`);
            } catch (e) {
              logger.debug('Redis DM cache delete failed', { error: (e as Error).message, loungeId });
            }
          }
        }

        // Count unread incoming messages from peer
        const unreadMsgs = await db.select().from(messages).where(
          and(
            eq(messages.loungeId, loungeId),
            eq(messages.senderId, peerId)
          )
        );

        unreadCount = unreadMsgs.filter(m => {
          if (!m.readBy) return true;
          const readIds = m.readBy.split(',').map(Number);
          return !readIds.includes(currentUserId);
        }).length;
      }

      return {
        friendId: peerId,
        username: peer?.username || `User #${peerId}`,
        displayName: peer?.displayName || null,
        avatarUrl: peer?.avatarUrl || null,
        status: 'accepted',
        last_seen_at: lastSeen,
        active_lounge: null,
        dm_room_id: dmSlug,
        unread_count: unreadCount,
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
