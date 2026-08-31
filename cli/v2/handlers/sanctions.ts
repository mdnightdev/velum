import { desc, sql, eq } from 'drizzle-orm';
import { db } from '../../../server/v2/db/client.js';
import { users } from '../../../server/v2/db/schema/users.js';
import { auditLogs } from '../../../server/v2/db/schema/audit_logs.js';
import { blacklist } from '../../../server/v2/db/schema/blacklist.js';
import { stateManager } from '../state/stateManager.js';
import { printTable } from '../table.js';
import { guardProtectedUser } from '../protection.js';
import { simplifyRole, resolveUserStatus } from './users.js';
import type { CommandContext } from '../types.js';

export async function handleSanctions(ctx: CommandContext): Promise<void> {
  const { sub, rawArgs, resolveUser, logAudit } = ctx;

  if (sub === 'history') {
    const target = rawArgs[0];
    try {
      let logs;
      if (target) {
        logs = await db.select().from(auditLogs).where(
          sql`${auditLogs.targetId} = ${target} OR ${auditLogs.targetId} ILIKE ${`%${target}%`}`
        ).orderBy(desc(auditLogs.timestamp)).limit(50);
      } else {
        logs = await db.select().from(auditLogs).where(
          sql`${auditLogs.action} ILIKE '%BAN%' OR 
              ${auditLogs.action} ILIKE '%MUTE%' OR 
              ${auditLogs.action} ILIKE '%JAIL%' OR 
              ${auditLogs.action} ILIKE '%SANCTION%' OR 
              ${auditLogs.action} ILIKE '%BLACKLIST%' OR 
              ${auditLogs.action} ILIKE '%GATE%'`
        ).orderBy(desc(auditLogs.timestamp)).limit(50);
      }

      if (logs.length > 0) {
        printTable(logs.map(l => ({
          ID: l.logId,
          Action: l.action,
          Target: l.targetId,
          Reason: l.reason,
          Admin: l.adminName || 'CLI',
          Time: l.timestamp ? new Date(l.timestamp).toISOString().split('T')[0] : '-'
        })));
      } else {
        console.log('No sanction audit history found.');
      }
    } catch (err) {
      console.log(`[ERROR] Failed to query sanction history: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'flags') {
    const target = rawArgs[0];
    if (target) {
      const user = await resolveUser(target);
      if (!user) { console.log(`User "${target}" not found.`); return; }
      console.log(`Role: ${simplifyRole(user.role)}`);
      console.log(`Status: ${resolveUserStatus(user)}`);
      console.log(`Muted: ${stateManager.isMuted(user.username) ? 'Yes' : 'No'}`);
      console.log(`Jailed: ${stateManager.isJailed(user.username) ? 'Yes' : 'No'}`);
      return;
    }

    const allUsers = await db.select().from(users).limit(100);
    const sanctioned = allUsers.filter(u =>
      ['BANNED', 'SUSPENDED', 'RESTRICTED', 'DEACTIVATED', 'BLOCKED'].includes(u.role) ||
      u.scheduledDeletionAt ||
      stateManager.isMuted(u.username) ||
      stateManager.isJailed(u.username)
    );

    if (sanctioned.length > 0) {
      printTable(sanctioned.map(u => ({
        ID: u.id,
        Username: u.username,
        Role: simplifyRole(u.role),
        Status: resolveUserStatus(u),
        Muted: stateManager.isMuted(u.username) ? 'Y' : 'N',
        Jailed: stateManager.isJailed(u.username) ? 'Y' : 'N',
        Created: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '-'
      })));
    } else {
      console.log('No active moderation or sanction flags.');
    }
    return;
  }

  if (sub === 'blacklist') {
    const action = rawArgs[0]?.toLowerCase();

    if (action === 'add') {
      const [_, typeRaw, value, ...reasonParts] = rawArgs;
      if (!typeRaw || !value) {
        console.log('Usage: blacklist add <type: IP|USERNAME|DEVICE_ID|FINGERPRINT> <value> [reason]');
        return;
      }
      const type = typeRaw.toUpperCase();
      const reason = reasonParts.join(' ') || 'Blacklisted via admin CLI';

      if (type === 'USERNAME') {
        const targetUser = await resolveUser(value);
        if (targetUser && !guardProtectedUser(targetUser.id, 'blacklist')) return;
      }

      try {
        await db.insert(blacklist).values({
          type,
          value,
          reason,
          bannedBy: 'CLI_ADMIN'
        }).onConflictDoNothing();

        console.log(`[OK] Added ${type} "${value}" to blacklist.`);
        await logAudit('/sanctions/blacklist/add', value, `Blacklisted ${type}: ${reason}`);
      } catch (err) {
        console.log(`[ERROR] Failed to add to blacklist: ${(err as Error).message}`);
      }
      return;
    }

    if (action === 'del' || action === 'remove' || action === 'rm') {
      const target = rawArgs[1];
      if (!target) {
        console.log('Usage: blacklist del <id_or_value>');
        return;
      }

      try {
        const numId = parseInt(target, 10);
        if (!isNaN(numId)) {
          await db.delete(blacklist).where(eq(blacklist.id, numId));
        } else {
          await db.delete(blacklist).where(eq(blacklist.value, target));
        }
        console.log(`[OK] Removed "${target}" from blacklist.`);
        await logAudit('/sanctions/blacklist/del', target, 'Removed from blacklist');
      } catch (err) {
        console.log(`[ERROR] Failed to remove from blacklist: ${(err as Error).message}`);
      }
      return;
    }

    // Default: List blacklist entries
    try {
      const entries = await db.select().from(blacklist).orderBy(desc(blacklist.createdAt)).limit(100);
      if (entries.length > 0) {
        printTable(entries.map(e => ({
          ID: e.id,
          Type: e.type,
          Value: e.value,
          Reason: e.reason,
          BannedBy: e.bannedBy,
          Created: e.createdAt ? new Date(e.createdAt).toISOString().split('T')[0] : '-'
        })));
      } else {
        console.log('Blacklist is currently empty.');
      }
    } catch (err) {
      console.log(`[ERROR] Failed to fetch blacklist: ${(err as Error).message}`);
    }
    return;
  }
}
