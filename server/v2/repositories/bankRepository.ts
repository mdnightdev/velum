import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  wallets,
  transactions,
  WALLET_CURRENCIES,
  DEFAULT_WALLET_CURRENCY,
  type Wallet,
  type NewWallet,
  type Transaction,
  type NewTransaction,
} from '../db/schema/index.js';

export class BankRepository {
  async findAllWallets(limit = 100, tx: any = db): Promise<Wallet[]> {
    return tx.select().from(wallets).orderBy(desc(wallets.createdAt)).limit(limit);
  }

  async findAllTransactions(limit = 100, tx: any = db): Promise<Transaction[]> {
    return tx.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(limit);
  }

  async findWalletByUserId(userId: number, tx: any = db): Promise<Wallet | null> {
    return this.findWalletByUserIdAndCurrency(userId, DEFAULT_WALLET_CURRENCY, tx);
  }

  async findWalletsByUserId(userId: number, tx: any = db): Promise<Wallet[]> {
    return tx.select().from(wallets).where(eq(wallets.userId, userId)).orderBy(asc(wallets.currency));
  }

  async findWalletByUserIdAndCurrency(
    userId: number,
    currency: string,
    tx: any = db
  ): Promise<Wallet | null> {
    const results = await tx
      .select()
      .from(wallets)
      .where(and(eq(wallets.userId, userId), eq(wallets.currency, currency)))
      .limit(1);
    return results[0] || null;
  }

  async findWalletByUserIdForUpdate(userId: number, tx: any = db): Promise<Wallet | null> {
    return this.findWalletByUserIdAndCurrencyForUpdate(userId, DEFAULT_WALLET_CURRENCY, tx);
  }

  async findWalletByUserIdAndCurrencyForUpdate(
    userId: number,
    currency: string,
    tx: any = db
  ): Promise<Wallet | null> {
    const results = await tx
      .select()
      .from(wallets)
      .where(and(eq(wallets.userId, userId), eq(wallets.currency, currency)))
      .limit(1)
      .for('update');
    return results[0] || null;
  }

  async createWallet(data: NewWallet, tx: any = db): Promise<Wallet> {
    const inserted = await tx
      .insert(wallets)
      .values({
        ...data,
        currency: data.currency || DEFAULT_WALLET_CURRENCY,
      })
      .returning();
    return inserted[0];
  }

  /** Ensure one zero-balance row per supported currency for the user. */
  async ensureCurrencyWallets(userId: number, tx: any = db): Promise<Wallet[]> {
    for (const currency of WALLET_CURRENCIES) {
      const existing = await this.findWalletByUserIdAndCurrency(userId, currency, tx);
      if (!existing) {
        await this.createWallet(
          {
            userId,
            balance: '0.00',
            currency,
          },
          tx
        );
      }
    }
    return this.findWalletsByUserId(userId, tx);
  }

  async updateBalance(walletId: number, newBalance: string, tx: any = db): Promise<Wallet | null> {
    const updated = await tx
      .update(wallets)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(wallets.id, walletId))
      .returning();
    return updated[0] || null;
  }

  async createTransaction(data: NewTransaction, tx: any = db): Promise<Transaction> {
    const inserted = await tx.insert(transactions).values(data).returning();
    return inserted[0];
  }

  async findTransactionByReference(reference: string, tx: any = db): Promise<Transaction | null> {
    const results = await tx
      .select()
      .from(transactions)
      .where(eq(transactions.reference, reference))
      .limit(1);
    return results[0] || null;
  }

  async getTransactionHistory(walletId: number, limit = 50, tx: any = db): Promise<Transaction[]> {
    return tx
      .select()
      .from(transactions)
      .where(eq(transactions.walletId, walletId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
  }
}

export const bankRepository = new BankRepository();
