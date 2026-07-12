import { Request, Response } from 'express';
import { bankStore } from '../services/bankStore.js';
import { db } from '../db.js';

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

    const startingBalance = balance_cents !== undefined ? Number(balance_cents) : 5000000; // default NT$50,000

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
      log_id: `al_${Date.now()}_bank`,
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
      log_id: `al_${Date.now()}_bank`,
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
      log_id: `al_${Date.now()}_bank`,
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
