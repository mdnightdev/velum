import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '../config.js';
import * as fs from 'fs';
import { logger } from '../utils/logger.js';
import { createCircuitBreaker } from '../utils/circuitBreaker.js';

let pgPool: pg.Pool | null = null;

// Create circuit breaker for database operations
const dbCircuitBreaker = createCircuitBreaker(
  async (fn: () => Promise<any>) => {
    if (!pgPool) throw new Error('Database pool not initialized');
    return await fn();
  },
  {
    timeout: 15000, // 15s timeout to accommodate pooled connection acquisition and latency
    errorThresholdPercentage: 80, // Trip only on severe systemic failure
    resetTimeout: 10000, // Fast recovery window
    rollingWindow: 50 // Wider sample window for accurate failure rates
  }
);

import os from 'os';

/**
 * Calculates optimal PostgreSQL pool sizing based on hardware concurrency and configuration bounds.
 */
export function calculateOptimalPoolSize(): number {
  if (process.env.PG_MAX_POOL) {
    const custom = parseInt(process.env.PG_MAX_POOL, 10);
    if (!isNaN(custom) && custom > 0) return Math.min(Math.max(custom, 5), 150);
  }
  const cpus = os.cpus()?.length || 2;
  const optimal = cpus * 4 + 10;
  return Math.min(Math.max(optimal, 20), 100);
}

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
        rejectUnauthorized: config.NODE_ENV === 'production',
        ca: process.env.DATABASE_CA_CERT ? fs.readFileSync(process.env.DATABASE_CA_CERT) : undefined
      } : false,
      max: calculateOptimalPoolSize(),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      maxUses: 7500,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000
    });

    pgPool.on('error', (err) => {
      logger.error('PostgreSQL pool error', { error: err.message || err });
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
  // Wrap with circuit breaker
  return dbCircuitBreaker.execute(async () => {
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
          logger.warn('Transient connection issue detected', { 
            code: code || 'transient_err', 
            attempt, 
            maxRetries, 
            delayMs: delayMs * attempt 
          });
          await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
        } else {
          throw error;
        }
      }
    }
    throw new Error('[DB v2] Maximum connection retries reached.');
  });
}

// Circuit breaker status monitoring
export function getDbCircuitBreakerStatus() {
  return {
    state: dbCircuitBreaker.getState(),
    stats: dbCircuitBreaker.getStats()
  };
}

