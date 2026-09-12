import { sql } from 'drizzle-orm';
import { db, executeWithRetry } from '../db/client.js';
import { moderationService } from './moderationService.js';
import { currencyConverter } from './currencyConverter.js';
import { SystemConfigService } from './systemConfigService.js';
import {
  MARKET_LISTING_CURRENCIES,
  type MarketListingCurrency,
} from '../db/schema/marketplace.js';
import { WALLET_CURRENCIES } from '../db/schema/wallets.js';
import { BadRequestError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * @deprecated Prefer moderationService.scanListingContent.
 */
export function scanContent(title: string, description: string): boolean {
  return moderationService.scanListingContent(`${title} ${description || ''}`) != null;
}

export function assertListingCurrency(currency: string): MarketListingCurrency {
  const c = String(currency || 'EUR').toUpperCase();
  if (!(MARKET_LISTING_CURRENCIES as readonly string[]).includes(c)) {
    throw new BadRequestError('Listing currency must be EUR or VLM.');
  }
  return c as MarketListingCurrency;
}

export function assertPayCurrency(currency: string): string {
  const c = String(currency || 'EUR').toUpperCase();
  if (!(WALLET_CURRENCIES as readonly string[]).includes(c)) {
    throw new BadRequestError(`Unsupported payment currency: ${c}`);
  }
  return c;
}

/** Spot FX: convert listing price into the currency the buyer will pay. */
export function listingPriceInPayCurrency(
  listingPriceMajor: number,
  listingCurrency: string,
  payCurrency: string
): { paymentAmount: number; rate: number } {
  if (listingCurrency === payCurrency) {
    return { paymentAmount: listingPriceMajor, rate: 1 };
  }
  const rate = currencyConverter.getRate(listingCurrency, payCurrency);
  if (rate == null) {
    throw new BadRequestError(`No exchange rate for ${listingCurrency} → ${payCurrency}`);
  }
  const paymentAmount = Math.round(listingPriceMajor * rate * 100) / 100;
  return { paymentAmount, rate };
}

export async function getEscrowFeePercent(): Promise<number> {
  const cfg = await SystemConfigService.getAll();
  return Number.isFinite(cfg.escrowFeePercent) ? cfg.escrowFeePercent : 1.0;
}

/** Convert fee (in listing currency) to EUR cents for Trading Account. */
export function feeToEurCents(feeMajor: number, listingCurrency: string): number {
  if (feeMajor <= 0) return 0;
  if (listingCurrency === 'EUR') {
    return Math.round(feeMajor * 100);
  }
  const rate = currencyConverter.getRate(listingCurrency, 'EUR');
  if (rate == null) {
    throw new BadRequestError(`No exchange rate for ${listingCurrency} → EUR (platform fee)`);
  }
  return Math.round(feeMajor * rate * 100);
}

/** Idempotent DDL for listing/escrow currency columns. */
export async function ensureMarketCurrencySchema(): Promise<void> {
  try {
    await executeWithRetry(async () => {
      await db.execute(sql`
        ALTER TABLE listings ADD COLUMN IF NOT EXISTS currency varchar(8) NOT NULL DEFAULT 'EUR'
      `);
      await db.execute(sql`
        ALTER TABLE escrows ADD COLUMN IF NOT EXISTS currency varchar(8) NOT NULL DEFAULT 'EUR'
      `);
      await db.execute(sql`
        ALTER TABLE escrows ADD COLUMN IF NOT EXISTS payment_currency varchar(8) NOT NULL DEFAULT 'EUR'
      `);
      await db.execute(sql`
        ALTER TABLE escrows ADD COLUMN IF NOT EXISTS payment_amount numeric(18, 2)
      `);
      await db.execute(sql`
        UPDATE escrows SET payment_amount = amount WHERE payment_amount IS NULL
      `);
      await db.execute(sql`
        ALTER TABLE escrows ALTER COLUMN payment_amount SET NOT NULL
      `);
    });
  } catch (err) {
    logger.error('[Marketplace] Failed to ensure market currency schema:', err);
  }
}
