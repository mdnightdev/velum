import { pgTable, serial, integer, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => [
  index('idx_sessions_user_id').on(table.userId),
  index('idx_sessions_expires_at').on(table.expiresAt)
]);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
