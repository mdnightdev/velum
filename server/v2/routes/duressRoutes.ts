import { Router } from 'express';
import { executePanicCascade } from '../services/duress/panicService.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import type { Request, Response } from 'express';

export const duressRouter = Router();

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

// POST /panic - Manual duress trigger from Settings
duressRouter.post('/panic', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const result = await executePanicCascade(userId, 'MANUAL_SETTINGS_TRIGGER');
    res.json({
      success: true,
      ticketId: result.ticketId,
      message: 'Panic protocol executed successfully.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to execute panic protocol.' });
  }
});
