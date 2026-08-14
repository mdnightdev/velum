import { pgTable, serial, integer, varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const tickets = pgTable('tickets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  description: text('description').notNull(),
  issueType: varchar('issue_type', { length: 32 }).default('recovery_request').notNull(),
  status: varchar('status', { length: 32 }).default('open').notNull(),
  credibilityScore: integer('credibility_score').default(95).notNull(),
  trackingId: varchar('tracking_id', { length: 64 }),
  providedRecoveryKey: varchar('provided_recovery_key', { length: 32 }),
  messages: jsonb('messages').default([]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
