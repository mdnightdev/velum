import { Router } from 'express';
import { cardController } from '../controllers/cardController.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';

export const cardRouter = Router();

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

cardRouter.get('/card', authMiddleware, (req, res, next) => {
  cardController.getCard(req, res).catch(next);
});

cardRouter.post('/card', authMiddleware, (req, res, next) => {
  cardController.createCard(req, res).catch(next);
});

cardRouter.patch('/card/limit', authMiddleware, (req, res, next) => {
  cardController.updateLimit(req, res).catch(next);
});

cardRouter.patch('/card/active', authMiddleware, (req, res, next) => {
  cardController.toggleActive(req, res).catch(next);
});

cardRouter.get('/cards/all', authMiddleware, (req, res, next) => {
  cardController.getAllCards(req, res).catch(next);
});

cardRouter.get('/card/:cardToken', authMiddleware, (req, res, next) => {
  cardController.getCardByToken(req, res).catch(next);
});
