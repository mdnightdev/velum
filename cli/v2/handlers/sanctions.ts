import { desc, sql, eq, or } from 'drizzle-orm';
import { db } from '../../../server/v2/db/client.js';
import { users } from '../../../server/v2/db/schema/users.js';
import { auditLogs } from '../../../server/v2/db/schema/audit_logs.js';
import { blacklist } from '../../../server/v2/db/schema/blacklist.js';
import { reports } from '../../../server/v2/db/schema/tickets.js';
import { sessions } from '../../../server/v2/db/schema/sessions.js';
import { userDevices, devices, ipAddresses } from '../../../server/v2/db/schema/devices.js';
import { userRepository } from '../../../server/v2/repositories/userRepository.js';
import { printTable, printDetail } from '../table.js';
import { guardProtectedUser } from '../protection.js';
import { resolveUserStatus, simplifyRole } from './users.js';
import type { CommandContext } from '../types.js';

function formatPunishmentName(action: string): string {
  const act = action.toUpperCase();
  if (act.includes('ECOSYSTEM') || act.includes('BLACKLIST')) return 'Ecosystem Blacklist';
  if (act.includes('STRIKE_1')) return 'Strike 1 Warning';
  if (act.includes('STRIKE_2')) return 'Strike 2 Restriction';
  if (act.includes('STRIKE_3')) return 'Strike 3 Blacklist';
  if (act.includes('BAN')) return 'Account Ban';
  if (act.includes('MUTE')) return 'Global Mute';
  if (act.includes('JAIL') || act.includes('RESTRICT')) return 'Channel Restriction';
  if (act.includes('FREEZE') || act.includes('BANKF')) return 'Wallet Freeze';
  if (act.includes('SEIZE')) return 'Asset Seizure';
  if (act.includes('PURGE')) return 'Permanent Purge';
  return action.replace(/^\//, '');
}

export async function handleSanctions(ctx: CommandContext): Promise<void> {
  const { sub, rawArgs, resolveUser, logAudit } = ctx;

  if (sub === 'history') {
    const target = rawArgs[0];
    if (!target) {
      console.log('Usage: history <uid_or_username>');
      return;
    }

    try {
      const user = await resolveUser(target);
      const targetIdentifiers = user
        ? [String(user.id), user.username.toLowerCase()]
        : [target.toLowerCase()];

      const punishmentActions = [
        'ECOSYSTEM_BLACKLIST', 'STRIKE_1_WARNING', 'STRIKE_2_RESTRICTION', 'STRIKE_3_BLACKLIST',
        'USER_PURGE', '/users/purge', '/sanctions/ban', '/sanctions/mute', '/sanctions/jail',
        '/sanctions/blacklist', '/bank/bankf', '/fraud/freeze', '/fraud/seize', 'SANCTION'
      ];

      const rawLogs = await db.select().from(auditLogs).where(
        sql`${auditLogs.targetId} NOT IN ('GATE_CONFIRMED', 'SYSTEM', 'SESSIONS', 'query')`
      ).orderBy(desc(auditLogs.timestamp)).limit(200);

      const filtered = rawLogs.filter(l => {
        const isPunishment = punishmentActions.some(p => l.action.toUpperCase().includes(p.replace(/^\//, '').toUpperCase()));
        if (!isPunishment) return false;
        const logTarget = (l.targetId || '').toLowerCase();
        return targetIdentifiers.some(t => logTarget === t || logTarget.includes(t));
      });

      if (user) {
        console.log(`User: ${user.username} (ID: ${user.id}) | Role: ${simplifyRole(user.role)} | Status: ${resolveUserStatus(user)} | Total Sanctions: ${filtered.length}\n`);
      }

      if (filtered.length > 0) {
        printTable(filtered.map(l => ({
          ID: l.logId,
          Sanction: formatPunishmentName(l.action),
          Reason: l.reason,
          IssuedBy: l.adminName || 'CLI',
          Date: l.timestamp ? new Date(l.timestamp).toISOString().split('T')[0] : '-'
        })));
      } else {
        console.log(`No sanctions on record for "${target}".`);
      }
    } catch (err) {
      console.log(`[ERROR] Failed to fetch sanction history: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'flags') {
    const target = rawArgs[0];
    try {
      if (target) {
        const user = await resolveUser(target);
        if (!user) {
          console.log(`User "${target}" not found.`);
          return;
        }

        const userReports = await db.select().from(reports).where(
          eq(reports.targetUserId, user.id)
        ).orderBy(desc(reports.createdAt));

        console.log(`Risk Flags for ${user.username} (ID: ${user.id}) | Total Reports: ${userReports.length}\n`);

        if (userReports.length > 0) {
          printTable(userReports.map(r => ({
            ReportID: r.id,
            Type: r.type,
            Priority: r.priority.toUpperCase(),
            Reason: r.reason,
            Status: r.status,
            Date: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '-'
          })));
        } else {
          console.log(`No misconduct or fraud reports on record for ${user.username}.`);
        }
      } else {
        // Aggregate incoming reports by target user
        const allReports = await db.select().from(reports).orderBy(desc(reports.createdAt)).limit(100);
        if (allReports.length > 0) {
          const userReportMap = new Map<number, { count: number; latest: any }>();
          for (const r of allReports) {
            if (!userReportMap.has(r.targetUserId)) {
              userReportMap.set(r.targetUserId, { count: 1, latest: r });
            } else {
              userReportMap.get(r.targetUserId)!.count++;
            }
          }

          const userIds = Array.from(userReportMap.keys());
          const targetUsers = await db.select().from(users).where(sql`${users.id} IN (${sql.join(userIds, sql`, `)})`);
          const userObjMap = new Map<number, string>();
          targetUsers.forEach(u => userObjMap.set(u.id, u.username));

          const aggregatedRows = Array.from(userReportMap.entries()).map(([uid, data]) => ({
            TargetID: uid,
            Username: userObjMap.get(uid) || String(uid),
            Reports: data.count,
            Category: data.latest.type,
            Priority: data.latest.priority.toUpperCase(),
            LatestReason: data.latest.reason,
            Status: data.latest.status,
            LastReported: data.latest.createdAt ? new Date(data.latest.createdAt).toISOString().split('T')[0] : '-'
          }));

          printTable(aggregatedRows);
        } else {
          console.log('No user misconduct or fraud reports on record.');
        }
      }
    } catch (err) {
      console.log(`[ERROR] Failed to fetch risk flags: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'blacklist') {
    try {
      const allEntries = await db.select().from(blacklist).orderBy(desc(blacklist.createdAt)).limit(200);

      if (allEntries.length === 0) {
        console.log('Blacklist table is currently empty.');
        return;
      }

      // Group entries by user or standalone asset
      const userGroupMap = new Map<string, {
        user: string;
        ips: Set<string>;
        devices: Set<string>;
        reason: string;
        date: string;
      }>();

      for (const entry of allEntries) {
        const groupKey = entry.userId ? `USER_${entry.userId}` : (entry.value || `ENTRY_${entry.id}`);
        if (!userGroupMap.has(groupKey)) {
          userGroupMap.set(groupKey, {
            user: entry.userId ? `User #${entry.userId}` : entry.value,
            ips: new Set<string>(),
            devices: new Set<string>(),
            reason: entry.reason,
            date: entry.createdAt ? new Date(entry.createdAt).toISOString().split('T')[0] : '-'
          });
        }

        const group = userGroupMap.get(groupKey)!;
        if (entry.type === 'USERNAME' && entry.value) {
          group.user = entry.value;
        } else if (entry.type === 'IP' && entry.value) {
          group.ips.add(entry.value);
        } else if ((entry.type === 'DEVICE_ID' || entry.type === 'DEVICE_FINGERPRINT') && entry.value) {
          group.devices.add(entry.value);
        }
      }

      const rows = Array.from(userGroupMap.values()).map(g => ({
        User: g.user,
        IPs: g.ips.size > 0 ? Array.from(g.ips).join(', ') : 'None',
        Devices: g.devices.size > 0 ? Array.from(g.devices).join(', ') : 'None',
        Reason: g.reason,
        Date: g.date
      }));

      printTable(rows);
    } catch (err) {
      console.log(`[ERROR] Failed to populate blacklist table: ${(err as Error).message}`);
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
