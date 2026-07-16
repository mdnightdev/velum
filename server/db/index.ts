import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
// @ts-ignore
import sqliteModule from 'node:sqlite';
import { DbSchema, defaultDb } from './schema.js';
import { encryptData, decryptData, setLegacyDecryptionSucceeded, legacyDecryptionSucceeded } from '../services/cryptoService.js';
import { generateUlid } from '../utils/ulid.js';
import { rebuildBlocksCache } from '../db.js';
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

const DatabaseSync = (sqliteModule as any)?.DatabaseSync;

export const DB_DIR = path.join(process.cwd(), 'data');
export const DB_FILE = path.join(DB_DIR, 'velum_state_v3.bin');
export const SQLITE_FILE = path.join(DB_DIR, 'velum_db.sqlite');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

export let db: DbSchema = { ...defaultDb };
export let sqliteDb: any = null;
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

export function initSqlite() {
  if (sqliteDb) {
    return sqliteDb;
  }
  if (!DatabaseSync) {
    console.error('[SYS-SECURE] Native SQLite DatabaseSync class is not available in this environment.');
    return null;
  }
  try {
    const conn = new DatabaseSync(SQLITE_FILE);
    
    // Override close method to prevent closing the persistent global connection
    const originalClose = conn.close;
    conn.close = () => {
      // Safe no-op to keep connection persistent across calls
    };
    (conn as any).realClose = () => {
      if (originalClose) {
        originalClose.call(conn);
      }
    };
    
    sqliteDb = conn;
    
    // Drop incompatible node_overwrites table if it exists with old schema
    try {
      let needsDrop = false;
      try {
        conn.prepare("SELECT id FROM node_overwrites LIMIT 1").get();
      } catch (e: any) {
        if (!e.message.includes("no such table")) {
          needsDrop = true;
        }
      }
      if (needsDrop) {
        conn.exec("DROP TABLE IF EXISTS node_overwrites");
      }
    } catch (_) {}
    
    // Main relational database schemas
    const tables = [
      'users', 'profiles', 'sessions', 'devices', 'ip_addresses',
      'messages', 'user_blocks', 'user_mutes', 'admin_sanctions',
      'invites', 'tickets', 'reports', 'recovery_events', 'suspicious_events', 'audit_logs',
      'friend_requests', 'peer_relationships', 'join_requests', 'node_overwrites',
      // New banking/payments tables
      'user_wallets', 'wallet_ledger_entries', 'recharge_requests', 'withdrawal_requests',
      'kyc_verifications', 'payment_methods', 'external_financial_accounts', 'external_processor_events',
      'wallet_balances', 'currencies', 'exchange_rates', 'platform_admins',
      // New marketplace tables
      'market_assets', 'market_sku_variants', 'market_asset_media', 'market_reviews',
      'market_coupons', 'market_discussions', 'market_support_chats', 'listing_verification_checks',
      // Missing tables to avoid data loss
      'platform_financial_audit_logs', 'automation_actions', 'refund_requests'
    ];
    
    for (const table of tables) {
      conn.exec(`CREATE TABLE IF NOT EXISTS ${table} (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);
    }

    // Persistent login nonces table schema for challenge-response replay protection
    conn.exec(`CREATE TABLE IF NOT EXISTS login_nonces (
        nonce TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        used INTEGER DEFAULT 0
    )`);

    // Lounges table schema (with icon_url, is_official, last_message_at)
    conn.exec(`CREATE TABLE IF NOT EXISTS lounges (
        lounge_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        owner_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        is_private INTEGER DEFAULT 0,
        is_official INTEGER DEFAULT 0,
        last_message_at INTEGER,
        icon_url TEXT,
        invite_code TEXT,
        
        -- New architecture columns
        id TEXT,
        slug TEXT UNIQUE,
        creator_id TEXT,
        parent_lounge_id TEXT REFERENCES lounges(lounge_id) ON DELETE CASCADE,
        updated_at INTEGER,
        is_system INTEGER DEFAULT 0,
        visibility TEXT DEFAULT 'public',
        status TEXT DEFAULT 'active'
    )`);

    // Ensure icon_url column exists in lounges if table was already created
    try {
      conn.exec(`ALTER TABLE lounges ADD COLUMN icon_url TEXT`);
    } catch (_) {
      // Column may already exist
    }
    // Ensure new columns exist
    try { conn.exec(`ALTER TABLE lounges ADD COLUMN is_official INTEGER DEFAULT 0`); } catch (_) {}
    try { conn.exec(`ALTER TABLE lounges ADD COLUMN last_message_at INTEGER`); } catch (_) {}
    try { conn.exec(`ALTER TABLE lounges ADD COLUMN invite_code TEXT`); } catch (_) {}
    try { conn.exec(`ALTER TABLE lounges ADD COLUMN id TEXT`); } catch (_) {}
    try { conn.exec(`ALTER TABLE lounges ADD COLUMN slug TEXT`); } catch (_) {}
    try { conn.exec(`ALTER TABLE lounges ADD COLUMN creator_id TEXT`); } catch (_) {}
    try { conn.exec(`ALTER TABLE lounges ADD COLUMN parent_lounge_id TEXT`); } catch (_) {}
    try { conn.exec(`ALTER TABLE lounges ADD COLUMN updated_at INTEGER`); } catch (_) {}
    try { conn.exec(`ALTER TABLE lounges ADD COLUMN is_system INTEGER DEFAULT 0`); } catch (_) {}
    try { conn.exec(`ALTER TABLE lounges ADD COLUMN visibility TEXT DEFAULT 'public'`); } catch (_) {}
    try { conn.exec(`ALTER TABLE lounges ADD COLUMN status TEXT DEFAULT 'active'`); } catch (_) {}
    try { conn.exec(`ALTER TABLE lounges ADD COLUMN type TEXT`); } catch (_) {}
    try { conn.exec(`ALTER TABLE lounges ADD COLUMN owner_user_id INTEGER`); } catch (_) {}
    try { conn.exec(`ALTER TABLE lounges ADD COLUMN hide_member_list INTEGER DEFAULT 0`); } catch (_) {}
    try { conn.exec(`ALTER TABLE lounges ADD COLUMN is_locked INTEGER DEFAULT 0`); } catch (_) {}
    try { conn.exec(`ALTER TABLE lounges ADD COLUMN last_active_at INTEGER`); } catch (_) {}

    // Ensure new columns exist for market_listings
    try { conn.exec(`ALTER TABLE market_listings ADD COLUMN seller_username TEXT`); } catch (_) {}
    try { conn.exec(`ALTER TABLE market_listings ADD COLUMN discount_price REAL`); } catch (_) {}
    try { conn.exec(`ALTER TABLE market_listings ADD COLUMN verification_status TEXT`); } catch (_) {}
    try { conn.exec(`ALTER TABLE market_listings ADD COLUMN inventory_count INTEGER`); } catch (_) {}

    // Ensure new columns exist for escrow_transactions
    try { conn.exec(`ALTER TABLE escrow_transactions ADD COLUMN coupon_applied TEXT`); } catch (_) {}
    try { conn.exec(`ALTER TABLE escrow_transactions ADD COLUMN sku_variant_id TEXT`); } catch (_) {}
    try { conn.exec(`ALTER TABLE escrow_transactions ADD COLUMN platform_fee REAL`); } catch (_) {}
    try { conn.exec(`ALTER TABLE escrow_transactions ADD COLUMN payout_amount REAL`); } catch (_) {}
    try { conn.exec(`ALTER TABLE escrow_transactions ADD COLUMN sandbox_logs TEXT`); } catch (_) {}
    try { conn.exec(`ALTER TABLE escrow_transactions ADD COLUMN sandbox_state TEXT`); } catch (_) {}
    
    // Parent Index
    try {
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounges_parent ON lounges(parent_lounge_id)`);
    } catch (_) {}

    // Lounge Rooms table schema: DEPRECATED (lounge_rooms are represented as sublounges in lounges table) but still active in legacy paths
    conn.exec(`CREATE TABLE IF NOT EXISTS lounge_rooms (
        id TEXT PRIMARY KEY,
        lounge_id TEXT NOT NULL,
        name TEXT NOT NULL,
        is_locked INTEGER DEFAULT 0,
        invite_code TEXT,
        created_by TEXT,
        created_at INTEGER,
        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE
    )`);

    // Nodes (polymorphic fractal tree nodes representing channels, workspaces, sub-spaces)
    conn.exec(`CREATE TABLE IF NOT EXISTS nodes (
        node_id TEXT PRIMARY KEY,
        lounge_id TEXT NOT NULL,
        parent_id TEXT,
        name TEXT NOT NULL,
        configuration_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE,
        FOREIGN KEY(parent_id) REFERENCES nodes(node_id) ON DELETE CASCADE
    )`);

    // Precomputed closure paths table for O(1) subtree operations and ancestry querying
    conn.exec(`CREATE TABLE IF NOT EXISTS node_closure (
        ancestor_id TEXT NOT NULL,
        descendant_id TEXT NOT NULL,
        depth INTEGER NOT NULL CHECK (depth >= 0),
        PRIMARY KEY (ancestor_id, descendant_id),
        FOREIGN KEY(ancestor_id) REFERENCES nodes(node_id) ON DELETE CASCADE,
        FOREIGN KEY(descendant_id) REFERENCES nodes(node_id) ON DELETE CASCADE
    )`);

    // Polymorphic custom view settings for any node space (e.g. Chat, Forum, Store)
    conn.exec(`CREATE TABLE IF NOT EXISTS node_views (
        view_id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        view_type TEXT NOT NULL CHECK (view_type IN ('chat', 'forum', 'marketplace_embedded', 'voice')),
        display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
        FOREIGN KEY(node_id) REFERENCES nodes(node_id) ON DELETE CASCADE
    )`);

    // Inter-lounge space sharing router
    conn.exec(`CREATE TABLE IF NOT EXISTS node_federation (
        federation_id TEXT PRIMARY KEY,
        origin_node_id TEXT NOT NULL,
        target_lounge_id TEXT NOT NULL,
        mounted_parent_id TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REVOKED')),
        FOREIGN KEY(origin_node_id) REFERENCES nodes(node_id) ON DELETE CASCADE,
        FOREIGN KEY(target_lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE,
        FOREIGN KEY(mounted_parent_id) REFERENCES nodes(node_id) ON DELETE SET NULL
    )`);

    // Lounge 64-Bit Bitwise RBAC Roles Config
    conn.exec(`CREATE TABLE IF NOT EXISTS lounge_roles (
        role_id TEXT PRIMARY KEY,
        lounge_id TEXT NOT NULL,
        name TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
        permissions_bitfield INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE
    )`);

    // High performance compound indexes for prefix scans
    conn.exec(`CREATE INDEX IF NOT EXISTS idx_closure_lookup ON node_closure (ancestor_id, descendant_id, depth)`);
    conn.exec(`CREATE INDEX IF NOT EXISTS idx_closure_reverse ON node_closure (descendant_id, ancestor_id, depth)`);
    conn.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_hierarchy ON nodes (lounge_id, parent_id)`);

    // Market listings table schema
    conn.exec(`CREATE TABLE IF NOT EXISTS market_listings (
        listing_id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        status TEXT DEFAULT 'ACTIVE',
        created_at INTEGER NOT NULL,
        seller_username TEXT,
        discount_price REAL,
        verification_status TEXT,
        inventory_count INTEGER
    )`);

    // Escrow transactions table schema
    conn.exec(`CREATE TABLE IF NOT EXISTS escrow_transactions (
        transaction_id TEXT PRIMARY KEY,
        listing_id TEXT NOT NULL,
        buyer_id TEXT NOT NULL,
        seller_id TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        coupon_applied TEXT,
        sku_variant_id TEXT,
        platform_fee REAL,
        payout_amount REAL,
        sandbox_logs TEXT,
        sandbox_state TEXT,

        FOREIGN KEY(listing_id) REFERENCES market_listings(listing_id) ON DELETE CASCADE
    )`);

    // New architecture tables
    conn.exec(`CREATE TABLE IF NOT EXISTS lounge_members (
        lounge_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        joined_via TEXT NOT NULL,
        joined_at INTEGER NOT NULL,
        PRIMARY KEY (lounge_id, user_id),
        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE
    )`);

    conn.exec(`CREATE TABLE IF NOT EXISTS lounge_invites (
        id TEXT PRIMARY KEY,
        lounge_id TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        created_by INTEGER NOT NULL,
        max_uses INTEGER DEFAULT 1,
        uses_count INTEGER DEFAULT 0,
        expires_at INTEGER,
        revoked_at INTEGER,
        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE
    )`);

    conn.exec(`CREATE TABLE IF NOT EXISTS lounge_sanctions (
        id TEXT PRIMARY KEY,
        lounge_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        applied_by INTEGER NOT NULL,
        applied_by_type TEXT NOT NULL,
        applied_at INTEGER NOT NULL,
        lifted_at INTEGER,
        reason TEXT,
        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE
    )`);

    conn.exec(`CREATE TABLE IF NOT EXISTS lounge_join_requests (
        id TEXT PRIMARY KEY,
        lounge_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        message TEXT,
        status TEXT NOT NULL,
        reviewed_by INTEGER,
        reviewed_at INTEGER,
        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE
    )`);

    conn.exec(`CREATE TABLE IF NOT EXISTS lounge_ownership_transfers (
        id TEXT PRIMARY KEY,
        lounge_id TEXT NOT NULL,
        from_user_id INTEGER NOT NULL,
        to_user_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        initiated_at INTEGER NOT NULL,
        resolved_at INTEGER,
        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE
    )`);

    conn.exec(`CREATE TABLE IF NOT EXISTS account_deletion_requests (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        requested_at INTEGER NOT NULL,
        scheduled_purge_at INTEGER NOT NULL,
        status TEXT NOT NULL
    )`);

    conn.exec(`CREATE TABLE IF NOT EXISTS user_lounge_preferences (
        user_id INTEGER NOT NULL,
        lounge_id TEXT NOT NULL,
        notifications_muted INTEGER DEFAULT 0,
        pinned INTEGER DEFAULT 0,
        pin_order INTEGER,
        PRIMARY KEY (user_id, lounge_id),
        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE
    )`);

    conn.exec(`CREATE TABLE IF NOT EXISTS lounge_audit_logs (
        id TEXT PRIMARY KEY,
        lounge_id TEXT NOT NULL,
        actor_id INTEGER NOT NULL,
        actor_type TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE
    )`);

    conn.exec(`CREATE TABLE IF NOT EXISTS system_audit_logs (
        id TEXT PRIMARY KEY,
        actor_id INTEGER NOT NULL,
        actor_type TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL
    )`);

    // ==========================================
    // HIGH-PERFORMANCE SECONDARY INDEXES
    // ==========================================
    try {
      // Lounges Table Indexes
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounges_owner ON lounges (owner_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounges_official ON lounges (is_official)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounges_invite_code ON lounges (invite_code)`);

      // Lounge Rooms Table Index: DEPRECATED

      // Node Views Table Index
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_node_views_node ON node_views (node_id)`);

      // Node Federation Table Indexes
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_node_federation_origin ON node_federation (origin_node_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_node_federation_target ON node_federation (target_lounge_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_node_federation_mounted ON node_federation (mounted_parent_id)`);

      // Lounge Roles Table Index
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounge_roles_lounge ON lounge_roles (lounge_id)`);

      // Market Listings Table Index
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_market_listings_seller ON market_listings (seller_id, status)`);

      // Escrow Transactions Table Indexes
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_escrow_transactions_listing ON escrow_transactions (listing_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_escrow_transactions_buyer ON escrow_transactions (buyer_id, status)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_escrow_transactions_seller ON escrow_transactions (seller_id, status)`);

      // Lounge Members Table Index (Compound PK is indexed, add index on user_id)
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounge_members_user ON lounge_members (user_id)`);

      // Lounge Invites Table Index
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounge_invites_lounge ON lounge_invites (lounge_id)`);

      // Lounge Sanctions Table Indexes
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounge_sanctions_lounge ON lounge_sanctions (lounge_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounge_sanctions_user ON lounge_sanctions (user_id)`);

      // Lounge Join Requests Table Indexes
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounge_join_reqs_lounge ON lounge_join_requests (lounge_id, status)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounge_join_reqs_user ON lounge_join_requests (user_id)`);

      // Lounge Ownership Transfers Table Index
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounge_transfers_lounge ON lounge_ownership_transfers (lounge_id, status)`);

      // Account Deletion Requests Table Index
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_account_deletions_user ON account_deletion_requests (user_id, status)`);

      // User Lounge Preferences Table Index (Compound PK is indexed, add index on lounge_id)
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_user_lounge_prefs_lounge ON user_lounge_preferences (lounge_id)`);

      // Lounge Audit Logs Table Index
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounge_audit_logs_lounge ON lounge_audit_logs (lounge_id)`);

      // System Audit Logs Table Index
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_system_audit_logs_actor ON system_audit_logs (actor_id)`);
    } catch (idxErr) {
      console.warn('[SYS-SECURE] Secondary indexes initialization warning:', idxErr);
    }
    
    return conn;
  } catch (err: any) {
    console.error('[SYS-SECURE] SQLite database connection init fault:', err?.message || err);
    return null;
  }
}

export function verifySqliteFile(filePath: string): boolean {
  if (!DatabaseSync) return false;
  let testDb: any = null;
  try {
    if (!fs.existsSync(filePath)) return false;
    const size = fs.statSync(filePath).size;
    if (size === 0) return true;
    testDb = new DatabaseSync(filePath);
    const row = testDb.prepare("PRAGMA integrity_check").get() as any;
    const ok = row && row.integrity_check === 'ok';
    try {
      testDb.close?.();
    } catch (_) {}
    return ok;
  } catch (err) {
    console.error(`[SYS-SECURE] SQLite verification failed for ${filePath}:`, err);
    if (testDb) {
      try {
        testDb.close?.();
      } catch (_) {}
    }
    return false;
  }
}

export function wipeAndRebuildDatabaseFile() {
  try {
    if (fs.existsSync(SQLITE_FILE)) {
      fs.unlinkSync(SQLITE_FILE);
    }
    if (fs.existsSync(DB_FILE)) {
      fs.unlinkSync(DB_FILE);
    }
  } catch (_) {}
}



export function ensureSeededIntegrity() {
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
  if (!db.lounges || db.lounges.length === 0) {
    db.lounges = [
      {
        lounge_id: 'velum_lounge',
        name: 'Velum Lounge',
        description: 'System default lounge',
        owner_id: '2',
        created_at: Date.now(),
        is_private: 0,
        is_official: 1,
        last_message_at: Date.now(),
        invite_code: 'VELUM1',
        id: 'velum_lounge',
        slug: 'velum-lounge',
        creator_id: '2',
        parent_lounge_id: null,
        updated_at: Date.now(),
        is_system: 1
      },
      {
        lounge_id: 'secops',
        name: 'SecOps Executive Coordinates',
        description: 'Private administration lounge',
        owner_id: '2',
        created_at: Date.now(),
        is_private: 1,
        is_official: 1,
        last_message_at: Date.now(),
        invite_code: 'SECOPS',
        id: 'secops',
        slug: 'secops',
        creator_id: '2',
        parent_lounge_id: null,
        updated_at: Date.now(),
        is_system: 0
      }
    ];
  } else {
    const hasVelum = db.lounges.some(l => l && l.lounge_id === 'velum_lounge');
    if (!hasVelum) {
      db.lounges.push({
        lounge_id: 'velum_lounge',
        name: 'Velum Lounge',
        description: 'System default lounge',
        owner_id: '2',
        created_at: Date.now(),
        is_private: 0,
        is_official: 1,
        last_message_at: Date.now(),
        invite_code: 'VELUM1',
        id: 'velum_lounge',
        slug: 'velum-lounge',
        creator_id: '2',
        parent_lounge_id: null,
        updated_at: Date.now(),
        is_system: 1
      });
    }
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

  // Overwrite currencies and exchange rates to ensure we use clean global major currencies
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

  db.currencies = rawCurrencies.map(c => ({
    currency_code: c.code,
    display_name: c.name,
    is_platform_native: c.native,
    redeemable_for_cash: !c.native,
    decimal_places: 2,
    active: true
  }));

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
