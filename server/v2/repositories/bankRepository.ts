import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { wallets, transactions, type Wallet, type NewWallet, type Transaction, type NewTransaction } from '../db/schema/index.js';

export class BankRepository {
  async findAllWallets(limit = 100, tx: any = db): Promise<Wallet[]> {
    return tx.select().from(wallets).orderBy(desc(wallets.createdAt)).limit(limit);
  }

  async findAllTransactions(limit = 100, tx: any = db): Promise<Transaction[]> {
    return tx.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(limit);
  }

  async findWalletByUserId(userId: number, tx: any = db): Promise<Wallet | null> {
    const results = await tx.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
    return results[0] || null;
  }

  async findWalletByUserIdForUpdate(userId: number, tx: any = db): Promise<Wallet | null> {
    const results = await tx.select().from(wallets).where(eq(wallets.userId, userId)).limit(1).for('update');
    return results[0] || null;
  }

  async createWallet(data: NewWallet, tx: any = db): Promise<Wallet> {
    const inserted = await tx.insert(wallets).values(data).returning();
    return inserted[0];
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
    const results = await tx.select().from(transactions).where(eq(transactions.reference, reference)).limit(1);
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
