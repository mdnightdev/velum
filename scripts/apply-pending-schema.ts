/**
 * Idempotent schema apply for tables/indexes that were missing from drizzle migrations.
 * Used as fallback when `drizzle-kit migrate` is unavailable or partially applied.
 * Does not truncate data.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

function getUrl(): string {
  const raw = (process.env.DATABASE_URL || process.env.CLOUD_DATABASE_URL || '').trim().replace(/\s+/g, '');
  if (!raw) throw new Error('DATABASE_URL (or CLOUD_DATABASE_URL) is required');
  let clean = raw.replace(/(&|\?)channel_binding=[^&]+/g, '').replace('-pooler', '');
  if (!clean.includes('uselibpqcompat=true')) {
    clean += (clean.includes('?') ? '&' : '?') + 'uselibpqcompat=true';
  }
  return clean;
}

async function connect(): Promise<pg.Client> {
  const url = getUrl();
  const attempts: pg.ClientConfig[] = [
    { connectionString: url, ssl: false },
    { connectionString: url, ssl: { rejectUnauthorized: false } },
  ];
  let lastErr: unknown;
  for (const cfg of attempts) {
    const client = new pg.Client(cfg);
    try {
      await client.connect();
      return client;
    } catch (err) {
      lastErr = err;
      try {
        await client.end();
      } catch {
        /* ignore */
      }
    }
  }
  throw lastErr;
}

async function main() {
  const migrationPaths = [
    path.resolve('server/v2/db/migrations/0002_ops_dm_reactions_blocks.sql'),
    path.resolve('server/v2/db/migrations/0003_profile_nicknames.sql'),
  ];
  const statements = migrationPaths.flatMap((sqlPath) =>
    fs.readFileSync(sqlPath, 'utf8')
      .split(/-->\s*statement-breakpoint/)
      .map((s) =>
        s
          .split('\n')
          .filter((line) => !line.trim().startsWith('--'))
          .join('\n')
          .trim()
      )
      .filter(Boolean)
  );

  const client = await connect();
  try {
    for (const stmt of statements) {
      try {
        await client.query(stmt);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Ignore already-exists races; fail hard on real errors
        if (/already exists|duplicate/i.test(msg)) {
          console.log('[apply-pending-schema] skip:', msg.split('\n')[0]);
          continue;
        }
        throw err;
      }
    }

    // Ensure unique index without truncate (drizzle push used to prompt for this)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_dm_user_emoji
      ON dm_reactions (message_id, user_id, emoji)
    `);

    await client.query(`ALTER TABLE dms ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_dms_expires_at ON dms (expires_at)`);
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS bio text
    `);

    console.log('[apply-pending-schema] ok — ops/dm_reactions/blocks applied without truncate');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[apply-pending-schema] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
