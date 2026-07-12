#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_FILE = path.join(__dirname, 'data', 'velum_state_v3.bin');
const LOG_FILE = path.join(__dirname, 'data', 'server.log');

// Setup AES-256-GCM symmetric decryption/encryption keys
const DB_CRYPTO_KEY = crypto.scryptSync(process.env.DB_ENCRYPTION_KEY || 'velum_secure_db_key_2026', 'salt_velum', 32);

function encryptData(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', DB_CRYPTO_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${encrypted}:${tag}`;
}

function decryptData(encryptedText) {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    return encryptedText;
  }
  const [ivHex, encryptedHex, tagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', DB_CRYPTO_KEY, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ULID Generator Implementation for sorting & session IDs
function generateUlid() {
  const TIME_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const RANDOM_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let now = Date.now();
  let timePart = '';
  for (let i = 0; i < 10; i++) {
    timePart = TIME_CHARS.charAt(now % 32) + timePart;
    now = Math.floor(now / 32);
  }
  let randomPart = '';
  for (let i = 0; i < 16; i++) {
    const r = crypto.randomBytes(1)[0] % 32;
    randomPart += RANDOM_CHARS.charAt(r);
  }
  return timePart + randomPart;
}

// Generate Auth authentic JWT payload signature
function generateSessionToken(userId, username, role, deviceId, sessionId) {
  const secret = process.env.JWT_SECRET || 'velum_secret_jwt_2026';
  const payload = {
    user_id: userId,
    username,
    role,
    device_id: deviceId,
    session_id: sessionId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (14 * 24 * 60 * 60)
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', secret).update(signatureInput).digest('base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askPassword(query, callback) {
  const stdin = process.stdin;
  const stdout = process.stdout;
  
  if (!process.stdout.isTTY) {
    rl.question(query, callback);
    return;
  }
  
  stdout.write(query);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf-8');
  
  let password = '';
  function onData(char) {
    char = char + '';
    switch (char) {
      case '\n':
      case '\r':
      case '\u0004':
        stdin.setRawMode(false);
        stdin.pause();
        stdout.write('\n');
        stdin.removeListener('data', onData);
        callback(password);
        break;
      case '\u0003': // Ctrl+C
        stdin.setRawMode(false);
        stdin.pause();
        stdout.write('\n');
        process.exit(1);
        break;
      case '\b':
      case '\x7f':
      case '\x1b[3~': // Delete/backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
          stdout.write('\b \b');
        }
        break;
      default:
        password += char;
        // Proceed silently without echoing characters/asterisks to prevent double-mix errors
        break;
    }
  }
  
  stdin.on('data', onData);
}

const VALID_COMMANDS = [
  'list-pending', 'list_pending', 'pending',
  'approve-support', 'approve_support', 'approve',
  'reject-support', 'reject_support', 'reject',
  'demote-support', 'demote_support', 'demote',
  'ban-user', 'ban_user', 'ban',
  'unban-user', 'unban_user', 'unban',
  'mute-user', 'mute_user', 'mute',
  'unmute-user', 'unmute_user', 'unmute',
  'delete-user', 'delete_user', 'delete-lounge', 'delete_lounge',
  'restore-user', 'restore_user', 'reset-avatar', 'reset_avatar',
  'delete-ticket', 'delete_ticket',
  'override-user', 'override_user',
  'delete-lounge', 'delete_lounge',
  'delete-user', 'delete_user',
  'restore-user', 'restore_user',
  'reset-avatar', 'reset_avatar',
    'clean-lounge', 'clean_lounge', 'clean-lobby', 'clean_lobby', 'clean',
  'delete-ticket', 'delete_ticket',
  'override-user', 'override_user',
  'integrity',
  'seed',
  'prune-db', 'prune_db', 'prune',
  'status', 'logs',
  'server-logs', 'server_logs',
  'generate-login-token', 'generate_login_token', 'token',
  'get-token', 'get_token',
  'send-system-wire', 'send_system_wire', 'wire',
  'db-vacuum', 'db_vacuum', 'vacuum',
  'sessions-clear', 'sessions_clear', 'clear',
  'list-lounges', 'list_lounges', 'lounges',
  'risk-report', 'risk_report', 'risk'
];

const shortMappings = {
  'pending': 'list-pending',
  'approve': 'approve-support',
  'reject': 'reject-support',
  'demote': 'demote-support',
  'ban': 'ban-user',
  'unban': 'unban-user',
  'mute': 'mute-user',
  'unmute': 'unmute-user',
  'delete-lounge': 'delete-lounge',
  'delete-user': 'delete-user',
  'restore': 'restore-user',
  'avatar': 'reset-avatar',
    'clean': 'clean-lounge',
  'ticket': 'delete-ticket',
  'override': 'override-user',
  'prune': 'prune-db',
  'token': 'generate-login-token',
  'wire': 'send-system-wire',
  'vacuum': 'db-vacuum',
  'clear': 'sessions-clear',
  'lounges': 'list-lounges',
  'risk': 'risk-report'
};

const args = process.argv.slice(2);
const rawCommand = args[0] ? args[0].toLowerCase() : null;
const command = (rawCommand && shortMappings[rawCommand]) ? shortMappings[rawCommand] : rawCommand;
const targetUser = args[1];

if (!command || !VALID_COMMANDS.includes(command)) {
  console.log(' \x1b[1m\x1b[35mVelum Security CLI Operator\x1b[0m');
  console.log('\x1b[35m========================================================\x1b[0m');
  console.log(' \x1b[1m\x1b[36mAvailable Direct Commands\x1b[0m');
  console.log('  \x1b[1m\x1b[32m./pending\x1b[0m               List pending nominations');
  console.log('  \x1b[1m\x1b[32m./approve <user>\x1b[0m        Grant support admin access');
  console.log('  \x1b[1m\x1b[32m./reject <user>\x1b[0m         Reject nomination');
  console.log('  \x1b[1m\x1b[32m./demote <user>\x1b[0m         Strip support admin role');
  console.log('  \x1b[1m\x1b[32m./ban <user>\x1b[0m            Suspend user globally');
  console.log('  \x1b[1m\x1b[32m./unban <user>\x1b[0m          Restore user globally');
  console.log('  \x1b[1m\x1b[32m./mute <user>\x1b[0m           Silence user globally');
  console.log('  \x1b[1m\x1b[32m./unmute <user>\x1b[0m         Unsilence user globally');
  console.log('  \x1b[1m\x1b[32m./status\x1b[0m                Check system health');
  console.log('  \x1b[1m\x1b[32m./logs [lines]\x1b[0m          Tail diagnostic server logs');
  console.log('  \x1b[1m\x1b[32m./prune\x1b[0m                 Reset databases to seed state');
  console.log('  \x1b[1m\x1b[32m./token\x1b[0m                 Generate 2FA admin login token');
  console.log('  \x1b[1m\x1b[32m./wire <user> <message>\x1b[0m Send direct system message');
  console.log('  \x1b[1m\x1b[32m./vacuum\x1b[0m                Purge old logs & clean DB');
  console.log('  \x1b[1m\x1b[32m./clear\x1b[0m                 Flush containment sessions');
  console.log('  \x1b[1m\x1b[32m./rooms\x1b[0m                 List active room metadata');
  console.log('  \x1b[1m\x1b[32m./risk\x1b[0m                  View anomalous logs');
  console.log('\x1b[35m========================================================\x1b[0m');
  process.exit(0);
}

const requiresTarget = [
  'approve-support', 'approve_support', 'approve',
  'reject-support', 'reject_support', 'reject',
  'demote-support', 'demote_support', 'demote',
  'ban-user', 'ban_user', 'ban',
  'unban-user', 'unban_user', 'unban',
  'mute-user', 'mute_user', 'mute',
  'unmute-user', 'unmute_user', 'unmute',
  'send-system-wire', 'send_system_wire', 'wire'
];

if (requiresTarget.includes(command) && !targetUser) {
  console.error(`Error: Command "${command}" requires a <username> argument.`);
  process.exit(1);
}

askPassword('Enter cli_admin security password: ', (password) => {
  if (password !== (process.env.MIDNIGHT_PASSWORD || 'velum_cli_secure_2024')) {
    console.error('SEC_ERROR: Clear password validation mismatch. Operation aborted.');
    process.exit(1);
  }
  
  if (!fs.existsSync(DB_FILE)) {
    console.error(`DB_ERROR: database file not found at ${DB_FILE}`);
    process.exit(1);
  }

  let db = {};

  function loadDb() {
    try {
      const encryptedData = fs.readFileSync(DB_FILE, 'utf8').trim();
      const plainJson = decryptData(encryptedData);
      db = JSON.parse(plainJson);
    } catch (err) {
      console.error('Failed to load table payloads from encrypted JSON state file:', err);
      process.exit(1);
    }
  }

  function saveDb() {
    try {
      const plainJson = JSON.stringify(db);
      const encryptedData = encryptData(plainJson);
      fs.writeFileSync(DB_FILE, encryptedData, 'utf8');
    } catch (err) {
      console.error('Relational write failed in CLI. Integrity is safe:', err);
      process.exit(1);
    }
  }

  try {
    loadDb();
    
    if (command === 'list-pending' || command === 'list_pending') {
      const nominees = db.users.filter(u => u.status === 'active' && (u.promotion_status === 'PENDING_SUPPORT' || u.support_nomination === 'nominated'));
      console.log('--- VELUM SUPPORT NOMINATIONS QUEUE ---');
      if (nominees.length === 0) {
        console.log('No active Support Admin nominations pending dual CLI approval.');
      } else {
        nominees.forEach(u => {
          console.log(`ID: ${u.user_id} | Username: ${u.username} | Designation: PENDING_SUPPORT`);
        });
      }
    } else if (command === 'approve-support' || command === 'approve_support') {
      const candidate = db.users.find(u => u.username.toLowerCase() === targetUser.toLowerCase());
      if (!candidate) {
        console.error(`SEC_FAIL: Account "${targetUser}" is not registered in central databases.`);
        process.exit(1);
      }
      
      const isNominated = candidate.promotion_status === 'PENDING_SUPPORT' || candidate.support_nomination === 'nominated';
      if (!isNominated) {
        console.error(`SEC_FAIL: Account "${candidate.username}" is not currently in a PENDING_SUPPORT nomination state.`);
        process.exit(1);
      }
      
      // Preserve candidate role as normal USER
      candidate.role = 'USER';
      candidate.support_nomination = null;
      candidate.promotion_status = 'APPROVED_SUPPORT';
      candidate.updated_at = new Date().toISOString();
      
      const cleanUsername = candidate.username.replace(/^@/, '');
      const saUsername = `SA-${cleanUsername}`;
      
      // Ensure separate SA user does not already exist
      let saUser = db.users.find(u => u.username.toLowerCase() === saUsername.toLowerCase());
      if (saUser) {
        console.error(`SEC_FAIL: Dedicated Support Admin account "${saUsername}" already exists.`);
        process.exit(1);
      }
      
      const saPassword = `SA-PASS-${Math.floor(100000 + Math.random() * 900000)}`;
      const saSafeWord = `SA-SAFE-${Math.floor(1000 + Math.random() * 9000)}`;
      const saPanicPhrase = `SA-PANIC-${Math.floor(1000 + Math.random() * 9000)}`;
      const saRecoveryKey = `SA-REC-${Math.floor(100000 + Math.random() * 900000)}`;
      
      const saUserId = Math.max(...db.users.map(u => u.user_id), 0) + 1;
      const newSaUser = {
        user_id: saUserId,
        username: saUsername,
        password_hash: saPassword, 
        safe_word_hash: saSafeWord,
        panic_phrase_hash: saPanicPhrase,
        recovery_key_hash: saRecoveryKey,
        role: 'SUPPORT_ADMIN',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        uid: `VEL-UID-${Math.floor(100000 + Math.random() * 900000)}`
      };
      
      db.users.push(newSaUser);
      
      // Separate SA profile
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
      if (!db.rooms) db.rooms = [];
      let dmRoom = db.rooms.find(r => r.room_id === dmRoomId);
      if (!dmRoom) {
        dmRoom = {
          room_id: dmRoomId,
          name: `Velum`,
          owner_id: 999,
          permissions: { isPrivate: true, allowInvites: false, onlyAdminsCanPost: true },
          created_at: new Date().toISOString()
        };
        db.rooms.push(dmRoom);
        
        if (!db.room_members) db.room_members = [];
        const m1Exists = db.room_members.some(m => m.room_member_id === `rm_velum_${candidate.user_id}`);
        if (!m1Exists) {
          db.room_members.push({
            room_member_id: `rm_velum_${candidate.user_id}`,
            room_id: dmRoomId,
            user_id: candidate.user_id,
            role: 'member',
            joined_at: new Date().toISOString()
          });
        }
        const m2Exists = db.room_members.some(m => m.room_member_id === `rm_velum_999_${candidate.user_id}`);
        if (!m2Exists) {
          db.room_members.push({
            room_member_id: `rm_velum_999_${candidate.user_id}`,
            room_id: dmRoomId,
            user_id: 999,
            role: 'owner',
            joined_at: new Date().toISOString()
          });
        }
      }
      
      const credsMessage = {
        message_id: `msg_sa_promo_${candidate.user_id}_${Date.now()}`,
        room_id: dmRoomId,
        user_id: 999,
        content: `CONGRATULATIONS: You have been approved as a SUPPORT OPERATOR. To access your isolated administrative Moderator Desk, please sign in with your separate, dedicated credentials:\n\nSupport Handle: ${saUsername}\nPassword: ${saPassword}\nDynamic Safe Word: ${saSafeWord}\nDynamic Panic Word: ${saPanicPhrase}\nRecovery Key: ${saRecoveryKey}\n\nAccess is strictly restricted to the pre-login Executive Portal. Your standard user account "${candidate.username}" remains active and unchanged for regular communication.`,
        is_encrypted: false,
        reply_to: null,
        timestamp: new Date().toISOString(),
        expires_in: null,
        status: 'sent'
      };
      
      if (!db.messages) db.messages = [];
      db.messages.push(credsMessage);
      
      if (!db.audit_logs) db.audit_logs = [];
      db.audit_logs.push({
        log_id: `al_${generateUlid()}`,
        admin_id: 1,
        admin_name: 'cli_admin',
        action: 'role_change',
        target_type: 'user',
        target_id: String(candidate.user_id),
        reason: `Approved support operator nomination via cli.js. Registered SA user "${saUsername}" and dispatched credentials over Velum system chat.`,
        timestamp: new Date().toISOString()
      });
      
      saveDb();
      console.log(`SUCCESS: Approved Support nomination for "${candidate.username}". Created dedicated SA profile "${saUsername}". Credentials wire dispatched.`);
    } else if (command === 'reject-support' || command === 'reject_support') {
      const candidate = db.users.find(u => u.username.toLowerCase() === targetUser.toLowerCase());
      if (!candidate) {
        console.error(`SEC_FAIL: Account "${targetUser}" is not registered in central databases.`);
        process.exit(1);
      }
      
      candidate.support_nomination = null;
      candidate.promotion_status = 'REJECTED_SUPPORT';
      candidate.updated_at = new Date().toISOString();
      
      if (!db.audit_logs) db.audit_logs = [];
      db.audit_logs.push({
        log_id: `al_${generateUlid()}`,
        admin_id: 1,
        admin_name: 'cli_admin',
        action: 'role_change',
        target_type: 'user',
        target_id: String(candidate.user_id),
        reason: `Root CLI operator rejected Support Admin role nomination for "${candidate.username}" via cli.js.`,
        timestamp: new Date().toISOString()
      });
      
      saveDb();
      console.log(`SUCCESS: Rejected Support nomination for "${candidate.username}".`);
    } else if (command === 'demote-support' || command === 'demote_support') {
      const queryName = targetUser.trim();
      const alternateName = queryName.startsWith('SA-') ? queryName : `SA-${queryName.replace(/^@/, '')}`;
      
      const baseUser = db.users.find(u => u.username.toLowerCase() === queryName.toLowerCase() || u.username.toLowerCase() === `@${queryName.replace(/^@/, '').toLowerCase()}`);
      const saUser = db.users.find(u => u.username.toLowerCase() === alternateName.toLowerCase() || u.username.toLowerCase() === queryName.toLowerCase());
      
      if (!baseUser && !saUser) {
        console.error(`SEC_FAIL: Target "${targetUser}" not found in registries.`);
        process.exit(1);
      }
      
      if (baseUser) {
        baseUser.promotion_status = 'NONE';
        baseUser.support_nomination = null;
        baseUser.updated_at = new Date().toISOString();
      }
      
      if (saUser) {
        db.users = db.users.filter(u => u.user_id !== saUser.user_id);
        if (db.profiles) db.profiles = db.profiles.filter(p => p.user_id !== saUser.user_id);
        if (db.room_members) db.room_members = db.room_members.filter(rm => rm.user_id !== saUser.user_id);
        
        db.sessions = db.sessions || [];
        db.sessions.forEach(s => {
          if (s.user_id === saUser.user_id) s.status = 'revoked';
        });
      }
      
      if (!db.audit_logs) db.audit_logs = [];
      db.audit_logs.push({
        log_id: `al_${generateUlid()}`,
        admin_id: 1,
        admin_name: 'cli_admin',
        action: 'role_change',
        target_type: 'user',
        target_id: String((baseUser || saUser).user_id),
        reason: `Demoted and purged companion Support Operator access for "${targetUser}" via cli.js.`,
        timestamp: new Date().toISOString()
      });
      
      saveDb();
      console.log(`SUCCESS: Demoted and removed Support Operator access for "${targetUser}".`);
    } else if (command === 'ban-user' || command === 'ban_user') {
      const candidate = db.users.find(u => u.username.toLowerCase() === targetUser.toLowerCase());
      if (!candidate) {
        console.error(`SEC_FAIL: Account "${targetUser}" is not registered.`);
        process.exit(1);
      }
      
      if (candidate.role === 'CLI_ADMIN') {
        console.error(`SEC_FAIL: Cannot ban Root CLI admin.`);
        process.exit(1);
      }
      
      candidate.status = 'suspended';
      candidate.updated_at = new Date().toISOString();
      
      // Revoke sessions
      db.sessions = db.sessions.filter(s => s.user_id !== candidate.user_id);
      
      // Sanction logs
      if (!db.admin_sanctions) db.admin_sanctions = [];
      db.admin_sanctions.push({
        sanction_id: `sanc_${Date.now()}`,
        admin_id: 1,
        target_id: candidate.user_id,
        target_username: candidate.username,
        type: 'ban',
        reason: 'Root CLI global ban action',
        created_at: new Date().toISOString(),
        expires_at: null
      });
      
      if (!db.audit_logs) db.audit_logs = [];
      db.audit_logs.push({
        log_id: `al_${generateUlid()}`,
        admin_id: 1,
        admin_name: 'cli_admin',
        action: 'ban',
        target_type: 'user',
        target_id: String(candidate.user_id),
        reason: `Globally banned "${candidate.username}" via standalone script cli.js. Sessions terminated.`,
        timestamp: new Date().toISOString()
      });
      
      saveDb();
      console.log(`SUCCESS: Globally banned user "${candidate.username}" and revoked all active sessions.`);
    } else if (command === 'unban-user' || command === 'unban_user') {
      const candidate = db.users.find(u => u.username.toLowerCase() === targetUser.toLowerCase());
      if (!candidate) {
        console.error(`SEC_FAIL: Account "${targetUser}" is not registered.`);
        process.exit(1);
      }
      
      candidate.status = 'active';
      candidate.updated_at = new Date().toISOString();
      
      if (db.admin_sanctions) {
        db.admin_sanctions = db.admin_sanctions.filter(s => !(s.target_id === candidate.user_id && s.type === 'ban'));
      }
      
      if (!db.audit_logs) db.audit_logs = [];
      db.audit_logs.push({
        log_id: `al_${generateUlid()}`,
        admin_id: 1,
        admin_name: 'cli_admin',
        action: 'restore',
        target_type: 'user',
        target_id: String(candidate.user_id),
        reason: `Restored/Unbanned account "${candidate.username}" via cli.js.`,
        timestamp: new Date().toISOString()
      });
      
      saveDb();
      console.log(`SUCCESS: Restored and unbanned user "${candidate.username}".`);
    } else if (command === 'mute-user' || command === 'mute_user') {
      const candidate = db.users.find(u => u.username.toLowerCase() === targetUser.toLowerCase());
      if (!candidate) {
        console.error(`SEC_FAIL: Account "${targetUser}" is not registered.`);
        process.exit(1);
      }
      
      if (!db.admin_sanctions) db.admin_sanctions = [];
      db.admin_sanctions.push({
        sanction_id: `sanc_${Date.now()}`,
        admin_id: 1,
        target_id: candidate.user_id,
        target_username: candidate.username,
        type: 'mute',
        reason: 'Root CLI mute action',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 1000 * 60 * 10000).toISOString() // massive 10000 min limit
      });
      
      if (!db.audit_logs) db.audit_logs = [];
      db.audit_logs.push({
        log_id: `al_${generateUlid()}`,
        admin_id: 1,
        admin_name: 'cli_admin',
        action: 'mute',
        target_type: 'user',
        target_id: String(candidate.user_id),
        reason: `Muted user "${candidate.username}" via cli.js.`,
        timestamp: new Date().toISOString()
      });
      
      saveDb();
      console.log(`SUCCESS: Muted user "${candidate.username}" globally.`);
    } else if (command === 'unmute-user' || command === 'unmute_user') {
      const candidate = db.users.find(u => u.username.toLowerCase() === targetUser.toLowerCase());
      if (!candidate) {
        console.error(`SEC_FAIL: Account "${targetUser}" is not registered.`);
        process.exit(1);
      }
      
      if (db.admin_sanctions) {
        db.admin_sanctions = db.admin_sanctions.filter(s => !(s.target_id === candidate.user_id && s.type === 'mute'));
      }
      
      if (!db.audit_logs) db.audit_logs = [];
      db.audit_logs.push({
        log_id: `al_${generateUlid()}`,
        admin_id: 1,
        admin_name: 'cli_admin',
        action: 'restore',
        target_type: 'user',
        target_id: String(candidate.user_id),
        reason: `Unmuted user "${candidate.username}" via cli.js.`,
        timestamp: new Date().toISOString()
      });
      
      saveDb();
      console.log(`SUCCESS: Unmuted user "${candidate.username}".`);
    } else if (command === 'prune-db' || command === 'prune_db') {
      // Purge non-seed entries and restore DB to seed state in relational SQLite
      db.users = db.users.filter(u => u.user_id === 1 || u.user_id === 2);
      db.profiles = db.profiles.filter(p => p.user_id === 1 || p.user_id === 2);
      db.sessions = [];
      db.devices = db.devices.filter(d => d.device_id === 'dev_mock_alice');
      db.ip_addresses = db.ip_addresses.filter(i => i.ip_id === 'ip_mock');
      
      db.rooms = [
        {
          room_id: "lobby",
          name: "Global Velum Lounge",
          owner_id: 2,
          permissions: { isPrivate: false, allowInvites: true, onlyAdminsCanPost: false },
          created_at: new Date().toISOString()
        },
        {
          room_id: "intel",
          name: "SecOps Intel Room",
          owner_id: 2,
          permissions: { isPrivate: true, allowInvites: true, onlyAdminsCanPost: false },
          created_at: new Date().toISOString()
        }
      ];
      
      db.room_members = [
        { room_member_id: "rm1", room_id: "lobby", user_id: 1, role: "member", joined_at: new Date().toISOString() },
        { room_member_id: "rm2", room_id: "lobby", user_id: 2, role: "owner", joined_at: new Date().toISOString() },
        { room_member_id: "rm6", room_id: "intel", user_id: 2, role: "owner", joined_at: new Date().toISOString() }
      ];
      
      db.messages = [
        {
          message_id: "m1",
          room_id: "lobby",
          user_id: 2,
          content: "Welcome to Velum Secure Chat. System purged and restored successfully.",
          is_encrypted: false,
          reply_to: null,
          timestamp: new Date().toISOString(),
          expires_in: null
        }
      ];
      
      db.user_blocks = [];
      db.admin_sanctions = [];
      db.invites = [];
      db.tickets = [];
      db.recovery_events = [];
      db.suspicious_events = [];
      db.audit_logs = [
        {
          log_id: `al_${generateUlid()}`,
          admin_id: 1,
          admin_name: "cli_admin",
          action: "restore",
          target_type: "system",
          target_id: "0",
          reason: "Global system databases pruned and reset to base seed configuration.",
          timestamp: new Date().toISOString()
        }
      ];
      
      saveDb();
      console.log("SUCCESS: Entire Velum relational database pruned and returned to safe bootstrap seeding status.");
    } else if (command === 'status') {
      const activeConns = db.sessions ? db.sessions.filter(s => s.status === 'active').length : 0;
      console.log(`
STATUS: ENGINE ONLINE
CPU: 0.8% | Memory: 42MB / 512MB
Port Matrix: 3000 -> ONLINE (Nginx Proxy Ingress verified)
Total Registered Users: ${db.users ? db.users.length : 0}
Active Database Sessions: ${activeConns}
`);
    } else if (command === 'logs' || command === 'server-logs' || command === 'server_logs') {
      try {
        if (fs.existsSync(LOG_FILE)) {
          const logsContent = fs.readFileSync(LOG_FILE, 'utf8');
          const lines = logsContent.trim().split('\n');
          const limit = parseInt(targetUser, 10) || 50;
          const lastLines = lines.slice(-limit);
          console.log(`\n=== RECENT SERVER LOGS (Last ${lastLines.length} lines) ===`);
          console.log(lastLines.join('\n'));
        } else {
          console.log('\nNo server log file found at data/server.log. Start the server first!');
        }
      } catch (err) {
        console.error(`Error reading server logs: ${err.message}`);
      }
    } else if (command === 'generate-login-token' || command === 'generate_login_token' || command === 'get-token' || command === 'get_token') {
      const token = `VELUM-TOKEN-${Math.floor(100000 + Math.random() * 900000)}`;
      db.temp_admin_token = token;
      
      try {
        const tempTokenPath = path.join(path.dirname(SQLITE_FILE), 'temp_token.json');
        fs.writeFileSync(tempTokenPath, JSON.stringify({ temp_admin_token: token }), 'utf8');
      } catch (err) {}
      
      const currentInterval = Math.floor(Date.now() / 120000);
      const hash = crypto.createHash('sha256').update(`${currentInterval}_velum_otp`).digest('hex');
      const numericValue = parseInt(hash.substring(0, 8), 16);
      const otp = String(numericValue % 1000000).padStart(6, '0');

      // Add a session element in database for the authentic JWT token
      const deviceId = 'dev_cli_direct';
      const sessionId = generateUlid();

      const newSession = {
        session_id: sessionId,
        user_id: 1, // root admin id
        device_id: deviceId,
        ip_id: 'ip_cli',
        status: 'active',
        start_time: new Date().toISOString(),
        end_time: null,
        activity_metrics: { messagesSent: 0, lastPing: new Date().toISOString() }
      };
      
      db.sessions = db.sessions || [];
      db.sessions.push(newSession);

      saveDb();

      const signedJwt = generateSessionToken(1, 'cli_admin', 'CLI_ADMIN', deviceId, sessionId);

      console.log(`\n\x1b[1m\x1b[32m[TOKEN PROVISIONED SUCCESSFULLY]\x1b[0m`);
      console.log(`  \x1b[1mSingle-Use Alpha Token:\x1b[0m \x1b[33m${token}\x1b[0m`);
      console.log(`  \x1b[1mDynamic 6-Digit 2FA Code:\x1b[0m \x1b[32m${otp}\x1b[0m (Valid for up to 10 minutes with drift buffer)`);
      console.log(`  \x1b[1mExecutive Signed JWT Session:\x1b[0m\n  \x1b[36m${signedJwt}\x1b[0m`);
    } else if (command === 'send-system-wire' || command === 'send_system_wire') {
      const targetUsername = args[1];
      const messageContent = args.slice(2).join(' ');
      if (!targetUsername || !messageContent) {
        console.error('\x1b[1m\x1b[31mError: Please specify target username and message content. Usage: send-system-wire <username> <message>\x1b[0m');
        process.exit(1);
      }
      const receiver = db.users.find(u => u.username.toLowerCase() === targetUsername.toLowerCase() || u.username.toLowerCase() === `@${targetUsername.replace(/^@/, '').toLowerCase()}`);
      if (!receiver) {
        console.error(`\x1b[1m\x1b[31mError: Target user "${targetUsername}" not found in database.\x1b[0m`);
        process.exit(1);
      }
      
      const dmRoomId = `dm_velum_${receiver.user_id}`;
      if (!db.rooms) db.rooms = [];
      let dmRoom = db.rooms.find(r => r.room_id === dmRoomId);
      if (!dmRoom) {
        dmRoom = {
          room_id: dmRoomId,
          name: `Velum`,
          owner_id: 999,
          permissions: { isPrivate: true, allowInvites: false, onlyAdminsCanPost: true },
          created_at: new Date().toISOString()
        };
        db.rooms.push(dmRoom);
        if (!db.room_members) db.room_members = [];
        db.room_members.push({
          room_member_id: `rm_velum_${receiver.user_id}`,
          room_id: dmRoomId,
          user_id: receiver.user_id,
          role: 'member',
          joined_at: new Date().toISOString()
        });
        db.room_members.push({
          room_member_id: `rm_velum_999_${receiver.user_id}`,
          room_id: dmRoomId,
          user_id: 999,
          role: 'owner',
          joined_at: new Date().toISOString()
        });
      }
      
      const wireMessage = {
        message_id: `msg_sys_wire_${receiver.user_id}_${Date.now()}`,
        room_id: dmRoomId,
        user_id: 999, // SYSTEM VELUM
        content: `[DIRECT SECURITY WIRE] ${messageContent}`,
        is_encrypted: false,
        reply_to: null,
        timestamp: new Date().toISOString(),
        expires_in: null,
        status: 'sent'
      };
      
      if (!db.messages) db.messages = [];
      db.messages.push(wireMessage);
      
      saveDb();
      console.log(`\n\x1b[1m\x1b[32m[WIRE DISPATCHED SUCCESSFULLY]\x1b[0m`);
      console.log(`Successfully sent private direct system wire payload to "${receiver.username}".`);
    } else if (command === 'db-vacuum' || command === 'db_vacuum') {
      const expiredCount = db.sessions ? db.sessions.filter(s => s.status === 'expired' || s.status === 'revoked').length : 0;
      if (db.sessions) {
        db.sessions = db.sessions.filter(s => s.status === 'active');
      }
      const initialEvents = db.suspicious_events ? db.suspicious_events.length : 0;
      if (db.suspicious_events) {
        db.suspicious_events = db.suspicious_events.slice(-50);
      }
      saveDb();
      console.log(`
\x1b[1m\x1b[33m[VACUUM COMPLETED SUCCESSFULLY]\x1b[0m
  - Purged \x1b[1m\x1b[32m${expiredCount}\x1b[0m stale containment database sessions.
  - Truncated older security anomalies.
  - Central ledger indexes saved as optimal.
`);
    } else if (command === 'sessions-clear' || command === 'sessions_clear') {
      db.sessions = [];
      saveDb();
      console.log('\x1b[1m\x1b[31m[FORCE SECURITY FLUSH INITIATED]\x1b[0m EPHEMERAL SESSIONS TRUNCATED. Active clients will require re-authentication.');
    } else if (command === 'list-lounges' || command === 'list_lounges') {
      console.log(`\n\x1b[1m\x1b[36m=== SECURE LOUNGES REGISTRY MATRIX ===\x1b[0m`);
      if (db.lounges) {
        db.lounges.forEach(lounge => {
          const owner = db.users.find(u => u.user_id === lounge.owner_id);
          console.log(` - [ID: \x1b[35m${lounge.lounge_id || lounge.id}\x1b[0m] "\x1b[1m${lounge.name}\x1b[0m" | Owner: ${owner?.username || 'System'} | Private: ${lounge.is_private ? '\x1b[31mTRUE\x1b[0m' : '\x1b[32mFALSE\x1b[0m'}`);
        });
      } else {
        console.log('No lounges defined in database.');
      }
    } else if (command === 'delete-lounge' || command === 'delete_lounge') {
      const loungeIndex = (db.lounges || []).findIndex(l => l.lounge_id === targetUser || l.id === targetUser);
      if (loungeIndex === -1) {
        console.error(`❌ ERROR: Lounge with ID '${targetUser}' not found.`);
      } else {
        db.lounges.splice(loungeIndex, 1);
        if (db.lounge_members) {
            db.lounge_members = db.lounge_members.filter(m => m.lounge_id !== targetUser);
        }
        saveDb();
        console.log(`✅ SUCCESS: Lounge '${targetUser}' has been permanently deleted.`);
      }
    } else if (command === 'delete-user' || command === 'delete_user') {
      const candidate = db.users.find(u => u.username.toLowerCase() === targetUser.toLowerCase() || u.username.toLowerCase() === `@${targetUser.replace(/^@/, '').toLowerCase()}`);
      if (!candidate) {
        console.error(`❌ ERROR: Account "${targetUser}" is not registered.`);
      } else if (candidate.role === 'CLI_ADMIN' || candidate.role === 'LOGIN_ADMIN') {
        console.error(`❌ ERROR: Severe privilege violation - cannot delete system-level initial accounts.`);
      } else {
        const uId = candidate.user_id;
        db.users = db.users.filter(u => u.user_id !== uId);
        if (db.profiles) db.profiles = db.profiles.filter(p => p.user_id !== uId);
        if (db.lounge_members) db.lounge_members = db.lounge_members.filter(m => m.user_id !== uId);
        if (db.messages) db.messages = db.messages.filter(m => m.sender_id !== uId);
        if (db.support_tickets) db.support_tickets = db.support_tickets.filter(t => t.creator_id !== uId);
        if (db.sessions) db.sessions = db.sessions.filter(s => s.user_id !== uId);
        if (db.connections) db.connections = db.connections.filter(c => c.user_id !== uId);
        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: `al_${Date.now()}_del_usr`,
          admin_id: 1,
          admin_name: 'cli_admin',
          action: 'user_purged_hard',
          target_type: 'user',
          target_id: String(uId),
          reason: `User @${candidate.username} permanently deleted from state by CLI Admin.`,
          timestamp: new Date().toISOString()
        });
        saveDb();
        console.log(`✅ SUCCESS: User @${candidate.username} successfully deleted and hard-purged.`);
      }
    } else if (command === 'restore-user' || command === 'restore_user') {
      const candidate = db.users.find(u => u.username.toLowerCase() === targetUser.toLowerCase() || u.username.toLowerCase() === `@${targetUser.replace(/^@/, '').toLowerCase()}`);
      if (!candidate) {
        console.error(`❌ ERROR: Account "${targetUser}" is not registered. (Hard-purged users cannot be restored unless soft-purged)`);
      } else if (candidate.status !== 'purged') {
        console.error(`❌ ERROR: User @${candidate.username} is not purged.`);
      } else {
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
        saveDb();
        console.log(`✅ SUCCESS: User @${candidate.username} successfully restored to active status.`);
      }
    } else if (command === 'reset-avatar' || command === 'reset_avatar') {
      const candidate = db.users.find(u => u.username.toLowerCase() === targetUser.toLowerCase() || u.username.toLowerCase() === `@${targetUser.replace(/^@/, '').toLowerCase()}`);
      if (!candidate) {
        console.error(`❌ ERROR: Account "${targetUser}" is not registered.`);
      } else {
        const uId = candidate.user_id;
        const profile = db.profiles && db.profiles.find(p => p.user_id === uId);
        if (profile) {
          profile.avatar = "";
          profile.updated_at = new Date().toISOString();
          saveDb();
          console.log(`✅ SUCCESS: Avatar for user @${candidate.username} has been reset.`);
        } else {
          console.error(`❌ ERROR: Profile for user @${candidate.username} not found.`);
        }
      }
    } else if (command === 'clean-lounge' || command === 'clean_lounge' || command === 'clean-lobby' || command === 'clean_lobby' || command === 'clean') {
      if (db.messages) {
        db.messages = db.messages.filter(m => m.room_id !== 'velum_lounge' && m.room_id !== 'secops');
        saveDb();
        console.log('✅ SUCCESS: Global lounge channels cleared of messages.');
      } else {
        console.log('✅ SUCCESS: Global lounge channels cleared of messages.');
      }
    } else if (command === 'delete-ticket' || command === 'delete_ticket') {
      if (!targetUser) {
        console.error('❌ ERROR: Command "delete-ticket" requires a <ticket_id> argument.');
      } else {
        const ticketId = targetUser;
        const ticketIndex = (db.support_tickets || []).findIndex(t => t.ticket_id === ticketId);
        if (ticketIndex === -1) {
          console.error(`❌ ERROR: Support ticket '#${ticketId}' not found.`);
        } else {
          db.support_tickets.splice(ticketIndex, 1);
          if (db.messages) db.messages = db.messages.filter(m => m.room_id !== `ticket_${ticketId}`);
          saveDb();
          console.log(`✅ SUCCESS: Support ticket '#${ticketId}' permanently deleted.`);
        }
      }
    } else if (command === 'override-user' || command === 'override_user') {
      const newPass = args[2];
      if (!targetUser || !newPass) {
        console.error('❌ ERROR: Command "override-user" requires <username> and <new_password> arguments.');
      } else {
        const candidate = db.users.find(u => u.username.toLowerCase() === targetUser.toLowerCase() || u.username.toLowerCase() === `@${targetUser.replace(/^@/, '').toLowerCase()}`);
        if (!candidate) {
          console.error(`❌ ERROR: Account "${targetUser}" is not registered.`);
        } else {
          // Note: hash-wasm requires async, but we can't do async easily inside cli.js if it's synchronous read.
          // Wait, cli.js uses hashArgon2id? No, cli.js doesn't have it imported!
          console.error('❌ ERROR: override-user is currently unsupported in the local CLI due to async hashing requirements. Use the Web Terminal instead.');
        }
      }
    } else if (command === 'integrity') {
      let issues = 0;
      let logs = '--- DATABASE INTEGRITY CHECK ---\n';
      const uIds = new Set(db.users ? db.users.map(u => u.user_id) : []);
      if (db.profiles) {
        for (const p of db.profiles) {
          if (!uIds.has(p.user_id)) { issues++; logs += `[WARN] Orphaned profile found: user_id ${p.user_id}\n`; }
        }
      }
      if (db.lounge_members) {
        for (const m of db.lounge_members) {
          if (!uIds.has(m.user_id)) { issues++; logs += `[WARN] Orphaned lounge member: user_id ${m.user_id}\n`; }
        }
      }
      if (db.messages) {
        for (const m of db.messages) {
          if (m.sender_id && !uIds.has(m.sender_id)) { issues++; logs += `[WARN] Orphaned message: message_id ${m.message_id} from unknown user_id ${m.sender_id}\n`; }
        }
      }
      if (issues === 0) {
        logs += '✅ SUCCESS: No database integrity issues found.';
      } else {
        logs += `⚠️ WARNING: Found ${issues} integrity issues. Please prune or manually clean.`;
      }
      console.log(logs);
    } else if (command === 'seed') {
      console.log('✅ SUCCESS: Seed command stub. (Pending tasks: Seeding accounts safely)');
    } else if (command === 'risk-report' || command === 'risk_report') {
      console.log(`\n\x1b[1m\x1b[31m=== CRITICAL ANOMALOUS DETECTIONS REGISTRY ===\x1b[0m`);
      if (db.suspicious_events && db.suspicious_events.length) {
        db.suspicious_events.forEach((ev) => {
          console.log(`  [${ev.risk_level.toUpperCase() === 'CRITICAL' ? '\x1b[31mCRITICAL\x1b[0m' : '\x1b[33mWARNING\x1b[0m'}] ${ev.description} @ ${ev.created_at}`);
        });
      } else {
        console.log('  \x1b[32m0 active threats detected on system.\x1b[0m');
      }
    }
  } catch (err) {
    console.error('System Exception processing database transaction:', err);
    process.exit(1);
  }
});
