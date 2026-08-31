import { eq } from 'drizzle-orm';
import { db, pool } from '../../../server/v2/db/client.js';
import { sessions } from '../../../server/v2/db/schema/sessions.js';
import type { CommandContext } from '../types.js';

export async function handleSys(ctx: CommandContext): Promise<void> {
  const { sub, rawArgs } = ctx;

  if (sub === 'status') {
    let dbOk = false;
    try {
      await pool.query('SELECT 1');
      dbOk = true;
    } catch {
      dbOk = false;
    }
    console.log(`Database: ${dbOk ? 'CONNECTED' : 'DISCONNECTED'} | Time: ${new Date().toISOString()}`);
    return;
  }

  if (sub === 'top') {
    const mem = process.memoryUsage();
    console.log(`PID: ${process.pid} | Uptime: ${Math.floor(process.uptime())}s | Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} / ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB | RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);
    return;
  }

  if (sub === 'activest') {
    const activeSess = await db.select().from(sessions);
    console.log(`Active Sessions: ${activeSess.length}`);
    return;
  }

  if (sub === 'ccache') {
    await stateManager.clearRuntimeCaches();
    console.log('[OK] In-memory and runtime caches evicted.');
    return;
  }

  if (sub === 'kill') {
    const sidStr = rawArgs[0];
    const sid = parseInt(sidStr, 10);
    if (!sidStr || isNaN(sid)) { console.log('Usage: kill <session_id>'); return; }
    await db.delete(sessions).where(eq(sessions.id, sid));
    console.log(`[OK] Terminated session ${sid}.`);
    return;
  }

  if (sub === 'flush') {
    await db.delete(sessions);
    console.log('[OK] Cleared all sessions.');
    return;
  }
}
