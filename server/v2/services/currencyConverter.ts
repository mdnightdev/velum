import { db } from '../db/client.js';
import { exchangeRates } from '../db/schema/exchange_rates.js';
import { eq, and } from 'drizzle-orm';

export interface ExchangeRate {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  updatedAt: Date;
}

export class CurrencyConverter {
  private rates: Map<string, ExchangeRate> = new Map();
  
  private setInMemoryRate(base: string, quote: string, rate: number): void {
    const key = `${base}/${quote}`;
    this.rates.set(key, {
      baseCurrency: base,
      quoteCurrency: quote,
      rate,
      updatedAt: new Date()
    });
  }

  constructor() {
    // Initialize standard market base rates relative to USD
    // EUR = 1.08 USD base value
    this.setInMemoryRate('USD', 'EUR', 0.9259);
    this.setInMemoryRate('EUR', 'USD', 1.08);

    // GBP = 1.28 USD base value
    this.setInMemoryRate('USD', 'GBP', 0.7813);
    this.setInMemoryRate('GBP', 'USD', 1.28);

    // JPY = 0.0062 USD base value
    this.setInMemoryRate('USD', 'JPY', 161.29);
    this.setInMemoryRate('JPY', 'USD', 0.0062);

    // CNY = 0.14 USD base value
    this.setInMemoryRate('USD', 'CNY', 7.14);
    this.setInMemoryRate('CNY', 'USD', 0.14);

    // TWD = 0.031 USD base value
    this.setInMemoryRate('USD', 'TWD', 32.26);
    this.setInMemoryRate('TWD', 'USD', 0.031);

    // CAD = 0.73 USD base value
    this.setInMemoryRate('USD', 'CAD', 1.37);
    this.setInMemoryRate('CAD', 'USD', 0.73);

    // AUD = 0.66 USD base value
    this.setInMemoryRate('USD', 'AUD', 1.52);
    this.setInMemoryRate('AUD', 'USD', 0.66);

    // CHF = 1.11 USD base value
    this.setInMemoryRate('USD', 'CHF', 0.90);
    this.setInMemoryRate('CHF', 'USD', 1.11);

    // SGD = 0.74 USD base value
    this.setInMemoryRate('USD', 'SGD', 1.35);
    this.setInMemoryRate('SGD', 'USD', 0.74);

    // HKD = 0.13 USD base value
    this.setInMemoryRate('USD', 'HKD', 7.69);
    this.setInMemoryRate('HKD', 'USD', 0.13);
  }

  async loadRatesFromDb(): Promise<void> {
    try {
      const dbRates = await db.select().from(exchangeRates);
      dbRates.forEach(r => {
        const key = `${r.baseCurrency}/${r.quoteCurrency}`;
        this.rates.set(key, {
          baseCurrency: r.baseCurrency,
          quoteCurrency: r.quoteCurrency,
          rate: parseFloat(r.rate),
          updatedAt: r.effectiveAt
        });
      });
      console.log(`[CurrencyConverter] Loaded ${dbRates.length} exchange rates from Postgres.`);
    } catch (err) {
      console.error('[CurrencyConverter] Failed to load rates from DB:', err);
    }
  }

  setRate(base: string, quote: string, rate: number): void {
    if (base === 'VLM' || quote === 'VLM') {
      // VLM is pegged dynamically relative to EUR, do not set manually
      return;
    }
    const key = `${base}/${quote}`;
    this.rates.set(key, {
      baseCurrency: base,
      quoteCurrency: quote,
      rate,
      updatedAt: new Date()
    });

    // Persist rate change asynchronously to the Postgres database
    (async () => {
      try {
        await db.delete(exchangeRates).where(and(eq(exchangeRates.baseCurrency, base), eq(exchangeRates.quoteCurrency, quote)));
        await db.insert(exchangeRates).values({
          baseCurrency: base,
          quoteCurrency: quote,
          rate: rate.toFixed(6),
          effectiveAt: new Date()
        });
      } catch (err) {
        console.error(`[CurrencyConverter] Failed to save rate ${key} to database:`, err);
      }
    })();
  }

  getRate(base: string, quote: string): number | null {
    // VLM is always 25 cents ($0.25 USD) higher than Euro base rate
    if (base === 'VLM' && quote === 'USD') {
      const eurUsd = this.getRate('EUR', 'USD') || 1.08;
      return eurUsd + 0.25;
    }
    if (base === 'USD' && quote === 'VLM') {
      const eurUsd = this.getRate('EUR', 'USD') || 1.08;
      return 1 / (eurUsd + 0.25);
    }
    if (base === 'VLM') {
      const vlmUsd = (this.getRate('EUR', 'USD') || 1.08) + 0.25;
      const usdQuote = this.getRate('USD', quote);
      return usdQuote !== null ? vlmUsd * usdQuote : null;
    }
    if (quote === 'VLM') {
      const usdVlm = 1 / ((this.getRate('EUR', 'USD') || 1.08) + 0.25);
      const baseUsd = this.getRate(base, 'USD');
      return baseUsd !== null ? baseUsd * usdVlm : null;
    }

    const key = `${base}/${quote}`;
    const rate = this.rates.get(key);
    return rate ? rate.rate : null;
  }

  calculateExchange(amountCents: number, from: string, to: string) {
    const isVlmInvolved = from === 'VLM' || to === 'VLM';
    const feePct = isVlmInvolved ? 0.03 : 0.04;
    const rate = this.getRate(from, to) || 1.0;
    const grossConverted = Math.round(amountCents * rate);
    const platformSpread = Math.round(grossConverted * feePct);
    const netCredited = grossConverted - platformSpread;
    return {
      rate,
      grossConverted,
      platformSpread,
      netCredited,
      feePct
    };
  }

  convert(amount: number, from: string, to: string): number {
    if (from === to) return amount;
    
    // Try direct conversion
    const directRate = this.getRate(from, to);
    if (directRate !== null) {
      return amount * directRate;
    }
    
    // Try inverse conversion
    const inverseRate = this.getRate(to, from);
    if (inverseRate !== null) {
      return amount / inverseRate;
    }
    
    // Try conversion through USD
    const fromToUsd = this.getRate(from, 'USD');
    const usdToTo = this.getRate('USD', to);
    
    if (fromToUsd !== null && usdToTo !== null) {
      return amount * fromToUsd * usdToTo;
    }
    
    throw new Error(`No exchange rate available for ${from} to ${to}`);
  }

  getAllRates(): any[] {
    const allRates = Array.from(this.rates.values()).map(r => ({
      ...r,
      base_currency: r.baseCurrency,
      quote_currency: r.quoteCurrency
    }));

    // Add VLM pairings to the list of rates
    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'TWD', 'CAD', 'AUD', 'CHF', 'SGD', 'HKD'];
    currencies.forEach(c => {
      const toVlm = this.getRate(c, 'VLM');
      if (toVlm !== null) {
        allRates.push({
          baseCurrency: c,
          quoteCurrency: 'VLM',
          rate: toVlm,
          updatedAt: new Date(),
          base_currency: c,
          quote_currency: 'VLM'
        });
      }
      const fromVlm = this.getRate('VLM', c);
      if (fromVlm !== null) {
        allRates.push({
          baseCurrency: 'VLM',
          quoteCurrency: c,
          rate: fromVlm,
          updatedAt: new Date(),
          base_currency: 'VLM',
          quote_currency: c
        });
      }
    });

    return allRates;
  }

  updateRates(newRates: { base: string; quote: string; rate: number }[]): void {
    newRates.forEach(({ base, quote, rate }) => {
      this.setRate(base, quote, rate);
    });
  }
}

export const currencyConverter = new CurrencyConverter();