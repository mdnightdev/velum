import { desc, sql } from 'drizzle-orm';
import { db } from '../../../server/v2/db/client.js';
import { auditLogs } from '../../../server/v2/db/schema/audit_logs.js';
import { sessions } from '../../../server/v2/db/schema/sessions.js';
import { lounges } from '../../../server/v2/db/schema/lounges.js';
import { users } from '../../../server/v2/db/schema/users.js';
import { wallets } from '../../../server/v2/db/schema/wallets.js';
import { bankRepository } from '../../../server/v2/repositories/bankRepository.js';
import { printTable } from '../table.js';
import type { CommandContext } from '../types.js';

export async function handleAudits(ctx: CommandContext): Promise<void> {
  const { sub, rawArgs, resolveUser, logAudit } = ctx;

  if (sub === 'grep') {
    const pattern = (rawArgs[0] || '').toLowerCase();
    try {
      const logs = await db.select().from(auditLogs).where(
        sql`${auditLogs.logId} ILIKE ${`%${pattern}%`} OR 
            ${auditLogs.action} ILIKE ${`%${pattern}%`} OR
            ${auditLogs.targetId} ILIKE ${`%${pattern}%`} OR
            ${auditLogs.reason} ILIKE ${`%${pattern}%`}`
      ).orderBy(desc(auditLogs.timestamp)).limit(100);
      if (logs.length > 0) {
        printTable(logs.map(l => ({ ID: l.logId, Action: l.action, Target: l.targetId, Reason: l.reason, Time: l.timestamp })));
      } else {
        console.log('No matching audit logs found.');
      }
    } catch (err) {
      console.log(`[ERROR] Audit search failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'session') {
    const sid = rawArgs[0];
    if (!sid) { console.log('Usage: session <session_id_or_user_id>'); return; }
    try {
      const sessList = await db.select().from(sessions).where(sql`${sessions.id} = ${sid} OR ${sessions.userId} = ${parseInt(sid, 10) || -1}`);
      if (sessList.length > 0) {
        printTable(sessList.map(s => ({
          SessionID: s.id,
          UserID: s.userId,
          IP: s.ipAddress || '127.0.0.1',
          UserAgent: (s.userAgent || 'Velum-Cli').substring(0, 30),
          ExpiresAt: s.expiresAt
        })));
      } else {
        console.log(`Session or user ID "${sid}" not found.`);
      }
    } catch (err) {
      console.log(`[ERROR] Session query failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'ledger') {
    try {
      const allTxs = await (bankRepository as any).findAllTransactions(500);
      console.log(`[OK] Verified ${allTxs.length} ledger transactions.`);
      await logAudit('/audits/ledger', 'SYSTEM', `Verified ${allTxs.length} transactions`);
    } catch (err) {
      console.log(`[ERROR] Ledger audit failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'hijacks') {
    try {
      const activeSess = await db.select().from(sessions);
      const userIpMap = new Map<number, Set<string>>();
      activeSess.forEach(s => {
        if (!userIpMap.has(s.userId)) userIpMap.set(s.userId, new Set());
        if (s.ipAddress) userIpMap.get(s.userId)!.add(s.ipAddress);
      });
      const anomalies = Array.from(userIpMap.entries()).filter(([_, ips]) => ips.size > 1);
      console.log(`Total Active Sessions: ${activeSess.length}`);
      if (anomalies.length > 0) {
        console.log(`[ALERT] Found ${anomalies.length} users with multiple active IP sessions:`);
        printTable(anomalies.map(([u, ips]) => ({ UserID: u, IPs: Array.from(ips).join(', ') })));
      } else {
        console.log('[OK] 0 multi-IP anomalies detected.');
      }
      await logAudit('/audits/hijacks', 'SYSTEM', `Scanned ${activeSess.length} active sessions`);
    } catch (err) {
      console.log(`[ERROR] Scan failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'ip') {
    try {
      const activeSess = await db.select().from(sessions);
      const ipUsersMap = new Map<string, Set<number>>();
      activeSess.forEach(s => {
        const ip = s.ipAddress || '127.0.0.1';
        if (!ipUsersMap.has(ip)) ipUsersMap.set(ip, new Set());
        ipUsersMap.get(ip)!.add(s.userId);
      });
      const clusters = Array.from(ipUsersMap.entries()).map(([ip, usersSet]) => ({
        IP: ip,
        UserCount: usersSet.size,
        UserIDs: Array.from(usersSet).join(', ')
      }));
      printTable(clusters);
      await logAudit('/audits/ip', 'SYSTEM', 'Scanned session IP distribution');
    } catch (err) {
      console.log(`[ERROR] IP scan failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'nodes') {
    try {
      const allLounges = await db.select().from(lounges);
      const parentLounges = allLounges.filter(l => !l.parentLoungeId);
      const sublounges = allLounges.filter(l => l.parentLoungeId);
      
      const accessIssues = [];
      
      for (const parent of parentLounges) {
        const children = sublounges.filter(l => l.parentLoungeId === parent.id);
        
        if (parent.isHidden && !children.every(c => c.isHidden)) {
          accessIssues.push({
            issue: 'Parent hidden but has visible children',
            parent: parent.name,
            parentSlug: parent.slug,
            visibleChildren: children.filter(c => !c.isHidden).map(c => c.name)
          });
        }
        
        if (parent.accessLevel === 'EXEC_ONLY' && !children.every(c => c.accessLevel === 'EXEC_ONLY')) {
          accessIssues.push({
            issue: 'EXEC_ONLY parent has non-executive children',
            parent: parent.name,
            parentSlug: parent.slug,
            nonExecChildren: children.filter(c => c.accessLevel !== 'EXEC_ONLY').map(c => c.name)
          });
        }
      }
      
      console.log(`Total Lounges: ${allLounges.length} (Parents: ${parentLounges.length}, Sublounges: ${sublounges.length}, Hidden: ${allLounges.filter(l => l.isHidden).length}, Private: ${allLounges.filter(l => l.isPrivate).length})`);
      
      if (accessIssues.length > 0) {
        console.log(`[WARNING] Found ${accessIssues.length} access issues:`);
        printTable(accessIssues);
      } else {
        console.log('[OK] Channel permissions validated.');
      }
      
      await logAudit('/audits/nodes', 'SYSTEM', `Scanned ${allLounges.length} lounges, found ${accessIssues.length} issues`);
    } catch (err) {
      console.log(`[ERROR] Channel scan failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'reconstruct') {
    try {
      const allUsers = await db.select().from(users).limit(200);
      const allSessions = await db.select().from(sessions);
      const allWallets = await db.select().from(wallets).limit(200);
      
      const roleDistribution: Record<string, number> = {};
      allUsers.forEach(u => {
        roleDistribution[u.role] = (roleDistribution[u.role] || 0) + 1;
      });
      
      printTable(Object.entries(roleDistribution).map(([role, count]) => ({ Role: role, Count: count })));
      
      const activeUsers = allUsers.filter(u => {
        const hasSession = allSessions.some(s => s.userId === u.id);
        const hasWallet = allWallets.some(w => w.userId === u.id);
        return hasSession || hasWallet;
      });
      
      console.log(`Active Users: ${activeUsers.length} | Inactive Users: ${allUsers.length - activeUsers.length}`);
      await logAudit('/audits/reconstruct', 'SYSTEM', `Audited ${allUsers.length} users, ${activeUsers.length} active`);
    } catch (err) {
      console.log(`[ERROR] Account audit failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'repair') {
    const [target, deltaCentsStr] = rawArgs;
    if (!target || !deltaCentsStr) { console.log('Usage: repair <id_or_username> <amount_cents>'); return; }
    const deltaCents = parseInt(deltaCentsStr, 10);
    if (isNaN(deltaCents)) { console.log('Invalid cents amount.'); return; }
    const user = await resolveUser(target);
    if (!user) { console.log(`User "${target}" not found.`); return; }
    const wallet = await bankRepository.findWalletByUserId(user.id);
    if (!wallet) { console.log(`No wallet found for user ${user.username}.`); return; }
    const currentBal = parseFloat(wallet.balance || '0');
    const newBal = (currentBal + (deltaCents / 100)).toFixed(2);
    await bankRepository.updateBalance(wallet.id, newBal);
    console.log(`[OK] Applied balance delta ($${(deltaCents / 100).toFixed(2)}) to ${user.username}. New balance: ${newBal}.`);
    await logAudit('/audits/repair', user.username, `Applied ledger repair delta ${deltaCents} cents`);
    return;
  }
}
