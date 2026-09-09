import { pgTable, serial, varchar, text, timestamp, integer, boolean, real, index } from 'drizzle-orm/pg-core';

export const clientDiagnostics = pgTable(
  'client_diagnostics',
  {
    id: serial('id').primaryKey(),
    logId: varchar('log_id', { length: 64 }).notNull().unique(),
    userId: integer('user_id'),
    username: varchar('username', { length: 128 }),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    appVersion: varchar('app_version', { length: 64 }),
    ipAddress: varchar('ip_address', { length: 64 }),
    screenResolution: varchar('screen_resolution', { length: 32 }),
    devicePixelRatio: real('device_pixel_ratio'),
    viewportSize: varchar('viewport_size', { length: 32 }),
    onlineStatus: boolean('online_status'),
    connectionType: varchar('connection_type', { length: 32 }),
    userAgent: text('user_agent'),
    notes: text('notes'),
    payloadJson: text('payload_json'),
    severity: varchar('severity', { length: 16 }).default('red'),
    source: varchar('source', { length: 32 }).default('manual'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at'),
  },
  (table) => [
    index('idx_client_diag_created').on(table.createdAt),
    index('idx_client_diag_status').on(table.status),
    index('idx_client_diag_user').on(table.userId),
  ]
);

export const healReports = pgTable(
  'heal_reports',
  {
    id: serial('id').primaryKey(),
    reportId: varchar('report_id', { length: 64 }).notNull().unique(),
    mode: varchar('mode', { length: 16 }).notNull(), // fix | report
    status: varchar('status', { length: 16 }).notNull(), // ok | degraded | critical
    summary: text('summary').notNull(),
    findingsJson: text('findings_json'),
    actionsJson: text('actions_json'),
    triggeredBy: varchar('triggered_by', { length: 64 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_heal_reports_created').on(table.createdAt)]
);

export type ClientDiagnosticRow = typeof clientDiagnostics.$inferSelect;
export type HealReportRow = typeof healReports.$inferSelect;
