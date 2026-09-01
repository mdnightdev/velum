import { Router } from 'express';
import { paymentController } from '../controllers/paymentController.js';
import { authMiddleware } from '../middleware/auth.js';

export const paymentRouter = Router();

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
