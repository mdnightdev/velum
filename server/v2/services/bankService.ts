import { bankRepository } from '../repositories/bankRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { NotFoundError, AppError, BadRequestError } from '../utils/errors.js';
import { generateRandomToken } from '../utils/crypto.js';
import { db } from '../db/client.js';
import { currencyConverter } from './currencyConverter.js';
import {
  DEFAULT_WALLET_CURRENCY,
  WALLET_CURRENCIES,
} from '../db/schema/wallets.js';

export class BankService {
  async getBalance(userId: number, currency = DEFAULT_WALLET_CURRENCY) {
    let wallet = await bankRepository.findWalletByUserIdAndCurrency(userId, currency);
    if (!wallet) {
      wallet = await bankRepository.createWallet({
        userId,
        balance: '0.00',
        currency,
      });
    }

    return {
      walletId: wallet.id,
      balance: parseFloat(wallet.balance),
      currency: wallet.currency,
    };
  }

  async getWallets(userId: number) {
    const rows = await bankRepository.ensureCurrencyWallets(userId);
    return rows.map((w) => ({
      id: w.id,
      userId: w.userId,
      currency: w.currency,
      balance: w.balance,
      balanceCents: Math.round(parseFloat(w.balance) * 100),
      isPrimary: w.currency === 'EUR',
      isPlatformNative: w.currency === 'VLM',
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));
  }

  /**
   * Atomic FX convert with double-entry ledger under shared pair id `exc_<token>`.
   * Debit and credit legs use unique references (`exc_<token>_d` / `exc_<token>_c`).
   */
  async convertCurrency(
    userId: number,
    fromCurrency: string,
    toCurrency: string,
    amountMajor: number
  ) {
    const from = String(fromCurrency || '').toUpperCase();
    const to = String(toCurrency || '').toUpperCase();

    if (!(WALLET_CURRENCIES as readonly string[]).includes(from)) {
      throw new BadRequestError(`Unsupported source currency: ${from}`);
    }
    if (!(WALLET_CURRENCIES as readonly string[]).includes(to)) {
      throw new BadRequestError(`Unsupported destination currency: ${to}`);
    }
    if (from === to) {
      throw new BadRequestError('Source and destination currency must differ.');
    }
    if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
      throw new BadRequestError('Amount must be a positive number.');
    }

    const amountCents = Math.round(amountMajor * 100);
    const { rate, grossConverted, platformSpread, netCredited, feePct } =
      currencyConverter.calculateExchange(amountCents, from, to);

    const pairId = `exc_${generateRandomToken(10).toLowerCase()}`;

    return db.transaction(async (tx) => {
      await bankRepository.ensureCurrencyWallets(userId, tx);

      const fromWallet = await bankRepository.findWalletByUserIdAndCurrencyForUpdate(
        userId,
        from,
        tx
      );
      const toWallet = await bankRepository.findWalletByUserIdAndCurrencyForUpdate(
        userId,
        to,
        tx
      );
      if (!fromWallet || !toWallet) {
        throw new NotFoundError('Wallet accounts missing for conversion.');
      }

      const debitMajor = amountCents / 100;
      const creditMajor = netCredited / 100;
      const fromBal = parseFloat(fromWallet.balance);
      if (fromBal < debitMajor) {
        throw new BadRequestError('Insufficient balance for conversion.');
      }

      const newFrom = (fromBal - debitMajor).toFixed(2);
      const newTo = (parseFloat(toWallet.balance) + creditMajor).toFixed(2);

      await bankRepository.updateBalance(fromWallet.id, newFrom, tx);
      await bankRepository.updateBalance(toWallet.id, newTo, tx);

      await bankRepository.createTransaction(
        {
          reference: `${pairId}_d`.slice(0, 32),
          walletId: fromWallet.id,
          type: 'EXCHANGE_OUT',
          amount: debitMajor.toFixed(2),
          status: 'COMPLETED',
          description: `${pairId}: debit ${debitMajor.toFixed(2)} ${from} → ${to} (fee ${feePct * 100}%)`,
        },
        tx
      );

      await bankRepository.createTransaction(
        {
          reference: `${pairId}_c`.slice(0, 32),
          walletId: toWallet.id,
          type: 'EXCHANGE_IN',
          amount: creditMajor.toFixed(2),
          status: 'COMPLETED',
          description: `${pairId}: credit ${creditMajor.toFixed(2)} ${to} from ${from} (spread ${(platformSpread / 100).toFixed(2)} ${to})`,
        },
        tx
      );

      return {
        conversionId: pairId,
        fromCurrency: from,
        toCurrency: to,
        debited: debitMajor,
        credited: creditMajor,
        rate,
        feePct,
        platformSpread: platformSpread / 100,
        grossConverted: grossConverted / 100,
        balances: [
          { currency: from, balance: newFrom, balanceCents: Math.round(parseFloat(newFrom) * 100) },
          { currency: to, balance: newTo, balanceCents: Math.round(parseFloat(newTo) * 100) },
        ],
      };
    });
  }

  async transferFunds(
    senderUserId: number,
    recipientUsername: string,
    amount: number,
    memo?: string
  ) {
    if (amount <= 0) {
      throw new AppError('Transfer amount must be strictly greater than 0', 400);
    }

    const recipient = await userRepository.findByUsername(recipientUsername);
    if (!recipient) {
      throw new NotFoundError(`Recipient username '${recipientUsername}' not found`);
    }

    if (recipient.id === senderUserId) {
      throw new AppError('Cannot transfer funds to yourself', 400);
    }

    return db.transaction(async (tx) => {
      const senderWallet = await bankRepository.findWalletByUserIdForUpdate(senderUserId, tx);
      if (!senderWallet) {
        throw new NotFoundError('Sender wallet not found');
      }

      const currentSenderBal = parseFloat(senderWallet.balance);
      if (currentSenderBal < amount) {
        throw new AppError('Insufficient funds for transfer', 400);
      }

      let recipientWallet = await bankRepository.findWalletByUserIdForUpdate(recipient.id, tx);
      if (!recipientWallet) {
        recipientWallet = await bankRepository.createWallet(
          {
            userId: recipient.id,
            balance: '0.00',
            currency: DEFAULT_WALLET_CURRENCY,
          },
          tx
        );
      }

      const newSenderBal = (currentSenderBal - amount).toFixed(2);
      const newRecipientBal = (parseFloat(recipientWallet.balance) + amount).toFixed(2);

      await bankRepository.updateBalance(senderWallet.id, newSenderBal, tx);
      await bankRepository.updateBalance(recipientWallet.id, newRecipientBal, tx);

      const trcReference = `TRC-${generateRandomToken(6).toUpperCase()}`;

      const transaction = await bankRepository.createTransaction(
        {
          reference: trcReference,
          walletId: senderWallet.id,
          type: 'TRANSFER',
          amount: amount.toFixed(2),
          status: 'COMPLETED',
          description: memo || `Transfer to user #${recipient.id}`,
        },
        tx
      );

      return {
        reference: transaction.reference,
        amount: parseFloat(transaction.amount),
        recipientUsername: recipient.username,
        createdAt: transaction.createdAt,
      };
    });
  }

  async getTransactionHistory(userId: number, limit = 50) {
    const wallet = await bankRepository.findWalletByUserId(userId);
    if (!wallet) return [];

    const entries = await bankRepository.getTransactionHistory(wallet.id, limit);
    return entries.map((entry) => ({
      reference: entry.reference,
      amount: parseFloat(entry.amount),
      type: entry.type,
      status: entry.status,
      description: entry.description,
      createdAt: entry.createdAt,
    }));
  }
}

export const bankService = new BankService();
