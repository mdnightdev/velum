import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import type { Request, Response } from 'express';

export const userPublicRouter = Router();

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

userPublicRouter.use(authMiddleware);

// Public ticket endpoints
userPublicRouter.get('/public/tickets/:trackingId', async (req: Request, res: Response) => {
  res.json({ ticket: null });
});

userPublicRouter.post('/public/tickets/:trackingId/reply', async (req: Request, res: Response) => {
  res.json({ success: true });
});

export const userPublicRoutes = userPublicRouter;