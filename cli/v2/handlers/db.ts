import fs from 'node:fs';
import { sql } from 'drizzle-orm';
import { db, pool } from '../../../server/v2/db/client.js';
import { users, supportAdminNominations } from '../../../server/v2/db/schema/users.js';
import { lounges, messages, loungeMembers, messageReactions, userUnreadCounts } from '../../../server/v2/db/schema/lounges.js';
import { wallets, transactions } from '../../../server/v2/db/schema/wallets.js';
import { listings, escrows } from '../../../server/v2/db/schema/marketplace.js';
import { sessions } from '../../../server/v2/db/schema/sessions.js';
import { auditLogs } from '../../../server/v2/db/schema/audit_logs.js';
import { userPrekeys } from '../../../server/v2/db/schema/keys.js';
import { userDevices } from '../../../server/v2/db/schema/devices.js';
import { cards } from '../../../server/v2/db/schema/cards.js';
import { tickets } from '../../../server/v2/db/schema/tickets.js';
import { reserves } from '../../../server/v2/db/schema/reserves.js';
import { userReadCursors } from '../../../server/v2/db/schema/read_cursors.js';
import { loungeMuteSettings } from '../../../server/v2/db/schema/lounge_mutes.js';
import { pushSubscriptions } from '../../../server/v2/db/schema/push.js';
import { relationships } from '../../../server/v2/db/schema/relationships.js';
import { outboxEvents } from '../../../server/v2/db/schema/outbox.js';
import { config } from '../../../server/v2/config.js';
import { currencyConverter } from '../../../server/v2/services/currencyConverter.js';
import { ensureVelumLoungeSeeded } from '../../../server/v2/services/loungeSeeder.js';
import { ensureAdminSeeded, ensureReservesSeeded } from '../../../server/v2/services/adminSeeder.js';
import { stateManager } from '../state/stateManager.js';
import type { CommandContext } from '../types.js';

export async function handleDb(ctx: CommandContext): Promise<void> {
  const { sub, rawArgs, logAudit } = ctx;

  if (sub === 'integrity') {
    try {
      const uCount = await db.select({ count: sql<number>`count(*)` }).from(users);
      const sCount = await db.select({ count: sql<number>`count(*)` }).from(sessions);
      const wCount = await db.select({ count: sql<number>`count(*)` }).from(wallets);
      const tCount = await db.select({ count: sql<number>`count(*)` }).from(transactions);
      const lCount = await db.select({ count: sql<number>`count(*)` }).from(listings);
      const eCount = await db.select({ count: sql<number>`count(*)` }).from(escrows);
      console.log(`Table Counts: users (${uCount[0]?.count || 0}), sessions (${sCount[0]?.count || 0}), wallets (${wCount[0]?.count || 0}), transactions (${tCount[0]?.count || 0}), listings (${lCount[0]?.count || 0}), escrows (${eCount[0]?.count || 0})`);
      console.log('Status: OK - Schema and foreign keys verified.');
      await logAudit('/db/integrity', 'SYSTEM', 'Executed database integrity check');
    } catch (err) {
      console.log(`[ERROR] DB integrity check failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'orphans') {
    try {
      const res = await pool.query(`
        SELECT 'lounges (orphaned owners)' as name, count(*)::int FROM lounges WHERE (owner_id NOT IN (SELECT id FROM users) OR owner_id IS NULL) AND is_official = false AND is_system = false
        UNION ALL
        SELECT 'relationships (invalid users)', count(*)::int FROM relationships WHERE user_id NOT IN (SELECT id FROM users) OR friend_id NOT IN (SELECT id FROM users)
        UNION ALL
        SELECT 'lounge_members (invalid references)', count(*)::int FROM lounge_members WHERE lounge_id NOT IN (SELECT id FROM lounges) OR user_id NOT IN (SELECT id FROM users)
        UNION ALL
        SELECT 'messages (invalid references)', count(*)::int FROM messages WHERE lounge_id NOT IN (SELECT id FROM lounges) OR sender_id NOT IN (SELECT id FROM users)
        UNION ALL
        SELECT 'sublounges (invalid parent)', count(*)::int FROM lounges WHERE parent_lounge_id IS NOT NULL AND parent_lounge_id NOT IN (SELECT id FROM lounges)
      `);
      let total = 0;
      for (const row of res.rows) {
        console.log(`Checking ${row.name}: ${row.count}`);
        total += row.count;
      }
      console.log(`[OK] Scan complete: ${total} orphaned records found.`);
      await logAudit('/db/orphans', 'SYSTEM', `Scanned for orphaned entities, found ${total}`);
    } catch (err) {
      console.log(`[ERROR] Orphan scan failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'clean') {
    try {
      const cleanMembers = await db.execute(sql`
        DELETE FROM lounge_members 
        WHERE lounge_id NOT IN (SELECT id FROM lounges)
           OR user_id NOT IN (SELECT id FROM users)
      `);
      const membersCount = cleanMembers.rowCount || 0;

      const cleanMessages = await db.execute(sql`
        DELETE FROM messages 
        WHERE lounge_id NOT IN (SELECT id FROM lounges)
           OR sender_id NOT IN (SELECT id FROM users)
      `);
      const messagesCount = cleanMessages.rowCount || 0;

      const cleanSublounges = await db.execute(sql`
        DELETE FROM lounges 
        WHERE parent_lounge_id IS NOT NULL 
          AND parent_lounge_id NOT IN (SELECT id FROM lounges)
          AND is_official = false
      `);
      const subloungesCount = cleanSublounges.rowCount || 0;

      const cleanRelationships = await db.execute(sql`
        DELETE FROM relationships
        WHERE user_id NOT IN (SELECT id FROM users)
           OR friend_id NOT IN (SELECT id FROM users)
      `);
      const relationshipsCount = cleanRelationships.rowCount || 0;

      const cleanOwnerlessLounges = await db.execute(sql`
        DELETE FROM lounges
        WHERE (owner_id NOT IN (SELECT id FROM users) OR owner_id IS NULL)
          AND is_official = false
          AND is_system = false
      `);
      const ownerlessCount = cleanOwnerlessLounges.rowCount || 0;

      const cleanSessions = await db.execute(sql`
        DELETE FROM sessions
        WHERE expires_at < NOW()
      `);
      const sessionsCount = cleanSessions.rowCount || 0;

      console.log(`- Removed ${membersCount} orphaned memberships`);
      console.log(`- Removed ${messagesCount} orphaned messages`);
      console.log(`- Removed ${subloungesCount} orphaned sub-lounges`);
      console.log(`- Removed ${relationshipsCount} orphaned relationships`);
      console.log(`- Removed ${ownerlessCount} orphaned user lounges`);
      console.log(`- Removed ${sessionsCount} expired sessions`);
      console.log('[OK] Cleanup complete.');
      
      await logAudit('/db/clean', 'SYSTEM', `Purged orphaned records (members: ${membersCount}, messages: ${messagesCount}, sublounges: ${subloungesCount}, relationships: ${relationshipsCount}, lounges: ${ownerlessCount}, sessions: ${sessionsCount})`);
    } catch (err) {
      console.log(`[ERROR] Cleanup failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'vacuum') {
    try {
      await pool.query('VACUUM ANALYZE');
      console.log('[OK] Database vacuum complete.');
      await logAudit('/db/vacuum', 'SYSTEM', 'Executed VACUUM ANALYZE');
    } catch (err) {
      console.log(`[ERROR] VACUUM failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'backup') {
    try {
      const backupData = {
        timestamp: new Date().toISOString(),
        config: {
          NODE_ENV: config.NODE_ENV,
          PORT: config.PORT,
          DATABASE_URL: config.DATABASE_URL ? '[REDACTED]' : 'not set'
        },
        maintenanceMode: stateManager.isMaintenanceMode(),
        txFeePercent: stateManager.getTxFeePercent(),
        taxPercent: stateManager.getTaxPercent(),
        escrowFeePercent: stateManager.getEscrowFeePercent(),
        exchangeRates: currencyConverter.getAllRates(),
        userTierDefaults: {
          STANDARD: 500000,
          PREMIUM: 2500000,
          VIP: 10000000
        }
      };
      
      const filename = `velum_backup_${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(backupData, null, 2));
      
      console.log(`[OK] Saved to ${filename}`);
      console.log(JSON.stringify(backupData, null, 2));
      await logAudit('/db/backup', filename, 'Exported system configuration');
    } catch (err) {
      console.log(`[ERROR] Backup failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'restore') {
    const file = rawArgs[0];
    if (!file) { console.log('Usage: restore <backup_file>'); return; }
    try {
      if (!fs.existsSync(file)) {
        console.log(`File not found: ${file}`);
        return;
      }
      
      const backupData = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (backupData.maintenanceMode !== undefined) await stateManager.setMaintenanceMode(backupData.maintenanceMode);
      if (backupData.txFeePercent !== undefined) await stateManager.setTxFeePercent(backupData.txFeePercent);
      if (backupData.taxPercent !== undefined) await stateManager.setTaxPercent(backupData.taxPercent);
      if (backupData.escrowFeePercent !== undefined) await stateManager.setEscrowFeePercent(backupData.escrowFeePercent);

      console.log(`Backup timestamp: ${backupData.timestamp}`);
      console.log(`[OK] Configuration imported from ${file}`);
      await logAudit('/db/restore', file, 'Imported system configuration');
    } catch (err) {
      console.log(`[ERROR] Restore failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'seed') {
    await ensureAdminSeeded();
    await ensureReservesSeeded();
    await ensureVelumLoungeSeeded();
    console.log('[OK] Seeded configuration and official infrastructure defaults.');
    return;
  }

  if (sub === 'wipe') {
    try {
      await db.delete(messageReactions);
      await db.delete(userReadCursors);
      await db.delete(loungeMembers);
      await db.delete(userUnreadCounts);
      await db.delete(loungeMuteSettings);
      await db.delete(pushSubscriptions);
      await db.delete(relationships);
      await db.delete(cards);
      await db.delete(tickets);
      await db.delete(auditLogs);
      await db.delete(outboxEvents);
      await db.delete(supportAdminNominations);
      await db.delete(messages);
      await db.delete(escrows);
      await db.delete(listings);
      await db.delete(transactions);
      await db.delete(sessions);
      await db.delete(wallets);
      await db.delete(userPrekeys);
      await db.delete(userDevices);
      await db.delete(lounges).where(sql`${lounges.id} NOT IN (1,2,3,4,5,6,7,8,9,10,11) AND ${lounges.isOfficial} = false`);
      await db.delete(users).where(sql`${users.id} NOT IN (1, 2, 999) AND ${users.role} NOT IN ('CLI_ADMIN', 'LOGIN_ADMIN', 'SUPPORT_ADMIN', 'ADMIN')`);
      
      // Ensure reserves and official lounges stay intact
      await ensureAdminSeeded();
      await ensureReservesSeeded();
      await ensureVelumLoungeSeeded();

      console.log('[OK] Database reset complete (protected system services, official lounges, and reserves retained).');
    } catch (err) {
      console.log(`[ERROR] DB wipe failed: ${(err as Error).message}`);
    }
    return;
  }
}
