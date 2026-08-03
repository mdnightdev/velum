import { pgTable, serial, integer, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const tickets = pgTable('tickets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  description: text('description').notNull(),
  status: varchar('status', { length: 32 }).default('OPEN').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});
export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
