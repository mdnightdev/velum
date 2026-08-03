import { pgTable, serial, integer, varchar, timestamp } from 'drizzle-orm/pg-core';

export const reserves = pgTable('reserves', {
  id: serial('id').primaryKey(),
  reserveType: varchar('reserve_type', { length: 32 }).notNull().unique(),
  balanceCents: integer('balance_cents').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export type Reserve = typeof reserves.$inferSelect;
export type NewReserve = typeof reserves.$inferInsert;
