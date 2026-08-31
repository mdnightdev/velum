import { desc, sql, eq, or } from 'drizzle-orm';
import { db } from '../../../server/v2/db/client.js';
import { users } from '../../../server/v2/db/schema/users.js';
import { auditLogs } from '../../../server/v2/db/schema/audit_logs.js';
import { blacklist } from '../../../server/v2/db/schema/blacklist.js';
import { reports } from '../../../server/v2/db/schema/tickets.js';
import { sessions } from '../../../server/v2/db/schema/sessions.js';
import { userDevices, devices, ipAddresses } from '../../../server/v2/db/schema/devices.js';
import { userRepository } from '../../../server/v2/repositories/userRepository.js';
import { printTable } from '../table.js';
import { guardProtectedUser } from '../protection.js';
import type { CommandContext } from '../types.js';

export async function handleSanctions(ctx: CommandContext): Promise<void> {
  const { sub, rawArgs, resolveUser, logAudit } = ctx;

  if (sub === 'history') {
    const target = rawArgs[0];
    try {
      let query;
      if (target) {
        query = await db.select().from(auditLogs).where(
          sql`(${auditLogs.targetId} = ${target} OR ${auditLogs.targetId} ILIKE ${`%${target}%`}) AND (
              ${auditLogs.action} ILIKE '%BAN%' OR 
              ${auditLogs.action} ILIKE '%MUTE%' OR 
              ${auditLogs.action} ILIKE '%JAIL%' OR 
              ${auditLogs.action} ILIKE '%RESTRICT%' OR 
              ${auditLogs.action} ILIKE '%FREEZE%' OR 
              ${auditLogs.action} ILIKE '%SEIZE%' OR 
              ${auditLogs.action} ILIKE '%BLACKLIST%' OR 
              ${auditLogs.action} ILIKE '%SANCTION%' OR 
              ${auditLogs.action} ILIKE '%PURGE%')`
        ).orderBy(desc(auditLogs.timestamp)).limit(50);
      } else {
        query = await db.select().from(auditLogs).where(
          sql`${auditLogs.action} ILIKE '%BAN%' OR 
              ${auditLogs.action} ILIKE '%MUTE%' OR 
              ${auditLogs.action} ILIKE '%JAIL%' OR 
              ${auditLogs.action} ILIKE '%RESTRICT%' OR 
              ${auditLogs.action} ILIKE '%FREEZE%' OR 
              ${auditLogs.action} ILIKE '%SEIZE%' OR 
              ${auditLogs.action} ILIKE '%BLACKLIST%' OR 
              ${auditLogs.action} ILIKE '%SANCTION%' OR 
              ${auditLogs.action} ILIKE '%PURGE%'`
        ).orderBy(desc(auditLogs.timestamp)).limit(50);
      }

      if (query.length > 0) {
        printTable(query.map(l => ({
          Target: l.targetId,
          Punishment: l.action,
          Reason: l.reason,
          IssuedBy: l.adminName || 'CLI',
          Date: l.timestamp ? new Date(l.timestamp).toISOString().split('T')[0] : '-'
        })));
      } else {
        console.log('No user punishment history found.');
      }
    } catch (err) {
      console.log(`[ERROR] Failed to fetch punishment history: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'flags') {
    const target = rawArgs[0];
    try {
      let targetUser = target ? await resolveUser(target) : null;
      let reportList;

      if (targetUser) {
        reportList = await db.select().from(reports).where(
          eq(reports.targetUserId, targetUser.id)
        ).orderBy(desc(reports.createdAt)).limit(50);
      } else {
        reportList = await db.select().from(reports).orderBy(desc(reports.createdAt)).limit(50);
      }

      if (reportList.length > 0) {
        printTable(reportList.map(r => ({
          ID: r.id,
          TargetID: r.targetUserId,
          Type: r.type,
          Priority: r.priority,
          Reason: r.reason,
          Status: r.status,
          ReportedDate: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '-'
        })));
      } else {
        console.log(target ? `No abuse or misconduct reports found for "${target}".` : 'No active abuse or misconduct reports.');
      }
    } catch (err) {
      console.log(`[ERROR] Failed to fetch risk flags: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'blacklist') {
    const target = rawArgs[0];
    const reason = rawArgs.slice(1).join(' ') || 'TOS Violation / Fraud / Malicious Activity';

    // If no argument or explicitly 'list', render the full blacklist library
    if (!target || target === 'list') {
      try {
        const entries = await db.select().from(blacklist).orderBy(desc(blacklist.createdAt)).limit(100);
        if (entries.length > 0) {
          printTable(entries.map(e => ({
            ID: e.id,
            Type: e.type,
            Value: e.value,
            Reason: e.reason,
            BannedBy: e.bannedBy,
            Date: e.createdAt ? new Date(e.createdAt).toISOString().split('T')[0] : '-'
          })));
        } else {
          console.log('Blacklist store is currently empty.');
        }
      } catch (err) {
        console.log(`[ERROR] Failed to fetch blacklist store: ${(err as Error).message}`);
      }
      return;
    }

    // Automatic Ecosystem Harvesting for User or Target
    try {
      const user = await resolveUser(target);
      if (user) {
        if (!guardProtectedUser(user.id, 'blacklist')) return;

        let harvestedIps = new Set<string>();
        let harvestedDevices = new Set<string>();
        let harvestedFingerprints = new Set<string>();

        // 1. Harvest user's active & past session IPs
        const sessList = await db.select().from(sessions).where(eq(sessions.userId, user.id));
        sessList.forEach(s => { if (s.ipAddress) harvestedIps.add(s.ipAddress); });

        const ipList = await db.select().from(ipAddresses).where(eq(ipAddresses.userId, user.id));
        ipList.forEach(ip => { if (ip.ipAddress) harvestedIps.add(ip.ipAddress); });

        // 2. Harvest user's registered devices & fingerprints
        const devList = await db.select().from(userDevices).where(eq(userDevices.userId, user.id));
        for (const ud of devList) {
          if (ud.deviceId) {
            harvestedDevices.add(ud.deviceId);
            const devRecords = await db.select().from(devices).where(eq(devices.deviceId, ud.deviceId)).limit(1);
            if (devRecords[0]?.deviceFingerprint) {
              harvestedFingerprints.add(devRecords[0].deviceFingerprint);
            }
          }
        }

        // 3. Atomically ingest entire ecosystem into blacklist library
        const entriesToInsert = [
          { userId: user.id, type: 'USERNAME', value: user.username, reason, bannedBy: 'CLI_ADMIN' }
        ];

        for (const ip of harvestedIps) {
          entriesToInsert.push({ userId: user.id, type: 'IP', value: ip, reason: `Ecosystem IP: ${reason}`, bannedBy: 'CLI_ADMIN' });
        }
        for (const devId of harvestedDevices) {
          entriesToInsert.push({ userId: user.id, type: 'DEVICE_ID', value: devId, reason: `Ecosystem Device: ${reason}`, bannedBy: 'CLI_ADMIN' });
        }
        for (const fp of harvestedFingerprints) {
          entriesToInsert.push({ userId: user.id, type: 'DEVICE_FINGERPRINT', value: fp, reason: `Ecosystem Fingerprint: ${reason}`, bannedBy: 'CLI_ADMIN' });
        }

        for (const entry of entriesToInsert) {
          await db.insert(blacklist).values(entry).onConflictDoNothing();
        }

        // 4. Terminate sessions and mark account as BLOCKED
        await db.delete(sessions).where(eq(sessions.userId, user.id));
        await userRepository.update(user.id, { role: 'BLOCKED' });

        console.log(`[OK] Blacklisted ${user.username}. Harvested ecosystem: ${harvestedIps.size} IPs, ${harvestedDevices.size} devices, ${harvestedFingerprints.size} fingerprints into blacklist store.`);
        await logAudit('/sanctions/blacklist', user.username, `Automated ecosystem blacklist: ${reason}`);
      } else {
        // Direct value addition (IP, Device Hash, or Identifier)
        const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(target);
        const type = isIp ? 'IP' : 'IDENTIFIER';

        await db.insert(blacklist).values({
          type,
          value: target,
          reason,
          bannedBy: 'CLI_ADMIN'
        }).onConflictDoNothing();

        console.log(`[OK] Added ${type} "${target}" to blacklist store.`);
        await logAudit('/sanctions/blacklist', target, `Blacklisted ${type}: ${reason}`);
      }
    } catch (err) {
      console.log(`[ERROR] Failed to execute blacklist: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'whitelist') {
    const [target, ...reasonParts] = rawArgs;
    if (!target) {
      console.log('Usage: whitelist <user_or_ip_or_device_or_id> [reason]');
      return;
    }
    const reason = reasonParts.join(' ') || 'Admin pardon / whitelist exemption';

    try {
      const user = await resolveUser(target);
      if (user) {
        // Remove user's full ecosystem entries from blacklist
        await db.delete(blacklist).where(
          or(
            eq(blacklist.userId, user.id),
            eq(blacklist.value, user.username)
          )
        );

        // Restore user role if currently BLOCKED
        if (user.role === 'BLOCKED') {
          await userRepository.update(user.id, { role: 'USER' });
        }

        console.log(`[OK] Whitelisted ${user.username} and purged ecosystem entries from blacklist store.`);
        await logAudit('/sanctions/whitelist', user.username, `Pardoned user: ${reason}`);
      } else {
        const numId = parseInt(target, 10);
        if (!isNaN(numId)) {
          await db.delete(blacklist).where(eq(blacklist.id, numId));
        } else {
          await db.delete(blacklist).where(eq(blacklist.value, target));
        }
        console.log(`[OK] Whitelisted and removed "${target}" from blacklist store.`);
        await logAudit('/sanctions/whitelist', target, `Pardoned entity: ${reason}`);
      }
    } catch (err) {
      console.log(`[ERROR] Failed to whitelist target: ${(err as Error).message}`);
    }
    return;
  }
}
