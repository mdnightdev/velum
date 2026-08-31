import { db } from '../../../server/v2/db/client.js';
import { lounges, messages, loungeMembers } from '../../../server/v2/db/schema/lounges.js';
import { formatTable, printDetail } from '../table.js';
import { logAudit, requireArg } from '../helpers.js';
import { theme } from '../theme.js';
import { desc, eq, sql } from 'drizzle-orm';

export async function handleLoungesCommand(sub: string, rawArgs: string[]): Promise<void> {
  if (sub === 'list' || sub === 'ls') {
    const list = await db.select().from(lounges).orderBy(desc(lounges.createdAt)).limit(50);
    console.log(`\n=== Lounges (${list.length}) ===`);
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
        { key: 'id', label: 'ID', width: 14 },
        { key: 'name', label: 'Lounge Name', width: 22 },
        { key: 'type', label: 'Type', width: 12 },
        { key: 'access', label: 'Access Level', width: 14 },
        { key: 'private', label: 'Private', width: 8 },
        { key: 'created', label: 'Created', width: 12 }
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
    const target = requireArg(rawArgs, 0, 'purge <lounge_id_or_slug>');
    if (!target) return;
    if (target === 'velum' || target === '1') {
      console.log(`${theme.red}[ERROR] Core Official Velum Lounge cannot be deleted.${theme.reset}`);
      return;
    }
    const numId = parseInt(target, 10);
    const targetLounge = await db.select().from(lounges).where(
      !isNaN(numId) ? eq(lounges.id, numId) : eq(lounges.slug, target)
    ).limit(1);

    if (!targetLounge[0]) {
      console.log(`Lounge "${target}" not found.`);
      return;
    }

    const targetId = targetLounge[0].id;
    await db.transaction(async (tx) => {
      await tx.delete(messages).where(eq(messages.loungeId, targetId));
      await tx.delete(loungeMembers).where(eq(loungeMembers.loungeId, targetId));
      await tx.delete(lounges).where(eq(lounges.id, targetId));
    });
    console.log(`[OK] Lounge "${targetLounge[0].name}" (ID #${targetId}) and all its messages permanently purged.`);
    await logAudit('/lounges/purge', String(targetId), `Permanently purged lounge ${targetLounge[0].name}`);
    return;
  }

  console.log(`Unknown /lounges subcommand: "${sub}". Type "help" or "ls" to view commands.`);
}
