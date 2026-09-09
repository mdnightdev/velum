import { Router } from 'express';
import { webauthnController } from '../controllers/webauthnController.js';
import { authMiddleware } from '../middleware/auth.js';

export const webauthnRouter = Router();

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