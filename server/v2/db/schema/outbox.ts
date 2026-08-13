import { pgTable, serial, varchar, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const outboxEvents = pgTable('outbox_events', {
  id: serial('id').primaryKey(),
  eventType: varchar('event_type', { length: 64 }).notNull(),
  aggregateId: varchar('aggregate_id', { length: 64 }).notNull(),
  payload: jsonb('payload').notNull(),
  processed: boolean('processed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;
