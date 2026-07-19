import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createRequire } from 'module';
// @ts-ignore
import sqliteModule from 'node:sqlite';
import { DbSchema, defaultDb } from './schema.js';
import { encryptData, decryptData, setLegacyDecryptionSucceeded, legacyDecryptionSucceeded } from '../services/cryptoService.js';
import { generateUlid } from '../utils/ulid.js';
import { 
  initPgBackupTable,
  getSafeDatabaseBackupBinary,
  restoreDbFromCloud,
  backupDbToCloud,
  executeCloudBackup,
  isCloudBackupDisabled,
  lastBackupAttemptTime,
  backupTimer,
  BACKUP_COOLDOWN_MS,
  setCloudBackupDisabled
} from '../services/sync.js';
import { loadDb, saveDb, executeSaveDb } from './persistence.js';
export { UnitOfWork, runInTransaction } from './unitOfWork.js';

export {
  initPgBackupTable,
  getSafeDatabaseBackupBinary,
  restoreDbFromCloud,
  backupDbToCloud,
  executeCloudBackup,
  isCloudBackupDisabled,
  lastBackupAttemptTime,
  backupTimer,
  BACKUP_COOLDOWN_MS,
  setCloudBackupDisabled,
  loadDb,
  saveDb,
  executeSaveDb
};

import {
  DB_DIR,
  DB_FILE,
  SQLITE_FILE,
  sqliteDb,
  initSqlite,
  verifySqliteFile,
  closeSqliteConnection,
  wipeAndRebuildDatabaseFile
} from './connection.js';

export {
  DB_DIR,
  DB_FILE,
  SQLITE_FILE,
  sqliteDb,
  initSqlite,
  verifySqliteFile,
  closeSqliteConnection,
  wipeAndRebuildDatabaseFile
};

export let db: DbSchema = { ...defaultDb };

export const activeUserBlocksSet = new Set<string>();

export function rebuildBlocksCache() {
  activeUserBlocksSet.clear();
  for (const b of db.user_blocks || []) {
    activeUserBlocksSet.add(`${b.block_id}_${b.blocked_id}`);
  }
}

export function isUserBlocked(userA: number, userB: number): boolean {
  if (!userA || !userB) return false;
  return activeUserBlocksSet.has(`${userA}_${userB}`) || activeUserBlocksSet.has(`${userB}_${userA}`);
}

export let dbLoaded = false;
export let isSaving = false;
export let decryptionErrorDetected = false;
export let lastSavedDbJson = '';

export function setDb(val: DbSchema) {
  db = val;
}
export function setDbLoaded(val: boolean) {
  dbLoaded = val;
}
export function setLastSavedDbJson(val: string) {
  lastSavedDbJson = val;
}

export let broadcastToRoomCallback: ((roomId: string, object: any) => void) | null = null;
export function registerBroadcastToRoomCallback(cb: (roomId: string, object: any) => void) {
  broadcastToRoomCallback = cb;
}



export function ensureSeededIntegrity() {
  let mutated = false;
  if (!db) db = { ...defaultDb };
  if (!db.users) db.users = [];
  if (!db.profiles) db.profiles = [];
  if (!db.sessions) db.sessions = [];
  if (!db.devices) db.devices = [];
  if (!db.ip_addresses) db.ip_addresses = [];

  if (!db.messages) db.messages = [];
  if (!db.user_blocks) db.user_blocks = [];
  if (!db.user_mutes) db.user_mutes = [];
  if (!db.admin_sanctions) db.admin_sanctions = [];
  if (!db.invites) db.invites = [];
  if (!db.tickets) db.tickets = [];
  if (!db.reports) db.reports = [];
  if (!db.recovery_events) db.recovery_events = [];
  if (!db.suspicious_events) db.suspicious_events = [];
  if (!db.audit_logs) db.audit_logs = [];
  if (!db.friend_requests) db.friend_requests = [];
  if (!db.peer_relationships) db.peer_relationships = [];
  if (!db.join_requests) db.join_requests = [];
  if (!db.lounge_rooms) db.lounge_rooms = [];
  if (!db.node_overwrites) db.node_overwrites = [];
  if (!db.lounge_members) db.lounge_members = [];
  if (!db.lounge_invites) db.lounge_invites = [];
  if (!db.lounge_sanctions) db.lounge_sanctions = [];
  if (!db.lounge_join_requests) db.lounge_join_requests = [];
  if (!db.lounge_ownership_transfers) db.lounge_ownership_transfers = [];
  if (!db.account_deletion_requests) db.account_deletion_requests = [];
  if (!db.user_lounge_preferences) db.user_lounge_preferences = [];
  if (!db.lounge_audit_logs) db.lounge_audit_logs = [];
  if (!db.system_audit_logs) db.system_audit_logs = [];
  if (!db.lounges) db.lounges = [];

  if (db.lounges) {
    db.lounges = db.lounges.filter(l => 
      l && 
      l.lounge_id !== 'velum_lounge' && 
      l.id !== 'velum_lounge' && 
      !l.lounge_id.startsWith('velum_') && 
      !l.id.startsWith('velum_') && 
      l.lounge_id !== 'secops' && 
      l.id !== 'secops'
    );
  }

  if (!db.market_listings) db.market_listings = [];
  if (!db.escrow_transactions) db.escrow_transactions = [];

  // Initialize new banking and marketplace arrays
  if (!db.user_wallets) db.user_wallets = [];
  if (!db.wallet_ledger_entries) db.wallet_ledger_entries = [];
  if (!db.recharge_requests) db.recharge_requests = [];
  if (!db.withdrawal_requests) db.withdrawal_requests = [];
  if (!db.kyc_verifications) db.kyc_verifications = [];
  if (!db.payment_methods) db.payment_methods = [];
  if (!db.external_financial_accounts) db.external_financial_accounts = [];
  if (!db.external_processor_events) db.external_processor_events = [];
  if (!db.wallet_balances) db.wallet_balances = [];
  if (!db.currencies) db.currencies = [];
  if (!db.exchange_rates) db.exchange_rates = [];
  if (!db.platform_admins) db.platform_admins = [];

  if (!db.market_assets) db.market_assets = [];
  if (!db.market_sku_variants) db.market_sku_variants = [];
  if (!db.market_asset_media) db.market_asset_media = [];
  if (!db.market_reviews) db.market_reviews = [];
  if (!db.market_coupons) db.market_coupons = [];
  if (!db.market_discussions) db.market_discussions = [];
  if (!db.market_support_chats) db.market_support_chats = [];
  if (!db.listing_verification_checks) db.listing_verification_checks = [];

  // Overwrite currencies and exchange rates to ensure we use clean global major currencies only if not seeded
  const rawCurrencies = [
    { code: 'VLM', name: 'Velum Token', native: true, usdVal: 0.67 },
    { code: 'TWD', name: 'New Taiwan Dollar', native: false, usdVal: 0.031 },
    { code: 'USD', name: 'US Dollar', native: false, usdVal: 1.0 },
    { code: 'EUR', name: 'Euro', native: false, usdVal: 1.08 },
    { code: 'GBP', name: 'Pound Sterling', native: false, usdVal: 1.28 },
    { code: 'JPY', name: 'Japanese Yen', native: false, usdVal: 0.0062 },
    { code: 'CAD', name: 'Canadian Dollar', native: false, usdVal: 0.73 },
    { code: 'AUD', name: 'Australian Dollar', native: false, usdVal: 0.66 },
    { code: 'CHF', name: 'Swiss Franc', native: false, usdVal: 1.11 },
    { code: 'CNY', name: 'Chinese Yuan', native: false, usdVal: 0.14 },
    { code: 'SGD', name: 'Singapore Dollar', native: false, usdVal: 0.74 },
    { code: 'HKD', name: 'Hong Kong Dollar', native: false, usdVal: 0.13 }
  ];

  if (!db.currencies || db.currencies.length === 0) {
    db.currencies = rawCurrencies.map(c => ({
      currency_code: c.code,
      display_name: c.name,
      is_platform_native: c.native,
      redeemable_for_cash: !c.native,
      decimal_places: 2,
      active: true
    }));
  }

  if (!db.exchange_rates || db.exchange_rates.length === 0) {
    const generatedRates: any[] = [];
    for (const base of rawCurrencies) {
      for (const quote of rawCurrencies) {
        if (base.code !== quote.code) {
          const rateVal = base.usdVal / quote.usdVal;
          generatedRates.push({
            rate_id: `rate_${base.code.toLowerCase()}_${quote.code.toLowerCase()}`,
            base_currency: base.code,
            quote_currency: quote.code,
            rate: Number(rateVal.toFixed(6)),
            simulated_source: 'INTERBANK_FEED',
            effective_at: Date.now()
          });
        }
      }
    }
    db.exchange_rates = generatedRates;
  }

  // Ensure system account
  if (db && db.users && !db.users.some((u: any) => u.user_id === 999)) {
    db.users.push({
      user_id: 999,
      username: 'Velum',
      password_hash: 'SYSTEM_LOCKED',
      safe_word_hash: 'SYSTEM_LOCKED',
      panic_phrase_hash: 'SYSTEM_LOCKED',
      recovery_key_hash: 'SYSTEM_LOCKED',
      role: 'SYSTEM' as any,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      salt: 'SYSTEM_LOCKED',
      uid: 'VEL-UID-VELUM'
    });
    mutated = true;
  }

  if (mutated && process.env.NODE_ENV !== 'test') {
    saveDb(true);
  }
}


export function setupAuditLogProxy() {}

export function setDecryptionErrorDetected(val: boolean) {
  decryptionErrorDetected = val;
}

export function setIsSaving(val: boolean) {
  isSaving = val;
}

// Auto-initialize the database on startup
loadDb();
