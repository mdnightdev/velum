import { pgTable, serial, integer, varchar, numeric, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const cards = pgTable('cards', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  cardToken: varchar('card_token', { length: 32 }).notNull().unique(),
  cardType: varchar('card_type', { length: 16 }).notNull().default('CREDIT'),
  limitCents: integer('limit_cents').notNull().default(500000),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => [
  index('idx_cards_user_id').on(table.userId),
  index('idx_cards_token').on(table.cardToken)
]);

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
