import express, { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { authMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import { userController } from '../controllers/userController.js';
import { db } from '../db/client.js';
import { users, supportAdminNominations } from '../db/schema/users.js';
import { userPrekeys } from '../db/schema/keys.js';
import { relationships } from '../db/schema/relationships.js';
import { messages, lounges, userUnreadCounts, loungeMembers } from '../db/schema/lounges.js';
import { dms, dmClears } from '../db/schema/dms.js';
import { getPeerIdFromDmRoom, getDmRoomAliases } from '../../websocket/unreadManager.js';
import { getRedisClient } from '../db/redis.js';
import { eq, or, and, desc, inArray, ilike, sql } from 'drizzle-orm';
import { SystemBot } from '../services/systemBot.js';
import { BotTemplates } from '../services/botTemplates.js';
import { clearUserChatHistory } from '../services/loungeService.js';
import { dmService } from '../services/dmService.js';

export const userRouter = Router();

import { publishPrekeyBundle, fetchPrekeyBundle } from '../services/crypto/prekeyVaultService.js';

userRouter.post('/keys/prekey-bundle', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { identityKey, signedPrekey, signedPrekeySignature, oneTimePrekeys, registrationId, deviceId, signedPrekeyId } = req.body;

    if (!identityKey || !signedPrekey) {
      return res.status(400).json({ error: 'Missing required prekey parameters.' });
    }

    await publishPrekeyBundle(userId, {
      identityKey,
      signedPrekey,
      signedPrekeySignature,
      signedPrekeyId,
      registrationId,
      deviceId,
      oneTimePrekeys
    });

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

    const bundle = await fetchPrekeyBundle(targetUserId);
    if (!bundle) {
      return res.status(404).json({ error: 'Prekey bundle not found for user.' });
    }

    res.json({
      userId: bundle.userId,
      registrationId: bundle.registrationId,
      deviceId: bundle.deviceId,
      identityKey: bundle.identityKey,
      signingIdentityKey: bundle.signingIdentityKey,
      signedPrekeyId: bundle.signedPrekeyId,
      signedPrekey: bundle.signedPrekey,
      signedPrekeySignature: bundle.signedPrekeySignature,
      oneTimePrekey: bundle.oneTimePrekey,
      oneTimePrekeysLeft: bundle.oneTimePrekeysLeft
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

// GET /v2/user/me/mutes — all timed DM mutes for the current user
userRouter.get('/me/mutes', authMiddleware, async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user!.userId;
    const redis = await getRedisClient();
    const mutes: Array<{ peerId: number; duration: string | null; mutedUntil: string | null }> = [];
    if (!redis) {
      return res.json({ mutes });
    }
    const pattern = `user:${currentUserId}:muted:*`;
    for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      const keyStr = String(key);
      const peerId = parseInt(keyStr.slice(keyStr.lastIndexOf(':') + 1), 10);
      if (!Number.isFinite(peerId) || peerId <= 0) continue;
      const durationRaw = await redis.get(keyStr);
      const ttl = await redis.ttl(keyStr);
      mutes.push({
        peerId,
        duration: typeof durationRaw === 'string' ? durationRaw : null,
        mutedUntil:
          typeof ttl === 'number' && ttl > 0
            ? new Date(Date.now() + ttl * 1000).toISOString()
            : null,
      });
    }
    res.json({ mutes });
  } catch {
    res.status(500).json({ error: 'Failed to load mutes.' });
  }
});

userRouter.post('/report', authMiddleware, (req, res, next) => {
  userController.reportUser(req, res).catch(next);
});

// GET /v2/user/:id/media-prefs — per-peer media visibility
userRouter.get('/:id/media-prefs', authMiddleware, async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user!.userId;
    const targetUserId = parseInt(req.params.id, 10);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }
    const redis = await getRedisClient();
    const defaults = { autoDownload: true, saveToDevice: true };
    if (!redis) {
      return res.json(defaults);
    }
    const raw = await redis.get(`user:${currentUserId}:media_prefs:${targetUserId}`);
    if (!raw) return res.json(defaults);
    try {
      const parsed = JSON.parse(raw) as Partial<typeof defaults>;
      return res.json({
        autoDownload: parsed.autoDownload !== false,
        saveToDevice: parsed.saveToDevice !== false,
      });
    } catch {
      return res.json(defaults);
    }
  } catch {
    res.status(500).json({ error: 'Failed to load media prefs.' });
  }
});

// PUT /v2/user/:id/media-prefs — persist Auto download / Save to device
userRouter.put('/:id/media-prefs', authMiddleware, async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user!.userId;
    const targetUserId = parseInt(req.params.id, 10);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }
    const autoDownload = req.body?.autoDownload !== false;
    const saveToDevice = req.body?.saveToDevice !== false;
    const prefs = { autoDownload, saveToDevice };
    const redis = await getRedisClient();
    if (redis) {
      await redis.set(`user:${currentUserId}:media_prefs:${targetUserId}`, JSON.stringify(prefs));
    }
    res.json({ success: true, ...prefs });
  } catch {
    res.status(500).json({ error: 'Failed to save media prefs.' });
  }
});

// POST /v2/user/:id/mute - Mute (timed) or unmute user
// Body: { duration?: '24h' | '72h' | '30d' | 'off' } — omit duration to toggle
userRouter.post('/:id/mute', authMiddleware, async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user!.userId;
    const targetUserId = parseInt(req.params.id, 10);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const durationRaw = typeof req.body?.duration === 'string' ? req.body.duration : null;
    const DURATION_SECONDS: Record<string, number> = {
      '24h': 24 * 60 * 60,
      '72h': 72 * 60 * 60,
      '30d': 30 * 24 * 60 * 60,
      off: 0,
    };

    const redis = await getRedisClient();
    const muteKey = `user:${currentUserId}:muted:${targetUserId}`;
    let isMuted = false;
    let mutedUntil: string | null = null;
    let duration: string | null = null;

    const resolveDuration =
      durationRaw && DURATION_SECONDS[durationRaw] != null ? durationRaw : '24h';

    if (!redis) {
      // Client still applies mute locally; push gate requires Redis.
      if (durationRaw === 'off' || durationRaw === '0') {
        return res.json({
          success: true,
          isMuted: false,
          duration: 'off',
          mutedUntil: null,
          persisted: false,
          message: 'User unmuted.',
        });
      }
      const seconds = DURATION_SECONDS[resolveDuration] || DURATION_SECONDS['24h'];
      return res.json({
        success: true,
        isMuted: true,
        duration: resolveDuration,
        mutedUntil: new Date(Date.now() + seconds * 1000).toISOString(),
        persisted: false,
        message: 'User muted.',
      });
    }

    if (durationRaw === 'off' || durationRaw === '0') {
      await redis.del(muteKey);
      isMuted = false;
      duration = 'off';
    } else if (durationRaw && DURATION_SECONDS[durationRaw] != null) {
      const seconds = DURATION_SECONDS[durationRaw];
      await redis.set(muteKey, durationRaw, { EX: seconds });
      isMuted = true;
      duration = durationRaw;
      mutedUntil = new Date(Date.now() + seconds * 1000).toISOString();
    } else {
      const exists = await redis.get(muteKey);
      if (exists) {
        await redis.del(muteKey);
        isMuted = false;
        duration = 'off';
      } else {
        const seconds = DURATION_SECONDS['24h'];
        await redis.set(muteKey, '24h', { EX: seconds });
        isMuted = true;
        duration = '24h';
        mutedUntil = new Date(Date.now() + seconds * 1000).toISOString();
      }
    }

    res.json({
      success: true,
      isMuted,
      duration,
      mutedUntil,
      message: isMuted ? 'User muted.' : 'User unmuted.',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle mute status.' });
  }
});

// POST /v2/user/:id/block - Toggle directional block (does not destroy friendship)
userRouter.post('/:id/block', authMiddleware, async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user!.userId;
    const targetUserId = parseInt(req.params.id, 10);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }
    if (currentUserId === targetUserId) {
      return res.status(400).json({ error: 'Cannot block yourself.' });
    }

    const { toggleBlock } = await import('../services/blockService.js');
    const isBlocked = await toggleBlock(currentUserId, targetUserId);

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

    const { lastId } = await dmService.clearConversation(currentUserId, targetUserId);

    try {
      const { broadcastToUserDevices } = await import('../../websocket/connectionManager.js');
      const aliases = getDmRoomAliases(targetUserId, currentUserId);
      for (const room_id of aliases) {
        broadcastToUserDevices(currentUserId, {
          type: 'room_cleared',
          room_id,
          peer_id: targetUserId,
          cleared_till_id: lastId
        });
      }
    } catch (wsErr) {
      console.warn('[WS Clear Broadcast Error]:', wsErr);
    }

    res.json({ success: true, clearedTillId: lastId, message: 'Chat history cleared for your account.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear chat history.' });
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

// POST /v2/user/profile - Update user profile
userRouter.post('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user!.userId;
    const { displayName, bio, avatar, avatarUrl, location } = req.body;
    
    const updateData: any = { updatedAt: new Date() };
    if (displayName !== undefined) updateData.displayName = displayName ? String(displayName).trim() : null;
    if (bio !== undefined) updateData.bio = bio ? String(bio).trim() : null;
    if (avatar !== undefined || avatarUrl !== undefined) updateData.avatarUrl = avatar || avatarUrl || null;
    if (location !== undefined) updateData.location = location ? String(location).trim() : null;
    
    await db.update(users).set(updateData).where(eq(users.id, currentUserId));
    
    const updatedUser = await db.select().from(users).where(eq(users.id, currentUserId)).limit(1);
    if (!updatedUser[0]) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    const userPayload = {
      type: 'user_profile_updated',
      userId: currentUserId,
      user: {
        userId: updatedUser[0].id,
        id: updatedUser[0].id,
        username: updatedUser[0].username,
        displayName: updatedUser[0].displayName,
        avatar: updatedUser[0].avatarUrl,
        avatarUrl: updatedUser[0].avatarUrl,
        bio: updatedUser[0].bio,
        location: updatedUser[0].location,
        role: updatedUser[0].role,
        createdAt: updatedUser[0].createdAt
      }
    };

    try {
      const { broadcastToUserDevices } = await import('../../websocket/connectionManager.js');
      broadcastToUserDevices(currentUserId, userPayload);
      const friendRows = await db.select({
        userId: relationships.userId,
        friendId: relationships.friendId
      }).from(relationships).where(
        and(
          eq(relationships.status, 'accepted'),
          or(
            eq(relationships.userId, currentUserId),
            eq(relationships.friendId, currentUserId)
          )
        )
      );
      for (const row of friendRows) {
        const friendId = row.userId === currentUserId ? row.friendId : row.userId;
        broadcastToUserDevices(friendId, userPayload);
      }
    } catch (wsErr) {
      console.warn('[WS Profile Broadcast Error]:', wsErr);
    }

    res.json({
      success: true,
      user: userPayload.user
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

userRouter.post('/upload-avatar', authMiddleware, express.raw({ type: '*/*', limit: '50mb' }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const buffer: Buffer = Buffer.isBuffer(req.body) 
      ? req.body 
      : (typeof req.body === 'string' ? Buffer.from(req.body) : Buffer.alloc(0));

    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Empty file payload' });
    }
    
    const userId = req.user!.userId;
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'avatars', String(userId));
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Consistent partitioned avatar storage per user, overwritten on update
    const filename = `avatar.webp`;
    const filepath = path.join(uploadsDir, filename);
    await fs.promises.writeFile(filepath, buffer);
    
    const relativeUrl = `/uploads/avatars/${userId}/${filename}`;
    const { mediaService } = await import('../services/media/mediaService.js');
    await mediaService.recordAsset({
      uploaderId: userId,
      storageKey: `avatars/${userId}/${filename}`,
      relativePath: relativeUrl,
      mimeType: 'image/webp',
      byteSize: buffer.length,
      category: 'avatar'
    }).catch(err => console.error('[MEDIA] Failed to track avatar asset:', err));

    res.status(200).json({ url: relativeUrl });
  } catch (err) {
    next(err);
  }
});

userRouter.post('/upload-media', authMiddleware, express.raw({ type: '*/*', limit: '50mb' }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const buffer: Buffer = Buffer.isBuffer(req.body) 
      ? req.body 
      : (typeof req.body === 'string' ? Buffer.from(req.body) : Buffer.alloc(0));

    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Empty file payload' });
    }

    const userId = req.user!.userId;
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'chat', yearMonth);
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

    let prefix = 'doc';
    if (contentType.includes('image/') || ['webp', 'png', 'jpg', 'gif'].includes(extension)) {
      prefix = 'img';
    } else if (contentType.includes('audio/') || ['webm', 'm4a'].includes(extension)) {
      prefix = 'aud';
    } else if (contentType.includes('video/')) {
      prefix = 'vid';
    }
    const filename = `${prefix}_${crypto.randomBytes(5).toString('hex')}.${extension}`;
    const filepath = path.join(uploadsDir, filename);
    await fs.promises.writeFile(filepath, buffer);

    const relativeUrl = `/uploads/chat/${yearMonth}/${filename}`;
    const { mediaService } = await import('../services/media/mediaService.js');
    await mediaService.recordAsset({
      uploaderId: userId,
      storageKey: `chat/${yearMonth}/${filename}`,
      relativePath: relativeUrl,
      mimeType: contentType || 'application/octet-stream',
      byteSize: buffer.length,
      category: 'chat'
    }).catch(err => console.error('[MEDIA] Failed to track chat asset:', err));

    res.status(200).json({ url: relativeUrl });
  } catch (err) {
    next(err);
  }
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
            const numCount = parseInt(count, 10);
            if (roomId.startsWith('dm_')) {
              const peerId = getPeerIdFromDmRoom(roomId, userId);
              if (peerId) {
                const [unreadRow] = await db
                  .select({ count: sql<number>`count(*)::int` })
                  .from(dms)
                  .where(
                    and(
                      eq(dms.sender, peerId),
                      eq(dms.peer, userId),
                      sql`${dms.readAt} IS NULL`
                    )
                  );
                const actualCount = unreadRow?.count || 0;
                if (actualCount === 0) {
                  await redis.del(key);
                  continue;
                } else {
                  counts[roomId] = actualCount;
                  if (peerId === 999) {
                    counts[`dm_velum_${userId}`] = actualCount;
                    counts['dm_999'] = actualCount;
                  }
                  continue;
                }
              }
            }
            if (numCount > 0) {
              counts[roomId] = numCount;
            }
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

      // Recover DM unread counts from dms table (exclude expired)
      const { dmNotExpiredClause } = await import('../services/dmService.js');
      const unreadDms = await db
        .select({
          sender: dms.sender,
          count: sql<number>`count(*)::int`
        })
        .from(dms)
        .where(
          and(
            eq(dms.peer, userId),
            sql`${dms.readAt} IS NULL`,
            dmNotExpiredClause()
          )
        )
        .groupBy(dms.sender);

      for (const row of unreadDms) {
        if (row.count > 0) {
          if (row.sender === 999) {
            counts[`dm_velum_${userId}`] = row.count;
            counts['dm_999'] = row.count;
          } else {
            counts[`dm_${row.sender}`] = row.count;
          }
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
    await systemBot.sendToUser(userId, BotTemplates.supportCredentialsDelivered({
      username: credentials.username,
      password: credentials.password,
      recoveryKey: credentials.recoveryKey,
      panicPhrase: credentials.panicPhrase
    }));
    
    // Notify other admins
    const [userObj] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const admins = await db.select().from(users).where(
      or(
        eq(users.role, 'CLI_ADMIN'),
        eq(users.id, nomination.nominatedBy)
      )
    );
    for (const admin of admins) {
      await systemBot.sendToUser(admin.id, BotTemplates.supportNominationStatusToAdmin(userObj?.username || 'Unknown', userId, 'ACCEPTED'));
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
    await systemBot.sendToUser(userId, BotTemplates.supportNominationDeclinedUser());
    
    // Notify other admins
    const [userObj] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const admins = await db.select().from(users).where(
      or(
        eq(users.role, 'CLI_ADMIN'),
        eq(users.id, nomination.nominatedBy)
      )
    );
    for (const admin of admins) {
      await systemBot.sendToUser(admin.id, BotTemplates.supportNominationStatusToAdmin(userObj?.username || 'Unknown', userId, 'DECLINED'));
    }
    
    res.json({ success: true, message: 'Nomination declined successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to decline nomination.' });
  }
});

// POST /v2/user/deactivate - Schedule account deactivation (Tier 1: 7-day grace period)
userRouter.post('/deactivate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { reason = 'Self-deactivation' } = req.body || {};
    const { UserDeletionService } = await import('../services/userDeletionService.js');
    const result = await UserDeletionService.requestUserDeactivation(userId, String(reason));

    res.json({
      success: true,
      scheduledDeletionAt: result.scheduledDeletionAt.toISOString(),
      daysRemaining: 7,
      message: 'Account scheduled for deletion in 7 days.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to schedule account deactivation.' });
  }
});

// POST /v2/user/delete - Alias for self-deactivation request
userRouter.post('/delete', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { reason = 'Self-deactivation' } = req.body || {};
    const { UserDeletionService } = await import('../services/userDeletionService.js');
    const result = await UserDeletionService.requestUserDeactivation(userId, String(reason));

    res.json({
      success: true,
      scheduledDeletionAt: result.scheduledDeletionAt.toISOString(),
      daysRemaining: 7,
      message: 'Account scheduled for deletion in 7 days.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to schedule account deactivation.' });
  }
});

