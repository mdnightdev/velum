import { Router } from 'express';
import { bankController } from '../controllers/bankController.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';

export const bankRouter = Router();

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

bankRouter.get('/wallet', authMiddleware, (req, res, next) => {
  bankController.getWallet(req, res).catch(next);
});

bankRouter.get('/history', authMiddleware, (req, res, next) => {
  bankController.getHistory(req, res).catch(next);
});

bankRouter.post('/transfer', authMiddleware, (req, res, next) => {
  bankController.transfer(req, res).catch(next);
});

bankRouter.get('/accounts', authMiddleware, (req, res, next) => {
  bankController.getAllAccounts(req, res).catch(next);
});

bankRouter.get('/transactions', authMiddleware, (req, res, next) => {
  bankController.getAllTransactions(req, res).catch(next);
});

bankRouter.get('/withdrawals', authMiddleware, (req, res, next) => {
  bankController.getWithdrawalQueue(req, res).catch(next);
});

bankRouter.get('/limits', authMiddleware, (req, res, next) => {
  bankController.getLimits(req, res).catch(next);
});

bankRouter.get('/issued-cards', authMiddleware, (req, res, next) => {
  bankController.getIssuedCards(req, res).catch(next);
});

bankRouter.post('/accounts/:accountId/freeze', authMiddleware, (req, res, next) => {
  bankController.freezeAccount(req, res).catch(next);
});
