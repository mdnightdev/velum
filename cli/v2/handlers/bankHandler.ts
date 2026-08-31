import { db } from '../../../server/v2/db/client.js';
import { wallets, transactions } from '../../../server/v2/db/schema/wallets.js';
import { reserves } from '../../../server/v2/db/schema/reserves.js';
import { bankRepository } from '../../../server/v2/repositories/bankRepository.js';
import { reserveRepository } from '../../../server/v2/repositories/reserveRepository.js';
import { requireUser, requireArg, logAudit } from '../helpers.js';
import { formatTable, printDetail } from '../table.js';
import { theme } from '../theme.js';
import { desc, eq, sql } from 'drizzle-orm';

export async function handleBankCommand(sub: string, rawArgs: string[]): Promise<void> {
  if (sub === 'wallets' || sub === 'list') {
    const list = await db.select().from(wallets).orderBy(desc(wallets.balance)).limit(50);
    console.log(`\n=== Active Wallets (${list.length}) ===`);
    formatTable(
      list.map(w => ({
        id: w.id,
        userId: w.userId,
        currency: w.currency,
        balance: `${w.balance} ${w.currency}`,
        updated: w.updatedAt ? new Date(w.updatedAt).toISOString().split('T')[0] : '-'
      })),
      [
        { key: 'id', label: 'Wallet ID', width: 12 },
        { key: 'userId', label: 'User ID', width: 10 },
        { key: 'balance', label: 'Balance', width: 18 },
        { key: 'updated', label: 'Last Active', width: 14 }
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
          { key: 'type', label: 'Type', width: 14 },
          { key: 'amount', label: 'Amount', width: 16 },
          { key: 'reference', label: 'Reference', width: 20 },
          { key: 'date', label: 'Timestamp', width: 22 }
        ]
      );
    }
    return;
  }

  if (sub === 'reserves') {
    const list = await db.select().from(reserves);
    console.log(`\n=== Platform Reserves Ledger (${list.length}) ===`);
    formatTable(
      list.map(r => ({
        id: r.id,
        type: r.reserveType,
        balance: `$${(Number(r.balanceCents) / 100).toFixed(2)} USD`,
        updated: r.updatedAt ? new Date(r.updatedAt).toISOString() : '-'
      })),
      [
        { key: 'id', label: 'ID', width: 6 },
        { key: 'type', label: 'Reserve Pool', width: 22 },
        { key: 'balance', label: 'Current Balance', width: 20 },
        { key: 'updated', label: 'Last Updated', width: 22 }
      ]
    );
    return;
  }

  console.log(`Unknown /bank subcommand: "${sub}". Type "help" or "ls" to view commands.`);
}
