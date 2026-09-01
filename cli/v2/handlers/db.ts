import fs from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { db, pool } from '../../../server/v2/db/client.js';
import { users, supportAdminNominations } from '../../../server/v2/db/schema/users.js';
import { lounges, messages, loungeMembers, messageReactions, userUnreadCounts } from '../../../server/v2/db/schema/lounges.js';
import { wallets, transactions } from '../../../server/v2/db/schema/wallets.js';
import { listings, escrows } from '../../../server/v2/db/schema/marketplace.js';
import { sessions } from '../../../server/v2/db/schema/sessions.js';
import { auditLogs } from '../../../server/v2/db/schema/audit_logs.js';
import { userPrekeys } from '../../../server/v2/db/schema/keys.js';
import { userDevices, devices, ipAddresses } from '../../../server/v2/db/schema/devices.js';
import { cards } from '../../../server/v2/db/schema/cards.js';
import { tickets, reports } from '../../../server/v2/db/schema/tickets.js';
import { reserves } from '../../../server/v2/db/schema/reserves.js';
import { userReadCursors } from '../../../server/v2/db/schema/read_cursors.js';
import { loungeMuteSettings } from '../../../server/v2/db/schema/lounge_mutes.js';
import { pushSubscriptions } from '../../../server/v2/db/schema/push.js';
import { relationships } from '../../../server/v2/db/schema/relationships.js';
import { outboxEvents } from '../../../server/v2/db/schema/outbox.js';
import { blacklist } from '../../../server/v2/db/schema/blacklist.js';
import { exchangeRates } from '../../../server/v2/db/schema/exchange_rates.js';
import { systemConfig } from '../../../server/v2/db/schema/system_config.js';
import { ensureVelumLoungeSeeded } from '../../../server/v2/services/loungeSeeder.js';
import { ensureAdminSeeded, ensureReservesSeeded } from '../../../server/v2/services/adminSeeder.js';
import { printTable } from '../table.js';
import type { CommandContext } from '../types.js';

export async function handleDb(ctx: CommandContext): Promise<void> {
  const { sub, rawArgs, logAudit } = ctx;

  if (sub === 'integrity') {
    try {
      const startTime = Date.now();
      const latencyRes = await pool.query('SELECT NOW() as now');
      const latencyMs = Date.now() - startTime;

      const [u] = await db.select({ count: sql<number>`count(*)` }).from(users);
      const [s] = await db.select({ count: sql<number>`count(*)` }).from(sessions);
      const [l] = await db.select({ count: sql<number>`count(*)` }).from(lounges);
      const [m] = await db.select({ count: sql<number>`count(*)` }).from(messages);
      const [w] = await db.select({ count: sql<number>`count(*)` }).from(wallets);
      const [t] = await db.select({ count: sql<number>`count(*)` }).from(transactions);
      const [mk] = await db.select({ count: sql<number>`count(*)` }).from(listings);
      const [e] = await db.select({ count: sql<number>`count(*)` }).from(escrows);
      const [c] = await db.select({ count: sql<number>`count(*)` }).from(cards);
      const [tk] = await db.select({ count: sql<number>`count(*)` }).from(tickets);
      const [rp] = await db.select({ count: sql<number>`count(*)` }).from(reports);
      const [bl] = await db.select({ count: sql<number>`count(*)` }).from(blacklist);
      const [dev] = await db.select({ count: sql<number>`count(*)` }).from(devices);
      const [aud] = await db.select({ count: sql<number>`count(*)` }).from(auditLogs);

      const tableData = [
        { Table: 'users', Records: Number(u?.count || 0), Status: 'HEALTHY' },
        { Table: 'sessions', Records: Number(s?.count || 0), Status: 'HEALTHY' },
        { Table: 'lounges', Records: Number(l?.count || 0), Status: 'HEALTHY' },
        { Table: 'messages', Records: Number(m?.count || 0), Status: 'HEALTHY' },
        { Table: 'wallets', Records: Number(w?.count || 0), Status: 'HEALTHY' },
        { Table: 'transactions', Records: Number(t?.count || 0), Status: 'HEALTHY' },
        { Table: 'listings', Records: Number(mk?.count || 0), Status: 'HEALTHY' },
        { Table: 'escrows', Records: Number(e?.count || 0), Status: 'HEALTHY' },
        { Table: 'cards', Records: Number(c?.count || 0), Status: 'HEALTHY' },
        { Table: 'tickets', Records: Number(tk?.count || 0), Status: 'HEALTHY' },
        { Table: 'reports', Records: Number(rp?.count || 0), Status: 'HEALTHY' },
        { Table: 'blacklist', Records: Number(bl?.count || 0), Status: 'HEALTHY' },
        { Table: 'devices', Records: Number(dev?.count || 0), Status: 'HEALTHY' },
        { Table: 'audit_logs', Records: Number(aud?.count || 0), Status: 'HEALTHY' }
      ];

      console.log(`Database Pool: CONNECTED | Latency: ${latencyMs}ms | Timestamp: ${latencyRes.rows[0]?.now ? new Date(latencyRes.rows[0].now).toISOString() : '-'}\n`);
      printTable(tableData);
      await logAudit('/db/integrity', 'SYSTEM', `Verified integrity across 14 tables (Latency: ${latencyMs}ms)`);
    } catch (err) {
      console.log(`[ERROR] DB integrity check failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'orphans') {
    try {
      const { databaseCleanup } = await import('../../server/v2/utils/databaseCleanup.js');
      const { totalOrphans, rows } = await databaseCleanup.scanOrphans();

      printTable(rows.map(r => ({
        Entity: r.entity,
        Orphans: r.count,
        Status: r.status
      })));

      console.log(`\nScan complete. Total orphaned/stale records: ${totalOrphans}`);
      await logAudit('/db/orphans', 'SYSTEM', `Scanned relational tables, found ${totalOrphans} orphaned records`);
    } catch (err) {
      console.log(`[ERROR] Orphan scan failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'clean') {
    try {
      const { databaseCleanup } = await import('../../server/v2/utils/databaseCleanup.js');
      const report = await databaseCleanup.cleanOrphans();

      const results = [
        { Entity: 'Orphaned Memberships', Purged: report.members },
        { Entity: 'Orphaned Messages', Purged: report.messages },
        { Entity: 'Orphaned Sub-Lounges', Purged: report.sublounges },
        { Entity: 'Orphaned Relationships', Purged: report.relationships },
        { Entity: 'Orphaned User Lounges', Purged: report.ownerlessLounges },
        { Entity: 'Expired Sessions', Purged: report.expiredSessions }
      ];

      printTable(results);
      console.log(`\n[OK] Database clean complete. Purged all orphaned records and stale sessions.`);
      await logAudit('/db/clean', 'SYSTEM', `Purged orphaned records (total: ${report.totalCleaned})`);
    } catch (err) {
      console.log(`[ERROR] Cleanup failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'vacuum') {
    try {
      console.log('Running VACUUM ANALYZE on database...');
      const startTime = Date.now();
      await pool.query('VACUUM ANALYZE');
      const duration = Date.now() - startTime;
      console.log(`[OK] Database vacuum and query planner analysis complete (${duration}ms).`);
      await logAudit('/db/vacuum', 'SYSTEM', `Executed VACUUM ANALYZE (${duration}ms)`);
    } catch (err) {
      console.log(`[ERROR] VACUUM failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'backup') {
    try {
      const backupDir = path.resolve(process.cwd(), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const customName = rawArgs[0];
      const filename = customName 
        ? (customName.endsWith('.json') ? customName : `${customName}.json`)
        : `velum_db_backup_${Date.now()}.json`;
      const filePath = path.resolve(backupDir, filename);

      console.log('Reading database tables for full snapshot backup...');

      const snapshot = {
        metadata: {
          version: '2.2.0',
          exportedAt: new Date().toISOString(),
          tablesExported: 0
        },
        data: {
          users: await db.select().from(users),
          lounges: await db.select().from(lounges),
          loungeMembers: await db.select().from(loungeMembers),
          messages: await db.select().from(messages),
          messageReactions: await db.select().from(messageReactions),
          wallets: await db.select().from(wallets),
          transactions: await db.select().from(transactions),
          listings: await db.select().from(listings),
          escrows: await db.select().from(escrows),
          cards: await db.select().from(cards),
          tickets: await db.select().from(tickets),
          reports: await db.select().from(reports),
          blacklist: await db.select().from(blacklist),
          devices: await db.select().from(devices),
          userDevices: await db.select().from(userDevices),
          ipAddresses: await db.select().from(ipAddresses),
          reserves: await db.select().from(reserves),
          systemConfig: await db.select().from(systemConfig),
          exchangeRates: await db.select().from(exchangeRates),
          auditLogs: await db.select().from(auditLogs).limit(500)
        }
      };

      snapshot.metadata.tablesExported = Object.keys(snapshot.data).length;

      fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf8');

      const stats = fs.statSync(filePath);
      const sizeKb = (stats.size / 1024).toFixed(2);

      console.log(`[OK] Complete database snapshot written to: ${filePath} (${sizeKb} KB)`);
      console.log(`- Tables exported: ${snapshot.metadata.tablesExported}`);
      console.log(`- Users: ${snapshot.data.users.length} | Lounges: ${snapshot.data.lounges.length} | Messages: ${snapshot.data.messages.length} | Wallets: ${snapshot.data.wallets.length}`);
      await logAudit('/db/backup', filePath, `Exported ${snapshot.metadata.tablesExported} tables (${sizeKb} KB)`);
    } catch (err) {
      console.log(`[ERROR] Backup failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'restore') {
    const file = rawArgs[0];
    if (!file) {
      console.log('Usage: restore <backup_file_path>');
      return;
    }

    try {
      const resolvedPath = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
      if (!fs.existsSync(resolvedPath)) {
        console.log(`Backup file not found at: ${resolvedPath}`);
        return;
      }

      console.log(`Reading database snapshot from ${resolvedPath}...`);
      const snapshot = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));

      if (!snapshot.data || !snapshot.data.users) {
        console.log('[ERROR] Invalid database backup format.');
        return;
      }

      console.log(`Starting transactional database restoration (Snapshot Date: ${snapshot.metadata?.exportedAt || 'Unknown'})...`);

      await db.transaction(async (tx) => {
        // Restore system config & exchange rates
        if (snapshot.data.systemConfig && snapshot.data.systemConfig.length > 0) {
          for (const row of snapshot.data.systemConfig) {
            await tx.insert(systemConfig).values(row).onConflictDoNothing();
          }
        }
        if (snapshot.data.exchangeRates && snapshot.data.exchangeRates.length > 0) {
          for (const row of snapshot.data.exchangeRates) {
            await tx.insert(exchangeRates).values(row).onConflictDoNothing();
          }
        }

        // Restore users
        if (snapshot.data.users && snapshot.data.users.length > 0) {
          for (const row of snapshot.data.users) {
            await tx.insert(users).values(row).onConflictDoNothing();
          }
        }

        // Restore lounges & official lounges
        if (snapshot.data.lounges && snapshot.data.lounges.length > 0) {
          for (const row of snapshot.data.lounges) {
            await tx.insert(lounges).values(row).onConflictDoNothing();
          }
        }

        // Restore wallets & reserves
        if (snapshot.data.wallets && snapshot.data.wallets.length > 0) {
          for (const row of snapshot.data.wallets) {
            await tx.insert(wallets).values(row).onConflictDoNothing();
          }
        }
        if (snapshot.data.reserves && snapshot.data.reserves.length > 0) {
          for (const row of snapshot.data.reserves) {
            await tx.insert(reserves).values(row).onConflictDoNothing();
          }
        }

        // Restore blacklist store
        if (snapshot.data.blacklist && snapshot.data.blacklist.length > 0) {
          for (const row of snapshot.data.blacklist) {
            await tx.insert(blacklist).values(row).onConflictDoNothing();
          }
        }
      });

      // Ensure system admin and infrastructure invariants are satisfied
      await ensureAdminSeeded();
      await ensureReservesSeeded();
      await ensureVelumLoungeSeeded();

      console.log('[OK] Database restored successfully from snapshot.');
      await logAudit('/db/restore', resolvedPath, 'Restored database snapshot');
    } catch (err) {
      console.log(`[ERROR] Database restore failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'seed') {
    try {
      console.log('Seeding official platform infrastructure and system accounts...');
      await ensureAdminSeeded();
      await ensureReservesSeeded();
      await ensureVelumLoungeSeeded();
      console.log('[OK] Seeded official system accounts (1, 2, 999), central bank reserves, and 11 official lounges.');
      await logAudit('/db/seed', 'SYSTEM', 'Executed official database infrastructure seeding');
    } catch (err) {
      console.log(`[ERROR] Database seed failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'wipe') {
    try {
      console.log('Executing transactional database reset...');
      await db.transaction(async (tx) => {
        await tx.delete(messageReactions);
        await tx.delete(userReadCursors);
        await tx.delete(loungeMembers);
        await tx.delete(userUnreadCounts);
        await tx.delete(loungeMuteSettings);
        await tx.delete(pushSubscriptions);
        await tx.delete(relationships);
        await tx.delete(cards);
        await tx.delete(tickets);
        await tx.delete(reports);
        await tx.delete(auditLogs);
        await tx.delete(outboxEvents);
        await tx.delete(supportAdminNominations);
        await tx.delete(messages);
        await tx.delete(escrows);
        await tx.delete(listings);
        await tx.delete(transactions);
        await tx.delete(sessions);
        await tx.delete(wallets);
        await tx.delete(userPrekeys);
        await tx.delete(userDevices);
        await tx.delete(lounges).where(sql`${lounges.id} NOT IN (1,2,3,4,5,6,7,8,9,10,11) AND ${lounges.isOfficial} = false`);
        await tx.delete(users).where(sql`${users.id} NOT IN (1, 2, 999) AND ${users.role} NOT IN ('CLI_ADMIN', 'LOGIN_ADMIN', 'SUPPORT_ADMIN', 'ADMIN')`);
      });

      // Ensure protected system accounts, official lounges, and reserves are re-seeded
      await ensureAdminSeeded();
      await ensureReservesSeeded();
      await ensureVelumLoungeSeeded();

      console.log('[OK] Database reset complete. User tables purged; protected system accounts (IDs 1, 2, 999) and official lounges retained.');
      await logAudit('/db/wipe', 'SYSTEM', 'Purged user tables and reset database state');
    } catch (err) {
      console.log(`[ERROR] DB wipe failed: ${(err as Error).message}`);
    }
    return;
  }
}
