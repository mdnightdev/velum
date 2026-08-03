import { pgTable, serial, integer, varchar, text, numeric, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const wallets = pgTable('wallets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  balance: numeric('balance', { precision: 18, scale: 2 }).default('0.00').notNull(),
  currency: varchar('currency', { length: 8 }).default('USD').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => [
  index('idx_wallets_user_id').on(table.userId)
]);

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  reference: varchar('reference', { length: 32 }).notNull().unique(),
  walletId: integer('wallet_id')
    .references(() => wallets.id, { onDelete: 'cascade' })
    .notNull(),
  type: varchar('type', { length: 16 }).notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  status: varchar('status', { length: 16 }).default('COMPLETED').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => [
  index('idx_tx_wallet_id').on(table.walletId),
  index('idx_tx_created_at').on(table.createdAt)
]);

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
