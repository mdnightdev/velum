import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  numeric,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/** Supported wallet currencies. Platform default / primary reserve display: EUR. Native token: VLM. */
export const WALLET_CURRENCIES = [
  'EUR',
  'VLM',
  'USD',
  'GBP',
  'JPY',
  'CNY',
  'TWD',
  'CAD',
  'AUD',
  'CHF',
  'SGD',
  'HKD',
] as const;

export type WalletCurrency = (typeof WALLET_CURRENCIES)[number];

export const DEFAULT_WALLET_CURRENCY: WalletCurrency = 'EUR';

export const wallets = pgTable(
  'wallets',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    balance: numeric('balance', { precision: 18, scale: 2 }).default('0.00').notNull(),
    currency: varchar('currency', { length: 8 }).default('EUR').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_wallets_user_id').on(table.userId),
    uniqueIndex('wallets_user_currency_uidx').on(table.userId, table.currency),
  ]
);

export const transactions = pgTable(
  'transactions',
  {
    id: serial('id').primaryKey(),
    reference: varchar('reference', { length: 32 }).notNull().unique(),
    walletId: integer('wallet_id')
      .references(() => wallets.id, { onDelete: 'cascade' })
      .notNull(),
    type: varchar('type', { length: 16 }).notNull(),
    amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
    status: varchar('status', { length: 16 }).default('COMPLETED').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_tx_wallet_id').on(table.walletId),
    index('idx_tx_created_at').on(table.createdAt),
  ]
);

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
