import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createAuthMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import { userController } from '../controllers/userController.js';
import { db } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { eq } from 'drizzle-orm';
import type { Request, Response } from 'express';

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
    
    res.json({
      user_id: user[0].id,
      username: user[0].username,
      last_seen_at: user[0].updatedAt?.toISOString() || new Date().toISOString(),
      status: 'online'
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
