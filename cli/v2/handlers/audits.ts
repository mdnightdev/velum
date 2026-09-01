import fs from 'node:fs';
import path from 'node:path';
import { desc, sql, eq } from 'drizzle-orm';
import { db } from '../../../server/v2/db/client.js';
import { auditLogs } from '../../../server/v2/db/schema/audit_logs.js';
import { sessions } from '../../../server/v2/db/schema/sessions.js';
import { lounges } from '../../../server/v2/db/schema/lounges.js';
import { users } from '../../../server/v2/db/schema/users.js';
import { wallets, transactions } from '../../../server/v2/db/schema/wallets.js';
import { devices, userDevices, ipAddresses } from '../../../server/v2/db/schema/devices.js';
import { bankRepository } from '../../../server/v2/repositories/bankRepository.js';
import { getRedisClient } from '../../../server/v2/db/redis.js';
import { parseDeviceModel, parseLocation } from '../utils/deviceParser.js';
import { printTable, printDetail } from '../table.js';
import { theme } from '../theme.js';
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
        for (const s of sessList) {
          const [u] = await db.select().from(users).where(eq(users.id, s.userId)).limit(1);
          const [userDev] = await db.select().from(userDevices).where(eq(userDevices.userId, s.userId)).limit(1);
          const [dev] = userDev ? await db.select().from(devices).where(eq(devices.deviceId, userDev.deviceId)).limit(1) : [null];

          const info = parseDeviceModel(s.userAgent, dev?.platform, dev?.webglRenderer);
          const loc = parseLocation(s.ipAddress);

          printDetail(`Session Audit: ${s.id}`, {
            SessionID: s.id,
            User: `${u?.username || 'Unknown'} (ID: ${s.userId}, Role: ${u?.role || 'USER'})`,
            IP: s.ipAddress || '127.0.0.1',
            Location: loc,
            DeviceModel: info.device,
            OperatingSystem: info.os,
            BrowserEngine: info.browser,
            DeviceFingerprint: dev?.deviceFingerprint || 'N/A',
            WebGLGPU: dev?.webglRenderer || 'N/A',
            Screen: dev?.screenResolution || 'N/A',
            ExpiresAt: s.expiresAt ? new Date(s.expiresAt).toISOString() : 'N/A'
          });
        }
      } else {
        console.log(`Session or user ID "${sid}" not found.`);
      }
    } catch (err) {
      console.log(`[ERROR] Session query failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'devices') {
    const target = rawArgs[0];
    if (!target) { console.log('Usage: devices <user_id_or_username>'); return; }
    try {
      const user = await resolveUser(target);
      if (!user) { console.log(`User "${target}" not found.`); return; }

      const uDevs = await db.select().from(userDevices).where(eq(userDevices.userId, user.id));
      if (uDevs.length === 0) {
        console.log(`No registered devices found for user ${user.username}.`);
        return;
      }

      const rows = [];
      for (const ud of uDevs) {
        const [dev] = await db.select().from(devices).where(eq(devices.deviceId, ud.deviceId)).limit(1);
        const parsed = parseDeviceModel(dev?.userAgent, dev?.platform, dev?.webglRenderer);
        rows.push({
          DeviceID: ud.deviceId.substring(0, 16) + '...',
          Model: parsed.device,
          OS: parsed.os,
          GPU: (dev?.webglRenderer || '-').substring(0, 20),
          Fingerprint: (dev?.deviceFingerprint || '-').substring(0, 16) + '...',
          FirstSeen: ud.firstSeen ? new Date(ud.firstSeen).toISOString().split('T')[0] : '-',
          LastSeen: ud.lastSeen ? new Date(ud.lastSeen).toISOString().split('T')[0] : '-',
          Current: ud.isCurrent ? 'Y' : 'N'
        });
      }

      console.log(`Registered Devices for ${user.username} (ID: ${user.id}):`);
      printTable(rows);
      await logAudit('/audits/devices', user.username, `Audited ${rows.length} devices`);
    } catch (err) {
      console.log(`[ERROR] Devices query failed: ${(err as Error).message}`);
    }
    return;
  }

  if (sub === 'export') {
    try {
      const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp)).limit(500);
      const backupDir = path.resolve(process.cwd(), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const filename = `velum_audit_${Date.now()}.json`;
      const filepath = path.join(backupDir, filename);
      fs.writeFileSync(filepath, JSON.stringify({
        exportedAt: new Date().toISOString(),
        totalRecords: logs.length,
        logs
      }, null, 2), 'utf-8');

      console.log(`[OK] Exported ${logs.length} audit records to: ${filepath}`);
      await logAudit('/audits/export', filename, `Exported ${logs.length} records`);
    } catch (err) {
      console.log(`[ERROR] Audit export failed: ${(err as Error).message}`);
    }
    return;
  }

  // Ledger Audit & Discrepancy Highlighting
  if (sub === 'ledger' || sub === 'bank' || sub === 'balances') {
    try {
      const allWallets = await db.select().from(wallets).limit(500);
      const allUsers = await db.select({ id: users.id, username: users.username }).from(users);
      const userMap = new Map(allUsers.map(u => [u.id, u.username]));

      const allTxs = await db.select().from(transactions);
      const txsByWallet = new Map<number, typeof allTxs>();
      for (const t of allTxs) {
        if (!txsByWallet.has(t.walletId)) txsByWallet.set(t.walletId, []);
        txsByWallet.get(t.walletId)!.push(t);
      }

      let discrepanciesCount = 0;
      const rows = allWallets.map(w => {
        const userTxs = txsByWallet.get(w.id) || [];
        const computedBal = userTxs.reduce((acc, t) => {
          const amt = parseFloat(t.amount || '0');
          return acc + (t.type === 'WITHDRAWAL' || t.type === 'TRANSFER_OUT' ? -Math.abs(amt) : Math.abs(amt));
        }, 0);

        const storedBal = parseFloat(w.balance || '0');
        const variance = storedBal - computedBal;
        const hasMismatch = Math.abs(variance) >= 0.01;

        if (hasMismatch) discrepanciesCount++;

        return {
          WalletID: w.id,
          User: userMap.get(w.userId) || `ID:${w.userId}`,
          StoredBalance: `${storedBal.toFixed(2)} ${w.currency}`,
          LedgerSum: `${computedBal.toFixed(2)} ${w.currency}`,
          Variance: hasMismatch ? `${theme.red}${variance > 0 ? '+' : ''}${variance.toFixed(2)}${theme.reset}` : '0.00',
          Status: hasMismatch ? `${theme.red}[DISCREPANCY]${theme.reset}` : `${theme.green}[OK]${theme.reset}`
        };
      });

      console.log(`[Ledger Integrity Verification]`);
      printTable(rows);

      if (discrepanciesCount > 0) {
        console.log(`\n${theme.red}[ALERT] ${discrepanciesCount} wallet discrepancy detected!${theme.reset}`);
        console.log(`Use "audits cat <wallet_id|username>" to inspect transaction history.`);
        console.log(`Use "audits repair [wallet_id|username|all]" to automatically reconcile balances to match ledger truth.`);
      } else {
        console.log(`\n${theme.green}[OK] All ${allWallets.length} wallet balances match ledger transactions with 100% atomicity.${theme.reset}`);
      }

      await logAudit('/audits/ledger', 'SYSTEM', `Audited ${allWallets.length} wallets, found ${discrepanciesCount} discrepancies`);
    } catch (err) {
      console.log(`[ERROR] Ledger audit failed: ${(err as Error).message}`);
    }
    return;
  }

  // Inspect Chronological Transaction History and Balance Trail
  if (sub === 'cat' || sub === 'history' || sub === 'inspect') {
    const target = rawArgs[0];
    if (!target) {
      console.log('Usage: audits cat <wallet_id_or_username>');
      return;
    }

    try {
      let targetWallet: any = null;
      let targetUsername = target;

      const numericId = parseInt(target, 10);
      if (!isNaN(numericId)) {
        const [w] = await db.select().from(wallets).where(eq(wallets.id, numericId)).limit(1);
        if (w) {
          targetWallet = w;
          const [u] = await db.select().from(users).where(eq(users.id, w.userId)).limit(1);
          if (u) targetUsername = u.username;
        }
      }

      if (!targetWallet) {
        const user = await resolveUser(target);
        if (!user) {
          console.log(`Wallet or user "${target}" not found.`);
          return;
        }
        targetUsername = user.username;
        const [w] = await db.select().from(wallets).where(eq(wallets.userId, user.id)).limit(1);
        targetWallet = w;
      }

      if (!targetWallet) {
        console.log(`No wallet found for user "${targetUsername}".`);
        return;
      }

      const txList = await db.select().from(transactions).where(eq(transactions.walletId, targetWallet.id)).orderBy(transactions.createdAt);

      if (txList.length === 0) {
        console.log(`[Ledger History: ${targetUsername} (Wallet #${targetWallet.id})]`);
        console.log('No transactions recorded for this wallet.');
        console.log(`Current Stored Balance: ${targetWallet.balance} ${targetWallet.currency}`);
        return;
      }

      let runningBal = 0;
      let totalIn = 0;
      let totalOut = 0;

      const rows = txList.map(t => {
        const amt = parseFloat(t.amount || '0');
        const isOutflow = t.type === 'WITHDRAWAL' || t.type === 'TRANSFER_OUT';
        if (isOutflow) {
          totalOut += Math.abs(amt);
          runningBal -= Math.abs(amt);
        } else {
          totalIn += Math.abs(amt);
          runningBal += Math.abs(amt);
        }

        return {
          Time: t.createdAt ? new Date(t.createdAt).toISOString().replace('T', ' ').substring(0, 19) : '-',
          Reference: t.reference,
          Type: t.type,
          Amount: `${isOutflow ? '-' : '+'}${Math.abs(amt).toFixed(2)}`,
          RunningBalance: `${runningBal.toFixed(2)} USDT`,
          Status: t.status,
          Description: t.description || '-'
        };
      });

      console.log(`[Ledger History: ${targetUsername} (Wallet #${targetWallet.id})]`);
      printTable(rows);

      const storedBal = parseFloat(targetWallet.balance || '0');
      const variance = storedBal - runningBal;
      const isConsistent = Math.abs(variance) < 0.01;

      console.log(`\n[Account Integrity Summary]`);
      console.log(`Total Inflow: +$${totalIn.toFixed(2)} | Total Outflow: -$${totalOut.toFixed(2)}`);
      console.log(`Calculated Final Ledger Balance: $${runningBal.toFixed(2)} USDT`);
      console.log(`Stored Current Wallet Balance:   $${storedBal.toFixed(2)} USDT`);
      if (!isConsistent) {
        console.log(`${theme.red}[DISCREPANCY] Variance of ${variance > 0 ? '+' : ''}${variance.toFixed(2)} USDT detected! Run "audits repair ${targetWallet.id}" to reconcile.${theme.reset}`);
      } else {
        console.log(`${theme.green}[OK] Wallet balance matches transaction ledger with 100% mathematical integrity.${theme.reset}`);
      }

      await logAudit('/audits/cat', targetUsername, `Inspected ledger history for wallet #${targetWallet.id}`);
    } catch (err) {
      console.log(`[ERROR] Ledger inspection failed: ${(err as Error).message}`);
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
      const userList = await db.select({ id: users.id, username: users.username }).from(users);
      const userMap = new Map(userList.map(u => [u.id, u.username]));

      const rows = [];
      for (const s of activeSess) {
        const [userDev] = await db.select().from(userDevices).where(eq(userDevices.userId, s.userId)).limit(1);
        const [dev] = userDev ? await db.select().from(devices).where(eq(devices.deviceId, userDev.deviceId)).limit(1) : [null];
        const info = parseDeviceModel(s.userAgent, dev?.platform, dev?.webglRenderer);
        const loc = parseLocation(s.ipAddress);

        rows.push({
          IP: s.ipAddress || '127.0.0.1',
          Location: loc,
          User: `${userMap.get(s.userId) || `ID:${s.userId}`}`,
          Device: info.device,
          OS: info.os,
          Client: info.browser,
          DeviceID: (dev?.deviceId || s.id).substring(0, 16)
        });
      }

      printTable(rows);
      await logAudit('/audits/ip', 'SYSTEM', `Scanned ${rows.length} session IP entries`);
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

  // Automated Ledger Balance Auto-Repair (Reconciles wallet balance to true sum of transactions)
  // Syntax: repair [wallet_id | username | all]
  if (sub === 'repair') {
    const target = rawArgs[0] || 'all';

    try {
      const allWallets = await db.select().from(wallets);
      const allUsers = await db.select({ id: users.id, username: users.username }).from(users);
      const userMap = new Map(allUsers.map(u => [u.id, u.username]));
      const allTxs = await db.select().from(transactions);

      const txsByWallet = new Map<number, typeof allTxs>();
      for (const t of allTxs) {
        if (!txsByWallet.has(t.walletId)) txsByWallet.set(t.walletId, []);
        txsByWallet.get(t.walletId)!.push(t);
      }

      let walletsToRepair: typeof allWallets = [];

      if (target === 'all') {
        // Find all wallets with discrepancies
        walletsToRepair = allWallets.filter(w => {
          const userTxs = txsByWallet.get(w.id) || [];
          const computedBal = userTxs.reduce((acc, t) => {
            const amt = parseFloat(t.amount || '0');
            return acc + (t.type === 'WITHDRAWAL' || t.type === 'TRANSFER_OUT' ? -Math.abs(amt) : Math.abs(amt));
          }, 0);
          const storedBal = parseFloat(w.balance || '0');
          return Math.abs(storedBal - computedBal) >= 0.01;
        });

        if (walletsToRepair.length === 0) {
          console.log(`[OK] All ${allWallets.length} wallet balances are already 100% synchronized with ledger transactions. No repairs needed.`);
          return;
        }
      } else {
        // Specific target wallet or user
        let matchedWallet: any = null;
        const numericId = parseInt(target, 10);
        if (!isNaN(numericId)) {
          matchedWallet = allWallets.find(w => w.id === numericId);
        }
        if (!matchedWallet) {
          const user = await resolveUser(target);
          if (user) {
            matchedWallet = allWallets.find(w => w.userId === user.id);
          }
        }
        if (!matchedWallet) {
          console.log(`Target wallet or user "${target}" not found.`);
          return;
        }
        walletsToRepair = [matchedWallet];
      }

      const repairResults: { WalletID: number; User: string; PreviousBalance: string; RepairedBalance: string; Variance: string }[] = [];

      await db.transaction(async (tx) => {
        for (const w of walletsToRepair) {
          const userTxs = txsByWallet.get(w.id) || [];
          const computedBal = userTxs.reduce((acc, t) => {
            const amt = parseFloat(t.amount || '0');
            return acc + (t.type === 'WITHDRAWAL' || t.type === 'TRANSFER_OUT' ? -Math.abs(amt) : Math.abs(amt));
          }, 0);

          const storedBal = parseFloat(w.balance || '0');
          const variance = storedBal - computedBal;
          const trueBalStr = computedBal.toFixed(2);

          await tx.update(wallets).set({
            balance: trueBalStr,
            updatedAt: new Date()
          }).where(eq(wallets.id, w.id));

          repairResults.push({
            WalletID: w.id,
            User: userMap.get(w.userId) || `ID:${w.userId}`,
            PreviousBalance: `${storedBal.toFixed(2)} ${w.currency}`,
            RepairedBalance: `${trueBalStr} ${w.currency}`,
            Variance: `${variance > 0 ? '+' : ''}${variance.toFixed(2)}`
          });
        }
      });

      // Clear cache
      try {
        const redis = await getRedisClient();
        if (redis) {
          await redis.del('bank:all_accounts');
          await redis.del('bank:all_transactions');
        }
      } catch {}

      console.log(`[OK] Successfully auto-reconciled and repaired ${repairResults.length} wallet(s) to match exact ledger truth:`);
      printTable(repairResults);

      await logAudit('/audits/repair', target, `Auto-repaired ${repairResults.length} wallets to match ledger truth`);
    } catch (err) {
      console.log(`[ERROR] Wallet repair failed: ${(err as Error).message}`);
    }
    return;
  }
}
