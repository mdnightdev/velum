import express from 'express';
import { authenticateAdmin } from '../middleware.js';
import {
  getBankStatus,
  getBankAccounts,
  getBankTransactions,
  createBankAccount,
  adjustBankAccountBalance,
  freezeBankAccount,
  getWithdrawalQueue,
  getLimitsMonitoring,
  getIssuedCards
} from '../controllers/bank.js';

export const bankRouter = express.Router();

// All bank endpoints require admin privileges
bankRouter.get('/bank/status', authenticateAdmin, getBankStatus);
bankRouter.get('/bank/accounts', authenticateAdmin, getBankAccounts);
bankRouter.get('/bank/transactions', authenticateAdmin, getBankTransactions);
bankRouter.post('/bank/accounts', authenticateAdmin, createBankAccount);
bankRouter.post('/bank/accounts/:id/adjust', authenticateAdmin, adjustBankAccountBalance);
bankRouter.post('/bank/accounts/:id/freeze', authenticateAdmin, freezeBankAccount);

// Payment Queue & Limits Monitoring
bankRouter.get('/bank/withdrawals', authenticateAdmin, getWithdrawalQueue);
bankRouter.get('/bank/limits', authenticateAdmin, getLimitsMonitoring);

bankRouter.get('/bank/issued-cards', authenticateAdmin, getIssuedCards);
