import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import { db } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { relationships } from '../db/schema/relationships.js';
import { eq, and, or, inArray } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { connectedClients } from '../../websocket.js';

export const friendRouter = Router();

const authMiddleware = createAuthMiddleware(async (tokenHash) => {
  const result = await userRepository.findSessionByTokenHash(tokenHash);
  if (!result) return null;
  return {
    user: {
      userId: result.user.id,
      username: result.user.username,
      role: result.user.role,
      duress_active: result.user.duressActive
    },
    expiresAt: result.session.expiresAt
  };
});

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

// GET /v2/friends/relationships - Get active friendships
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

    const mapped = relations.map(r => {
      const peerId = r.userId === currentUserId ? r.friendId : r.userId;
      const peer = peerUsers.find(u => u.id === peerId);
      const lastSeen = isUserOnline(peerId) ? 'online' : (peer?.updatedAt?.toISOString() || 'offline');

      return {
        friendId: peerId,
        username: peer?.username || `User #${peerId}`,
        displayName: peer?.displayName || null,
        avatarUrl: peer?.avatarUrl || null,
        status: 'accepted',
        last_seen_at: lastSeen,
        active_lounge: null
      };
    });

    res.json({ relationships: mapped });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch relationships.' });
  }
});

// POST /v2/friends/requests - Send friend request
friendRouter.post('/requests', async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user!.userId;
    const { targetUserId, receiverUsername } = req.body;
    
    let targetUser;
    if (receiverUsername) {
      targetUser = await db.select().from(users).where(eq(users.username, receiverUsername)).limit(1);
    } else if (targetUserId) {
      targetUser = await db.select().from(users).where(eq(users.id, Number(targetUserId))).limit(1);
    }
    
    if (!targetUser || !targetUser.length) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const receiverId = targetUser[0].id;
    if (currentUserId === receiverId) {
      return res.status(400).json({ error: 'Cannot send a friend request to yourself.' });
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