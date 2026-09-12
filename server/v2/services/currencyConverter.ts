import { db, executeWithRetry } from '../db/client.js';
import { exchangeRates } from '../db/schema/exchange_rates.js';
import { eq, and } from 'drizzle-orm';
import { WALLET_CURRENCIES } from '../db/schema/wallets.js';

export interface ExchangeRate {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  updatedAt: Date;
}

/** USD market value of 1 unit — used only to derive EUR-relative pairs. */
const USD_VALUE_PER_UNIT: Record<string, number> = {
  EUR: 1.08,
  USD: 1.0,
  GBP: 1.28,
  JPY: 0.0062,
  CNY: 0.14,
  TWD: 0.031,
  CAD: 0.73,
  AUD: 0.66,
  CHF: 1.11,
  SGD: 0.74,
  HKD: 0.13,
  // VLM pegged at EUR USD value + $0.25
  VLM: 1.33,
};

export class CurrencyConverter {
  private rates: Map<string, ExchangeRate> = new Map();

  private setInMemoryRate(base: string, quote: string, rate: number): void {
    const key = `${base}/${quote}`;
    this.rates.set(key, {
      baseCurrency: base,
      quoteCurrency: quote,
      rate,
      updatedAt: new Date(),
    });
  }

  constructor() {
    this.seedEurRelativeDefaults();
  }

  /** Build in-memory pairs relative to EUR (1 EUR = rate quote). */
  private seedEurRelativeDefaults(): void {
    const codes = Object.keys(USD_VALUE_PER_UNIT);
    for (const base of codes) {
      for (const quote of codes) {
        if (base === quote) continue;
        const rateVal = USD_VALUE_PER_UNIT[base] / USD_VALUE_PER_UNIT[quote];
        this.setInMemoryRate(base, quote, rateVal);
      }
    }
  }

  async loadRatesFromDb(): Promise<void> {
    try {
      const dbRates = await executeWithRetry(() => db.select().from(exchangeRates));
      dbRates.forEach((r) => {
        const key = `${r.baseCurrency}/${r.quoteCurrency}`;
        this.rates.set(key, {
          baseCurrency: r.baseCurrency,
          quoteCurrency: r.quoteCurrency,
          rate: parseFloat(r.rate),
          updatedAt: r.effectiveAt,
        });
      });
      console.log(`[CurrencyConverter] Loaded ${dbRates.length} exchange rates from Postgres.`);
    } catch (err) {
      console.error('[CurrencyConverter] Failed to load rates from DB:', err);
    }
  }

  setRate(base: string, quote: string, rate: number): void {
    if (base === 'VLM' || quote === 'VLM') {
      return;
    }
    this.setInMemoryRate(base, quote, rate);

    void (async () => {
      try {
        await executeWithRetry(async () => {
          await db
            .delete(exchangeRates)
            .where(
              and(eq(exchangeRates.baseCurrency, base), eq(exchangeRates.quoteCurrency, quote))
            );
          await db.insert(exchangeRates).values({
            baseCurrency: base,
            quoteCurrency: quote,
            rate: rate.toFixed(6),
            effectiveAt: new Date(),
          });
        });
      } catch (err) {
        console.error(`[CurrencyConverter] Failed to save rate ${base}/${quote}:`, err);
      }
    })();
  }

  getRate(base: string, quote: string): number | null {
    if (base === quote) return 1;

    const direct = this.rates.get(`${base}/${quote}`);
    if (direct) return direct.rate;

    const inverse = this.rates.get(`${quote}/${base}`);
    if (inverse && inverse.rate !== 0) return 1 / inverse.rate;

    // Pivot through EUR
    const baseEur = this.rates.get(`${base}/EUR`)?.rate;
    const eurQuote = this.rates.get(`EUR/${quote}`)?.rate;
    if (baseEur != null && eurQuote != null) return baseEur * eurQuote;

    const eurBase = this.rates.get(`EUR/${base}`)?.rate;
    const quoteEur = this.rates.get(`${quote}/EUR`)?.rate;
    if (eurBase != null && eurBase !== 0 && quoteEur != null) {
      return (1 / eurBase) * (1 / quoteEur);
    }

    return null;
  }

  /**
   * Fee: 3% when VLM is involved, otherwise 4%.
   * Amounts are in minor units (cents) of the source currency for debit sizing;
   * converted figures are in minor units of the destination currency.
   */
  calculateExchange(amountCents: number, from: string, to: string) {
    const isVlmInvolved = from === 'VLM' || to === 'VLM';
    const feePct = isVlmInvolved ? 0.03 : 0.04;
    const rate = this.getRate(from, to);
    if (rate == null) {
      throw new Error(`No exchange rate available for ${from} to ${to}`);
    }
    const grossConverted = Math.round(amountCents * rate);
    const platformSpread = Math.round(grossConverted * feePct);
    const netCredited = grossConverted - platformSpread;
    return {
      rate,
      grossConverted,
      platformSpread,
      netCredited,
      feePct,
    };
  }

  convert(amount: number, from: string, to: string): number {
    if (from === to) return amount;
    const rate = this.getRate(from, to);
    if (rate == null) {
      throw new Error(`No exchange rate available for ${from} to ${to}`);
    }
    return amount * rate;
  }

  getAllRates(): Array<
    ExchangeRate & { base_currency: string; quote_currency: string }
  > {
    return Array.from(this.rates.values()).map((r) => ({
      ...r,
      base_currency: r.baseCurrency,
      quote_currency: r.quoteCurrency,
    }));
  }

  updateRates(newRates: { base: string; quote: string; rate: number }[]): void {
    newRates.forEach(({ base, quote, rate }) => {
      this.setRate(base, quote, rate);
    });
  }

  supportedCurrencies(): readonly string[] {
    return WALLET_CURRENCIES;
  }
}

export const currencyConverter = new CurrencyConverter();
