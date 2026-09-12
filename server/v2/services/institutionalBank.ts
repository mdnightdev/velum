import { eq, sql } from 'drizzle-orm';
import { db, executeWithRetry } from '../db/client.js';
import { reserves } from '../db/schema/reserves.js';
import { reserveRepository } from '../repositories/reserveRepository.js';
import { logger } from '../utils/logger.js';

/** VELUM CENTRAL BANK — platform mint / credit-card liquidity (EUR). */
export const RESERVE_VCB = 'Main Account';
/** SENTRY BANK — debit/bank recharge & withdrawal float (EUR). */
export const RESERVE_SENTRY = 'Reserve Account';
/** VELUM TRADING ACCOUNT — marketplace fee sink (EUR). */
export const RESERVE_TRADING = 'Trading Account';

export const INSTITUTIONAL_RESERVES = [RESERVE_VCB, RESERVE_SENTRY, RESERVE_TRADING] as const;

export const INSTITUTIONAL_CURRENCY = 'EUR' as const;

/** Withdrawal fee retained by Sentry Bank. */
export const WITHDRAWAL_FEE_PCT = 0.015;

const DISPLAY_NAMES: Record<string, string> = {
  [RESERVE_VCB]: 'VELUM CENTRAL BANK',
  [RESERVE_SENTRY]: 'SENTRY BANK',
  [RESERVE_TRADING]: 'VELUM TRADING ACCOUNT',
};

export function institutionalDisplayName(reserveType: string): string {
  return DISPLAY_NAMES[reserveType] || reserveType;
}

/** Guarantee three institutional EUR reserves exist (idempotent). */
export async function ensureInstitutionalReservesEur(): Promise<void> {
  try {
    await executeWithRetry(async () => {
      await db.execute(sql`
        ALTER TABLE reserves
        ADD COLUMN IF NOT EXISTS currency varchar(8) NOT NULL DEFAULT 'EUR'
      `);
      await db.execute(sql`
        UPDATE reserves SET currency = 'EUR' WHERE currency IS NULL OR currency = ''
      `);

      for (const reserveType of INSTITUTIONAL_RESERVES) {
        const row = await reserveRepository.getReserve(reserveType);
        if (!row) {
          await db.insert(reserves).values({
            reserveType,
            balanceCents: 0,
            currency: INSTITUTIONAL_CURRENCY,
          });
          logger.info(
            `[InstitutionalBank] Seeded ${institutionalDisplayName(reserveType)} (0.00 EUR)`
          );
        } else if (row.currency !== INSTITUTIONAL_CURRENCY) {
          await db
            .update(reserves)
            .set({ currency: INSTITUTIONAL_CURRENCY, updatedAt: new Date() })
            .where(eq(reserves.reserveType, reserveType));
        }
      }
    });
  } catch (err) {
    logger.error('[InstitutionalBank] Failed to ensure EUR reserves:', err);
  }
}

/**
 * Ensure the three institutional EUR reserve rows exist.
 * Does not auto-mint float — use CLI `bank fund` for liquidity.
 */
export async function ensureInstitutionalLiquidity(): Promise<void> {
  await ensureInstitutionalReservesEur();
}
