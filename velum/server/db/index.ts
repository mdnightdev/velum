import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
// @ts-ignore
import sqliteModule from 'node:sqlite';
import { DbSchema, defaultDb } from './schema.js';
import { encryptData, decryptData, setLegacyDecryptionSucceeded } from '../utils/crypto.js';
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
  setCloudBackupDisabled
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
let saveTimeout: NodeJS.Timeout | null = null;
export let decryptionErrorDetected = false;

export let broadcastToRoomCallback: ((roomId: string, object: any) => void) | null = null;
export function registerBroadcastToRoomCallback(cb: (roomId: string, object: any) => void) {
  broadcastToRoomCallback = cb;
}

export function initSqlite() {
  if (!DatabaseSync) {
    console.error('[SYS-SECURE] Native SQLite DatabaseSync class is not available in this environment.');
    return null;
  }
  try {
    const conn = new DatabaseSync(SQLITE_FILE);
    
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
      'invites', 'tickets', 'recovery_events', 'suspicious_events', 'audit_logs',
      'friend_requests', 'peer_relationships', 'join_requests', 'node_overwrites'
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
    
    // Parent Index
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
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(lounge_id) REFERENCES lounges(lounge_id) ON DELETE CASCADE
    )`);
    try { conn.exec(`ALTER TABLE lounge_rooms ADD COLUMN invite_code TEXT`); } catch (_) {}

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
        created_at INTEGER NOT NULL
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
    const hasSecOps = db.lounges.some(l => l && l.lounge_id === 'secops');
    if (!hasSecOps) {
      db.lounges.push({
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
      });
    }
  }
  if (!db.market_listings) db.market_listings = [];
  if (!db.escrow_transactions) db.escrow_transactions = [];

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

export function loadDb(force = false) {
  if (dbLoaded && !force) return;
  try {
    let sqliteLoaded = false;
    
    // 1. Try to load directly from the relational SQLite database SQLITE_FILE
    if (fs.existsSync(SQLITE_FILE)) {
      console.log('[SYS-SECURE] SQLITE_FILE found. Loading state from local relational SQLite database...');
      let conn: any = null;
      try {
        conn = new DatabaseSync(SQLITE_FILE);
        
        const loadPayloadTable = (tableName: string) => {
          try {
            // Check if table exists
            const tableCheck = conn.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
            if (!tableCheck) return [];
            
            const rows = conn.prepare(`SELECT payload FROM ${tableName}`).all() as any[];
            return rows.map((r: any) => {
              try {
                return JSON.parse(decryptData(r.payload));
              } catch (decErr) {
                console.error(`[SYS-SECURE] CRITICAL DECRYPTION FAILURE in ${tableName}:`, decErr);
                decryptionErrorDetected = true;
                return null;
              }
            }).filter(Boolean);
          } catch (err) {
            console.warn(`[SYS-SECURE] Error loading table ${tableName}:`, err);
            return [];
          }
        };

        db.users = loadPayloadTable('users');
        db.profiles = loadPayloadTable('profiles');
        db.sessions = loadPayloadTable('sessions');
        db.devices = loadPayloadTable('devices');
        db.ip_addresses = loadPayloadTable('ip_addresses');
        db.messages = loadPayloadTable('messages');
        db.user_blocks = loadPayloadTable('user_blocks');
        db.user_mutes = loadPayloadTable('user_mutes');
        db.admin_sanctions = loadPayloadTable('admin_sanctions');
        db.invites = loadPayloadTable('invites');
        db.tickets = loadPayloadTable('tickets');
        db.recovery_events = loadPayloadTable('recovery_events');
        db.suspicious_events = loadPayloadTable('suspicious_events');
        db.audit_logs = loadPayloadTable('audit_logs');
        db.friend_requests = loadPayloadTable('friend_requests');
        db.peer_relationships = loadPayloadTable('peer_relationships');
        db.join_requests = loadPayloadTable('join_requests');
        db.node_overwrites = loadPayloadTable('node_overwrites');

        // Load structured tables
        const loadTableRows = (tableName: string) => {
          try {
            const tableCheck = conn.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
            if (!tableCheck) return null;
            return conn.prepare(`SELECT * FROM ${tableName}`).all() as any[];
          } catch (err) {
            console.warn(`[SYS-SECURE] Error loading structured table ${tableName}:`, err);
            return null;
          }
        };

        const loungesRows = loadTableRows('lounges');
        if (loungesRows) {
          db.lounges = loungesRows.map((r: any) => ({
            lounge_id: r.lounge_id,
            name: r.name,
            description: r.description,
            owner_id: r.owner_id,
            created_at: Number(r.created_at),
            is_private: Number(r.is_private),
            is_official: Number(r.is_official),
            last_message_at: Number(r.last_message_at),
            icon_url: r.icon_url,
            invite_code: r.invite_code,
            id: r.id || r.lounge_id,
            slug: r.slug || r.lounge_id,
            creator_id: r.creator_id || String(r.owner_id),
            parent_lounge_id: r.parent_lounge_id || null,
            updated_at: r.updated_at ? Number(r.updated_at) : Number(r.created_at),
            is_system: r.is_system !== undefined ? Number(r.is_system) : (Number(r.is_official) === 1 ? 1 : 0),
            visibility: r.visibility || (Number(r.is_private) === 1 ? 'private' : 'public'),
            status: r.status || 'active'
          }));
        }

        const loungeRoomsRows = loadTableRows('lounge_rooms');
        if (loungeRoomsRows) {
          db.lounge_rooms = loungeRoomsRows.map((r: any) => ({
            id: r.id,
            lounge_id: r.lounge_id,
            name: r.name,
            is_locked: !!r.is_locked,
            invite_code: r.invite_code,
            created_by: r.created_by ? Number(r.created_by) : undefined,
            created_at: Number(r.created_at)
          }));
        }

        const loungeMembersRows = loadTableRows('lounge_members');
        if (loungeMembersRows) {
          db.lounge_members = loungeMembersRows.map((r: any) => ({
            lounge_id: r.lounge_id,
            user_id: Number(r.user_id),
            role: r.role,
            status: r.status,
            joined_via: r.joined_via,
            joined_at: Number(r.joined_at)
          }));
        }

        const loungeInvitesRows = loadTableRows('lounge_invites');
        if (loungeInvitesRows) {
          db.lounge_invites = loungeInvitesRows.map((r: any) => ({
            id: r.id,
            lounge_id: r.lounge_id,
            code: r.code,
            created_by: Number(r.created_by),
            max_uses: Number(r.max_uses),
            uses_count: Number(r.uses_count),
            expires_at: r.expires_at ? Number(r.expires_at) : null,
            revoked_at: r.revoked_at ? Number(r.revoked_at) : null
          }));
        }

        const loungeSanctionsRows = loadTableRows('lounge_sanctions');
        if (loungeSanctionsRows) {
          db.lounge_sanctions = loungeSanctionsRows.map((r: any) => ({
            id: r.id,
            lounge_id: r.lounge_id,
            user_id: Number(r.user_id),
            type: r.type,
            applied_by: Number(r.applied_by),
            applied_by_type: r.applied_by_type,
            applied_at: Number(r.applied_at),
            lifted_at: r.lifted_at ? Number(r.lifted_at) : null,
            reason: r.reason
          }));
        }

        const loungeJoinRequestsRows = loadTableRows('lounge_join_requests');
        if (loungeJoinRequestsRows) {
          db.lounge_join_requests = loungeJoinRequestsRows.map((r: any) => ({
            id: r.id,
            lounge_id: r.lounge_id,
            user_id: Number(r.user_id),
            message: r.message,
            status: r.status,
            reviewed_by: r.reviewed_by ? Number(r.reviewed_by) : null,
            reviewed_at: r.reviewed_at ? Number(r.reviewed_at) : null
          }));
        }

        const loungeTransfersRows = loadTableRows('lounge_ownership_transfers');
        if (loungeTransfersRows) {
          db.lounge_ownership_transfers = loungeTransfersRows.map((r: any) => ({
            id: r.id,
            lounge_id: r.lounge_id,
            from_user_id: Number(r.from_user_id),
            to_user_id: Number(r.to_user_id),
            status: r.status,
            initiated_at: Number(r.initiated_at),
            resolved_at: r.resolved_at ? Number(r.resolved_at) : null
          }));
        }

        const accountDeletionsRows = loadTableRows('account_deletion_requests');
        if (accountDeletionsRows) {
          db.account_deletion_requests = accountDeletionsRows.map((r: any) => ({
            id: r.id,
            user_id: Number(r.user_id),
            requested_at: Number(r.requested_at),
            scheduled_purge_at: Number(r.scheduled_purge_at),
            status: r.status
          }));
        }

        const userPrefsRows = loadTableRows('user_lounge_preferences');
        if (userPrefsRows) {
          db.user_lounge_preferences = userPrefsRows.map((r: any) => ({
            user_id: Number(r.user_id),
            lounge_id: r.lounge_id,
            notifications_muted: Number(r.notifications_muted),
            pinned: Number(r.pinned),
            pin_order: r.pin_order !== null ? Number(r.pin_order) : null
          }));
        }

        const loungeAuditRows = loadTableRows('lounge_audit_logs');
        if (loungeAuditRows) {
          db.lounge_audit_logs = loungeAuditRows.map((r: any) => ({
            id: r.id,
            lounge_id: r.lounge_id,
            actor_id: Number(r.actor_id),
            actor_type: r.actor_type,
            action: r.action,
            target_type: r.target_type,
            target_id: r.target_id,
            metadata: r.metadata,
            created_at: Number(r.created_at)
          }));
        }

        const systemAuditRows = loadTableRows('system_audit_logs');
        if (systemAuditRows) {
          db.system_audit_logs = systemAuditRows.map((r: any) => ({
            id: r.id,
            actor_id: Number(r.actor_id),
            actor_type: r.actor_type,
            action: r.action,
            target_type: r.target_type,
            target_id: r.target_id,
            metadata: r.metadata,
            created_at: Number(r.created_at)
          }));
        }

        const marketListingsRows = loadTableRows('market_listings');
        if (marketListingsRows) {
          db.market_listings = marketListingsRows.map((r: any) => ({
            listing_id: r.listing_id,
            seller_id: r.seller_id,
            title: r.title,
            description: r.description,
            price: Number(r.price),
            status: r.status,
            created_at: Number(r.created_at)
          }));
        }

        const escrowTransactionsRows = loadTableRows('escrow_transactions');
        if (escrowTransactionsRows) {
          db.escrow_transactions = escrowTransactionsRows.map((r: any) => ({
            transaction_id: r.transaction_id,
            listing_id: r.listing_id,
            buyer_id: r.buyer_id,
            seller_id: r.seller_id,
            amount: Number(r.amount),
            status: r.status,
            created_at: Number(r.created_at),
            updated_at: Number(r.updated_at)
          }));
        }

        console.log('[SYS-SECURE] Local relational SQLite database successfully loaded.');
        sqliteLoaded = true;
      } catch (err: any) {
        console.error('[SYS-SECURE] Failed loading from SQLITE_FILE directly:', err.message || err);
      } finally {
        if (conn) {
          try {
            conn.close?.();
          } catch (_) {}
        }
      }
    }

    // 2. Fallback to DB_FILE (legacy migration) if SQLITE_FILE was not found or failed to load
    if (!sqliteLoaded) {
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE);
        if (fileContent.length > 15 && fileContent.toString('utf8', 0, 15) === "SQLite format 3") {
          console.log('[SYS-SECURE] DB_FILE has SQLite format. Performing schema load...');
          try {
            const conn = new DatabaseSync(DB_FILE);
            const loadTable = (tableName: string) => {
              const rows = conn.prepare(`SELECT payload FROM ${tableName}`).all() as any[];
              return rows.map(r => {
                try {
                  return JSON.parse(decryptData(r.payload));
                } catch (decErr) {
                  console.error(`[SYS-SECURE] CRITICAL DECRYPTION FAILURE in legacy table ${tableName}:`, decErr);
                  decryptionErrorDetected = true;
                  return null;
                }
              }).filter(Boolean);
            };
            db.users = loadTable('users');
            db.profiles = loadTable('profiles');
            db.sessions = loadTable('sessions');
            db.devices = loadTable('devices');
            db.ip_addresses = loadTable('ip_addresses');
            db.messages = loadTable('messages');
            db.user_blocks = loadTable('user_blocks');
            db.user_mutes = loadTable('user_mutes') || [];
            db.admin_sanctions = loadTable('admin_sanctions');
            db.invites = loadTable('invites');
            db.tickets = loadTable('tickets');
            db.recovery_events = loadTable('recovery_events');
            db.suspicious_events = loadTable('suspicious_events');
            db.audit_logs = loadTable('audit_logs');
            db.peer_relationships = loadTable('peer_relationships') || [];
            db.friend_requests = loadTable('friend_requests') || [];
            db.join_requests = loadTable('join_requests') || [];
            try {
              conn.close?.();
            } catch (_) {}
            
            console.log('[SYS-SECURE] Successfully extracted tables. Converting to clean SQLite system database.');
            sqliteLoaded = true;
            executeSaveDb();
          } catch (err) {
            console.error('[SYS-SECURE] Extraction failed from DB_FILE SQLite format:', err);
          }
        } else {
          // It's raw JSON
          try {
            const decryptedData = decryptData(fileContent.toString('utf8').trim());
            if (!decryptedData) {
              throw new Error('Decrypted content is empty.');
            }
            db = JSON.parse(decryptedData);
            console.log('[SYS-SECURE] Migrating local encrypted State Engine JSON to relational SQLite database.');
            sqliteLoaded = true;
            executeSaveDb(); // This will save directly to SQLite SQLITE_FILE
          } catch (err: any) {
            console.warn('[SYS-SECURE] Local state DB file cannot be decrypted or parsed. Initiating clean state recovery:', err.message || err);
            try {
              const backupPath = `${DB_FILE}.corrupt_${Date.now()}`;
              fs.renameSync(DB_FILE, backupPath);
              console.log(`[SYS-SECURE] Corrupt DB_FILE renamed to ${backupPath}`);
            } catch (_) {}
          }
        }
      }
    }
    
    if (!sqliteLoaded) {
      console.log('[SYS-SECURE] Relational databases absent. Generating default seeds...');
      db = { ...defaultDb };
      executeSaveDb();
    }
    
    ensureSeededIntegrity();
    setupAuditLogProxy();
    dbLoaded = true;
  } catch (error: any) {
    console.error('[SYS-SECURE] Failed loading state database. Falling back to fresh seed:', error);
    db = { ...defaultDb };
    ensureSeededIntegrity();
    setupAuditLogProxy();
    try {
      executeSaveDb();
    } catch (_) {}
    dbLoaded = true;
  }
}

export function saveDb(force = false) {
  if (force) {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    executeSaveDb();
  } else {
    if (saveTimeout) return;
    saveTimeout = setTimeout(() => {
      saveTimeout = null;
      executeSaveDb();
    }, 1000);
  }
}

export function executeSaveDb() {
  if (isSaving) return;
  if (decryptionErrorDetected) {
    console.error('[SYS-SECURE] CRITICAL: Database write aborted. Decryption errors were detected during load, saving would cause data purge.');
    return;
  }
  isSaving = true;
  try {
    const conn = initSqlite();
    if (conn) {
      conn.exec('BEGIN');
      const saveTable = (tableName: string, rows: any[], idField: string) => {
        try {
          conn.exec(`DELETE FROM ${tableName}`);
          const stmt = conn.prepare(`INSERT OR REPLACE INTO ${tableName} (id, payload) VALUES (?, ?)`);
          for (const row of rows || []) {
            const id = String(row[idField] || generateUlid());
            const encryptedPayload = encryptData(JSON.stringify(row));
            stmt.run(id, encryptedPayload);
          }
        } catch (err) {
          console.error(`[SYS-SECURE] Save Table ${tableName} SQLite failed:`, err);
        }
      };
      
      saveTable('users', db.users, 'user_id');
      saveTable('profiles', db.profiles, 'profile_id');
      saveTable('sessions', db.sessions, 'session_id');
      saveTable('devices', db.devices, 'device_id');
      saveTable('ip_addresses', db.ip_addresses, 'ip_id');
      saveTable('messages', db.messages, 'message_id');
      saveTable('user_blocks', db.user_blocks, 'block_id');
      saveTable('user_mutes', db.user_mutes || [], 'mute_id');
      saveTable('admin_sanctions', db.admin_sanctions, 'sanction_id');
      saveTable('invites', db.invites, 'invite_id');
      saveTable('tickets', db.tickets, 'ticket_id');
      saveTable('recovery_events', db.recovery_events, 'event_id');
      saveTable('suspicious_events', db.suspicious_events, 'event_id');
      saveTable('audit_logs', db.audit_logs, 'log_id');
      saveTable('friend_requests', db.friend_requests || [], 'request_id');
      saveTable('peer_relationships', db.peer_relationships || [], 'id');
      saveTable('join_requests', db.join_requests || [], 'id');
      saveTable('node_overwrites', db.node_overwrites || [], 'overwrite_id');

      const saveLoungesDb = () => {
        try {
          conn.exec(`DELETE FROM lounges`);
          const stmt = conn.prepare(`INSERT OR REPLACE INTO lounges (lounge_id, name, description, owner_id, created_at, is_private, is_official, last_message_at, icon_url, invite_code, id, slug, creator_id, parent_lounge_id, updated_at, is_system, visibility, status, type, owner_user_id, hide_member_list, is_locked, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
          for (const c of db.lounges || []) {
            const idVal = c.id || c.lounge_id;
            const slugVal = c.slug || c.lounge_id;
            const creatorIdVal = c.creator_id || String(c.owner_id);
            const parentLoungeIdVal = c.parent_lounge_id || null;
            const updatedAtVal = c.updated_at || Number(c.created_at || Date.now());
            const isSystemVal = c.is_system !== undefined ? Number(c.is_system) : (Number(c.is_official) === 1 ? 1 : 0);
            const visibilityVal = c.visibility || (Number(c.is_private) === 1 ? 'private' : 'public');
            const statusVal = c.status || 'active';
            const typeVal = c.type || (Number(c.is_system || c.is_official) === 1 ? 'official' : 'user_created');
            const ownerUserIdVal = c.owner_user_id ? Number(c.owner_user_id) : Number(c.owner_id);
            const hideMemberListVal = c.hide_member_list ? 1 : 0;
            const isLockedVal = c.is_locked ? 1 : 0;
            const lastActiveAtVal = c.last_active_at ? Number(c.last_active_at) : Number(c.last_message_at || c.created_at);

            stmt.run(
              c.lounge_id,
              c.name,
              c.description || '',
              String(c.owner_id),
              Number(c.created_at || Date.now()),
              Number(c.is_private || 0),
              Number(c.is_official || 0),
              Number(c.last_message_at || 0),
              c.icon_url || null,
              c.invite_code || null,
              idVal,
              slugVal,
              creatorIdVal,
              parentLoungeIdVal,
              updatedAtVal,
              isSystemVal,
              visibilityVal,
              statusVal,
              typeVal,
              ownerUserIdVal,
              hideMemberListVal,
              isLockedVal,
              lastActiveAtVal
            );
          }
        } catch (err) {
          console.error('[SYS-SECURE] Save lounges SQLite failed:', err);
        }
      };

      const saveLoungeRoomsDb = () => {
        try {
          conn.exec(`DELETE FROM lounge_rooms`);
          const stmt = conn.prepare(`INSERT OR REPLACE INTO lounge_rooms (id, lounge_id, name, is_locked, invite_code, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
          for (const lr of db.lounge_rooms || []) {
            stmt.run(lr.id, lr.lounge_id, lr.name, Number(lr.is_locked || 0), lr.invite_code || null, String(lr.created_by), Number(lr.created_at || Date.now()));
          }
        } catch (err) {
          console.error('[SYS-SECURE] Save lounge_rooms SQLite failed:', err);
        }
      };

      const saveMarketListingsDb = () => {
        try {
          conn.exec(`DELETE FROM market_listings`);
          const stmt = conn.prepare(`INSERT OR REPLACE INTO market_listings (listing_id, seller_id, title, description, price, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
          for (const l of db.market_listings || []) {
            stmt.run(l.listing_id, String(l.seller_id), l.title, l.description || '', Number(l.price || 0), l.status || 'ACTIVE', Number(l.created_at || Date.now()));
          }
        } catch (err) {
          console.error('[SYS-SECURE] Save market_listings SQLite failed:', err);
        }
      };

      const saveEscrowTransactionsDb = () => {
        try {
          conn.exec(`DELETE FROM escrow_transactions`);
          const stmt = conn.prepare(`INSERT OR REPLACE INTO escrow_transactions (transaction_id, listing_id, buyer_id, seller_id, amount, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
          for (const t of db.escrow_transactions || []) {
            stmt.run(t.transaction_id, t.listing_id, String(t.buyer_id), String(t.seller_id), Number(t.amount || 0), t.status, Number(t.created_at || Date.now()), Number(t.updated_at || Date.now()));
          }
        } catch (err) {
          console.error('[SYS-SECURE] Save escrow_transactions SQLite failed:', err);
        }
      };

      const saveLoungeMembersDb = () => {
        try {
          conn.exec(`DELETE FROM lounge_members`);
          const stmt = conn.prepare(`INSERT OR REPLACE INTO lounge_members (lounge_id, user_id, role, status, joined_via, joined_at) VALUES (?, ?, ?, ?, ?, ?)`);
          for (const m of db.lounge_members || []) {
            stmt.run(m.lounge_id, Number(m.user_id), m.role, m.status, m.joined_via, Number(m.joined_at));
          }
        } catch (err) {
          console.error('[SYS-SECURE] Save lounge_members SQLite failed:', err);
        }
      };

      const saveLoungeInvitesDb = () => {
        try {
          conn.exec(`DELETE FROM lounge_invites`);
          const stmt = conn.prepare(`INSERT OR REPLACE INTO lounge_invites (id, lounge_id, code, created_by, max_uses, uses_count, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
          for (const i of db.lounge_invites || []) {
            stmt.run(i.id, i.lounge_id, i.code, Number(i.created_by), Number(i.max_uses), Number(i.uses_count), i.expires_at, i.revoked_at);
          }
        } catch (err) {
          console.error('[SYS-SECURE] Save lounge_invites SQLite failed:', err);
        }
      };

      const saveLoungeSanctionsDb = () => {
        try {
          conn.exec(`DELETE FROM lounge_sanctions`);
          const stmt = conn.prepare(`INSERT OR REPLACE INTO lounge_sanctions (id, lounge_id, user_id, type, applied_by, applied_by_type, applied_at, lifted_at, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
          for (const s of db.lounge_sanctions || []) {
            stmt.run(s.id, s.lounge_id, Number(s.user_id), s.type, Number(s.applied_by), s.applied_by_type, Number(s.applied_at), s.lifted_at, s.reason);
          }
        } catch (err) {
          console.error('[SYS-SECURE] Save lounge_sanctions SQLite failed:', err);
        }
      };

      const saveLoungeJoinRequestsDb = () => {
        try {
          conn.exec(`DELETE FROM lounge_join_requests`);
          const stmt = conn.prepare(`INSERT OR REPLACE INTO lounge_join_requests (id, lounge_id, user_id, message, status, reviewed_by, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
          for (const r of db.lounge_join_requests || []) {
            stmt.run(r.id, r.lounge_id, Number(r.user_id), r.message || '', r.status, r.reviewed_by, r.reviewed_at);
          }
        } catch (err) {
          console.error('[SYS-SECURE] Save lounge_join_requests SQLite failed:', err);
        }
      };

      const saveLoungeOwnershipTransfersDb = () => {
        try {
          conn.exec(`DELETE FROM lounge_ownership_transfers`);
          const stmt = conn.prepare(`INSERT OR REPLACE INTO lounge_ownership_transfers (id, lounge_id, from_user_id, to_user_id, status, initiated_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
          for (const t of db.lounge_ownership_transfers || []) {
            stmt.run(t.id, t.lounge_id, Number(t.from_user_id), Number(t.to_user_id), t.status, Number(t.initiated_at), t.resolved_at);
          }
        } catch (err) {
          console.error('[SYS-SECURE] Save lounge_ownership_transfers SQLite failed:', err);
        }
      };

      const saveAccountDeletionRequestsDb = () => {
        try {
          conn.exec(`DELETE FROM account_deletion_requests`);
          const stmt = conn.prepare(`INSERT OR REPLACE INTO account_deletion_requests (id, user_id, requested_at, scheduled_purge_at, status) VALUES (?, ?, ?, ?, ?)`);
          for (const d of db.account_deletion_requests || []) {
            stmt.run(d.id, Number(d.user_id), Number(d.requested_at), Number(d.scheduled_purge_at), d.status);
          }
        } catch (err) {
          console.error('[SYS-SECURE] Save account_deletion_requests SQLite failed:', err);
        }
      };

      const saveUserLoungePreferencesDb = () => {
        try {
          conn.exec(`DELETE FROM user_lounge_preferences`);
          const stmt = conn.prepare(`INSERT OR REPLACE INTO user_lounge_preferences (user_id, lounge_id, notifications_muted, pinned, pin_order) VALUES (?, ?, ?, ?, ?)`);
          for (const p of db.user_lounge_preferences || []) {
            stmt.run(Number(p.user_id), p.lounge_id, p.notifications_muted ? 1 : 0, p.pinned ? 1 : 0, p.pin_order);
          }
        } catch (err) {
          console.error('[SYS-SECURE] Save user_lounge_preferences SQLite failed:', err);
        }
      };

      const saveLoungeAuditLogsDb = () => {
        try {
          conn.exec(`DELETE FROM lounge_audit_logs`);
          const stmt = conn.prepare(`INSERT OR REPLACE INTO lounge_audit_logs (id, lounge_id, actor_id, actor_type, action, target_type, target_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
          for (const l of db.lounge_audit_logs || []) {
            stmt.run(l.id, l.lounge_id, Number(l.actor_id), l.actor_type, l.action, l.target_type, l.target_id, typeof l.metadata === 'string' ? l.metadata : JSON.stringify(l.metadata), Number(l.created_at));
          }
        } catch (err) {
          console.error('[SYS-SECURE] Save lounge_audit_logs SQLite failed:', err);
        }
      };

      const saveSystemAuditLogsDb = () => {
        try {
          conn.exec(`DELETE FROM system_audit_logs`);
          const stmt = conn.prepare(`INSERT OR REPLACE INTO system_audit_logs (id, actor_id, actor_type, action, target_type, target_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
          for (const l of db.system_audit_logs || []) {
            stmt.run(l.id, Number(l.actor_id), l.actor_type, l.action, l.target_type, l.target_id, typeof l.metadata === 'string' ? l.metadata : JSON.stringify(l.metadata), Number(l.created_at));
          }
        } catch (err) {
          console.error('[SYS-SECURE] Save system_audit_logs SQLite failed:', err);
        }
      };

      saveLoungesDb();
      saveLoungeRoomsDb();
      saveLoungeMembersDb();
      saveLoungeInvitesDb();
      saveLoungeSanctionsDb();
      saveLoungeJoinRequestsDb();
      saveLoungeOwnershipTransfersDb();
      saveAccountDeletionRequestsDb();
      saveUserLoungePreferencesDb();
      saveLoungeAuditLogsDb();
      saveSystemAuditLogsDb();
      saveMarketListingsDb();
      saveEscrowTransactionsDb();

      conn.exec('COMMIT');

      try {
        conn.close?.();
      } catch (_) {}
      
      const plainJson = JSON.stringify(db);
      const encryptedData = encryptData(plainJson);
      fs.writeFileSync(DB_FILE, encryptedData, 'utf8');
    } else {
      const plainJson = JSON.stringify(db);
      const encryptedData = encryptData(plainJson);
      fs.writeFileSync(DB_FILE, encryptedData, 'utf8');
    }
    
    rebuildBlocksCache();
    setLegacyDecryptionSucceeded(false);
    isSaving = false;
    
    backupDbToCloud().catch(err => {
      console.error('[SYS-SECURE] Failed background syncing database state to Neon PostgreSQL:', err);
    });
  } catch (err) {
    isSaving = false;
    console.error('[SYS-SECURE] Critical SQLite save fail:', err);
  }
}

export function setupAuditLogProxy() {}



export function setDecryptionErrorDetected(val: boolean) {
  decryptionErrorDetected = val;
}

export function setIsSaving(val: boolean) {
  isSaving = val;
}

// Ensure any pending throttled saves are flushed to disk before the container exits
process.on('SIGTERM', () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
    executeSaveDb();
  }
});
