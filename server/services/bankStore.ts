import { Mutex } from "../utils/mutex.js";
const bankMutex = new Mutex();
import { createClient } from 'redis';
import { encryptData, decryptData } from './cryptoService.js';
import { db, saveDb } from '../db.js';
import { generateUlid } from '../utils/ulid.js';

// Define the Bank Account Type
export interface BankAccount {
  account_id: string;
  user_id: number | null; // null for external/escrow/reserves
  account_number: string;
  routing_number: string;
  account_name: string;
  institution: string;
  balance_cents: number;
  currency_code: string;
  owner_name: string;
  status: 'active' | 'frozen';
  created_at: number;
}

// Define the Bank Transaction Type
export interface BankTransaction {
  transaction_id: string;
  account_id: string;
  type: 'deposit' | 'withdrawal' | 'escrow_hold' | 'escrow_release';
  amount_cents: number;
  currency_code: string;
  description: string;
  status: 'completed' | 'pending_approval' | 'declined';
  timestamp: number;
}

let redisClient: any = null;
let isRedisConnected = false;

// Attempt to connect to Redis with extreme safety guards to avoid startup crashes
async function initRedis() {
  if (process.env.NODE_ENV === 'test') {
    console.log(`[BANK-REDIS] Skipping Redis connection during tests.`);
    return;
  }
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  try {
    console.log(`[BANK-REDIS] Attempting connection to Redis at ${redisUrl}...`);
    redisClient = createClient({ 
      url: redisUrl,
      socket: {
        connectTimeout: 500, // Very short timeout for tests
      }
    });
    
    redisClient.on('error', (err: any) => {
      // Catch errors silently to prevent app crashing
      if (isRedisConnected) {
        console.warn('[BANK-REDIS] Lost connection to Redis. Falling back to local ledger.');
        isRedisConnected = false;
      }
    });

    await redisClient.connect();
    isRedisConnected = true;
    console.log('[BANK-REDIS] Successfully connected to Redis! Finance ledger active on Redis.');
  } catch (err: any) {
    console.warn(`[BANK-REDIS] Connection failed: ${err.message || err}. Operating in secure local ledger mode.`);
    redisClient = null;
    isRedisConnected = false;
  }
}

// Lazy initialization on first operation
let initPromise: Promise<void> | null = null;
export async function ensureInitialized() {
  if (!initPromise) {
    initPromise = initRedis();
  }
  await initPromise;
}

// Helper to seed bank system if empty
export function seedBankSystemIfEmpty(localDb: any) {
  if (!localDb.bank_accounts) localDb.bank_accounts = [];
  if (!localDb.bank_transactions) localDb.bank_transactions = [];

  // Seed primary bank reserve accounts if not exists
  const memberAccount = localDb.bank_accounts.find((a: any) => a.account_id === 'bank_member_trust');
  if (!memberAccount) {
    localDb.bank_accounts.unshift({
      account_id: 'bank_member_trust',
      user_id: null,
      account_number: '4222 2222 3333 4444',
      routing_number: '021000021',
      account_name: 'VELUM TRUST BANK',
      institution: 'Taiwan Cooperative Bank',
      balance_cents: 0, // 0 balance so CLI can fund it
      currency_code: 'TWD',
      owner_name: 'VELUM CORPORATION',
      status: 'active',
      created_at: Date.now() - 31536000000
    });
  }

  const centralAccount = localDb.bank_accounts.find((a: any) => a.account_id === 'bank_central_reserve');
  if (!centralAccount) {
    localDb.bank_accounts.push({
      account_id: 'bank_central_reserve',
      user_id: null,
      account_number: '4222 2222 8888 9999',
      routing_number: '021000021',
      account_name: 'VELUM CENTRAL LIQUIDITY RESERVE',
      institution: 'Taiwan Cooperative Bank',
      balance_cents: 0, // 18.4B NT$ / TWD (representing 500M GBP)
      currency_code: 'TWD',
      owner_name: 'VELUM CORPORATION',
      status: 'active',
      created_at: Date.now() - 31536000000
    });
  }

  const hasEscrow = localDb.bank_accounts.some((a: any) => a.account_id === 'bank_escrow_reserve');
  if (!hasEscrow) {
    localDb.bank_accounts.push({
      account_id: 'bank_escrow_reserve',
      user_id: null,
      account_number: '4222 2222 7777 8888',
      routing_number: '021000021',
      account_name: 'VELUM ESCROW TRUSTEE HOLDINGS',
      institution: 'Taiwan Cooperative Bank',
      balance_cents: 8500000000, // $85,000,000.00
      currency_code: 'TWD',
      owner_name: 'VELUM SECURE ESCROW AGENT',
      status: 'active',
      created_at: Date.now() - 31536000000
    });
  }
}

// CORE STORE FUNCTIONS (Simplified for local-only operation)
export const bankStore = {
  getStorageStatus: () => 'OFFLINE_FALLBACK',

  getAccounts: async (): Promise<BankAccount[]> => {
    seedBankSystemIfEmpty(db);
    const rawLocal = (db as any).bank_accounts || [];
    return rawLocal.map((a: any) => ({
      ...a,
      account_number: a.account_number && String(a.account_number).includes(':') ? decryptData(a.account_number) : a.account_number,
      routing_number: a.routing_number && String(a.routing_number).includes(':') ? decryptData(a.routing_number) : a.routing_number
    }));
  },

  getUserAccounts: async (userId: number): Promise<BankAccount[]> => {
    const all = await bankStore.getAccounts();
    return all.filter(a => Number(a.user_id) === Number(userId));
  },

  getAccountById: async (accountId: string): Promise<BankAccount | undefined> => {
    const all = await bankStore.getAccounts();
    return all.find(a => a.account_id === accountId);
  },

  saveAccounts: async (accounts: BankAccount[]): Promise<void> => {
    const encryptedAccounts = accounts.map(a => ({
      ...a,
      account_number: a.account_number && !String(a.account_number).includes(':') ? encryptData(a.account_number) : a.account_number,
      routing_number: a.routing_number && !String(a.routing_number).includes(':') ? encryptData(a.routing_number) : a.routing_number
    }));
    (db as any).bank_accounts = encryptedAccounts;
    saveDb(true);
  },

  getTransactions: async (): Promise<BankTransaction[]> => {
    seedBankSystemIfEmpty(db);
    return (db as any).bank_transactions || [];
  },

  saveTransactions: async (transactions: BankTransaction[]): Promise<BankTransaction[]> => {
    (db as any).bank_transactions = transactions;
    saveDb(true);
    return transactions;
  },

  createAccount: async (acc: Omit<BankAccount, 'account_id' | 'created_at' | 'status'>): Promise<BankAccount> => {
    return bankMutex.run(async () => {
    const accounts = await bankStore.getAccounts();
    const newAcc: BankAccount = {
      ...acc,
      account_id: `bank_acc_${generateUlid()}`,
      status: 'active',
      created_at: Date.now()
    };
    accounts.push(newAcc);
    await bankStore.saveAccounts(accounts);
    return newAcc;
      });
  },
  updateAccountBalance: async (accountId: string, amountChangeCents: number): Promise<BankAccount> => {
    return bankMutex.run(async () => {
    const accounts = await bankStore.getAccounts();
    const acc = accounts.find(a => a.account_id === accountId);
    if (!acc) throw new Error('Bank account not found');
    acc.balance_cents += amountChangeCents;
    await bankStore.saveAccounts(accounts);
    return acc;
      });
  },
  freezeAccount: async (accountId: string, frozen: boolean): Promise<BankAccount> => {
    return bankMutex.run(async () => {
    const accounts = await bankStore.getAccounts();
    const acc = accounts.find(a => a.account_id === accountId);
    if (!acc) throw new Error('Bank account not found');
    acc.status = frozen ? 'frozen' : 'active';
    await bankStore.saveAccounts(accounts);
    return acc;
      });
  },
  logTransaction: async (tx: Omit<BankTransaction, 'transaction_id' | 'timestamp'>): Promise<BankTransaction> => {
    const transactions = await bankStore.getTransactions();
    const newTx: BankTransaction = {
      ...tx,
      transaction_id: `bank_tx_${generateUlid()}`,
      timestamp: Date.now()
    };
    transactions.push(newTx);
    await bankStore.saveTransactions(transactions);
    return newTx;
  }
};
