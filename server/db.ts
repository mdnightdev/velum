import express from 'express';
import zlib from 'zlib';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { bankStore } from './services/bankStore.js';
import { bankingCommands } from './services/banking/commands.js';
import { dbCommands } from './services/db/commands.js';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { hashArgon2id as cryptoHashArgon2id, safeCompare } from './crypto.js';
import { writeServerLog } from './utils/logger.js';
import pg from 'pg';
import { 
  User, Profile, Session, Device, IpAddress, 
  Message, UserBlock, UserMute, AdminSanction, Invite, Ticket, RecoveryEvent, 
  SuspiciousEvent, AuditLog, WsPayload, FriendRequest, PeerRelationship,
  Lounge, LoungeRoom, MarketListing, EscrowTransaction,
  MarketAssetMedia, MarketReview, MarketCoupon, MarketDiscussion
} from '../src/types.js';
import { 
  DB_DIR, 
  DB_FILE, 
  db, 
  broadcastToRoomCallback, 
  registerBroadcastToRoomCallback,
  dbLoaded, 
  loadDb, 
  saveDb, 
  executeSaveDb, 
  setupAuditLogProxy,
  isSaving,
  decryptionErrorDetected,
  initSqlite,
  sqliteDb,
  SQLITE_FILE,
  isCloudBackupDisabled,
  initPgBackupTable,
  getSafeDatabaseBackupBinary,
  restoreDbFromCloud,
  backupDbToCloud,
  executeCloudBackup,
  wipeAndRebuildDatabaseFile,
  verifySqliteFile,
  activeUserBlocksSet,
  rebuildBlocksCache,
  isUserBlocked,
  closeSqliteConnection,
  syncDbIfNeeded
} from './db/index.js';
import { DbSchema, defaultDb } from './db/schema.js';

export const originalConsoleLog = console.log;

export const originalConsoleError = console.error;

export let activeAdminToken: string | null = crypto.randomBytes(32).toString('hex');

import { encryptData, 
  decryptData, 
  hashArgon2id, 
  verifyArgon2id, 
  checkCredential, 
  legacyDecryptionSucceeded,
  DB_CRYPTO_KEY,
  DB_CRYPTO_KEY_LEGACY } from './services/cryptoService.js';
import { checkStepOTP, getStepOTP } from './services/otpService.js';
import { generateUlid, BASE32_CHARS, generatePrefixedId } from './utils/ulid.js';

export { 
  SQLITE_FILE, 
  isCloudBackupDisabled, 
  initPgBackupTable, 
  getSafeDatabaseBackupBinary, 
  restoreDbFromCloud, 
  backupDbToCloud, 
  executeCloudBackup, 
  sqliteDb, 
  initSqlite, 
  verifySqliteFile, 
  wipeAndRebuildDatabaseFile,
  closeSqliteConnection
};

export { getPgPool } from './config/database.js';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('[DB] Neon connection failed:', err);
  } else {
    console.log('[DB] Successfully connected to Neon Postgres at:', res.rows[0].now);
  }
});


function b(val: any): any {
  if (val === undefined || val === null) return '';
  return val;
}

export interface TableConfig {
  name: string;
  pkName: string;
  getPkValue: (row: any) => string | number;
  insertSql: string;
  getParams: (row: any, encryptedPayload: string) => any[];
}

export const TABLE_CONFIGS: Record<string, TableConfig> = {
  users: {
    name: 'users',
    pkName: 'user_id',
    getPkValue: (r) => r.user_id,
    insertSql: "",
    getParams: (r, enc) => []
  }
};

export { 
  dbLoaded, 
  loadDb, 
  saveDb, 
  executeSaveDb, 
  setupAuditLogProxy,
  isSaving,
  decryptionErrorDetected,
  db,
  DB_DIR,
  DB_FILE,
  syncDbIfNeeded,
  broadcastToRoomCallback,
  registerBroadcastToRoomCallback,
  encryptData,
  decryptData,
  hashArgon2id,
  verifyArgon2id,
  checkCredential,
  getStepOTP,
  checkStepOTP,
  generateUlid,
  BASE32_CHARS,
  legacyDecryptionSucceeded,
  DB_CRYPTO_KEY,
  DB_CRYPTO_KEY_LEGACY,
  activeUserBlocksSet,
  rebuildBlocksCache,
  isUserBlocked
};

export function ensureVelumSystemDM(userId: number, username: string, plainRecoveryKey?: string) {
  const roomId = `dm_velum_${userId}`;

  // Ensure welcome message exists
  if (!db.messages) db.messages = [];
  let welcomeMsg = db.messages.find(m => m.room_id === roomId && m.user_id === 999 && m.message_id && m.message_id.startsWith(`msg_velum_welcome_${userId}`));
  if (!welcomeMsg) {
    // Fallback search to find any message containing recovery key keywords to avoid duplicates
    welcomeMsg = db.messages.find(m => m.room_id === roomId && m.user_id === 999 && m.content && (m.content.includes('recovery key') || m.content.includes('Recovery Key')));
  }
  
  let formattedMsg = `Welcome to Velum.\n\nYour recovery key was provided during registration. Please keep it secure.`;
  if (plainRecoveryKey) {
    formattedMsg = `Welcome to Velum.\n\nYour recovery key is: ${plainRecoveryKey}\n\nPlease store this key in a secure offline location. It is required to recover your account if you forget your password.`;
  }

  if (!welcomeMsg) {
    welcomeMsg = {
      message_id: `msg_velum_welcome_${userId}_${generateUlid()}`,
      room_id: roomId,
      user_id: 999,
      content: formattedMsg,
      is_encrypted: false,
      reply_to: null,
      timestamp: new Date().toISOString(),
      expires_in: null,
      status: 'sent',
      type: 'text'
    } as any as Message;
    db.messages.push(welcomeMsg);
    saveDb();

    // Broadcast real-time over WebSocket so the logged-in client receives it instantly!
    if (broadcastToRoomCallback) {
      try {
        broadcastToRoomCallback(roomId, {
          type: 'message',
          message: {
            ...welcomeMsg,
            username: 'Velum',
            avatar: 'emerald'
          }
        });
      } catch (wsErr) {
        console.warn('Real-time welcome broadcast failed:', wsErr);
      }
    }
  }
}

const ephemeralNonceCache = new Set<string>();
const ephemeralNonceTimes = new Map<string, number>();

function pruneEphemeralNonces(): void {
  const now = Date.now();
  for (const [nonce, time] of ephemeralNonceTimes.entries()) {
    if (now - time > 90000) {
      ephemeralNonceCache.delete(nonce);
      ephemeralNonceTimes.delete(nonce);
    }
  }
}

export function generateLoginNonce(): string {
  pruneEphemeralNonces();
  const nonce = crypto.randomBytes(32).toString('hex');
  ephemeralNonceCache.add(nonce);
  ephemeralNonceTimes.set(nonce, Date.now());
  return nonce;
}

export function verifyAndConsumeNonce(nonce: string): boolean {
  if (!nonce) return false;
  pruneEphemeralNonces();
  if (ephemeralNonceCache.has(nonce)) {
    ephemeralNonceCache.delete(nonce);
    ephemeralNonceTimes.delete(nonce);
    return true;
  }

  const conn = initSqlite();
  if (!conn) {
    return false;
  }
  try {
    const record = conn.prepare('SELECT * FROM login_nonces WHERE nonce = ?').get(nonce) as any;
    if (!record) {
      return false;
    }

    if (record.used === 1) {
      conn.prepare('DELETE FROM login_nonces WHERE nonce = ?').run(nonce);
      return false;
    }

    conn.prepare('DELETE FROM login_nonces WHERE nonce = ?').run(nonce);
    return true;
  } catch (err: any) {
    return false;
  } finally {
    try { conn.close?.(); } catch (_) {}
  }
}

export async function hardResetAndSeedDatabase(force = false) {
  // Dynamic in-place migration upgrade for existing database
  if (db.users) {
    let migrated = false;
    db.users.forEach(u => {
      if (u.user_id === 1 && (u.username === '午夜兔子' || u.username === 'cli_admin' || u.username === 'midnight')) {
        u.username = 'Midnight';
        migrated = true;
      }
      if (u.user_id === 2 && (u.username === 'lexie' || u.username === 'admin' || u.username === 'LEXIE')) {
        u.username = 'Lexie';
        migrated = true;
      }
    });
    if (migrated) {
      console.log('[DB] Migrated existing administrative accounts to Midnight and Lexie.');
      saveDb();
    }
  }

  const midnight_pass = process.env.MIDNIGHT_PASSWORD || '';
  const midnight_safe = process.env.MIDNIGHT_SAFE_WORD || '';
  const midnight_panic = process.env.MIDNIGHT_PANIC_PHRASE || '';
  const midnight_rec = process.env.MIDNIGHT_RECOVERY_KEY || '';

  const lexie_pass = process.env.LEXIE_PASSWORD || '';
  const lexie_safe = process.env.LEXIE_SAFE_WORD || '';
  const lexie_panic = process.env.LEXIE_PANIC_PHRASE || '';
  const lexie_rec = process.env.LEXIE_RECOVERY_KEY || '';

  if (!midnight_pass || !midnight_safe || !midnight_panic || !midnight_rec ||
      !lexie_pass || !lexie_safe || !lexie_panic || !lexie_rec) {
    console.warn('[DB] WARNING: Administrative environment variables (MIDNIGHT_PASSWORD, LEXIE_PASSWORD, etc.) are unconfigured or empty in .env.');
    console.warn('[DB] Database administrative accounts cannot be seeded/reset to prevent insecure empty credentials.');
    return;
  }

  // Verify compatibility with the client-side pre-hashing flow
  const midnight = db.users && db.users.find(u => u.role === 'CLI_ADMIN');
  const lexie = db.users && db.users.find(u => u.role === 'LOGIN_ADMIN');
  let mustReSeed = false;

  if (!midnight || !lexie) {
    mustReSeed = true;
  } else if (!midnight.password_hash?.startsWith('argon2id:') || !lexie.password_hash?.startsWith('argon2id:')) {
    console.log('[DB] Administrative password hashes are legacy or missing argon2id. Triggering upgrade re-seed.');
    mustReSeed = true;
  } else {
    try {
      const cli_pass_pre = crypto.createHash('sha256').update(midnight.salt + midnight_pass).digest('hex');
      const isMidnightMatch = await verifyArgon2id(cli_pass_pre, midnight.salt, midnight.password_hash);

      const admin_pass_pre = crypto.createHash('sha256').update(lexie.salt + lexie_pass).digest('hex');
      const isLexieMatch = await verifyArgon2id(admin_pass_pre, lexie.salt, lexie.password_hash);

      if (!isMidnightMatch || !isLexieMatch) {
        console.log('[DB] Administrative environment secrets changed. Triggering credential update.');
        mustReSeed = true;
      } else {
        writeServerLog('[DB] Valid administrative accounts verified in database.');
      }
    } catch (err) {
      mustReSeed = true;
    }
  }

  if (!force && !mustReSeed && db.users && db.users.length > 0) {
    writeServerLog('[DB] Checked existing database administrative accounts. Retaining persistence.');
    return;
  }

  writeServerLog('[DB] Performing database reset/re-seed of administrative accounts via Argon2id...');

  const cli_admin_salt = crypto.randomBytes(32).toString('hex');
  const Admin_salt = crypto.randomBytes(32).toString('hex');

  const cli_pass_pre = crypto.createHash('sha256').update(cli_admin_salt + midnight_pass).digest('hex');
  const cli_safe_pre = crypto.createHash('sha256').update(cli_admin_salt + midnight_safe).digest('hex');
  const cli_panic_pre = crypto.createHash('sha256').update(cli_admin_salt + midnight_panic).digest('hex');

  const cli_rec_key_salt = crypto.randomBytes(32).toString('hex');
  const cli_rec_pre = crypto.createHash('sha256').update(cli_rec_key_salt + midnight_rec).digest('hex');
  const cli_rec_key_hash_raw = await hashArgon2id(cli_rec_pre, Buffer.from(cli_rec_key_salt, 'hex'));
  const cli_rec_key_hash = `argon2id:${cli_rec_key_salt}:${cli_rec_key_hash_raw}`;

  const cli_pass_hash = `argon2id:${await hashArgon2id(cli_pass_pre, Buffer.from(cli_admin_salt, 'hex'))}`;
  const cli_safe_hash = `argon2id:${await hashArgon2id(cli_safe_pre, Buffer.from(cli_admin_salt, 'hex'))}`;
  const cli_panic_hash = `argon2id:${await hashArgon2id(cli_panic_pre, Buffer.from(cli_admin_salt, 'hex'))}`;

  const admin_pass_pre = crypto.createHash('sha256').update(Admin_salt + lexie_pass).digest('hex');
  const admin_safe_pre = crypto.createHash('sha256').update(Admin_salt + lexie_safe).digest('hex');
  const admin_panic_pre = crypto.createHash('sha256').update(Admin_salt + lexie_panic).digest('hex');

  const admin_rec_key_salt = crypto.randomBytes(32).toString('hex');
  const admin_rec_pre = crypto.createHash('sha256').update(admin_rec_key_salt + lexie_rec).digest('hex');
  const admin_rec_key_hash_raw = await hashArgon2id(admin_rec_pre, Buffer.from(admin_rec_key_salt, 'hex'));
  const admin_rec_key_hash = `argon2id:${admin_rec_key_salt}:${admin_rec_key_hash_raw}`;

  const admin_pass_hash = `argon2id:${await hashArgon2id(admin_pass_pre, Buffer.from(Admin_salt, 'hex'))}`;
  const admin_safe_hash = `argon2id:${await hashArgon2id(admin_safe_pre, Buffer.from(Admin_salt, 'hex'))}`;
  const admin_panic_hash = `argon2id:${await hashArgon2id(admin_panic_pre, Buffer.from(Admin_salt, 'hex'))}`;

  const seededUsers = [
    {
      user_id: 1,
      username: 'Midnight',
      password_hash: cli_pass_hash,
      safe_word_hash: cli_safe_hash,
      panic_phrase_hash: cli_panic_hash,
      recovery_key_hash: cli_rec_key_hash,
      role: 'CLI_ADMIN',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      salt: cli_admin_salt,
      uid: 'VEL-UID-000001',
      needs_reset: true
    },
    {
      user_id: 2,
      username: 'Lexie',
      password_hash: admin_pass_hash,
      safe_word_hash: admin_safe_hash,
      panic_phrase_hash: admin_panic_hash,
      recovery_key_hash: admin_rec_key_hash,
      role: 'LOGIN_ADMIN',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      salt: Admin_salt,
      uid: 'VEL-UID-000002',
      needs_reset: true
    }
  ];

  if (!db.users) {
    db.users = seededUsers;
  } else {
    // Keep other users but filter out any legacy admins with same IDs or usernames
    db.users = db.users.filter(u => {
      const isLegacyAdmin = u.user_id === 1 || u.user_id === 2 || 
        ['midnight', 'lexie', 'cli_admin', 'admin'].includes(u.username.toLowerCase());
      return !isLegacyAdmin;
    });
    db.users.push(...seededUsers);
  }

  const seededProfiles = [
    {
      profile_id: 'p_1',
      user_id: 1,
      bio: 'Verified CLI Security Administrator. Operational Systems Command.',
      avatar: '',
      updated_at: new Date().toISOString(),
      settings: { theme: 'slate', notificationsEnabled: true, burnDefaultSeconds: 0 }
    },
    {
      profile_id: 'p_2',
      user_id: 2,
      bio: 'Verified Executive Operations Director. Handshake Protocols Coordinator.',
      avatar: '',
      updated_at: new Date().toISOString(),
      settings: { theme: 'slate', notificationsEnabled: true, burnDefaultSeconds: 0 }
    }
  ];

  if (!db.profiles) {
    db.profiles = seededProfiles;
  } else {
    db.profiles = db.profiles.filter(p => p.user_id !== 1 && p.user_id !== 2);
    db.profiles.push(...seededProfiles);
  }

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
  if (!db.purged_users) db.purged_users = [];
  if (!db.purged_profiles) db.purged_profiles = [];

  saveDb();
  writeServerLog('[DB] Security standards initialized. Verified administrative accounts seeded.');
}

import { executeCliCommand as serviceExecuteCliCommand } from './services/admin.js';

export async function executeCliCommand(command: string, isSystem?: boolean): Promise<string> {
  return serviceExecuteCliCommand(command, isSystem);
}
