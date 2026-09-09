import { pgTable, serial, varchar, text, timestamp, integer, index } from 'drizzle-orm/pg-core';

/** Durable amber/red ops events for admin audit (not user message content). */
export const opsErrorEvents = pgTable(
  'ops_error_events',
  {
    id: serial('id').primaryKey(),
    eventId: varchar('event_id', { length: 64 }).notNull().unique(),
    severity: varchar('severity', { length: 16 }).notNull(), // amber | red
    code: varchar('code', { length: 64 }).notNull(),
    message: text('message').notNull(),
    route: varchar('route', { length: 256 }),
    method: varchar('method', { length: 16 }),
    statusCode: integer('status_code'),
    userId: integer('user_id'),
    correlationId: varchar('correlation_id', { length: 64 }),
    component: varchar('component', { length: 128 }),
    detailsJson: text('details_json'),
    stack: text('stack'),
    resolved: varchar('resolved', { length: 16 }).default('open').notNull(), // open | resolved
    createdAt: timestamp('created_at').defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at'),
  },
  (table) => [
    index('idx_ops_errors_severity').on(table.severity),
    index('idx_ops_errors_created').on(table.createdAt),
    index('idx_ops_errors_resolved').on(table.resolved),
  ]
);

export type OpsErrorEvent = typeof opsErrorEvents.$inferSelect;
export type NewOpsErrorEvent = typeof opsErrorEvents.$inferInsert;
