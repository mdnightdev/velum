import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '../config.js';

let pgPool: pg.Pool | null = null;

export function getPgPool(): pg.Pool {
  if (!pgPool) {
    const databaseUrl = (config.DATABASE_URL || '').replace(/\s+/g, '');
    const useSsl = Boolean(
      databaseUrl && (
        databaseUrl.includes('sslmode=require') ||
        databaseUrl.includes('neon.tech') ||
        config.NODE_ENV === 'production'
      )
    );

    pgPool = new pg.Pool({
      connectionString: databaseUrl || undefined,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });

    pgPool.on('error', (err) => {
      console.error('[DB v2] Unexpected PostgreSQL pool error:', err);
    });
  }
  return pgPool;
}

export const pool = getPgPool();
export const db = drizzle(pool);
