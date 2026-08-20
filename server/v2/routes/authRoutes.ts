import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, updateProfileSchema } from '../schemas/auth.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import { db } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { eq } from 'drizzle-orm';
import { hashArgon2id, generateRandomToken } from '../utils/crypto.js';
import { systemBot } from '../services/systemBot.js';

import { executePanicCascade } from '../services/duress/panicService.js';

export const authRouter = Router();

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

authRouter.get('/user-salt', (req, res, next) => {
  authController.getUserSalt(req, res).catch(next);
});

authRouter.get('/login-nonce', (req, res, next) => {
  authController.getLoginNonce(req, res).catch(next);
});

authRouter.get('/challenge', (req, res, next) => {
  authController.getLoginNonce(req, res).catch(next);
});

authRouter.get('/pre-signup-salt', (req, res, next) => {
  authController.getPreSignupSalt(req, res).catch(next);
});

authRouter.get('/recovery-salt', (req, res, next) => {
  authController.getRecoverySalt(req, res).catch(next);
});

authRouter.post('/register-permanent-otp', (req, res, next) => {
  authController.registerPermanentOtp(req, res).catch(next);
});

authRouter.post('/restore-account', (req, res, next) => {
  authController.restoreAccount(req, res).catch(next);
});

authRouter.post('/recover-safeword', (req, res, next) => {
  authController.recoverSafeword(req, res).catch(next);
});

authRouter.post('/redeem-restore-code', (req, res, next) => {
  authController.redeemRestoreCode(req, res).catch(next);
});

authRouter.post('/device-fingerprint', (req, res, next) => {
  authController.recordDeviceFingerprint(req, res).catch(next);
});

authRouter.get('/device-history', authMiddleware, (req, res, next) => {
  authController.getDeviceHistory(req, res).catch(next);
});

authRouter.get('/ip-history', authMiddleware, (req, res, next) => {
  authController.getIpHistory(req, res).catch(next);
});

authRouter.post('/purge-data', authMiddleware, (req, res, next) => {
  authController.purgeUserData(req, res).catch(next);
});

// POST /v2/auth/panic - Instant WAL Cascade Deletion Panic Protocol Trigger
authRouter.post('/panic', authMiddleware, async (req, res, next) => {
  try {
    const currentUserId = req.user!.userId;
    const result = await executePanicCascade(currentUserId, 'MANUAL_PANIC_TRIGGER');
    res.json({
      success: true,
      ticketId: result.ticketId,
      message: 'Panic protocol executed. Instant WAL cascade deletion completed.'
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/register', validate({ body: registerSchema }), (req, res, next) => {
  authController.register(req, res).catch(next);
});

authRouter.post('/login', validate({ body: loginSchema }), (req, res, next) => {
  authController.login(req, res).catch(next);
});

authRouter.post('/logout', authMiddleware, (req, res, next) => {
  authController.logout(req, res).catch(next);
});

authRouter.get('/me', authMiddleware, (req, res, next) => {
  authController.me(req, res).catch(next);
});

authRouter.patch('/profile', authMiddleware, validate({ body: updateProfileSchema }), (req, res, next) => {
  authController.updateProfile(req, res).catch(next);
});

// POST /v2/auth/promote-to-support-admin - Promote user to SUPPORT_ADMIN
authRouter.post('/promote-to-support-admin', authMiddleware, async (req, res, next) => {
  try {
    const { targetUserId } = req.body;
    const promoterId = req.user!.userId;
    const promoterRole = req.user!.role;

    // Only CLI_ADMIN and LOGIN_ADMIN can promote users
    if (!['CLI_ADMIN', 'LOGIN_ADMIN'].includes(promoterRole)) {
      return res.status(403).json({ error: 'Only CLI_ADMIN and LOGIN_ADMIN can promote users to SUPPORT_ADMIN.' });
    }

    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required.' });
    }

    // Get target user
    const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found.' });
    }

    // Check if user already has SA account
    const saUsername = `SA-${targetUser.username}`;
    const [existingSA] = await db.select().from(users).where(eq(users.username, saUsername)).limit(1);
    if (existingSA) {
      return res.status(400).json({ error: 'User already has a SUPPORT_ADMIN account.' });
    }

    // Generate credentials for SA account with SA- prefix
    const saPassword = `SA-${generateRandomToken(16)}`;
    const saPasscode = `SA-${generateRandomToken(8)}`;
    const saPanicPhrase = `SA-${generateRandomToken(12)}`;
    const saRecoveryKey = `SA-REC-${Math.floor(10000 + Math.random() * 90000)}`;
    const salt = generateRandomToken(16);

    const saPasswordHash = await hashArgon2id(saPassword, Buffer.from(salt, 'hex'));
    const saPasscodeHash = await hashArgon2id(saPasscode, Buffer.from(salt, 'hex'));
    const saPanicPhraseHash = await hashArgon2id(saPanicPhrase, Buffer.from(salt, 'hex'));
    const saRecoveryKeyHash = await hashArgon2id(saRecoveryKey, Buffer.from(salt, 'hex'));

    // Create SA account
    const [newSAUser] = await db.insert(users).values({
      username: saUsername,
      passwordHash: saPasswordHash,
      salt,
      passcodeHash: saPasscodeHash,
      panicPhraseHash: saPanicPhraseHash,
      recoveryKey: saRecoveryKey,
      recoveryKeyHash: saRecoveryKeyHash,
      role: 'SUPPORT_ADMIN',
      displayName: `Support Admin - ${targetUser.displayName || targetUser.username}`,
      recoveryKeyDelivered: true
    }).returning();

    // Send credentials to original user's VELUM bot DM
    const credentialMessage = `Congratulations! You have been promoted to Support Admin.\n\nYour new SUPPORT_ADMIN account credentials:\n\nUsername: ${saUsername}\nPassword: ${saPassword}\nPasscode: ${saPasscode}\nPanic Phrase: ${saPanicPhrase}\nRecovery Key: ${saRecoveryKey}\n\nUse these credentials to access the admin panel. Your original user account remains active. Store these credentials securely.`;
    await systemBot.sendToUser(targetUserId, credentialMessage);

    res.status(201).json({
      message: 'User promoted to SUPPORT_ADMIN successfully',
      saAccount: {
        username: saUsername,
        displayName: newSAUser.displayName,
        role: newSAUser.role
      }
    });
  } catch (err) {
    next(err);
  }
});
