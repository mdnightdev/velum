import { db } from '../../../server/v2/db/client.js';
import { lounges, loungeMembers } from '../../../server/v2/db/schema/lounges.js';
import { formatTable } from '../table.js';
import { logAudit, requireArg, printDetail } from '../helpers.js';
import { desc, eq, sql, and, notLike, ne } from 'drizzle-orm';

export async function handleLoungesCommand(sub: string, rawArgs: string[]): Promise<void> {
  if (sub === 'list' || sub === 'ls') {
    // Filter out P2P direct message rooms from public lounges
    const list = await db.select().from(lounges)
      .where(and(
        ne(lounges.type, 'dm'),
        notLike(lounges.slug, 'dm_%')
      ))
      .orderBy(desc(lounges.createdAt))
      .limit(50);

    formatTable(
      list.map(l => ({
        id: l.id,
        name: l.name,
        type: l.type,
        access: l.accessLevel,
        private: l.isPrivate ? 'YES' : 'NO',
        created: l.createdAt ? new Date(l.createdAt).toISOString().split('T')[0] : '-'
      })),
      [
        { key: 'id', label: 'ID', width: 6 },
        { key: 'name', label: 'LOUNGE NAME', width: 22 },
        { key: 'type', label: 'TYPE', width: 12 },
        { key: 'access', label: 'ACCESS', width: 14 },
        { key: 'private', label: 'PRIVATE', width: 8 },
        { key: 'created', label: 'CREATED', width: 12 }
      ]
    );
    return;
  }

  if (sub === 'cat' || sub === 'view') {
    const target = requireArg(rawArgs, 0, 'view <lounge_id_or_slug>');
    if (!target) return;
    const numId = parseInt(target, 10);
    const lounge = await db.select().from(lounges).where(
      !isNaN(numId) ? eq(lounges.id, numId) : eq(lounges.slug, target)
    ).limit(1);
    if (!lounge[0]) {
      console.log(`Lounge "${target}" not found.`);
      return;
    }
    const l = lounge[0];
    const memberCountRes = await db.select({ count: sql<number>`count(*)` }).from(loungeMembers).where(eq(loungeMembers.loungeId, l.id));
    printDetail(`Lounge Details: ${l.name}`, {
      'Lounge ID': l.id,
      'Name': l.name,
      'Slug': l.slug || '-',
      'Type': l.type,
      'Access Level': l.accessLevel,
      'Owner User ID': l.ownerId || '-',
      'Private': l.isPrivate ? 'YES' : 'NO',
      'Members Count': Number(memberCountRes[0]?.count || 0),
      'Created At': l.createdAt ? new Date(l.createdAt).toISOString() : '-'
    });
    return;
  }

  if (sub === 'delete' || sub === 'purge') {
    const target = requireArg(rawArgs, 0, 'delete <lounge_id_or_slug>');
    if (!target) return;
    const numId = parseInt(target, 10);
    const lounge = await db.select().from(lounges).where(
      !isNaN(numId) ? eq(lounges.id, numId) : eq(lounges.slug, target)
    ).limit(1);
    if (!lounge[0]) {
      console.log(`Lounge "${target}" not found.`);
      return;
    }
    await db.delete(lounges).where(eq(lounges.id, lounge[0].id));
    console.log(`[OK] Lounge "${lounge[0].name}" (ID ${lounge[0].id}) deleted.`);
    await logAudit('/lounges/delete', String(lounge[0].id), `Deleted lounge ${lounge[0].name}`);
    return;
  }

  console.log(`Unknown /lounges subcommand: "${sub}". Type "help" or "ls" to view commands.`);
}
