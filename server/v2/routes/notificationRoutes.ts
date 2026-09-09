import { Router, Request, Response, NextFunction } from 'express';
import { auth, extractSessionToken, hashSessionToken } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import { getVapidPublicKey, savePushSubscription, removePushSubscription, saveFcmToken, removeFcmToken } from '../services/notifications/pushGateway.js';

export const notificationRouter = Router();

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

// Register FCM device token
notificationRouter.post("/fcm/register", auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, deviceId, platform } = req.body;
    const currentUserId = req.user!.userId;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Token is required." });
    }

    await saveFcmToken(currentUserId, token, deviceId, platform);
    res.json({ success: true, message: "FCM token registered successfully." });
  } catch (err) {
    next(err);
  }
});

// Unregister FCM device token
notificationRouter.post("/fcm/unregister", auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Token is required." });
    }

    await removeFcmToken(token);
    res.json({ success: true, message: "FCM token removed successfully." });
  } catch (err) {
    next(err);
  }
});
