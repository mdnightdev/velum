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

export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  reporterId: integer('reporter_id').references(() => users.id).notNull(),
  targetUserId: integer('target_user_id').references(() => users.id).notNull(),
  targetMessageId: varchar('target_message_id', { length: 64 }),
  type: varchar('type', { length: 64 }).default('user_misconduct').notNull(),
  priority: varchar('priority', { length: 32 }).default('medium').notNull(),
  reason: text('reason').notNull(),
  status: varchar('status', { length: 32 }).default('pending').notNull(),
  attachments: jsonb('attachments').default([]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
