import type { Request, Response } from 'express';
import { userRepository } from '../repositories/userRepository.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { db } from '../db/client.js';
import { users, sessions, userNicknames } from '../db/schema/index.js';
import { eq, or, and, count, desc } from 'drizzle-orm';
import { loungeMembers } from '../db/schema/lounges.js';
import { relationships } from '../db/schema/relationships.js';
import { getRedisClient } from '../db/redis.js';
import { DEFAULT_USER_BIO } from '../constants/profile.js';
import { isReservedSystemUserId } from '../constants/systemIds.js';

export class UserController {
  async getProfile(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    const targetUserId = req.params.id === 'me' ? req.user.userId : parseInt(req.params.id, 10);
    if (isNaN(targetUserId)) {
      throw new BadRequestError('Invalid user ID.');
    }

    // Reserved system accounts are never discoverable via profile lookup
    if (
      isReservedSystemUserId(targetUserId) &&
      !isReservedSystemUserId(req.user.userId)
    ) {
      throw new NotFoundError('User not found.');
    }

    const user = await userRepository.findById(targetUserId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    const userLounges = await db
      .select({ value: count() })
      .from(loungeMembers)
      .where(eq(loungeMembers.userId, targetUserId));
    const loungesCount = Number(userLounges[0]?.value || 0);

    const userConnections = await db
      .select({ value: count() })
      .from(relationships)
      .where(
        and(
          or(eq(relationships.userId, targetUserId), eq(relationships.friendId, targetUserId)),
          eq(relationships.status, 'accepted')
        )
      );
    const connectionsCount = Number(userConnections[0]?.value || 0);

    const [nicknameRecord] = await db
      .select({ nickname: userNicknames.nickname })
      .from(userNicknames)
      .where(and(
        eq(userNicknames.ownerId, req.user.userId),
        eq(userNicknames.targetId, targetUserId)
      ))
      .limit(1);

    const isRecentlyActive = user.updatedAt && (Date.now() - new Date(user.updatedAt).getTime() < 300000);
    const resolvedStatus = isRecentlyActive ? 'Online' : 'Offline';

    let isMuted = false;
    let mutedUntil: string | null = null;
    let muteDuration: string | null = null;
    const redis = await getRedisClient();
    if (redis) {
      const muteKey = `user:${req.user.userId}:muted:${targetUserId}`;
      const muteVal = await redis.get(muteKey);
      isMuted = !!muteVal;
      if (isMuted) {
        muteDuration = typeof muteVal === 'string' ? muteVal : '24h';
        const ttl = await redis.ttl(muteKey);
        if (typeof ttl === 'number' && ttl > 0) {
          mutedUntil = new Date(Date.now() + ttl * 1000).toISOString();
        }
      }
    }

    let isBlocked = false;
    if (req.user.userId !== targetUserId) {
      const { hasBlocked } = await import('../services/blockService.js');
      isBlocked = await hasBlocked(req.user.userId, targetUserId);
    }

    res.status(200).json({
      userId: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      avatar: user.avatarUrl || '',
      avatarUrl: user.avatarUrl || '',
      bio: user.bio || DEFAULT_USER_BIO,
      nickname: nicknameRecord?.nickname || '',
      location: user.location || '',
      role: user.role,
      createdAt: user.createdAt,
      status: resolvedStatus,
      isMuted,
      mutedUntil,
      muteDuration,
      isBlocked,
      stats: {
        loungesCount,
        connectionsCount
      }
    });
  }

  async getAllUsers(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    
    if (req.user.role !== 'CLI_ADMIN' && req.user.role !== 'LOGIN_ADMIN' && req.user.role !== 'SUPPORT_ADMIN') {
      throw new BadRequestError('Unauthorized access.');
    }

    const redis = await getRedisClient();
    const cacheKey = 'users:all';
    
    let allUsers;
    
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (typeof cached === 'string') {
        allUsers = JSON.parse(cached);
      } else {
        allUsers = await db.select().from(users).orderBy(desc(users.createdAt)).limit(200);
        await redis.setEx(cacheKey, 60, JSON.stringify(allUsers));
      }
    } else {
      allUsers = await db.select().from(users).orderBy(desc(users.createdAt)).limit(200);
    }
    
    res.status(200).json(allUsers);
  }

  async deleteUser(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    
    if (req.user.role !== 'CLI_ADMIN') {
      throw new BadRequestError('Only CLI_ADMIN can delete users.');
    }

    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      throw new BadRequestError('Invalid user ID.');
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    if (user.role === 'CLI_ADMIN') {
      throw new BadRequestError('Cannot delete CLI_ADMIN users.');
    }

    await db.transaction(async (tx) => {
      // Delete all sessions
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      
      // Delete user
      await tx.delete(users).where(eq(users.id, userId));
    });

    // Invalidate cache
    const redis = await getRedisClient();
    if (redis) {
      await redis.del('users:all');
    }

    res.status(200).json({ message: 'User deleted successfully.' });
  }

  async blockUser(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    
    if (req.user.role !== 'CLI_ADMIN' && req.user.role !== 'LOGIN_ADMIN') {
      throw new BadRequestError('Unauthorized access.');
    }

    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      throw new BadRequestError('Invalid user ID.');
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    if (user.role === 'CLI_ADMIN') {
      throw new BadRequestError('Cannot block CLI_ADMIN users.');
    }

    await userRepository.update(userId, { role: 'BLOCKED' });

    // Invalidate cache
    const redis = await getRedisClient();
    if (redis) {
      await redis.del('users:all');
    }

    res.status(200).json({ message: 'User blocked successfully.' });
  }

  async unblockUser(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    
    if (req.user.role !== 'CLI_ADMIN' && req.user.role !== 'LOGIN_ADMIN') {
      throw new BadRequestError('Unauthorized access.');
    }

    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      throw new BadRequestError('Invalid user ID.');
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    if (user.role !== 'BLOCKED') {
      throw new BadRequestError('User is not blocked.');
    }

    await userRepository.update(userId, { role: 'USER' });

    // Invalidate cache
    const redis = await getRedisClient();
    if (redis) {
      await redis.del('users:all');
    }

    res.status(200).json({ message: 'User unblocked successfully.' });
  }

  async deleteOwnAccount(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    const userId = req.user.userId;

    await db.transaction(async (tx) => {
      // Delete all sessions
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      
      // Delete user
      await tx.delete(users).where(eq(users.id, userId));
    });

    // Invalidate cache
    const redis = await getRedisClient();
    if (redis) {
      await redis.del('users:all');
    }

    res.status(200).json({ message: 'Account deleted successfully.' });
  }

  async reportUser(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    const { targetUserId, reason, attachments } = req.body;
    
    if (!targetUserId || !reason) {
      throw new BadRequestError('Target user ID and reason are required.');
    }

    const PROTECTED_SYSTEM_IDS = [1, 2, 999];
    if (PROTECTED_SYSTEM_IDS.includes(Number(targetUserId))) {
      throw new BadRequestError('Cannot report system staff accounts.');
    }

    const targetUser = await userRepository.findById(Number(targetUserId));
    if (!targetUser) {
      throw new NotFoundError('Target user not found.');
    }

    const { moderationService } = await import('../services/moderationService.js');
    const { getRedisClient } = await import('../db/redis.js');

    // Automatically analyze report and execute progressive strike / ecosystem harvest
    const modResult = await moderationService.processReportAndEscalate(
      req.user.userId,
      targetUser.id,
      'user_misconduct',
      String(reason).trim(),
      'medium'
    );

    // Broadcast report event to admin channels via Redis
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.publish('admin:reports', JSON.stringify({
          type: 'new_report',
          report: {
            reporterId: req.user.userId,
            reporterUsername: req.user.username,
            targetUserId: targetUser.id,
            targetUsername: targetUser.username,
            reason: String(reason).trim(),
            attachments: Array.isArray(attachments) ? attachments : [],
            moderationAction: modResult.action,
            strikeCount: modResult.strikeCount
          }
        }));
      }
    } catch {
      // Non-fatal if Redis broadcast fails
    }

    res.status(200).json({ 
      success: true, 
      message: 'Report submitted successfully.',
      moderation: {
        action: modResult.action,
        strikeCount: modResult.strikeCount
      }
    });
  }
}

export const userController = new UserController();
