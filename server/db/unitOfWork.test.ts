import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnitOfWork, runInTransaction } from './unitOfWork.js';
import { db, saveDb } from './index.js';
import { walletRepository } from './walletRepository.js';

// Mock saveDb to avoid actual disk writes during tests
vi.mock('./index.js', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    saveDb: vi.fn(),
  };
});

describe('UnitOfWork', () => {
  beforeEach(() => {
    // Reset relevant DB state before each test
    db.wallet_balances = [];
    db.wallet_ledger_entries = [];
    db.user_wallets = [];
    vi.clearAllMocks();
  });

  it('should stage balance updates without modifying global DB until commit', () => {
    const uow = new UnitOfWork();
    uow.stageBalanceUpdate(1, 'USD', 1000);

    // Global DB should NOT be changed yet
    expect(walletRepository.findWalletBalance(1, 'USD')).toBeUndefined();
    
    // UoW should see the staged balance
    expect(uow.getBalance(1, 'USD')).toBe(1000);

    uow.commit();

    // Global DB should now be updated
    const bal = walletRepository.findWalletBalance(1, 'USD');
    expect(bal?.balance_cents).toBe(1000);
    expect(saveDb).toHaveBeenCalledWith(true);
  });

  it('should stage ledger entries without modifying global DB until commit', () => {
    const uow = new UnitOfWork();
    const entry = {
      entry_id: 'led_1',
      user_id: 1,
      currency_code: 'USD',
      amount_cents: 1000,
      balance_after_cents: 1000,
      entry_type: 'RECHARGE',
      created_at: Date.now()
    } as any;
    
    uow.stageLedgerEntry(entry);

    // Global DB should NOT have the entry yet
    expect(db.wallet_ledger_entries).toHaveLength(0);

    uow.commit();

    // Global DB should now have the entry
    expect(db.wallet_ledger_entries).toHaveLength(1);
    expect(db.wallet_ledger_entries?.[0].entry_id).toBe('led_1');
  });

  it('should discard changes on rollback', () => {
    const uow = new UnitOfWork();
    uow.stageBalanceUpdate(1, 'USD', 1000);
    uow.rollback();

    expect(() => uow.commit()).toThrow("Cannot commit a rolled back transaction");
    expect(walletRepository.findWalletBalance(1, 'USD')).toBeUndefined();
  });

  it('should sync legacy VLM wallet when staging VLM balance', () => {
    const uow = new UnitOfWork();
    uow.stageBalanceUpdate(1, 'VLM', 5000);
    
    expect(walletRepository.findWalletByUserId(1)).toBeUndefined();
    
    uow.commit();
    
    const legacyWallet = walletRepository.findWalletByUserId(1);
    expect(legacyWallet?.balance_cents).toBe(5000);
    
    const vlmBal = walletRepository.findWalletBalance(1, 'VLM');
    expect(vlmBal?.balance_cents).toBe(5000);
  });

  it('should execute runInTransaction and commit automatically', async () => {
    await runInTransaction((uow) => {
      uow.stageBalanceUpdate(1, 'USD', 2000);
    });

    const bal = walletRepository.findWalletBalance(1, 'USD');
    expect(bal?.balance_cents).toBe(2000);
  });

  it('should execute runInTransaction and rollback on error', async () => {
    const action = async () => {
      await runInTransaction((uow) => {
        uow.stageBalanceUpdate(1, 'USD', 3000);
        throw new Error('Simulated Transaction Failure');
      });
    };

    await expect(action()).rejects.toThrow('Simulated Transaction Failure');

    // Global DB should NOT be changed
    expect(walletRepository.findWalletBalance(1, 'USD')).toBeUndefined();
  });
});
