import { pgTable, serial, integer, varchar, text, numeric, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { wallets } from './wallets.js';

export const reversals = pgTable('reversals', {
  id: serial('id').primaryKey(),
  reference: varchar('reference', { length: 64 }).notNull().unique(),
  originalTxnRef: varchar('original_txn_ref', { length: 64 }),
  type: varchar('type', { length: 32 }).notNull(), // REFUND, REVERSAL, SCAM_ROLLBACK
  walletId: integer('wallet_id')
    .references(() => wallets.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  fromUserId: integer('from_user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 8 }).default('USDT').notNull(),
  reason: text('reason').notNull(),
  status: varchar('status', { length: 16 }).default('COMPLETED').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => [
  index('idx_reversals_user_id').on(table.userId),
  index('idx_reversals_wallet_id').on(table.walletId),
  index('idx_reversals_created_at').on(table.createdAt)
]);

export type Reversal = typeof reversals.$inferSelect;
export type NewReversal = typeof reversals.$inferInsert;
