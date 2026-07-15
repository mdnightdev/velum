import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
// @ts-ignore
import sqliteModule from 'node:sqlite';
import { DbSchema, defaultDb } from './schema.js';
import { encryptData, decryptData, setLegacyDecryptionSucceeded, legacyDecryptionSucceeded } from '../services/cryptoService.js';
import { generateUlid } from '../utils/ulid.js';
import { rebuildBlocksCache } from '../db.js';
import { backupDbToCloud } from '../services/sync.js';
import {
  db,
  setDb,
  sqliteDb,
  initSqlite,
  dbLoaded,
  setDbLoaded,
  isSaving,
  setIsSaving,
  decryptionErrorDetected,
  setDecryptionErrorDetected,
  lastSavedDbJson,
  setLastSavedDbJson,
  DB_DIR,
  DB_FILE,
  SQLITE_FILE,
  ensureSeededIntegrity,
  setupAuditLogProxy,
} from './index.js';

const DatabaseSync = (sqliteModule as any)?.DatabaseSync;

let saveTimeout: NodeJS.Timeout | null = null;

export function loadDb(force = false) {
  if (dbLoaded && !force) return;
  try {
    let sqliteLoaded = false;
    
    // 1. Try to load directly from the relational SQLite database SQLITE_FILE
    if (fs.existsSync(SQLITE_FILE)) {
      let conn: any = null;
      try {
        conn = initSqlite();
        if (!conn) throw new Error('SQLite connection failed to initialize');

        const tablesInDb = new Set(
          (conn.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as any[]).map((r: any) => r.name)
        );
        
        const loadPayloadTable = (tableName: string, idField?: string) => {
          try {
            // Check if table exists using the in-memory tablesInDb Set (highly optimized)
            if (!tablesInDb.has(tableName)) return [];
            
            const rows = conn.prepare(`SELECT id, payload FROM ${tableName}`).all() as any[];
            return rows.map((r: any) => {
              try {
                const obj = JSON.parse(decryptData(r.payload));
                if (idField && (obj[idField] === undefined || obj[idField] === null || obj[idField] === '')) {
                  obj[idField] = r.id;
                }
                return obj;
              } catch (decErr) {
                console.error(`[SYS-SECURE] CRITICAL DECRYPTION FAILURE in ${tableName}:`, decErr);
                setDecryptionErrorDetected(true);
                return null;
              }
            }).filter(Boolean);
          } catch (err) {
            return [];
          }
        };

        db.users = loadPayloadTable('users', 'user_id');
        db.profiles = loadPayloadTable('profiles', 'profile_id');
        db.sessions = loadPayloadTable('sessions', 'session_id');
        db.devices = loadPayloadTable('devices', 'device_id');
        db.ip_addresses = loadPayloadTable('ip_addresses', 'ip_id');
        db.messages = loadPayloadTable('messages', 'message_id');
        db.user_blocks = loadPayloadTable('user_blocks', 'block_id');
        db.user_mutes = loadPayloadTable('user_mutes', 'mute_id');
        db.admin_sanctions = loadPayloadTable('admin_sanctions', 'sanction_id');
        db.invites = loadPayloadTable('invites', 'invite_id');
        db.tickets = loadPayloadTable('tickets', 'ticket_id');
        db.reports = loadPayloadTable('reports', 'report_id');
        db.recovery_events = loadPayloadTable('recovery_events', 'event_id');
        db.suspicious_events = loadPayloadTable('suspicious_events', 'event_id');
        db.audit_logs = loadPayloadTable('audit_logs', 'log_id');
        db.friend_requests = loadPayloadTable('friend_requests', 'request_id');
        db.peer_relationships = loadPayloadTable('peer_relationships', 'id');
        db.join_requests = loadPayloadTable('join_requests', 'id');
        db.node_overwrites = loadPayloadTable('node_overwrites', 'overwrite_id');

        // Banking & Payment Tables
        db.user_wallets = loadPayloadTable('user_wallets', 'user_id');
        db.wallet_ledger_entries = loadPayloadTable('wallet_ledger_entries', 'entry_id');
        db.recharge_requests = loadPayloadTable('recharge_requests', 'request_id');
        db.withdrawal_requests = loadPayloadTable('withdrawal_requests', 'request_id');
        db.kyc_verifications = loadPayloadTable('kyc_verifications', 'kyc_id');
        db.payment_methods = loadPayloadTable('payment_methods', 'payment_method_id');
        db.external_financial_accounts = loadPayloadTable('external_financial_accounts', 'account_token');
        db.external_processor_events = loadPayloadTable('external_processor_events', 'event_id');
        db.wallet_balances = loadPayloadTable('wallet_balances', 'balance_id');
        db.currencies = loadPayloadTable('currencies', 'currency_code');
        db.exchange_rates = loadPayloadTable('exchange_rates', 'rate_id');
        db.platform_admins = loadPayloadTable('platform_admins', 'admin_id');

        // Marketplace Tables
        db.market_assets = loadPayloadTable('market_assets', 'listing_id');
        db.market_sku_variants = loadPayloadTable('market_sku_variants', 'sku_id');
        db.market_asset_media = loadPayloadTable('market_asset_media', 'media_id');
        db.market_reviews = loadPayloadTable('market_reviews', 'review_id');
        db.market_coupons = loadPayloadTable('market_coupons', 'coupon_id');
        db.market_discussions = loadPayloadTable('market_discussions', 'discussion_id');
        db.market_support_chats = loadPayloadTable('market_support_chats', 'chat_id');
        db.listing_verification_checks = loadPayloadTable('listing_verification_checks', 'check_id');

        // Load Missing Tables
        db.platform_financial_audit_logs = loadPayloadTable('platform_financial_audit_logs', 'log_id');
        db.automation_actions = loadPayloadTable('automation_actions', 'action_id');
        db.refund_requests = loadPayloadTable('refund_requests', 'request_id');

        // Load structured tables
        const loadTableRows = (tableName: string) => {
          try {
            if (!tablesInDb.has(tableName)) return null;
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
            status: r.status || 'active',
            type: r.type || (Number(r.is_system || r.is_official) === 1 ? 'official' : 'user_created'),
            owner_user_id: r.owner_user_id !== null && r.owner_user_id !== undefined ? Number(r.owner_user_id) : Number(r.owner_id),
            hide_member_list: r.hide_member_list ? Number(r.hide_member_list) : 0,
            is_locked: r.is_locked ? Number(r.is_locked) : 0,
            last_active_at: r.last_active_at ? Number(r.last_active_at) : Number(r.last_message_at || r.created_at)
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
            seller_id: Number(r.seller_id),
            title: r.title,
            description: r.description,
            price: Number(r.price),
            status: r.status,
            created_at: Number(r.created_at),
            seller_username: r.seller_username || undefined,
            discount_price: r.discount_price !== null && r.discount_price !== undefined ? Number(r.discount_price) : undefined,
            verification_status: r.verification_status || undefined,
            inventory_count: r.inventory_count !== null && r.inventory_count !== undefined ? Number(r.inventory_count) : undefined
          }));
        }

        const escrowTransactionsRows = loadTableRows('escrow_transactions');
        if (escrowTransactionsRows) {
          db.escrow_transactions = escrowTransactionsRows.map((r: any) => ({
            transaction_id: r.transaction_id,
            listing_id: r.listing_id,
            buyer_id: Number(r.buyer_id),
            seller_id: Number(r.seller_id),
            amount: Number(r.amount),
            status: r.status,
            created_at: Number(r.created_at),
            updated_at: Number(r.updated_at),
            coupon_applied: r.coupon_applied || undefined,
            sku_variant_id: r.sku_variant_id || undefined,
            platform_fee: r.platform_fee !== null && r.platform_fee !== undefined ? Number(r.platform_fee) : undefined,
            payout_amount: r.payout_amount !== null && r.payout_amount !== undefined ? Number(r.payout_amount) : undefined,
            sandbox_logs: r.sandbox_logs || undefined,
            sandbox_state: r.sandbox_state || undefined
          }));
        }

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
          try {
            const conn = new DatabaseSync(DB_FILE);
            const loadTable = (tableName: string) => {
              const rows = conn.prepare(`SELECT payload FROM ${tableName}`).all() as any[];
              return rows.map(r => {
                try {
                  return JSON.parse(decryptData(r.payload));
                } catch (decErr) {
                  console.error(`[SYS-SECURE] CRITICAL DECRYPTION FAILURE in legacy table ${tableName}:`, decErr);
                  setDecryptionErrorDetected(true);
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
            db.reports = loadTable('reports') || [];
            db.recovery_events = loadTable('recovery_events');
            db.suspicious_events = loadTable('suspicious_events');
            db.audit_logs = loadTable('audit_logs');
            db.peer_relationships = loadTable('peer_relationships') || [];
            db.friend_requests = loadTable('friend_requests') || [];
            db.join_requests = loadTable('join_requests') || [];
            try {
              conn.close?.();
            } catch (_) {}
            
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
            setDb(JSON.parse(decryptedData));
            sqliteLoaded = true;
            executeSaveDb(); // This will save directly to SQLite SQLITE_FILE
          } catch (err: any) {
            console.warn('[SYS-SECURE] Local state DB file cannot be decrypted or parsed. Initiating clean state recovery:', err.message || err);
            try {
              const backupPath = `${DB_FILE}.corrupt_${Date.now()}`;
              fs.renameSync(DB_FILE, backupPath);
            } catch (_) {}
          }
        }
      }
    }
    
    if (!sqliteLoaded) {
      setDb({ ...defaultDb });
      executeSaveDb();
    }
    
    ensureSeededIntegrity();
    setupAuditLogProxy();

    // Clear any conversational messages users had with Velum system bot
    if (db.messages) {
      const originalCount = db.messages.length;
      db.messages = db.messages.filter(m => {
        const isVelumDm = m.room_id && m.room_id.startsWith('dm_velum_');
        if (!isVelumDm) return true;
        const isWelcome = m.message_id && m.message_id.startsWith('msg_velum_welcome_');
        const isSaPromo = m.message_id && m.message_id.startsWith('msg_sa_promo_');
        return isWelcome || isSaPromo;
      });
      if (db.messages.length !== originalCount) {
        console.log(`[CLEANUP] Pruned ${originalCount - db.messages.length} conversational messages from Velum bot DMs.`);
        executeSaveDb();
      }
    }

    // Migration: Update existing users who have generic welcome messages to have generated recovery keys
    if (db.users && db.messages) {
      const hashArgon2idLocal = async (plainText: string, saltBuffer: Buffer) => {
        const { hashArgon2id } = await import('../crypto.js');
        return hashArgon2id(plainText, saltBuffer);
      };
      
      Promise.all(db.users.map(async (u) => {
        if (u.user_id === 999 || u.role === 'CLI_ADMIN') return null;
        
        const roomId = `dm_velum_${u.user_id}`;
        let welcomeMsg = db.messages.find(m => m.room_id === roomId && m.user_id === 999 && m.message_id && m.message_id.startsWith(`msg_velum_welcome_${u.user_id}`));
        if (!welcomeMsg) {
          welcomeMsg = db.messages.find(m => m.room_id === roomId && m.user_id === 999 && m.content && (m.content.includes('recovery key') || m.content.includes('Recovery Key')));
        }
        
        const hasShortKey = welcomeMsg && welcomeMsg.content && welcomeMsg.content.includes('Your recovery key is: VEL-REC-');
        if (!welcomeMsg || !hasShortKey) {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let code = '';
          for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          const rawKey = `VEL-REC-${code}`;
          const keySalt = crypto.randomBytes(32);
          const hashHex = await hashArgon2idLocal(rawKey, keySalt);
          u.recovery_key_hash = `argon2id:${keySalt.toString('hex')}:${hashHex}`;
          
          const formattedMsg = `Welcome to Velum.\n\nYour recovery key is: ${rawKey}\n\nPlease store this key in a secure offline location. It is required to recover your account if you forget your password.`;
          
          if (welcomeMsg) {
            (welcomeMsg as any).content = formattedMsg;
          } else {
            const newWelcomeMsg = {
              message_id: `msg_velum_welcome_${u.user_id}_${Date.now()}`,
              room_id: roomId,
              user_id: 999,
              content: formattedMsg,
              is_encrypted: false,
              reply_to: null,
              timestamp: new Date().toISOString(),
              expires_in: null,
              status: 'sent',
              type: 'text'
            } as any;
            db.messages.push(newWelcomeMsg);
          }
          return { username: u.username, rawKey };
        }
        return null;
      })).then((results) => {
        const migrated = results.filter(Boolean);
        if (migrated.length > 0) {
          console.log(`[MIGRATION] Regenerated recovery keys for ${migrated.length} existing users:`, migrated.map(m => m?.username));
          executeSaveDb();
        }
      }).catch(err => {
        console.error('[MIGRATION] Error migrating recovery keys:', err);
      });
    }

    setDbLoaded(true);
    setLastSavedDbJson(JSON.stringify(db));
    try {
      rebuildBlocksCache();
    } catch (_) {}
  } catch (error: any) {
    console.error('[SYS-SECURE] Failed loading state database. Falling back to fresh seed:', error);
    setDb({ ...defaultDb });
    ensureSeededIntegrity();
    setupAuditLogProxy();
    try {
      executeSaveDb();
    } catch (_) {}
    setDbLoaded(true);
    setLastSavedDbJson(JSON.stringify(db));
    try {
      rebuildBlocksCache();
    } catch (_) {}
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
  
  const plainJson = JSON.stringify(db);
  if (plainJson === lastSavedDbJson && !legacyDecryptionSucceeded) {
    return;
  }
  
  setIsSaving(true);
  try {
    const conn = initSqlite();
    if (conn) {
      conn.exec('BEGIN');
      const saveTable = (tableName: string, rows: any[], idField: string) => {
        try {
          conn.exec(`DELETE FROM ${tableName}`);
          const stmt = conn.prepare(`INSERT OR REPLACE INTO ${tableName} (id, payload) VALUES (?, ?)`);
          for (const row of rows || []) {
            const rawId = row[idField];
            const id = (rawId !== undefined && rawId !== null && rawId !== '') ? String(rawId) : generateUlid();
            
            if (row[idField] === undefined || row[idField] === null || row[idField] === '') {
              row[idField] = id;
            }

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
      saveTable('reports', db.reports || [], 'report_id');
      saveTable('recovery_events', db.recovery_events, 'event_id');
      saveTable('suspicious_events', db.suspicious_events, 'event_id');
      saveTable('audit_logs', db.audit_logs, 'log_id');
      saveTable('friend_requests', db.friend_requests || [], 'request_id');
      saveTable('peer_relationships', db.peer_relationships || [], 'id');
      saveTable('join_requests', db.join_requests || [], 'id');
      saveTable('node_overwrites', db.node_overwrites || [], 'overwrite_id');

      // Save Banking Tables
      saveTable('user_wallets', db.user_wallets || [], 'user_id');
      saveTable('wallet_ledger_entries', db.wallet_ledger_entries || [], 'entry_id');
      saveTable('recharge_requests', db.recharge_requests || [], 'request_id');
      saveTable('withdrawal_requests', db.withdrawal_requests || [], 'request_id');
      saveTable('kyc_verifications', db.kyc_verifications || [], 'kyc_id');
      saveTable('payment_methods', db.payment_methods || [], 'payment_method_id');
      saveTable('external_financial_accounts', db.external_financial_accounts || [], 'account_token');
      saveTable('external_processor_events', db.external_processor_events || [], 'event_id');
      saveTable('wallet_balances', db.wallet_balances || [], 'balance_id');
      saveTable('currencies', db.currencies || [], 'currency_code');
      saveTable('exchange_rates', db.exchange_rates || [], 'rate_id');
      saveTable('platform_admins', db.platform_admins || [], 'admin_id');

      // Save Marketplace Tables
      saveTable('market_assets', db.market_assets || [], 'listing_id');
      saveTable('market_sku_variants', db.market_sku_variants || [], 'sku_id');
      saveTable('market_asset_media', db.market_asset_media || [], 'media_id');
      saveTable('market_reviews', db.market_reviews || [], 'review_id');
      saveTable('market_coupons', db.market_coupons || [], 'coupon_id');
      saveTable('market_discussions', db.market_discussions || [], 'discussion_id');
      saveTable('market_support_chats', db.market_support_chats || [], 'chat_id');
      saveTable('listing_verification_checks', db.listing_verification_checks || [], 'check_id');

      // Save Missing Tables
      saveTable('platform_financial_audit_logs', db.platform_financial_audit_logs || [], 'log_id');
      saveTable('automation_actions', db.automation_actions || [], 'action_id');
      saveTable('refund_requests', db.refund_requests || [], 'request_id');

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
          const stmt = conn.prepare(`INSERT OR REPLACE INTO market_listings (listing_id, seller_id, title, description, price, status, created_at, seller_username, discount_price, verification_status, inventory_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
          for (const l of db.market_listings || []) {
            stmt.run(
              l.listing_id,
              String(l.seller_id),
              l.title,
              l.description || '',
              Number(l.price || 0),
              l.status || 'ACTIVE',
              Number(l.created_at || Date.now()),
              l.seller_username || null,
              l.discount_price !== undefined && l.discount_price !== null ? Number(l.discount_price) : null,
              l.verification_status || null,
              l.inventory_count !== undefined && l.inventory_count !== null ? Number(l.inventory_count) : null
            );
          }
        } catch (err) {
          console.error('[SYS-SECURE] Save market_listings SQLite failed:', err);
        }
      };

      const saveEscrowTransactionsDb = () => {
        try {
          conn.exec(`DELETE FROM escrow_transactions`);
          const stmt = conn.prepare(`INSERT OR REPLACE INTO escrow_transactions (transaction_id, listing_id, buyer_id, seller_id, amount, status, created_at, updated_at, coupon_applied, sku_variant_id, platform_fee, payout_amount, sandbox_logs, sandbox_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
          for (const t of db.escrow_transactions || []) {
            stmt.run(
              t.transaction_id,
              t.listing_id,
              String(t.buyer_id),
              String(t.seller_id),
              Number(t.amount || 0),
              t.status,
              Number(t.created_at || Date.now()),
              Number(t.updated_at || Date.now()),
              t.coupon_applied || null,
              t.sku_variant_id || null,
              t.platform_fee !== undefined && t.platform_fee !== null ? Number(t.platform_fee) : null,
              t.payout_amount !== undefined && t.payout_amount !== null ? Number(t.payout_amount) : null,
              t.sandbox_logs ? JSON.stringify(t.sandbox_logs) : null,
              t.sandbox_state ? JSON.stringify(t.sandbox_state) : null
            );
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
    
    setLastSavedDbJson(plainJson);
    rebuildBlocksCache();
    setLegacyDecryptionSucceeded(false);
    setIsSaving(false);
    
    backupDbToCloud().catch(err => {
      console.error('[SYS-SECURE] Failed background syncing database state to Neon PostgreSQL:', err);
    });
  } catch (err) {
    setIsSaving(false);
    console.error('[SYS-SECURE] Critical SQLite save fail:', err);
  }
}

// Ensure any pending throttled saves are flushed to disk before the container exits
process.on('SIGTERM', () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
    executeSaveDb();
  }
});
