import { Router } from 'express';
import { paymentController } from '../controllers/paymentController.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';

export const paymentRouter = Router();

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

paymentRouter.get('/methods', authMiddleware, (req, res, next) => {
  paymentController.getPaymentMethods(req, res).catch(next);
});

paymentRouter.post('/methods', authMiddleware, (req, res, next) => {
  paymentController.addMethod(req, res).catch(next);
});

paymentRouter.delete('/methods/:id', authMiddleware, (req, res, next) => {
  paymentController.deleteMethod(req, res).catch(next);
});

paymentRouter.post('/recharge', authMiddleware, (req, res, next) => {
  paymentController.recharge(req, res).catch(next);
});

paymentRouter.post('/withdraw', authMiddleware, (req, res, next) => {
  paymentController.withdraw(req, res).catch(next);
});

paymentRouter.post('/exchange', authMiddleware, (req, res, next) => {
  paymentController.exchange(req, res).catch(next);
});

paymentRouter.post('/card-charge', authMiddleware, (req, res, next) => {
  paymentController.chargeCard(req, res).catch(next);
});

paymentRouter.post('/wallet-deposit', authMiddleware, (req, res, next) => {
  paymentController.depositToWallet(req, res).catch(next);
});

paymentRouter.post('/card-withdrawal', authMiddleware, (req, res, next) => {
  paymentController.withdrawFromCard(req, res).catch(next);
});

paymentRouter.get('/transactions', authMiddleware, (req, res, next) => {
  paymentController.getPaymentTransactions(req, res).catch(next);
});

paymentRouter.get('/balances', authMiddleware, (req, res, next) => {
  paymentController.getUserBalances(req, res).catch(next);
});

paymentRouter.get('/currencies', authMiddleware, (req, res, next) => {
  paymentController.getCurrencies(req, res).catch(next);
});

paymentRouter.get('/rates', authMiddleware, (req, res, next) => {
  paymentController.getRates(req, res).catch(next);
});

export default paymentRouter;
