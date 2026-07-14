import express from 'express';
import { authenticateUser } from '../middleware.js';
import {
  getWalletAndIdentity,
  submitKyc,
  processKycReview,
  getPaymentMethods,
  addPaymentMethod,
  removePaymentMethod,
  rechargeWallet,
  requestWithdrawal,
  processWithdrawalReview,
  getLedgerHistory,
  getExternalProcessorEvents,
  getWithdrawalsHistory,
  getCurrencies,
  getWalletBalances,
  getExchangeRates,
  exchangeCurrencyAction,
  updateSimulatedAccountBalance,}
   from '../controllers/payments.js';

export const paymentsRouter = express.Router();

paymentsRouter.get('/payments/currencies', authenticateUser, getCurrencies);
paymentsRouter.get('/payments/balances', authenticateUser, getWalletBalances);
paymentsRouter.get('/payments/rates', authenticateUser, getExchangeRates);
paymentsRouter.post('/payments/exchange', authenticateUser, exchangeCurrencyAction);

paymentsRouter.get('/payments/wallet', authenticateUser, getWalletAndIdentity);
paymentsRouter.post('/payments/kyc', authenticateUser, submitKyc);
paymentsRouter.post('/payments/kyc/review', authenticateUser, processKycReview);

paymentsRouter.get('/payments/methods', authenticateUser, getPaymentMethods);
paymentsRouter.post('/payments/methods', authenticateUser, addPaymentMethod);
paymentsRouter.delete('/payments/methods/:methodId', authenticateUser, removePaymentMethod);
paymentsRouter.put('/payments/methods/balance', authenticateUser, updateSimulatedAccountBalance);


paymentsRouter.post('/payments/recharge', authenticateUser, rechargeWallet);
paymentsRouter.post('/payments/withdraw', authenticateUser, requestWithdrawal);
paymentsRouter.post('/payments/withdraw/review', authenticateUser, processWithdrawalReview);

paymentsRouter.get('/payments/ledger', authenticateUser, getLedgerHistory);
paymentsRouter.get('/payments/processor-events', authenticateUser, getExternalProcessorEvents);
paymentsRouter.get('/payments/withdrawals', authenticateUser, getWithdrawalsHistory);
