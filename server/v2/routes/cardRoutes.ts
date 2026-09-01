import { Router } from 'express';
import { cardController } from '../controllers/cardController.js';
import { authMiddleware } from '../middleware/auth.js';

export const cardRouter = Router();

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
