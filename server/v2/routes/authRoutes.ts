import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, updateProfileSchema } from '../schemas/auth.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';

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
