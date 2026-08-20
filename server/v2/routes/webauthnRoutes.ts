import { Router } from 'express';
import { webauthnController } from '../controllers/webauthnController.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';

export const webauthnRouter = Router();

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

// Registration endpoints (require auth)
webauthnRouter.post('/register/options', authMiddleware, (req, res, next) => {
  webauthnController.generateRegistrationOptions(req, res).catch(next);
});

webauthnRouter.post('/register/verify', authMiddleware, (req, res, next) => {
  webauthnController.verifyRegistration(req, res).catch(next);
});

// Authentication endpoints (public)
webauthnRouter.post('/authenticate/options', (req, res, next) => {
  webauthnController.generateAuthenticationOptions(req, res).catch(next);
});

webauthnRouter.post('/authenticate/verify', (req, res, next) => {
  webauthnController.verifyAuthentication(req, res).catch(next);
});

// Passkey management endpoints (require auth)
webauthnRouter.get('/passkeys', authMiddleware, (req, res, next) => {
  webauthnController.getPasskeys(req, res).catch(next);
});

webauthnRouter.delete('/passkeys/:credentialId', authMiddleware, (req, res, next) => {
  webauthnController.deletePasskey(req, res).catch(next);
});

webauthnRouter.patch('/passkeys/:credentialId/nickname', authMiddleware, (req, res, next) => {
  webauthnController.updatePasskeyNickname(req, res).catch(next);
});