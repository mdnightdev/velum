import { pgTable, serial, varchar, numeric, timestamp, index } from 'drizzle-orm/pg-core';

export const exchangeRates = pgTable('exchange_rates', {
  id: serial('id').primaryKey(),
  baseCurrency: varchar('base_currency', { length: 8 }).notNull(),
  quoteCurrency: varchar('quote_currency', { length: 8 }).notNull(),
  rate: numeric('rate', { precision: 18, scale: 6 }).notNull(),
  effectiveAt: timestamp('effective_at').defaultNow().notNull()
}, (table) => [
  index('idx_exchange_rates_pair').on(table.baseCurrency, table.quoteCurrency)
]);

export type ExchangeRateRow = typeof exchangeRates.$inferSelect;
export type NewExchangeRateRow = typeof exchangeRates.$inferInsert;
