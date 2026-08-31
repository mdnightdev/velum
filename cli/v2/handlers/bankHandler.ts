import { db } from '../../../server/v2/db/client.js';
import { wallets, transactions } from '../../../server/v2/db/schema/wallets.js';
import { reserves } from '../../../server/v2/db/schema/reserves.js';
import { bankRepository } from '../../../server/v2/repositories/bankRepository.js';
import { requireUser, logAudit, printDetail } from '../helpers.js';
import { formatTable } from '../table.js';
import { desc, eq, sql } from 'drizzle-orm';

export async function handleBankCommand(sub: string, rawArgs: string[]): Promise<void> {
  if (sub === 'wallets' || sub === 'list') {
    const list = await db.select().from(wallets).orderBy(desc(wallets.balance)).limit(50);
    formatTable(
      list.map(w => ({
        id: w.id,
        userId: w.userId,
        currency: w.currency,
        balance: `${w.balance} ${w.currency}`,
        updated: w.updatedAt ? new Date(w.updatedAt).toISOString().split('T')[0] : '-'
      })),
      [
        { key: 'id', label: 'WALLET ID', width: 12 },
        { key: 'userId', label: 'USER ID', width: 10 },
        { key: 'balance', label: 'BALANCE', width: 18 },
        { key: 'updated', label: 'LAST ACTIVE', width: 14 }
      ]
    );
    return;
  }

  if (sub === 'view' || sub === 'cat') {
    const user = await requireUser(rawArgs, 'view <id_or_username>');
    if (!user) return;
    const wallet = await bankRepository.findWalletByUserId(user.id);
    if (!wallet) {
      console.log(`No active wallet found for user ${user.username} (ID ${user.id}).`);
      return;
    }
    const userTx = await db.select().from(transactions).where(eq(transactions.walletId, wallet.id)).orderBy(desc(transactions.createdAt)).limit(10);
    printDetail(`Wallet Details: @${user.username}`, {
      'Wallet ID': wallet.id,
      'User ID': user.id,
      'Currency': wallet.currency,
      'Current Balance': `${wallet.balance} ${wallet.currency}`,
      'Recent Transactions': userTx.length
    });
    if (userTx.length > 0) {
      console.log('\nRecent Transaction Ledger:');
      formatTable(
        userTx.map(t => ({
          type: t.type,
          amount: `${t.amount} ${wallet.currency}`,
          reference: t.reference || '-',
          date: t.createdAt ? new Date(t.createdAt).toISOString() : '-'
        })),
        [
          { key: 'type', label: 'TYPE', width: 14 },
          { key: 'amount', label: 'AMOUNT', width: 16 },
          { key: 'reference', label: 'REFERENCE', width: 20 },
          { key: 'date', label: 'TIMESTAMP', width: 22 }
        ]
      );
    }
    return;
  }

  if (sub === 'reserves') {
    const list = await db.select().from(reserves);
    formatTable(
      list.map(r => ({
        id: r.id,
        type: r.reserveType,
        balance: `$${(Number(r.balanceCents) / 100).toFixed(2)} USD`,
        updated: r.updatedAt ? new Date(r.updatedAt).toISOString() : '-'
      })),
      [
        { key: 'id', label: 'ID', width: 6 },
        { key: 'type', label: 'RESERVE POOL', width: 22 },
        { key: 'balance', label: 'CURRENT BALANCE', width: 20 },
        { key: 'updated', label: 'LAST UPDATED', width: 22 }
      ]
    );
    return;
  }

  if (sub === 'fundc') {
    const centsStr = rawArgs[0];
    const desc = rawArgs.slice(1).join(' ') || 'Central bank asset funding';
    if (!centsStr || isNaN(parseInt(centsStr, 10))) {
      console.log('Usage: fundc <cents> [description]');
      return;
    }
    const cents = parseInt(centsStr, 10);
    await db.insert(reserves).values({
      reserveType: 'CENTRAL_VAULT',
      balanceCents: cents,
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: reserves.reserveType,
      set: {
        balanceCents: sql`${reserves.balanceCents} + ${cents}`,
        updatedAt: new Date()
      }
    });

    const res = await db.select().from(reserves).where(eq(reserves.reserveType, 'CENTRAL_VAULT')).limit(1);
    console.log(`[OK] Central bank funded with $${(cents / 100).toFixed(2)}. Total: $${(Number(res[0]?.balanceCents || 0) / 100).toFixed(2)} USD.`);
    await logAudit('/bank/fundc', 'CENTRAL_VAULT', `${desc} ($${(cents / 100).toFixed(2)})`);
    return;
  }

  if (sub === 'fundt') {
    const centsStr = rawArgs[0];
    const desc = rawArgs.slice(1).join(' ') || 'Member trust pool funding';
    if (!centsStr || isNaN(parseInt(centsStr, 10))) {
      console.log('Usage: fundt <cents> [description]');
      return;
    }
    const cents = parseInt(centsStr, 10);
    await db.insert(reserves).values({
      reserveType: 'TRUST_POOL',
      balanceCents: cents,
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: reserves.reserveType,
      set: {
        balanceCents: sql`${reserves.balanceCents} + ${cents}`,
        updatedAt: new Date()
      }
    });

    const res = await db.select().from(reserves).where(eq(reserves.reserveType, 'TRUST_POOL')).limit(1);
    console.log(`[OK] Member trust pool funded with $${(cents / 100).toFixed(2)}. Total: $${(Number(res[0]?.balanceCents || 0) / 100).toFixed(2)} USD.`);
    await logAudit('/bank/fundt', 'TRUST_POOL', `${desc} ($${(cents / 100).toFixed(2)})`);
    return;
  }

  if (sub === 'funde') {
    const centsStr = rawArgs[0];
    const desc = rawArgs.slice(1).join(' ') || 'Escrow liquidity reserve funding';
    if (!centsStr || isNaN(parseInt(centsStr, 10))) {
      console.log('Usage: funde <cents> [description]');
      return;
    }
    const cents = parseInt(centsStr, 10);
    await db.insert(reserves).values({
      reserveType: 'ESCROW_RESERVE',
      balanceCents: cents,
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: reserves.reserveType,
      set: {
        balanceCents: sql`${reserves.balanceCents} + ${cents}`,
        updatedAt: new Date()
      }
    });

    const res = await db.select().from(reserves).where(eq(reserves.reserveType, 'ESCROW_RESERVE')).limit(1);
    console.log(`[OK] Escrow reserve funded with $${(cents / 100).toFixed(2)}. Total: $${(Number(res[0]?.balanceCents || 0) / 100).toFixed(2)} USD.`);
    await logAudit('/bank/funde', 'ESCROW_RESERVE', `${desc} ($${(cents / 100).toFixed(2)})`);
    return;
  }

  if (sub === 'wire') {
    const [fromUserArg, toUserArg, amountStr] = rawArgs;
    if (!fromUserArg || !toUserArg || !amountStr || isNaN(parseFloat(amountStr))) {
      console.log('Usage: wire <from_user> <to_user> <amount>');
      return;
    }
    const amount = parseFloat(amountStr).toFixed(2);
    const fromUser = await requireUser([fromUserArg], 'wire <from_user> <to_user> <amount>');
    const toUser = await requireUser([toUserArg], 'wire <from_user> <to_user> <amount>');
    if (!fromUser || !toUser) return;

    const fromWallet = await bankRepository.findWalletByUserId(fromUser.id);
    const toWallet = await bankRepository.findWalletByUserId(toUser.id);
    if (!fromWallet || !toWallet) {
      console.log('[ERROR] Wallets could not be located.');
      return;
    }

    if (parseFloat(fromWallet.balance) < parseFloat(amount)) {
      console.log(`[ERROR] Insufficient funds in @${fromUser.username} wallet (Balance: ${fromWallet.balance}).`);
      return;
    }

    await db.transaction(async (tx) => {
      await tx.update(wallets).set({
        balance: sql`${wallets.balance} - ${amount}`,
        updatedAt: new Date()
      }).where(eq(wallets.id, fromWallet.id));

      await tx.update(wallets).set({
        balance: sql`${wallets.balance} + ${amount}`,
        updatedAt: new Date()
      }).where(eq(wallets.id, toWallet.id));

      await tx.insert(transactions).values([
        {
          reference: `WIRE-OUT-${Date.now()}-${fromWallet.id}`,
          walletId: fromWallet.id,
          type: 'WIRE_OUT',
          amount: `-${amount}`,
          status: 'COMPLETED',
          description: `Wire transfer to @${toUser.username}`
        },
        {
          reference: `WIRE-IN-${Date.now()}-${toWallet.id}`,
          walletId: toWallet.id,
          type: 'WIRE_IN',
          amount,
          status: 'COMPLETED',
          description: `Wire transfer from @${fromUser.username}`
        }
      ]);
    });

    console.log(`[OK] Wired $${amount} from @${fromUser.username} to @${toUser.username}.`);
    await logAudit('/bank/wire', `${fromUser.id}->${toUser.id}`, `Transfer of $${amount}`);
    return;
  }

  if (sub === 'bankad') {
    const [targetUser, amountStr, ...reasonParts] = rawArgs;
    if (!targetUser || !amountStr || isNaN(parseFloat(amountStr))) {
      console.log('Usage: bankad <username/uid> <amount> [reason]');
      return;
    }
    const user = await requireUser([targetUser], 'bankad <username/uid> <amount> [reason]');
    if (!user) return;
    const wallet = await bankRepository.findWalletByUserId(user.id);
    if (!wallet) {
      console.log(`[ERROR] Wallet not found for user @${user.username}.`);
      return;
    }
    const amount = parseFloat(amountStr).toFixed(2);
    const reason = reasonParts.join(' ') || 'Administrative ledger adjustment';

    await db.transaction(async (tx) => {
      await tx.update(wallets).set({
        balance: sql`${wallets.balance} + ${amount}`,
        updatedAt: new Date()
      }).where(eq(wallets.id, wallet.id));

      await tx.insert(transactions).values({
        reference: `ADJ-${Date.now()}-${wallet.id}`,
        walletId: wallet.id,
        type: 'ADMIN_ADJUST',
        amount,
        status: 'COMPLETED',
        description: reason
      });
    });

    const updated = await bankRepository.findWalletByUserId(user.id);
    console.log(`[OK] Adjusted wallet @${user.username} by $${amount}. New balance: $${updated?.balance} USD.`);
    await logAudit('/bank/bankad', String(user.id), `${reason} ($${amount})`);
    return;
  }

  console.log(`Unknown /bank subcommand: "${sub}". Type "help" or "ls" to view commands.`);
}
