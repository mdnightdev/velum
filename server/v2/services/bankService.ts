import { bankRepository } from '../repositories/bankRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { NotFoundError, AppError } from '../utils/errors.js';
import { generateRandomToken } from '../utils/crypto.js';
import { db } from '../db/client.js';

export class BankService {
  async getBalance(userId: number, currency = 'USD') {
    let wallet = await bankRepository.findWalletByUserId(userId);
    if (!wallet) {
      wallet = await bankRepository.createWallet({
        userId,
        balance: '0.00',
        currency
      });
    }

    return {
      walletId: wallet.id,
      balance: parseFloat(wallet.balance),
      currency: wallet.currency
    };
  }

  async transferFunds(senderUserId: number, recipientUsername: string, amount: number, memo?: string) {
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
        recipientWallet = await bankRepository.createWallet({
          userId: recipient.id,
          balance: '0.00',
          currency: 'USD'
        }, tx);
      }

      const newSenderBal = (currentSenderBal - amount).toFixed(2);
      const newRecipientBal = (parseFloat(recipientWallet.balance) + amount).toFixed(2);

      await bankRepository.updateBalance(senderWallet.id, newSenderBal, tx);
      await bankRepository.updateBalance(recipientWallet.id, newRecipientBal, tx);

      const trcReference = `TRC-${generateRandomToken(6).toUpperCase()}`;

      const transaction = await bankRepository.createTransaction({
        reference: trcReference,
        walletId: senderWallet.id,
        type: 'TRANSFER',
        amount: amount.toFixed(2),
        status: 'COMPLETED',
        description: memo || `Transfer to user #${recipient.id}`
      }, tx);

      return {
        reference: transaction.reference,
        amount: parseFloat(transaction.amount),
        recipientUsername: recipient.username,
        createdAt: transaction.createdAt
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
      createdAt: entry.createdAt
    }));
  }
}

export const bankService = new BankService();
