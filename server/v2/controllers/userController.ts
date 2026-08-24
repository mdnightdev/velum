import type { Request, Response } from 'express';
import { userRepository } from '../repositories/userRepository.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { db } from '../db/client.js';
import { users, sessions } from '../db/schema/index.js';
import { eq, or, and, count, desc } from 'drizzle-orm';
import { loungeMembers } from '../db/schema/lounges.js';
import { relationships } from '../db/schema/relationships.js';
import { getRedisClient } from '../db/redis.js';

export class UserController {
  async getProfile(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    const targetUserId = req.params.id === 'me' ? req.user.userId : parseInt(req.params.id, 10);
    if (isNaN(targetUserId)) {
      throw new BadRequestError('Invalid user ID.');
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

    const isRecentlyActive = user.updatedAt && (Date.now() - new Date(user.updatedAt).getTime() < 300000);
    const resolvedStatus = isRecentlyActive ? 'Online' : 'Offline';

    let isMuted = false;
    const redis = await getRedisClient();
    if (redis) {
      const exists = await redis.get(`user:${req.user.userId}:muted:${targetUserId}`);
      isMuted = !!exists;
    }

    let isBlocked = false;
    const blockRecord = await db.select().from(relationships).where(
      and(
        eq(relationships.status, 'blocked'),
        or(
          and(eq(relationships.userId, req.user.userId), eq(relationships.friendId, targetUserId)),
          and(eq(relationships.userId, targetUserId), eq(relationships.friendId, req.user.userId))
        )
      )
    ).limit(1);
    isBlocked = blockRecord.length > 0;

    res.status(200).json({
      userId: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      avatar: user.avatarUrl || '',
      avatarUrl: user.avatarUrl || '',
      bio: user.bio || '',
      location: user.location || '',
      role: user.role,
      createdAt: user.createdAt,
      status: resolvedStatus,
      isMuted,
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

    const targetUser = await userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError('Target user not found.');
    }

    const trackingId = `REP-${Date.now().toString(36).toUpperCase()}`;
    const initialMessage = {
      sender_id: req.user.userId,
      sender_name: req.user.username,
      content: `User @${req.user.username} reported @${targetUser.username} (${targetUser.displayName || targetUser.username}).\n\nReason: ${reason}`,
      attachments: Array.isArray(attachments) ? attachments : [],
      timestamp: new Date().toISOString()
    };

    // Create a support ticket for the report
    const { tickets } = await import('../db/schema/tickets.js');
    await db.insert(tickets).values({
      userId: req.user.userId,
      subject: `User Report: @${targetUser.username}`,
      description: `Reported @${targetUser.username} for: ${reason}`,
      issueType: 'user_misconduct',
      trackingId,
      status: 'open',
      credibilityScore: 90,
      messages: [initialMessage]
    });

    res.status(200).json({ success: true, trackingId, message: 'User reported successfully. Support ticket created.' });
  }
}

export const userController = new UserController();
