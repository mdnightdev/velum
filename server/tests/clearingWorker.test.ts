import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../db.js';
import { 
  processEscrowClearingWorker, 
  performLedgerReconciliationCheck 
} from '../services/clearingWorker';

vi.mock('../db.js', () => {
  const mockDb: any = {
    escrow_transactions: [],
    user_wallets: [],
    wallet_ledger_entries: [],
    market_support_chats: [],
    platform_financial_audit_logs: [],
    automation_actions: []
  };
  return {
    db: mockDb,
    saveDb: vi.fn(),
    loadDb: vi.fn()
  };
});

describe('Clearing Worker & Ledger Reconciliation tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.escrow_transactions = [];
    db.user_wallets = [];
    db.wallet_ledger_entries = [];
    db.market_support_chats = [];
    db.platform_financial_audit_logs = [];
    db.automation_actions = [];
  });

  it('should not release escrow that is less than 5 minutes old', () => {
    const escTx = {
      transaction_id: 'esc_1',
      listing_id: 'list_1',
      buyer_id: 101,
      seller_id: 102,
      amount: 100,
      platform_fee: 5,
      payout_amount: 95,
      status: 'HELD_IN_ESCROW',
      created_at: Date.now() - 2 * 60 * 1000 // 2 minutes ago
    };
    db.escrow_transactions!.push(escTx as any);

    processEscrowClearingWorker();

    expect(escTx.status).toBe('HELD_IN_ESCROW');
    expect(db.automation_actions).toHaveLength(0);
  });

  it('should automatically release escrow that is more than 5 minutes old with no active disputes', () => {
    const escTx = {
      transaction_id: 'esc_2',
      listing_id: 'list_1',
      buyer_id: 101,
      seller_id: 102,
      amount: 100,
      platform_fee: 5,
      payout_amount: 95,
      status: 'HELD_IN_ESCROW',
      created_at: Date.now() - 6 * 60 * 1000 // 6 minutes ago
    };
    db.escrow_transactions!.push(escTx as any);
    db.user_wallets!.push({ user_id: 102, balance_cents: 0, updated_at: Date.now() });

    processEscrowClearingWorker();

    expect(escTx.status).toBe('RELEASED');
    
    // Check seller's wallet credited (100 - 5 = 95 USD -> 9500 cents)
    const sellerWallet = db.user_wallets!.find(w => w.user_id === 102);
    expect(sellerWallet?.balance_cents).toBe(9500);

    // Ledger entries created with TRC codes
    expect(db.wallet_ledger_entries).toHaveLength(2);
    expect(db.wallet_ledger_entries![0].entry_type).toBe('ESCROW_RELEASE');
    expect(db.wallet_ledger_entries![0].entry_id).toContain('ESC-REL-');
    expect(db.wallet_ledger_entries![1].entry_type).toBe('PLATFORM_FEE');
    expect(db.wallet_ledger_entries![1].entry_id).toContain('ESC-REL-');

    // Automation log created
    expect(db.automation_actions).toHaveLength(1);
    expect(db.automation_actions![0].action_type).toBe('AUTO_RELEASE');
  });

  it('should skip automatic release if there is an active unresolved dispute', () => {
    const escTx = {
      transaction_id: 'esc_3',
      listing_id: 'list_1',
      buyer_id: 101,
      seller_id: 102,
      amount: 100,
      platform_fee: 5,
      payout_amount: 95,
      status: 'HELD_IN_ESCROW',
      created_at: Date.now() - 6 * 60 * 1000 // 6 minutes ago
    };
    db.escrow_transactions!.push(escTx as any);
    db.user_wallets!.push({ user_id: 102, balance_cents: 0, updated_at: Date.now() });

    // Dispute chat
    db.market_support_chats!.push({
      chat_id: 'chat_3',
      order_id: 'esc_3',
      is_disputed: true,
      resolved_at: null,
      messages: []
    } as any);

    processEscrowClearingWorker();

    expect(escTx.status).toBe('HELD_IN_ESCROW');
    expect(db.automation_actions).toHaveLength(0);
  });

  it('should detect balance-ledger mismatch and log discrepancy in reconciliation check', () => {
    db.user_wallets!.push({ user_id: 102, balance_cents: 1000, updated_at: Date.now() });
    
    // Total of ledger is 800 cents, wallet is 1000 cents (discrepancy)
    db.wallet_ledger_entries!.push({
      entry_id: 'TRC-1',
      user_id: 102,
      amount_cents: 800,
      balance_after_cents: 800,
      entry_type: 'RECHARGE',
      actor_type: 'USER',
      created_at: Date.now()
    } as any);

    performLedgerReconciliationCheck();

    expect(db.platform_financial_audit_logs).toHaveLength(1);
    expect(db.platform_financial_audit_logs![0].action_type).toBe('RECONCILIATION_DISCREPANCY');
    expect(db.platform_financial_audit_logs![0].reason).toContain('Discrepancy: Wallet balance is 1000 cents, ledger sum is 800 cents');
  });
});
