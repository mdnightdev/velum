import { pgTable, serial, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const systemConfig = pgTable('system_config', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 64 }).notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export type SystemConfigRow = typeof systemConfig.$inferSelect;
export type NewSystemConfigRow = typeof systemConfig.$inferInsert;
