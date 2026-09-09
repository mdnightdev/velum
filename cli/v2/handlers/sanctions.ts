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
    const actionOrTarget = rawArgs[0];

    // Subcommand: flags resolve <report_id> [notes]
    if (actionOrTarget === 'resolve') {
      const reportId = parseInt(rawArgs[1], 10);
      if (isNaN(reportId)) {
        console.log('Usage: flags resolve <report_id> [resolution_notes]');
        return;
      }
      const notes = rawArgs.slice(2).join(' ') || 'Resolved via CLI investigation';

      try {
        const [existing] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
        if (!existing) {
          console.log(`Report #${reportId} not found.`);
          return;
        }

        await db.update(reports).set({
          status: 'resolved',
          updatedAt: new Date()
        }).where(eq(reports.id, reportId));

        console.log(`[OK] Escalated Report #${reportId} marked as RESOLVED. Record will automatically age out after 14 days.`);
        await logAudit('/sanctions/flags/resolve', String(reportId), notes);
      } catch (err) {
        console.log(`[ERROR] Failed to resolve report: ${(err as Error).message}`);
      }
      return;
    }

    // Specific report ID or user inspection
    if (actionOrTarget) {
      const numId = parseInt(actionOrTarget, 10);
      try {
        let singleReport = !isNaN(numId) ? (await db.select().from(reports).where(eq(reports.id, numId)).limit(1))[0] : null;

        if (singleReport) {
          const targetUser = await userRepository.findById(singleReport.targetUserId);
          const reporterUser = await userRepository.findById(singleReport.reporterId);

          console.log(`=== Escalated Report Investigation #${singleReport.id} ===`);
          console.log(`Target User:    ${targetUser ? targetUser.username : 'Unknown'} (ID: ${singleReport.targetUserId})`);
          console.log(`Reporter:       ${reporterUser ? reporterUser.username : 'Anonymous'} (ID: ${singleReport.reporterId})`);
          console.log(`Category:       ${singleReport.type}`);
          console.log(`Priority:       ${singleReport.priority.toUpperCase()}`);
          console.log(`Status:         ${singleReport.status.toUpperCase()}`);
          console.log(`Reason:         ${singleReport.reason}`);
          console.log(`Reported Date:  ${singleReport.createdAt ? new Date(singleReport.createdAt).toISOString() : '-'}`);
          console.log(`Last Updated:   ${singleReport.updatedAt ? new Date(singleReport.updatedAt).toISOString() : '-'}`);

          if (targetUser) {
            // Pull digital ecosystem telemetry for deep investigation
            const sessList = await db.select().from(sessions).where(eq(sessions.userId, targetUser.id));
            const devList = await db.select().from(userDevices).where(eq(userDevices.userId, targetUser.id));
            const ips = sessList.map(s => s.ipAddress).filter(Boolean);
            const devIds = devList.map(d => d.deviceId).filter(Boolean);

            console.log(`\n--- Target Ecosystem Telemetry ---`);
            console.log(`Active IPs:     ${ips.length > 0 ? Array.from(new Set(ips)).join(', ') : 'None'}`);
            console.log(`Device IDs:     ${devIds.length > 0 ? Array.from(new Set(devIds)).join(', ') : 'None'}`);
          }
          return;
        }

        // If not a report ID, check if it's a target username
        const user = await resolveUser(actionOrTarget);
        if (!user) {
          console.log(`No report or user found matching "${actionOrTarget}".`);
          return;
        }

        const userReports = await db.select().from(reports).where(
          sql`${reports.targetUserId} = ${user.id} AND (
              ${reports.status} IN ('escalated', 'flagged_for_cli', 'in_review', 'pending') OR 
              (${reports.status} = 'resolved' AND ${reports.updatedAt} >= NOW() - INTERVAL '14 days')
          )`
        ).orderBy(desc(reports.createdAt));

        console.log(`Escalated Flags for ${user.username} (ID: ${user.id}) | Active: ${userReports.length}\n`);

        if (userReports.length > 0) {
          printTable(userReports.map(r => ({
            ReportID: r.id,
            Type: r.type,
            Priority: r.priority.toUpperCase(),
            Reason: r.reason,
            Status: r.status.toUpperCase(),
            Date: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '-'
          })));
        } else {
          console.log(`No active escalated reports for ${user.username}.`);
        }
      } catch (err) {
        console.log(`[ERROR] Failed to fetch report details: ${(err as Error).message}`);
      }
      return;
    }

    // Default: List all escalated reports needing CLI investigation (with 14-day resolved lifecycle)
    try {
      const activeEscalated = await db.select().from(reports).where(
        sql`${reports.status} IN ('escalated', 'flagged_for_cli', 'in_review', 'pending') OR 
            (${reports.status} = 'resolved' AND ${reports.updatedAt} >= NOW() - INTERVAL '14 days')`
      ).orderBy(desc(reports.createdAt)).limit(50);

      if (activeEscalated.length > 0) {
        const userIds = Array.from(new Set(activeEscalated.map(r => r.targetUserId)));
        const targetUsers = await db.select().from(users).where(sql`${users.id} IN (${sql.join(userIds, sql`, `)})`);
        const userMap = new Map<number, string>();
        targetUsers.forEach(u => userMap.set(u.id, u.username));

        printTable(activeEscalated.map(r => ({
          ReportID: r.id,
          Target: userMap.get(r.targetUserId) || String(r.targetUserId),
          Category: r.type,
          Priority: r.priority.toUpperCase(),
          Reason: r.reason,
          Status: r.status.toUpperCase(),
          EscalatedDate: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '-'
        })));
      } else {
        console.log('No escalated reports pending CLI investigation.');
      }
    } catch (err) {
      console.log(`[ERROR] Failed to fetch escalated flags: ${(err as Error).message}`);
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
