import { Request, Response } from 'express';
import { db, loadDb, saveDb } from '../db.js';
import { runInTransaction } from '../db/index.js';
import { generateUlid } from '../utils/ulid.js';
import { generateTrcCode } from '../utils/trc.js';
import { walletRepository } from '../db/walletRepository.js';
import { bankStore } from '../services/bankStore.js';
import { 
  UserWallet, 
  WalletLedgerEntry, 
  RechargeRequest, 
  WithdrawalRequest, 
  KycVerification, 
  PaymentMethod, 
  ExternalFinancialAccount, 
  ExternalProcessorEvent,
  WalletBalance,
  Currency,
  ExchangeRate 
} from '../../src/types.js';

export function getOrCreateWallet(userId: number): UserWallet {
  db.user_wallets = db.user_wallets || [];
  let wallet = db.user_wallets.find(w => Number(w.user_id) === Number(userId));
  if (!wallet) {
    wallet = {
      user_id: userId,
      balance_cents: 0,
      updated_at: Date.now()
    };
    db.user_wallets.push(wallet);
    saveDb(true);
  }
  return wallet;
}

export function getOrCreateWalletBalance(userId: number, currencyCode: string): WalletBalance {
  db.wallet_balances = db.wallet_balances || [];
  let bal = db.wallet_balances.find(b => Number(b.user_id) === Number(userId) && b.currency_code === currencyCode);
  if (!bal) {
    let initialBalance = 0;
    if (currencyCode === 'VLM') {
      const oldWallet = getOrCreateWallet(userId);
      initialBalance = oldWallet.balance_cents;
    }
    bal = {
      user_id: userId,
      currency_code: currencyCode,
      balance_cents: initialBalance,
      updated_at: Date.now()
    };
    db.wallet_balances.push(bal);
    saveDb(true);
  }
  return bal;
}

export function getOrCreateKyc(userId: number): KycVerification {
  db.kyc_verifications = db.kyc_verifications || [];
  let kyc = db.kyc_verifications.find(k => Number(k.user_id) === Number(userId));
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
    saveDb(true);
  }
  return kyc;
}

export function maxWithdrawalCentsFor(level: 'NONE' | 'BASIC' | 'FULL'): number {
  switch (level) {
    case 'NONE': return 0;
    case 'BASIC': return 50000; // $500 sandbox cap
    case 'FULL': return 10000000; // $100,000 sandbox cap
  }
}

// SIMULATOR LOGIC
export function simulateProcessorCharge(
  account: ExternalFinancialAccount,
  amountCents: number,
  randomDeclineRate = 0.02
) {
  const latency = 300 + Math.floor(Math.random() * 900);

  if (!account.is_active) {
    return { result: 'DECLINED_ACCOUNT_FROZEN', latency };
  }
  if (account.expires_at_sim && Date.now() > Number(account.expires_at_sim)) {
    return { result: 'DECLINED_EXPIRED', latency };
  }
  if (amountCents > account.available_cents) {
    return { result: 'DECLINED_INSUFFICIENT_FUNDS', latency };
  }
  if (Math.random() < randomDeclineRate) {
    return { result: 'DECLINED_GENERIC', latency };
  }

  return {
    result: 'APPROVED',
    latency,
    new_available_cents: account.available_cents - amountCents
  };
}

export function simulateProcessorPayout(
  account: ExternalFinancialAccount,
  amountCents: number
) {
  const latency = 500 + Math.floor(Math.random() * 1500);
  if (!account.is_active) {
    return { result: 'DECLINED_ACCOUNT_FROZEN', latency };
  }
  return {
    result: 'APPROVED',
    latency,
    new_available_cents: account.available_cents + amountCents
  };
}

// ENDPOINTS

// 1. Wallet and Balance
export const getWalletAndIdentity = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    loadDb();
    const wallet = getOrCreateWallet(user.user_id);
    const kyc = getOrCreateKyc(user.user_id);
    res.json({ wallet, kyc });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve wallet information.' });
  }
};

// 2. KYC Submission
export const submitKyc = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { submittedName, submittedDocumentType } = req.body;

    if (!submittedName || !submittedDocumentType) {
      return res.status(400).json({ error: 'Name and document type are required.' });
    }

    const docTypes = ['PASSPORT_SIM', 'DRIVERS_LICENSE_SIM', 'NATIONAL_ID_SIM'];
    if (!docTypes.includes(submittedDocumentType)) {
      return res.status(400).json({ error: 'Invalid document type.' });
    }

    loadDb();
    db.kyc_verifications = db.kyc_verifications || [];
    
    let kyc = db.kyc_verifications.find(k => Number(k.user_id) === Number(user.user_id));
    if (!kyc) {
      kyc = {
        kyc_id: `kyc_${generateUlid()}`,
        user_id: user.user_id,
        status: 'PENDING',
        verification_level: 'NONE',
        submitted_name: submittedName,
        submitted_document_type: submittedDocumentType as any,
        simulated_document_ref: `doc_ref_${generateUlid()}`,
        created_at: Date.now(),
        updated_at: Date.now()
      };
      db.kyc_verifications.push(kyc);
    } else {
      kyc.status = 'PENDING';
      kyc.submitted_name = submittedName;
      kyc.submitted_document_type = submittedDocumentType as any;
      kyc.simulated_document_ref = `doc_ref_${generateUlid()}`;
      kyc.updated_at = Date.now();
    }

    saveDb(true);
    res.json(kyc);
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit identity data.' });
  }
};

// Simulate KYC review by admin or automatic trigger
export const processKycReview = async (req: Request, res: Response) => {
  try {
    const { kycId, outcome, level } = req.body; // outcome: 'VERIFIED' | 'REJECTED', level: 'BASIC' | 'FULL'
    if (!kycId || !outcome) {
      return res.status(400).json({ error: 'Kyc ID and outcome are required.' });
    }

    loadDb();
    db.kyc_verifications = db.kyc_verifications || [];
    const kyc = db.kyc_verifications.find(k => k.kyc_id === kycId);
    if (!kyc) {
      return res.status(404).json({ error: 'KYC record not found.' });
    }

    kyc.status = outcome;
    kyc.verification_level = outcome === 'VERIFIED' ? (level || 'BASIC') : 'NONE';
    kyc.reviewed_at = Date.now();
    kyc.updated_at = Date.now();

    saveDb(true);
    res.json(kyc);
  } catch (err) {
    res.status(500).json({ error: 'KYC review simulation failed.' });
  }
};

// 3. Payment Methods Management
export const getPaymentMethods = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    loadDb();
    db.payment_methods = db.payment_methods || [];
    db.external_financial_accounts = db.external_financial_accounts || [];

    const activeMethods = db.payment_methods.filter(
      m => Number(m.user_id) === Number(user.user_id) && m.status !== 'REMOVED'
    );
  const enrichedMethods = activeMethods.map(m => {
    const ext = db.external_financial_accounts?.find(
      acc => acc.account_token === m.external_account_token && Number(acc.user_id) === Number(user.user_id)
    );
    return {
      ...m,
      method_id: m.payment_method_id,
      institution: ext?.institution || 'Unknown Institution',
      masked_number: ext?.masked_number || '••••',
      external_balance_cents: ext?.available_cents ?? 0
    };
  });

    res.json(enrichedMethods);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payment methods.' });
  }
};

function formatSimulatedCredentials(numberStr: string, methodType: string): string {
  const digits = numberStr.replace(/\D/g, '');
  if (methodType === 'CARD') {
    if (digits.startsWith('4222')) {
      const lastFour = digits.substring(Math.max(0, digits.length - 4)) || '4242';
      return `4222 2222 **** ${lastFour}`;
    }
    const bin = digits.substring(0, 4) || '4222';
    const lastFour = digits.substring(Math.max(0, digits.length - 4)) || '1111';
    return `${bin.substring(0, 4)} ${bin.padEnd(4, '2').substring(0, 4)} **** ${lastFour}`;
  } else {
    const lastFour = digits.substring(Math.max(0, digits.length - 4)) || '9999';
    return `•••• **** ${lastFour}`;
  }
}

export const addPaymentMethod = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { methodType, institution, maskedNumber, initialBalanceCents } = req.body;

    if (!methodType || !institution || !maskedNumber) {
      return res.status(400).json({ error: 'Missing payment method details.' });
    }

    if (methodType !== 'CARD' && methodType !== 'BANK_ACCOUNT') {
      return res.status(400).json({ error: 'Invalid financial account class.' });
    }

    const formattedMaskedNumber = formatSimulatedCredentials(maskedNumber, methodType);

    loadDb();
    db.external_financial_accounts = db.external_financial_accounts || [];
    db.payment_methods = db.payment_methods || [];

    const accountToken = `tok_${generateUlid()}`;
    let startingBalance = initialBalanceCents ? Number(initialBalanceCents) : Math.floor(Math.random() * (10000 - 5000 + 1) + 5000) * 100;

    if (institution.includes("Velum")) {
      const userAccounts = db.external_financial_accounts.filter(a => Number(a.user_id) === Number(user.user_id));
      let maxBalance = 0;
      userAccounts.forEach(a => {
        if (a.available_cents > maxBalance) maxBalance = a.available_cents;
      });
      const maxBalanceUSD = maxBalance / 100;
      let creditLimit = 0;
      if (maxBalanceUSD >= 9000) creditLimit = 1500;
      else if (maxBalanceUSD >= 7000) creditLimit = 1000;
      else if (maxBalanceUSD >= 5000) creditLimit = 500;
      startingBalance = creditLimit * 100;
    }


    const extAccount: ExternalFinancialAccount = {
      account_token: accountToken,
      user_id: Number(user.user_id),
      account_kind: methodType,
      institution: institution,
      masked_number: formattedMaskedNumber,
      available_cents: startingBalance,
      expires_at_sim: methodType === 'CARD' ? (institution.includes("Velum") ? Date.now() + 31536000000 * 5 : Date.now() + 31536000000 * 3) : null, // 3 years expiry
      is_active: true,
      created_at: Date.now()
    };
    db.external_financial_accounts.push(extAccount);

    // Set other active ones for this user to default = false if is_default is true
    const methodId = `pm_${generateUlid()}`;
    db.payment_methods.forEach(pm => {
      if (Number(pm.user_id) === Number(user.user_id)) {
        pm.is_default = false;
      }
    });

    const newMethod: PaymentMethod = {
      payment_method_id: methodId,
      user_id: user.user_id,
      method_type: methodType,
      external_account_token: accountToken,
      display_label: `${institution} ${formattedMaskedNumber}`,
      is_default: true,
      status: 'ACTIVE',
      added_at: Date.now()
    };
    db.payment_methods.push(newMethod);

    saveDb(true);
    res.json({
      ...newMethod,
      method_id: newMethod.payment_method_id,
      institution: institution,
      masked_number: formattedMaskedNumber,
      external_balance_cents: startingBalance
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record payment method.' });
  }
};

export const removePaymentMethod = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { methodId } = req.params;

    loadDb();
    db.payment_methods = db.payment_methods || [];
    const method = db.payment_methods.find(
      m => m.payment_method_id === methodId && Number(m.user_id) === Number(user.user_id)
    );

    if (!method) {
      return res.status(404).json({ error: 'Method reference not found.' });
    }

    method.status = 'REMOVED';
    method.removed_at = Date.now();

    saveDb(true);
    res.json({ success: true, payment_method_id: methodId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove saved payment credentials.' });
  }
};

// 4. Recharge Balance (Deposits)
export const updateSimulatedAccountBalance = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { token, balanceCents } = req.body;

    if (!token || balanceCents === undefined) {
      return res.status(400).json({ error: 'Missing token or balanceCents.' });
    }

    loadDb();
    const updated = walletRepository.updateExternalAccountBalance(
      token, 
      Number(user.user_id), 
      Number(balanceCents)
    );

    if (!updated) {
      return res.status(404).json({ error: 'Simulated account not found or access denied.' });
    }

    res.json({ success: true, account: updated });
  } catch (err) {
    console.error("[DEPOSIT-ERROR]", err);
    res.status(500).json({ error: 'Failed to update simulated balance.' });
  }
};


export const rechargeWallet = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { amount_cents, payment_method_id } = req.body;

    const amount = Number(amount_cents);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Recharge amount must be positive cents.' });
    }

    loadDb();
    db.payment_methods = db.payment_methods || [];
    db.external_financial_accounts = db.external_financial_accounts || [];
    db.recharge_requests = db.recharge_requests || [];
    db.external_processor_events = db.external_processor_events || [];
    db.wallet_ledger_entries = db.wallet_ledger_entries || [];

    const method = db.payment_methods.find(
      m => m.payment_method_id === payment_method_id && Number(m.user_id) === Number(user.user_id)
    );
    if (!method || method.status !== 'ACTIVE') {
      return res.status(404).json({ error: 'Payment method not found or invalid.' });
    }

    const extAccount = db.external_financial_accounts.find(
      a => a.account_token === method.external_account_token
    );
    if (!extAccount) {
      return res.status(500).json({ error: 'External account linking error.' });
    }

    const surchargeType = method.method_type === 'CARD' ? 'INST' : 'ACH';
    const requestId = generateTrcCode('recharge', surchargeType);
    const newRequest: RechargeRequest = {
      request_id: requestId,
      user_id: user.user_id,
      amount_cents: amount,
      status: 'PENDING',
      simulated_method: method.display_label,
      payment_method_id,
      created_at: Date.now()
    };
    db.recharge_requests.push(newRequest);

    // Call simulated charge
    const chargeSim = simulateProcessorCharge(extAccount, amount);

    const eventId = `ev_${generateUlid()}`;
    const processorEvent: ExternalProcessorEvent = {
      event_id: eventId,
      account_token: extAccount.account_token,
      direction: 'CHARGE',
      amount_cents: amount,
      result: chargeSim.result as any,
      simulated_latency_ms: chargeSim.latency,
      related_request_id: requestId,
      created_at: Date.now()
    };
    db.external_processor_events.push(processorEvent);

    if (chargeSim.result === 'APPROVED' && chargeSim.new_available_cents !== undefined) {
      extAccount.available_cents = chargeSim.new_available_cents;
      newRequest.status = 'COMPLETE';

      // Ledger update (Legacy)
      // Deposit corresponding TWD to central bank reserve
      const twdAmountCents = Math.round(amount / 0.031);
      // Atomicity: Do async calls before local DB mutation
      await bankStore.updateAccountBalance('bank_central_reserve', twdAmountCents);
      await bankStore.logTransaction({
          account_id: 'bank_central_reserve',
          type: 'deposit',
          amount_cents: twdAmountCents,
          currency_code: 'TWD',
          description: `Central liquidity backup for user ${user.user_id} recharge`,
          status: 'completed'
      });

      let updatedUsdWallet: WalletBalance | undefined;

      await runInTransaction((uow) => {
        const preferredCurrency = user.preferred_currency || 'USD';
        
        // Target balance update based on preferred currency
        const targetBalance = uow.getBalance(user.user_id, preferredCurrency);
        const newTargetBalance = targetBalance + amount;
        uow.stageBalanceUpdate(user.user_id, preferredCurrency, newTargetBalance);

        // Also update legacy VLM wallet if needed (to match original behavior)
        const vlmBalance = uow.getBalance(user.user_id, 'VLM');
        const newVlmBalance = vlmBalance + amount;
        uow.stageBalanceUpdate(user.user_id, 'VLM', newVlmBalance);

        const ledgerEntry: WalletLedgerEntry = {
          entry_id: generateTrcCode('recharge', surchargeType),
          user_id: user.user_id,
          entry_type: 'RECHARGE',
          amount_cents: amount,
          balance_after_cents: newTargetBalance,
          actor_type: 'USER',
          actor_id: String(user.user_id),
          is_simulated: true,
          created_at: Date.now()
        };
        uow.stageLedgerEntry(ledgerEntry);
      });

      const updatedWallet = walletRepository.findWalletBalance(user.user_id, user.preferred_currency || 'USD');

      return res.json({
        success: true,
        status: 'SIMULATED_COMPLETE',
        amount_cents: amount,
        wallet: updatedWallet,
      });

    } else {
      newRequest.status = 'FAILED';
      saveDb(true);
      return res.status(400).json({
        error: `Transaction declined by card issuer: ${chargeSim.result}`,
        status: 'FAILED',
        event: processorEvent
      });
    }
  } catch (err) {
    console.error("[RECHARGE-CATCH-ERROR]", err);
    res.status(500).json({ error: 'Recharge process failed.' });
  }
};

// 5. Withdrawal Requests (Payouts)
export const requestWithdrawal = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { amount_cents, payout_method_id } = req.body;

    const amount = Number(amount_cents);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Withdrawal amount must be positive cents.' });
    }

    loadDb();
    db.payment_methods = db.payment_methods || [];
    db.kyc_verifications = db.kyc_verifications || [];
    db.withdrawal_requests = db.withdrawal_requests || [];
    db.wallet_ledger_entries = db.wallet_ledger_entries || [];

    const kyc = db.kyc_verifications.find(
      k => Number(k.user_id) === Number(user.user_id)
    );
    if (!kyc || kyc.status !== 'VERIFIED') {
      return res.status(403).json({ error: 'KYC identity verification required for withdrawals.' });
    }

    const limit = maxWithdrawalCentsFor(kyc.verification_level);
    if (amount > limit) {
      return res.status(400).json({ 
        error: `Amount exceeds the maximum withdrawal cap of $${(limit / 100).toFixed(2)} for ${kyc.verification_level} level.` 
      });
    }

    const method = db.payment_methods.find(
      m => m.payment_method_id === payout_method_id && Number(m.user_id) === Number(user.user_id)
    );
    if (!method || method.status !== 'ACTIVE') {
      return res.status(404).json({ error: 'Payout destination method not found.' });
    }

    const wallet = getOrCreateWallet(user.user_id);
    if (wallet.balance_cents < amount) {
      return res.status(400).json({ error: 'Insufficient wallet ledger balance.' });
    }

    // Debit wallet instantly & hold in pending review
    const balanceAfter = wallet.balance_cents - amount;
    wallet.balance_cents = balanceAfter;
    wallet.updated_at = Date.now();

    const trcCode = generateTrcCode('withdrawal', kyc.verification_level);
    const ledgerEntry: WalletLedgerEntry = {
      entry_id: trcCode,
      user_id: user.user_id,
      entry_type: 'WITHDRAWAL',
      amount_cents: -amount, // Debit is negative
      balance_after_cents: balanceAfter,
      actor_type: 'USER',
      actor_id: String(user.user_id),
      is_simulated: true,
      created_at: Date.now()
    };
    db.wallet_ledger_entries.push(ledgerEntry);

    const requestId = trcCode;
    const newRequest: WithdrawalRequest = {
      request_id: requestId,
      user_id: user.user_id,
      amount_cents: amount,
      status: 'PENDING_REVIEW',
      payout_method_id,
      kyc_verification_id: kyc.kyc_id,
      created_at: Date.now()
    };
    db.withdrawal_requests.push(newRequest);

    saveDb(true);
    res.json({
      success: true,
      status: 'PENDING_REVIEW',
      request: newRequest,
      wallet
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process withdrawal request.' });
  }
};

// Simulate Admin Payout Review
export const processWithdrawalReview = async (req: Request, res: Response) => {
  try {
    const { requestId, action } = req.body; // action: 'APPROVE' | 'REJECT'
    if (!requestId || !action) {
      return res.status(400).json({ error: 'Request ID and review action required.' });
    }

    loadDb();
    db.withdrawal_requests = db.withdrawal_requests || [];
    db.payment_methods = db.payment_methods || [];
    db.external_financial_accounts = db.external_financial_accounts || [];
    db.external_processor_events = db.external_processor_events || [];
    db.wallet_ledger_entries = db.wallet_ledger_entries || [];

    const request = db.withdrawal_requests.find(w => w.request_id === requestId);
    if (!request) {
      return res.status(404).json({ error: 'Withdrawal request not found.' });
    }

    if (request.status !== 'PENDING_REVIEW') {
      return res.status(400).json({ error: 'Withdrawal is not in pending review status.' });
    }

    if (action === 'APPROVE') {
      const pm = db.payment_methods.find(p => p.payment_method_id === request.payout_method_id);
      if (!pm) {
        return res.status(500).json({ error: 'Payout destination method lost.' });
      }

      const extAccount = db.external_financial_accounts.find(
        a => a.account_token === pm.external_account_token
      );
      if (!extAccount) {
        return res.status(500).json({ error: 'External destination account link lost.' });
      }

      const payoutSim = simulateProcessorPayout(extAccount, request.amount_cents);
      const eventId = `ev_${generateUlid()}`;
      const processorEvent: ExternalProcessorEvent = {
        event_id: eventId,
        account_token: extAccount.account_token,
        direction: 'PAYOUT',
        amount_cents: request.amount_cents,
        result: payoutSim.result as any,
        simulated_latency_ms: payoutSim.latency,
        related_request_id: requestId,
        created_at: Date.now()
      };
      db.external_processor_events.push(processorEvent);

      if (payoutSim.result === 'APPROVED' && payoutSim.new_available_cents !== undefined) {
        extAccount.available_cents = payoutSim.new_available_cents;
        request.status = 'COMPLETED';
        request.reviewed_at = Date.now();
        request.reviewed_by_admin_id = 'SYSTEM_AUTO_ADMIN';

        saveDb(true);
        res.json({ success: true, status: 'COMPLETED', request, event: processorEvent });
      } else {
        // Fallback frozen account, handle as reject to refund
        request.status = 'REJECTED';
        request.reviewed_at = Date.now();
        request.reviewed_by_admin_id = 'SYSTEM_AUTO_ADMIN';

        // Refund ledger
        const wallet = getOrCreateWallet(request.user_id);
        const balanceAfter = wallet.balance_cents + request.amount_cents;
        wallet.balance_cents = balanceAfter;
        wallet.updated_at = Date.now();

        const refundEntry: WalletLedgerEntry = {
          entry_id: generateTrcCode('refund', 'WTH'),
          user_id: request.user_id,
          entry_type: 'AUTOMATED_ADJUSTMENT',
          amount_cents: request.amount_cents,
          balance_after_cents: balanceAfter,
          actor_type: 'SYSTEM_AUTOMATION',
          actor_id: 'REFUND_SETTLEMENT',
          is_simulated: true,
          created_at: Date.now()
        };
        db.wallet_ledger_entries.push(refundEntry);

        saveDb(true);
        res.json({ success: true, status: 'REJECTED_REFUNDED', request, event: processorEvent });
      }
    } else {
      request.status = 'REJECTED';
      request.reviewed_at = Date.now();
      request.reviewed_by_admin_id = 'SYSTEM_AUTO_ADMIN';

      // Refund ledger
      const wallet = getOrCreateWallet(request.user_id);
      const balanceAfter = wallet.balance_cents + request.amount_cents;
      wallet.balance_cents = balanceAfter;
      wallet.updated_at = Date.now();

      const refundEntry: WalletLedgerEntry = {
        entry_id: generateTrcCode('refund', 'WTH'),
        user_id: request.user_id,
        entry_type: 'AUTOMATED_ADJUSTMENT',
        amount_cents: request.amount_cents,
        balance_after_cents: balanceAfter,
        actor_type: 'SYSTEM_AUTOMATION',
        actor_id: 'REFUND_REJECTION',
        is_simulated: true,
        created_at: Date.now()
      };
      db.wallet_ledger_entries.push(refundEntry);

      saveDb(true);
      res.json({ success: true, status: 'REJECTED_REFUNDED', request });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to process payout review.' });
  }
};

// 6. Logs & Audits
export const getLedgerHistory = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    loadDb();
    db.wallet_ledger_entries = db.wallet_ledger_entries || [];
    const entries = db.wallet_ledger_entries.filter(
      l => Number(l.user_id) === Number(user.user_id)
    ).sort((a, b) => Number(b.created_at) - Number(a.created_at));
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: 'Failed to access audit ledger.' });
  }
};

export const getExternalProcessorEvents = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    loadDb();
    db.payment_methods = db.payment_methods || [];
    db.external_processor_events = db.external_processor_events || [];

    const userTokens = db.payment_methods
      .filter(m => Number(m.user_id) === Number(user.user_id))
      .map(m => m.external_account_token);

    const relevantEvents = db.external_processor_events.filter(
      e => userTokens.includes(e.account_token)
    ).sort((a, b) => Number(b.created_at) - Number(a.created_at));

    res.json(relevantEvents);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read outside transaction feed.' });
  }
};

export const getWithdrawalsHistory = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    loadDb();
    db.withdrawal_requests = db.withdrawal_requests || [];
    const requests = db.withdrawal_requests.filter(
      w => Number(w.user_id) === Number(user.user_id)
    ).sort((a, b) => Number(b.created_at) - Number(a.created_at));
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve payout feed.' });
  }
};

// PILLAR H: Multi-Currency & Inventory Layer
export const getCurrencies = async (req: Request, res: Response) => {
  try {
    loadDb();
    db.currencies = db.currencies || [];
    res.json(db.currencies.filter(c => c.active));
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve currencies.' });
  }
};

export const getWalletBalances = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    loadDb();
    db.currencies = db.currencies || [];
    
    // Ensure VLM, USD_SIM, EUR_SIM are initialized for this user
    for (const c of db.currencies) {
      getOrCreateWalletBalance(user.user_id, c.currency_code);
    }
    
    const balances = db.wallet_balances!.filter(b => Number(b.user_id) === Number(user.user_id));
    res.json(balances);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve wallet balances.' });
  }
};

export const getExchangeRates = async (req: Request, res: Response) => {
  try {
    loadDb();
    db.exchange_rates = db.exchange_rates || [];
    res.json(db.exchange_rates);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve exchange rates.' });
  }
};

export const exchangeCurrencyAction = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { fromCurrency, toCurrency, amountCents } = req.body;
    
    if (!fromCurrency || !toCurrency || !amountCents || amountCents <= 0) {
      return res.status(400).json({ error: 'Invalid parameters. Please specify fromCurrency, toCurrency, and amountCents.' });
    }

    loadDb();
    db.currencies = db.currencies || [];
    db.exchange_rates = db.exchange_rates || [];
    
    const fromCurrObj = db.currencies.find(c => c.currency_code === fromCurrency && c.active);
    const toCurrObj = db.currencies.find(c => c.currency_code === toCurrency && c.active);
    
    if (!fromCurrObj || !toCurrObj) {
      return res.status(400).json({ error: 'One or both currencies are invalid or inactive.' });
    }

    const rateObj = db.exchange_rates.find(r => r.base_currency === fromCurrency && r.quote_currency === toCurrency);
    if (!rateObj) {
      return res.status(400).json({ error: 'Exchange rate not found for the requested currency pair.' });
    }

    const rate = rateObj.rate;
    const spreadPct = 0.015; // 1.5% platform spread
    const grossConverted = Math.floor(amountCents * rate);
    const platformSpread = Math.floor(grossConverted * spreadPct);
    const netCredited = grossConverted - platformSpread;

    const relatedTxId = `exc_${generateUlid()}`;

    await runInTransaction((uow) => {
      const fromBalance = uow.getBalance(user.user_id, fromCurrency);
      if (fromBalance < amountCents) {
        throw new Error('Insufficient balance in the source currency.');
      }

      const newFromBalance = fromBalance - amountCents;
      const toBalance = uow.getBalance(user.user_id, toCurrency);
      const newToBalance = toBalance + netCredited;

      uow.stageBalanceUpdate(user.user_id, fromCurrency, newFromBalance);
      uow.stageBalanceUpdate(user.user_id, toCurrency, newToBalance);

      uow.stageLedgerEntry({
        entry_id: `led_${generateUlid()}`,
        user_id: user.user_id,
        currency_code: fromCurrency,
        entry_type: 'CURRENCY_EXCHANGE',
        amount_cents: -amountCents,
        balance_after_cents: newFromBalance,
        related_transaction_id: relatedTxId,
        actor_type: 'USER',
        actor_id: String(user.user_id),
        is_simulated: true,
        created_at: Date.now()
      });

      uow.stageLedgerEntry({
        entry_id: `led_${generateUlid()}`,
        user_id: user.user_id,
        currency_code: toCurrency,
        entry_type: 'CURRENCY_EXCHANGE',
        amount_cents: netCredited,
        balance_after_cents: newToBalance,
        related_transaction_id: relatedTxId,
        actor_type: 'USER',
        actor_id: String(user.user_id),
        is_simulated: true,
        created_at: Date.now()
      });
    });

    res.json({
      success: true,
      conversion_id: relatedTxId,
      debited_cents: amountCents,
      credited_cents: netCredited,
      rate_used: rate,
      platform_spread_cents: platformSpread,
      balances: [
        walletRepository.findWalletBalance(user.user_id, fromCurrency),
        walletRepository.findWalletBalance(user.user_id, toCurrency)
      ]
    });
  } catch (err: any) {
    if (err.message === 'Insufficient balance in the source currency.') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to execute currency conversion.' });
  }
};
