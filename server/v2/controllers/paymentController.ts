import type { Request, Response } from 'express';
import { bankRepository } from '../repositories/bankRepository.js';
import { cardRepository } from '../repositories/cardRepository.js';
import { reserveRepository } from '../repositories/reserveRepository.js';
import { generateRandomToken } from '../utils/crypto.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { db } from '../db/client.js';
import { cards } from '../db/schema/cards.js';
import { wallets } from '../db/schema/wallets.js';
import { eq, and } from 'drizzle-orm';
import { currencyConverter } from '../services/currencyConverter.js';
import {
  ensureInstitutionalLiquidity,
  RESERVE_VCB,
  RESERVE_SENTRY,
  WITHDRAWAL_FEE_PCT,
  INSTITUTIONAL_CURRENCY,
} from '../services/institutionalBank.js';

const broadcastUserWalletUpdate = async (userId: number, balance?: string) => {
  try {
    const { broadcastToUserDevices } = await import('../../websocket/connectionManager.js');
    broadcastToUserDevices(userId, {
      type: 'wallet_updated',
      balance,
      timestamp: new Date().toISOString()
    });
  } catch (wsErr) {
    console.warn('[WS Payment Wallet Broadcast Error]:', wsErr);
  }
};

export class PaymentController {
  async getPaymentMethods(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    
    if (req.user.duress_active) {
      res.status(200).json({ methods: [] });
      return;
    }
    
    const userCards = await db.select().from(cards).where(eq(cards.userId, req.user.userId));
    
    const methods = [];
    for (const card of userCards) {
      if (!card.isActive) continue;
      
      let category = 'CARD';
      let issuer = card.cardType;
      
      if (card.cardType.includes(':')) {
        const parts = card.cardType.split(':');
        category = parts[0];
        issuer = parts[1];
      } else {
        category = card.cardType === 'BANK_ACCOUNT' ? 'BANK' : 'CARD';
      }

      methods.push({
        payment_method_id: `card_${card.id}`,
        display_label: `${issuer} (${category})`,
        method_type: category === 'BANK' ? 'BANK_ACCOUNT' : 'CARD',
        institution: issuer,
        cardType: issuer,
        cardToken: card.cardToken,
        limitCents: card.limitCents,
        availableCents: card.limitCents
      });
    }
    
    res.status(200).json({ methods });
  }

  async chargeCard(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    const { amountCents, description } = req.body;
    
    const parsedAmount = parseInt(amountCents, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new BadRequestError('Amount must be a positive number in cents.');
    }
    
    const card = await cardRepository.findCardByUserId(req.user.userId);
    if (!card || !card.isActive) {
      throw new NotFoundError('Active card not found.');
    }
    
    if (card.limitCents < parsedAmount) {
      throw new BadRequestError('Insufficient card limit.');
    }
    
    const updated = await cardRepository.updateLimit(card.id, card.limitCents - parsedAmount);
    if (!updated) {
      throw new NotFoundError('Failed to update card limit.');
    }
    
    res.status(200).json({
      success: true,
      chargedCents: parsedAmount,
      remainingLimitCents: updated.limitCents,
      cardToken: card.cardToken
    });
  }

  async depositToWallet(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    const { amount, source, description } = req.body;
    
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new BadRequestError('Amount must be a positive number.');
    }
    
    const result = await db.transaction(async (tx) => {
      let wallet = await bankRepository.findWalletByUserId(req.user!.userId, tx);
      if (!wallet) {
        wallet = await bankRepository.createWallet({
          userId: req.user!.userId,
          balance: '0.00',
          currency: 'EUR'
        }, tx);
      }
      
      const currentBalance = parseFloat(wallet.balance);
      const newBalance = (currentBalance + parsedAmount).toFixed(2);
      
      await bankRepository.updateBalance(wallet.id, newBalance, tx);
      
      const transaction = await bankRepository.createTransaction({
        reference: `DEP-${generateRandomToken(6).toUpperCase()}`,
        walletId: wallet.id,
        type: 'DEPOSIT',
        amount: parsedAmount.toFixed(2),
        status: 'COMPLETED',
        description: description || `Deposit from ${source || 'external'}`
      }, tx);
      
      return { transaction, newBalance };
    });
    
    broadcastUserWalletUpdate(req.user!.userId, result.newBalance);

    res.status(200).json({
      success: true,
      transaction: result.transaction,
      newBalance: result.newBalance
    });
  }

  async withdrawFromCard(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    const { amountCents } = req.body;
    
    const parsedAmount = parseInt(amountCents, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new BadRequestError('Amount must be a positive number in cents.');
    }
    
    const result = await db.transaction(async (tx) => {
      const card = await cardRepository.findCardByUserId(req.user!.userId, tx);
      if (!card || !card.isActive) {
        throw new NotFoundError('Active card not found.');
      }
      
      if (card.limitCents < parsedAmount) {
        throw new BadRequestError('Insufficient card limit.');
      }
      
      const updatedCard = await cardRepository.updateLimit(card.id, card.limitCents - parsedAmount, tx);
      if (!updatedCard) {
        throw new NotFoundError('Failed to update card limit.');
      }
      
      let wallet = await bankRepository.findWalletByUserId(req.user!.userId, tx);
      if (!wallet) {
        wallet = await bankRepository.createWallet({
          userId: req.user!.userId,
          balance: '0.00',
          currency: 'EUR'
        }, tx);
      }
      
      const currentBalance = parseFloat(wallet.balance);
      const depositAmount = parsedAmount / 100;
      const newBalance = (currentBalance + depositAmount).toFixed(2);
      
      await bankRepository.updateBalance(wallet.id, newBalance, tx);
      
      const transaction = await bankRepository.createTransaction({
        reference: `CRD-${generateRandomToken(6).toUpperCase()}`,
        walletId: wallet.id,
        type: 'DEPOSIT',
        amount: depositAmount.toFixed(2),
        status: 'COMPLETED',
        description: `Card withdrawal from ${card.cardToken}`
      }, tx);
      
      return { transaction, newBalance, updatedCard };
    });
    
    broadcastUserWalletUpdate(req.user!.userId, result.newBalance);

    res.status(200).json({
      success: true,
      transaction: result.transaction,
      newBalance: result.newBalance,
      remainingCardLimitCents: result.updatedCard.limitCents
    });
  }

  async recharge(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    const { amount_cents, payment_method_id } = req.body;
    const currency = INSTITUTIONAL_CURRENCY;

    const parsedAmount = parseInt(amount_cents, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new BadRequestError('Amount must be a positive number in cents.');
    }

    const cardIdStr = (payment_method_id || '').replace('card_', '');
    const cardId = parseInt(cardIdStr, 10);
    if (isNaN(cardId)) {
      throw new BadRequestError('Invalid payment method.');
    }

    await ensureInstitutionalLiquidity();
    const vcbReserve = await reserveRepository.getReserve(RESERVE_VCB);
    const sbReserve = await reserveRepository.getReserve(RESERVE_SENTRY);

    if ((vcbReserve?.balanceCents || 0) <= 0 && (sbReserve?.balanceCents || 0) <= 0) {
      throw new BadRequestError('No banking liquidity available (VELUM CENTRAL BANK and SENTRY BANK are empty).');
    }

    const result = await db.transaction(async (tx) => {
      const cardResults = await tx.select().from(cards).where(eq(cards.id, cardId)).limit(1);
      const card = cardResults[0];
      if (!card || !card.isActive || card.userId !== req.user!.userId) {
        throw new NotFoundError('Active card not found.');
      }

      const isBank =
        card.cardType.toUpperCase().includes('BANK') || card.cardType.toUpperCase() === 'BANK_ACCOUNT';
      const isDebit = card.cardType.toUpperCase().includes('DEBIT');

      // Bank/debit → Sentry; credit card → VCB
      if (isBank || isDebit) {
        if ((sbReserve?.balanceCents || 0) < parsedAmount) {
          throw new BadRequestError('SENTRY BANK has insufficient liquidity for this transfer.');
        }
        await reserveRepository.updateBalance(RESERVE_SENTRY, -parsedAmount, tx);
      } else {
        if ((vcbReserve?.balanceCents || 0) < parsedAmount) {
          throw new BadRequestError('VELUM CENTRAL BANK has insufficient liquidity for this credit.');
        }
        await reserveRepository.updateBalance(RESERVE_VCB, -parsedAmount, tx);
      }

      if (card.limitCents < parsedAmount) {
        throw new BadRequestError('Insufficient card limit.');
      }

      const updatedCard = await cardRepository.updateLimit(card.id, card.limitCents - parsedAmount, tx);
      if (!updatedCard) {
        throw new NotFoundError('Failed to update card limit.');
      }

      let wallet = await bankRepository.findWalletByUserIdAndCurrency(
        req.user!.userId,
        currency,
        tx
      );
      if (!wallet) {
        wallet = await bankRepository.createWallet(
          {
            userId: req.user!.userId,
            balance: '0.00',
            currency,
          },
          tx
        );
      }

      const currentBalance = parseFloat(wallet.balance);
      const depositAmount = parsedAmount / 100;
      const newBalance = (currentBalance + depositAmount).toFixed(2);

      await bankRepository.updateBalance(wallet.id, newBalance, tx);

      const sourceLabel = isBank || isDebit ? 'SENTRY BANK' : 'VELUM CENTRAL BANK';
      const transaction = await bankRepository.createTransaction(
        {
          reference: `REC-${generateRandomToken(6).toUpperCase()}`,
          walletId: wallet.id,
          type: 'DEPOSIT',
          amount: depositAmount.toFixed(2),
          status: 'COMPLETED',
          description: `Recharge ${depositAmount.toFixed(2)} ${currency} from ${sourceLabel} via ${card.cardToken}`,
        },
        tx
      );

      return { transaction, newBalance, sourceLabel };
    });

    broadcastUserWalletUpdate(req.user!.userId, result.newBalance);

    res.status(200).json({
      success: true,
      currency,
      funded_from: result.sourceLabel,
      transaction: result.transaction,
      newBalance: result.newBalance,
    });
  }

  async withdraw(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    const { amount_cents, payout_method_id } = req.body;
    const currency = INSTITUTIONAL_CURRENCY;

    const parsedAmount = parseInt(amount_cents, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new BadRequestError('Amount must be a positive number in cents.');
    }

    const cardIdStr = (payout_method_id || '').replace('card_', '');
    const cardId = parseInt(cardIdStr, 10);
    if (isNaN(cardId)) {
      throw new BadRequestError('Invalid payout method.');
    }

    await ensureInstitutionalLiquidity();

    const feeCents = Math.round(parsedAmount * WITHDRAWAL_FEE_PCT);
    const netPayoutCents = parsedAmount - feeCents;

    const result = await db.transaction(async (tx) => {
      const cardResults = await tx.select().from(cards).where(eq(cards.id, cardId)).limit(1);
      const card = cardResults[0];
      if (!card || !card.isActive || card.userId !== req.user!.userId) {
        throw new NotFoundError('Active payout method not found.');
      }

      const wallet = await bankRepository.findWalletByUserIdAndCurrencyForUpdate(
        req.user!.userId,
        currency,
        tx
      );
      if (!wallet) {
        throw new NotFoundError(`Wallet for ${currency} not found.`);
      }

      const currentBalance = parseFloat(wallet.balance);
      const withdrawAmount = parsedAmount / 100;

      if (currentBalance < withdrawAmount) {
        throw new BadRequestError('Insufficient wallet balance.');
      }

      const newBalance = (currentBalance - withdrawAmount).toFixed(2);
      await bankRepository.updateBalance(wallet.id, newBalance, tx);

      // Full amount into Sentry, then net payout leaves Sentry → method; fee retained by Sentry.
      await reserveRepository.updateBalance(RESERVE_SENTRY, parsedAmount, tx);
      if (netPayoutCents > 0) {
        await reserveRepository.updateBalance(RESERVE_SENTRY, -netPayoutCents, tx);
      }
      await cardRepository.updateLimit(card.id, card.limitCents + netPayoutCents, tx);

      const transaction = await bankRepository.createTransaction(
        {
          reference: `WTH-${generateRandomToken(6).toUpperCase()}`,
          walletId: wallet.id,
          type: 'WITHDRAWAL',
          amount: withdrawAmount.toFixed(2),
          status: 'COMPLETED',
          description: `Withdraw ${withdrawAmount.toFixed(2)} ${currency} → SENTRY BANK (fee ${(WITHDRAWAL_FEE_PCT * 100).toFixed(1)}% = ${(feeCents / 100).toFixed(2)} ${currency} retained; net ${(netPayoutCents / 100).toFixed(2)} to ${card.cardToken})`,
        },
        tx
      );

      return { transaction, newBalance };
    });

    broadcastUserWalletUpdate(req.user!.userId, result.newBalance);

    res.status(200).json({
      success: true,
      currency,
      fee_pct: WITHDRAWAL_FEE_PCT,
      fee_cents: feeCents,
      net_payout_cents: netPayoutCents,
      transaction: result.transaction,
      newBalance: result.newBalance,
    });
  }

  async getPaymentTransactions(req: Request, res: Response): Promise<void> {
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

  async addMethod(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    const { methodType, institution, methodCategory } = req.body;

    const category = methodCategory || 'DEBIT'; // DEBIT, CREDIT, or BANK

    const userCards = await db.select().from(cards).where(eq(cards.userId, req.user.userId));
    
    // Find if a card of this specific category already exists
    const existing = userCards.find(c => {
      if (c.cardType.includes(':')) {
        return c.cardType.split(':')[0] === category;
      }
      if (category === 'BANK') return c.cardType === 'BANK_ACCOUNT';
      return c.cardType !== 'BANK_ACCOUNT';
    });

    const cardToken = 'tok_' + generateRandomToken(12);
    const cardTypeString = `${category}:${institution || 'Unknown'}`;

    if (existing) {
      await db.update(cards).set({
        cardType: cardTypeString,
        cardToken,
        isActive: true,
        updatedAt: new Date()
      }).where(eq(cards.id, existing.id));
    } else {
      await cardRepository.createCard({
        userId: req.user.userId,
        cardToken,
        cardType: cardTypeString,
        limitCents: 500000,
        isActive: true
      });
    }

    res.status(201).json({ success: true });
  }

  async deleteMethod(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    const { id } = req.params;

    // Parse the card ID from string "card_<id>" or just ID
    const cardId = parseInt(id.replace('card_', ''), 10);
    if (!isNaN(cardId)) {
      const existing = await cardRepository.findCardByUserId(req.user.userId);
      if (existing && existing.id === cardId) {
        await cardRepository.deleteCard(cardId);
      }
    }

    res.status(200).json({ success: true });
  }

  async getUserBalances(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    
    if (req.user.duress_active) {
      res.status(200).json({ balances: [] });
      return;
    }

    const currenciesToSeed = ['VLM', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'TWD', 'CAD', 'AUD', 'CHF', 'SGD', 'HKD'];
    for (const cur of currenciesToSeed) {
      const [existing] = await db.select().from(wallets).where(and(eq(wallets.userId, req.user.userId), eq(wallets.currency, cur))).limit(1);
      if (!existing) {
        await db.insert(wallets).values({
          userId: req.user.userId,
          balance: '0.00',
          currency: cur
        });
      }
    }

    const userWallets = await db.select().from(wallets).where(eq(wallets.userId, req.user.userId));
    
    const balances = userWallets.map(w => ({
      currency_code: w.currency,
      balance_cents: Math.round(parseFloat(w.balance) * 100),
      is_platform_native: w.currency === 'VLM'
    }));

    res.status(200).json({ balances });
  }

  async exchange(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new NotFoundError('User context missing.');
    const { fromCurrency, toCurrency, amountCents } = req.body;

    const parsedAmount = parseInt(amountCents, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new BadRequestError('Amount must be a positive number in cents.');
    }

    const conversionId = `exc_${generateRandomToken(10).toLowerCase()}`;
    const { rate, grossConverted, platformSpread, netCredited } = currencyConverter.calculateExchange(parsedAmount, fromCurrency, toCurrency);

    const result = await db.transaction(async (tx) => {
      const [fromWallet] = await tx.select().from(wallets).where(and(eq(wallets.userId, req.user!.userId), eq(wallets.currency, fromCurrency))).limit(1);
      if (!fromWallet) {
        throw new NotFoundError(`Source wallet for ${fromCurrency} not found.`);
      }

      const currentFromBalance = parseFloat(fromWallet.balance);
      const deductAmount = parsedAmount / 100;
      if (currentFromBalance < deductAmount) {
        throw new BadRequestError('Insufficient balance for exchange.');
      }

      let [toWallet] = await tx.select().from(wallets).where(and(eq(wallets.userId, req.user!.userId), eq(wallets.currency, toCurrency))).limit(1);
      if (!toWallet) {
        [toWallet] = await tx.insert(wallets).values({
          userId: req.user!.userId,
          balance: '0.00',
          currency: toCurrency
        }).returning();
      }

      const newFromBalance = (currentFromBalance - deductAmount).toFixed(2);
      const newToBalance = (parseFloat(toWallet.balance) + netCredited / 100).toFixed(2);

      await tx.update(wallets).set({ balance: newFromBalance, updatedAt: new Date() }).where(eq(wallets.id, fromWallet.id));
      await tx.update(wallets).set({ balance: newToBalance, updatedAt: new Date() }).where(eq(wallets.id, toWallet.id));

      await bankRepository.createTransaction({
        reference: `${conversionId}_d`.slice(0, 32),
        walletId: fromWallet.id,
        type: 'EXCHANGE_OUT',
        amount: deductAmount.toFixed(2),
        status: 'COMPLETED',
        description: `${conversionId}: Exchanged ${deductAmount.toFixed(2)} ${fromCurrency} for ${(netCredited / 100).toFixed(2)} ${toCurrency} (Platform Fee: ${(platformSpread / 100).toFixed(2)} ${toCurrency})`
      }, tx);

      await bankRepository.createTransaction({
        reference: `${conversionId}_c`.slice(0, 32),
        walletId: toWallet.id,
        type: 'EXCHANGE_IN',
        amount: (netCredited / 100).toFixed(2),
        status: 'COMPLETED',
        description: `${conversionId}: Received exchange of ${deductAmount.toFixed(2)} ${fromCurrency} (Net: ${(netCredited / 100).toFixed(2)} ${toCurrency})`
      }, tx);

      return { newFromBalance, newToBalance };
    });

    broadcastUserWalletUpdate(req.user!.userId);

    res.status(200).json({
      success: true,
      conversion_id: conversionId,
      debited_cents: parsedAmount,
      credited_cents: netCredited,
      rate_used: rate,
      platform_spread_cents: platformSpread,
      balances: [
        { currency_code: fromCurrency, balance_cents: Math.round(parseFloat(result.newFromBalance) * 100) },
        { currency_code: toCurrency, balance_cents: Math.round(parseFloat(result.newToBalance) * 100) }
      ]
    });
  }

  async getCurrencies(req: Request, res: Response): Promise<void> {
    res.status(200).json({ 
      currencies: ['VLM', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'TWD', 'CAD', 'AUD', 'CHF', 'SGD', 'HKD'] 
    });
  }

  async getRates(req: Request, res: Response): Promise<void> {
    const { currencyConverter } = await import('../services/currencyConverter.js');
    res.status(200).json({ 
      rates: currencyConverter.getAllRates() 
    });
  }
}

export const paymentController = new PaymentController();
