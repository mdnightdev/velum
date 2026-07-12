import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  submitKyc, 
  simulateKycReview,
  addPaymentMethod,
  rechargeWallet,
  requestWithdrawal,
  simulateWithdrawalReview
} from '../controllers/payments';
import { db } from '../db.js';

vi.mock('../db.js', () => {
  const mockDb: any = {
    users: [
      { user_id: 101, username: 'buyer' },
      { user_id: 102, username: 'seller' },
      { user_id: 1, username: 'Midnight' } // Admin
    ],
    kyc_verifications: [],
    payment_methods: [],
    wallet_balances: [
      { user_id: 102, currency_code: 'USD_SIM', balance_cents: 50000, updated_at: Date.now() }
    ],
    wallet_ledger_entries: [],
    recharge_requests: [],
    withdrawal_requests: [],
    currencies: [
      { currency_code: 'USD_SIM', display_name: 'Simulated USD', is_platform_native: false, redeemable_for_cash: true, decimal_places: 2, active: true }
    ],
    user_wallets: [{ user_id: 102, balance_cents: 50000 }],
    external_financial_accounts: [
      { account_token: 'ext_1', is_active: true, simulated_available_cents: 5000000, simulated_institution: 'Test Bank', account_kind: 'BANK_ACCOUNT', masked_number: '1234', created_at: Date.now() }
    ],
    external_processor_events: []
  };
  return {
    db: mockDb,
    loadDb: vi.fn(),
    saveDb: vi.fn(),
  };
});

describe('Phase 4: Users, Identity & Simulated Payments Layer Tests', () => {
  beforeEach(() => {
    db.kyc_verifications = [];
    db.payment_methods = [];
    db.recharge_requests = [];
    db.withdrawal_requests = [];
    db.wallet_ledger_entries = [];
    db.external_processor_events = [];
    db.wallet_balances = [
      { user_id: 102, currency_code: 'USD_SIM', balance_cents: 50000, updated_at: Date.now() },
      { user_id: 101, currency_code: 'USD_SIM', balance_cents: 0, updated_at: Date.now() }
    ];
    // fixed duplicate user_wallets mock
    // fixed duplicate user_wallets mock
    db.external_financial_accounts = [
      { account_token: 'ext_1', simulated_institution: 'Test Bank', account_kind: 'BANK_ACCOUNT', masked_number: '1234', is_active: true, simulated_available_cents: 1000000, created_at: Date.now() }
    ];
  });

  it('should allow user to submit KYC and simulate review', async () => {
    const reqSubmit = {
      body: { submittedName: 'John Doe', submittedDocumentType: 'PASSPORT_SIM' },
      user: { user_id: 102, username: 'seller' }
    } as any;
    
    let resSubmitData: any;
    const resSubmit = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation((data) => { resSubmitData = data; return resSubmit; })
    } as any;
    
    await submitKyc(reqSubmit, resSubmit);
    expect(db.kyc_verifications![0].status).toBe('PENDING');

    const reqReview = {
      body: { kycId: db.kyc_verifications![0].kyc_id, outcome: 'VERIFIED', level: 'FULL' },
      user: { user_id: 1, role: 'SUPPORT_ADMIN' }
    } as any;

    let resReviewData: any;
    const resReview = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation((data) => { resReviewData = data; return resReview; })
    } as any;

    await simulateKycReview(reqReview, resReview);
    expect(db.kyc_verifications![0].status).toBe('VERIFIED');
    expect(db.kyc_verifications![0].verification_level).toBe('FULL');
  });

  it('should allow user to add a payment method', async () => {
    const reqAdd = {
      body: { methodType: 'CARD', simulatedInstitution: 'Test Bank', maskedNumber: '4242' },
      user: { user_id: 102, username: 'seller' }
    } as any;

    let resAddData: any;
    const resAdd = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation((data) => { resAddData = data; return resAdd; })
    } as any;

    await addPaymentMethod(reqAdd, resAdd);
    expect(db.payment_methods![0].method_type).toBe('CARD');
    expect(db.payment_methods![0].display_label).toContain('4242');
  });

  it('should fail withdrawal request if KYC is not verified', async () => {
    const reqWithdraw = {
      body: { amount_cents: 1000, payout_method_id: 'pm_123' },
      user: { user_id: 101, username: 'buyer' }
    } as any;

    let resWithdrawData: any;
    const resWithdraw = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation((data) => { resWithdrawData = data; return resWithdraw; })
    } as any;

    await requestWithdrawal(reqWithdraw, resWithdraw);
    expect(resWithdraw.status).toHaveBeenCalledWith(403);
    expect(resWithdrawData.error).toContain('KYC identity verification required');
  });

  it('should successfully create withdrawal request if KYC is verified', async () => {
    db.kyc_verifications!.push({
      kyc_id: 'kyc_123',
      user_id: 102,
      status: 'VERIFIED',
      verification_level: 'FULL',
      submitted_name: 'John Doe',
      submitted_document_type: 'PASSPORT_SIM',
      simulated_document_ref: 'doc_1',
      created_at: Date.now(),
      updated_at: Date.now()
    } as any);

    db.payment_methods!.push({
      payment_method_id: 'pm_123',
      user_id: 102,
      method_type: 'CARD',
      external_account_token: 'ext_1',
      display_label: 'Visa 4242',
      is_default: true,
      status: 'ACTIVE',
      added_at: Date.now()
    } as any);

    const reqWithdraw = {
      body: { amount_cents: 1000, payout_method_id: 'pm_123' },
      user: { user_id: 102, username: 'seller' }
    } as any;

    let resWithdrawData: any;
    const resWithdraw = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation((data) => { resWithdrawData = data; return resWithdraw; })
    } as any;

    await requestWithdrawal(reqWithdraw, resWithdraw);
    if (!resWithdrawData.success) console.log('Withdraw error:', resWithdrawData);
    if (!resWithdrawData.success) console.error(resWithdrawData);
    expect(resWithdrawData.success).toBe(true);
    expect(db.withdrawal_requests!.length).toBe(1);
    expect(db.wallet_ledger_entries!.length).toBe(1); // Deduction ledger entry
  });

  it('should successfully complete recharge request', async () => {
    db.payment_methods!.push({
      payment_method_id: 'pm_123',
      user_id: 102,
      method_type: 'CARD',
      external_account_token: 'ext_1',
      display_label: 'Visa 4242',
      is_default: true,
      status: 'ACTIVE',
      added_at: Date.now()
    } as any);

    const reqRecharge = {
      body: { amount_cents: 5000, payment_method_id: 'pm_123' },
      user: { user_id: 102, username: 'seller' }
    } as any;

    let resRechargeData: any;
    const resRecharge = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation((data) => { resRechargeData = data; return resRecharge; })
    } as any;

    await rechargeWallet(reqRecharge, resRecharge);
    if (!resRechargeData.success) console.log('Recharge error:', resRechargeData);
    if (!resRechargeData.success) console.error(resRechargeData);
    expect(resRechargeData.success).toBe(true);
    expect(db.recharge_requests!.length).toBe(1);
    expect(db.wallet_ledger_entries!.length).toBe(1);
  });

  it('should successfully complete withdrawal review (simulate payout)', async () => {
    db.payment_methods!.push({
      payment_method_id: 'pm_123',
      user_id: 102,
      method_type: 'BANK_ACCOUNT',
      external_account_token: 'ext_1',
      display_label: 'Bank 4242',
      is_default: true,
      status: 'ACTIVE',
      added_at: Date.now()
    } as any);

    db.withdrawal_requests!.push({
      request_id: 'wth_123',
      user_id: 102,
      amount_cents: 1000,
      status: 'PENDING_REVIEW',
      payout_method_id: 'pm_123',
      kyc_verification_id: 'kyc_123',
      created_at: Date.now()
    } as any);

    const reqReview = {
      body: { requestId: 'wth_123', action: 'APPROVE' },
      user: { user_id: 1, role: 'SUPPORT_ADMIN' }
    } as any;

    let resReviewData: any;
    const resReview = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation((data) => { resReviewData = data; return resReview; })
    } as any;

    await simulateWithdrawalReview(reqReview, resReview);
    if (!resReviewData.success) console.error(resReviewData);
    expect(resReviewData.success).toBe(true);
    expect(resReviewData.status).toBe('COMPLETED');
    expect(db.withdrawal_requests![0].status).toBe('COMPLETED');
    expect(db.external_processor_events!.length).toBeGreaterThan(0);
  });
});
