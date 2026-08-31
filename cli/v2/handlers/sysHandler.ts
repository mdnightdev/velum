import { db, pool } from '../../../server/v2/db/client.js';
import { sessions } from '../../../server/v2/db/schema/sessions.js';
import { users } from '../../../server/v2/db/schema/users.js';
import { formatTable } from '../table.js';
import { logAudit, requireArg, printDetail } from '../helpers.js';
import { desc, eq } from 'drizzle-orm';

export async function handleSysCommand(sub: string, rawArgs: string[]): Promise<void> {
  if (sub === 'status') {
    const sessionCount = await db.select().from(sessions);
    printDetail('System Runtime State', {
      'Active Sessions': sessionCount.length,
      'PostgreSQL Total Pool': (pool as any).totalCount ?? '-',
      'PostgreSQL Idle Pool': (pool as any).idleCount ?? '-',
      'Node.js Version': process.version,
      'System Uptime': `${Math.floor(process.uptime())}s`,
      'Memory Usage (RSS)': `${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB`
    });
    return;
  }

  if (sub === 'top') {
    const list = await db.select({
      id: sessions.id,
      userId: sessions.userId,
      username: users.username,
      ip: sessions.ipAddress,
      created: sessions.createdAt,
      expires: sessions.expiresAt
    })
    .from(sessions)
    .leftJoin(users, eq(sessions.userId, users.id))
    .orderBy(desc(sessions.createdAt))
    .limit(50);

    formatTable(
      list.map(s => ({
        id: s.id,
        user: `@${s.username || s.userId}`,
        ip: s.ip || '127.0.0.1',
        created: s.created ? new Date(s.created).toISOString().replace('T', ' ').substring(0, 16) : '-',
        expires: s.expires ? new Date(s.expires).toISOString().replace('T', ' ').substring(0, 16) : '-'
      })),
      [
        { key: 'id', label: 'SESSION ID', width: 12 },
        { key: 'user', label: 'USER', width: 18 },
        { key: 'ip', label: 'IP ADDRESS', width: 16 },
        { key: 'created', label: 'CREATED', width: 18 },
        { key: 'expires', label: 'EXPIRES', width: 18 }
      ]
    );
    return;
  }

  if (sub === 'kill') {
    const target = requireArg(rawArgs, 0, 'kill <session_id>');
    if (!target) return;
    const numId = parseInt(target, 10);
    if (!isNaN(numId)) {
      await db.delete(sessions).where(eq(sessions.id, numId));
    }
    console.log(`[OK] Terminated session ${target}.`);
    await logAudit('/sys/kill', target, 'Severed active session');
    return;
  }

  if (sub === 'flush') {
    await db.delete(sessions);
    console.log('[OK] All sessions flushed.');
    await logAudit('/sys/flush', 'ALL', 'Global session flush');
    return;
  }

  console.log(`Unknown /sys subcommand: "${sub}". Type "help" or "ls" to view commands.`);
}
