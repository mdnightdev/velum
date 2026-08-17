import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '../config.js';
import * as fs from 'fs';

let pgPool: pg.Pool | null = null;

export function getPgPool(): pg.Pool {
  if (!pgPool) {
    const databaseUrl = (config.DATABASE_URL || '').trim().replace(/\s+/g, '').replace('-pooler', '');
    
    // Explicit disable check for local postgres setups (e.g., localhost, 127.0.0.1, or sslmode=disable)
    const isExplicitDisable =
      databaseUrl.includes('sslmode=disable') ||
      (!databaseUrl.includes('sslmode=require') && (
        databaseUrl.includes('localhost') ||
        databaseUrl.includes('127.0.0.1') ||
        databaseUrl.includes('@postgres:') ||
        databaseUrl.includes('@db:')
      ));

    const useSsl = !isExplicitDisable && Boolean(
      databaseUrl && (
        databaseUrl.includes('sslmode=require') ||
        databaseUrl.includes('neon.tech') ||
        databaseUrl.includes('aws.neon.tech') ||
        config.NODE_ENV === 'production'
      )
    );

    pgPool = new pg.Pool({
      connectionString: databaseUrl || undefined,
      ssl: useSsl ? { 
        rejectUnauthorized: true,
        ca: process.env.DATABASE_CA_CERT ? fs.readFileSync(process.env.DATABASE_CA_CERT) : undefined
      } : false,
      max: Number(process.env.PG_MAX_POOL) || 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      maxUses: 7500,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000
    });

    pgPool.on('error', (err) => {
      console.error('[DB v2] Unexpected PostgreSQL pool error:', err.message || err);
    });
  }
  return pgPool;
}

export const pool = getPgPool();
export const db = drizzle(pool);

export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      const msg = (error?.message || '').toLowerCase();
      const code = error?.code || error?.cause?.code || '';

      const isTransient =
        code === 'EAI_AGAIN' ||
        code === 'ENOTFOUND' ||
        code === 'ECONNREFUSED' ||
        code === 'ECONNRESET' ||
        code === 'ETIMEDOUT' ||
        code === '57P01' || // admin_shutdown
        code === '57P02' || // crash_shutdown
        code === '57P03' || // cannot_connect_now
        code === '08006' || // connection_failure
        code === '08001' || // unable_to_establish_sqlconnection
        msg.includes('eai_again') ||
        msg.includes('getaddrinfo') ||
        msg.includes('connection terminated') ||
        msg.includes('econnreset') ||
        msg.includes('socket hung up');

      if (isTransient && attempt < maxRetries) {
        console.warn(`[DB v2] Transient connection issue detected (${code || 'transient_err'}). Retrying attempt ${attempt}/${maxRetries} in ${delayMs * attempt}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      } else {
        throw error;
      }
    }
  }
  throw new Error('[DB v2] Maximum connection retries reached.');
}

