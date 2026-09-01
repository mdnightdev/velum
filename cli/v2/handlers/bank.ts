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

  // Unified Bank Funding: fund <c|t|e> <cents> [description] (supports aliases fundc, fundt, funde)
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
      // sub === 'fund'
      target = (rawArgs[0] || '').toLowerCase();
      centsStr = rawArgs[1];
      descParts = rawArgs.slice(2);
    }

    const description = descParts.join(' ') || 'Direct funding';

    if (!target || (target !== 'c' && target !== 't' && target !== 'e')) {
      console.log('Usage: fund <c|t|e> <cents> [description]');
      console.log('  fund c <cents> [desc] - Funds VELUM CENTRAL BANK directly');
      console.log('  fund t <cents> [desc] - Funds SENTRY BANK (deducted from Central Bank)');
      console.log('  fund e <cents> [desc] - Funds VELUM TRADING ACCOUNT (deducted from Central Bank)');
      return;
    }

    const cents = parseInt(centsStr || '', 10);
    if (isNaN(cents) || cents <= 0) {
      console.log('Invalid cents amount.');
      return;
    }

    // 1. fund c: Directly funds VELUM CENTRAL BANK
    if (target === 'c') {
      try {
        const updated = await reserveRepository.updateBalance('VELUM CENTRAL BANK', cents);
        console.log(`[OK] Funded $${(cents / 100).toFixed(2)} (${cents} cents) to VELUM CENTRAL BANK (${description}). New Balance: $${(((updated?.balanceCents || 0)) / 100).toFixed(2)}.`);
        await logAudit('/bank/fund', 'VELUM CENTRAL BANK', `Directly funded ${cents} cents (${description})`);
      } catch (err) {
        console.log(`[ERROR] Central Bank funding failed: ${(err as Error).message}`);
      }
      return;
    }

    // Check Central Bank liquidity for transfers to SENTRY BANK (t) or VELUM TRADING ACCOUNT (e)
    const vcb = await reserveRepository.getReserve('VELUM CENTRAL BANK');
    const availableCents = vcb?.balanceCents || 0;
    if (availableCents < cents) {
      console.log(`[FAILED] Insufficient funds in VELUM CENTRAL BANK. Available: $${(availableCents / 100).toFixed(2)} (${availableCents} cents), Required: $${(cents / 100).toFixed(2)}.`);
      return;
    }

    // 2. fund t: Funds SENTRY BANK from VELUM CENTRAL BANK
    if (target === 't') {
      try {
        const updatedVcb = await reserveRepository.updateBalance('VELUM CENTRAL BANK', -cents);
        const updatedSb = await reserveRepository.updateBalance('SENTRY BANK', cents);
        console.log(`[OK] Transferred $${(cents / 100).toFixed(2)} from VELUM CENTRAL BANK to SENTRY BANK (${description}).`);
        console.log(`     SENTRY BANK Balance: $${(((updatedSb?.balanceCents || 0)) / 100).toFixed(2)} | VELUM CENTRAL BANK Remaining: $${(((updatedVcb?.balanceCents || 0)) / 100).toFixed(2)}`);
        await logAudit('/bank/fund', 'SENTRY BANK', `Transferred ${cents} cents from VELUM CENTRAL BANK (${description})`);
      } catch (err) {
        console.log(`[ERROR] Sentry Bank funding failed: ${(err as Error).message}`);
      }
      return;
    }

    // 3. fund e: Funds VELUM TRADING ACCOUNT from VELUM CENTRAL BANK
    if (target === 'e') {
      try {
        const updatedVcb = await reserveRepository.updateBalance('VELUM CENTRAL BANK', -cents);
        const updatedTrading = await reserveRepository.updateBalance('VELUM TRADING ACCOUNT', cents);
        console.log(`[OK] Transferred $${(cents / 100).toFixed(2)} from VELUM CENTRAL BANK to VELUM TRADING ACCOUNT (${description}).`);
        console.log(`     VELUM TRADING ACCOUNT Balance: $${(((updatedTrading?.balanceCents || 0)) / 100).toFixed(2)} | VELUM CENTRAL BANK Remaining: $${(((updatedVcb?.balanceCents || 0)) / 100).toFixed(2)}`);
        await logAudit('/bank/fund', 'VELUM TRADING ACCOUNT', `Transferred ${cents} cents from VELUM CENTRAL BANK (${description})`);
      } catch (err) {
        console.log(`[ERROR] Trading Account funding failed: ${(err as Error).message}`);
      }
      return;
    }
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
