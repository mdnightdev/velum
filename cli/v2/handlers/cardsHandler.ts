import { db } from '../../../server/v2/db/client.js';
import { cards } from '../../../server/v2/db/schema/cards.js';
import { users } from '../../../server/v2/db/schema/users.js';
import { formatTable } from '../table.js';
import { logAudit, requireUser, requireArg, printDetail } from '../helpers.js';
import { desc, eq } from 'drizzle-orm';
import crypto from 'node:crypto';

export async function handleCardsCommand(sub: string, rawArgs: string[]): Promise<void> {
  if (sub === 'list' || sub === 'cards' || sub === 'ls') {
    const list = await db.select({
      id: cards.id,
      userId: cards.userId,
      username: users.username,
      cardToken: cards.cardToken,
      cardType: cards.cardType,
      limitCents: cards.limitCents,
      isActive: cards.isActive,
      created: cards.createdAt
    })
    .from(cards)
    .leftJoin(users, eq(cards.userId, users.id))
    .orderBy(desc(cards.createdAt))
    .limit(50);

    formatTable(
      list.map(c => ({
        id: c.id,
        user: `@${c.username || c.userId}`,
        token: c.cardToken ? `•••• ${c.cardToken.slice(-4)}` : '-',
        type: c.cardType,
        limit: `$${(c.limitCents / 100).toFixed(2)}`,
        active: c.isActive ? 'YES' : 'NO'
      })),
      [
        { key: 'id', label: 'ID', width: 6 },
        { key: 'user', label: 'USER', width: 18 },
        { key: 'token', label: 'CARD', width: 12 },
        { key: 'type', label: 'TYPE', width: 10 },
        { key: 'limit', label: 'LIMIT', width: 14 },
        { key: 'active', label: 'ACTIVE', width: 8 }
      ]
    );
    return;
  }

  if (sub === 'credit') {
    const list = await db.select({
      id: cards.id,
      userId: cards.userId,
      username: users.username,
      cardToken: cards.cardToken,
      limitCents: cards.limitCents,
      isActive: cards.isActive
    })
    .from(cards)
    .leftJoin(users, eq(cards.userId, users.id))
    .where(eq(cards.cardType, 'CREDIT'))
    .limit(50);

    formatTable(
      list.map(c => ({
        id: c.id,
        user: `@${c.username || c.userId}`,
        token: c.cardToken ? `•••• ${c.cardToken.slice(-4)}` : '-',
        limit: `$${(c.limitCents / 100).toFixed(2)}`,
        active: c.isActive ? 'YES' : 'NO'
      })),
      [
        { key: 'id', label: 'ID', width: 6 },
        { key: 'user', label: 'USER', width: 18 },
        { key: 'token', label: 'CARD', width: 12 },
        { key: 'limit', label: 'LIMIT', width: 14 },
        { key: 'active', label: 'ACTIVE', width: 8 }
      ]
    );
    return;
  }

  if (sub === 'create') {
    const [targetUser, type = 'CREDIT', limitStr = '500000'] = rawArgs;
    if (!targetUser) {
      console.log('Usage: create <username> [CREDIT|DEBIT] [limit_cents]');
      return;
    }
    const user = await requireUser([targetUser], 'create <username>');
    if (!user) return;

    const token = crypto.randomBytes(16).toString('hex');
    const limitCents = parseInt(limitStr, 10) || 500000;

    await db.insert(cards).values({
      userId: user.id,
      cardToken: token,
      cardType: type.toUpperCase(),
      limitCents,
      isActive: true
    });

    console.log(`[OK] Created ${type.toUpperCase()} card for @${user.username}.`);
    await logAudit('/cards/create', String(user.id), `Created ${type} card`);
    return;
  }

  if (sub === 'delete') {
    const target = requireArg(rawArgs, 0, 'delete <card_token_or_username>');
    if (!target) return;
    const user = await requireUser([target], 'delete <username>');
    if (user) {
      await db.delete(cards).where(eq(cards.userId, user.id));
      console.log(`[OK] Cards deleted for user @${user.username}.`);
      await logAudit('/cards/delete', String(user.id), 'Deleted user cards');
      return;
    }
    await db.delete(cards).where(eq(cards.cardToken, target));
    console.log(`[OK] Card ${target} deleted.`);
    await logAudit('/cards/delete', target, 'Deleted card token');
    return;
  }

  console.log(`Unknown /cards subcommand: "${sub}". Type "help" or "ls" to view commands.`);
}
