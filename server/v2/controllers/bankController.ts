import type { Request, Response } from 'express';
import { bankRepository } from '../repositories/bankRepository.js';
import { cardRepository } from '../repositories/cardRepository.js';
import { generateRandomToken } from '../utils/crypto.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { db } from '../db/client.js';
import { wallets, transactions } from '../db/schema/wallets.js';
import { users } from '../db/schema/users.js';
import { eq, desc } from 'drizzle-orm';
import { getRedisClient } from '../db/redis.js';

import { outboxWorker } from '../services/outboxWorker.js';

export class BankController {
  async getWallet(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    if (req.user.duress_active) {
      res.status(200).json({ wallet: { userId: req.user.userId, balance: '0.00', currency: 'USD' } });
      return;
    }
    let wallet = await bankRepository.findWalletByUserId(req.user.userId);
    if (!wallet) {
      wallet = await bankRepository.createWallet({
        userId: req.user.userId,
        balance: '0.00',
        currency: 'USD'
      });
    }

    res.status(200).json({ wallet });
  }

  async getHistory(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    if (req.user.duress_active) {
      res.status(200).json({ transactions: [] });
      return;
    }
    const wallet = await bankRepository.findWalletByUserId(req.user.userId);
    if (!wallet) {
      res.status(200).json({ transactions: [] });
      return;
    }

    const history = await bankRepository.getTransactionHistory(wallet.id, 50);
    res.status(200).json({ transactions: history });
  }

  async transfer(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    const { amount, recipientUserId, description } = req.body;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new BadRequestError('Transfer amount must be a positive number.');
    }

    const result = await db.transaction(async (tx) => {
      const senderWallet = await bankRepository.findWalletByUserIdForUpdate(req.user!.userId, tx);
      if (!senderWallet) {
        throw new NotFoundError('Sender wallet not found.');
      }

      const currentBalance = parseFloat(senderWallet.balance);
      if (currentBalance < parsedAmount) {
        throw new BadRequestError('Insufficient funds for transfer.');
      }

      const recipientWallet = await bankRepository.findWalletByUserIdForUpdate(recipientUserId, tx);
      if (!recipientWallet) {
        throw new NotFoundError('Recipient wallet not found.');
      }

      const newSenderBalance = (currentBalance - parsedAmount).toFixed(2);
      const newRecipientBalance = (parseFloat(recipientWallet.balance) + parsedAmount).toFixed(2);

      await bankRepository.updateBalance(senderWallet.id, newSenderBalance, tx);
      await bankRepository.updateBalance(recipientWallet.id, newRecipientBalance, tx);

      const trcReference = `TRC-${generateRandomToken(6).toUpperCase()}`;

      const transaction = await bankRepository.createTransaction({
        reference: trcReference,
        walletId: senderWallet.id,
        type: 'TRANSFER',
        amount: parsedAmount.toFixed(2),
        status: 'COMPLETED',
        description: description || `Transfer to user #${recipientUserId}`
      }, tx);

      await outboxWorker.queueEvent({
        eventType: 'BANK_TRANSFER',
        aggregateId: trcReference,
        payload: {
          senderUserId: req.user!.userId,
          recipientUserId,
          amount: parsedAmount.toFixed(2),
          reference: trcReference
        }
      }, tx);

      return { transaction, newSenderBalance };
    });

    // Invalidate cache after successful transfer
    const redis = await getRedisClient();
    if (redis) {
      await redis.del('bank:all_accounts');
      await redis.del('bank:all_transactions');
    }

    res.status(200).json({
      transaction: result.transaction,
      newBalance: result.newSenderBalance
    });
  }

  async getAllAccounts(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    if (req.user.role !== 'CLI_ADMIN' && req.user.role !== 'LOGIN_ADMIN' && req.user.role !== 'SUPPORT_ADMIN') {
      throw new BadRequestError('Unauthorized access.');
    }

    const allWallets = await db.select({
      id: wallets.id,
      balance: wallets.balance,
      currency: wallets.currency,
      userId: wallets.userId,
      username: users.username
    })
    .from(wallets)
    .leftJoin(users, eq(wallets.userId, users.id))
    .orderBy(desc(wallets.createdAt))
    .limit(100);

    const formatted = allWallets.map(w => ({
      account_id: String(w.id),
      account_name: w.username || `User #${w.userId}`,
      institution: `Velum Vault (${w.currency})`,
      balance_cents: Math.round(parseFloat(w.balance) * 100),
      status: 'active'
    }));

    res.status(200).json(formatted);
  }

  async getAllTransactions(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    if (req.user.role !== 'CLI_ADMIN' && req.user.role !== 'LOGIN_ADMIN' && req.user.role !== 'SUPPORT_ADMIN') {
      throw new BadRequestError('Unauthorized access.');
    }

    const allTxs = await db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(100);

    const formatted = allTxs.map(t => {
      let typeStr = t.type.toLowerCase();
      if (typeStr === 'deposit') typeStr = 'deposit';
      if (typeStr === 'withdrawal') typeStr = 'withdrawal';
      
      const amountVal = parseFloat(t.amount);
      
      return {
        transaction_id: t.reference || `TX_${t.id}`,
        account_id: String(t.walletId),
        type: typeStr,
        amount_cents: Math.round(Math.abs(amountVal) * 100),
        timestamp: t.createdAt.toISOString(),
        status: t.status.toLowerCase(),
        description: t.description || ''
      };
    });

    res.status(200).json(formatted);
  }

  async getWithdrawalQueue(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    if (req.user.role !== 'CLI_ADMIN' && req.user.role !== 'LOGIN_ADMIN' && req.user.role !== 'SUPPORT_ADMIN') {
      throw new BadRequestError('Unauthorized access.');
    }

    const withdrawals = await db.select({
      id: transactions.id,
      reference: transactions.reference,
      status: transactions.status,
      amount: transactions.amount,
      createdAt: transactions.createdAt,
      userId: wallets.userId
    })
    .from(transactions)
    .leftJoin(wallets, eq(transactions.walletId, wallets.id))
    .where(eq(transactions.type, 'WITHDRAWAL'))
    .orderBy(desc(transactions.createdAt))
    .limit(50);

    const formatted = withdrawals.map(w => ({
      request_id: w.reference || `WD_${w.id}`,
      user_id: w.userId,
      amount_cents: Math.round(Math.abs(parseFloat(w.amount)) * 100),
      status: w.status,
      created_at: w.createdAt.toISOString()
    }));

    res.status(200).json(formatted);
  }

  async getLimits(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    if (req.user.role !== 'CLI_ADMIN' && req.user.role !== 'LOGIN_ADMIN' && req.user.role !== 'SUPPORT_ADMIN') {
      throw new BadRequestError('Unauthorized access.');
    }

    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt)).limit(100);

    const formatted = allUsers.map(u => ({
      user_id: u.id,
      username: u.username,
      kyc_level: u.id % 2 === 0 ? 'FULL' : 'BASIC',
      used_24h_cents: 0,
      max_limit_cents: 1000000 // $10,000
    }));

    res.status(200).json(formatted);
  }

  async getIssuedCards(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    if (req.user.role !== 'CLI_ADMIN' && req.user.role !== 'LOGIN_ADMIN' && req.user.role !== 'SUPPORT_ADMIN') {
      throw new BadRequestError('Unauthorized access.');
    }

    const cardsList = await cardRepository.getAllCards(100);

    const formatted = cardsList.map(card => ({
      user_id: card.userId,
      institution: `Velum ${card.cardType.toUpperCase()} (Vault)`,
      account_kind: card.cardType.toUpperCase(),
      masked_number: `•••• ${card.cardToken.substring(0, 4)}`,
      available_cents: card.limitCents
    }));

    res.status(200).json(formatted);
  }

  async freezeAccount(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    if (req.user.role !== 'CLI_ADMIN' && req.user.role !== 'LOGIN_ADMIN' && req.user.role !== 'SUPPORT_ADMIN') {
      throw new BadRequestError('Unauthorized access.');
    }
    const { accountId } = req.params;
    res.status(200).json({ success: true, message: `Account ${accountId} status updated.` });
  }

  async invalidateCache() {
    const redis = await getRedisClient();
    if (redis) {
      await redis.del('bank:all_accounts');
      await redis.del('bank:all_transactions');
      await redis.del('bank:withdrawal_queue');
      await redis.del('bank:issued_cards');
    }
  }
}

export const bankController = new BankController();
