import { Request, Response } from 'express';
import { bankStore } from '../services/bankStore.js';
import { db } from '../db.js';
import { generatePrefixedId } from '../utils/ulid.js';

// Get Redis storage status and system health stats
export const getBankStatus = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user && user.role === 'SUPPORT_ADMIN') {
      return res.status(403).json({ error: 'Access denied. Support Operators are restricted from Central Bank systems.' });
    }
    const status = bankStore.getStorageStatus();
    const accounts = await bankStore.getAccounts();
    const transactions = await bankStore.getTransactions();

    res.json({
      status: 'OK',
      storage: status,
      total_accounts: accounts.length,
      total_transactions: transactions.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve bank status.' });
  }
};

// Get all registered bank accounts (with RBAC role boundaries)
export const getBankAccounts = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user && user.role === 'SUPPORT_ADMIN') {
      return res.status(403).json({ error: 'Access denied. Support Operators are restricted from Central Bank systems.' });
    }
    const accounts = await bankStore.getAccounts();

    // CLI_ADMIN and LOGIN_ADMIN have full view
    res.json(accounts);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch bank accounts.' });
  }
};

// Get bank transaction history (with RBAC role boundaries)
export const getBankTransactions = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user && user.role === 'SUPPORT_ADMIN') {
      return res.status(403).json({ error: 'Access denied. Support Operators are restricted from Central Bank systems.' });
    }
    const transactions = await bankStore.getTransactions();

    // CLI_ADMIN and LOGIN_ADMIN have full view
    res.json(transactions);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch bank transactions.' });
  }
};

// Create or Link a new bank account
export const createBankAccount = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user && user.role === 'SUPPORT_ADMIN') {
      return res.status(403).json({ error: 'Access denied. Support Operators are restricted from Central Bank systems.' });
    }
    const { account_name, account_number, routing_number, institution, balance_cents, currency_code, owner_name } = req.body;

    if (!account_name || !account_number || !routing_number || !institution || !currency_code || !owner_name) {
      return res.status(400).json({ error: 'Missing required bank account registration details.' });
    }

    // Validate simulated card numbers & account formats like 4222 ****
    const cleanNumber = account_number.replace(/\s+/g, '');
    let formattedNumber = account_number;
    if (cleanNumber.length >= 12) {
      formattedNumber = `${cleanNumber.substring(0, 4)} ${cleanNumber.substring(4, 8)} ${cleanNumber.substring(8, 12)} ${cleanNumber.substring(12)}`;
    }
// Auto-generate a realistic starting balance between 5,000 and 10,000 units (500,000 to 1,000,000 cents)
	const minCents = 5000 * 100;
	const maxCents = 10000 * 100;
	const startingBalance = Math.floor(Math.random() * (maxCents - minCents + 1)) + minCents;

    const newAcc = await bankStore.createAccount({
      user_id: user.role === 'CLI_ADMIN' || user.role === 'LOGIN_ADMIN' ? null : user.user_id,
      account_name,
      account_number: formattedNumber,
      routing_number,
      institution,
      balance_cents: startingBalance,
      currency_code,
      owner_name
    });

    // Create audit log entry
    if (!db.audit_logs) db.audit_logs = [];
    db.audit_logs.push({
      log_id: `${generatePrefixedId('al')}_bank`,
      admin_id: user.user_id,
      admin_name: user.username,
      action: 'create_account',
      target_type: 'bank_account',
      target_id: newAcc.account_id,
      reason: `Registered new financial account "${newAcc.account_name}" under ${newAcc.owner_name} at ${newAcc.institution}`,
      timestamp: new Date().toISOString()
    });

    res.json(newAcc);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create bank account.' });
  }
};

// Adjust the balance of an active bank account (Admin only)
export const adjustBankAccountBalance = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { amount_cents, description } = req.body;

    if (user.role === 'SUPPORT_ADMIN') {
      return res.status(403).json({ error: 'Insufficient permissions. Support Operators cannot modify reserve allocations.' });
    }

    if (amount_cents === undefined || isNaN(amount_cents)) {
      return res.status(400).json({ error: 'Adjustment amount is required.' });
    }

    const acc = await bankStore.getAccountById(id);
    if (!acc) {
      return res.status(404).json({ error: 'Target bank account not found.' });
    }

    const updatedAcc = await bankStore.updateAccountBalance(id, Number(amount_cents));

    // Log the transaction
    await bankStore.logTransaction({
      account_id: id,
      type: Number(amount_cents) >= 0 ? 'deposit' : 'withdrawal',
      amount_cents: Math.abs(Number(amount_cents)),
      currency_code: acc.currency_code,
      description: description || 'Administrative balance adjustment',
      status: 'completed'
    });

    // Log audit trail
    if (!db.audit_logs) db.audit_logs = [];
    db.audit_logs.push({
      log_id: `${generatePrefixedId('al')}_bank`,
      admin_id: user.user_id,
      admin_name: user.username,
      action: 'adjust_balance',
      target_type: 'bank_account',
      target_id: id,
      reason: `Adjusted bank reserve balance of ${acc.account_name} by ${(Number(amount_cents) / 100).toFixed(2)} ${acc.currency_code}. Reason: ${description || 'Manual adjustment'}`,
      timestamp: new Date().toISOString()
    });

    res.json(updatedAcc);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to adjust account balance.' });
  }
};

// Freeze or Unfreeze a bank account (Admin only)
export const freezeBankAccount = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { frozen } = req.body;

    if (user.role === 'SUPPORT_ADMIN') {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }

    const acc = await bankStore.getAccountById(id);
    if (!acc) {
      return res.status(404).json({ error: 'Target bank account not found.' });
    }

    const updatedAcc = await bankStore.freezeAccount(id, !!frozen);

    // Log audit trail
    if (!db.audit_logs) db.audit_logs = [];
    db.audit_logs.push({
      log_id: `${generatePrefixedId('al')}_bank`,
      admin_id: user.user_id,
      admin_name: user.username,
      action: frozen ? 'freeze_account' : 'unfreeze_account',
      target_type: 'bank_account',
      target_id: id,
      reason: `${frozen ? 'Froze' : 'Unfroze'} financial account ${acc.account_name} (${acc.account_number})`,
      timestamp: new Date().toISOString()
    });

    res.json(updatedAcc);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update account freeze status.' });
  }
};

// Get all withdrawal requests (Payment Queue)
export const getWithdrawalQueue = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user && user.role === 'SUPPORT_ADMIN') {
      return res.status(403).json({ error: 'Access denied.' });
    }
    db.withdrawal_requests = db.withdrawal_requests || [];
    res.json(db.withdrawal_requests.sort((a, b) => Number(b.created_at) - Number(a.created_at)));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch withdrawal queue.' });
  }
};

// Get limits monitoring data
export const getLimitsMonitoring = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user && user.role === 'SUPPORT_ADMIN') {
      return res.status(403).json({ error: 'Access denied.' });
    }
    db.users = db.users || [];
    db.kyc_verifications = db.kyc_verifications || [];
    db.withdrawal_requests = db.withdrawal_requests || [];
    
    const limitsData = db.users.map(u => {
      const kyc = db.kyc_verifications!.find(k => Number(k.user_id) === Number(u.user_id));
      const level = kyc?.verification_level || 'NONE';
      let maxLimitCents = 0;
      if (level === 'BASIC') maxLimitCents = 50000; // $500
      if (level === 'FULL') maxLimitCents = 10000000; // $100,000
      
      const oneDayAgo = Date.now() - 86400000;
      const recentWithdrawals = db.withdrawal_requests!.filter(
        w => Number(w.user_id) === Number(u.user_id) && 
             (w.status === 'COMPLETED' || w.status === 'PENDING_REVIEW') && 
             Number(w.created_at) > oneDayAgo
      );
      const usageCents = recentWithdrawals.reduce((sum, w) => sum + w.amount_cents, 0);
      
      return {
        user_id: u.user_id,
        username: u.username,
        kyc_level: level,
        max_limit_cents: maxLimitCents,
        used_24h_cents: usageCents,
        status: usageCents >= maxLimitCents && maxLimitCents > 0 ? 'LIMIT_REACHED' : (usageCents > maxLimitCents * 0.8 && maxLimitCents > 0 ? 'WARNING' : 'NORMAL')
      };
    });
    
    res.json(limitsData);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch limits.' });
  }
};

export const getIssuedCards = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user && user.role === 'SUPPORT_ADMIN') {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const extAccounts = db.external_financial_accounts || [];
    // Only return ones where it is Velum or they are a CARD
    const issuedCards = extAccounts.filter(a => a.account_kind === 'CREDIT_CARD' || a.account_kind === 'DEBIT_CARD' || a.institution.includes('Velum'));
    res.json(issuedCards);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch issued cards.' });
  }
};
