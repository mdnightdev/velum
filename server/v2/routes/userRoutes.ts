import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createAuthMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import { userController } from '../controllers/userController.js';
import { db } from '../db/client.js';
import { users, supportAdminNominations } from '../db/schema/users.js';
import { userPrekeys } from '../db/schema/keys.js';
import { relationships } from '../db/schema/relationships.js';
import { messages, lounges, userUnreadCounts, loungeMembers } from '../db/schema/lounges.js';
import { getRedisClient } from '../db/redis.js';
import { eq, or, and, desc, inArray, ilike, sql } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { SystemBot } from '../services/systemBot.js';

export const userRouter = Router();

const authMiddleware = createAuthMiddleware(async (tokenHash) => {
  const result = await userRepository.findSessionByTokenHash(tokenHash);
  if (!result) return null;
  return {
    user: {
      userId: result.user.id,
      username: result.user.username,
      role: result.user.role,
      duress_active: result.user.duressActive,
      displayName: result.user.displayName,
      avatarUrl: result.user.avatarUrl
    },
    expiresAt: result.session.expiresAt
  };
});

userRouter.post('/keys/prekey-bundle', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { identityKey, signedPrekey, signedPrekeySignature, oneTimePrekeys } = req.body;

    if (!identityKey || !signedPrekey || !signedPrekeySignature) {
      return res.status(400).json({ error: 'Missing required prekey parameters.' });
    }

    const existing = await db.select().from(userPrekeys).where(eq(userPrekeys.userId, userId)).limit(1);
    const oneTimeStr = typeof oneTimePrekeys === 'string' ? oneTimePrekeys : JSON.stringify(oneTimePrekeys || []);

    if (existing.length === 0) {
      await db.insert(userPrekeys).values({
        userId,
        identityKey,
        signedPrekey,
        signedPrekeySignature,
        oneTimePrekeys: oneTimeStr,
        updatedAt: new Date()
      });
    } else {
      await db.update(userPrekeys).set({
        identityKey,
        signedPrekey,
        signedPrekeySignature,
        oneTimePrekeys: oneTimeStr,
        updatedAt: new Date()
      }).where(eq(userPrekeys.userId, userId));
    }

    res.json({ message: 'Prekey bundle uploaded successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload prekey bundle.' });
  }
});

userRouter.get('/:id/prekey-bundle', authMiddleware, async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.id === 'me' ? req.user!.userId : parseInt(req.params.id, 10);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const prekeyRecord = await db.select().from(userPrekeys).where(eq(userPrekeys.userId, targetUserId)).limit(1);
    if (prekeyRecord.length === 0) {
      return res.status(404).json({ error: 'Prekey bundle not found for user.' });
    }

    let parsedOneTime = [];
    try {
      parsedOneTime = JSON.parse(prekeyRecord[0].oneTimePrekeys || '[]');
    } catch (e) {
      parsedOneTime = [];
    }

    res.json({
      userId: prekeyRecord[0].userId,
      identityKey: prekeyRecord[0].identityKey,
      signedPrekey: prekeyRecord[0].signedPrekey,
      signedPrekeySignature: prekeyRecord[0].signedPrekeySignature,
      oneTimePrekeys: parsedOneTime,
      updatedAt: prekeyRecord[0].updatedAt
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prekey bundle.' });
  }
});

userRouter.get('/directory/search', authMiddleware, async (req: Request, res: Response) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    let dbUsers;
    if (query) {
      dbUsers = await db.select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
        location: users.location,
        role: users.role,
        createdAt: users.createdAt
      }).from(users)
      .where(and(eq(users.role, "USER"), or(
        ilike(users.username, `%${query}%`),
        ilike(users.displayName, `%${query}%`)
    )))
      .limit(50);
    } else {
      dbUsers = await db.select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
        location: users.location,
        role: users.role,
        createdAt: users.createdAt
      }).from(users)
      .where(eq(users.role, "USER"))
      .orderBy(desc(users.createdAt))
      .limit(50);
    }

    res.json({ users: dbUsers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to search directory.' });
  }
});

userRouter.get('/:id/profile', authMiddleware, (req, res, next) => {
  userController.getProfile(req, res).catch(next);
});

userRouter.get('/admin/all', authMiddleware, (req, res, next) => {
  userController.getAllUsers(req, res).catch(next);
});

userRouter.delete('/admin/:id', authMiddleware, (req, res, next) => {
  userController.deleteUser(req, res).catch(next);
});

userRouter.patch('/admin/:id/block', authMiddleware, (req, res, next) => {
  userController.blockUser(req, res).catch(next);
});

userRouter.patch('/admin/:id/unblock', authMiddleware, (req, res, next) => {
  userController.unblockUser(req, res).catch(next);
});

userRouter.delete('/me', authMiddleware, (req, res, next) => {
  userController.deleteOwnAccount(req, res).catch(next);
});

userRouter.post('/report', authMiddleware, (req, res, next) => {
  userController.reportUser(req, res).catch(next);
});

// POST /v2/user/:id/mute - Mute or unmute user
userRouter.post('/:id/mute', authMiddleware, async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user!.userId;
    const targetUserId = parseInt(req.params.id, 10);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }
    const redis = await getRedisClient();
    const muteKey = `user:${currentUserId}:muted:${targetUserId}`;
    let isMuted = false;
    if (redis) {
      const exists = await redis.get(muteKey);
      if (exists) {
        await redis.del(muteKey);
        isMuted = false;
      } else {
        await redis.set(muteKey, '1');
        isMuted = true;
      }
    }
    res.json({ success: true, isMuted, message: isMuted ? 'User muted.' : 'User unmuted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle mute status.' });
  }
});

// POST /v2/user/:id/block - Block or unblock user
userRouter.post('/:id/block', authMiddleware, async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user!.userId;
    const targetUserId = parseInt(req.params.id, 10);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }
    
    const existing = await db.select().from(relationships).where(
      or(
        and(eq(relationships.userId, currentUserId), eq(relationships.friendId, targetUserId)),
        and(eq(relationships.userId, targetUserId), eq(relationships.friendId, currentUserId))
      )
    ).limit(1);

    let isBlocked = false;
    if (existing.length > 0) {
      if (existing[0].status === 'blocked') {
        await db.update(relationships).set({ status: 'accepted', updatedAt: new Date() }).where(eq(relationships.id, existing[0].id));
        isBlocked = false;
      } else {
        await db.update(relationships).set({ status: 'blocked', updatedAt: new Date() }).where(eq(relationships.id, existing[0].id));
        isBlocked = true;
      }
    } else {
      await db.insert(relationships).values({
        userId: currentUserId,
        friendId: targetUserId,
        status: 'blocked',
        updatedAt: new Date()
      });
      isBlocked = true;
    }

    const redis = await getRedisClient();
    if (redis) {
      const blockKey = `user:${currentUserId}:blocked:${targetUserId}`;
      if (isBlocked) {
        await redis.set(blockKey, '1');
      } else {
        await redis.del(blockKey);
      }
    }

    res.json({ success: true, isBlocked, message: isBlocked ? 'User blocked.' : 'User unblocked.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle block status.' });
  }
});

// DELETE /v2/user/:id/chat - Clear direct chat messages
userRouter.delete('/:id/chat', authMiddleware, async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user!.userId;
    const targetUserId = parseInt(req.params.id, 10);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const dmLounges = await db.select().from(lounges).where(eq(lounges.type, 'dm'));
    const members = await db.select().from(loungeMembers).where(inArray(loungeMembers.userId, [currentUserId, targetUserId]));
    
    const userLounges = new Set(members.filter(m => m.userId === currentUserId).map(m => m.loungeId));
    const targetLounges = new Set(members.filter(m => m.userId === targetUserId).map(m => m.loungeId));
    const commonDmLounge = dmLounges.find(l => userLounges.has(l.id) && targetLounges.has(l.id));

    if (commonDmLounge) {
      await db.delete(messages).where(eq(messages.loungeId, commonDmLounge.id));
    }

    res.json({ success: true, message: 'Chat history cleared.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete chat history.' });
  }
});

// GET /v2/users/:id/status - Get user online status
userRouter.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }
    
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user.length) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    // Check if user is online in Redis cache
    const redis = await getRedisClient();
    let isOnline = false;
    if (redis) {
      isOnline = (await redis.exists(`user:${userId}:active`)) === 1;
    }
    
    res.json({
      user_id: user[0].id,
      username: user[0].username,
      last_seen_at: isOnline ? 'online' : (user[0].updatedAt?.toISOString() || 'offline'),
      status: isOnline ? 'online' : 'offline'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user status.' });
  }
});

// POST /v2/user/profile - Update user profile (frontend expects this)
userRouter.post('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user!.userId;
    const { displayName, bio, avatar, location, email, phone, settings } = req.body;
    
    const updateData: any = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (bio !== undefined) updateData.bio = bio;
    if (avatar !== undefined) updateData.avatarUrl = avatar;
    if (location !== undefined) updateData.location = location;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (settings !== undefined) updateData.settings = settings;
    
    if (Object.keys(updateData).length > 0) {
      await db.update(users).set(updateData).where(eq(users.id, currentUserId));
    }
    
    const updatedUser = await db.select().from(users).where(eq(users.id, currentUserId)).limit(1);
    
    res.json({
      user: {
        userId: updatedUser[0].id,
        username: updatedUser[0].username,
        displayName: updatedUser[0].displayName,
        avatar: updatedUser[0].avatarUrl,
        bio: updatedUser[0].bio,
        location: updatedUser[0].location,
        role: updatedUser[0].role,
        createdAt: updatedUser[0].createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

userRouter.post('/upload-avatar', authMiddleware, (req, res, next) => {
  const chunks: Buffer[] = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', async () => {
    try {
      const buffer = Buffer.concat(chunks);
      if (buffer.length === 0) {
        return res.status(400).json({ error: 'Empty file payload' });
      }
      
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const filename = `avatar-${req.user!.userId}-${Date.now()}.webp`;
      const filepath = path.join(uploadsDir, filename);
      fs.writeFileSync(filepath, buffer);
      
      res.status(200).json({ url: `/uploads/${filename}` });
    } catch (err) {
      next(err);
    }
  });
});

userRouter.post('/upload-media', authMiddleware, (req, res, next) => {
  const chunks: Buffer[] = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', async () => {
    try {
      const buffer = Buffer.concat(chunks);
      if (buffer.length === 0) {
        return res.status(400).json({ error: 'Empty file payload' });
      }

      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const contentType = req.headers['content-type'] || '';
      let extension = 'webp';
      if (contentType.includes('audio/webm') || contentType.includes('video/webm')) {
        extension = 'webm';
      } else if (contentType.includes('audio/mp4') || contentType.includes('video/mp4') || contentType.includes('audio/m4a')) {
        extension = 'mp4';
      } else if (contentType.includes('image/png')) {
        extension = 'png';
      } else if (contentType.includes('image/jpeg')) {
        extension = 'jpg';
      } else if (contentType.includes('image/gif')) {
        extension = 'gif';
      }

      const filename = `media-${req.user!.userId}-${Date.now()}.${extension}`;
      const filepath = path.join(uploadsDir, filename);
      fs.writeFileSync(filepath, buffer);

      res.status(200).json({ url: `/uploads/${filename}` });
    } catch (err) {
      next(err);
    }
  });
});

// Get unread counts from Redis (with persistent Postgres fallback)
userRouter.get('/unread-counts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const redis = await getRedisClient();
    const userId = req.user!.userId;
    const counts: Record<string, number> = {};

    let hasCachedKeys = false;
    if (redis) {
      const pattern = `unread:${userId}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        hasCachedKeys = true;
        for (const key of keys) {
          const roomId = key.split(':')[2];
          const count = await redis.get(key);
          if (count && typeof count === 'string') {
            counts[roomId] = parseInt(count, 10);
          }
        }
      }
    }

    if (!hasCachedKeys) {
      // Cache-aside: recover unread counts from database user_unread_counts table
      const dbCounts = await db.select({
        loungeId: userUnreadCounts.loungeId,
        unreadCount: userUnreadCounts.unreadCount,
        slug: lounges.slug
      })
      .from(userUnreadCounts)
      .innerJoin(lounges, eq(userUnreadCounts.loungeId, lounges.id))
      .where(and(eq(userUnreadCounts.userId, userId), sql`${userUnreadCounts.unreadCount} > 0`));

      for (const row of dbCounts) {
        const roomId = row.slug || String(row.loungeId);
        counts[roomId] = row.unreadCount;
        if (redis) {
          const key = `unread:${userId}:${roomId}`;
          await redis.set(key, String(row.unreadCount));
          await redis.expire(key, 86400); // 24 hours cache TTL
        }
      }
    }

    res.json({ unreadCounts: counts });
  } catch (err) {
    console.error('Failed to get unread counts:', err);
    res.status(500).json({ error: 'Failed to get unread counts' });
  }
});

// GET /v2/user/nomination/pending - Check if user has a pending approved nomination
userRouter.get('/nomination/pending', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const [nomination] = await db.select().from(supportAdminNominations).where(
      and(
        eq(supportAdminNominations.nominatedUserId, userId),
        eq(supportAdminNominations.status, 'approved')
      )
    ).limit(1);
    
    if (!nomination) {
      return res.json({ hasPending: false });
    }
    
    res.json({ hasPending: true, nominationId: nomination.id });
  } catch (err) {
    console.error('Failed to check pending nomination:', err);
    res.status(500).json({ error: 'Failed to check pending nomination.' });
  }
});

// POST /v2/user/nomination/accept - User accepts the nomination
userRouter.post('/nomination/accept', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const [nomination] = await db.select().from(supportAdminNominations).where(
      and(
        eq(supportAdminNominations.nominatedUserId, userId),
        eq(supportAdminNominations.status, 'approved')
      )
    ).limit(1);
    
    if (!nomination) {
      return res.status(404).json({ error: 'No approved support admin nomination found.' });
    }
    
    // Activate the support admin account
    if (nomination.adminAccountId) {
      await db.update(users)
        .set({ duressActive: false })
        .where(eq(users.id, nomination.adminAccountId));
    }
    
    // Mark nomination as accepted
    await db.update(supportAdminNominations)
      .set({ 
        status: 'accepted',
        updatedAt: new Date()
      })
      .where(eq(supportAdminNominations.id, nomination.id));
    
    const systemBot = SystemBot.getInstance();
    const credentials = JSON.parse(nomination.credentials || '{}');
    
    // Deliver credentials via bot
    await systemBot.sendToUser(userId,
      `You have ACCEPTED the Velum Support Administrator role.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `YOUR SUPPORT ADMIN CREDENTIALS:\n` +
      `Username: ${credentials.username}\n` +
      `Password: ${credentials.password}\n` +
      `Recovery Key: ${credentials.recoveryKey}\n` +
      `Panic Phrase: ${credentials.panicPhrase || 'N/A'}\n\n` +
      `IMPORTANT:\n` +
      `• This is a SEPARATE account from your regular user account\n` +
      `• Use these credentials to access the Support Admin Panel\n` +
      `• Your regular user account remains unchanged\n` +
      `• Keep these credentials secure\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    );
    
    // Notify other admins
    const [userObj] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const admins = await db.select().from(users).where(
      or(
        eq(users.role, 'CLI_ADMIN'),
        eq(users.id, nomination.nominatedBy)
      )
    );
    for (const admin of admins) {
      await systemBot.sendToUser(admin.id,
        `Support Role ACCEPTED\n\n` +
        `User: ${userObj?.username} (ID: ${userId})\n` +
        `Status: Active support admin account initialized\n` +
        `Time: ${new Date().toISOString()}`
      );
    }
    
    res.json({ success: true, message: 'Nomination accepted successfully.' });
  } catch (err) {
    console.error('Failed to accept nomination:', err);
    res.status(500).json({ error: 'Failed to accept nomination.' });
  }
});

// POST /v2/user/nomination/decline - User declines the nomination
userRouter.post('/nomination/decline', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const [nomination] = await db.select().from(supportAdminNominations).where(
      and(
        eq(supportAdminNominations.nominatedUserId, userId),
        eq(supportAdminNominations.status, 'approved')
      )
    ).limit(1);
    
    if (!nomination) {
      return res.status(404).json({ error: 'No approved support admin nomination found.' });
    }
    
    // Delete the support admin account
    if (nomination.adminAccountId) {
      await db.delete(users).where(eq(users.id, nomination.adminAccountId));
    }
    
    // Mark nomination as declined
    await db.update(supportAdminNominations)
      .set({ 
        status: 'declined',
        credentials: '',
        updatedAt: new Date()
      })
      .where(eq(supportAdminNominations.id, nomination.id));
    
    const systemBot = SystemBot.getInstance();
    
    // Notify user via bot
    await systemBot.sendToUser(userId,
      `You have DECLINED the Velum Support Administrator role.\n\n` +
      `The support admin credentials have been purged from the system.\n\n` +
      `Your regular user account remains unchanged and unaffected.`
    );
    
    // Notify other admins
    const [userObj] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const admins = await db.select().from(users).where(
      or(
        eq(users.role, 'CLI_ADMIN'),
        eq(users.id, nomination.nominatedBy)
      )
    );
    for (const admin of admins) {
      await systemBot.sendToUser(admin.id,
        `Support Role DECLINED\n\n` +
        `User: ${userObj?.username} (ID: ${userId})\n` +
        `Status: Nominated credentials purged\n` +
        `Time: ${new Date().toISOString()}`
      );
    }
    
    res.json({ success: true, message: 'Nomination declined successfully.' });
  } catch (err) {
    console.error('Failed to decline nomination:', err);
    res.status(500).json({ error: 'Failed to decline nomination.' });
  }
});
