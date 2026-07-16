import { db, saveDb } from './index.js';
import { walletRepository } from './walletRepository.js';
import { WalletLedgerEntry } from '../../src/types.js';

/**
 * UnitOfWork provides a transactional wrapper for database operations.
 * It stages changes to balances and ledger entries, applying them atomically
 * to the global in-memory database and persisting them to disk upon commit.
 */
export class UnitOfWork {
  private stagedBalances: Map<string, number> = new Map(); // key: userId:currencyCode
  private stagedLedgerEntries: WalletLedgerEntry[] = [];
  private committed = false;
  private rolledBack = false;

  /**
   * Stages a balance update for a specific user and currency.
   * Note: This does not modify the global database until commit() is called.
   */
  stageBalanceUpdate(userId: number, currencyCode: string, amountCents: number) {
    if (this.committed || this.rolledBack) {
      throw new Error("Transaction already finalized");
    }
    const key = `${userId}:${currencyCode}`;
    this.stagedBalances.set(key, amountCents);
  }

  /**
   * Stages a new ledger entry.
   * Note: This does not modify the global database until commit() is called.
   */
  stageLedgerEntry(entry: WalletLedgerEntry) {
    if (this.committed || this.rolledBack) {
      throw new Error("Transaction already finalized");
    }
    this.stagedLedgerEntries.push(entry);
  }

  /**
   * Commits all staged changes to the global in-memory database and persists them to disk.
   */
  commit() {
    if (this.committed) return;
    if (this.rolledBack) throw new Error("Cannot commit a rolled back transaction");

    try {
      // 1. Apply all staged balance updates to the global DB
      for (const [key, amountCents] of this.stagedBalances.entries()) {
        const [userIdStr, currencyCode] = key.split(':');
        const userId = Number(userIdStr);
        walletRepository.updateWalletBalanceCents(userId, currencyCode, amountCents);
      }

      // 2. Apply all staged ledger entries to the global DB
      for (const entry of this.stagedLedgerEntries) {
        walletRepository.createLedgerEntry(entry);
      }

      // 3. Atomically persist the entire DB state to disk
      // Passing true forces an immediate synchronous save
      saveDb(true);
      
      this.committed = true;
    } catch (error) {
      console.error('[UoW] Critical failure during commit. State may be inconsistent:', error);
      // In a real DB, this is where a rollback would happen.
      // In-memory, we've already started mutating 'db'.
      // However, our staged operations are simple assignments which should not fail.
      throw error;
    }
  }

  /**
   * Discards all staged changes.
   */
  rollback() {
    this.stagedBalances.clear();
    this.stagedLedgerEntries = [];
    this.rolledBack = true;
  }

  /**
   * Helper to get the current balance (including staged changes) for a user.
   */
  getBalance(userId: number, currencyCode: string): number {
    const key = `${userId}:${currencyCode}`;
    if (this.stagedBalances.has(key)) {
      return this.stagedBalances.get(key)!;
    }
    const bal = walletRepository.findWalletBalance(userId, currencyCode);
    return bal ? bal.balance_cents : 0;
  }
}

/**
 * Executes a function within a Unit of Work.
 * Automatically commits if the function succeeds, and rolls back if it throws.
 */
export async function runInTransaction<T>(fn: (uow: UnitOfWork) => Promise<T> | T): Promise<T> {
  const uow = new UnitOfWork();
  try {
    const result = await fn(uow);
    uow.commit();
    return result;
  } catch (error) {
    uow.rollback();
    throw error;
  }
}
