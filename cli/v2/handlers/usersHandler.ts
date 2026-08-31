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
import { requireUser, requireArg, resolveUser, logAudit, SYSTEM_USER_IDS, printDetail } from '../helpers.js';
import { formatTable } from '../table.js';
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

  if (sub === 'set' || sub === 'role') {
    const [target, roleRaw] = rawArgs;
    if (!target || !roleRaw) {
      console.log('Usage: set <id_or_username> <role>');
      return;
    }
    const user = await resolveUser(target);
    if (!user) { console.log(`User "${target}" not found.`); return; }
    if (SYSTEM_USER_IDS.has(user.id)) {
      console.log(`${theme.red}[ERROR] Core system administrator role cannot be altered.${theme.reset}`);
      return;
    }
    const role = roleRaw.toUpperCase();
    await userRepository.update(user.id, { role });
    console.log(`[OK] Role updated for ${user.username} to ${role}.`);
    await logAudit('/users/set', String(user.id), `Role changed to ${role}`);
    return;
  }

  if (sub === 'deactivate') {
    const user = await requireUser(rawArgs, 'deactivate <id_or_username>');
    if (!user) return;
    if (SYSTEM_USER_IDS.has(user.id)) {
      console.log(`${theme.red}[ERROR] Core system administrators cannot be deactivated.${theme.reset}`);
      return;
    }
    const deletionDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await userRepository.update(user.id, {
      role: 'DEACTIVATED',
      scheduledDeletionAt: deletionDate
    });
    await userRepository.deleteAllSessionsForUser(user.id);
    console.log(`[OK] Account ${user.username} scheduled for deactivation at ${deletionDate.toISOString()}.`);
    await logAudit('/users/deactivate', String(user.id), 'Account deactivation scheduled');
    return;
  }

  if (sub === 'cancel' || sub === 'restore') {
    const user = await requireUser(rawArgs, 'restore <id_or_username>');
    if (!user) return;
    await userRepository.update(user.id, {
      role: 'USER',
      scheduledDeletionAt: null
    });
    console.log(`[OK] Account ${user.username} restored to active status.`);
    await logAudit('/users/restore', String(user.id), 'Deactivation cancelled');
    return;
  }

  if (sub === 'pending') {
    const pendingList = await db.select().from(users).where(
      and(
        isNotNull(users.scheduledDeletionAt),
        eq(users.role, 'DEACTIVATED')
      )
    ).orderBy(desc(users.scheduledDeletionAt));

    formatTable(
      pendingList.map(u => ({
        id: u.id,
        username: u.username,
        role: 'user',
        status: 'pending',
        scheduled: u.scheduledDeletionAt ? new Date(u.scheduledDeletionAt).toISOString().replace('T', ' ').substring(0, 16) : '-',
        created: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '-'
      })),
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

  if (sub === 'delete' || sub === 'purge') {
    const user = await requireUser(rawArgs, 'purge <id_or_username>');
    if (!user) return;
    if (SYSTEM_USER_IDS.has(user.id)) {
      console.log(`${theme.red}[ERROR] Core system accounts cannot be purged.${theme.reset}`);
      return;
    }
    try {
      await userRepository.purgeUserCompletely(user.id);
      console.log(`[OK] User ${user.username} (ID ${user.id}) completely purged from all databases.`);
      await logAudit('/users/purge', String(user.id), `Atomic cascade purge for user ${user.username}`);
    } catch (err) {
      console.log(`${theme.red}[ERROR] Failed to purge user: ${(err as Error).message}${theme.reset}`);
    }
    return;
  }

  console.log(`Unknown /users subcommand: "${sub}". Type "help" or "ls" to view commands.`);
}
