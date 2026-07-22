import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
// @ts-ignore
import sqliteModule from 'node:sqlite';

let DatabaseSync = (sqliteModule as any)?.DatabaseSync;

if (!DatabaseSync) {
  try {
    const require = createRequire(import.meta.url);
    const BetterSqlite3Database = require('better-sqlite3');
    
    class BetterSqlite3Adapter {
      private dbInstance: any;
      constructor(filePath: string) {
        this.dbInstance = new BetterSqlite3Database(filePath);
      }
      exec(sql: string) {
        return this.dbInstance.exec(sql);
      }
      prepare(sql: string) {
        const stmt = this.dbInstance.prepare(sql);
        return {
          all: (...args: any[]) => stmt.all(...args),
          get: (...args: any[]) => stmt.get(...args),
          run: (...args: any[]) => stmt.run(...args),
        };
      }
      close() {
        try {
          this.dbInstance.close();
        } catch (_) {}
      }
    }
    
    DatabaseSync = BetterSqlite3Adapter as any;
    console.log('[DB] Node.js native node:sqlite DatabaseSync is not available. Fell back to better-sqlite3 adapter.');
  } catch (err: any) {
    console.error('[DB] ERROR: Both native node:sqlite and better-sqlite3 are unavailable:', err?.message || err);
  }
}

export const DB_DIR = path.join(process.cwd(), 'data');
export const DB_FILE = path.join(DB_DIR, 'velum_state_v3.bin');
export const SQLITE_FILE = path.join(DB_DIR, 'velum_db.sqlite');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

export let sqliteDb: any = null;

// Connection health tracking
export interface ConnectionHealth {
  isConnected: boolean;
  lastPingTime: number;
  uptimeMs: number;
  connectionAttempts: number;
  failedAttempts: number;
  lastError: string | null;
  walMode: boolean;
  pageCount: number;
  fileSizeBytes: number;
}

let connectionStartTime = 0;
let connectionAttempts = 0;
let failedAttempts = 0;
let lastError: string | null = null;

export function getConnectionHealth(): ConnectionHealth {
  const health: ConnectionHealth = {
    isConnected: sqliteDb !== null,
    lastPingTime: connectionStartTime,
    uptimeMs: connectionStartTime > 0 ? Date.now() - connectionStartTime : 0,
    connectionAttempts,
    failedAttempts,
    lastError,
    walMode: false,
    pageCount: 0,
    fileSizeBytes: 0
  };

  if (sqliteDb) {
    try {
      const journalMode = (sqliteDb.prepare("PRAGMA journal_mode").get() as any)?.journal_mode || '';
      health.walMode = journalMode === 'wal';
      health.pageCount = Number((sqliteDb.prepare("PRAGMA page_count").get() as any)?.page_count || 0);
      if (fs.existsSync(SQLITE_FILE)) {
        health.fileSizeBytes = fs.statSync(SQLITE_FILE).size;
      }
    } catch (_) {}
  }

  return health;
}

export function initSqlite() {
  if (sqliteDb) {
    return sqliteDb;
  }
  if (!DatabaseSync) {
    console.error('[DB] Native SQLite DatabaseSync class is not available.');
    return null;
  }
  
  connectionAttempts++;
  
  try {
    const conn = new DatabaseSync(SQLITE_FILE);
    try {
      fs.chmodSync(SQLITE_FILE, 0o600);
    } catch (_) {}
    
    // Hardened connection parameters
    try {
      conn.exec('PRAGMA journal_mode = WAL;');
      conn.exec('PRAGMA busy_timeout = 5000;');
      conn.exec('PRAGMA synchronous = NORMAL;');
      conn.exec('PRAGMA cache_size = -4000;');
      conn.exec('PRAGMA foreign_keys = ON;');
      conn.exec('PRAGMA temp_store = MEMORY;');
      conn.exec('PRAGMA mmap_size = 268435456;');
    } catch (pragmaErr) {
      console.warn('[DB] Failed to apply optimized SQLite PRAGMAs:', pragmaErr);
    }

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
    connectionStartTime = Date.now();
    lastError = null;
    
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
      'bank_accounts', 'bank_transactions', 'user_wallets', 'wallet_ledger_entries', 'recharge_requests', 'withdrawal_requests',
      'kyc_verifications', 'payment_methods', 'external_financial_accounts', 'external_processor_events',
      'wallet_balances', 'currencies', 'exchange_rates', 'platform_admins',
      'market_assets', 'market_sku_variants', 'market_asset_media', 'market_reviews',
      'market_coupons', 'market_discussions', 'market_support_chats', 'listing_verification_checks',
      'platform_financial_audit_logs', 'automation_actions', 'refund_requests', 'idempotency_records'
    ];
    
    for (const table of tables) {
      conn.exec(`CREATE TABLE IF NOT EXISTS ${table} (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);
    }

    // Persistent login nonces table schema
    conn.exec(`CREATE TABLE IF NOT EXISTS login_nonces (
        nonce TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        used INTEGER DEFAULT 0
    )`);

    // Lounges table schema
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
        id TEXT,
        slug TEXT UNIQUE,
        creator_id TEXT,
        parent_lounge_id TEXT REFERENCES lounges(lounge_id) ON DELETE CASCADE,
        updated_at INTEGER,
        is_system INTEGER DEFAULT 0,
        visibility TEXT DEFAULT 'public',
        status TEXT DEFAULT 'active'
    )`);

    // Ensure new columns exist
    try { conn.exec(`ALTER TABLE lounges ADD COLUMN icon_url TEXT`); } catch (_) {}
    try { conn.exec(`ALTER TABLE lounges ADD COLUMN is_official INTEGER DEFAULT 0`); } catch (_) {}
    try { conn.exec(`ALTER TABLE lounges ADD COLUMN accessLevel TEXT DEFAULT 'ALL'`); } catch (_) {}
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

    try { conn.exec(`ALTER TABLE market_listings ADD COLUMN seller_username TEXT`); } catch (_) {}
    try { conn.exec(`ALTER TABLE market_listings ADD COLUMN discount_price REAL`); } catch (_) {}
    try { conn.exec(`ALTER TABLE market_listings ADD COLUMN verification_status TEXT`); } catch (_) {}
    try { conn.exec(`ALTER TABLE market_listings ADD COLUMN inventory_count INTEGER`); } catch (_) {}

    try { conn.exec(`ALTER TABLE escrow_transactions ADD COLUMN coupon_applied TEXT`); } catch (_) {}
    try { conn.exec(`ALTER TABLE escrow_transactions ADD COLUMN sku_variant_id TEXT`); } catch (_) {}
    try { conn.exec(`ALTER TABLE escrow_transactions ADD COLUMN platform_fee REAL`); } catch (_) {}
    try { conn.exec(`ALTER TABLE escrow_transactions ADD COLUMN payout_amount REAL`); } catch (_) {}

    try {
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounges_parent ON lounges(parent_lounge_id)`);
    } catch (_) {}

    // Lounge Rooms table schema
    conn.exec(`CREATE TABLE IF NOT EXISTS lounge_rooms (
        id TEXT PRIMARY KEY,
        lounge_id TEXT NOT NULL,
        name TEXT NOT NULL,
        is_locked INTEGER DEFAULT 0,
        invite_code TEXT,
        created_by TEXT,
        created_at INTEGER,
        accessLevel TEXT DEFAULT 'ALL',
        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE
    )`);

    // Nodes
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

    // Precomputed closure paths table
    conn.exec(`CREATE TABLE IF NOT EXISTS node_closure (
        ancestor_id TEXT NOT NULL,
        descendant_id TEXT NOT NULL,
        depth INTEGER NOT NULL CHECK (depth >= 0),
        PRIMARY KEY (ancestor_id, descendant_id),
        FOREIGN KEY(ancestor_id) REFERENCES nodes(node_id) ON DELETE CASCADE,
        FOREIGN KEY(descendant_id) REFERENCES nodes(node_id) ON DELETE CASCADE
    )`);

    // Polymorphic custom view settings
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

    // Lounge roles
    conn.exec(`CREATE TABLE IF NOT EXISTS lounge_roles (
        role_id TEXT PRIMARY KEY,
        lounge_id TEXT NOT NULL,
        name TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
        permissions_bitfield INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE
    )`);

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

    // Schema alterations to support secondary indexes on payload tables
    try { conn.exec(`ALTER TABLE wallet_ledger_entries ADD COLUMN wallet_id TEXT`); } catch (_) {}
    try { conn.exec(`ALTER TABLE bank_transactions ADD COLUMN sender_id TEXT`); } catch (_) {}
    try { conn.exec(`ALTER TABLE bank_transactions ADD COLUMN receiver_id TEXT`); } catch (_) {}
    try { conn.exec(`ALTER TABLE messages ADD COLUMN created_at INTEGER`); } catch (_) {}
    try { conn.exec(`ALTER TABLE lounge_rooms ADD COLUMN accessLevel TEXT DEFAULT 'ALL'`); } catch (_) {}
    try { conn.exec(`ALTER TABLE sessions ADD COLUMN user_id TEXT`); } catch (_) {}

    // Secondary Indexes
    try {
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounges_owner ON lounges (owner_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounges_official ON lounges (is_official)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounges_invite_code ON lounges (invite_code)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_node_views_node ON node_views (node_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_node_federation_origin ON node_federation (origin_node_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_node_federation_target ON node_federation (target_lounge_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_node_federation_mounted ON node_federation (mounted_parent_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounge_roles_lounge ON lounge_roles (lounge_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_market_listings_seller ON market_listings (seller_id, status)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_escrow_transactions_listing ON escrow_transactions (listing_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_escrow_transactions_buyer ON escrow_transactions (buyer_id, status)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_escrow_transactions_seller ON escrow_transactions (seller_id, status)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounge_members_user ON lounge_members (user_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounge_invites_lounge ON lounge_invites (lounge_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounge_sanctions_lounge ON lounge_sanctions (lounge_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounge_sanctions_user ON lounge_sanctions (user_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounge_join_reqs_lounge ON lounge_join_requests (lounge_id, status)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounge_join_reqs_user ON lounge_join_requests (user_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounge_transfers_lounge ON lounge_ownership_transfers (lounge_id, status)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_account_deletions_user ON account_deletion_requests (user_id, status)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_user_lounge_prefs_lounge ON user_lounge_preferences (lounge_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounge_audit_logs_lounge ON lounge_audit_logs (lounge_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_system_audit_logs_actor ON system_audit_logs (actor_id)`);

      // Hardened performance secondary indexes
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_bank_ledger_perf ON wallet_ledger_entries (wallet_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_bank_tx_perf ON bank_transactions (sender_id, receiver_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_messages_chronological ON messages (created_at DESC)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_session_cleanup_perf ON sessions (user_id)`);
      conn.exec(`CREATE INDEX IF NOT EXISTS idx_lounge_members_perf ON lounge_members (lounge_id, user_id)`);
    } catch (idxErr) {
      console.warn('[DB] Secondary indexes initialization warning:', idxErr);
    }
    
    return conn;
  } catch (err: any) {
    failedAttempts++;
    lastError = err?.message || String(err);
    console.error('[DB] SQLite database connection init fault:', err?.message || err);
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
    console.error(`[DB] SQLite verification failed for ${filePath}:`, err);
    if (testDb) {
      try {
        testDb.close?.();
      } catch (_) {}
    }
    return false;
  }
}

export function closeSqliteConnection() {
  if (sqliteDb) {
    try {
      (sqliteDb as any).realClose?.();
    } catch (_) {}
    sqliteDb = null;
  }
}

export function wipeAndRebuildDatabaseFile() {
  try {
    closeSqliteConnection();
    if (fs.existsSync(SQLITE_FILE)) {
      fs.unlinkSync(SQLITE_FILE);
    }
    if (fs.existsSync(DB_FILE)) {
      fs.unlinkSync(DB_FILE);
    }
  } catch (_) {}
}