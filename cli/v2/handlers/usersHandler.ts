import crypto from 'node:crypto';
import { eq, desc, sql, and, or, isNotNull } from 'drizzle-orm';
import { db } from '../../../server/v2/db/client.js';
import { users, supportAdminNominations } from '../../../server/v2/db/schema/users.js';
import { wallets } from '../../../server/v2/db/schema/wallets.js';
import { devices, userDevices, ipAddresses } from '../../../server/v2/db/schema/devices.js';
import { auditLogs } from '../../../server/v2/db/schema/audit_logs.js';
import { userRepository } from '../../../server/v2/repositories/userRepository.js';
import { bankRepository } from '../../../server/v2/repositories/bankRepository.js';
import { hashArgon2id } from '../../../server/v2/utils/crypto.js';
import { requireUser, requireArg, resolveUser, logAudit, SYSTEM_USER_IDS } from '../helpers.js';
import { formatTable, printDetail } from '../table.js';
import { theme } from '../theme.js';

export async function handleUsersCommand(sub: string, rawArgs: string[], flags: Record<string, any>): Promise<void> {
  if (sub === 'list' || sub === 'ls') {
    const roleFilter = flags['role'] ? String(flags['role']).toUpperCase() : undefined;
    const statusFilter = flags['status'] ? String(flags['status']).toUpperCase() : undefined;
    const pageSize = Math.min(100, Math.max(10, parseInt(String(flags['limit'] || '50'), 10)));
    const page = Math.max(1, parseInt(String(flags['page'] || '1'), 10));
    const offset = (page - 1) * pageSize;

    let query = db.select().from(users);
    const conditions = [];
    if (roleFilter) conditions.push(eq(users.role, roleFilter));
    if (statusFilter === 'DEACTIVATED') conditions.push(eq(users.role, 'DEACTIVATED'));
    else if (statusFilter === 'BANNED') conditions.push(eq(users.role, 'BANNED'));
    else if (statusFilter === 'ACTIVE') conditions.push(eq(users.role, 'USER'));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const pageUsers = await query.orderBy(desc(users.createdAt)).limit(pageSize).offset(offset);

    formatTable(
      pageUsers.map(u => {
        let role = 'user';
        if (u.role === 'CLI_ADMIN') role = 'cli';
        else if (u.role === 'LOGIN_ADMIN') role = 'login';
        else if (u.role === 'SUPPORT_ADMIN') role = 'support';
        else if (u.role === 'ADMIN') role = 'admin';

        let status = 'active';
        if (u.scheduledDeletionAt) status = 'pending';
        else if (u.role === 'BLOCKED') status = 'blocked';
        else if (u.role === 'RESTRICTED') status = 'restricted';

        let scheduled = '-';
        if (u.scheduledDeletionAt) {
          scheduled = new Date(u.scheduledDeletionAt).toISOString().replace('T', ' ').substring(0, 16);
        }

        return {
          id: u.id,
          username: u.username,
          role,
          status,
          scheduled,
          created: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '-'
        };
      }),
      [
        { key: 'id', label: 'ID', width: 6 },
        { key: 'username', label: 'USERNAME', width: 18 },
        { key: 'role', label: 'ROLE', width: 8 },
        { key: 'status', label: 'STATUS', width: 10 },
        { key: 'scheduled', label: 'SCHEDULED', width: 18 },
        { key: 'created', label: 'CREATED', width: 12 }
      ]
    );
    return;
  }

  if (sub === 'cat' || sub === 'view' || sub === 'get') {
    const user = await requireUser(rawArgs, 'view <id_or_username>');
    if (!user) return;
    const wallet = await bankRepository.findWalletByUserId(user.id);

    const userIps = await db.select().from(ipAddresses).where(eq(ipAddresses.userId, user.id)).orderBy(desc(ipAddresses.lastSeen)).limit(5);
    const userDevs = await db.select({
      deviceId: userDevices.deviceId,
      platform: devices.platform,
      userAgent: devices.userAgent,
      lastSeen: userDevices.lastSeen,
      isCurrent: userDevices.isCurrent
    })
    .from(userDevices)
    .leftJoin(devices, eq(userDevices.deviceId, devices.deviceId))
    .where(eq(userDevices.userId, user.id))
    .orderBy(desc(userDevices.lastSeen))
    .limit(5);

    printDetail(`User Profile & Security State: @${user.username}`, {
      ID: user.id,
      Username: user.username,
      'Display Name': user.displayName || '-',
      Role: user.role,
      Location: user.location || '-',
      'Wallet Balance': wallet ? `${wallet.balance} ${wallet.currency}` : '0.00 USD',
      Compromised: user.isCompromised ? 'YES' : 'NO',
      'Duress Active': user.duressActive ? 'YES' : 'NO',
      'Recent IPs': userIps.length > 0 ? userIps.map(i => i.ipAddress).join(', ') : 'None recorded',
      'Associated Devices': userDevs.length > 0 ? userDevs.map(d => `${d.platform || 'Unknown'} (${d.deviceId.substring(0, 8)}...)`).join(', ') : 'None recorded',
      'Scheduled Deletion': user.scheduledDeletionAt ? new Date(user.scheduledDeletionAt).toISOString() : 'None',
      'Created At': user.createdAt ? new Date(user.createdAt).toISOString() : '-'
    });
    return;
  }

  if (sub === 'create') {
    const [username, password, role = 'USER'] = rawArgs;
    if (!username || !password) {
      console.log('Usage: create <username> <password> [role]');
      return;
    }
    const saltBuf = crypto.randomBytes(16);
    const saltHex = saltBuf.toString('hex');
    const passwordHash = await hashArgon2id(password, saltBuf);
    const created = await userRepository.create({
      username,
      passwordHash,
      salt: saltHex,
      role: role.toUpperCase()
    });
    console.log(`[OK] Created user ${created.username} (ID ${created.id}) with role: ${created.role}`);
    await logAudit('/users/create', String(created.id), `Created user ${created.username}`);
    return;
  }

  if (sub === 'override' || sub === 'reset-password') {
    const [target, newPassword] = rawArgs;
    if (!target || !newPassword) {
      console.log('Usage: reset-password <id_or_username> <new_password>');
      return;
    }
    const user = await resolveUser(target);
    if (!user) { console.log(`User "${target}" not found.`); return; }
    if (SYSTEM_USER_IDS.has(user.id)) {
      console.log(`${theme.red}[ERROR] Core system administrator credentials cannot be overridden via CLI.${theme.reset}`);
      return;
    }
    const saltBuf = crypto.randomBytes(16);
    const passwordHash = await hashArgon2id(newPassword, saltBuf);
    await userRepository.update(user.id, { passwordHash, salt: saltBuf.toString('hex') });
    await userRepository.deleteAllSessionsForUser(user.id);
    console.log(`[OK] Password reset & active sessions cleared for ${user.username} (ID ${user.id}).`);
    await logAudit('/users/reset-password', String(user.id), 'Password overridden via CLI');
    return;
  }

  if (sub === 'set' || sub === 'set-role') {
    const [target, newRole] = rawArgs;
    if (!target || !newRole) {
      console.log('Usage: set-role <id_or_username> <role>');
      return;
    }
    const user = await resolveUser(target);
    if (!user) { console.log(`User "${target}" not found.`); return; }
    if (SYSTEM_USER_IDS.has(user.id)) {
      console.log(`${theme.red}[ERROR] Core system accounts cannot have their roles changed.${theme.reset}`);
      return;
    }
    const normalizedRole = newRole.toUpperCase();
    await userRepository.update(user.id, { role: normalizedRole });
    console.log(`[OK] Updated user ${user.username} (ID ${user.id}) role to: ${normalizedRole}`);
    await logAudit('/users/set-role', String(user.id), `Role changed to ${normalizedRole}`);
    return;
  }

  if (sub === 'reset' || sub === 'clear-profile') {
    const user = await requireUser(rawArgs, 'clear-profile <id_or_username>');
    if (!user) return;
    if (SYSTEM_USER_IDS.has(user.id)) {
      console.log(`${theme.red}[ERROR] Cannot clear profile of core system accounts.${theme.reset}`);
      return;
    }
    await userRepository.update(user.id, { avatarUrl: null, bio: null, location: null, displayName: null });
    console.log(`[OK] Cleared profile metadata for ${user.username} (ID ${user.id}).`);
    await logAudit('/users/clear-profile', String(user.id), 'Profile metadata cleared');
    return;
  }

  if (sub === 'deactivate') {
    const [target, daysArg] = rawArgs;
    if (!target) {
      console.log('Usage: deactivate <id_or_username> [grace_days (default: 7)]');
      return;
    }
    const user = await resolveUser(target);
    if (!user) { console.log(`User "${target}" not found.`); return; }
    if (SYSTEM_USER_IDS.has(user.id)) {
      console.log(`${theme.red}[ERROR] Cannot deactivate core system accounts.${theme.reset}`);
      return;
    }
    const days = parseInt(daysArg, 10) || 7;
    const deletionDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await db.update(users).set({ role: 'DEACTIVATED', scheduledDeletionAt: deletionDate, updatedAt: new Date() }).where(eq(users.id, user.id));
    await userRepository.deleteAllSessionsForUser(user.id);
    console.log(`[OK] Account ${user.username} (ID ${user.id}) marked DEACTIVATED. Scheduled for deletion in ${days} days.`);
    await logAudit('/users/deactivate', String(user.id), `Scheduled deletion in ${days} days`);
    return;
  }

  if (sub === 'cancel' || sub === 'reactivate' || sub === 'restore') {
    const user = await requireUser(rawArgs, 'reactivate <id_or_username>');
    if (!user) return;
    await db.update(users).set({ role: 'USER', scheduledDeletionAt: null, updatedAt: new Date() }).where(eq(users.id, user.id));
    console.log(`[OK] Restored ${user.username} (ID ${user.id}) to active USER status.`);
    await logAudit('/users/reactivate', String(user.id), 'Reactivated account');
    return;
  }

  if (sub === 'pending') {
    const pendingList = await db.select().from(users).where(
      or(
        isNotNull(users.scheduledDeletionAt),
        eq(users.role, 'DEACTIVATED')
      )
    ).orderBy(desc(users.scheduledDeletionAt));

    console.log(`\n=== Accounts Pending Deletion (${pendingList.length}) ===`);
    formatTable(
      pendingList.map(u => {
        let deadlineStr = '-';
        if (u.scheduledDeletionAt) {
          const diffMs = new Date(u.scheduledDeletionAt).getTime() - Date.now();
          if (diffMs <= 0) {
            deadlineStr = 'Expired';
          } else {
            const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
            const days = Math.floor(totalHours / 24);
            const hours = totalHours % 24;
            deadlineStr = days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
          }
        }
        return {
          id: u.id,
          username: u.username,
          role: u.role,
          deadline: deadlineStr,
          reason: 'Deactivation Schedule'
        };
      }),
      [
        { key: 'id', label: 'ID', width: 6 },
        { key: 'username', label: 'Username', width: 18 },
        { key: 'role', label: 'Role', width: 14 },
        { key: 'deadline', label: 'Deadline', width: 16 },
        { key: 'reason', label: 'Reason', width: 24 }
      ]
    );
    return;
  }

  if (sub === 'delete' || sub === 'purge') {
    const user = await requireUser(rawArgs, 'purge <id_or_username>');
    if (!user) return;
    if (SYSTEM_USER_IDS.has(user.id)) {
      console.log(`${theme.red}[ERROR] Core system accounts cannot be purged.${theme.reset}`);
      return;
    }
    try {
      const { UserDeletionService } = await import('../../../server/v2/services/userDeletionService.js');
      const res = await UserDeletionService.executeInstantPurge(user.id, 'CLI_ADMIN_MANUAL_PURGE');
      console.log(`[OK] User ${user.username} (ID ${user.id}) permanently purged across ${res.purgedTables.length} tables.`);
      await logAudit('/users/purge', String(user.id), `Permanently purged user ${user.username}`);
    } catch (err) {
      console.log(`${theme.red}[ERROR] Failed to purge user: ${(err as Error).message}${theme.reset}`);
    }
    return;
  }

  if (sub === 'fraud' || sub === 'seize') {
    const user = await requireUser(rawArgs, 'fraud <id_or_username> [reason]');
    if (!user) return;
    if (SYSTEM_USER_IDS.has(user.id)) {
      console.log(`${theme.red}[ERROR] Cannot sanction core system accounts.${theme.reset}`);
      return;
    }
    const reason = rawArgs.slice(1).join(' ') || 'Platform Fraud & Security Violation';
    try {
      const { UserDeletionService } = await import('../../../server/v2/services/userDeletionService.js');
      const res = await UserDeletionService.executeFraudSeizure(user.id, 'CLI_ADMIN', reason);
      console.log(`[OK] User @${user.username} marked as FRAUD_SEIZURE. Assets seized: $${res.seizedAmount.toFixed(2)}. Devices/IPs blacklisted.`);
      await logAudit('/users/fraud', String(user.id), `Fraud seizure executed: ${reason}`);
    } catch (err) {
      console.log(`${theme.red}[ERROR] Failed to execute fraud seizure: ${(err as Error).message}${theme.reset}`);
    }
    return;
  }

  if (sub === 'sweep' || sub === 'purge-expired') {
    try {
      const { UserDeletionService } = await import('../../../server/v2/services/userDeletionService.js');
      const res = await UserDeletionService.sweepExpiredDeletions();
      console.log(`[OK] Deletion sweep completed: ${res.purgedCount} expired user(s) permanently purged.`);
    } catch (err) {
      console.log(`${theme.red}[ERROR] Deletion sweep failed: ${(err as Error).message}${theme.reset}`);
    }
    return;
  }

  if (sub === 'release-assets' || sub === 'settle-wallet') {
    const user = await requireUser(rawArgs, 'settle-wallet <id_or_username>');
    if (!user) return;
    const wallet = await bankRepository.findWalletByUserId(user.id);
    if (wallet) {
      await db.update(wallets).set({ balance: '0.00', updatedAt: new Date() }).where(eq(wallets.id, wallet.id));
      console.log(`[OK] Settled wallet for ${user.username}. Balance cleared to 0.00 ${wallet.currency}.`);
      await logAudit('/users/settle-wallet', String(user.id), 'Wallet balance settled');
    } else {
      console.log(`[OK] No active wallet found for ${user.username}.`);
    }
    return;
  }

  if (sub === 'flags' || sub === 'security-flags') {
    const target = rawArgs[0];
    if (target) {
      const user = await resolveUser(target);
      if (!user) { console.log(`User "${target}" not found.`); return; }
      console.log(`\n=== Security Flags: ${user.username} (ID ${user.id}) ===`);
      console.log(`Role: ${user.role}`);
      console.log(`Compromised: ${user.isCompromised ? 'YES' : 'NO'}`);
      console.log(`Duress Active: ${user.duressActive ? 'YES' : 'NO'}`);
      console.log(`Scheduled Deletion: ${user.scheduledDeletionAt ? user.scheduledDeletionAt.toISOString() : 'None'}`);
      const userAuditLogs = await db.select().from(auditLogs).where(
        sql`${auditLogs.targetId} = ${String(user.id)} OR ${auditLogs.targetId} = ${user.username}`
      ).orderBy(desc(auditLogs.timestamp)).limit(20);
      if (userAuditLogs.length > 0) {
        console.log(`\nAudit Logs (${userAuditLogs.length}):`);
        formatTable(
          userAuditLogs.map(a => ({ action: a.action, reason: a.reason, time: a.timestamp ? new Date(a.timestamp).toISOString() : '-' })),
          [
            { key: 'action', label: 'Action', width: 25 },
            { key: 'reason', label: 'Reason', width: 35 },
            { key: 'time', label: 'Time', width: 22 }
          ]
        );
      }
    } else {
      const flagged = await db.select().from(users).where(
        or(
          eq(users.role, 'BANNED'),
          eq(users.role, 'DEACTIVATED'),
          eq(users.isCompromised, true),
          eq(users.duressActive, true),
          isNotNull(users.scheduledDeletionAt)
        )
      ).limit(50);
      console.log(`\n=== Flagged Accounts (${flagged.length}) ===`);
      formatTable(
        flagged.map(u => ({
          id: u.id,
          username: u.username,
          role: u.role,
          compromised: u.isCompromised ? 'YES' : 'NO',
          duress: u.duressActive ? 'YES' : 'NO',
          wipe: u.scheduledDeletionAt ? new Date(u.scheduledDeletionAt).toISOString().split('T')[0] : '-'
        })),
        [
          { key: 'id', label: 'ID', width: 6 },
          { key: 'username', label: 'Username', width: 16 },
          { key: 'role', label: 'Role', width: 14 },
          { key: 'compromised', label: 'Compromised', width: 12 },
          { key: 'duress', label: 'Duress', width: 8 },
          { key: 'wipe', label: 'Wipe Date', width: 12 }
        ]
      );
    }
    return;
  }

  if (sub === 'nominations') {
    const list = await db.select().from(supportAdminNominations).orderBy(desc(supportAdminNominations.createdAt)).limit(50);
    console.log(`\n=== Support Admin Nominations (${list.length}) ===`);
    formatTable(
      list.map(n => ({
        id: n.id,
        targetUser: n.nominatedUserId,
        nominatedBy: n.nominatedBy,
        status: n.status,
        date: n.createdAt ? new Date(n.createdAt).toISOString().split('T')[0] : '-'
      })),
      [
        { key: 'id', label: 'ID', width: 6 },
        { key: 'targetUser', label: 'Target User ID', width: 16 },
        { key: 'nominatedBy', label: 'Nominated By', width: 14 },
        { key: 'status', label: 'Status', width: 12 },
        { key: 'date', label: 'Date', width: 12 }
      ]
    );
    return;
  }

  console.log(`Unknown /users subcommand: "${sub}". Type "help" or "ls" to view commands.`);
}
