import { eq } from 'drizzle-orm';
import { db, pool, executeWithRetry } from '../db/client.js';
import { systemConfig } from '../db/schema/system_config.js';
import { getRedisClient } from '../db/redis.js';
import { logger } from '../utils/logger.js';

export interface SystemConfigValues {
  maintenanceMode: boolean;
  txFeePercent: number;
  taxPercent: number;
  escrowFeePercent: number;
}

let tableInitialized = false;

async function ensureTable(): Promise<void> {
  if (tableInitialized) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        id SERIAL PRIMARY KEY,
        key VARCHAR(64) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    tableInitialized = true;
  } catch {
    // Ignore if table exists or connection transient
  }
}

export class SystemConfigService {
  static async get(key: string, defaultValue: string = ''): Promise<string> {
    await ensureTable();

    try {
      const redis = await getRedisClient();
      if (redis) {
        const cached = await redis.get(`sysconfig:${key}`);
        if (cached !== null && cached !== undefined) return String(cached);
      }
    } catch (err) {
      logger.debug('Redis system config cache read failed', { key, error: (err as Error).message });
    }

    return executeWithRetry(async () => {
      try {
        const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, key)).limit(1);
        if (rows.length > 0) {
          return rows[0].value;
        }
      } catch (err) {
        logger.debug('Database system config lookup failed', { key, error: (err as Error).message });
      }
      return defaultValue;
    });
  }

  static async set(key: string, value: string): Promise<void> {
    await ensureTable();

    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.set(`sysconfig:${key}`, value);
      }
    } catch (err) {
      logger.debug('Redis system config cache write failed', { key, error: (err as Error).message });
    }

    await executeWithRetry(async () => {
      await db.delete(systemConfig).where(eq(systemConfig.key, key));
      await db.insert(systemConfig).values({
        key,
        value,
        updatedAt: new Date()
      });
    });
  }

  static async getAll(): Promise<SystemConfigValues> {
    const maint = await this.get('maintenance_mode', 'false');
    const txFee = await this.get('tx_fee_percent', '1.5');
    const tax = await this.get('tax_percent', '0.5');
    const escrowFee = await this.get('escrow_fee_percent', '1.0');

    return {
      maintenanceMode: maint === 'true' || maint === '1',
      txFeePercent: parseFloat(txFee) || 1.5,
      taxPercent: parseFloat(tax) || 0.5,
      escrowFeePercent: parseFloat(escrowFee) || 1.0
    };
  }

  static async setMaintenanceMode(enabled: boolean): Promise<void> {
    await this.set('maintenance_mode', enabled ? 'true' : 'false');
  }

  static async setTxFee(percent: number): Promise<void> {
    await this.set('tx_fee_percent', String(percent));
  }

  static async setTax(percent: number): Promise<void> {
    await this.set('tax_percent', String(percent));
  }

  static async setEscrowFee(percent: number): Promise<void> {
    await this.set('escrow_fee_percent', String(percent));
  }
}
