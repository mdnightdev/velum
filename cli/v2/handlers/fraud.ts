import { desc, sql } from 'drizzle-orm';
import { db } from '../../../server/v2/db/client.js';
import { auditLogs } from '../../../server/v2/db/schema/audit_logs.js';
import { users } from '../../../server/v2/db/schema/users.js';
import { bankRepository } from '../../../server/v2/repositories/bankRepository.js';
import { userRepository } from '../../../server/v2/repositories/userRepository.js';
import { stateManager } from '../state/stateManager.js';
import { printTable } from '../table.js';
import { guardProtectedUser } from '../protection.js';
import type { CommandContext } from '../types.js';

export async function handleFraud(ctx: CommandContext): Promise<void> {
  const { sub, rawArgs, requireUser, resolveUser } = ctx;

  if (sub === 'risklog') {
    try {
      const fraudAudits = await db.select().from(auditLogs)
        .where(sql`${auditLogs.action} ILIKE ${'%fraud%'} OR ${auditLogs.action} ILIKE ${'%freeze%'} OR ${auditLogs.action} ILIKE ${'%seize%'} OR ${auditLogs.action} ILIKE ${'%risk%'}`)
        .orderBy(desc(auditLogs.timestamp))
        .limit(50);
      
      const allUsers = await db.select().from(users).limit(100);
      const riskUsers = [];
      for (const u of allUsers) {
        const w = await bankRepository.findWalletByUserId(u.id);
        const isFrz = w ? stateManager.isWalletFrozen(w.id.toString()) : false;
        if (u.role === 'SUSPENDED' || u.role === 'BANNED' || isFrz) {
          riskUsers.push({
            ID: u.id,
            Username: u.username,
            Role: u.role,
            Frozen: isFrz ? 'Y' : 'N',
            Status: u.role === 'BANNED' ? 'BANNED' : u.role === 'SUSPENDED' ? 'SUSPENDED' : 'FROZEN'
          });
        }
      }
      
      if (fraudAudits.length > 0) {
        printTable(fraudAudits.map(a => ({ 
          ID: a.logId, 
          Action: a.action, 
          Target: a.targetId, 
          Reason: a.reason, 
          Time: a.timestamp 
        })));
      } else {
        console.log('No recent fraud-related actions logged.');
      }
      
      if (riskUsers.length > 0) {
        printTable(riskUsers);
      } else {
        console.log('No flagged users found.');
      }
    } catch (err) {
      console.log(`[ERROR] Risk log query failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'freeze') {
    const user = await requireUser(rawArgs, 'freeze <id_or_username>');
    if (!user) return;
    if (!guardProtectedUser(user.id, 'freeze')) return;
    const wallet = await bankRepository.findWalletByUserId(user.id);
    if (wallet) {
      await stateManager.addFrozenWallet(wallet.id.toString());
    }
    await userRepository.update(user.id, { role: 'SUSPENDED' });
    console.log(`[OK] Suspended user ${user.username} and froze wallet.`);
    return;
  }

  if (sub === 'unfreeze') {
    const user = await requireUser(rawArgs, 'unfreeze <id_or_username>');
    if (!user) return;
    const wallet = await bankRepository.findWalletByUserId(user.id);
    if (wallet) {
      await stateManager.removeFrozenWallet(wallet.id.toString());
    }
    await userRepository.update(user.id, { role: 'USER' });
    console.log(`[OK] Restored user ${user.username} and unfroze wallet.`);
    return;
  }

  if (sub === 'seize') {
    const user = await requireUser(rawArgs, 'seize <id_or_username>');
    if (!user) return;
    if (!guardProtectedUser(user.id, 'seize')) return;
    const wallet = await bankRepository.findWalletByUserId(user.id);
    if (wallet) {
      await bankRepository.updateBalance(wallet.id, '0.00');
    }
    await userRepository.delete(user.id);
    console.log(`[OK] Cleared balance and deleted user ${user.username}.`);
    return;
  }

  if (sub === 'flags') {
    const target = rawArgs[0];
    if (target) {
      const user = await resolveUser(target);
      if (!user) { console.log(`User "${target}" not found.`); return; }
      const wallet = await bankRepository.findWalletByUserId(user.id);
      const isFrozen = wallet ? stateManager.isWalletFrozen(wallet.id.toString()) : false;
      const isSuspended = user.role === 'SUSPENDED' || user.role === 'BANNED';
      console.log(`Role: ${user.role}`);
      console.log(`Suspended/Banned: ${isSuspended}`);
      console.log(`Wallet Frozen: ${isFrozen}`);
      try {
        const riskAudits = await db.select().from(auditLogs).where(
          sql`${auditLogs.targetId} = ${String(user.id)} OR ${auditLogs.targetId} = ${user.username}`
        ).orderBy(desc(auditLogs.timestamp)).limit(50);
        const fraudAudits = riskAudits.filter(l => l.action.includes('fraud') || l.action.includes('freeze') || l.action.includes('seize'));
        if (fraudAudits.length > 0) {
          printTable(fraudAudits.map(a => ({ ID: a.logId, Action: a.action, Reason: a.reason, Time: a.timestamp })));
        }
      } catch (err) {
        console.log(`[ERROR] Failed to fetch risk audits: ${(err as Error).message}`);
      }
      return;
    }
    const allUsers = await db.select().from(users).limit(100);
    const riskUsers = [];
    for (const u of allUsers) {
      const w = await bankRepository.findWalletByUserId(u.id);
      const isFrz = w ? stateManager.isWalletFrozen(w.id.toString()) : false;
      if (u.role === 'SUSPENDED' || u.role === 'BANNED' || isFrz) {
        riskUsers.push({
          ID: u.id,
          Username: u.username,
          Role: u.role,
          Frozen: isFrz ? 'Y' : 'N'
        });
      }
    }
    if (riskUsers.length > 0) {
      printTable(riskUsers);
    } else {
      console.log('[OK] No active flags or frozen wallets.');
    }
    return;
  }
}
