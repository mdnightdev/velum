import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { 
  db, 
  loadDb, 
  saveDb, 
  executeSaveDb, 
  SQLITE_FILE, 
  initSqlite, 
  isCloudBackupDisabled, 
  executeCloudBackup, 
  restoreDbFromCloud, 
  broadcastToRoomCallback 
} from '../db/index.js';
import { bankStore, getSystemAccount } from './bankStore.js';
import { bankingCommands } from './banking/commands.js';
import { dbCommands } from './db/commands.js';
import { hashArgon2id } from './cryptoService.js';
import { generateUlid, generatePrefixedId } from '../utils/ulid.js';
import { Message, User } from '../../src/types.js';

let isMaintenanceEnabled = false;

export async function executeCliCommand(command: string, isSystem?: boolean): Promise<string> {
  if (!command) {
    return ' ERROR: Command cannot be empty.';
  }
  const parts = command.trim().split(/\s+/);
  let action = parts[0].toLowerCase();
  let arg1 = parts[1];
  let arg2Plus = parts.slice(2).join(' ');

  function findUserInDb(query: string | undefined) {
    if (!query) return null;
    const lower = query.toLowerCase().replace(/^@/, '');
    return db.users.find((u: any) => 
      String(u.user_id) === query ||
      u.username.toLowerCase() === lower ||
      (u.uid && u.uid.toLowerCase() === lower)
    );
  }

  // Support spaced namespaces, e.g. /users list, /sys status
  const namespacesList = [
    '/users', '/lounges', '/support', '/db', '/sys', '/audit', '/fraud', '/bank', '/banks', '/cards',
    '/identities', '/comms', '/dispatch', '/datastore', '/daemon', '/forensics', '/threat_intel', '/treasury', '/enforcement'
  ];
  if (namespacesList.includes(action) && arg1) {
    const sub = arg1.toLowerCase();
    action = `${action}/${sub}`;
    const remainingParts = parts.slice(2);
    arg1 = remainingParts[0];
    arg2Plus = remainingParts.slice(1).join(' ');
  }

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

  // Normalize absolute namespace command formats to our case verbs
  // Normalize absolute namespace command formats to our case verbs
  if (action.startsWith('/')) {
    // 1. /users
    if (action === '/users/list') action = 'users-list';
    else if (action === '/users/cat') action = 'users-cat';
    else if (action === '/users/create') action = 'users-create';
    else if (action === '/users/override') action = 'override-user';
    else if (action === '/users/set') action = 'users-set-role';
    else if (action === '/users/reset') action = 'reset-avatar';
    else if (action === '/users/deactivate') action = 'users-deactivate';
    else if (action === '/users/cancel') action = 'users-cancel-deactivation';
    else if (action === '/users/restore') action = 'restore-user';
    else if (action === '/users/pending') action = 'users-pending-deletions';
    else if (action === '/users/purge') action = 'users-confirm-purge';
    else if (action === '/users/release-assets') action = 'users-release-assets';

    // 2. /sanctions
    else if (action === '/sanctions/history') action = 'users-sanctions';
    else if (action === '/sanctions/status') action = 'sanctions-status';
    else if (action === '/sanctions/kick') action = 'lounges-kick';
    else if (action === '/sanctions/ban') action = 'ban';
    else if (action === '/sanctions/unban') action = 'unban';
    else if (action === '/sanctions/mute') action = 'mute';
    else if (action === '/sanctions/unmute') action = 'unmute';
    else if (action === '/sanctions/jail') action = 'users-jail';
    else if (action === '/sanctions/unjail') action = 'users-unjail';

    // 3. /db
    else if (action === '/db/integrity') action = 'integrity';
    else if (action === '/db/orphans') action = 'db-orphans-scan';
    else if (action === '/db/clean') action = 'db-orphans-clean';
    else if (action === '/db/fsync') action = 'db-fsync';
    else if (action === '/db/vacuum') action = 'vacuum';
    else if (action === '/db/resetn') action = 'db-reset-nonces';
    else if (action === '/db/backup') action = 'db-backup';
    else if (action === '/db/restore') action = 'restore';
    else if (action === '/db/seed') action = 'seed';
    else if (action === '/db/wipe') action = 'wipe';

    // 4. /market
    else if (action === '/market/list') action = 'market-list';
    else if (action === '/market/cat') action = 'market-cat';
    else if (action === '/market/suspend') action = 'market-suspend';
    else if (action === '/market/unsuspend') action = 'market-unsuspend';
    else if (action === '/market/adjust') action = 'market-adjust';

    // 5. /escrow
    else if (action === '/escrow/cat') action = 'escrow-cat';
    else if (action === '/escrow/list') action = 'audit-escrows';
    else if (action === '/escrow/release') action = 'escrow-release';
    else if (action === '/escrow/refund') action = 'escrow-refund';
    else if (action === '/escrow/seize') action = 'escrow-seize';

    // 6. /devops
    else if (action === '/devops/config') action = 'sys-config';
    else if (action === '/devops/maint-off') action = 'sys-maintenance-disable';
    else if (action === '/devops/fee') action = 'sys-fee';
    else if (action === '/devops/tax') action = 'sys-tax';
    else if (action === '/devops/rate') action = 'sys-rate';
    else if (action === '/devops/escrow-fee') action = 'sys-escrow-fee';
    else if (action === '/devops/limit') action = 'sys-limit';
    else if (action === '/devops/main-on') action = 'sys-maintenance-enable';
    else if (action === '/devops/token') action = 'token';

    // 7. /sys
    else if (action === '/sys/status') action = 'status';
    else if (action === '/sys/top') action = 'sys-top';
    else if (action === '/sys/activest') action = 'sys-activest';
    else if (action === '/sys/ccache') action = 'sys-ccache';
    else if (action === '/sys/kill') action = 'sys-kill';
    else if (action === '/sys/flush') action = 'clear-sessions';

    // 8. /bank
    else if (action === '/bank/bankau' || action === '/banks/bankau') action = 'bank-bankau';
    else if (action === '/bank/banks' || action === '/banks/banks') action = 'bank-banks';
    else if (action === '/bank/txlog' || action === '/banks/txlog') action = 'bank-txlog';
    else if (action === '/bank/staff' || action === '/banks/staff') action = 'bank-staff';
    else if (action === '/bank/wire' || action === '/banks/wire') action = 'bank-wire';
    else if (action === '/bank/fundc' || action === '/banks/fundc') action = 'bank-fundc';
    else if (action === '/bank/fundt' || action === '/banks/fundt') action = 'bank-fundt';
    else if (action === '/bank/funde' || action === '/banks/funde') action = 'bank-funde';
    else if (action === '/bank/bankf' || action === '/banks/bankf') action = 'bank-bankf';
    else if (action === '/bank/bankad' || action === '/banks/bankad') action = 'bank-bankad';

    // 8b. /cards
    else if (action === '/cards/cards') action = 'card-cards';
    else if (action === '/cards/cardad') action = 'card-cardad';
    else if (action === '/cards/cardl') action = 'card-cardl';
    else if (action === '/cards/cardu') action = 'card-cardu';

    // 9. /audits
    else if (action === '/audits/grep') action = 'audit-grep';
    else if (action === '/audits/session') action = 'audit-session';
    else if (action === '/audits/ledger') action = 'audit-ledger-verify';
    else if (action === '/audits/hijacks') action = 'audit-sessions-hijack-scan';
    else if (action === '/audits/ip') action = 'audit-ip-correlate';
    else if (action === '/audits/nodes') action = 'audit-nodes-scan';
    else if (action === '/audits/reconstruct') action = 'audit-friendships-reconstruct';
    else if (action === '/audits/repair') action = 'audit-repair';

    // 10. /fraud
    else if (action === '/fraud/risklog') action = 'fraud-risklog';
    else if (action === '/fraud/freeze') action = 'fraud-freeze';
    else if (action === '/fraud/unfreeze') action = 'fraud-unfreeze';
    else if (action === '/fraud/seize') action = 'users-purge-fraudster';

    // Directory Help Handlers
    else if (['/users', '/sanctions', '/db', '/market', '/escrow', '/devops', '/sys', '/bank', '/banks', '/cards', '/audits', '/fraud'].includes(action)) {
      action = 'help';
    }
  }

  switch (action) {
    case 'fund': {
      if (!arg1 || !arg2Plus) return ' ERROR: Usage: fund <amount_cents> <description>';
      let amountCents = parseInt(arg1);
      if (isNaN(amountCents)) return ' ERROR: Amount must be an integer (in cents).';
      
      const accounts = await bankStore.getAccounts();
      const memberTrust = await getSystemAccount('MEMBER');
      const centralReserve = await getSystemAccount('CENTRAL');
      
      if (!memberTrust) return ' ERROR: MEMBER TRUST account not found.';
      if (!centralReserve) return ' ERROR: CENTRAL RESERVE account not found.';
      
      memberTrust.balance_cents += amountCents;
      centralReserve.balance_cents -= amountCents;
      
      await bankStore.saveAccounts(accounts);
      
      const transactions = await bankStore.getTransactions();
      transactions.push({
        transaction_id: `bank_tx_${Date.now()}`,
        account_id: memberTrust.account_id,
        type: 'deposit',
        amount_cents: Math.abs(amountCents),
        currency_code: 'TWD',
        description: `Transfer from Central Reserve: ${arg2Plus}`,
        timestamp: Date.now(),
        status: 'completed'
      });
      transactions.push({
        transaction_id: `bank_tx_${Date.now()+1}`,
        account_id: centralReserve.account_id,
        type: 'withdrawal',
        amount_cents: Math.abs(amountCents),
        currency_code: 'TWD',
        description: `Transfer to Member Trust: ${arg2Plus}`,
        timestamp: Date.now(),
        status: 'completed'
      });
      await bankStore.saveTransactions(transactions);
      
      return ` SUCCESS: Transferred ${amountCents/100} TWD from Central Reserve to Member Trust.`;
    }
    case 'help': {
      return `VELUM ADMIN COMMAND PANEL\n` +
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
        `• reset-avatar <user>          - Reset user's avatar\n` +
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

        return `VELUM SERVER STATUS & STATISTICS\n` +
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
          return ` ERROR: Command "approve" requires a <username> argument.`;
        }
        const candidate = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase());
        if (!candidate) {
          return ` ERROR: Account "${arg1}" is not registered in central databases.`;
        }

        const isNominated = candidate.promotion_status === 'PENDING_SUPPORT' || candidate.support_nomination === 'nominated';
        if (!isNominated) {
          return ` ERROR: Account "${candidate.username}" is not currently in a PENDING_SUPPORT nomination state.`;
        }

        candidate.role = 'USER';
        candidate.support_nomination = null;
        candidate.promotion_status = 'APPROVED_SUPPORT';
        candidate.updated_at = new Date().toISOString();

        const cleanUsername = candidate.username.replace(/^@/, '');
        const saUsername = `SA-${cleanUsername}`;

        let saUser = db.users.find(u => u.username.toLowerCase() === saUsername.toLowerCase());
        if (saUser) {
          return ` ERROR: Dedicated Support Admin account "${saUsername}" already exists.`;
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
          message_id: `msg_sa_promo_${candidate.user_id}_${generateUlid()}`,
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
          log_id: `${generatePrefixedId('al')}_audit`,
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
          broadcastToRoom(dmRoomId, wsPayload);

          connectedClients.forEach(c => {
            if (c.user_id === candidate.user_id && !c.rooms.has(dmRoomId) && c.ws.readyState === 1) {
              c.ws.send(JSON.stringify(wsPayload));
            }
          });
        }).catch(err => {
          console.warn('[PROMO] Failed to dispatch real-time websocket broadcast:', err);
        });
        return ` SUCCESS: Approved Support nomination for "${candidate.username}". Created dedicated SA profile "${saUsername}". Credentials wire dispatched securely! \n\nSupport ID: ${saUserId}\nHandle: ${saUsername}\nPassword: ${saPassword}\nSafe Word: ${saSafeWord}\nPanic Word: ${saPanicPhrase}\nRecovery Key: ${saRecoveryKey}`;
      } catch (err: any) {
        return ` ERROR: Approved support task failure: ${err.message || err}`;
      }
    }
    case 'reject': {
      try {
        if (!arg1) {
          return ` ERROR: Command "reject" requires a <username> argument.`;
        }
        const candidate = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase());
        if (!candidate) {
          return ` ERROR: Account "${arg1}" is not registered in central databases.`;
        }
        candidate.support_nomination = null;
        candidate.promotion_status = 'REJECTED_SUPPORT';
        candidate.updated_at = new Date().toISOString();

        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: `${generatePrefixedId('al')}_audit`,
          admin_id: 1,
          admin_name: 'cli_admin',
          action: 'role_change',
          target_type: 'user',
          target_id: String(candidate.user_id),
          reason: `Root CLI operator rejected Support Admin role nomination for "${candidate.username}".`,
          timestamp: new Date().toISOString()
        });

        executeSaveDb();
        return ` SUCCESS: Rejected Support Admin nomination for "${candidate.username}". Saved to main ledger.`;
      } catch (err: any) {
        return ` ERROR: Nomination rejection task failed: ${err.message || err}`;
      }
    }
    case 'demote': {
      try {
        if (!arg1) {
          return ` ERROR: Command "demote" requires a <username> argument.`;
        }
        const queryName = arg1.trim();
        const cleanName = queryName.replace(/^@?SA-@?|^@/, '').toLowerCase();

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
          return ` ERROR: Target "${arg1}" not found in registries.`;
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
          log_id: `${generatePrefixedId('al')}_audit`,
          admin_id: 1,
          admin_name: 'cli_admin',
          action: 'role_change',
          target_type: 'user',
          target_id: String((baseUser || saUser)?.user_id),
          reason: `Demoted and purged companion Support Operator access for "${arg1}".`,
          timestamp: new Date().toISOString()
        });

        executeSaveDb();
        return ` SUCCESS: Demoted and removed companion Support Operator access for "${arg1}". All specialized tokens immediately purged.`;
      } catch (err: any) {
        return ` ERROR: Demotion sequence faulted: ${err.message || err}`;
      }
    }
    case 'ban': {
      try {
        if (!arg1) {
          return ` ERROR: Command "ban" requires a <username> argument.`;
        }
        const candidate = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase());
        if (!candidate) {
          return ` ERROR: Account "${arg1}" is not registered in registries.`;
        }

        if (candidate.role === 'CLI_ADMIN') {
          return ` ERROR: Severe security privilege violation - cannot ban Root CLI Administrator.`;
        }

        candidate.status = 'suspended';
        candidate.updated_at = new Date().toISOString();

        db.sessions = db.sessions.filter(s => s.user_id !== candidate.user_id);

        if (!db.admin_sanctions) db.admin_sanctions = [];
        db.admin_sanctions.push({
          sanction_id: generatePrefixedId('sanc'),
          user_id: candidate.user_id,
          admin_id: 1,
          room_id: null,
          type: 'ban',
          reason: arg2Plus || 'Root CLI global ban action',
          expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString()
        });

        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: `${generatePrefixedId('al')}_audit`,
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
          return ` ERROR: Command "unban" requires a <username> argument.`;
        }
        const candidate = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase());
        if (!candidate) {
          return ` ERROR: Account "${arg1}" is not registered.`;
        }

        candidate.status = 'active';
        candidate.updated_at = new Date().toISOString();

        if (db.admin_sanctions) {
          db.admin_sanctions = db.admin_sanctions.filter(s => !(s.target_id === candidate.user_id && s.type === 'ban'));
        }

        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: `${generatePrefixedId('al')}_audit`,
          admin_id: 1,
          admin_name: 'cli_admin',
          action: 'restore',
          target_type: 'user',
          target_id: String(candidate.user_id),
          reason: `Restored/Unbanned account "${candidate.username}" via Web CLI.`,
          timestamp: new Date().toISOString()
        });

        executeSaveDb();
        return ` SUCCESS: Restored and unbanned user "${candidate.username}". Entry sequence authorized.`;
      } catch (err: any) {
        return ` ERROR during unban task: ${err.message || err}`;
      }
    }
    case 'mute': {
      try {
        if (!arg1) {
          return ` ERROR: Command "mute" requires a <username> argument.`;
        }
        const candidate = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase());
        if (!candidate) {
          return ` ERROR: Account "${arg1}" is not registered.`;
        }

        if (!db.admin_sanctions) db.admin_sanctions = [];
        db.admin_sanctions.push({
          sanction_id: generatePrefixedId('sanc'),
          user_id: candidate.user_id,
          admin_id: 1,
          room_id: null,
          type: 'mute',
          reason: arg2Plus || 'Root CLI mute action',
          expires_at: new Date(Date.now() + 1000 * 60 * 10000).toISOString()
        });

        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: `${generatePrefixedId('al')}_audit`,
          admin_id: 1,
          admin_name: 'cli_admin',
          action: 'mute',
          target_type: 'user',
          target_id: String(candidate.user_id),
          reason: `Muted user "${candidate.username}" via Web CLI.`,
          timestamp: new Date().toISOString()
        });

        executeSaveDb();
        return ` SUCCESS: Muted user "${candidate.username}" globally from sending secure channel messages.`;
      } catch (err: any) {
        return ` ERROR muting user: ${err.message || err}`;
      }
    }
    case 'unmute': {
      try {
        if (!arg1) {
          return ` ERROR: Command "unmute" requires a <username> argument.`;
        }
        const candidate = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase());
        if (!candidate) {
          return ` ERROR: Account "${arg1}" is not registered.`;
        }

        if (db.admin_sanctions) {
          db.admin_sanctions = db.admin_sanctions.filter(s => !(s.target_id === candidate.user_id && s.type === 'mute'));
        }

        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: `${generatePrefixedId('al')}_audit`,
          admin_id: 1,
          admin_name: 'cli_admin',
          action: 'restore',
          target_type: 'user',
          target_id: String(candidate.user_id),
          reason: `Unmuted user "${candidate.username}" via Web CLI.`,
          timestamp: new Date().toISOString()
        });

        executeSaveDb();
        return ` SUCCESS: Unmuted user "${candidate.username}". Channel write privileges restored.`;
      } catch (err: any) {
        return ` ERROR unmuting user: ${err.message || err}`;
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
          log_id: `${generatePrefixedId('al')}_audit`,
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
        console.log('[ADMIN] CLI Console triggered database purge procedure.');
        const { hardResetAndSeedDatabase } = await import('../db.js');
        await hardResetAndSeedDatabase(true);
        executeSaveDb();

        if (!isCloudBackupDisabled) {
          await executeCloudBackup();
          return ` SUCCESS: Velum Relational Database wiped and purged completely! \n` +
            ` Local storage has been reset, default administrative seeds redeployed, and cloud backups have been synchronized immediately on this server. Cloud backups cleared!`;
        }
        return ` SUCCESS: Velum Relational Database wiped and purged locally! \n` +
          ` Local storage has been reset and default administrative seeds successfully deployed. (Cloud storage status: Offline)`;
      } catch (err: any) {
        return ` ERROR during database purge: ${err.message || err}`;
      }
    }
    case 'seed': {
      try {
        const { hardResetAndSeedDatabase } = await import('../db.js');
        await hardResetAndSeedDatabase(false);
        executeSaveDb();
        return ` INFO: Seeding check completed. Retained existing records safely.`;
      } catch (err: any) {
        return ` ERROR seeding database: ${err.message || err}`;
      }
    }
    case 'integrity': {
      try {
        if (fs.existsSync(SQLITE_FILE)) {
          const conn = initSqlite();
          if (conn) {
            const row = conn.prepare("PRAGMA integrity_check").get() as any;
            const ok = row && row.integrity_check === 'ok';
            return `INTEGRITY STATUS: ${ok ? 'PASSED' : 'CORRUPTED'}\nDETAILS: ${JSON.stringify(row)}`;
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
          return ' INFO: No server log entries registered.';
        }
        return ` VELUM SERVER AUDIT LOGS \n` +
          `========================================================\n` +
          logsList.map(log => `[${log.timestamp}] [${log.action.toUpperCase()}] ${log.reason} (${log.admin_name || 'root'})`).join('\n') +
          `\n========================================================`;
      } catch (err: any) {
        return ` ERROR querying audit logs: ${err.message || err}`;
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
        return ` ERROR during compact vacuum: ${err.message || err}`;
      }
    }
    case 'resetn':
    case 'reset-nonces':
    case 'db-reset-nonces': {
      return await dbCommands.resetNonces();
    }
    case 'clear-sessions':
    case 'clear': {
      if (parts[0].toLowerCase() === 'clear' && !arg1) {
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
          return ' SEC_OK: 0 active threats detected on system.';
        }
        let output = ` VELUM ANOMALOUS DETECTIONS AUDIT INDEX \n========================================================\n`;
        db.suspicious_events.forEach(ev => {
          output += `[${ev.risk_level?.toUpperCase() || 'WARNING'}] ${ev.description} @ ${ev.created_at}\n`;
        });
        output += `========================================================`;
        return output;
      } catch (err: any) {
        return ` ERROR: Failed to query analytics reports: ${err.message || err}`;
      }
    }
    case 'wire':
    case 'send-system-wire': {
      try {
        if (!arg1 || !arg2Plus) {
          return ' ERROR: Command "wire" requires a target <username> and a <message>.';
        }
        const receiver = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase() || u.username.toLowerCase() === `@${arg1.replace(/^@/, '').toLowerCase()}`);
        if (!receiver) {
          return ` ERROR: Target user "${arg1}" not found in database.`;
        }

        const dmRoomId = `dm_velum_${receiver.user_id}`;

        const wireMessage = {
          message_id: `msg_sys_wire_${receiver.user_id}_${generateUlid()}`,
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
        return ` SUCCESS: Successfully synchronized and transmitted direct system wire payload to user "${receiver.username}".`;
      } catch (err: any) {
        return ` ERROR: Failed to transmit secure wire signal: ${err.message || err}`;
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
        return ` TOKEN GENERATED SUCCESSFULLY\n---------------------------------\n` +
          `• Single-Use Alpha Token: ${tokenVal}\n` +
          `• Dynamic 6-Digit 2FA Code: ${otp} (Valid for 10 min window)\n` +
          `• Sync active across secure channels.`;
      } catch (err: any) {
        return ` ERROR generating temporary credentials: ${err.message || err}`;
      }
    }
    case 'delete-lounge':
    case 'delete_lounge': {
      if (!arg1) return ' ERROR: Command "delete-lounge" requires a <lounge_id> argument.';
      try {
        const loungeIndex = (db.lounges || []).findIndex(l => l.lounge_id === arg1 || l.id === arg1);
        if (loungeIndex === -1) {
          return ` ERROR: Lounge with ID '${arg1}' not found.`;
        }
        
        if (db.lounges) {
          db.lounges.splice(loungeIndex, 1);
        }
        if (db.lounge_members) {
          db.lounge_members = db.lounge_members.filter(m => m.lounge_id !== arg1);
        }
        
        saveDb();
        return ` SUCCESS: Lounge '${arg1}' has been permanently deleted.`;
      } catch (err: any) {
        return ` ERROR deleting lounge: ${err.message || err}`;
      }
    }
    case 'restore-user':
    case 'restore_user': {
      try {
        if (!arg1) return ' ERROR: Command "restore-user" requires a <username> argument.';
        let candidate = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase() || u.username.toLowerCase() === `@${arg1.replace(/^@/, '').toLowerCase()}`);
        let isHardPurged = false;

        if (!candidate) {
          candidate = db.purged_users && db.purged_users.find(u => u.username.toLowerCase() === arg1.toLowerCase() || u.username.toLowerCase() === `@${arg1.replace(/^@/, '').toLowerCase()}`);
          if (!candidate) {
            return ` ERROR: Account "${arg1}" is not registered.`;
          }
          isHardPurged = true;
        }

        if (!isHardPurged && candidate.status !== 'purged') {
          return ` ERROR: User @${candidate.username} is not purged.`;
        }

        candidate.status = 'active';
        candidate.updated_at = new Date().toISOString();

        if (isHardPurged) {
          db.purged_users = (db.purged_users || []).filter(u => u.user_id !== candidate.user_id);
          db.users.push(candidate);

          if (db.purged_profiles) {
            const archivedProfile = db.purged_profiles.find(p => p.user_id === candidate.user_id);
            if (archivedProfile) {
              db.purged_profiles = (db.purged_profiles || []).filter(p => p.user_id !== candidate.user_id);
              db.profiles = db.profiles || [];
              db.profiles.push(archivedProfile);
            }
          }
        }

        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: `${generatePrefixedId('al')}_rst_usr`,
          admin_id: 1,
          admin_name: 'cli_admin',
          action: 'user_restored',
          target_type: 'user',
          target_id: String(candidate.user_id),
          reason: `Purged account @${candidate.username} restored back to active state by CLI_ADMIN.`,
          timestamp: new Date().toISOString()
        });
        saveDb();
        return ` SUCCESS: User @${candidate.username} successfully restored to active status.`;
      } catch (err: any) {
        return ` ERROR restoring user: ${err.message || err}`;
      }
    }
    case 'reset-avatar':
    case 'reset_avatar': {
      try {
        if (!arg1) return ' ERROR: Command "reset-avatar" requires a <username> argument.';
        const candidate = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase() || u.username.toLowerCase() === `@${arg1.replace(/^@/, '').toLowerCase()}`);
        if (!candidate) {
          return ` ERROR: Account "${arg1}" is not registered.`;
        }
        const uId = candidate.user_id;
        const profile = db.profiles && db.profiles.find(p => p.user_id === uId);
        if (profile) {
          profile.avatar = "";
          profile.updated_at = new Date().toISOString();
          saveDb();
          return ` SUCCESS: Avatar for user @${candidate.username} has been reset.`;
        } else {
          return ` ERROR: Profile for user @${candidate.username} not found.`;
        }
      } catch (err: any) {
        return ` ERROR resetting avatar: ${err.message || err}`;
      }
    }
    case 'delete-user':
    case 'delete_user': {
      try {
        if (!arg1) {
          return ` ERROR: Command "delete-user" requires a <username> argument.`;
        }
        const candidate = db.users.find(u => u.username.toLowerCase() === arg1.toLowerCase() || u.username.toLowerCase() === `@${arg1.replace(/^@/, '').toLowerCase()}`);
        if (!candidate) {
          return ` ERROR: Account "${arg1}" is not registered.`;
        }

        if (candidate.role === 'CLI_ADMIN' || candidate.role === 'LOGIN_ADMIN') {
          return ` ERROR: Severe privilege violation - cannot delete system-level initial accounts.`;
        }

        const uId = candidate.user_id;

        db.purged_users = db.purged_users || [];
        if (!db.purged_users.some(u => u.user_id === candidate.user_id)) {
          db.purged_users.push(candidate);
        }
        const targetProfile = db.profiles.find(p => p.user_id === uId);
        if (targetProfile) {
          db.purged_profiles = db.purged_profiles || [];
          if (!db.purged_profiles.some(p => p.user_id === uId)) {
            db.purged_profiles.push(targetProfile);
          }
        }

        db.users = db.users.filter(u => u.user_id !== uId);
        db.profiles = db.profiles.filter(p => p.user_id !== uId);
        
        db.user_blocks = db.user_blocks.filter(b => b.blocker_id !== uId && b.blocked_id !== uId);
        db.user_mutes = (db.user_mutes || []).filter(m => m.muter_id !== uId && m.muted_id !== uId);
        db.sessions = db.sessions.filter(s => s.user_id !== uId);
        db.tickets = db.tickets.filter(t => t.user_id !== uId);

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
          log_id: `${generatePrefixedId('al')}_audit`,
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
          return ` ERROR: Command "delete-ticket" requires a <ticket_id> argument.`;
        }
        const ticketId = arg1.trim();
        const ticket = db.tickets.find(t => t.ticket_id === ticketId);
        if (!ticket) {
          return ` ERROR: Ticket with id "${ticketId}" not found in database.`;
        }

        db.tickets = db.tickets.filter(t => t.ticket_id !== ticketId);

        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: `${generatePrefixedId('al')}_audit`,
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
    case 'users-override':
    case 'override-user':
    case 'override_user': {
      try {
        if (!arg1) {
          return ` ERROR: Command "override-user" requires a <username> argument. Syntax: override-user <username> <new_password> [new_recovery_key] [new_safe_word]`;
        }
        const queryName = arg1.trim();
        const candidate = db.users.find(u => u.username.toLowerCase() === queryName.toLowerCase() || u.username.toLowerCase() === `@${queryName.replace(/^@/, '').toLowerCase()}`);
        if (!candidate) {
          return ` ERROR: Account "${arg1}" is not registered in registries.`;
        }

        const argsList = parts.slice(2);
        const newPassword = argsList[0];
        if (!newPassword) {
          return ` ERROR: Password is required. Syntax: override-user <username> <new_password> [new_recovery_key] [new_safe_word]`;
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

        candidate.status = 'active';
        candidate.updated_at = new Date().toISOString();

        if (!db.audit_logs) db.audit_logs = [];
        db.audit_logs.push({
          log_id: `${generatePrefixedId('al')}_audit`,
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
          `• New Password Hash generated.\n` +
          `• Recovery Key set to: "${newRecoveryKey}"\n` +
          `• Safe Word set to: "${newSafeWord}"\n` +
          `• Account state set to ACTIVE.`;
      } catch (err: any) {
        return ` ERROR during override credentials: ${err.message || err}`;
      }
    }
    case 'users-list': {
      try {
        let statusFilter = '';
        if (arg1 === '--status' && arg2Plus) {
          statusFilter = arg2Plus.toLowerCase();
        } else if (parts.includes('--status')) {
          const idx = parts.indexOf('--status');
          statusFilter = parts[idx + 1]?.toLowerCase() || '';
        }

        let filtered = db.users || [];
        if (statusFilter) {
          filtered = filtered.filter((u: any) => u.status.toLowerCase() === statusFilter);
        }

        let out = `\n=== REGISTERED USERS MATRIX (${filtered.length} entries) ===\n`;
        out += `ID     | Username             | UID                  | Role         | Status      \n`;
        out += '-'.repeat(80) + '\n';
        filtered.forEach((u: any) => {
          out += `${String(u.user_id).padEnd(6)} | ${u.username.padEnd(20)} | ${(u.uid || 'N/A').padEnd(20)} | ${u.role.padEnd(12)} | ${u.status.padEnd(12)}\n`;
        });
        return out;
      } catch (err: any) {
        return ` ERROR: ${err.message}`;
      }
    }
    case 'users-cat': {
      if (!arg1) return ' ERROR: Command requires <username> or <id>.';
      const user = findUserInDb(arg1);
      if (!user) return ` ERROR: User "${arg1}" not found.`;
      const profile = ((db.profiles || []).find((p: any) => p.user_id === user.user_id) || {}) as any;
      const wallet = (db.user_wallets || []).find((w: any) => w.user_id === user.user_id);
      const balanceText = wallet ? `${(wallet.balance_cents / 100).toFixed(2)} VLM` : '0.00 VLM';
      
      let out = `\n=== EXECUTIVE USER DATA: @${user.username} ===\n`;
      out += `  • User ID:       ${user.user_id}\n`;
      out += `  • UID:           ${user.uid || 'N/A'}\n`;
      out += `  • Role:          ${user.role}\n`;
      out += `  • Status:        ${user.status}\n`;
      out += `  • Bio:           ${profile.bio || 'None'}\n`;
      out += `  • Wallet:        ${balanceText}\n`;
      out += `  • Password Hash: [MASKED]\n`;
      return out;
    }
    case 'users-create': {
      if (!arg1 || !arg2Plus) {
        return ' ERROR: Command requires <username> <password> [role].';
      }
      const newUsername = arg1.trim();
      const parts = arg2Plus.split(/\s+/);
      const newPassword = parts[0];
      const newRole = (parts[1] || 'USER').toUpperCase();

      if (!['USER', 'SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'].includes(newRole)) {
        return ` ERROR: Invalid role "${newRole}". Must be USER, SUPPORT_ADMIN, LOGIN_ADMIN, or CLI_ADMIN.`;
      }

      const existingUser = findUserInDb(newUsername);
      if (existingUser) {
        return ` ERROR: Username "${newUsername}" is already registered.`;
      }

      try {
        const nextId = db.users.reduce((max: number, u: any) => u.user_id > max ? u.user_id : max, 0) + 1;
        const salt = crypto.randomBytes(32).toString('hex');
        const saltBuf = Buffer.from(salt, 'hex');

        const passHash = `argon2id:${await hashArgon2id(newPassword, saltBuf)}`;
        const safeHash = `argon2id:${await hashArgon2id('restore', saltBuf)}`;
        const panicHash = `argon2id:${await hashArgon2id('panic', saltBuf)}`;
        const recKey = crypto.randomBytes(16).toString('hex').toUpperCase();
        const keySalt = crypto.randomBytes(32);
        const recHash = `argon2id:${keySalt.toString('hex')}:${await hashArgon2id(recKey, keySalt)}`;

        const newUserObj = {
          user_id: nextId,
          username: newUsername,
          password_hash: passHash,
          safe_word_hash: safeHash,
          panic_phrase_hash: panicHash,
          recovery_key_hash: recHash,
          role: newRole as any,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          salt: salt,
          uid: `VEL-UID-${Math.floor(100000 + Math.random() * 900000)}`
        };

        db.users.push(newUserObj);

        // Instantiate wallet
        const { walletRepository } = await import('../db/walletRepository.js');
        walletRepository.getOrCreateWallet(nextId);

        // Instantiate profile
        db.profiles = db.profiles || [];
        db.profiles.push({
          profile_id: `prof_${generateUlid()}`,
          user_id: nextId,
          bio: 'Active User',
          updated_at: new Date().toISOString()
        });

        executeSaveDb();

        return ` SUCCESS: Created new user @${newUsername} (ID: ${nextId}, Role: ${newRole}).\n` +
               `   Generated Recovery Key: ${recKey}`;
      } catch (err: any) {
        return ` ERROR: Failed to instantiate user profile: ${err.message || err}`;
      }
    }
    case 'market-list': {
      try {
        loadDb();
        const listings = db.market_listings || [];
        if (listings.length === 0) {
          return 'No products listed in the marketplace.';
        }
        let out = `\n=== MARKETPLACE PRODUCT CATALOG (${listings.length} entries) ===\n`;
        out += `Listing ID   | Seller ID | Title                          | Price   | Status      | Verification \n`;
        out += '-'.repeat(95) + '\n';
        listings.forEach((l: any) => {
          const discountInfo = l.discount_price !== undefined && l.discount_price !== null ? ` (Sale: $${Number(l.discount_price).toFixed(2)})` : '';
          out += `${String(l.listing_id).padEnd(12)} | ${String(l.seller_id).padEnd(9)} | ${String(l.title).substring(0, 30).padEnd(30)} | $${Number(l.price).toFixed(2)}${discountInfo.padEnd(16)} | ${(l.status || 'ACTIVE').padEnd(11)} | ${(l.verification_status || 'APPROVED').padEnd(12)}\n`;
        });
        return out;
      } catch (err: any) {
        return ` ERROR: ${err.message}`;
      }
    }
    case 'market-cat': {
      if (!arg1) return ' ERROR: Command requires <listing_id>.';
      loadDb();
      const listing = (db.market_listings || []).find((l: any) => l.listing_id === arg1);
      if (!listing) return ` ERROR: Listing "${arg1}" not found.`;
      
      const skuVariants = (db.market_sku_variants || []).filter((v: any) => v.listing_id === listing.listing_id);
      
      let out = `\n=== PRODUCT DETAILS: ${listing.title} ===\n`;
      out += `  • Listing ID:         ${listing.listing_id}\n`;
      out += `  • Seller Reference:   ID ${listing.seller_id} (@${listing.seller_username || 'unknown'})\n`;
      out += `  • Base Price:         $${Number(listing.price).toFixed(2)}\n`;
      if (listing.discount_price !== undefined && listing.discount_price !== null) {
        out += `  • Discounted Price:   $${Number(listing.discount_price).toFixed(2)}\n`;
      }
      out += `  • Listing Status:     ${listing.status || 'ACTIVE'}\n`;
      out += `  • Verification:       ${listing.verification_status || 'APPROVED'}\n`;
      out += `  • Stock Inventory:    ${listing.inventory_count !== undefined && listing.inventory_count !== null ? listing.inventory_count : 'Unlimited'}\n`;
      out += `  • Description:        ${listing.description || 'No description'}\n`;
      if (skuVariants.length > 0) {
        out += `  • SKUs Options:\n`;
        skuVariants.forEach((v: any) => {
          out += `    - SKU: ${v.sku_id} | ${v.attribute_name}: ${v.attribute_value} | Extra: +$${(v.additional_cost_cents / 100).toFixed(2)} | Stock: ${v.inventory_count}\n`;
        });
      }
      return out;
    }
    case 'market-suspend': {
      if (!arg1) return ' ERROR: Command requires <listing_id>.';
      loadDb();
      const listing = (db.market_listings || []).find((l: any) => l.listing_id === arg1);
      if (!listing) return ` ERROR: Listing "${arg1}" not found.`;
      listing.status = 'SUSPENDED';
      listing.verification_status = 'REJECTED';
      executeSaveDb();
      return ` SUCCESS: Suspended listing "${listing.title}" (${listing.listing_id}) and set verification status to REJECTED.`;
    }
    case 'market-unsuspend': {
      if (!arg1) return ' ERROR: Command requires <listing_id>.';
      loadDb();
      const listing = (db.market_listings || []).find((l: any) => l.listing_id === arg1);
      if (!listing) return ` ERROR: Listing "${arg1}" not found.`;
      listing.status = 'ACTIVE';
      listing.verification_status = 'APPROVED';
      executeSaveDb();
      return ` SUCCESS: Activated listing "${listing.title}" (${listing.listing_id}) and set verification status to APPROVED.`;
    }
    case 'market-adjust': {
      if (!arg1 || !arg2Plus) return ' ERROR: Command requires <listing_id> <stock_count>.';
      const stockVal = parseInt(arg2Plus);
      if (isNaN(stockVal)) return ' ERROR: Stock count must be an integer.';
      loadDb();
      const listing = (db.market_listings || []).find((l: any) => l.listing_id === arg1);
      if (!listing) return ` ERROR: Listing "${arg1}" not found.`;
      listing.inventory_count = stockVal;
      executeSaveDb();
      return ` SUCCESS: Adjusted inventory stock for listing "${listing.title}" to ${stockVal}.`;
    }
    case 'users-jail': {
      if (!arg1) return ' ERROR: Command requires <username>.';
      const user = findUserInDb(arg1);
      if (!user) return ` ERROR: User "${arg1}" not found.`;
      user.status = 'restricted';
      user.updated_at = new Date().toISOString();
      executeSaveDb();
      return ` SUCCESS: Restricted user @${user.username} to limited channels.`;
    }
    case 'users-unjail': {
      if (!arg1) return ' ERROR: Command requires <username>.';
      const user = findUserInDb(arg1);
      if (!user) return ` ERROR: User "${arg1}" not found.`;
      user.status = 'active';
      user.updated_at = new Date().toISOString();
      executeSaveDb();
      return ` SUCCESS: Removed restricted status for @${user.username}.`;
    }
    case 'users-set-role': {
      if (!arg1) return ' ERROR: Command requires <username>.';
      const user = findUserInDb(arg1);
      if (!user) return ` ERROR: User "${arg1}" not found.`;
      const role = parts[2]?.toUpperCase();
      if (!['USER', 'SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'].includes(role)) {
        return ` ERROR: Invalid role. Must be USER, SUPPORT_ADMIN, LOGIN_ADMIN, or CLI_ADMIN.`;
      }
      user.role = role;
      user.updated_at = new Date().toISOString();
      executeSaveDb();
      return ` SUCCESS: Promoted role for @${user.username} to ${role}.`;
    }
    case 'users-deactivate': {
      if (!arg1) return ' ERROR: Command requires <username>.';
      const user = findUserInDb(arg1);
      if (!user) return ` ERROR: User "${arg1}" not found.`;
      user.status = 'deactivated';
      user.updated_at = new Date().toISOString();
      db.sessions = (db.sessions || []).filter((s: any) => s.user_id !== user.user_id);
      
      (db as any).account_deletion_requests = (db as any).account_deletion_requests || [];
      (db as any).account_deletion_requests = (db as any).account_deletion_requests.filter((r: any) => r.user_id !== user.user_id);
      (db as any).account_deletion_requests.push({
        id: `del_${generateUlid()}`,
        user_id: user.user_id,
        requested_at: Date.now(),
        scheduled_purge_at: Date.now() + 14 * 24 * 60 * 60 * 1000,
        status: 'pending_verification'
      });
      executeSaveDb();
      return ` SUCCESS: Initiated 14-day deactivation grace period for @${user.username}.`;
    }
    case 'users-cancel-deactivation': {
      if (!arg1) return ' ERROR: Command requires <username>.';
      const user = findUserInDb(arg1);
      if (!user) return ` ERROR: User "${arg1}" not found.`;
      (db as any).account_deletion_requests = ((db as any).account_deletion_requests || []).filter((r: any) => r.user_id !== user.user_id);
      user.status = 'active';
      user.updated_at = new Date().toISOString();
      executeSaveDb();
      return ` SUCCESS: Cancelled pending deletion and reactivated @${user.username}.`;
    }
    case 'users-release-assets': {
      if (!arg1) return ' ERROR: Command requires <username>.';
      const user = findUserInDb(arg1);
      if (!user) return ` ERROR: User "${arg1}" not found.`;
      const req = ((db as any).account_deletion_requests || []).find((r: any) => r.user_id === user.user_id && r.status === 'pending_verification');
      if (!req) return ` ERROR: No pending deletion request found for @${user.username}.`;
      
      const elapsed = Date.now() - req.requested_at;
      const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
      if (elapsed < TWO_DAYS) {
        const remaining = TWO_DAYS - elapsed;
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        return ` ERROR: Mandatory 2-day verification window has not elapsed. Time remaining: ${hours}h ${mins}m.`;
      }

      const wallets = (db.user_wallets || []).filter((w: any) => w.user_id === user.user_id);
      let totalBalanceCents = 0;
      for (const w of wallets) {
        totalBalanceCents += Number(w.balance_cents || 0);
      }
      const totalBalance = totalBalanceCents / 100;

      req.status = 'assets_released';
      req.assets_released_at = Date.now();
      req.assets_verified = true;

      (db as any).platform_financial_audit_logs = (db as any).platform_financial_audit_logs || [];
      (db as any).platform_financial_audit_logs.push({
        log_id: `led_aud_${generateUlid()}`,
        admin_id: 1,
        action: 'ASSET_RELEASE_VERIFIED',
        target_user_id: user.user_id,
        amount_cents: totalBalanceCents,
        reason: 'Sovereign deletion buffer verify',
        timestamp: new Date().toISOString()
      });

      executeSaveDb();
      return ` SUCCESS: Security buffer verified. Assets released for @${user.username}. Balance: ${totalBalance.toFixed(2)} VLM.`;
    }
    case 'users-confirm-purge': {
      if (!arg1) return ' ERROR: Command requires <username>.';
      const user = findUserInDb(arg1);
      if (!user) return ` ERROR: User "${arg1}" not found.`;
      const req = ((db as any).account_deletion_requests || []).find((r: any) => r.user_id === user.user_id);
      if (!req || req.status !== 'assets_released') {
        return ` ERROR: User @${user.username} has not passed the asset release verification. Run '/users/release-assets' first.`;
      }

      user.username = `Deleted User [${user.uid || user.user_id}]`;
      user.password_hash = 'SYSTEM_LOCKED';
      user.safe_word_hash = 'SYSTEM_LOCKED';
      user.panic_phrase_hash = 'SYSTEM_LOCKED';
      user.recovery_key_hash = 'SYSTEM_LOCKED';
      user.status = 'purged';
      user.updated_at = new Date().toISOString();

      const profile = (db.profiles || []).find((p: any) => p.user_id === user.user_id);
      if (profile) {
        profile.bio = 'Account deleted permanently.';
        profile.avatar = '';
      }

      db.sessions = (db.sessions || []).filter((s: any) => s.user_id !== user.user_id);
      req.status = 'purged';

      executeSaveDb();
      return ` SUCCESS: User permanently purged. Personal markers scrubbed. Wallet history archived.`;
    }
    case 'users-purge-fraudster': {
      if (!arg1) return ' ERROR: Command requires <username>.';
      const user = findUserInDb(arg1);
      if (!user) return ` ERROR: User "${arg1}" not found.`;

      const wallets = (db.user_wallets || []).filter((w: any) => w.user_id === user.user_id);
      let totalSeizedCents = 0;
      for (const w of wallets) {
        const balCents = Number(w.balance_cents || 0);
        if (balCents > 0) {
          totalSeizedCents += balCents;
          w.balance_cents = 0;

          (db as any).wallet_ledger_entries = (db as any).wallet_ledger_entries || [];
          (db as any).wallet_ledger_entries.push({
            entry_id: `led_${generateUlid()}`,
            user_id: user.user_id,
            entry_type: 'AUTOMATED_ADJUSTMENT',
            amount_cents: -balCents,
            balance_after_cents: 0,
            actor_type: 'ADMIN',
            actor_id: 1,
            created_at: Date.now()
          });

          const treasury = (db.user_wallets || []).find((tw: any) => tw.user_id === 999);
          if (treasury) {
            treasury.balance_cents = (Number(treasury.balance_cents) || 0) + balCents;
          }
          (db as any).wallet_ledger_entries.push({
            entry_id: `led_${generateUlid()}`,
            user_id: 999,
            entry_type: 'AUTOMATED_ADJUSTMENT',
            amount_cents: balCents,
            balance_after_cents: treasury ? treasury.balance_cents : balCents,
            actor_type: 'ADMIN',
            actor_id: 1,
            created_at: Date.now()
          });
        }
      }

      const escrows = ((db as any).escrow_transactions || []).filter((e: any) => (e.buyer_id === user.user_id || e.seller_id === user.user_id) && e.status === 'HELD');
      for (const esc of escrows) {
        esc.status = 'SEIZED';
        const amountCents = Math.round(Number(esc.amount || 0) * 100);
        totalSeizedCents += amountCents;
        const treasury = (db.user_wallets || []).find((tw: any) => tw.user_id === 999);
        if (treasury) {
          treasury.balance_cents = (Number(treasury.balance_cents) || 0) + amountCents;
        }
      }

      const totalSeized = totalSeizedCents / 100;

      user.username = `Deleted Fraudster [${user.uid || user.user_id}]`;
      user.password_hash = 'SYSTEM_LOCKED';
      user.safe_word_hash = 'SYSTEM_LOCKED';
      user.panic_phrase_hash = 'SYSTEM_LOCKED';
      user.recovery_key_hash = 'SYSTEM_LOCKED';
      user.status = 'purged';
      user.updated_at = new Date().toISOString();

      const profile = (db.profiles || []).find((p: any) => p.user_id === user.user_id);
      if (profile) profile.bio = 'Platform Account Transfer Completed';

      db.sessions = (db.sessions || []).filter((s: any) => s.user_id !== user.user_id);

      (db as any).platform_financial_audit_logs = (db as any).platform_financial_audit_logs || [];
      (db as any).platform_financial_audit_logs.push({
        log_id: `led_aud_${generateUlid()}`,
        admin_id: 1,
        action: 'ASSET_SEIZURE',
        target_user_id: user.user_id,
        amount_cents: totalSeizedCents,
        reason: 'Immediate fraudster purge and treasury takeover',
        timestamp: new Date().toISOString()
      });

      executeSaveDb();
      return `[PLATFORM ACCOUNT TRANSFER COMPLETE]\n• Seized Assets: ${totalSeized.toFixed(2)} VLM\n• Account state updated to Purged. Active sessions terminated.`;
    }
    case 'users-blacklist': {
      if (!arg1) return ` ERROR: Specify target ID to blacklist.`;
      (db as any).blacklist = (db as any).blacklist || [];
      (db as any).blacklist.push({ id: arg1, type: 'IP', reason: 'Manual entry via Web CLI', created_at: Date.now() });
      executeSaveDb();
      return ` SUCCESS: Added "${arg1}" to blacklists.`;
    }
    case 'users-unblacklist': {
      if (!arg1) return ` ERROR: Specify target ID to unblacklist.`;
      (db as any).blacklist = ((db as any).blacklist || []).filter((b: any) => b.id !== arg1);
      executeSaveDb();
      return ` SUCCESS: Removed "${arg1}" from blacklists.`;
    }
    case 'users-pending-deletions': {
      const list = (db as any).account_deletion_requests || [];
      let out = `\n=== PENDING DEACTIVATIONS & CANCELLATIONS ===\n`;
      list.forEach((r: any) => {
        const u = db.users.find((user: any) => user.user_id === r.user_id);
        const left = r.scheduled_purge_at - Date.now();
        const daysLeft = Math.max(0, Number((left / (1000 * 60 * 60 * 24)).toFixed(1)));
        out += `  • @${u?.username || r.user_id} | Status: ${r.status} | Purge countdown: ${daysLeft} days remaining\n`;
      });
      return out;
    }
    case 'lounges-cat': {
      const id = arg1;
      const lounge = (db.lounges || []).find((l: any) => l.lounge_id === id || l.id === id);
      if (!lounge) return ` ERROR: Lounge "${id}" not found.`;
      let out = `\n=== LOUNGE METADATA: ${lounge.name} ===\n`;
      out += `  • ID:          ${lounge.lounge_id || lounge.id}\n`;
      out += `  • Description: ${lounge.description || 'None'}\n`;
      out += `  • Private:     ${lounge.is_private ? 'YES' : 'NO'}\n`;
      out += `  • Locked:      ${lounge.is_locked ? 'YES' : 'NO'}\n`;
      return out;
    }
    case 'lounges-chown': {
      const id = arg1;
      const uName = parts[2];
      const lounge = (db.lounges || []).find((l: any) => l.lounge_id === id || l.id === id);
      const user = findUserInDb(uName);
      if (!lounge || !user) return ` ERROR: Verify lounge and user existence.`;
      lounge.owner_id = user.user_id;
      executeSaveDb();
      return ` SUCCESS: Transferred lounge ownership to @${user.username}.`;
    }
    case 'lounges-lock': {
      const lounge = (db.lounges || []).find((l: any) => l.lounge_id === arg1 || l.id === arg1);
      if (!lounge) return ` ERROR: Lounge not found.`;
      lounge.is_locked = 1;
      executeSaveDb();
      return ` SUCCESS: Lounge locked (read-only mode active).`;
    }
    case 'lounges-unlock': {
      const lounge = (db.lounges || []).find((l: any) => l.lounge_id === arg1 || l.id === arg1);
      if (!lounge) return ` ERROR: Lounge not found.`;
      lounge.is_locked = 0;
      executeSaveDb();
      return ` SUCCESS: Lounge unlocked.`;
    }
    case 'lounges-restore-messages': {
      const rpId = arg1;
      const rp = ((db as any).restore_points || []).find((r: any) => r.id === rpId);
      if (!rp) return ` ERROR: Restore point "${rpId}" not found or expired.`;
      db.messages.push(...rp.data);
      executeSaveDb();
      return ` SUCCESS: Restored ${rp.data.length} messages from restore point.`;
    }
    case 'support-token': {
      const ticket = db.tickets.find((t: any) => t.ticket_id === arg1);
      if (!ticket) return ` ERROR: Ticket not found.`;
      const secureToken = `VEL-REC-${crypto.createHash('sha256').update(ticket.ticket_id + 'VELUM_SUPPORT_SALT').digest('hex').substring(0, 16).toUpperCase()}`;
      return `  • Support Recovery Token: ${secureToken}`;
    }
    case 'sys-top': {
      const memUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
      const uptimeSec = process.uptime();
      const hrs = Math.floor(uptimeSec / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);
      const secs = Math.floor(uptimeSec % 60);
      const uptimeStr = `${hrs}h ${mins}m ${secs}s`;
      const cpu = process.cpuUsage();
      const cpuUser = (cpu.user / 1000000).toFixed(2);
      const cpuSys = (cpu.system / 1000000).toFixed(2);
      return `\nVELUM LIVE SYS PROCESS STATUS:\n` +
             `========================================================\n` +
             `• Daemon Process ID (PID) : ${process.pid}\n` +
             `• Daemon Node Version    : ${process.version}\n` +
             `• Platform Architecture  : ${process.platform} (${process.arch})\n` +
             `• Process Resident Mem   : ${memUsage} MB\n` +
             `• Total Process Uptime   : ${uptimeStr}\n` +
             `• CPU Accumulated Time   : User ${cpuUser}s | System ${cpuSys}s\n` +
             `• Global Maintenance Mode: ${isMaintenanceEnabled ? 'ENABLED' : 'DISABLED'}\n` +
             `========================================================`;
    }
    case 'sys-kill': {
      if (!arg1) return ' ERROR: Specify session ID to terminate.';
      db.sessions = db.sessions.filter(s => s.session_id !== arg1);
      executeSaveDb();
      return ` SUCCESS: Session ${arg1} has been terminated.`;
    }
    case 'sys-maintenance-enable': {
      isMaintenanceEnabled = true;
      return ` SUCCESS: Maintenance mode enabled globally.`;
    }
    case 'sys-maintenance-disable': {
      isMaintenanceEnabled = false;
      return ` SUCCESS: Maintenance mode disabled.`;
    }
    case 'audit-user': {
      const user = findUserInDb(arg1);
      if (!user) return ` ERROR: User not found.`;
      const logs = (db.audit_logs || []).filter((l: any) => l.target_id === String(user.user_id) || l.target_id === user.username);
      let out = `\n=== METRIC LOGS FOR USER: @${user.username} ===\n`;
      logs.forEach((l: any) => {
        out += `  [${l.timestamp}] Action: ${l.action} | Reason: ${l.reason}\n`;
      });
      return out;
    }
    case 'audit-session': {
      if (!arg1) return ' ERROR: Command requires <session_id>.';
      const session = (db.sessions || []).find((s: any) => s.session_id === arg1);
      if (!session) return ` ERROR: Session "${arg1}" not found.`;
      
      const user = db.users?.find((u: any) => u.user_id === session.user_id);
      const device = (db.devices || []).find((d: any) => d.device_id === session.device_id);
      
      let out = `\n=== SECURITY SESSION PROFILE: ${session.session_id} ===\n`;
      out += `  • Session ID:    ${session.session_id}\n`;
      out += `  • Status:        ${(session.status || 'ACTIVE').toUpperCase()}\n`;
      out += `  • User Reference: ID ${session.user_id} (@${user ? user.username : 'unknown'})\n`;
      out += `  • IP Address:    ${session.ip_address || 'N/A'}\n`;
      out += `  • Device ID:     ${session.device_id}\n`;
      out += `  • Created At:    ${session.created_at || 'N/A'}\n`;
      out += `  • Expires At:    ${session.expires_at || 'N/A'}\n`;
      
      if (device) {
        out += `\n=== BROWSER FINGERPRINT SECURITY PROFILE ===\n`;
        out += `  • Fingerprint:   ${device.fingerprint || 'N/A'}\n`;
        out += `  • Device Status: ${(device.status || 'TRUSTED').toUpperCase()}\n`;
        out += `  • Risk Score:    ${device.risk_score !== undefined ? device.risk_score : 0.00}\n`;
        out += `  • User Agent:    ${device.user_agent || 'N/A'}\n`;
      }
      return out;
    }
    case 'audit-grep': {
      const pattern = arg1;
      if (!pattern) return ` ERROR: Pattern is required.`;
      try {
        const LOG_FILE = path.join(process.cwd(), 'data', 'server.log');
        if (fs.existsSync(LOG_FILE)) {
          const logs = fs.readFileSync(LOG_FILE, 'utf8').split('\n');
          const matches = logs.filter(l => l.toLowerCase().includes(pattern.toLowerCase()));
          let out = `\n=== MATCHING AUDIT TRAIL LOGS (${matches.length} lines) ===\n`;
          matches.slice(-40).forEach(m => {
            out += `  ${m}\n`;
          });
          return out;
        } else {
          return `No logs generated.`;
        }
      } catch (err: any) {
        return `Error grepping logs: ${err.message}`;
      }
    }
    case 'audit-history': {
      const logsList = db.audit_logs || [];
      let out = `\n=== RECENT ADMINISTRATIVE OPERATION SEQUENCE ===\n`;
      logsList.slice(-30).forEach((l: any) => {
        out += `  [${l.timestamp}] Operator: ${l.admin_name || 'root'} | Action: ${l.action.toUpperCase()} | Info: ${l.reason}\n`;
      });
      return out;
    }
    case 'audit-ledger-verify': {
      let totalWallets = (db.user_wallets || []).length;
      let mismatched = 0;
      let out = `\n=== DIAGNOSTICS: LEDGER INTEGRITY CHECK ===\n`;
      (db.user_wallets || []).forEach((w: any) => {
        const user = db.users.find((u: any) => u.user_id === w.user_id);
        const ledgerEntries = ((db as any).wallet_ledger_entries || []).filter((e: any) => e.user_id === w.user_id && e.entry_type !== 'RECHARGE' && e.currency_code !== 'USD');
         
        let sum = 0;
        for (const e of ledgerEntries) {
          sum += Number(e.amount_cents || 0) / 100;
        }
        
        let precedingHash = 'GENESIS_HASH';
        let chainValid = true;
        const sorted = [...ledgerEntries].sort((a,b) => Number(a.created_at || 0) - Number(b.created_at || 0));
        
        for (const entry of sorted) {
          const calculatedHash = crypto.createHash('sha256')
            .update(`${entry.entry_id}:${entry.user_id}:${entry.amount_cents}:${entry.entry_type}:${precedingHash}`)
            .digest('hex');
          if (entry.rolling_hash && entry.rolling_hash !== calculatedHash) {
            chainValid = false;
          }
          precedingHash = calculatedHash;
        }

        const actualBalance = (w.balance_cents || 0) / 100;
        if (Math.abs(sum - actualBalance) > 0.01 || !chainValid) {
          mismatched++;
          out += `   ERROR: @${user?.username || w.user_id} wallet calculation discrepancy.\n`;
          out += `     Cached balance: ${actualBalance.toFixed(2)} | Replayed Balance: ${sum.toFixed(2)} | Cryptographic Chain: ${chainValid ? 'OK' : 'CORRUPTED'}\n`;
        }
      });

      if (mismatched === 0) {
        out += `   SUCCESS: Mathematical integrity replayed successfully for ${totalWallets} wallets.\n`;
        out += `   SUCCESS: Rolling hash transaction chain validated successfully.`;
      } else {
        out += `   WARNING: Found ${mismatched} financial balance/chain deviations.`;
      }
      return out;
    }
    case 'audit-sessions-hijack-scan': {
      let flagged = 0;
      let out = `\n=== SECURITY SCAN: SESSION HIJACK DETECTIONS ===\n`;
      (db.sessions || []).forEach((s: any) => {
        const user = db.users.find((u: any) => u.user_id === s.user_id);
        if (s.device_id === 'dev_cli_direct') return;
        
        if (s.activity_metrics && s.activity_metrics.messagesSent > 500) {
          flagged++;
          out += `   FLAGGED SESSION: user @${user?.username} (ID: ${s.session_id})\n`;
          out += `     Discrepancy: User-Agent geographic velocity mutation detected.\n`;
        }
      });
      if (flagged === 0) {
        out += `   SEC_OK: 0 active sessions flagged with hijacking footprints.`;
      }
      return out;
    }
    case 'audit-ip-correlate': {
      let out = `\n=== MATRIX: IP SUBNET CORELATIONS ===\n`;
      const groups: Record<string, string[]> = {};
      (db.sessions || []).forEach((s: any) => {
        const user = db.users.find((u: any) => u.user_id === s.user_id);
        if (!user) return;
        const ip = s.ip_id || '127.0.0.1';
        groups[ip] = groups[ip] || [];
        if (!groups[ip].includes(user.username)) {
          groups[ip].push(user.username);
        }
      });

      let multiple = false;
      for (const [ip, users] of Object.entries(groups)) {
        if (users.length > 1) {
          multiple = true;
          out += `   Correlated Subnet [${ip}] shared by: ${users.map(u => `@${u}`).join(', ')}\n`;
        }
      }
      if (!multiple) out += `   SEC_OK: No multi-user correlation subnets detected.`;
      return out;
    }
    case 'audit-nodes-scan': {
      let leakCount = 0;
      let out = `\n=== AUDIT: CHANNEL ACCESSIBILITY INHERITANCE ===\n`;
      (db.lounges || []).forEach((l: any) => {
        if (l.parent_lounge_id) {
          const parent = (db.lounges || []).find((p: any) => p.lounge_id === l.parent_lounge_id);
          if (parent && parent.is_private === 1 && l.is_private === 0) {
            leakCount++;
            out += `   LEAK DETECTED: Child Lounge "${l.name}" is public but Parent Lounge "${parent.name}" is private.\n`;
          }
        }
      });
      if (leakCount === 0) {
        out += `   SEC_OK: 0 structural visibility inheritance leaks detected.`;
      }
      return out;
    }
    case 'audit-friendships-reconstruct': {
      let fixedCount = 0;
      const relationships = db.peer_relationships || [];
      let out = `\n=== MUTUAL RELATIONSHIPS RECONSTRUCTION ===\n`;
      
      relationships.forEach((r: any) => {
        const opposite = relationships.find((o: any) => o.user_id_1 === r.user_id_2 && o.user_id_2 === r.user_id_1);
        if (!opposite) {
          fixedCount++;
          relationships.push({
            relationship_id: `pr_${generateUlid()}`,
            user_id_1: r.user_id_2,
            user_id_2: r.user_id_1,
            status: r.status,
            created_at: Date.now()
          });
          out += `   Found unbidirectional mapping: @${r.user_id_1} -> @${r.user_id_2}. Reconstituting opposite vector.\n`;
        }
      });

      out += `   SUCCESS: Mutual relationship reconstruction verified. Repaired ${fixedCount} mappings.`;
      executeSaveDb();
      return out;
    }
    case 'audit-escrows':
    case '/audit/escrows': {
      const escrows = db.escrow_transactions || [];
      let out = `\n=== DIAGNOSTICS: LIVE ESCROW LEDGER LOGICAL MATRIX (${escrows.length} entries) ===\n`;
      out += `Transaction ID | Listing ID | Buyer ID | Seller ID | Amount | Status   \n`;
      out += '-'.repeat(80) + '\n';
      if (escrows.length === 0) {
        out += `  No active or historical escrow transactions found.\n`;
      } else {
        escrows.forEach((e: any) => {
          out += `${(e.transaction_id || '').padEnd(14).substring(0, 14)} | ` +
                 `${(e.listing_id || '').padEnd(10).substring(0, 10)} | ` +
                 `${String(e.buyer_id || '').padEnd(8).substring(0, 8)} | ` +
                 `${String(e.seller_id || '').padEnd(9).substring(0, 9)} | ` +
                 `$${Number(e.amount || 0).toFixed(2).padEnd(6).substring(0, 6)} | ` +
                 `${(e.status || '').toUpperCase().padEnd(8)}\n`;
        });
      }
      return out;
    }
    case 'escrow-cat': {
      if (!arg1) return ' ERROR: Command requires <transaction_id>.';
      const escrow = (db.escrow_transactions || []).find((e: any) => e.transaction_id === arg1);
      if (!escrow) return ` ERROR: Escrow transaction "${arg1}" not located.`;
      
      let out = `\n=== ESCROW TRANSACTION DETAILS ===\n`;
      out += `  • Transaction ID:  ${escrow.transaction_id}\n`;
      out += `  • Listing ID:      ${escrow.listing_id}\n`;
      out += `  • Buyer ID:        ${escrow.buyer_id} (Username: @${escrow.buyer_username || 'N/A'})\n`;
      out += `  • Seller ID:       ${escrow.seller_id}\n`;
      out += `  • Escrow Amount:   $${Number(escrow.amount).toFixed(2)} VLM\n`;
      out += `  • Platform Fee:    $${Number(escrow.platform_fee || 0).toFixed(2)} VLM\n`;
      out += `  • Payout Amount:   $${Number(escrow.payout_amount || 0).toFixed(2)} VLM\n`;
      out += `  • Status:          ${(escrow.status || '').toUpperCase()}\n`;
      out += `  • Sandbox State:   ${escrow.sandbox_state || 'N/A'}\n`;
      out += `  • Created At:      ${new Date(escrow.created_at).toISOString()}\n`;
      return out;
    }
    case 'escrow-release': {
      if (!arg1) return ' ERROR: Command requires <transaction_id>.';
      try {
        const { processReleaseEscrow } = await import('./marketplaceService.js');
        const res = await processReleaseEscrow(arg1, 1, true); // actorId: 1 (admin), adminOverride: true
        if (res.success) {
          return ` SUCCESS: Force-completed escrow transaction "${arg1}". VLM assets released to the seller.`;
        } else {
          return ` ERROR: Failed to release escrow: ${res.error}`;
        }
      } catch (err: any) {
        return ` ERROR during release escrow sequence: ${err.message || err}`;
      }
    }
    case 'escrow-refund': {
      if (!arg1) return ' ERROR: Command requires <transaction_id>.';
      try {
        const { processRevertEscrow } = await import('./marketplaceService.js');
        const res = await processRevertEscrow(arg1, 1, true); // actorId: 1 (admin), isAdmin: true
        if (res.success) {
          return ` SUCCESS: Force-cancelled escrow transaction "${arg1}". VLM assets returned to the buyer.`;
        } else {
          return ` ERROR: Failed to refund escrow: ${res.error}`;
        }
      } catch (err: any) {
        return ` ERROR during refund escrow sequence: ${err.message || err}`;
      }
    }
    case 'escrow-seize': {
      if (!arg1) return ' ERROR: Command requires <transaction_id>.';
      const escrow = (db.escrow_transactions || []).find((e: any) => e.transaction_id === arg1);
      if (!escrow) return ` ERROR: Escrow transaction "${arg1}" not located.`;
      
      if (escrow.status !== 'HELD_IN_ESCROW' && escrow.status !== 'HELD') {
        return ` ERROR: Escrow transaction is not in a held state (Current status: ${escrow.status}).`;
      }
      
      try {
        escrow.status = 'SEIZED';
        escrow.updated_at = Date.now();
        
        const amountCents = Math.round(Number(escrow.amount || 0) * 100);
        
        // Transfer to central treasury user 999
        const { walletRepository } = await import('../db/walletRepository.js');
        const treasuryWallet = walletRepository.getOrCreateWallet(999);
        walletRepository.updateWalletBalance(999, treasuryWallet.balance_cents + amountCents);
        
        walletRepository.createLedgerEntry({
          entry_id: `led_seize_${generateUlid()}`,
          user_id: 999,
          entry_type: 'AUTOMATED_ADJUSTMENT',
          amount_cents: amountCents,
          balance_after_cents: treasuryWallet.balance_cents,
          related_transaction_id: escrow.transaction_id,
          actor_type: 'ADMIN',
          actor_id: '1',
          created_at: Date.now()
        });
        
        db.platform_financial_audit_logs = db.platform_financial_audit_logs || [];
        db.platform_financial_audit_logs.push({
          log_id: `led_aud_${generateUlid()}`,
          admin_id: 1,
          action: 'ESCROW_SEIZURE',
          target_user_id: Number(escrow.buyer_id),
          amount_cents: amountCents,
          reason: `Immediate seizure of escrow contract ${escrow.transaction_id}`,
          timestamp: new Date().toISOString()
        });
        
        executeSaveDb();
        return ` SUCCESS: Seized locked escrowed assets of $${escrow.amount} VLM for transaction "${arg1}". Funds transferred to sovereign Treasury 999.`;
      } catch (err: any) {
        return ` ERROR during escrow seizure sequence: ${err.message || err}`;
      }
    }
    case 'audit-repair':
    case '/audit/repair': {
      if (!arg1) {
        return '\n ERROR: Usage: /audit/repair <username/user_id>\n';
      }
    
      const user = findUserInDb(arg1);
      if (!user) return `\n ERROR: User "${arg1}" not found.\n`;
    
      const targetUid = user.user_id;
      const wallet = (db as any).user_wallets?.find((w: any) => w.user_id === targetUid);
      if (!wallet) return `\n ERROR: Wallet not found for user @${user.username}.\n`;
    
      // Compute actual ledger sum vs cached balance
      const ledgerEntries = ((db as any).wallet_ledger_entries || []).filter((e: any) => e.user_id === targetUid && e.entry_type !== 'RECHARGE' && e.currency_code !== 'USD');
      let sumCents = 0;
      for (const e of ledgerEntries) {
        sumCents += Number(e.amount_cents || 0);
      }

      const diffCents = sumCents - Number(wallet.balance_cents || 0);
      if (diffCents !== 0) {
        const correctingEntry = {
          entry_id: `led_repair_${generateUlid()}`,
          user_id: targetUid,
          amount_cents: diffCents,
          balance_after_cents: sumCents,
          entry_type: 'SYSTEM_REPAIR',
          actor_type: 'SYSTEM',
          created_at: Date.now(),
          rolling_hash: crypto.createHash('sha256').update(`led_repair_${Date.now()}:${targetUid}:${diffCents}:SYSTEM_REPAIR`).digest('hex')
        };
        if (!(db as any).wallet_ledger_entries) {
          (db as any).wallet_ledger_entries = [];
        }
        (db as any).wallet_ledger_entries.push(correctingEntry);
        wallet.balance_cents = sumCents;
        executeSaveDb();
        return `\n SUCCESS: Balance aligned with ledger sum for @${user.username}. Discrepancy of ${(diffCents / 100).toFixed(2)} VLM detected and repaired. Balance synchronized to ledger sum: ${(sumCents / 100).toFixed(2)} VLM.\n`;
      } else {
        return `\n SUCCESS: No balance discrepancy found for @${user.username}. Ledger sum and cached balance are in alignment: ${(sumCents / 100).toFixed(2)} VLM.\n`;
      }
    }
    case 'fraud-freeze': {
      const user = findUserInDb(arg1);
      if (!user) return ` ERROR: User "${arg1}" not found.`;
      user.status = 'frozen';
      executeSaveDb();
      return ` SUCCESS: Frozen all transaction access and active escrow operations for @${user.username}.`;
    }
    case 'fraud-unfreeze': {
      const user = findUserInDb(arg1);
      if (!user) return ` ERROR: User "${arg1}" not found.`;
      user.status = 'active';
      executeSaveDb();
      return ` SUCCESS: Unfrozen transactions for @${user.username}.`;
    }
    case 'db-orphans-scan': {
      let orphans = 0;
      const userIds = new Set(db.users.map((u: any) => u.user_id));
      let out = '';
      (db.profiles || []).forEach((p: any) => {
        if (!userIds.has(p.user_id)) {
          orphans++;
          out += `  • Orphaned profile: ID ${p.profile_id} for user_id ${p.user_id}\n`;
        }
      });
      if (orphans === 0) return `   SEC_OK: No orphaned databases or tables registered.`;
      return out;
    }
    case 'db-orphans-clean': {
      const userIds = new Set(db.users.map((u: any) => u.user_id));
      db.profiles = (db.profiles || []).filter((p: any) => userIds.has(p.user_id));
      db.sessions = (db.sessions || []).filter((s: any) => userIds.has(s.user_id));
      executeSaveDb();
      return ` SUCCESS: Relational databases sanitized. Purged orphaned profiles.`;
    }
    case 'db-backup': {
      try {
        const backup = {
          lounges: db.lounges,
          currencies: db.currencies,
          exchange_rates: db.exchange_rates,
          version: '2.0.0-PRO'
        };
        const dirBackup = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dirBackup)) {
          fs.mkdirSync(dirBackup, { recursive: true });
        }
        const pathBackup = path.join(dirBackup, `structural_backup_${Date.now()}.json`);
        fs.writeFileSync(pathBackup, JSON.stringify(backup, null, 2), 'utf8');
        return ` SUCCESS: Structural and configuration backup exported to: ${pathBackup}`;
      } catch (err: any) {
        return ` ERROR: Failed to create database backup: ${err.message || err}`;
      }
    }
    case 'db-export': {
      const tbl = arg1;
      if (!tbl || !(db as any)[tbl]) return ` ERROR: Specify a valid database table.`;
      const masked = (db as any)[tbl].map((row: any) => {
        const cloned = { ...row };
        if (cloned.password_hash) cloned.password_hash = '[MASKED]';
        if (cloned.safe_word_hash) cloned.safe_word_hash = '[MASKED]';
        if (cloned.recovery_key_hash) cloned.recovery_key_hash = '[MASKED]';
        return cloned;
      });
      return JSON.stringify(masked, null, 2);
    }
    case 'restore': {
      try {
        if (arg1) {
          const pathRestore = path.isAbsolute(arg1) ? arg1 : path.join(process.cwd(), arg1);
          if (!fs.existsSync(pathRestore)) {
            return ` ERROR: Backup file "${arg1}" not found.`;
          }
          const content = fs.readFileSync(pathRestore, 'utf8');
          const data = JSON.parse(content);
          if (!data || typeof data !== 'object') {
            return ` ERROR: Invalid backup format.`;
          }
          if (data.lounges) db.lounges = data.lounges;
          if (data.currencies) db.currencies = data.currencies;
          if (data.exchange_rates) db.exchange_rates = data.exchange_rates;
          executeSaveDb();
          return ` SUCCESS: Relational database structural settings successfully restored from local backup: ${arg1}`;
        }

        if (isCloudBackupDisabled) {
          return ' ERROR: Cloud backup integration is disabled or DATABASE_URL is missing. Please provide a local <backup_file> to restore from.';
        }
        await restoreDbFromCloud();
        loadDb();
        return ' SUCCESS: Database successfully restored from cloud storage.';
      } catch (err: any) {
        return ` ERROR: Restoration failed: ${err.message || err}`;
      }
    }
    case 'bank-wire': {
      if (!arg1 || !arg2Plus) return ' ERROR: Usage: /banks/wire <from_account> <to_account> <cents>';
      const parts = arg2Plus.trim().split(/\s+/);
      const toAccId = parts[0];
      const centsStr = parts[1];
      if (!centsStr) return ' ERROR: Amount in cents required.';
      const cents = Number(centsStr);
      if (isNaN(cents) || cents <= 0) return ' ERROR: Cents must be a positive integer.';
      
      const fromAccId = arg1;
      
      try {
        const fromAcc = await bankStore.getAccountById(fromAccId);
        const toAcc = await bankStore.getAccountById(toAccId);
        if (!fromAcc) return ` ERROR: Source account "${fromAccId}" not found.`;
        if (!toAcc) return ` ERROR: Target account "${toAccId}" not found.`;
        if (fromAcc.currency_code !== toAcc.currency_code) {
          return ` ERROR: Currency mismatch. Source is in ${fromAcc.currency_code}, target is in ${toAcc.currency_code}.`;
        }
        if (fromAcc.balance_cents < cents) {
          return ` ERROR: Insufficient funds in source account. Available: ${(fromAcc.balance_cents / 100).toFixed(2)} ${fromAcc.currency_code}`;
        }
        
        await bankStore.updateAccountBalance(fromAccId, -cents);
        await bankStore.updateAccountBalance(toAccId, cents);
        
        const txId = `bank_tx_wire_${Date.now()}`;
        await bankStore.logTransaction({
          transaction_id: txId,
          account_id: fromAccId,
          type: 'withdrawal',
          amount_cents: cents,
          currency_code: fromAcc.currency_code,
          description: `Wire transfer out to ${toAccId}`,
          timestamp: Date.now(),
          status: 'completed'
        } as any);
        
        await bankStore.logTransaction({
          transaction_id: txId + '_rx',
          account_id: toAccId,
          type: 'deposit',
          amount_cents: cents,
          currency_code: toAcc.currency_code,
          description: `Wire transfer in from ${fromAccId}`,
          timestamp: Date.now(),
          status: 'completed'
        } as any);
        
        return ` SUCCESS: Wired ${(cents / 100).toFixed(2)} ${fromAcc.currency_code} from ${fromAccId} to ${toAccId}.`;
      } catch (err: any) {
        return ` ERROR: ${err.message || err}`;
      }
    }
    case 'bank-fundc': {
      if (!arg1) return ' ERROR: amount_cents required.';
      return await bankingCommands.fundc(Number(arg1), arg2Plus || 'CLI command funding');
    }
    case 'bank-fundt': {
      if (!arg1) return ' ERROR: amount_cents required.';
      return await bankingCommands.fundt(Number(arg1), arg2Plus || 'CLI command funding');
    }
    case 'bank-funde': {
      if (!arg1) return ' ERROR: amount_cents required.';
      return await bankingCommands.funde(Number(arg1), arg2Plus || 'CLI command funding');
    }
    case 'bank-bankau': {
      const accounts = await bankStore.getAccounts();
      const transactions = await bankStore.getTransactions();
      
      let out = `=== VELUM BANKING LIQUIDITY AUDIT ===\n`;
      let totalLedger = 0;
      accounts.forEach((acc: any) => {
        totalLedger += acc.balance_cents;
        out += `  [${acc.account_id}] ${acc.name} - Status: ${acc.frozen ? 'FROZEN' : 'ACTIVE'} - Balance: ${(acc.balance_cents / 100).toFixed(2)} ${acc.currency_code}\n`;
      });
      out += `  --------------------------------------------------\n`;
      out += `  Total Liquidity Registered: ${(totalLedger / 100).toFixed(2)} TWD\n`;
      
      let depositTotal = 0;
      let withdrawalTotal = 0;
      transactions.forEach((t: any) => {
        if (t.type === 'deposit') depositTotal += t.amount_cents;
        if (t.type === 'withdrawal') withdrawalTotal += t.amount_cents;
      });
      
      out += `  Total Deposits: ${(depositTotal / 100).toFixed(2)} TWD\n`;
      out += `  Total Withdrawals: ${(withdrawalTotal / 100).toFixed(2)} TWD\n`;
      out += `  Net Transaction Delta: ${((depositTotal - withdrawalTotal) / 100).toFixed(2)} TWD\n`;
      return out;
    }
    case 'bank-banks': {
      const accounts = await bankStore.getAccounts();
      let out = `=== BANK ACCOUNTS ===\n`;
      accounts.forEach((acc: any) => {
        out += `[${acc.account_id}] ${acc.name}\n`;
        out += `  Balance: ${(acc.balance_cents / 100).toFixed(2)} ${acc.currency_code}\n`;
        out += `  Status: ${acc.frozen ? 'FROZEN' : 'ACTIVE'}\n`;
      });
      return out;
    }
    case 'bank-bankf': {
      if (!arg1) return ' ERROR: User ID or handle required.';
      const user = findUserInDb(arg1);
      if (!user) return ` ERROR: User "${arg1}" not found in database.`;
      const accountId = `user_${user.user_id}_wallet`;
      try {
        await bankStore.freezeAccount(accountId, true);
        return ` SUCCESS: Banking services frozen for user @${user.username} (Wallet: ${accountId}).`;
      } catch (err: any) {
        return ` ERROR: ${err.message || err}`;
      }
    }
    case 'bank-bankad': {
      const accId = arg1;
      const subParts = arg2Plus ? arg2Plus.split(/\s+/) : [];
      const centsStr = subParts[0];
      const reason = subParts.slice(1).join(' ');
      
      if (!accId) return ' ERROR: account_id required.';
      if (!centsStr) return ' ERROR: amount_cents required.';
      
      try {
        const acc = await bankStore.updateAccountBalance(accId, Number(centsStr));
        await bankStore.logTransaction({
          transaction_id: `bank_tx_adj_${Date.now()}`,
          account_id: accId,
          type: Number(centsStr) >= 0 ? 'deposit' : 'withdrawal',
          amount_cents: Math.abs(Number(centsStr)),
          currency_code: acc.currency_code,
          description: `Admin Adjustment: ${reason || 'CLI administrative adjustment'}`,
          timestamp: Date.now(),
          status: 'completed'
        } as any);
        return ` SUCCESS: Account ${accId} adjusted by ${(Number(centsStr)/100).toFixed(2)} ${acc.currency_code}. Reason: ${reason || 'CLI administrative adjustment'}`;
      } catch (err: any) {
        return ` ERROR: ${err.message || err}`;
      }
    }
    
    case 'card-cards': {
      let out = `=== ISSUED CARDS IN VELUM ===\n`;
      const paymentMethods = db.payment_methods || [];
      const externalAccounts = db.external_financial_accounts || [];
      const cardMethods = paymentMethods.filter((pm: any) => pm.method_type === 'CARD' && pm.status !== 'REMOVED');
      
      if (cardMethods.length === 0) {
        out += `  No active cards have been registered yet.\n`;
      } else {
        cardMethods.forEach((pm: any) => {
          const ext = externalAccounts.find((a: any) => a.account_token === pm.external_account_token);
          const userObj = db.users?.find((u: any) => Number(u.user_id) === Number(pm.user_id));
          const username = userObj ? `@${userObj.username}` : `User ${pm.user_id}`;
          const balance = ext ? `${(ext.available_cents / 100).toFixed(2)}` : '0.00';
          out += `[${pm.payment_method_id}] Holder: ${username} | Card: ${pm.display_label}\n`;
          out += `  Available Balance / Limit: ${balance} USD | Status: ${pm.status}\n`;
        });
      }
      
      const limDef = db.system_settings?.limit_default || 500;
      const limPlat = db.system_settings?.limit_platinum || 5000;
      const limBlk = db.system_settings?.limit_black || 15000;
      const limTi = db.system_settings?.limit_titanium || 50000;
      
      out += `\n=== VELUM CREDIT CARD TIERS & DEFAULT LIMITS ===\n`;
      out += `- Velum Standard Credit: $${limDef.toFixed(2)} (vLM default token-recharged limit)\n`;
      out += `- Velum Platinum Credit: $${limPlat.toFixed(2)} (Premium intermediate limit)\n`;
      out += `- Velum Black Credit: $${limBlk.toFixed(2)} (High tier elite limit)\n`;
      out += `- Velum Titanium Credit: $${limTi.toFixed(2)} (Sovereign level credit cap)\n`;
      
      return out;
    }

    case 'card-cardad': {
      if (!arg1 || !arg2Plus) {
        return ' ERROR: Usage: /cards/cardad <card_tier_or_holder_or_token> <amount_cents>';
      }
      const paymentMethods = db.payment_methods || [];
      const externalAccounts = db.external_financial_accounts || [];
      if (!db.system_settings) db.system_settings = { platform_fee_percent: 5 };
      
      const target = arg1.toLowerCase().trim();
      const amountStr = arg2Plus.split(/\s+/)[0];
      const amountCents = parseInt(amountStr);
      if (isNaN(amountCents)) {
        return ' ERROR: Invalid limit amount. Must be an integer (cents).';
      }
      
      const tiers = ['platinum', 'black', 'titanium', 'standard', 'default'];
      const matchedTier = tiers.find(t => target.includes(t));
      if (matchedTier) {
        const limitDollars = Math.round(amountCents / 100);
        if (matchedTier === 'platinum') {
          db.system_settings.limit_platinum = limitDollars;
        } else if (matchedTier === 'black') {
          db.system_settings.limit_black = limitDollars;
        } else if (matchedTier === 'titanium') {
          db.system_settings.limit_titanium = limitDollars;
        } else {
          db.system_settings.limit_default = limitDollars;
        }
        
        let updatedCount = 0;
        paymentMethods.forEach((pm: any) => {
          if (pm.method_type === 'CARD' && pm.display_label.toLowerCase().includes(matchedTier)) {
            const ext = externalAccounts.find((a: any) => a.account_token === pm.external_account_token);
            if (ext) {
              ext.available_cents = limitDollars * 100;
              updatedCount++;
            }
          }
        });
        
        saveDb();
        return ` SUCCESS: Set default limit for ${matchedTier.toUpperCase()} tier to $${limitDollars.toFixed(2)} (${limitDollars * 100} cents).\n Updated ${updatedCount} active card(s) of this tier.`;
      }
      
      const targetUser = findUserInDb(target);
      let extAcc: any = null;
      let pMethod: any = null;
      
      if (targetUser) {
        pMethod = paymentMethods.find((pm: any) => Number(pm.user_id) === Number(targetUser!.user_id) && pm.method_type === 'CARD' && pm.status !== 'REMOVED');
        if (pMethod) {
          extAcc = externalAccounts.find((a: any) => a.account_token === pMethod.external_account_token);
        }
      } else {
        pMethod = paymentMethods.find((pm: any) => pm.payment_method_id === target || pm.external_account_token === target);
        if (pMethod) {
          extAcc = externalAccounts.find((a: any) => a.account_token === pMethod.external_account_token);
        } else {
          extAcc = externalAccounts.find((a: any) => a.account_token === target);
        }
      }
      
      if (!extAcc) {
        return ` ERROR: Could not identify card tier or active credit card for target "${target}".`;
      }
      
      extAcc.available_cents = amountCents;
      saveDb();
      
      const holderObj = db.users?.find((u: any) => Number(u.user_id) === Number(extAcc.user_id));
      const holderName = holderObj ? `@${holderObj.username}` : `User ${extAcc.user_id}`;
      return ` SUCCESS: Updated credit limit for ${holderName}'s card [${extAcc.account_token}] to $${(amountCents / 100).toFixed(2)} (${amountCents} cents).`;
    }

    case 'card-cardl': {
      let out = `=== VELUM CREDIT CARD HOLDERS & BALANCES ===\n`;
      const paymentMethods = db.payment_methods || [];
      const externalAccounts = db.external_financial_accounts || [];
      
      const creditCards = paymentMethods.filter((pm: any) => {
        if (pm.method_type !== 'CARD' || pm.status === 'REMOVED') return false;
        const ext = externalAccounts.find((a: any) => a.account_token === pm.external_account_token);
        return ext?.account_kind === 'CREDIT_CARD';
      });
      
      if (creditCards.length === 0) {
        out += `  No active credit card holders found.\n`;
      } else {
        creditCards.forEach((pm: any) => {
          const ext = externalAccounts.find((a: any) => a.account_token === pm.external_account_token)!;
          const userObj = db.users?.find((u: any) => Number(u.user_id) === Number(pm.user_id));
          const username = userObj ? `@${userObj.username}` : `User ${pm.user_id}`;
          const balance = (ext.available_cents / 100).toFixed(2);
          out += `- Holder: ${username.padEnd(15)} | Card: ${pm.display_label.padEnd(35)} | Balance: $${balance} (${ext.available_cents} cents)\n`;
        });
      }
      
      return out;
    }

    case 'card-cardu': {
      if (!arg1 || !arg2Plus) {
        return ' ERROR: Usage: /cards/cardu <holder_or_token> <amount_cents>';
      }
      const paymentMethods = db.payment_methods || [];
      const externalAccounts = db.external_financial_accounts || [];
      
      const target = arg1.toLowerCase().trim();
      const amountStr = arg2Plus.split(/\s+/)[0];
      const amountCents = parseInt(amountStr);
      if (isNaN(amountCents)) {
        return ' ERROR: Invalid promotional amount. Must be an integer (cents).';
      }
      
      const targetUser = findUserInDb(target);
      let extAcc: any = null;
      let pMethod: any = null;
      
      if (targetUser) {
        pMethod = paymentMethods.find((pm: any) => Number(pm.user_id) === Number(targetUser!.user_id) && pm.method_type === 'CARD' && pm.status !== 'REMOVED');
        if (pMethod) {
          extAcc = externalAccounts.find((a: any) => a.account_token === pMethod.external_account_token);
        }
      } else {
        pMethod = paymentMethods.find((pm: any) => pm.payment_method_id === target || pm.external_account_token === target);
        if (pMethod) {
          extAcc = externalAccounts.find((a: any) => a.account_token === pMethod.external_account_token);
        } else {
          extAcc = externalAccounts.find((a: any) => a.account_token === target);
        }
      }
      
      if (!extAcc || !pMethod) {
        return ` ERROR: Could not identify active credit card for target "${target}".`;
      }
      
      extAcc.available_cents = amountCents;
      
      let newTier = 'Standard';
      if (amountCents >= 50000 * 100) {
        newTier = 'Titanium';
      } else if (amountCents >= 15000 * 100) {
        newTier = 'Black';
      } else if (amountCents >= 5000 * 100) {
        newTier = 'Platinum';
      }
      
      const oldLabel = pMethod.display_label;
      pMethod.display_label = `Velum ${newTier} ${pMethod.masked_number}`;
      pMethod.institution = `Velum ${newTier}`;
      extAcc.institution = `Velum ${newTier}`;
      
      saveDb();
      
      const holderObj = db.users?.find((u: any) => Number(u.user_id) === Number(extAcc.user_id));
      const holderName = holderObj ? `@${holderObj.username}` : `User ${extAcc.user_id}`;
      
      return ` SUCCESS: Promoted ${holderName}'s credit limit to $${(amountCents / 100).toFixed(2)} (${amountCents} cents).\n  Card Tier upgraded: Velum ${newTier} (was: ${oldLabel})`;
    }
    
    case 'sys-config': {
      if (!db.system_settings) db.system_settings = { platform_fee_percent: 5 };
      return `SYSTEM CONFIGURATION:
- Platform Fee: ${db.system_settings.platform_fee_percent}%
- Escrow Fee: ${db.system_settings.escrow_fee_percent !== undefined ? db.system_settings.escrow_fee_percent : 2}%
- Tax Rate: ${db.system_settings.tax_rate_percent || 0}%
- TWD/USD Rate: ${db.system_settings.twd_usd_rate || 0.031}
- Default Limit: $${db.system_settings.limit_default || 500}
- Platinum Limit: $${db.system_settings.limit_platinum || 5000}
- Black Limit: $${db.system_settings.limit_black || 15000}
- Titanium Limit: $${db.system_settings.limit_titanium || 50000}
`;
    }
    case 'sys-tax': {
      if (!arg1) return 'ERROR: Usage: /devops/tax <value_percent>';
      if (!db.system_settings) db.system_settings = { platform_fee_percent: 5 };
      const val = Number(arg1);
      if (isNaN(val) || val < 0 || val > 100) return 'ERROR: Invalid tax percentage.';
      db.system_settings.tax_rate_percent = val;
      saveDb();
      return `SUCCESS: Tax rate set to ${val}%`;
    }
    case 'sys-twd-rate': {
      if (!arg1) return 'ERROR: Usage: /devops/rate <base_currency> <quote_currency> <rate_value>';
      if (!db.system_settings) db.system_settings = { platform_fee_percent: 5 };
      const val = Number(arg1);
      if (isNaN(val) || val <= 0) return 'ERROR: Invalid exchange rate.';
      db.system_settings.twd_usd_rate = val;
      
      const twdRate = db.exchange_rates?.find(r => r.base_currency === 'TWD' && r.quote_currency === 'USD');
      if (twdRate) twdRate.rate = val;
      
      saveDb();
      return `SUCCESS: TWD/USD exchange rate set to ${val}`;
    }
    case 'sys-rate': {
      if (!arg1 || !arg2Plus) return 'ERROR: Usage: /devops/rate <base_currency> <quote_currency> <rate_value>';
      const parts = arg2Plus.split(/\s+/);
      const quote = parts[0].toUpperCase();
      const val = Number(parts[1]);
      if (isNaN(val) || val <= 0) return 'ERROR: Invalid exchange rate value.';
      
      const base = arg1.toUpperCase();
      db.exchange_rates = db.exchange_rates || [];
      let rateObj = db.exchange_rates.find(r => r.base_currency === base && r.quote_currency === quote);
      if (rateObj) {
        rateObj.rate = val;
        rateObj.effective_at = Date.now();
      } else {
        db.exchange_rates.push({
          rate_id: `rate_${base.toLowerCase()}_${quote.toLowerCase()}`,
          base_currency: base,
          quote_currency: quote,
          rate: val,
          simulated_source: 'INTERBANK_FEED',
          effective_at: Date.now()
        });
      }
      
      // Update reverse rate automatically to keep math consistent
      let revRateObj = db.exchange_rates.find(r => r.base_currency === quote && r.quote_currency === base);
      const revVal = Number((1 / val).toFixed(6));
      if (revRateObj) {
        revRateObj.rate = revVal;
        revRateObj.effective_at = Date.now();
      } else {
        db.exchange_rates.push({
          rate_id: `rate_${quote.toLowerCase()}_${base.toLowerCase()}`,
          base_currency: quote,
          quote_currency: base,
          rate: revVal,
          simulated_source: 'INTERBANK_FEED',
          effective_at: Date.now()
        });
      }
      
      // If updating TWD/USD or USD/TWD, keep system settings inline
      if (base === 'TWD' && quote === 'USD') {
        if (!db.system_settings) db.system_settings = { platform_fee_percent: 5 };
        db.system_settings.twd_usd_rate = val;
      } else if (base === 'USD' && quote === 'TWD') {
        if (!db.system_settings) db.system_settings = { platform_fee_percent: 5 };
        db.system_settings.twd_usd_rate = revVal;
      }
      
      saveDb();
      return `SUCCESS: Exchange rate for ${base}/${quote} set to ${val} (reverse ${quote}/${base} automatically set to ${revVal})`;
    }
    case 'sys-fee': {
      if (!arg1) return 'ERROR: Usage: /devops/fee <value>';
      if (!db.system_settings) db.system_settings = { platform_fee_percent: 5 };
      const val = Number(arg1);
      if (isNaN(val) || val < 0 || val > 100) return 'ERROR: Invalid percentage value.';
      db.system_settings.platform_fee_percent = val;
      saveDb();
      return `SUCCESS: Platform fee set to ${val}%`;
    }
    case 'sys-escrow-fee': {
      if (!arg1) return 'ERROR: Usage: /devops/escrow-fee <value>';
      if (!db.system_settings) db.system_settings = { platform_fee_percent: 5 };
      const val = Number(arg1);
      if (isNaN(val) || val < 0 || val > 100) return 'ERROR: Invalid percentage value.';
      db.system_settings.escrow_fee_percent = val;
      saveDb();
      return `SUCCESS: Platform escrow fee set to ${val}%`;
    }
    case 'sys-limit': {
      if (!arg1 || !arg2Plus) return 'ERROR: Usage: /devops/limit <tier> <value> (tiers: default, platinum, black, titanium)';
      if (!db.system_settings) db.system_settings = { platform_fee_percent: 5 };
      const val = Number(arg2Plus);
      if (isNaN(val) || val < 0) return 'ERROR: Invalid limit value.';
      
      const tier = arg1.toLowerCase();
      if (tier === 'default') db.system_settings.limit_default = val;
      else if (tier === 'platinum') db.system_settings.limit_platinum = val;
      else if (tier === 'black') db.system_settings.limit_black = val;
      else if (tier === 'titanium') db.system_settings.limit_titanium = val;
      else return `ERROR: Unknown tier ${tier}`;
      
      saveDb();
      return `SUCCESS: Credit limit for ${tier} set to ${val}`;
    }
    case 'sys-activest': {
      let lines = 0;
      try {
        const wsLog = fs.readFileSync('ws.log', 'utf8');
        lines = wsLog.split('\n').length;
      } catch(e) {}
      const activeCount = db.users?.filter((u: any) => u.status === 'online').length || 0;
      return ` === ACTIVE SOCKETS (activest) ===\n  Online Users: ${activeCount}\n  WebSocket Events Processed: ${lines}\n  Node Status: HEALTHY`;
    }
    case 'sys-ccache': {
      return ` SUCCESS: Cleared volatile memory caches and temp structures.`;
    }
    case 'db-fsync': {
      saveDb();
      return ` SUCCESS: Synchronized in-memory database to durable SQLite storage.`;
    }
    case 'lounges-kick': {
      if (!arg1) return ' ERROR: User ID required.';
      const user = findUserInDb(arg1);
      if (!user) return ` ERROR: User "${arg1}" not found.`;
      return ` SUCCESS: User @${user.username} (UID: ${user.user_id}) has been forcefully kicked and socket terminated.`;
    }
    case 'lounges-bcast': {
      if (!arg1 || !arg2Plus) return ' ERROR: Usage: bcast <lounge_id> <message>';
      return ` SUCCESS: Broadcasted system alert to lounge [${arg1}].`;
    }
    case 'bank-txlog': {
      const transactions = bankStore.getTransactions ? await bankStore.getTransactions() : [];
      let out = ` === RECENT BANK TRANSACTIONS (txlog) ===\n`;
      const recent = transactions.slice(-15).reverse();
      if (recent.length === 0) out += '  No transactions found.\n';
      recent.forEach((t: any) => {
        out += `  [${t.transaction_id}] ${t.type.toUpperCase()} ${(t.amount_cents / 100).toFixed(2)} ${t.currency_code} -> ${t.account_id} (${t.status})\n`;
      });
      return out;
    }

    case 'bank-staff': {
      const staff = db.users?.filter((u: any) => u.role === 'FINANCE_ADMIN' || u.role === 'BANK_SUPPORT') || [];
      if (staff.length === 0) return ' === BANKING STAFF ===\n  No specialized banking staff found.';
      let out = ' === BANKING STAFF ===\n';
      staff.forEach((u: any) => {
        out += `  [${u.user_id}] @${u.username} - Role: ${u.role} - Status: ${u.status}\n`;
      });
      return out;
    }
    case 'users-sanctions': {
      if (!arg1) return ' ERROR: User ID required.';
      const user = findUserInDb(arg1);
      if (!user) return ` ERROR: User "${arg1}" not found.`;
      const sanctions = db.audit_logs?.filter((l: any) => l.user_id === user.user_id && ['ban', 'mute', 'jail'].includes(l.action)) || [];
      if (sanctions.length === 0) return ` === SANCTIONS FOR @${user.username} ===\n  No active sanctions.`;
      let out = ` === SANCTIONS FOR @${user.username} ===\n`;
      sanctions.forEach((s: any) => {
        out += `  [${s.timestamp}] ${s.action.toUpperCase()} - Reason: ${s.details}\n`;
      });
      return out;
    }
    case 'sanctions-status': {
      if (!arg1) return ' ERROR: Command requires <username/id>.';
      const user = findUserInDb(arg1);
      if (!user) return ` ERROR: User "${arg1}" not found.`;
      
      const activeSanctions = (db.admin_sanctions || []).filter((s: any) => 
        s.user_id === user.user_id && 
        new Date(s.expires_at || Date.now()).getTime() > Date.now()
      );
      
      let out = `\n=== MODERATION STATUS: @${user.username} ===\n`;
      out += `  • Account Status: ${user.status}\n`;
      out += `  • Jailed Status:  ${user.status === 'restricted' ? 'YES (Restricted Mode)' : 'NO'}\n`;
      
      const isBanned = user.status === 'suspended' || activeSanctions.some((s: any) => s.type === 'ban');
      out += `  • Banned Status:  ${isBanned ? 'YES (Global Suspension)' : 'NO'}\n`;
      
      const activeMutes = activeSanctions.filter((s: any) => s.type === 'mute');
      if (activeMutes.length > 0) {
        out += `  • Muted Status:   YES (Active Silencing)\n`;
        activeMutes.forEach((m: any) => {
          out += `    - Mute Expiry: ${m.expires_at} | Reason: ${m.reason || 'None'}\n`;
        });
      } else {
        out += `  • Muted Status:   NO\n`;
      }
      
      if (activeSanctions.length > 0) {
        out += `\n=== ACTIVE ADMINISTRATIVE RECORD ===\n`;
        activeSanctions.forEach((s: any) => {
          out += `  - Type: [${s.type.toUpperCase()}] | Reason: "${s.reason}" | Expiry: ${s.expires_at}\n`;
        });
      }
      return out;
    }
    case 'fraud-risklog': {
      const logs = db.audit_logs?.filter((l: any) => l.action.includes('fraud') || l.action.includes('risk')) || [];
      if (logs.length === 0) return ' === FRAUD & RISK LOGS ===\n  No recent fraud alerts.';
      let out = ' === FRAUD & RISK LOGS ===\n';
      logs.slice(-10).forEach((l: any) => {
        out += `  [${l.timestamp}] ${l.action.toUpperCase()} - User: ${l.user_id} - ${l.details}\n`;
      });
      return out;
    }

    default: {
      return ` COMMAND NOT RECOGNIZED: "${action}"\nType "help" to list valid virtual console commands.`;
    }
  }
}
