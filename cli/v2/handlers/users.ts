import crypto from 'node:crypto';
import { eq, desc, sql, and } from 'drizzle-orm';
import { db } from '../../../server/v2/db/client.js';
import { users, supportAdminNominations } from '../../../server/v2/db/schema/users.js';
import { auditLogs } from '../../../server/v2/db/schema/audit_logs.js';
import { sessions } from '../../../server/v2/db/schema/sessions.js';
import { userRepository } from '../../../server/v2/repositories/userRepository.js';
import { bankRepository } from '../../../server/v2/repositories/bankRepository.js';
import { SystemBot } from '../../../server/v2/services/systemBot.js';
import { hashArgon2id } from '../../../server/v2/utils/crypto.js';
import { stateManager } from '../state/stateManager.js';
import { printDetail, printTable } from '../table.js';
import { guardProtectedUser } from '../protection.js';
import type { CommandContext } from '../types.js';

export function simplifyRole(role: string): string {
  const r = (role || '').toUpperCase();
  if (r === 'CLI_ADMIN' || r === 'CLI') return 'Cli';
  if (r === 'LOGIN_ADMIN' || r === 'LOGIN') return 'Login';
  if (r === 'SUPPORT_ADMIN' || r === 'SUPPORT') return 'Support';
  if (r === 'ADMIN') return 'Admin';
  return 'User';
}

export function resolveUserStatus(u: any, latestSessionTimestamp?: Date | null): string {
  if (u.status) {
    if (u.status === 'Pending' || u.status === 'Deactivated') return 'Pending';
    if (u.status === 'Banned' || u.status === 'Blocked') return 'Blocked';
  }
  if (u.scheduledDeletionAt) return 'Pending';
  const role = (u.role || '').toUpperCase();
  if (role === 'BLOCKED' || role === 'BANNED' || role === 'SUSPENDED' || stateManager.isJailed(u.username)) {
    return 'Blocked';
  }
  
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const lastActiveTime = latestSessionTimestamp
    ? new Date(latestSessionTimestamp).getTime()
    : u.updatedAt
    ? new Date(u.updatedAt).getTime()
    : u.createdAt
    ? new Date(u.createdAt).getTime()
    : 0;

  if (lastActiveTime > 0 && (now - lastActiveTime) > thirtyDaysMs && !latestSessionTimestamp) {
    return 'Inactive';
  }

  return 'Active';
}

export async function handleUsers(ctx: CommandContext): Promise<void> {
  const { sub, rawArgs, flags, requireUser, resolveUser, logAudit } = ctx;

  if (sub === 'list' || sub === 'ls') {
    const roleFilter = flags['role'] as string | undefined;
    const pageSize = 50;
    const page = Math.max(1, parseInt(flags['page'] as string, 10) || 1);
    const offset = (page - 1) * pageSize;

    const countRes = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const totalCount = countRes[0]?.count || 0;
    let pageUsers = await db.select().from(users).limit(pageSize).offset(offset);
    if (roleFilter) {
      pageUsers = pageUsers.filter(u => u.role.toLowerCase() === roleFilter.toLowerCase() || simplifyRole(u.role).toLowerCase() === roleFilter.toLowerCase());
    }
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    const activeSessions = await db.select({ userId: sessions.userId, createdAt: sessions.createdAt }).from(sessions);
    const sessionMap = new Map<number, Date>();
    for (const s of activeSessions) {
      if (!sessionMap.has(s.userId) || (s.createdAt && s.createdAt > sessionMap.get(s.userId)!)) {
        if (s.createdAt) sessionMap.set(s.userId, s.createdAt);
      }
    }

    printTable(pageUsers.map(u => ({
      ID: u.id,
      Username: u.username,
      Role: simplifyRole(u.role),
      Status: resolveUserStatus(u, sessionMap.get(u.id)),
      Deletion: u.scheduledDeletionAt ? new Date(u.scheduledDeletionAt).toISOString().split('T')[0] : '-',
      Created: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '-'
    })));

    if (page < totalPages) {
      console.log(`(page ${page}/${totalPages}, total ${totalCount}. Use "list --page ${page + 1}" for more)`);
    }
    return;
  }

  if (sub === 'get' || sub === 'cat') {
    const user = await requireUser(rawArgs, 'cat <id_or_username>');
    if (!user) return;
    const userSess = await db.select().from(sessions).where(eq(sessions.userId, user.id)).limit(1).then(r => r[0]);
    printDetail('User Details', {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: simplifyRole(user.role),
      status: resolveUserStatus(user, userSess?.createdAt),
      deletion: user.scheduledDeletionAt ? new Date(user.scheduledDeletionAt).toISOString().split('T')[0] : '-',
      bio: user.bio,
      location: user.location,
      avatarUrl: user.avatarUrl,
      isCompromised: user.isCompromised,
      duressActive: user.duressActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
    return;
  }

  if (sub === 'create') {
    const [username, password, role = 'USER'] = rawArgs;
    if (!username || !password) { console.log('Usage: create <username> <password> [role]'); return; }
    const saltBuf = crypto.randomBytes(16);
    const saltHex = saltBuf.toString('hex');
    const passwordHash = await hashArgon2id(password, saltBuf);
    const created = await userRepository.create({
      username,
      passwordHash,
      salt: saltHex,
      role: role.toUpperCase()
    });
    console.log(`[OK] User created: ID ${created.id}, Username: ${created.username}, Role: ${simplifyRole(created.role)}`);
    return;
  }

  if (sub === 'override') {
    const [target, newPassword] = rawArgs;
    if (!target || !newPassword) { console.log('Usage: override <id_or_username> <new_password>'); return; }
    const user = await resolveUser(target);
    if (!user) { console.log(`User "${target}" not found.`); return; }
    if (!guardProtectedUser(user.id, 'override credentials of')) return;
    const saltBuf = crypto.randomBytes(16);
    const passwordHash = await hashArgon2id(newPassword, saltBuf);
    await userRepository.update(user.id, { passwordHash, salt: saltBuf.toString('hex'), role: 'USER' });
    console.log(`[OK] Password reset for ${user.username} (ID ${user.id}).`);
    return;
  }

  if (sub === 'set') {
    const [target, newRole] = rawArgs;
    if (!target || !newRole) { console.log('Usage: set <id_or_username> <role>'); return; }
    const user = await resolveUser(target);
    if (!user) { console.log(`User "${target}" not found.`); return; }
    if (!guardProtectedUser(user.id, 'change role of')) return;
    const updated = await userRepository.update(user.id, { role: newRole.toUpperCase() });
    console.log(`[OK] Updated ${user.username} role to: ${simplifyRole(updated?.role || newRole)}`);
    return;
  }

  if (sub === 'reset') {
    const user = await requireUser(rawArgs, 'reset <id_or_username>');
    if (!user) return;
    if (!guardProtectedUser(user.id, 'reset')) return;
    await userRepository.update(user.id, { avatarUrl: null });
    console.log(`[OK] Reset avatar for ${user.username}.`);
    return;
  }

  if (sub === 'restore') {
    const user = await requireUser(rawArgs, 'restore <id_or_username>');
    if (!user) return;
    await userRepository.update(user.id, { status: 'Active', scheduledDeletionAt: null, deletionReason: null, role: 'USER' });
    console.log(`[OK] Restored ${user.username} to active status.`);
    return;
  }

  if (sub === 'pending') {
    const allUsers = await db.select().from(users).where(sql`${users.scheduledDeletionAt} IS NOT NULL`).limit(100);
    printTable(allUsers.map(u => ({
      ID: u.id,
      Username: u.username,
      Role: simplifyRole(u.role),
      Status: resolveUserStatus(u),
      Deletion: u.scheduledDeletionAt ? new Date(u.scheduledDeletionAt).toISOString().split('T')[0] : '-',
      Created: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '-'
    })));
    return;
  }

  if (sub === 'delete' || sub === 'purge') {
    const user = await requireUser(rawArgs, 'purge <id_or_username>');
    if (!user) return;
    if (!guardProtectedUser(user.id, 'delete or purge')) return;
    const ok = await userRepository.delete(user.id);
    console.log(ok ? `[OK] User ${user.username} deleted.` : `Failed to delete user.`);
    return;
  }

  if (sub === 'release-assets') {
    const user = await requireUser(rawArgs, 'release-assets <id_or_username>');
    if (!user) return;
    const wallet = await bankRepository.findWalletByUserId(user.id);
    if (wallet) {
      console.log(`[OK] Verified wallet for ${user.username}. Balance: ${wallet.balance} ${wallet.currency}.`);
    } else {
      console.log(`[OK] No active wallet found for ${user.username}.`);
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
      console.log(`Muted: ${stateManager.isMuted(user.username)}`);
      console.log(`Jailed: ${stateManager.isJailed(user.username)}`);
      const wallet = await bankRepository.findWalletByUserId(user.id);
      console.log(`Wallet Frozen: ${wallet ? stateManager.isWalletFrozen(wallet.id.toString()) : false}`);
      try {
        const userAuditLogs = await db.select().from(auditLogs).where(
          sql`${auditLogs.targetId} = ${String(user.id)} OR ${auditLogs.targetId} = ${user.username}`
        ).orderBy(desc(auditLogs.timestamp)).limit(50);
        if (userAuditLogs.length > 0) {
          printTable(userAuditLogs.map(a => ({ ID: a.logId, Action: a.action, Reason: a.reason, Time: a.timestamp })));
        } else {
          console.log('No audit records found for this user.');
        }
      } catch (err) {
        console.log(`[ERROR] Failed to fetch audit logs: ${(err as Error).message}`);
      }
    } else {
      const allUsers = await db.select().from(users).limit(100);
      const flagged = allUsers.filter(u => 
        ['BANNED', 'SUSPENDED', 'RESTRICTED', 'BLOCKED'].includes(u.role) ||
        u.scheduledDeletionAt ||
        stateManager.isMuted(u.username) ||
        stateManager.isJailed(u.username)
      );
      if (flagged.length > 0) {
        printTable(flagged.map(u => ({
          ID: u.id,
          Username: u.username,
          Role: simplifyRole(u.role),
          Status: resolveUserStatus(u),
          Muted: stateManager.isMuted(u.username) ? 'Y' : 'N',
          Jailed: stateManager.isJailed(u.username) ? 'Y' : 'N'
        })));
      } else {
        console.log('No flagged accounts.');
      }
    }
    return;
  }

  if (sub === 'nominations') {
    try {
      const noms = await db.select().from(supportAdminNominations).orderBy(desc(supportAdminNominations.createdAt));
      if (noms.length === 0) {
        console.log('No nominations found.');
        return;
      }
      printTable(noms.map(n => ({
        ID: n.id,
        Target: n.nominatedUserId,
        NominatedBy: n.nominatedBy,
        Status: n.status,
        Created: n.createdAt ? new Date(n.createdAt).toISOString().split('T')[0] : '-'
      })));
    } catch (err) {
      console.log(`Error listing nominations: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'approve') {
    const [nomIdStr] = rawArgs;
    if (!nomIdStr) {
      console.log('Usage: approve <nomination_id>');
      return;
    }
    const nomId = parseInt(nomIdStr, 10);
    if (isNaN(nomId)) {
      console.log('Invalid nomination ID.');
      return;
    }
    
    try {
      const [nomination] = await db.select().from(supportAdminNominations).where(eq(supportAdminNominations.id, nomId)).limit(1);
      if (!nomination) {
        console.log('Nomination not found.');
        return;
      }
      if (nomination.status !== 'pending') {
        console.log(`Nomination cannot be approved. Current status: ${nomination.status}`);
        return;
      }
      
      const [targetUser] = await db.select().from(users).where(eq(users.id, nomination.nominatedUserId)).limit(1);
      if (!targetUser) {
        console.log('Nominated user not found.');
        return;
      }
      
      const adminUsername = `Sa-${targetUser.username}`;
      const adminPassword = `Sa-Vel-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const adminSalt = crypto.randomBytes(16).toString('hex');
      const adminPasswordHash = await hashArgon2id(adminPassword, Buffer.from(adminSalt, 'hex'));
      const adminRecoveryKey = `Sa-Vel-Sup-${Math.floor(10000 + Math.random() * 90000)}`;
      const adminRecoveryKeyHash = await hashArgon2id(adminRecoveryKey, Buffer.from(adminSalt, 'hex'));
      const adminPanicPhrase = `Sa-P-${Math.floor(100000 + Math.random() * 900000)}`;
      const adminPanicPhraseHash = await hashArgon2id(adminPanicPhrase, Buffer.from(adminSalt, 'hex'));
      
      const [newAdmin] = await db.insert(users).values({
        username: adminUsername,
        passwordHash: adminPasswordHash,
        salt: adminSalt,
        role: 'SUPPORT_ADMIN',
        displayName: `${targetUser.displayName || targetUser.username} (Support)`,
        recoveryKeyHash: adminRecoveryKeyHash,
        panicPhraseHash: adminPanicPhraseHash,
        duressActive: true
      }).returning();
      
      const credentialsData = JSON.stringify({
        username: adminUsername,
        password: adminPassword,
        recoveryKey: adminRecoveryKey,
        panicPhrase: adminPanicPhrase
      });
      
      await db.update(supportAdminNominations)
        .set({ 
          status: 'approved',
          adminAccountId: newAdmin.id,
          credentials: credentialsData,
          updatedAt: new Date()
        })
        .where(eq(supportAdminNominations.id, nomId));
        
      const systemBot = SystemBot.getInstance();
      await systemBot.sendToUser(nomination.nominatedUserId,
        `You have been nominated and APPROVED for the Velum Support Administrator role.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `NEXT STEPS:\n` +
        `• Your support admin credentials have been generated\n` +
        `• You must ACCEPT this role to activate your credentials\n` +
        `• If you DECLINE, the credentials will be purged\n\n` +
        `Please check the Bot DM screen in the client interface to accept or decline the role.\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      );
      
      console.log(`[OK] Nomination approved. Support admin account created for ${targetUser.username}.`);
      await logAudit('/users/approve', String(nomId), `Approved support admin nomination`);
    } catch (err) {
      console.log(`Failed to approve nomination: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'reject') {
    const [nomIdStr, ...reasonParts] = rawArgs;
    if (!nomIdStr) {
      console.log('Usage: reject <nomination_id> [reason]');
      return;
    }
    const nomId = parseInt(nomIdStr, 10);
    if (isNaN(nomId)) {
      console.log('Invalid nomination ID.');
      return;
    }
    const reason = reasonParts.join(' ') || 'Rejected via admin CLI';
    
    try {
      const [nomination] = await db.select().from(supportAdminNominations).where(eq(supportAdminNominations.id, nomId)).limit(1);
      if (!nomination) {
        console.log('Nomination not found.');
        return;
      }
      if (nomination.status !== 'pending') {
        console.log(`Nomination cannot be rejected. Current status: ${nomination.status}`);
        return;
      }
      
      await db.update(supportAdminNominations)
        .set({ 
          status: 'rejected',
          updatedAt: new Date()
        })
        .where(eq(supportAdminNominations.id, nomId));
        
      const systemBot = SystemBot.getInstance();
      await systemBot.sendToUser(nomination.nominatedUserId,
        `Your nomination for the Velum Support Administrator role has been declined.\n\n` +
        `Reason: ${reason}\n\n` +
        `Your regular user account remains unchanged.`
      );
      
      console.log(`[OK] Nomination ${nomId} rejected. User notified.`);
      await logAudit('/users/reject', String(nomId), `Rejected support admin nomination`);
    } catch (err) {
      console.log(`Failed to reject nomination: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'demote') {
    const [targetStr] = rawArgs;
    if (!targetStr) {
      console.log('Usage: demote <uid/username>');
      return;
    }
    
    try {
      let targetUser = await db.select().from(users).where(eq(users.username, targetStr)).limit(1).then(r => r[0]);
      if (!targetUser) {
        const uid = parseInt(targetStr, 10);
        if (!isNaN(uid)) {
          targetUser = await db.select().from(users).where(eq(users.id, uid)).limit(1).then(r => r[0]);
        }
      }
      if (!targetUser) {
        console.log('User not found.');
        return;
      }

      if (!guardProtectedUser(targetUser.id, 'demote')) return;
      
      const adminUsername = `support_${targetUser.username}`;
      const deletedAdmin = await db.delete(users).where(
        and(
          eq(users.username, adminUsername),
          eq(users.role, 'SUPPORT_ADMIN')
        )
      ).returning();
      
      if (deletedAdmin.length === 0) {
        console.log(`No active support admin account found for support_${targetUser.username}.`);
        return;
      }
      
      await db.update(supportAdminNominations)
        .set({ 
          status: 'revoked',
          updatedAt: new Date()
        })
        .where(eq(supportAdminNominations.nominatedUserId, targetUser.id));
        
      const systemBot = SystemBot.getInstance();
      await systemBot.sendToUser(targetUser.id,
        `Your Support Administrator access has been revoked by CLI_ADMIN.\n\n` +
        `Your regular user account remains unchanged.`
      );
      
      console.log(`[OK] Support admin account support_${targetUser.username} demoted and deleted.`);
      await logAudit('/users/demote', String(targetUser.id), `Demoted support admin`);
    } catch (err) {
      console.log(`Failed to demote user: ${(err as Error).message}`);
    }
    return;
  }
}
