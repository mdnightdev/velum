import { pgTable, serial, varchar, text, timestamp, integer } from 'drizzle-orm/pg-core';

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  logId: varchar('log_id', { length: 64 }).notNull().unique(),
  adminId: integer('admin_id').notNull(),
  adminName: varchar('admin_name', { length: 64 }).notNull(),
  action: varchar('action', { length: 128 }).notNull(),
  targetId: varchar('target_id', { length: 128 }),
  reason: text('reason').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull()
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
