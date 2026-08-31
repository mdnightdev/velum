import { db } from '../../../server/v2/db/client.js';
import { tickets, reports } from '../../../server/v2/db/schema/tickets.js';
import { users } from '../../../server/v2/db/schema/users.js';
import { formatTable } from '../table.js';
import { logAudit, requireArg, printDetail } from '../helpers.js';
import { desc, eq } from 'drizzle-orm';

export async function handleTicketsCommand(sub: string, rawArgs: string[]): Promise<void> {
  if (sub === 'list' || sub === 'ls') {
    const list = await db.select({
      id: tickets.id,
      userId: tickets.userId,
      username: users.username,
      subject: tickets.subject,
      status: tickets.status,
      created: tickets.createdAt
    })
    .from(tickets)
    .leftJoin(users, eq(tickets.userId, users.id))
    .orderBy(desc(tickets.createdAt))
    .limit(50);

    formatTable(
      list.map(t => ({
        id: t.id,
        user: `@${t.username || t.userId}`,
        subject: t.subject,
        status: t.status,
        created: t.created ? new Date(t.created).toISOString().split('T')[0] : '-'
      })),
      [
        { key: 'id', label: 'ID', width: 6 },
        { key: 'user', label: 'USER', width: 16 },
        { key: 'subject', label: 'SUBJECT', width: 28 },
        { key: 'status', label: 'STATUS', width: 12 },
        { key: 'created', label: 'CREATED', width: 12 }
      ]
    );
    return;
  }

  if (sub === 'view' || sub === 'cat') {
    const target = requireArg(rawArgs, 0, 'view <ticket_id>');
    if (!target) return;
    const numId = parseInt(target, 10);
    if (isNaN(numId)) {
      console.log('Ticket ID must be a number.');
      return;
    }
    const res = await db.select().from(tickets).where(eq(tickets.id, numId)).limit(1);
    if (!res[0]) {
      console.log(`Ticket #${numId} not found.`);
      return;
    }
    const t = res[0];
    printDetail(`Ticket #${t.id}: ${t.subject}`, {
      ID: t.id,
      'User ID': t.userId,
      Subject: t.subject,
      Status: t.status,
      Description: t.description,
      'Created At': t.createdAt ? new Date(t.createdAt).toISOString() : '-'
    });
    return;
  }

  if (sub === 'delete' || sub === 'purge') {
    const target = requireArg(rawArgs, 0, 'delete <ticket_id>');
    if (!target) return;
    const numId = parseInt(target, 10);
    if (isNaN(numId)) {
      console.log('Ticket ID must be a number.');
      return;
    }
    await db.delete(tickets).where(eq(tickets.id, numId));
    console.log(`[OK] Ticket #${numId} purged.`);
    await logAudit('/tickets/delete', String(numId), 'Purged support ticket');
    return;
  }

  if (sub === 'purge-all') {
    await db.delete(tickets);
    console.log('[OK] All support tickets purged.');
    await logAudit('/tickets/purge-all', 'ALL', 'Purged all tickets');
    return;
  }

  console.log(`Unknown /tickets subcommand: "${sub}". Type "help" or "ls" to view commands.`);
}
