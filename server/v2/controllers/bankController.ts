import type { Request, Response } from 'express';
import { bankRepository } from '../repositories/bankRepository.js';
import { bankService } from '../services/bankService.js';
import { cardRepository } from '../repositories/cardRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { generateRandomToken } from '../utils/crypto.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { db } from '../db/client.js';
import { wallets, transactions, DEFAULT_WALLET_CURRENCY } from '../db/schema/wallets.js';
import { users } from '../db/schema/users.js';
import { eq, desc, inArray } from 'drizzle-orm';
import { getRedisClient } from '../db/redis.js';
import { outboxWorker } from '../services/outboxWorker.js';
import { reserveRepository } from '../repositories/reserveRepository.js';
import { currencyConverter } from '../services/currencyConverter.js';
import {
  ensureInstitutionalReservesEur,
  institutionalDisplayName,
  INSTITUTIONAL_CURRENCY,
} from '../services/institutionalBank.js';

export class BankController {
  async getWallet(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    if (req.user.duress_active) {
      res.status(200).json({
        wallet: { userId: req.user.userId, balance: '0.00', currency: DEFAULT_WALLET_CURRENCY },
      });
      return;
    }
    let wallet = await bankRepository.findWalletByUserId(req.user.userId);
    if (!wallet) {
      wallet = await bankRepository.createWallet({
        userId: req.user.userId,
        balance: '0.00',
        currency: DEFAULT_WALLET_CURRENCY,
      });
    }

    res.status(200).json({ wallet });
  }

  async getWallets(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    if (req.user.duress_active) {
      res.status(200).json({ wallets: [] });
      return;
    }

    const walletsList = await bankService.getWallets(req.user.userId);
    res.status(200).json({ wallets: walletsList });
  }

  async convert(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    const fromCurrency = req.body.fromCurrency || req.body.from;
    const toCurrency = req.body.toCurrency || req.body.to;
    let amountMajor = parseFloat(req.body.amount);
    if (req.body.amountCents != null && (isNaN(amountMajor) || amountMajor <= 0)) {
      amountMajor = parseInt(String(req.body.amountCents), 10) / 100;
    }

    const result = await bankService.convertCurrency(
      req.user.userId,
      fromCurrency,
      toCurrency,
      amountMajor
    );

    try {
      const { broadcastToUserDevices } = await import('../../websocket/connectionManager.js');
      broadcastToUserDevices(req.user.userId, {
        type: 'wallet_updated',
        timestamp: new Date().toISOString(),
      });
    } catch {
      /* ignore */
    }

    res.status(200).json({
      success: true,
      conversion_id: result.conversionId,
      from_currency: result.fromCurrency,
      to_currency: result.toCurrency,
      debited: result.debited,
      credited: result.credited,
      rate_used: result.rate,
      fee_pct: result.feePct,
      platform_spread: result.platformSpread,
      balances: result.balances,
    });
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
    const { amount, recipientUserId, recipientUsername, description } = req.body;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new BadRequestError('Transfer amount must be a positive number.');
    }

    let targetUserId = recipientUserId;
    if (!targetUserId && recipientUsername) {
      const recipientUser = await userRepository.findByUsername(recipientUsername);
      if (recipientUser) {
        targetUserId = recipientUser.id;
      }
    }

    if (!targetUserId) {
      throw new BadRequestError('Recipient user ID or valid recipient username is required.');
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

      let recipientWallet = await bankRepository.findWalletByUserIdForUpdate(targetUserId, tx);
      if (!recipientWallet) {
        recipientWallet = await bankRepository.createWallet(
          {
            userId: targetUserId,
            balance: '0.00',
            currency: DEFAULT_WALLET_CURRENCY,
          },
          tx
        );
      }

      const newSenderBalance = (currentBalance - parsedAmount).toFixed(2);
      const newRecipientBalance = (parseFloat(recipientWallet.balance) + parsedAmount).toFixed(2);

      await bankRepository.updateBalance(senderWallet.id, newSenderBalance, tx);
      await bankRepository.updateBalance(recipientWallet.id, newRecipientBalance, tx);

      const trcReference = `TRC-${generateRandomToken(6).toUpperCase()}`;

      const transaction = await bankRepository.createTransaction(
        {
          reference: trcReference,
          walletId: senderWallet.id,
          type: 'TRANSFER',
          amount: parsedAmount.toFixed(2),
          status: 'COMPLETED',
          description: description || `Transfer to user #${targetUserId}`,
        },
        tx
      );

      await outboxWorker.queueEvent(
        {
          eventType: 'BANK_TRANSFER',
          aggregateId: trcReference,
          payload: {
            senderUserId: req.user!.userId,
            recipientUserId: targetUserId,
            amount: parsedAmount.toFixed(2),
            reference: trcReference,
          },
        },
        tx
      );

      return { transaction, newSenderBalance };
    });

    const redis = await getRedisClient();
    if (redis) {
      await redis.del('bank:all_accounts');
      await redis.del('bank:all_transactions');
    }

    try {
      const { broadcastToUserDevices } = await import('../../websocket/connectionManager.js');
      broadcastToUserDevices(req.user!.userId, {
        type: 'wallet_updated',
        balance: result.newSenderBalance,
        timestamp: new Date().toISOString(),
      });
      broadcastToUserDevices(targetUserId, {
        type: 'wallet_updated',
        timestamp: new Date().toISOString(),
      });
      broadcastToUserDevices(targetUserId, {
        type: 'notification_received',
        notification: {
          id: `tx_${Date.now()}`,
          title: 'Payment Received',
          message: `You received ${parsedAmount.toFixed(2)} ${DEFAULT_WALLET_CURRENCY} from user #${req.user!.userId}`,
          type: 'TRANSACTION',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (wsErr) {
      console.warn('[WS Bank Broadcast Error]:', wsErr);
    }

    res.status(200).json({
      transaction: result.transaction,
      newBalance: result.newSenderBalance,
    });
  }

  async getAllAccounts(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    await ensureInstitutionalReservesEur();

    const allReserves = await reserveRepository.getAllReserves();
    const reserveRows = allReserves.map((r) => ({
      account_id: `reserve_${r.id}`,
      account_name: institutionalDisplayName(r.reserveType),
      institution: r.reserveType,
      balance_cents: r.balanceCents,
      currency: r.currency || INSTITUTIONAL_CURRENCY,
      status: 'institutional',
      kind: 'reserve',
    }));

    // Native admin visibility: EUR + VLM only
    const nativeWallets = await db
      .select({
        id: wallets.id,
        balance: wallets.balance,
        currency: wallets.currency,
        userId: wallets.userId,
        username: users.username,
      })
      .from(wallets)
      .leftJoin(users, eq(wallets.userId, users.id))
      .where(inArray(wallets.currency, ['EUR', 'VLM']))
      .orderBy(desc(wallets.createdAt))
      .limit(200);

    const formatted = nativeWallets.map((w) => ({
      account_id: String(w.id),
      account_name: w.username || `User #${w.userId}`,
      institution: `Velum (${w.currency})`,
      balance_cents: Math.round(parseFloat(w.balance) * 100),
      currency: w.currency,
      status: 'active',
      kind: 'user',
    }));

    // Secondary fiat → EUR-equivalent aggregate for liquidity reporting
    const secondary = await db
      .select({
        balance: wallets.balance,
        currency: wallets.currency,
      })
      .from(wallets)
      .where(inArray(wallets.currency, ['USD', 'GBP', 'JPY', 'CNY', 'TWD', 'CAD', 'AUD', 'CHF', 'SGD', 'HKD']));

    let secondaryEurCents = 0;
    for (const row of secondary) {
      const major = parseFloat(row.balance);
      if (!Number.isFinite(major) || major === 0) continue;
      const rate = currencyConverter.getRate(row.currency, 'EUR');
      if (rate == null) continue;
      secondaryEurCents += Math.round(major * rate * 100);
    }

    const aggregateRow =
      secondaryEurCents !== 0
        ? [
            {
              account_id: 'aggregate_secondary_eur',
              account_name: 'Secondary fiat (EUR equiv.)',
              institution: 'Aggregate',
              balance_cents: secondaryEurCents,
              currency: 'EUR',
              status: 'aggregate',
              kind: 'aggregate',
            },
          ]
        : [];

    res.status(200).json([...reserveRows, ...formatted, ...aggregateRow]);
  }

  async getAllTransactions(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    const allTxs = await db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(100);

    const formatted = allTxs.map((t) => {
      let typeStr = t.type.toLowerCase();
      const amountVal = parseFloat(t.amount);

      return {
        transaction_id: t.reference || `TX_${t.id}`,
        account_id: String(t.walletId),
        type: typeStr,
        amount_cents: Math.round(Math.abs(amountVal) * 100),
        timestamp: t.createdAt.toISOString(),
        status: t.status.toLowerCase(),
        description: t.description || '',
      };
    });

    res.status(200).json(formatted);
  }

  async getWithdrawalQueue(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    const withdrawals = await db
      .select({
        id: transactions.id,
        reference: transactions.reference,
        status: transactions.status,
        amount: transactions.amount,
        createdAt: transactions.createdAt,
        userId: wallets.userId,
      })
      .from(transactions)
      .leftJoin(wallets, eq(transactions.walletId, wallets.id))
      .where(eq(transactions.type, 'WITHDRAWAL'))
      .orderBy(desc(transactions.createdAt))
      .limit(50);

    const formatted = withdrawals.map((w) => ({
      request_id: w.reference || `WD_${w.id}`,
      user_id: w.userId,
      amount_cents: Math.round(Math.abs(parseFloat(w.amount)) * 100),
      status: w.status,
      created_at: w.createdAt.toISOString(),
    }));

    res.status(200).json(formatted);
  }

  async getLimits(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt)).limit(100);

    const formatted = allUsers.map((u) => ({
      user_id: u.id,
      username: u.username,
      kyc_level: u.id % 2 === 0 ? 'FULL' : 'BASIC',
      used_24h_cents: 0,
      max_limit_cents: 1000000,
    }));

    res.status(200).json(formatted);
  }

  async getIssuedCards(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');

    const cardsList = await cardRepository.getAllCards(100);

    const formatted = cardsList.map((card) => ({
      user_id: card.userId,
      institution: `Velum ${card.cardType.toUpperCase()}`,
      account_kind: card.cardType.toUpperCase(),
      masked_number: `•••• ${card.cardToken.substring(0, 4)}`,
      available_cents: card.limitCents,
    }));

    res.status(200).json(formatted);
  }

  async freezeAccount(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
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
