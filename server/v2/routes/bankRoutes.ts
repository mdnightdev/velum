import { Router } from 'express';
import { bankController } from '../controllers/bankController.js';
import { authMiddleware, requireAdminRole } from '../middleware/auth.js';

export const bankRouter = Router();

bankRouter.get('/wallet', authMiddleware, (req, res, next) => {
  bankController.getWallet(req, res).catch(next);
});

bankRouter.get('/history', authMiddleware, (req, res, next) => {
  bankController.getHistory(req, res).catch(next);
});

bankRouter.post('/transfer', authMiddleware, (req, res, next) => {
  bankController.transfer(req, res).catch(next);
});

bankRouter.get('/limits', authMiddleware, (req, res, next) => {
  bankController.getLimits(req, res).catch(next);
});

// Elevated Banking Administration Endpoints
bankRouter.get('/accounts', authMiddleware, requireAdminRole(), (req, res, next) => {
  bankController.getAllAccounts(req, res).catch(next);
});

bankRouter.get('/transactions', authMiddleware, requireAdminRole(), (req, res, next) => {
  bankController.getAllTransactions(req, res).catch(next);
});

bankRouter.get('/withdrawals', authMiddleware, requireAdminRole(), (req, res, next) => {
  bankController.getWithdrawalQueue(req, res).catch(next);
});

bankRouter.get('/issued-cards', authMiddleware, requireAdminRole(), (req, res, next) => {
  bankController.getIssuedCards(req, res).catch(next);
});

bankRouter.post('/accounts/:accountId/freeze', authMiddleware, requireAdminRole(), (req, res, next) => {
  bankController.freezeAccount(req, res).catch(next);
});

