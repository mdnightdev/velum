import { db } from '../../../server/v2/db/client.js';
import { users } from '../../../server/v2/db/schema/users.js';
import { wallets } from '../../../server/v2/db/schema/wallets.js';
import { bankRepository } from '../../../server/v2/repositories/bankRepository.js';
import { reserveRepository } from '../../../server/v2/repositories/reserveRepository.js';
import { getRedisClient } from '../../../server/v2/db/redis.js';
import { stateManager } from '../state/stateManager.js';
import { theme } from '../theme.js';
import { printTable } from '../table.js';
import { guardProtectedUser } from '../protection.js';
import type { CommandContext } from '../types.js';

const reserveMap = {
  'fundc': 'CARD_SETTLEMENT',
  'fundt': 'TREASURY',
  'funde': 'ESCROW_BUFFER'
} as const;

export async function handleBank(ctx: CommandContext): Promise<void> {
  const { sub, rawArgs, resolveUser, logAudit } = ctx;

  if (sub === 'bankau') {
    const allWallets = await db.select().from(wallets).limit(500);
    const totalBal = allWallets.reduce((acc, w) => acc + parseFloat(w.balance || '0'), 0);
    let allTxs: any[] = [];
    try {
      allTxs = await (bankRepository as any).findAllTransactions(500);
    } catch {}
    const totalIn = allTxs.filter(t => t.type === 'DEPOSIT' || t.type === 'TRANSFER_IN').reduce((acc, t) => acc + Math.abs(parseFloat(t.amount || '0')), 0);
    const totalOut = allTxs.filter(t => t.type === 'WITHDRAWAL' || t.type === 'TRANSFER_OUT').reduce((acc, t) => acc + Math.abs(parseFloat(t.amount || '0')), 0);
    console.log(`Total Wallets: ${allWallets.length} | Deposits: ${totalBal.toFixed(2)} USDT | Inflow: ${totalIn.toFixed(2)} USDT | Outflow: ${totalOut.toFixed(2)} USDT | Delta: ${(totalIn - totalOut - totalBal).toFixed(2)} USDT`);
    await logAudit('/bank/bankau', 'SYSTEM', 'Executed liquidity audit');
    return;
  }

  if (sub === 'wallets' || sub === 'list' || sub === 'banks' || sub === 'ls') {
    const allWallets = await db.select().from(wallets).limit(100);
    printTable(allWallets.map(w => ({
      ID: w.id,
      UserID: w.userId,
      Balance: w.balance,
      Currency: w.currency,
      Frozen: stateManager.isWalletFrozen(w.id.toString()) ? 'Y' : 'N'
    })));
    
    const allReserves = await reserveRepository.getAllReserves();
    if (allReserves.length > 0) {
      console.log();
      printTable(allReserves.map(r => ({
        Type: r.reserveType,
        Balance: `$${(r.balanceCents / 100).toFixed(2)}`,
        Updated: r.updatedAt ? new Date(r.updatedAt).toISOString().split('T')[0] : '-'
      })));
    }
    return;
  }

  if (sub === 'tx' || sub === 'cat' || sub === 'txlog') {
    const walletId = rawArgs[0] ? parseInt(rawArgs[0], 10) : undefined;
    let txs;
    if (walletId && !isNaN(walletId)) {
      txs = await bankRepository.getTransactionHistory(walletId, 50);
    } else {
      txs = await (bankRepository as any).findAllTransactions(50);
    }
    printTable(txs.map(t => ({
      ID: t.id,
      Reference: t.reference,
      WalletID: t.walletId,
      Type: t.type,
      Amount: t.amount,
      Status: t.status,
      Description: t.description || '-'
    })));
    return;
  }

  if (sub === 'staff') {
    const allUsers = await db.select().from(users).limit(200);
    const staffUsers = allUsers.filter(u => ['ADMIN', 'BANK_ADMIN', 'SUPPORT_ADMIN', 'CLI_ADMIN'].includes(u.role));
    printTable(staffUsers.map(u => ({ ID: u.id, Username: u.username, Role: u.role })));
    return;
  }

  if (sub === 'wire') {
    const [fromUsername, toUsername, amountStr] = rawArgs;
    if (!fromUsername || !toUsername || !amountStr) {
      console.log('Usage: wire <from_username> <to_username> <amount>');
      return;
    }

    const fromUser = await resolveUser(fromUsername);
    const toUser = await resolveUser(toUsername);
    if (!fromUser || !toUser) {
      console.log('Invalid sender or recipient.');
      return;
    }

    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) {
      console.log('Invalid transfer amount.');
      return;
    }

    const fromWallet = await bankRepository.findWalletByUserId(fromUser.id);
    const toWallet = await bankRepository.findWalletByUserId(toUser.id);
    if (!fromWallet || !toWallet) {
      console.log('Sender or recipient has no initialized wallet.');
      return;
    }

    if (parseFloat(fromWallet.balance) < amt) {
      console.log(`[FAILED] Insufficient funds in ${fromUser.username}'s wallet.`);
      return;
    }

    await bankRepository.updateBalance(fromWallet.id, (parseFloat(fromWallet.balance) - amt).toFixed(2));
    await bankRepository.updateBalance(toWallet.id, (parseFloat(toWallet.balance) + amt).toFixed(2));

    const ref = `WIRE-${Date.now()}`;
    await bankRepository.createTransaction({
      reference: ref,
      walletId: fromWallet.id,
      type: 'TRANSFER_OUT',
      amount: `-${amt.toFixed(2)}`,
      status: 'COMPLETED',
      description: `Wire to user ID ${toUser.id}`
    });

    await bankRepository.createTransaction({
      reference: `${ref}-IN`,
      walletId: toWallet.id,
      type: 'TRANSFER_IN',
      amount: `${amt.toFixed(2)}`,
      status: 'COMPLETED',
      description: `Wire from user ID ${fromUser.id}`
    });

    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.del('bank:all_accounts');
        await redis.del('bank:all_transactions');
      }
    } catch (err) {
      console.log(`${theme.yellow}[WARN] Failed to invalidate Redis cache: ${(err as Error).message}${theme.reset}`);
    }

    console.log(`[OK] Wired ${amt} USDT from ${fromUser.username} to ${toUser.username}. Ref: ${ref}`);
    await logAudit('/bank/wire', `${fromUser.username}->${toUser.username}`, `Wired ${amt} USDT (Ref: ${ref})`);
    return;
  }

  // Unified Funding Command: fund <card|treasury|escrow|user> <amount_or_cents> [description]
  if (sub === 'fund' || sub === 'fundc' || sub === 'fundt' || sub === 'funde') {
    const [target, amountStr, ...descParts] = rawArgs;
    const description = descParts.join(' ') || 'Reserve funding';

    if (!target) {
      console.log('Usage: fund <card|treasury|escrow|username> <cents_or_amount> [description]');
      return;
    }

    const t = target.toLowerCase();
    let reserveType: string | null = null;
    if (t === 'card' || t === 'fundc' || t === 'settlement' || sub === 'fundc') reserveType = 'CARD_SETTLEMENT';
    else if (t === 'treasury' || t === 'fundt' || t === 'vault' || sub === 'fundt') reserveType = 'TREASURY';
    else if (t === 'escrow' || t === 'funde' || t === 'buffer' || sub === 'funde') reserveType = 'ESCROW_BUFFER';

    if (reserveType) {
      const centsStr = (sub === 'fundc' || sub === 'fundt' || sub === 'funde') ? target : amountStr;
      const cents = parseInt(centsStr || '', 10);
      if (isNaN(cents) || cents <= 0) {
        console.log(`Usage: fund ${target} <cents> [description]`);
        return;
      }
      try {
        const updated = await reserveRepository.updateBalance(reserveType as any, cents);
        console.log(`[OK] Added ${cents} cents to ${reserveType} (${description}). Balance: $${(updated.balanceCents / 100).toFixed(2)}.`);
        await logAudit('/bank/fund', reserveType, `Funded ${cents} cents (${description})`);
      } catch (err) {
        console.log(`[ERROR] Reserve funding failed: ${(err as Error).message}`);
      }
      return;
    }

    // Funding a specific user wallet: fund <username> <amount> [reason]
    const user = await resolveUser(target);
    if (!user) {
      console.log(`Target account or reserve "${target}" not found.`);
      return;
    }

    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) {
      console.log('Usage: fund <username> <amount> [reason]');
      return;
    }

    let wallet = await bankRepository.findWalletByUserId(user.id);
    if (!wallet) {
      wallet = await bankRepository.createWallet({
        userId: user.id,
        balance: '0.00',
        currency: 'USDT'
      });
      console.log(`[Info] Initialized wallet for ${user.username}.`);
    }

    const currentBal = parseFloat(wallet.balance || '0');
    const newBal = (currentBal + amt).toFixed(2);
    const updated = await bankRepository.updateBalance(wallet.id, newBal);

    await bankRepository.createTransaction({
      reference: `FND-${Date.now()}`,
      walletId: wallet.id,
      type: 'DEPOSIT',
      amount: amt.toFixed(2),
      status: 'COMPLETED',
      description: description
    });

    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.del('bank:all_accounts');
        await redis.del('bank:all_transactions');
      }
    } catch {}

    console.log(`[OK] Funded ${amt} USDT to ${user.username}. New balance: ${updated?.balance} USDT.`);
    await logAudit('/bank/fund', user.username, `Funded ${amt} USDT (${description})`);
    return;
  }

  // Adjust balance: adjust <username> <new_balance> [reason]
  if (sub === 'adjust' || sub === 'bankad') {
    const [target, newBalance, ...reasonParts] = rawArgs;
    if (!target || !newBalance) { console.log('Usage: adjust <id_or_username> <new_balance> [reason]'); return; }
    const user = await resolveUser(target);
    if (!user) { console.log(`User "${target}" not found.`); return; }
    
    let wallet = await bankRepository.findWalletByUserId(user.id);
    if (!wallet) {
      wallet = await bankRepository.createWallet({
        userId: user.id,
        balance: '0.00',
        currency: 'USDT'
      });
      console.log(`[Info] Wallet created for ${user.username}.`);
    }
    
    const oldBal = parseFloat(wallet.balance);
    const newBalAmt = parseFloat(newBalance);
    const diff = newBalAmt - oldBal;
    
    const updated = await bankRepository.updateBalance(wallet.id, newBalance);
    
    if (diff !== 0) {
      await bankRepository.createTransaction({
        reference: `ADJ-${Date.now()}`,
        walletId: wallet.id,
        type: diff > 0 ? 'DEPOSIT' : 'WITHDRAWAL',
        amount: diff.toFixed(2),
        status: 'COMPLETED',
        description: reasonParts.join(' ') || 'Balance adjustment'
      });
    }
    
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.del('bank:all_accounts');
        await redis.del('bank:all_transactions');
      }
    } catch (err) {
      console.log(`${theme.yellow}[WARN] Failed to invalidate Redis cache: ${(err as Error).message}${theme.reset}`);
    }

    console.log(`[OK] Updated wallet balance for ${user.username} to: ${updated?.balance} USDT.`);
    await logAudit('/bank/adjust', user.username, `Adjusted wallet balance to ${newBalance}`);
    return;
  }
}
