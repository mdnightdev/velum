import express from 'express';
import zlib from 'zlib';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
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
  verifySqliteFile
} from './db/index.js';
import { DbSchema, defaultDb } from './db/schema.js';

export const originalConsoleLog = console.log;

export const originalConsoleError = console.error;

export let activeAdminToken: string | null = crypto.randomBytes(32).toString('hex');

import { 
  encryptData, 
  decryptData, 
  hashArgon2id, 
  verifyArgon2id, 
  checkCredential, 
  getStepOTP, 
  checkStepOTP,
  legacyDecryptionSucceeded,
  DB_CRYPTO_KEY,
  DB_CRYPTO_KEY_LEGACY
} from './utils/crypto.js';
import { generateUlid, BASE32_CHARS } from './utils/ulid.js';

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
  wipeAndRebuildDatabaseFile 
};

export { getPgPool } from './config/database.js';

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

export const activeUserBlocksSet = new Set<string>();

export function rebuildBlocksCache() {
  activeUserBlocksSet.clear();
  for (const b of db.user_blocks || []) {
    activeUserBlocksSet.add(`${b.blocker_id}_${b.blocked_id}`);
  }
}

export function isUserBlocked(userA: number, userB: number): boolean {
  if (!userA || !userB) return false;
  return activeUserBlocksSet.has(`${userA}_${userB}`) || activeUserBlocksSet.has(`${userB}_${userA}`);
}



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
  DB_CRYPTO_KEY_LEGACY
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
      message_id: `msg_velum_welcome_${userId}_${Date.now()}`,
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



export function generateLoginNonce(): string {
  const conn = initSqlite();
  if (!conn) {
    const fallback = crypto.randomBytes(32).toString('hex');
    writeServerLog('[SYS-SECURE] [NONCE-FALLBACK] SQLite unavailable, generated ephemeral nonce.');
    return fallback;
  }
  try {
    const pruneTime = Date.now() - 90000;
    conn.prepare('DELETE FROM login_nonces WHERE created_at < ?').run(pruneTime);
    
    const nonce = crypto.randomBytes(32).toString('hex');
    conn.prepare('INSERT INTO login_nonces (nonce, created_at, used) VALUES (?, ?, 0)').run(nonce, Date.now());
    writeServerLog(`[SYS-SECURE] [NONCE-DB-GEN] Persisted secure nonce in SQLite: ${nonce}`);
    return nonce;
  } catch (err: any) {
    const fallback = crypto.randomBytes(32).toString('hex');
    writeServerLog(`[SYS-SECURE] [NONCE-DB-ERR] Failed to write nonce to SQLite: ${err?.message || err}`);
    return fallback;
  } finally {
    try { conn.close?.(); } catch (_) {}
  }
}

export function verifyAndConsumeNonce(nonce: string): boolean {
  const conn = initSqlite();
  if (!conn) {
    writeServerLog('[SYS-SECURE] [NONCE-FALLBACK] SQLite connection unavailable during verify.');
    return false;
  }
  try {
    const pruneTime = Date.now() - 90000;
    conn.prepare('DELETE FROM login_nonces WHERE created_at < ?').run(pruneTime);

    writeServerLog(`[SYS-SECURE] [NONCE-DB-VERIFY] Verifying nonce: ${nonce}`);
    const record = conn.prepare('SELECT * FROM login_nonces WHERE nonce = ?').get(nonce) as any;
    if (!record) {
      writeServerLog(`[SYS-SECURE] [NONCE-DB-FAIL] Nonce ${nonce} not found in SQLite.`);
      return false;
    }

    if (record.used === 1) {
      writeServerLog(`[SYS-SECURE] [NONCE-DB-FAIL] Nonce ${nonce} has already been used.`);
      conn.prepare('DELETE FROM login_nonces WHERE nonce = ?').run(nonce);
      return false;
    }

    conn.prepare('DELETE FROM login_nonces WHERE nonce = ?').run(nonce);
    writeServerLog(`[SYS-SECURE] [NONCE-DB-SUCCESS] Nonce ${nonce} successfully verified and consumed.`);
    return true;
  } catch (err: any) {
    writeServerLog(`[SYS-SECURE] [NONCE-DB-ERR] Failed to verify/consume nonce in SQLite: ${err?.message || err}`);
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
      console.log('[SYS-SECURE] Migrated existing administrative accounts to Midnight and Lexie.');
      saveDb();
    }
  }

  const midnight_pass = process.env.MIDNIGHT_PASSWORD || 'velum_cli_secure_2024';
  const midnight_safe = process.env.MIDNIGHT_SAFE_WORD || 'omega';
  const midnight_panic = process.env.MIDNIGHT_PANIC_PHRASE || 'burn the systems';
  const midnight_rec = process.env.MIDNIGHT_RECOVERY_KEY || 'CLI-REC-999';

  const lexie_pass = process.env.LEXIE_PASSWORD || 'velum_admin_secure_2024';
  const lexie_safe = process.env.LEXIE_SAFE_WORD || 'vortex';
  const lexie_panic = process.env.LEXIE_PANIC_PHRASE || 'lock account immediate';
  const lexie_rec = process.env.LEXIE_RECOVERY_KEY || 'LGN-REC-111';

  // Verify compatibility with the client-side pre-hashing flow
  const midnight = db.users && db.users.find(u => u.role === 'CLI_ADMIN');
  const lexie = db.users && db.users.find(u => u.role === 'LOGIN_ADMIN');
  let mustReSeed = false;

  if (!midnight || !lexie) {
    mustReSeed = true;
  } else if (!midnight.password_hash?.startsWith('argon2id:') || !lexie.password_hash?.startsWith('argon2id:')) {
    console.log('[SYS-SECURE] Administrative password hashes are legacy or missing argon2id. Triggering upgrade re-seed.');
    mustReSeed = true;
  }

  if (!force && !mustReSeed && db.users && db.users.length > 0) {
    console.log('[SYS-SECURE] Checked existing database administrative accounts. Retaining persistence.');
    return;
  }

  console.log('[SYS-SECURE] Performing database reset/re-seed of administrative accounts via Argon2id...');

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
      uid: 'VEL-UID-000001'
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
      uid: 'VEL-UID-000002'
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

  saveDb();
  console.log('[SYS-SECURE] Security standards initialized. Verified administrative accounts seeded.');
}

export async function executeCliCommand(command: string): Promise<string> {
  if (!command) {
    return '❌ ERROR: Command cannot be empty.';
  }
  const parts = command.trim().split(/\s+/);
  let action = parts[0].toLowerCase();
  const arg1 = parts[1];
  const arg2Plus = parts.slice(2).join(' ');

  // Normalize duplicate or server-style aliased console commands
  if (action === 'list-pending' || action === 'list_pending') action = 'pending';
  else if (action === 'approve-support' || action === 'approve_support') action = 'approve';
  else if (action === 'reject-support' || action === 'reject_support') action = 'reject';
  else if (action === 'demote-support' || action === 'demote_support') action = 'demote';
  else if (action === 'ban-user' || action === 'ban_user') action = 'ban';
  else if (action === 'unban-user' || action === 'unban_user') action = 'unban';
  else if (action === 'mute-user' || action === 'mute_user') action = 'mute';
  else if (action === 'unmute-user' || action === 'unmute_user') action = 'unmute';
  else if (action === 'generate-login-token' || action === 'generate_login_token' || action === 'get-token' || action === 'get_token') action = 'token';
  else if (action === 'send-system-wire' || action === 'send_system_wire') action = 'wire';
  else if (action === 'db-vacuum' || action === 'db_vacuum') action = 'vacuum';
  else if (action === 'sessions-clear' || action === 'sessions_clear') action = 'clear';
  else if (action === 'list-lounges' || action === 'list_lounges') action = 'lounges';
  else if (action === 'risk-report' || action === 'risk_report') action = 'risk';
  else if (action === 'server-logs' || action === 'server_logs') action = 'logs';
  else if (action === 'delete-user' || action === 'delete_user') action = 'delete-user';
  else if (action === 'restore-user' || action === 'restore_user') action = 'restore-user';
  else if (action === 'reset-avatar' || action === 'reset_avatar') action = 'reset-avatar';

  else if (action === 'delete-lounge' || action === 'delete_lounge') action = 'delete-lounge';
  else if (action === 'clean-lounge' || action === 'clean_lounge' || action === 'clean-lobby' || action === 'clean_lobby' || action === 'clean') action = 'clean-lounge';
  else if (action === 'delete-ticket' || action === 'delete_ticket') action = 'delete-ticket';
  else if (action === 'override-user' || action === 'override_user') action = 'override-user';

  switch (action) {
    case 'help': {
      return `VELUM EXECUTIVE ADMIN COMMAND CONTROL PANEL\n` +
        `========================================================\n` +
        `• help                         - Show admin command list\n` +
        `• status / info / diagnostics   - View database and server health\n` +
        `• pending                      - List active Support Operator nominations\n` +
        `• approve <user>               - Approve a support admin candidate account\n` +
        `• reject <user>                - Deny candidacy for a support admin account\n` +
        `• demote <user>                - Revoke support admin permissions\n` +
        `• ban <user>                   - Ban user account and sign them out immediately\n` +
        `• unban <user>                 - Unban user account\n` +
        `• mute <user>                  - Prevent user from posting messages\n` +
        `• unmute <user>                - Allow user to post messages again\n` +
        `• delete-user <user>           - Permanently delete user account and all data\n` +
`• restore-user <user>          - Restore a soft-purged user account\n` +
        `• reset-avatar <user>          - Reset user's avatar\n` + +
        `• delete-lounge <id>           - Delete lounge by ID\n` +
        `• delete-ticket <id>           - Delete support ticket by ID\n` +
        `• override-user <username> <pass> - Reset user password and credentials to active state\n` +
        `• clean-lounge                 - Clear all messages from the global lounge channel\n` +
        `• prune / wipe / reset         - Reset all records (keeps main seed accounts)\n` +
        `• seed                         - Re-seed default admin accounts\n` +
        `• integrity                    - Run a database integrity check\n` +
        `• vacuum                       - Clean up old database logs and sessions\n` +
        `• clear-sessions / clear       - Force sign out all active users\n` +
        `• lounges                      - List all active lounges\n` +
        `• risk                         - Print list of recent sign-in security alerts\n` +
        `• wire <user> <message>        - Send direct message/broadcast to a user\n` +
        `• token                        - Generate a support admin temporary access code\n` +
        `========================================================`;
    }
    case 'status':
    case 'diagnostics':
    case 'info': {
      try {
        const adminCount = db.users?.filter(u => u.role === 'CLI_ADMIN' || u.role === 'LOGIN_ADMIN' || u.role === 'SUPPORT_ADMIN').length || 0;
        const totalUsers = db.users?.length || 0;
        const messagesCount = db.messages?.length || 0;
        
        const ticketsCount = db.tickets?.length || 0;
        const activeConns = db.sessions ? db.sessions.filter(s => s.status === 'active').length : 0;

        let dbBytes = 0;
        if (fs.existsSync(SQLITE_FILE)) {
          dbBytes = fs.statSync(SQLITE_FILE).size;
        }

        return `VELUM EXECUTIVE SERVER STATUS & STATISTICS\n` +
          `========================================================\n` +
          `• SERVER STATUS: ONLINE\n` +
          `• REGISTERED USERS: ${totalUsers} (Admins: ${adminCount})\n` +
          `• TOTAL MESSAGES: ${messagesCount}\n` +
          `• CHAT CHANNELS: 0\n` +
          `• SUPPORT TICKETS: ${ticketsCount}\n` +
          `• TEMPORARY SIGNED IN CONNS: ${activeConns}\n` +
          `• LOCAL DATABASE SIZE: ${Math.round(dbBytes / 1024 * 100) / 100} KB\n` +
          `• CLOUD BACKUP SYNC: ${!isCloudBackupDisabled ? 'ENABLED' : 'DISABLED (LOCAL DATABASE)'}\n` +
          `========================================================`;
      } catch (err: any) {
        return `[ERROR] Failed to query workspace stats: ${err.message || err}`;
      }
    }
    case 'pending': {
      try {
        const nominees = db.users.filter(u => u.status === 'active' && (u.promotion_status === 'PENDING_SUPPORT' || u.support_nomination === 'nominated'));
        if (nominees.length === 0) {
          return '[INFO] No active Support Admin nominations are currently pending dual CLI approval.';
        }
        return `--- VELUM SUPPORT NOMINATIONS QUEUE ---\n` + nominees.map(u => `ID: ${u.user_id} | Username: ${u.username} | Designation: PENDING_SUPPORT`).join('\n');
      } catch (err: any) {
        return `[ERROR] Failed to query nominations: ${err.message || err}`;
      }
    }
    case 'approve': {
      try {
        if (!arg1) {
          return `❌ ERROR: Command "approve" requires a <username> argument.`;
        }
        const candidate = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase());
        if (!candidate) {
          return `❌ ERROR: Account "${arg1}" is not registered in central databases.`;
        }

        const isNominated = candidate.promotion_status === 'PENDING_SUPPORT' || candidate.support_nomination === 'nominated';
        if (!isNominated) {
          return `❌ ERROR: Account "${candidate.username}" is not currently in a PENDING_SUPPORT nomination state.`;
        }

        candidate.role = 'USER';
        candidate.support_nomination = null;
        candidate.promotion_status = 'APPROVED_SUPPORT';
        candidate.updated_at = new Date().toISOString();

        const cleanUsername = candidate.username.replace(/^@/, '');
        const saUsername = `SA-${cleanUsername}`;

        let saUser = db.users.find(u => u.username.toLowerCase() === saUsername.toLowerCase());
        if (saUser) {
          return `❌ ERROR: Dedicated Support Admin account "${saUsername}" already exists.`;
        }

        const saPassword = `SA-PASS-${Math.floor(100000 + Math.random() * 900000)}`;
        const saSafeWord = `SA-SAFE-${Math.floor(1000 + Math.random() * 9000)}`;
        const saPanicPhrase = `SA-PANIC-${Math.floor(1000 + Math.random() * 9000)}`;
        const saRecoveryKey = `SA-REC-${Math.floor(100000 + Math.random() * 900000)}`;

        const sa_salt = crypto.randomBytes(32).toString('hex');
        const saRecSalt = crypto.randomBytes(32).toString('hex');

        const pass_hash = `argon2id:${await hashArgon2id(saPassword, Buffer.from(sa_salt, 'hex'))}`;
        const safe_hash = `argon2id:${await hashArgon2id(saSafeWord, Buffer.from(sa_salt, 'hex'))}`;
        const panic_hash = `argon2id:${await hashArgon2id(saPanicPhrase, Buffer.from(sa_salt, 'hex'))}`;
        const rec_hash = `argon2id:${saRecSalt}:${await hashArgon2id(saRecoveryKey, Buffer.from(saRecSalt, 'hex'))}`;

        const saUserId = Math.max(...db.users.map(u => u.user_id), 0) + 1;
        const newSaUser: User = {
          user_id: saUserId,
          username: saUsername,
          password_hash: pass_hash, 
          safe_word_hash: safe_hash,
          panic_phrase_hash: panic_hash,
          recovery_key_hash: rec_hash,
          role: 'SUPPORT_ADMIN',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          salt: sa_salt,
          uid: `VEL-UID-${Math.floor(100000 + Math.random() * 900000)}`
        };

        db.users.push(newSaUser);

        if (!db.profiles) db.profiles = [];
        db.profiles.push({
          profile_id: `p_${saUserId}`,
          user_id: saUserId,
          bio: 'Isolated Security Support Desk Account.',
          avatar: 'help-circle',
          settings: { theme: 'slate', notificationsEnabled: true, burnDefaultSeconds: 0 },
          updated_at: new Date().toISOString()
        });

        // Send credentials over target user's custom Velum DM chat channel
        const dmRoomId = `dm_velum_${candidate.user_id}`;
        

        
        

        const credsMessage = {
          message_id: `msg_sa_promo_${candidate.user_id}_${Date.now()}`,
          room_id: dmRoomId,
          user_id: 999,
          content: `Support Operator Access Approved.\n\nCredentials:\nUsername: \`${saUsername}\`\nPassword: \`${saPassword}\`\nSafeWord: \`${saSafeWord}\`\nPanicPhrase: \`${saPanicPhrase}\`\nRecoveryKey: \`${saRecoveryKey}\``,
          is_encrypted: false,
          reply_to: null,
          timestamp: new Date().toISOString(),
          expires_in: null,
          status: 'sent',
          type: 'text'
        } as any as Message;

        if (!db.messages) db.messages = [];
        db.messages.push(credsMessage);

        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: `al_${Date.now()}_audit`,
          admin_id: 1,
          admin_name: 'cli_admin',
          action: 'role_change',
          target_type: 'user',
          target_id: String(candidate.user_id),
          reason: `Approved support operator nomination. Registered SA user "${saUsername}" and dispatched credentials over Velum system chat.`,
          timestamp: new Date().toISOString()
        });

        executeSaveDb();

        // Dynamically import and broadcast over WS
        import('./websocket.js').then(({ broadcastToRoom, connectedClients }) => {
          const wsPayload = {
            ...credsMessage,
            username: 'Velum',
            avatar: 'help-circle'
          };
          // Broadcast to room if active
          broadcastToRoom(dmRoomId, wsPayload);

          // Direct propagation: Send the DM payload directly to the recipient's websocket connections
          // even if they are not actively viewing this room, triggering badge updates and buzzes.
          connectedClients.forEach(c => {
            if (c.user_id === candidate.user_id && !c.rooms.has(dmRoomId) && c.ws.readyState === 1) {
              c.ws.send(JSON.stringify(wsPayload));
            }
          });
        }).catch(err => {
          console.warn('[PROMO] Failed to dispatch real-time websocket broadcast for promotion credentials:', err);
        });
        return `💖 SUCCESS: Approved Support nomination for "${candidate.username}". Created dedicated SA profile "${saUsername}". Credentials wire dispatched securely! 💖\n\nSupport ID: ${saUserId}\nHandle: ${saUsername}\nPassword: ${saPassword}\nSafe Word: ${saSafeWord}\nPanic Word: ${saPanicPhrase}\nRecovery Key: ${saRecoveryKey}`;
      } catch (err: any) {
        return `💥 ERROR: Approved support task failure: ${err.message || err}`;
      }
    }
    case 'reject': {
      try {
        if (!arg1) {
          return `❌ ERROR: Command "reject" requires a <username> argument.`;
        }
        const candidate = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase());
        if (!candidate) {
          return `❌ ERROR: Account "${arg1}" is not registered in central databases.`;
        }
        candidate.support_nomination = null;
        candidate.promotion_status = 'REJECTED_SUPPORT';
        candidate.updated_at = new Date().toISOString();

        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: `al_${Date.now()}_audit`,
          admin_id: 1,
          admin_name: 'cli_admin',
          action: 'role_change',
          target_type: 'user',
          target_id: String(candidate.user_id),
          reason: `Root CLI operator rejected Support Admin role nomination for "${candidate.username}".`,
          timestamp: new Date().toISOString()
        });

        executeSaveDb();
        return `✨ SUCCESS: Rejected Support Admin nomination for "${candidate.username}". Saved to main ledger.`;
      } catch (err: any) {
        return `💥 ERROR: Nomination rejection task failed: ${err.message || err}`;
      }
    }
    case 'demote': {
      try {
        if (!arg1) {
          return `❌ ERROR: Command "demote" requires a <username> argument.`;
        }
        const queryName = arg1.trim();
        const cleanName = queryName.replace(/^@?SA-@?|^@/, '').toLowerCase();

        // Role-isolated lookups to prevent cross-over
        let saUser = db.users.find(u => {
          if (u.role !== 'SUPPORT_ADMIN') return false;
          const uClean = u.username.replace(/^@?SA-@?|^@/, '').toLowerCase();
          return uClean === cleanName;
        });

        let baseUser = db.users.find(u => {
          if (u.role === 'SUPPORT_ADMIN') return false;
          const uClean = u.username.replace(/^@/, '').toLowerCase();
          return uClean === cleanName;
        });

        if (!baseUser && !saUser) {
          return `❌ ERROR: Target "${arg1}" not found in registries.`;
        }

        if (baseUser) {
          baseUser.promotion_status = 'NONE';
          baseUser.support_nomination = null;
          baseUser.updated_at = new Date().toISOString();
        }

        if (saUser) {
          db.users = db.users.filter(u => u.user_id !== saUser.user_id);
          if (db.profiles) db.profiles = db.profiles.filter(p => p.user_id !== saUser.user_id);
          

          db.sessions = db.sessions || [];
          db.sessions.forEach(s => {
            if (s.user_id === saUser.user_id) s.status = 'revoked';
          });

          // Perform live eviction of active WebSocket connections instantly
          import('./websocket.js').then(({ connectedClients }) => {
            const activeConns = connectedClients.filter(c => c.user_id === saUser.user_id);
            activeConns.forEach(c => {
              try {
                c.ws.send(JSON.stringify({
                  type: 'session_revoked',
                  message: 'Administrative Sanction: Your companion Support Operator access has been demoted and revoked.'
                }));
                c.ws.close(3200, 'Demoted');
              } catch {}
            });
          }).catch(() => {});
        }

        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: `al_${Date.now()}_audit`,
          admin_id: 1,
          admin_name: 'cli_admin',
          action: 'role_change',
          target_type: 'user',
          target_id: String((baseUser || saUser)?.user_id),
          reason: `Demoted and purged companion Support Operator access for "${arg1}".`,
          timestamp: new Date().toISOString()
        });

        executeSaveDb();
        return `💔 SUCCESS: Demoted and removed companion Support Operator access for "${arg1}". All specialized tokens immediately purged.`;
      } catch (err: any) {
        return `💥 ERROR: Demotion sequence faulted: ${err.message || err}`;
      }
    }
    case 'ban': {
      try {
        if (!arg1) {
          return `❌ ERROR: Command "ban" requires a <username> argument.`;
        }
        const candidate = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase());
        if (!candidate) {
          return `❌ ERROR: Account "${arg1}" is not registered in registries.`;
        }

        if (candidate.role === 'CLI_ADMIN') {
          return `❌ ERROR: Severe security privilege violation - cannot ban Root CLI Administrator.`;
        }

        candidate.status = 'suspended';
        candidate.updated_at = new Date().toISOString();

        db.sessions = db.sessions.filter(s => s.user_id !== candidate.user_id);

        if (!db.admin_sanctions) db.admin_sanctions = [];
        db.admin_sanctions.push({
          sanction_id: `sanc_${Date.now()}`,
          user_id: candidate.user_id,
          admin_id: 1,
          room_id: null,
          type: 'ban',
          reason: arg2Plus || 'Root CLI global ban action',
          expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString()
        });

        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: `al_${Date.now()}_audit`,
          admin_id: 1,
          admin_name: 'cli_admin',
          action: 'ban',
          target_type: 'user',
          target_id: String(candidate.user_id),
          reason: `Globally banned "${candidate.username}" via Web CLI. Active sessions purged.`,
          timestamp: new Date().toISOString()
        });

        executeSaveDb();
        return `SUCCESS: Globally banned user "${candidate.username}" and evicted all active sessions immediately.`;
      } catch (err: any) {
        return `ERROR during ban sequence: ${err.message || err}`;
      }
    }
    case 'unban': {
      try {
        if (!arg1) {
          return `❌ ERROR: Command "unban" requires a <username> argument.`;
        }
        const candidate = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase());
        if (!candidate) {
          return `❌ ERROR: Account "${arg1}" is not registered.`;
        }

        candidate.status = 'active';
        candidate.updated_at = new Date().toISOString();

        if (db.admin_sanctions) {
          db.admin_sanctions = db.admin_sanctions.filter(s => !(s.target_id === candidate.user_id && s.type === 'ban'));
        }

        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: `al_${Date.now()}_audit`,
          admin_id: 1,
          admin_name: 'cli_admin',
          action: 'restore',
          target_type: 'user',
          target_id: String(candidate.user_id),
          reason: `Restored/Unbanned account "${candidate.username}" via Web CLI.`,
          timestamp: new Date().toISOString()
        });

        executeSaveDb();
        return `✨ SUCCESS: Restored and unbanned user "${candidate.username}". Entry sequence authorized.`;
      } catch (err: any) {
        return `💥 ERROR during unban task: ${err.message || err}`;
      }
    }
    case 'mute': {
      try {
        if (!arg1) {
          return `❌ ERROR: Command "mute" requires a <username> argument.`;
        }
        const candidate = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase());
        if (!candidate) {
          return `❌ ERROR: Account "${arg1}" is not registered.`;
        }

        if (!db.admin_sanctions) db.admin_sanctions = [];
        db.admin_sanctions.push({
          sanction_id: `sanc_${Date.now()}`,
          user_id: candidate.user_id,
          admin_id: 1,
          room_id: null,
          type: 'mute',
          reason: arg2Plus || 'Root CLI mute action',
          expires_at: new Date(Date.now() + 1000 * 60 * 10000).toISOString()
        });

        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: `al_${Date.now()}_audit`,
          admin_id: 1,
          admin_name: 'cli_admin',
          action: 'mute',
          target_type: 'user',
          target_id: String(candidate.user_id),
          reason: `Muted user "${candidate.username}" via Web CLI.`,
          timestamp: new Date().toISOString()
        });

        executeSaveDb();
        return `🔇 SUCCESS: Muted user "${candidate.username}" globally from sending secure channel messages.`;
      } catch (err: any) {
        return `💥 ERROR muting user: ${err.message || err}`;
      }
    }
    case 'unmute': {
      try {
        if (!arg1) {
          return `❌ ERROR: Command "unmute" requires a <username> argument.`;
        }
        const candidate = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase());
        if (!candidate) {
          return `❌ ERROR: Account "${arg1}" is not registered.`;
        }

        if (db.admin_sanctions) {
          db.admin_sanctions = db.admin_sanctions.filter(s => !(s.target_id === candidate.user_id && s.type === 'mute'));
        }

        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: `al_${Date.now()}_audit`,
          admin_id: 1,
          admin_name: 'cli_admin',
          action: 'restore',
          target_type: 'user',
          target_id: String(candidate.user_id),
          reason: `Unmuted user "${candidate.username}" via Web CLI.`,
          timestamp: new Date().toISOString()
        });

        executeSaveDb();
        return `🔊 SUCCESS: Unmuted user "${candidate.username}". Channel write privileges restored.`;
      } catch (err: any) {
        return `💥 ERROR unmuting user: ${err.message || err}`;
      }
    }
    case 'clean-lounge': {
      try {
        const initialCount = db.messages ? db.messages.length : 0;
        if (db.messages) {
          db.messages = db.messages.filter(m => m.room_id !== 'velum_lounge');
        }
        const finalCount = db.messages ? db.messages.length : 0;
        const clearedCount = initialCount - finalCount;

        executeSaveDb();

        if (!isCloudBackupDisabled) {
          await executeCloudBackup();
        }

        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: `al_${Date.now()}_audit`,
          admin_id: 1,
          admin_name: 'cli_admin',
          action: 'purge',
          target_type: 'room',
          target_id: 'velum_lounge',
          reason: `Cleared all channel communication records in Velum Lounge (removed ${clearedCount} payloads).`,
          timestamp: new Date().toISOString()
        });

        if (broadcastToRoomCallback) {
          broadcastToRoomCallback('velum_lounge', {
            type: 'lounge_cleaned',
            room_id: 'velum_lounge',
            cleared_count: clearedCount,
            message: 'Velum Lounge has been cleared and sanitized by the Administrator Command Center.'
          });
        }

        return `SUCCESS: Cleared and sanitized all active messages inside Velum Lounge. Purged ${clearedCount} secure message records completely.`;
      } catch (err: any) {
        return `ERROR clearing Velum Lounge: ${err.message || err}`;
      }
    }
    case 'purge':
    case 'reset':
    case 'wipe':
    case 'prune':
    case 'prune-db':
    case 'hard-reset': {
      try {
        console.log('[SYS-SECURE] CLI Console triggered database purge procedure.');
        await hardResetAndSeedDatabase(true);
        executeSaveDb();

        if (!isCloudBackupDisabled) {
          await executeCloudBackup();
          return `💖 SUCCESS: Velum Relational Database wiped and purged completely! 💖\n` +
            `✨ Local storage has been reset, default administrative seeds redeployed, and cloud backups have been synchronized immediately on this server. Cloud backups cleared!`;
        }
        return `💖 SUCCESS: Velum Relational Database wiped and purged locally! 💖\n` +
          `✨ Local storage has been reset and default administrative seeds successfully deployed. (Cloud storage status: Offline)`;
      } catch (err: any) {
        return `💥 ERROR during deep database purge task: ${err.message || err}`;
      }
    }
    case 'seed': {
      try {
        await hardResetAndSeedDatabase(false);
        executeSaveDb();
        return `✨ INFO: Seeding check completed. Retained existing records safely.`;
      } catch (err: any) {
        return `💥 ERROR seeding database: ${err.message || err}`;
      }
    }
    case 'integrity': {
      try {
        if (fs.existsSync(SQLITE_FILE)) {
          const conn = initSqlite();
          if (conn) {
            const row = conn.prepare("PRAGMA integrity_check").get() as any;
            const ok = row && row.integrity_check === 'ok';
            return `INTEGRITY STATUS: ${ok ? 'PASSED (STABLE NATIVE)' : 'MALFORMED/CORRUPT_STATE'}\nDETAILS: ${JSON.stringify(row)}`;
          }
        }
        return `ERROR: SQLite database file has not been loaded or initialized.`;
      } catch (err: any) {
        return `INTEGRITY DIAGNOSTIC EXCEPTION: ${err.message || err}`;
      }
    }
    case 'logs': {
      try {
        const logsList = db.audit_logs || [];
        if (logsList.length === 0) {
          return '📋 INFO: No server log entries registered.';
        }
        return `📜 VELUM SERVER AUDIT LOGS 📜\n` +
          `========================================================\n` +
          logsList.map(log => `[${log.timestamp}] [${log.action.toUpperCase()}] ${log.reason} (${log.admin_name || 'root'})`).join('\n') +
          `\n========================================================`;
      } catch (err: any) {
        return `💥 ERROR querying audit logs: ${err.message || err}`;
      }
    }
    case 'vacuum':
    case 'db-vacuum': {
      try {
        const expiredCount = db.sessions ? db.sessions.filter(s => s.status === 'expired' || s.status === 'revoked').length : 0;
        if (db.sessions) {
          db.sessions = db.sessions.filter(s => s.status === 'active');
        }
        if (db.suspicious_events) {
          db.suspicious_events = db.suspicious_events.slice(-50);
        }
        executeSaveDb();
        return `VACUUM COMPLETE\n---------------------------------\n` +
          `• Purged ${expiredCount} expired/revoked security container sessions.\n` +
          `• Truncated older security anomaly records logs.\n` +
          `• SQLite relational schemas successfully optimized and compacted.`;
      } catch (err: any) {
        return `💥 ERROR during SQL compact vacuum: ${err.message || err}`;
      }
    }
    case 'clear-sessions':
    case 'clear': {
      if (parts[0].toLowerCase() === 'clear' && !arg1) {
        // Clear is also handled as a frontend screen wash, but if typed 'clear-sessions' it forces session trunk
        return 'CLEAR_TERMINAL_SCREEN';
      }
      db.sessions = [];
      executeSaveDb();
      return `FORCE FLUSH INITIATED: All active ephemeral sessions have been truncated. Readers will require re-authentication.`;
    }
    case 'lounges':
    case 'list-lounges': {
      if (!db.lounges || db.lounges.length === 0) {
        return 'No active lounges defined in database.';
      }
      let output = '\n=== SECURE LOUNGES REGISTRY MATRIX ===\n';
      db.lounges.forEach((lounge: any) => {
        const owner = db.users.find((u: any) => u.user_id === lounge.owner_id);
        output += ` - [ID: ${lounge.lounge_id || lounge.id}] "${lounge.name}" | Owner: ${owner?.username || 'System'} | Private: ${lounge.is_private ? 'TRUE' : 'FALSE'}\n`;
      });
      return output;
    }
    case 'risk':
    case 'risk-report': {
      try {
        if (!db.suspicious_events || db.suspicious_events.length === 0) {
          return '💚 SEC_OK: 0 active threats detected on system.';
        }
        let output = `⚠️ VELUM ANOMALOUS DETECTIONS AUDIT INDEX ⚠️\n========================================================\n`;
        db.suspicious_events.forEach(ev => {
          output += `[${ev.risk_level?.toUpperCase() || 'WARNING'}] ${ev.description} @ ${ev.created_at}\n`;
        });
        output += `========================================================`;
        return output;
      } catch (err: any) {
        return `💥 ERROR: Failed to query analytics reports: ${err.message || err}`;
      }
    }
    case 'wire':
    case 'send-system-wire': {
      try {
        if (!arg1 || !arg2Plus) {
          return '❌ ERROR: Command "wire" requires a target <username> and a <message>.';
        }
        const receiver = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase() || u.username.toLowerCase() === `@${arg1.replace(/^@/, '').toLowerCase()}`);
        if (!receiver) {
          return `❌ ERROR: Target user "${arg1}" not found in database.`;
        }

        const dmRoomId = `dm_velum_${receiver.user_id}`;

        const wireMessage = {
          message_id: `msg_sys_wire_${receiver.user_id}_${Date.now()}`,
          room_id: dmRoomId,
          user_id: 999,
          content: `[DIRECT SECURITY WIRE] ${arg2Plus}`,
          is_encrypted: false,
          reply_to: null,
          timestamp: new Date().toISOString(),
          expires_in: null,
          status: 'sent',
          type: 'text'
        } as any as Message;

        if (!db.messages) db.messages = [];
        db.messages.push(wireMessage);

        executeSaveDb();
        return `📡 SUCCESS: Successfully synchronized and transmitted direct system wire payload to user "${receiver.username}".`;
      } catch (err: any) {
        return `💥 ERROR: Failed to transmit secure wire signal: ${err.message || err}`;
      }
    }
    case 'token':
    case 'generate-login-token': {
      try {
        const tokenVal = `VELUM-TOKEN-${Math.floor(100000 + Math.random() * 900000)}`;
        (db as any).temp_admin_token = tokenVal;

        const currentInterval = Math.floor(Date.now() / 120000);
        const hash = crypto.createHash('sha256').update(`${currentInterval}_velum_otp`).digest('hex');
        const numericValue = parseInt(hash.substring(0, 8), 16);
        const otp = String(numericValue % 1000000).padStart(6, '0');

        executeSaveDb();
        return `🔑 TOKEN GENERATED SUCCESSFULLY\n---------------------------------\n` +
          `• Single-Use Alpha Token: ${tokenVal}\n` +
          `• Dynamic 6-Digit 2FA Code: ${otp} (Valid for 10 min window)\n` +
          `• Sync active across secure channels.`;
      } catch (err: any) {
        return `💥 ERROR generating temporary credentials: ${err.message || err}`;
      }
    }
    case 'delete-lounge':
    case 'delete_lounge': {
      if (!arg1) return '❌ ERROR: Command "delete-lounge" requires a <lounge_id> argument.';
      try {
        const loungeIndex = (db.lounges || []).findIndex(l => l.lounge_id === arg1 || l.id === arg1);
        if (loungeIndex === -1) {
          return `❌ ERROR: Lounge with ID '${arg1}' not found.`;
        }
        
        if (db.lounges) {
          db.lounges.splice(loungeIndex, 1);
        }
        if (db.lounge_members) {
            db.lounge_members = db.lounge_members.filter(m => m.lounge_id !== arg1);
        }
        
        saveDb(true);
        return `✅ SUCCESS: Lounge '${arg1}' has been permanently deleted.`;
      } catch (err: any) {
        return `❌ ERROR deleting lounge: ${err.message || err}`;
      }
    }
case 'restore-user':
    case 'restore_user': {
      try {
        if (!arg1) return '❌ ERROR: Command "restore-user" requires a <username> argument.';
        const candidate = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase() || u.username.toLowerCase() === `@${arg1.replace(/^@/, '').toLowerCase()}`);
        if (!candidate) {
          return `❌ ERROR: Account "${arg1}" is not registered. (Hard-purged users cannot be restored)`;
        }
        if (candidate.status !== 'purged') {
          return `❌ ERROR: User @${candidate.username} is not purged.`;
        }
        candidate.status = 'active';
        candidate.updated_at = new Date().toISOString();
        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: `al_${Date.now()}_rst_usr`,
          admin_id: 1,
          admin_name: 'cli_admin',
          action: 'user_restored',
          target_type: 'user',
          target_id: String(candidate.user_id),
          reason: `Purged account @${candidate.username} restored back to active state by CLI_ADMIN.`,
          timestamp: new Date().toISOString()
        });
        saveDb(true);
        return `✅ SUCCESS: User @${candidate.username} successfully restored to active status.`;
      } catch (err: any) {
        return `❌ ERROR restoring user: ${err.message || err}`;
      }
    }
    case 'reset-avatar':
    case 'reset_avatar': {
      try {
        if (!arg1) return '❌ ERROR: Command "reset-avatar" requires a <username> argument.';
        const candidate = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase() || u.username.toLowerCase() === `@${arg1.replace(/^@/, '').toLowerCase()}`);
        if (!candidate) {
          return `❌ ERROR: Account "${arg1}" is not registered.`;
        }
        const uId = candidate.user_id;
        const profile = db.profiles && db.profiles.find(p => p.user_id === uId);
        if (profile) {
          profile.avatar = "";
          profile.updated_at = new Date().toISOString();
          saveDb(true);
          return `✅ SUCCESS: Avatar for user @${candidate.username} has been reset.`;
        } else {
          return `❌ ERROR: Profile for user @${candidate.username} not found.`;
        }
      } catch (err: any) {
        return `❌ ERROR resetting avatar: ${err.message || err}`;
      }
    }
    case 'delete-user':
    case 'delete_user': {
      try {
        if (!arg1) {
          return `❌ ERROR: Command "delete-user" requires a <username> argument.`;
        }
        const candidate = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase() || u.username.toLowerCase() === `@${arg1.replace(/^@/, '').toLowerCase()}`);
        if (!candidate) {
          return `❌ ERROR: Account "${arg1}" is not registered.`;
        }

        if (candidate.role === 'CLI_ADMIN' || candidate.role === 'LOGIN_ADMIN') {
          return `❌ ERROR: Severe privilege violation - cannot delete system-level initial accounts.`;
        }

        const uId = candidate.user_id;

        // Purge user
        db.users = db.users.filter(u => u.user_id !== uId);
        // Purge profile
        db.profiles = db.profiles.filter(p => p.user_id !== uId);
        // Purge room memberships
        
        // Purge blocks
        db.user_blocks = db.user_blocks.filter(b => b.blocker_id !== uId && b.blocked_id !== uId);
        // Purge mutes
        db.user_mutes = (db.user_mutes || []).filter(m => m.muter_id !== uId && m.muted_id !== uId);
        // Purge sessions
        db.sessions = db.sessions.filter(s => s.user_id !== uId);
        // Purge tickets
        db.tickets = db.tickets.filter(t => t.user_id !== uId);

        // Terminate WebSocket connection instantly using dynamic import to prevent circular dependencies
        import('./websocket.js').then(({ connectedClients }) => {
          const activeConn = connectedClients.find(c => c.user_id === uId);
          if (activeConn) {
            try {
              activeConn.ws.send(JSON.stringify({ type: 'system_alert', message: 'ACCOUNT RESIGNED AND PURGED BY EXECUTIVE OVERRIDE.' }));
              activeConn.ws.close(3003, 'ACCOUNT_DELETED');
            } catch {}
          }
        }).catch(() => {});

        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: `al_${Date.now()}_audit`,
          admin_id: 1,
          admin_name: 'cli_admin',
          action: 'role_change',
          target_type: 'user',
          target_id: String(uId),
          reason: `Globally deleted user "${candidate.username}" via Web CLI. All associations purged.`,
          timestamp: new Date().toISOString()
        });

        executeSaveDb();
        return `SUCCESS: Globally deleted user "${candidate.username}" and purged all associated records.`;
      } catch (err: any) {
        return `ERROR during delete user sequence: ${err.message || err}`;
      }
    }
    case 'delete-ticket':
    case 'delete_ticket': {
      try {
        if (!arg1) {
          return `❌ ERROR: Command "delete-ticket" requires a <ticket_id> argument.`;
        }
        const ticketId = arg1.trim();
        const ticket = db.tickets.find(t => t.ticket_id === ticketId);
        if (!ticket) {
          return `❌ ERROR: Ticket with id "${ticketId}" not found in database.`;
        }

        db.tickets = db.tickets.filter(t => t.ticket_id !== ticketId);

        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: `al_${Date.now()}_audit`,
          admin_id: 1,
          admin_name: 'cli_admin',
          action: 'role_change',
          target_type: 'ticket',
          target_id: ticketId,
          reason: `Permanently deleted ticket case #${ticketId} via Web CLI.`,
          timestamp: new Date().toISOString()
        });

        executeSaveDb();
        return `SUCCESS: Permanently deleted ticket case #${ticketId}.`;
      } catch (err: any) {
        return `ERROR during delete ticket sequence: ${err.message || err}`;
      }
    }
    case 'override-user':
    case 'override_user': {
      try {
        if (!arg1) {
          return `❌ ERROR: Command "override-user" requires a <username> argument. Syntax: override-user <username> <new_password> [new_recovery_key] [new_safe_word]`;
        }
        const queryName = arg1.trim();
        const candidate = db.users.find(u => u.username.toLowerCase() === queryName.toLowerCase() || u.username.toLowerCase() === `@${queryName.replace(/^@/, '').toLowerCase()}`);
        if (!candidate) {
          return `❌ ERROR: Account "${arg1}" is not registered in registries.`;
        }

        const argsList = parts.slice(2);
        const newPassword = argsList[0];
        if (!newPassword) {
          return `❌ ERROR: Password is required. Syntax: override-user <username> <new_password> [new_recovery_key] [new_safe_word]`;
        }

        const newRecoveryKey = argsList[1] || crypto.randomBytes(16).toString('hex').toUpperCase();
        const newSafeWord = argsList[2] || 'restore';

        const salt = crypto.randomBytes(32).toString('hex');
        const saltBuf = Buffer.from(salt, 'hex');

        candidate.salt = salt;
        candidate.password_hash = `argon2id:${await hashArgon2id(newPassword, saltBuf)}`;
        candidate.safe_word_hash = `argon2id:${await hashArgon2id(newSafeWord, saltBuf)}`;
        
        const keySalt = crypto.randomBytes(32);
        const hashHex = await hashArgon2id(newRecoveryKey, keySalt);
        candidate.recovery_key_hash = `argon2id:${keySalt.toString('hex')}:${hashHex}`;

        // Force reset Compromised or other quarantined statuses to Active
        candidate.status = 'active';
        candidate.updated_at = new Date().toISOString();

        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: `al_${Date.now()}_audit`,
          admin_id: 1,
          admin_name: 'cli_admin',
          action: 'role_change',
          target_type: 'user',
          target_id: String(candidate.user_id),
          reason: `Overrode credentials and restored account active status for user "${candidate.username}" via Web CLI.`,
          timestamp: new Date().toISOString()
        });

        executeSaveDb();
        return `SUCCESS: Overrode credentials for "${candidate.username}".\n` +
          `• New Password Hash generated securely.\n` +
          `• Recovery Key set to: "${newRecoveryKey}"\n` +
          `• Safe Word set to: "${newSafeWord}"\n` +
          `• Account state set to ACTIVE. No active locks remaining.`;
      } catch (err: any) {
        return `💥 ERROR during override user credentials sequence: ${err.message || err}`;
      }
    }
    default: {
      return `❌ COMMAND NOT RECOGNIZED: "${action}"\nType "help" to list valid virtual console commands.`;
    }
  }
}
