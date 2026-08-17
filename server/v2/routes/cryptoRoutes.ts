import { Router, Request, Response, NextFunction } from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import {
  publishPrekeyBundle,
  fetchPrekeyBundle,
  generateSafetyNumber
} from '../services/crypto/prekeyVaultService.js';
import { db } from '../db/client.js';
import { userPrekeys } from '../db/schema/keys.js';
import { eq } from 'drizzle-orm';

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

export const cryptoRouter = Router();

// POST /v2/crypto/prekeys - Publish or refresh prekey bundle
cryptoRouter.post('/crypto/prekeys', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const {
      registrationId,
      deviceId,
      identityKey,
      signedPrekey,
      signedPrekeyId,
      signedPrekeySignature,
      oneTimePrekeys
    } = req.body;

    if (!identityKey) {
      return res.status(400).json({ error: 'Missing identityKey.' });
    }

    if (!signedPrekey) {
      return res.status(400).json({ error: 'Missing signedPrekey.' });
    }

    if (typeof signedPrekey === 'object' && signedPrekey !== null) {
      if (!signedPrekey.publicKey || !signedPrekey.signature) {
        return res.status(400).json({ error: 'Invalid signedPrekey structure. publicKey and signature are required.' });
      }
    } else if (typeof signedPrekey === 'string') {
      if (!signedPrekeySignature) {
        return res.status(400).json({ error: 'Missing signedPrekeySignature.' });
      }
    }

    await publishPrekeyBundle(userId, {
      registrationId: registrationId !== undefined ? Number(registrationId) : 1,
      deviceId: deviceId !== undefined ? Number(deviceId) : 1,
      identityKey: String(identityKey),
      signedPrekeyId: signedPrekeyId !== undefined ? Number(signedPrekeyId) : undefined,
      signedPrekey,
      signedPrekeySignature,
      oneTimePrekeys: Array.isArray(oneTimePrekeys) || typeof oneTimePrekeys === 'string' ? oneTimePrekeys : []
    });

    res.json({ status: 'ok', message: 'Prekey bundle published successfully.' });
  } catch (err) {
    next(err);
  }
});

// GET /v2/crypto/prekeys/:userId - Retrieve target user's prekey bundle for session initiation
cryptoRouter.get('/crypto/prekeys/:userId', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid userId parameter.' });
    }

    const deviceId = req.query.deviceId ? parseInt(req.query.deviceId as string, 10) : 1;

    const bundle = await fetchPrekeyBundle(targetUserId, deviceId);
    if (!bundle) {
      return res.status(404).json({ error: 'Prekey bundle not found for user.' });
    }

    res.json({ status: 'ok', bundle });
  } catch (err) {
    next(err);
  }
});

// POST /v2/crypto/safety-number - Generate fingerprint for identity verification
cryptoRouter.post('/crypto/safety-number', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user!.userId;
    const { peer_user_id, peer_identity_key } = req.body;

    let peerKey = peer_identity_key;

    if (!peerKey && peer_user_id) {
      const targetId = parseInt(peer_user_id, 10);
      if (!isNaN(targetId)) {
        const [peerRecord] = await db.select().from(userPrekeys).where(eq(userPrekeys.userId, targetId)).limit(1);
        if (peerRecord) {
          peerKey = peerRecord.identityKey;
        }
      }
    }

    if (!peerKey) {
      return res.status(400).json({ error: 'peer_identity_key or valid peer_user_id is required.' });
    }

    const [selfRecord] = await db.select().from(userPrekeys).where(eq(userPrekeys.userId, currentUserId)).limit(1);
    if (!selfRecord) {
      return res.status(404).json({ error: 'Self identity key bundle not published.' });
    }

    const safetyNumber = generateSafetyNumber(selfRecord.identityKey, peerKey);

    res.json({
      status: 'ok',
      safety_number: safetyNumber,
      self_user_id: currentUserId,
      peer_user_id
    });
  } catch (err) {
    next(err);
  }
});
