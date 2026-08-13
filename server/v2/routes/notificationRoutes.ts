import { Router, Request, Response, NextFunction } from 'express';
import { createAuthMiddleware, extractSessionToken, hashSessionToken } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import { getVapidPublicKey, savePushSubscription, removePushSubscription } from '../services/notifications/pushGateway.js';

export const notificationRouter = Router();

const auth = createAuthMiddleware(async (hashedToken) => {
  const result = await userRepository.findSessionByTokenHash(hashedToken);
  if (!result) return null;
  const { session, user } = result;
  return {
    user: {
      userId: user.id,
      username: user.username,
      role: user.role,
      duress_active: user.duressActive
    },
    expiresAt: session.expiresAt
  };
});

// GET /v2/notifications/vapid-key - Get public VAPID key for client registration
notificationRouter.get('/vapid-key', (_req: Request, res: Response) => {
  const publicKey = getVapidPublicKey();
  res.json({ publicKey });
});

// POST /v2/notifications/subscribe - Register WebPush subscription for user
notificationRouter.post('/subscribe', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subscription } = req.body;
    const currentUserId = req.user!.userId;

    if (!subscription || !subscription.endpoint || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
      return res.status(400).json({ error: 'Invalid WebPush subscription payload.' });
    }

    const userAgent = req.headers['user-agent'] || '';

    await savePushSubscription(
      currentUserId,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth,
      userAgent
    );

    res.json({ success: true, message: 'Push subscription registered successfully.' });
  } catch (err) {
    next(err);
  }
});

// DELETE /v2/notifications/unsubscribe - Unregister push subscription
notificationRouter.post('/unsubscribe', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({ error: 'Endpoint is required.' });
    }

    await removePushSubscription(endpoint);
    res.json({ success: true, message: 'Push subscription removed successfully.' });
  } catch (err) {
    next(err);
  }
});
