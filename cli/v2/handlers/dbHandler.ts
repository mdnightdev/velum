import { sql } from 'drizzle-orm';
import { db, pool } from '../../../server/v2/db/client.js';
import { getRedisClient } from '../../../server/v2/db/redis.js';
import { logAudit } from '../helpers.js';
import { printDetail } from '../table.js';
import { theme } from '../theme.js';

export async function handleDbCommand(sub: string, rawArgs: string[]): Promise<void> {
  if (sub === 'status' || sub === 'health') {
    let pgOk = false;
    let redisOk = false;
    try {
      await db.execute(sql`SELECT 1`);
      pgOk = true;
    } catch {}

    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.ping();
        redisOk = true;
      }
    } catch {}

    printDetail('Database Subsystem Health', {
      'PostgreSQL Connection': pgOk ? `${theme.green}ONLINE (OK)${theme.reset}` : `${theme.red}OFFLINE${theme.reset}`,
      'PostgreSQL Pool Total': (pool as any).totalCount ?? '-',
      'PostgreSQL Pool Idle': (pool as any).idleCount ?? '-',
      'PostgreSQL Pool Waiting': (pool as any).waitingCount ?? '-',
      'Redis Event Bus': redisOk ? `${theme.green}ONLINE (OK)${theme.reset}` : `${theme.yellow}FALLBACK (In-Memory)${theme.reset}`
    });
    return;
  }

  if (sub === 'pg' || sub === 'query') {
    const query = rawArgs.join(' ').trim();
    if (!query) {
      console.log('Usage: pg <sql_select_query>');
      return;
    }

    // CLI-001 Security Hardening: Only allow read-only SELECT / WITH / EXPLAIN queries
    const isReadOnly = /^(SELECT|WITH|EXPLAIN|SHOW)\s+/i.test(query);
    const hasForbiddenKeywords = /\b(DROP|DELETE|TRUNCATE|ALTER|GRANT|REVOKE|INSERT|UPDATE)\b/i.test(query);

    if (!isReadOnly || hasForbiddenKeywords) {
      console.log(`${theme.red}[SECURITY] Write/destructive queries are forbidden in raw CLI mode. Use targeted CLI administrative commands.${theme.reset}`);
      return;
    }

    try {
      const res = await db.execute(sql.raw(query));
      console.log(`\nQuery Results (${res.rows?.length || 0} rows):`);
      if (res.rows && res.rows.length > 0) {
        console.table(res.rows.slice(0, 50));
      } else {
        console.log('No rows returned.');
      }
      await logAudit('/db/pg', 'SYSTEM', `Read-only query executed: ${query.substring(0, 100)}`);
    } catch (err) {
      console.log(`${theme.red}[ERROR] Query failed: ${(err as Error).message}${theme.reset}`);
    }
    return;
  }

  if (sub === 'redis') {
    const redisCmd = rawArgs[0]?.toUpperCase();
    if (!redisCmd) {
      console.log('Usage: redis <PING|INFO|DBSIZE>');
      return;
    }

    // CLI-002 Security Hardening: Whitelist safe diagnostic Redis commands only
    const allowedRedisCommands = ['PING', 'INFO', 'DBSIZE', 'CLIENT LIST', 'TIME'];
    if (!allowedRedisCommands.includes(redisCmd)) {
      console.log(`${theme.red}[SECURITY] Arbitrary Redis commands blocked. Allowed: ${allowedRedisCommands.join(', ')}${theme.reset}`);
      return;
    }

    try {
      const redis = await getRedisClient();
      if (!redis) {
        console.log('Redis is not connected (running in in-memory mode).');
        return;
      }
      if (redisCmd === 'PING') {
        const pingRes = await redis.ping();
        console.log(`PONG: ${pingRes}`);
      } else if (redisCmd === 'DBSIZE') {
        const size = await redis.dbSize();
        console.log(`Redis Keys Count: ${size}`);
      } else if (redisCmd === 'INFO') {
        const info = await redis.info('server');
        console.log(info);
      }
      await logAudit('/db/redis', 'SYSTEM', `Redis command executed: ${redisCmd}`);
    } catch (err) {
      console.log(`${theme.red}[ERROR] Redis operation failed: ${(err as Error).message}${theme.reset}`);
    }
    return;
  }

  console.log(`Unknown /db subcommand: "${sub}". Type "help" or "ls" to view commands.`);
}
