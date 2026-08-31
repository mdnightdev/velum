import { db } from '../../../server/v2/db/client.js';
import { auditLogs } from '../../../server/v2/db/schema/audit_logs.js';
import { formatTable } from '../table.js';
import { logAudit, requireUser } from '../helpers.js';
import { theme } from '../theme.js';
import { desc, eq, sql } from 'drizzle-orm';

export async function handleSanctionsCommand(sub: string, rawArgs: string[]): Promise<void> {
  if (sub === 'list' || sub === 'ls') {
    const list = await db.select().from(auditLogs).where(
      sql`${auditLogs.action} ILIKE '%BAN%' OR ${auditLogs.action} ILIKE '%DEACTIVATE%' OR ${auditLogs.action} ILIKE '%PURGE%'`
    ).orderBy(desc(auditLogs.timestamp)).limit(50);

    console.log(`\n=== Moderation & Sanctions Log (${list.length}) ===`);
    formatTable(
      list.map(a => ({
        id: a.logId,
        action: a.action,
        target: a.targetId || '-',
        admin: a.adminName || 'SYSTEM',
        reason: a.reason || '-',
        time: a.timestamp ? new Date(a.timestamp).toISOString() : '-'
      })),
      [
        { key: 'action', label: 'Action', width: 22 },
        { key: 'target', label: 'Target', width: 14 },
        { key: 'admin', label: 'Admin', width: 14 },
        { key: 'reason', label: 'Reason', width: 28 },
        { key: 'time', label: 'Timestamp', width: 22 }
      ]
    );
    return;
  }

  console.log(`Unknown /sanctions subcommand: "${sub}". Type "help" or "ls" to view commands.`);
}
