import { db } from '../db.js';
import { generateUlid } from '../utils/ulid.js';
import { 
  UserWallet, WalletBalance, KycVerification, 
  PaymentMethod, ExternalFinancialAccount, WalletLedgerEntry 
} from '../../src/types.js';

export const walletRepository = {
  // ==========================================
  // USER WALLETS (OLD VLM ONLY WALLET BACKWARD COMPATIBILITY)
  // ==========================================

  findWalletByUserId(userId: number): UserWallet | undefined {
    return (db.user_wallets || []).find(w => w && Number(w.user_id) === Number(userId));
  },

  getOrCreateWallet(userId: number): UserWallet {
    db.user_wallets = db.user_wallets || [];
    let wallet = this.findWalletByUserId(userId);
    if (!wallet) {
      wallet = {
        user_id: userId,
        balance_cents: 0,
        updated_at: Date.now()
      };
      db.user_wallets.push(wallet);
    }
    return wallet;
  },

  updateWalletBalance(userId: number, balanceCents: number): UserWallet | undefined {
    const wallet = this.getOrCreateWallet(userId);
    wallet.balance_cents = balanceCents;
    wallet.updated_at = Date.now();
    return wallet;
  },

  // ==========================================
  // MULTI-CURRENCY BALANCES (NEW SYSTEM)
  // ==========================================

  findWalletBalance(userId: number, currencyCode: string): WalletBalance | undefined {
    return (db.wallet_balances || []).find(
      b => b && Number(b.user_id) === Number(userId) && b.currency_code === currencyCode
    );
  },

  getOrCreateWalletBalance(userId: number, currencyCode: string): WalletBalance {
    db.wallet_balances = db.wallet_balances || [];
    let bal = this.findWalletBalance(userId, currencyCode);
    if (!bal) {
      let initialBalance = 0;
      if (currencyCode === 'VLM') {
        const oldWallet = this.getOrCreateWallet(userId);
        initialBalance = oldWallet.balance_cents;
      }
      bal = {
        user_id: userId,
        currency_code: currencyCode,
        balance_cents: initialBalance,
        updated_at: Date.now()
      };
      db.wallet_balances.push(bal);
    }
    return bal;
  },

  updateWalletBalanceCents(userId: number, currencyCode: string, amountCents: number): WalletBalance {
    const bal = this.getOrCreateWalletBalance(userId, currencyCode);
    bal.balance_cents = amountCents;
    bal.updated_at = Date.now();

    // If it is VLM, keep the old legacy wallet row in sync
    if (currencyCode === 'VLM') {
      this.updateWalletBalance(userId, amountCents);
    }
    return bal;
  },

  // ==========================================
  // IDENTITY & KYC VERIFICATION
  // ==========================================

  findKycByUserId(userId: number): KycVerification | undefined {
    return (db.kyc_verifications || []).find(k => k && Number(k.user_id) === Number(userId));
  },

  getOrCreateKyc(userId: number): KycVerification {
    db.kyc_verifications = db.kyc_verifications || [];
    let kyc = this.findKycByUserId(userId);
    if (!kyc) {
      kyc = {
        kyc_id: `kyc_${generateUlid()}`,
        user_id: userId,
        status: 'UNVERIFIED',
        verification_level: 'NONE',
        created_at: Date.now(),
        updated_at: Date.now()
      };
      db.kyc_verifications.push(kyc);
    }
    return kyc;
  },

  updateKyc(userId: number, updates: Partial<KycVerification>): KycVerification {
    const kyc = this.getOrCreateKyc(userId);
    Object.assign(kyc, updates);
    kyc.updated_at = Date.now();
    return kyc;
  },

  // ==========================================
  // PAYMENT METHODS
  // ==========================================

  findPaymentMethodsByUserId(userId: number): PaymentMethod[] {
    return (db.payment_methods || []).filter(
      m => m && Number(m.user_id) === Number(userId) && m.status !== 'REMOVED'
    );
  },

  findPaymentMethodById(methodId: string): PaymentMethod | undefined {
    return (db.payment_methods || []).find(m => m && m.payment_method_id === methodId);
  },

  addPaymentMethod(method: PaymentMethod): void {
    db.payment_methods = db.payment_methods || [];
    db.payment_methods.push(method);
  },

  updatePaymentMethodsForUser(userId: number, updates: Partial<PaymentMethod>): void {
    db.payment_methods = db.payment_methods || [];
    db.payment_methods.forEach(pm => {
      if (pm && Number(pm.user_id) === Number(userId)) {
        Object.assign(pm, updates);
      }
    });
  },

  // ==========================================
  // EXTERNAL FINANCIAL ACCOUNTS (SIMULATION)
  // ==========================================
  findExternalAccountByToken(token: string, userId: number): ExternalFinancialAccount | undefined {
    return (db.external_financial_accounts || []).find(
      a => a && a.account_token === token && Number(a.user_id) === Number(userId)
    );
  },

  createExternalAccount(account: ExternalFinancialAccount): void {
    db.external_financial_accounts = db.external_financial_accounts || [];
    db.external_financial_accounts.push(account);
  },
  updateExternalAccountBalance(token: string, userId: number, newBalanceCents: number): ExternalFinancialAccount | undefined {
    const account = this.findExternalAccountByToken(token, userId);
    if (account) {
      account.available_cents = newBalanceCents;
    }
    return account;
  },

  findExternalAccountsByUserId(userId: number): ExternalFinancialAccount[] {
    return (db.external_financial_accounts || []).filter(
      a => a && Number(a.user_id) === Number(userId)
    );
  },

  // ==========================================
  // LEDGER ENTRIES
  // ==========================================

  createLedgerEntry(entry: WalletLedgerEntry): void {
    db.wallet_ledger_entries = db.wallet_ledger_entries || [];
    db.wallet_ledger_entries.push(entry);
  },

  findLedgerEntriesByUserId(userId: number): WalletLedgerEntry[] {
    return (db.wallet_ledger_entries || []).filter(e => e && Number(e.user_id) === Number(userId));
  }
};
