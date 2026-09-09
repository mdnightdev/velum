import crypto from 'node:crypto';
import { db } from '../../../server/v2/db/client.js';
import { users } from '../../../server/v2/db/schema/users.js';
import { wallets, transactions } from '../../../server/v2/db/schema/wallets.js';
import { bankRepository } from '../../../server/v2/repositories/bankRepository.js';
import { reserveRepository } from '../../../server/v2/repositories/reserveRepository.js';
import { getRedisClient } from '../../../server/v2/db/redis.js';
import { stateManager } from '../state/stateManager.js';
import { printTable } from '../table.js';
import type { CommandContext } from '../types.js';
import { eq, sql } from 'drizzle-orm';

export async function handleBank(ctx: CommandContext): Promise<void> {
  const { sub, rawArgs, resolveUser, logAudit } = ctx;

  // 1. Bank Audit Summary
  if (sub === 'audit' || sub === 'bankau') {
    const allWallets = await db.select().from(wallets).limit(1000);
    const totalWalletBal = allWallets.reduce((acc, w) => acc + parseFloat(w.balance || '0'), 0);
    const allReserves = await reserveRepository.getAllReserves();
    const txCountRes = await db.select({ count: sql<number>`count(*)` }).from(transactions);
    const txCount = Number(txCountRes[0]?.count ?? 0);

    console.log(`[Bank Reconciliation]`);
    console.log(`Active Wallets: ${allWallets.length} | User Deposits: $${totalWalletBal.toFixed(2)} USDT | Recorded Transactions: ${txCount}`);
    if (allReserves.length > 0) {
      console.log(`\n[Bank Reserves]`);
      printTable(allReserves.map(r => ({
        Bank: r.reserveType,
        Balance: `$${(r.balanceCents / 100).toFixed(2)}`,
        Updated: r.updatedAt ? new Date(r.updatedAt).toISOString().replace('T', ' ').substring(0, 19) : '-'
      })));
    }
    await logAudit('/bank/audit', 'SYSTEM', 'Reconciled banking summary');
    return;
  }

  // 2. List Wallets & Bank Balances
  if (sub === 'wallets' || sub === 'list' || sub === 'banks' || sub === 'ls') {
    const allWallets = await db.select().from(wallets).limit(100);
    printTable(allWallets.map(w => ({
      ID: w.id,
      UserID: w.userId,
      Balance: `${w.balance} ${w.currency}`,
      Frozen: stateManager.isWalletFrozen(w.id.toString()) ? 'Y' : 'N'
    })));
    
    const allReserves = await reserveRepository.getAllReserves();
    if (allReserves.length > 0) {
      console.log();
      printTable(allReserves.map(r => ({
        Bank: r.reserveType,
        Balance: `$${(r.balanceCents / 100).toFixed(2)}`,
        Updated: r.updatedAt ? new Date(r.updatedAt).toISOString().split('T')[0] : '-'
      })));
    }
    return;
  }

  // 3. Transaction Statements
  if (sub === 'tx' || sub === 'txlog' || sub === 'statement') {
    const walletId = rawArgs[0] ? parseInt(rawArgs[0], 10) : undefined;
    let txs;
    if (walletId && !isNaN(walletId)) {
      txs = await bankRepository.getTransactionHistory(walletId, 50);
    } else {
      txs = await (bankRepository as any).findAllTransactions(50);
    }

    if (!txs || txs.length === 0) {
      console.log('No transactions recorded.');
      return;
    }

    printTable(txs.map((t: any) => ({
      Time: t.createdAt ? new Date(t.createdAt).toISOString().replace('T', ' ').substring(0, 19) : '-',
      Reference: t.reference,
      WalletID: t.walletId,
      Type: t.type,
      Amount: t.amount,
      Status: t.status,
      Description: t.description || '-'
    })));
    return;
  }

  // 4. Staff List
  if (sub === 'staff') {
    const allUsers = await db.select().from(users).limit(200);
    const staffUsers = allUsers.filter(u => ['ADMIN', 'BANK_ADMIN', 'SUPPORT_ADMIN', 'CLI_ADMIN', 'LOGIN_ADMIN'].includes(u.role));
    printTable(staffUsers.map(u => ({ ID: u.id, Username: u.username, Role: u.role })));
    return;
  }

  // 5. Unified Bank Funding: fund <c|t|e> <cents> [description]
  if (sub === 'fund' || sub === 'fundc' || sub === 'fundt' || sub === 'funde') {
    let target = '';
    let centsStr = '';
    let descParts: string[] = [];

    if (sub === 'fundc') {
      target = 'c';
      centsStr = rawArgs[0];
      descParts = rawArgs.slice(1);
    } else if (sub === 'fundt') {
      target = 't';
      centsStr = rawArgs[0];
      descParts = rawArgs.slice(1);
    } else if (sub === 'funde') {
      target = 'e';
      centsStr = rawArgs[0];
      descParts = rawArgs.slice(1);
    } else {
      target = (rawArgs[0] || '').toLowerCase();
      centsStr = rawArgs[1];
      descParts = rawArgs.slice(2);
    }

    const description = descParts.join(' ') || 'Direct funding';

    if (!target || (target !== 'c' && target !== 't' && target !== 'e')) {
      console.log('Usage: fund <c|t|e> <cents> [description]');
      console.log('  fund c <cents> [desc] - Funds Main Account directly');
      console.log('  fund t <cents> [desc] - Funds Reserve Account (deducted from Main Account)');
      console.log('  fund e <cents> [desc] - Funds Trading Account (deducted from Main Account)');
      return;
    }

    const cents = parseInt(centsStr || '', 10);
    if (isNaN(cents) || cents <= 0) {
      console.log('Invalid cents amount.');
      return;
    }

    // 1. fund c: Directly funds Main Account
    if (target === 'c') {
      try {
        const updated = await reserveRepository.updateBalance('Main Account', cents);
        console.log(`Funded $${(cents / 100).toFixed(2)} to Main Account (${description}). New Balance: $${(((updated?.balanceCents || 0)) / 100).toFixed(2)}.`);
        await logAudit('/bank/fund', 'Main Account', `Directly funded ${cents} cents (${description})`);
      } catch (err) {
        console.log(`Central Bank funding failed: ${(err as Error).message}`);
      }
      return;
    }

    // Check Main Account liquidity for transfers to Reserve Account (t) or Trading Account (e)
    const vcb = await reserveRepository.getReserve('Main Account');
    const availableCents = vcb?.balanceCents || 0;
    if (availableCents < cents) {
      console.log(`Insufficient funds in Main Account. Available: $${(availableCents / 100).toFixed(2)}, Required: $${(cents / 100).toFixed(2)}.`);
      return;
    }

    // 2. fund t: Funds Reserve Account from Main Account
    if (target === 't') {
      try {
        const updatedVcb = await reserveRepository.updateBalance('Main Account', -cents);
        const updatedSb = await reserveRepository.updateBalance('Reserve Account', cents);
        console.log(`Transferred $${(cents / 100).toFixed(2)} from Main Account to Reserve Account (${description}).`);
        console.log(`Reserve Account Balance: $${(((updatedSb?.balanceCents || 0)) / 100).toFixed(2)} | Main Account Remaining: $${(((updatedVcb?.balanceCents || 0)) / 100).toFixed(2)}`);
        await logAudit('/bank/fund', 'Reserve Account', `Transferred ${cents} cents from Main Account (${description})`);
      } catch (err) {
        console.log(`Reserve Account funding failed: ${(err as Error).message}`);
      }
      return;
    }

    // 3. fund e: Funds Trading Account from Main Account
    if (target === 'e') {
      try {
        const updatedVcb = await reserveRepository.updateBalance('Main Account', -cents);
        const updatedTrading = await reserveRepository.updateBalance('Trading Account', cents);
        console.log(`Transferred $${(cents / 100).toFixed(2)} from Main Account to Trading Account (${description}).`);
        console.log(`Trading Account Balance: $${(((updatedTrading?.balanceCents || 0)) / 100).toFixed(2)} | Main Account Remaining: $${(((updatedVcb?.balanceCents || 0)) / 100).toFixed(2)}`);
        await logAudit('/bank/fund', 'Trading Account', `Transferred ${cents} cents from Main Account (${description})`);
      } catch (err) {
        console.log(`Trading Account funding failed: ${(err as Error).message}`);
      }
      return;
    }
  }

  // 6. Multi-User Grant / Reward Disbursement (Atomic PostgreSQL Transaction)
  // Syntax: grant <user1:amount> <user2:amount> ... [reason]
  if (sub === 'grant' || sub === 'award') {
    if (rawArgs.length === 0) {
      console.log('Usage: grant <user1:amount> [user2:amount...] [reason]');
      return;
    }

    const grantPairs: { usernameOrId: string; amount: number }[] = [];
    const reasonParts: string[] = [];

    for (const arg of rawArgs) {
      if (arg.includes(':')) {
        const [target, amtStr] = arg.split(':');
        const amt = parseFloat(amtStr);
        if (target && !isNaN(amt) && amt > 0) {
          grantPairs.push({ usernameOrId: target, amount: amt });
          continue;
        }
      }
      reasonParts.push(arg);
    }

    if (grantPairs.length === 0) {
      console.log('Usage: grant <user1:amount> [user2:amount...] [reason]');
      return;
    }

    const reason = reasonParts.join(' ') || 'CLI Grant Award';

    // Step 1: Pre-resolve all users before entering database transaction
    const resolvedGrants: { user: any; amount: number }[] = [];
    for (const pair of grantPairs) {
      const user = await resolveUser(pair.usernameOrId);
      if (!user) {
        console.log(`[FAILED] Target user "${pair.usernameOrId}" not found. Entire grant transaction aborted.`);
        return;
      }
      resolvedGrants.push({ user, amount: pair.amount });
    }

    // Step 2: Execute all wallet updates and transaction ledger records inside an isolated SQL transaction
    const results: { username: string; amount: number; reference: string; newBalance: string }[] = [];
    try {
      await db.transaction(async (tx) => {
        for (const item of resolvedGrants) {
          // Find or create wallet for user
          let userWallets = await tx.select().from(wallets).where(eq(wallets.userId, item.user.id)).limit(1);
          let wallet = userWallets[0];

          if (!wallet) {
            const created = await tx.insert(wallets).values({
              userId: item.user.id,
              balance: '0.00',
              currency: 'USDT'
            }).returning();
            wallet = created[0];
          }

          const currentBal = parseFloat(wallet.balance || '0');
          const newBal = (currentBal + item.amount).toFixed(2);

          // Update wallet balance
          await tx.update(wallets).set({
            balance: newBal,
            updatedAt: new Date()
          }).where(eq(wallets.id, wallet.id));

          // Structured trackable reference: GRNT-W<wallet_id>-<seq>
          const [cntRes] = await tx.select({ c: sql<number>`count(*)` }).from(transactions).where(eq(transactions.walletId, wallet.id));
          const seq = Number(cntRes?.c ?? 0) + 1;
          const txnRef = `GRNT-W${wallet.id}-${seq.toString().padStart(4, '0')}`;

          // Insert immutable transaction ledger entry
          await tx.insert(transactions).values({
            reference: txnRef,
            walletId: wallet.id,
            type: 'DEPOSIT',
            amount: item.amount.toFixed(2),
            status: 'COMPLETED',
            description: reason
          });

          results.push({
            username: item.user.username,
            amount: item.amount,
            reference: txnRef,
            newBalance: `${newBal} USDT`
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
      } catch (cacheErr) {
        console.warn(`Failed to clear bank cache: ${(cacheErr as Error).message}`);
      }

      console.log(`Grant completed for ${results.length} recipients:`);
      printTable(results.map(r => ({
        Recipient: r.username,
        Granted: `+${r.amount.toFixed(2)} USDT`,
        Reference: r.reference,
        Balance: r.newBalance
      })));

      await logAudit('/bank/grant', `${results.length} recipients`, `Granted funds (${reason})`);
    } catch (err) {
      console.log(`Batch grant transaction failed: ${(err as Error).message}`);
    }
    return;
  }

  // 7. Reversals, Refunds & Dispute Rollbacks
  if (sub === 'reverse' || sub === 'refund' || sub === 'rollback' || sub === 'reversals') {
    const action = (rawArgs[0] || '').toLowerCase();

    if (action === 'list' || sub === 'reversals') {
      const { reversals } = await import('../../../server/v2/db/schema/reversals.js');
      const { desc } = await import('drizzle-orm');
      const allReversals = await db.select().from(reversals).orderBy(desc(reversals.createdAt)).limit(50);
      if (allReversals.length === 0) {
        console.log('No reversals or refunds recorded.');
        return;
      }
      printTable(allReversals.map(r => ({
        Time: r.createdAt ? new Date(r.createdAt).toISOString().replace('T', ' ').substring(0, 19) : '-',
        Reference: r.reference,
        Type: r.type,
        UserID: r.userId,
        FromUserID: r.fromUserId ?? '-',
        Amount: `${r.amount} ${r.currency}`,
        Reason: r.reason,
        Status: r.status
      })));
      return;
    }

    if (action === 'refund') {
      const [_, targetUser, amtStr, ...reasonParts] = rawArgs;
      if (!targetUser || !amtStr) {
        console.log('Usage: reverse refund <username> <amount> [reason]');
        return;
      }
      const user = await resolveUser(targetUser);
      if (!user) { console.log(`User "${targetUser}" not found.`); return; }
      const amt = parseFloat(amtStr);
      if (isNaN(amt) || amt <= 0) { console.log('Invalid refund amount.'); return; }
      const reason = reasonParts.join(' ') || 'Platform Refund';

      const { reversals } = await import('../../../server/v2/db/schema/reversals.js');

      let refCode = '';
      await db.transaction(async (tx) => {
        let [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, user.id)).limit(1);
        if (!wallet) {
          const created = await tx.insert(wallets).values({ userId: user.id, balance: '0.00', currency: 'USDT' }).returning();
          wallet = created[0];
        }

        const [cntRes] = await tx.select({ c: sql<number>`count(*)` }).from(transactions).where(eq(transactions.walletId, wallet.id));
        const seq = Number(cntRes?.c ?? 0) + 1;
        refCode = `REF-W${wallet.id}-${seq.toString().padStart(4, '0')}`;

        const newBal = (parseFloat(wallet.balance) + amt).toFixed(2);
        await tx.update(wallets).set({ balance: newBal, updatedAt: new Date() }).where(eq(wallets.id, wallet.id));

        await tx.insert(transactions).values({
          reference: refCode,
          walletId: wallet.id,
          type: 'REFUND',
          amount: amt.toFixed(2),
          status: 'COMPLETED',
          description: reason
        });

        await tx.insert(reversals).values({
          reference: refCode,
          type: 'REFUND',
          walletId: wallet.id,
          userId: user.id,
          amount: amt.toFixed(2),
          currency: 'USDT',
          reason: reason,
          status: 'COMPLETED'
        });
      });

      try {
        const redis = await getRedisClient();
        if (redis) {
          await redis.del('bank:all_accounts');
          await redis.del('bank:all_transactions');
        }
      } catch (cacheErr) {
        console.warn(`Failed to clear bank cache: ${(cacheErr as Error).message}`);
      }

      console.log(`Refund of ${amt.toFixed(2)} USDT issued to ${user.username} (Ref: ${refCode}).`);
      await logAudit('/bank/reverse', user.username, `Issued refund of ${amt} USDT (${reason})`);
      return;
    }

    if (action === 'rollback') {
      const [_, fromUsername, toUsername, amtStr, ...reasonParts] = rawArgs;
      if (!fromUsername || !toUsername || !amtStr) {
        console.log('Usage: reverse rollback <from_user> <to_user> <amount> [reason]');
        return;
      }
      const fromUser = await resolveUser(fromUsername);
      const toUser = await resolveUser(toUsername);
      if (!fromUser || !toUser) { console.log('Invalid sender or recipient user.'); return; }
      const amt = parseFloat(amtStr);
      if (isNaN(amt) || amt <= 0) { console.log('Invalid rollback amount.'); return; }
      const reason = reasonParts.join(' ') || 'Dispute Rollback';

      const { reversals } = await import('../../../server/v2/db/schema/reversals.js');
      let refCode = '';

      await db.transaction(async (tx) => {
        let [fromWallet] = await tx.select().from(wallets).where(eq(wallets.userId, fromUser.id)).limit(1);
        let [toWallet] = await tx.select().from(wallets).where(eq(wallets.userId, toUser.id)).limit(1);

        if (!fromWallet || !toWallet) {
          throw new Error('Wallet missing for one of the accounts.');
        }

        const [cntRes] = await tx.select({ c: sql<number>`count(*)` }).from(reversals);
        const seq = Number(cntRes?.c ?? 0) + 1;
        refCode = `ROL-W${fromWallet.id}-W${toWallet.id}-${seq.toString().padStart(4, '0')}`;

        const fromBal = parseFloat(fromWallet.balance);
        const toBal = parseFloat(toWallet.balance);

        await tx.update(wallets).set({ balance: (fromBal - amt).toFixed(2), updatedAt: new Date() }).where(eq(wallets.id, fromWallet.id));
        await tx.update(wallets).set({ balance: (toBal + amt).toFixed(2), updatedAt: new Date() }).where(eq(wallets.id, toWallet.id));

        await tx.insert(transactions).values({
          reference: `${refCode}-OUT`,
          walletId: fromWallet.id,
          type: 'TRANSFER_OUT',
          amount: `-${amt.toFixed(2)}`,
          status: 'COMPLETED',
          description: `Rollback clawback: ${reason}`
        });

        await tx.insert(transactions).values({
          reference: `${refCode}-IN`,
          walletId: toWallet.id,
          type: 'REFUND',
          amount: amt.toFixed(2),
          status: 'COMPLETED',
          description: `Rollback refund: ${reason}`
        });

        await tx.insert(reversals).values({
          reference: refCode,
          type: 'SCAM_ROLLBACK',
          walletId: toWallet.id,
          userId: toUser.id,
          fromUserId: fromUser.id,
          amount: amt.toFixed(2),
          currency: 'USDT',
          reason: reason,
          status: 'COMPLETED'
        });
      });

      try {
        const redis = await getRedisClient();
        if (redis) {
          await redis.del('bank:all_accounts');
          await redis.del('bank:all_transactions');
        }
      } catch (cacheErr) {
        console.warn(`Failed to clear bank cache: ${(cacheErr as Error).message}`);
      }

      console.log(`Rolled back ${amt.toFixed(2)} USDT from ${fromUser.username} to ${toUser.username} (Ref: ${refCode}).`);
      await logAudit('/bank/reverse', `${fromUser.username}->${toUser.username}`, `Rolled back ${amt} USDT (${reason})`);
      return;
    }

    console.log('Usage: reverse <refund|rollback|list>');
    console.log('  reverse refund <user> <amount> [reason]                  - Issue refund');
    console.log('  reverse rollback <from_user> <to_user> <amount> [reason] - Rollback funds from wrong account/scam');
    console.log('  reverse list                                             - View recorded reversals');
    return;
  }
}
