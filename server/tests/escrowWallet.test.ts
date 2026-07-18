import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  createEscrow, 
  releaseEscrow, 
  revertEscrow,
  createRefundRequest,
  manualOverrideEscrow,
  triggerAutoSettlement,
  createListing
} from '../controllers/marketplace';
import {
  getCurrencies,
  getWalletBalances,
  getExchangeRates,
  exchangeCurrencyAction
} from '../controllers/payments';
import { db } from '../db.js';
import { MarketListing, PlatformAdmin } from '../../src/types';

vi.mock('../db.js', () => {
  const mockDb: any = {
    users: [
      { user_id: 101, username: 'buyer' },
      { user_id: 102, username: 'seller' },
      { user_id: 1, username: 'Midnight' } // Admin
    ],
    market_listings: [
      { listing_id: 'list_1', seller_id: 102, title: 'Asset 1', price: 100, status: 'ACTIVE', created_at: Date.now(), updated_at: Date.now() }
    ],
    escrow_transactions: [],
    user_wallets: [],
    wallet_ledger_entries: [],
    market_coupons: [],
    platform_admins: [
      { admin_id: 'pa_1', user_id: 1, can_override_escrow: true, can_approve_withdrawals: true, can_resolve_disputes: true, granted_by_user_id: 1, created_at: Date.now() }
    ],
    platform_financial_audit_logs: [],
    automation_actions: [],
    refund_requests: [],
    currencies: [
      { currency_code: 'VLM', display_name: 'Velum Token (VLM)', is_platform_native: true, redeemable_for_cash: false, decimal_places: 2, active: true },
      { currency_code: 'USD_SIM', display_name: 'Simulated USD ($)', is_platform_native: false, redeemable_for_cash: true, decimal_places: 2, active: true }
    ],
    exchange_rates: [
      { rate_id: 'rate_usd_vlm', base_currency: 'USD_SIM', quote_currency: 'VLM', rate: 10, simulated_source: 'SANDBOX_STATIC', effective_at: Date.now() },
      { rate_id: 'rate_vlm_usd', base_currency: 'VLM', quote_currency: 'USD_SIM', rate: 0.1, simulated_source: 'SANDBOX_STATIC', effective_at: Date.now() }
    ],
    wallet_balances: [],
    listing_verification_checks: [],
    verified_sellers: [102] // seller is verified
  };
  return {
    db: mockDb,
    loadDb: vi.fn(),
    saveDb: vi.fn(),
  };
});

describe('Escrow & Wallet Ledger Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.escrow_transactions = [];
    db.user_wallets = [
      { user_id: 101, balance_cents: 15000, updated_at: Date.now() }, // $150
      { user_id: 102, balance_cents: 0, updated_at: Date.now() },
      { user_id: 1, balance_cents: 0, updated_at: Date.now() }
    ];
    db.wallet_ledger_entries = [];
    db.market_listings = [
      { 
        listing_id: 'list_1', 
        seller_id: 102, 
        title: 'Asset 1', 
        price: 100, 
        status: 'ACTIVE',
        created_at: Date.now(),
        updated_at: Date.now()
      } as MarketListing
    ];
    db.platform_admins = [
      { 
        admin_id: 'pa_1', 
        user_id: 1, 
        can_override_escrow: true,
        can_approve_withdrawals: true,
        can_resolve_disputes: true,
        granted_by_user_id: 1,
        created_at: Date.now()
      } as PlatformAdmin
    ];
    db.platform_financial_audit_logs = [];
    db.automation_actions = [];
    db.refund_requests = [];
    db.currencies = [
      { currency_code: 'VLM', display_name: 'Velum Token (VLM)', is_platform_native: true, redeemable_for_cash: false, decimal_places: 2, active: true },
      { currency_code: 'USD_SIM', display_name: 'Simulated USD ($)', is_platform_native: false, redeemable_for_cash: true, decimal_places: 2, active: true }
    ];
    db.exchange_rates = [
      { rate_id: 'rate_usd_vlm', base_currency: 'USD_SIM', quote_currency: 'VLM', rate: 10, simulated_source: 'SANDBOX_STATIC', effective_at: Date.now() },
      { rate_id: 'rate_vlm_usd', base_currency: 'VLM', quote_currency: 'USD_SIM', rate: 0.1, simulated_source: 'SANDBOX_STATIC', effective_at: Date.now() }
    ];
    db.wallet_balances = [];
    db.listing_verification_checks = [];
    db.verified_sellers = [102];
  });

  it('should successfully create escrow and deduct buyer balance when wallet has sufficient funds', async () => {
    const req = {
      body: { listingId: 'list_1' },
      user: { user_id: 101, username: 'buyer' }
    } as any;

    let responseData: any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation((data) => {
        responseData = data;
        return res;
      })
    } as any;

    await createEscrow(req, res);

    const buyerWallet = (db.user_wallets || []).find(w => w.user_id === 101);
    expect(buyerWallet?.balance_cents).toBe(5000); // 15000 - 10000

    expect(responseData.status).toBe('HELD_IN_ESCROW');
    expect(responseData.amount).toBe(100);

    expect(db.wallet_ledger_entries).toHaveLength(1);
    const ledger = (db.wallet_ledger_entries || [])[0];
    expect(ledger.entry_type).toBe('ESCROW_HOLD');
    expect(ledger.amount_cents).toBe(-10000);
    expect(ledger.user_id).toBe(101);
  });

  it('should fail to create escrow when buyer wallet has insufficient funds', async () => {
    const req = {
      body: { listingId: 'list_1' },
      user: { user_id: 101, username: 'buyer' }
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as any;

    const buyerWallet = (db.user_wallets || []).find(w => w.user_id === 101);
    if (buyerWallet) buyerWallet.balance_cents = 5000;

    await createEscrow(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Insufficient funds.'
    }));
  });

  it('should successfully release escrow to seller and deduct platform fee', async () => {
    const escTx = {
      transaction_id: 'esc_123',
      listing_id: 'list_1',
      buyer_id: 101,
      seller_id: 102,
      amount: 100,
      platform_fee: 5,
      payout_amount: 95,
      status: 'HELD_IN_ESCROW',
      created_at: Date.now()
    };
    (db.escrow_transactions || []).push(escTx as any);

    const req = {
      params: { transactionId: 'esc_123' },
      user: { user_id: 101, username: 'buyer' }
    } as any;

    let responseData: any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation((data) => {
        responseData = data;
        return res;
      })
    } as any;

    await releaseEscrow(req, res);

    expect(responseData.status).toBe('RELEASED');

    const sellerWallet = (db.user_wallets || []).find(w => w.user_id === 102);
    expect(sellerWallet?.balance_cents).toBe(9500);

    expect(db.wallet_ledger_entries).toHaveLength(2);
    expect((db.wallet_ledger_entries || [])[0].entry_type).toBe('ESCROW_RELEASE');
    expect((db.wallet_ledger_entries || [])[0].amount_cents).toBe(10000);
    expect((db.wallet_ledger_entries || [])[1].entry_type).toBe('PLATFORM_FEE');
    expect((db.wallet_ledger_entries || [])[1].amount_cents).toBe(-500);
  });

  it('should successfully revert/refund escrow back to buyer', async () => {
    const escTx = {
      transaction_id: 'esc_123',
      listing_id: 'list_1',
      buyer_id: 101,
      seller_id: 102,
      amount: 100,
      platform_fee: 5,
      payout_amount: 95,
      status: 'HELD_IN_ESCROW',
      created_at: Date.now()
    };
    (db.escrow_transactions || []).push(escTx as any);

    const req = {
      params: { transactionId: 'esc_123' },
      user: { user_id: 101, username: 'buyer' }
    } as any;

    let responseData: any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation((data) => {
        responseData = data;
        return res;
      })
    } as any;

    const buyerWallet = (db.user_wallets || []).find(w => w.user_id === 101);
    if (buyerWallet) buyerWallet.balance_cents = 5000;

    await revertEscrow(req, res);

    expect(responseData.status).toBe('REVERTED');
    expect(buyerWallet?.balance_cents).toBe(15000);

    expect(db.wallet_ledger_entries).toHaveLength(1);
    expect((db.wallet_ledger_entries || [])[0].entry_type).toBe('ESCROW_REFUND');
    expect((db.wallet_ledger_entries || [])[0].amount_cents).toBe(10000);
  });

  it('should successfully create pre-release refund request and auto-approve it', async () => {
    const escTx = {
      transaction_id: 'esc_777',
      listing_id: 'list_1',
      buyer_id: 101,
      seller_id: 102,
      amount: 100,
      status: 'HELD_IN_ESCROW',
      created_at: Date.now()
    };
    (db.escrow_transactions || []).push(escTx as any);

    const req = {
      body: { escrowTransactionId: 'esc_777', reason: 'Accidental purchase' },
      user: { user_id: 101, username: 'buyer' }
    } as any;

    let responseData: any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation((data) => {
        responseData = data;
        return res;
      })
    } as any;

    const buyerWallet = (db.user_wallets || []).find(w => w.user_id === 101);
    if (buyerWallet) buyerWallet.balance_cents = 5000;

    await createRefundRequest(req, res);

    expect(responseData.success).toBe(true);
    expect(responseData.refundRequest.status).toBe('AUTO_APPROVED');
    expect(buyerWallet?.balance_cents).toBe(15000); // 5000 + 10000 (refund)

    const refundEntry = (db.wallet_ledger_entries || []).find(e => e.entry_type === 'ESCROW_REFUND');
    expect(refundEntry).toBeDefined();
    expect(refundEntry?.amount_cents).toBe(10000);
  });

  it('should allow platform admins to execute manual override FORCE_RELEASE', async () => {
    const escTx = {
      transaction_id: 'esc_888',
      listing_id: 'list_1',
      buyer_id: 101,
      seller_id: 102,
      amount: 100,
      platform_fee: 5,
      payout_amount: 95,
      status: 'HELD_IN_ESCROW',
      created_at: Date.now()
    };
    (db.escrow_transactions || []).push(escTx as any);

    const req = {
      params: { transactionId: 'esc_888' },
      body: { actionType: 'FORCE_RELEASE', reason: 'Dispute resolved in favor of seller' },
      user: { user_id: 1, username: 'Midnight' } // platform admin
    } as any;

    let responseData: any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation((data) => {
        responseData = data;
        return res;
      })
    } as any;

    await manualOverrideEscrow(req, res);

    expect(responseData.success).toBe(true);
    expect(responseData.escrow.status).toBe('RELEASED');

    const sellerWallet = (db.user_wallets || []).find(w => w.user_id === 102);
    expect(sellerWallet?.balance_cents).toBe(9500); // 10000 credited, 500 fee debited

    expect(db.platform_financial_audit_logs).toHaveLength(1);
    expect((db.platform_financial_audit_logs || [])[0].action_type).toBe('ESCROW_MANUAL_RELEASE_OVERRIDE');
    expect((db.platform_financial_audit_logs || [])[0].reason).toBe('Dispute resolved in favor of seller');
  });

  it('should successfully trigger automated release checks', async () => {
    const escTx = {
      transaction_id: 'esc_999',
      listing_id: 'list_1',
      buyer_id: 101,
      seller_id: 102,
      amount: 100,
      platform_fee: 5,
      payout_amount: 95,
      status: 'HELD_IN_ESCROW',
      created_at: Date.now()
    };
    (db.escrow_transactions || []).push(escTx as any);

    const req = {
      user: { user_id: 1, username: 'Midnight' } // platform admin
    } as any;

    let responseData: any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation((data) => {
        responseData = data;
        return res;
      })
    } as any;

    await triggerAutoSettlement(req, res);

    expect(responseData.success).toBe(true);
    expect(responseData.triggered_count).toBe(1);

    const sellerWallet = (db.user_wallets || []).find(w => w.user_id === 102);
    expect(sellerWallet?.balance_cents).toBe(9500);

    expect(db.automation_actions).toHaveLength(1);
    expect((db.automation_actions || [])[0].action_type).toBe('AUTO_RELEASE');
  });

  describe('Phase 3: Currency, Verification & Inventory Layer Tests', () => {
    it('should auto-approve listing if seller is verified and content is clean', async () => {
      const req = {
        body: { title: 'Authentic item', description: 'Very clean asset description', price: 50, inventory_count: '10' },
        user: { user_id: 102, username: 'seller' }
      } as any;

      let responseData: any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockImplementation((data) => {
          responseData = data;
          return res;
        })
      } as any;

      await createListing(req, res);

      expect(responseData.verification_status).toBe('APPROVED');
      expect(responseData.inventory_count).toBe(10);
      expect(db.listing_verification_checks?.length).toBeGreaterThanOrEqual(2);
    });

    it('should fail Content Scan and set status PENDING_REVIEW if title contains prohibited keywords', async () => {
      const req = {
        body: { title: 'cheat and exploit software', description: 'highly illegal hack tool', price: 90 },
        user: { user_id: 102, username: 'seller' }
      } as any;

      let responseData: any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockImplementation((data) => {
          responseData = data;
          return res;
        })
      } as any;

      await createListing(req, res);

      expect(responseData.verification_status).toBe('PENDING_REVIEW');
      const scanCheck = db.listing_verification_checks?.find(c => c.listing_id === responseData.listing_id && c.check_type === 'AUTOMATED_CONTENT_SCAN');
      expect(scanCheck?.result).toBe('FAIL');
    });

    it('should auto-approve listing if seller is not verified and content is clean', async () => {
      const req = {
        body: { title: 'Standard Item', description: 'Clean description', price: 10 },
        user: { user_id: 101, username: 'buyer' } // buyer is not verified
      } as any;

      let responseData: any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockImplementation((data) => {
          responseData = data;
          return res;
        })
      } as any;

      await createListing(req, res);

      expect(responseData.verification_status).toBe('APPROVED');
    });

    it('should prevent purchase of non-approved listing', async () => {
      // Create a pending listing first by using a prohibited keyword
      const reqCreate = {
        body: { title: 'Pending Store Listing hack', price: 15 },
        user: { user_id: 101, username: 'buyer' }
      } as any;

      let createdListing: any;
      const resCreate = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockImplementation((data) => {
          createdListing = data;
          return resCreate;
        })
      } as any;

      await createListing(reqCreate, resCreate);

      // Try to buy it
      const reqBuy = {
        body: { listingId: createdListing.listing_id },
        user: { user_id: 102, username: 'seller' }
      } as any;

      let errorMsg: string = '';
      const resBuy = {
        status: vi.fn().mockImplementation((code) => {
          return {
            json: (data: any) => {
              errorMsg = data.error;
            }
          };
        }),
        json: vi.fn()
      } as any;

      await createEscrow(reqBuy, resBuy);
      expect(errorMsg).toContain('under review');
    });

    it('should support multi-currency exchange with static rates and platform spread', async () => {
      // Seeding USD_SIM balance for user 101
      const usdBalance = { user_id: 101, currency_code: 'USD_SIM', balance_cents: 2000, updated_at: Date.now() }; // $20.00
      db.wallet_balances = [usdBalance];

      const req = {
        body: { fromCurrency: 'USD_SIM', toCurrency: 'VLM', amountCents: 1000 }, // Exchange $10.00
        user: { user_id: 101, username: 'buyer' }
      } as any;

      let resultData: any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockImplementation((data) => {
          resultData = data;
          return res;
        })
      } as any;

      await exchangeCurrencyAction(req, res);

      expect(resultData.success).toBe(true);
      expect(resultData.debited_cents).toBe(1000);
      
      // Conversion: 1000 * 10 rate = 10000 gross. 1.5% spread = 150 cents. Net = 9850 VLM cents.
      expect(resultData.credited_cents).toBe(9850);
      expect(resultData.platform_spread_cents).toBe(150);

      // Verify double-entry ledger rows
      const exchangeLedgers = db.wallet_ledger_entries?.filter(l => l.entry_type === 'CURRENCY_EXCHANGE');
      expect(exchangeLedgers).toHaveLength(2);
      expect(exchangeLedgers?.find(l => l.currency_code === 'USD_SIM')?.amount_cents).toBe(-1000);
      expect(exchangeLedgers?.find(l => l.currency_code === 'VLM')?.amount_cents).toBe(9850);
    });

    it('should decrement inventory on buy and increment back on revert', async () => {
      // 1. Create approved listing with inventory
      const reqCreate = {
        body: { title: 'In Stock Asset', price: 20, inventory_count: '5' },
        user: { user_id: 102, username: 'seller' } // Verified seller
      } as any;

      let created: any;
      const resCreate = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockImplementation((data) => {
          created = data;
          return resCreate;
        })
      } as any;

      await createListing(reqCreate, resCreate);
      expect(created.verification_status).toBe('APPROVED');
      expect(created.inventory_count).toBe(5);

      // 2. Buy it
      const reqBuy = {
        body: { listingId: created.listing_id },
        user: { user_id: 101, username: 'buyer' }
      } as any;

      let escrowRes: any;
      const resBuy = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockImplementation((data) => {
          escrowRes = data;
          return resBuy;
        })
      } as any;

      await createEscrow(reqBuy, resBuy);
      expect(created.inventory_count).toBe(4); // Decremented!

      // 3. Revert escrow
      const reqRevert = {
        params: { transactionId: escrowRes.transaction_id },
        user: { user_id: 101, username: 'buyer' }
      } as any;

      const resRevert = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as any;

      await revertEscrow(reqRevert, resRevert);
      expect(created.inventory_count).toBe(5); // Restocked!
    });
  });
});
