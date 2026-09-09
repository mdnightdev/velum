import { pgTable, serial, varchar, text, timestamp, index, integer, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const blacklist = pgTable('blacklist', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 32 }).notNull(), // 'DEVICE_ID', 'DEVICE_FINGERPRINT', 'IP', 'USERNAME', 'HARDWARE'
  value: varchar('value', { length: 255 }).notNull().unique(),
  deviceFingerprint: varchar('device_fingerprint', { length: 64 }),
  deviceModel: varchar('device_model', { length: 128 }),
  platform: varchar('platform', { length: 32 }),
  userAgent: text('user_agent'),
  hardwareSpecs: jsonb('hardware_specs').$type<{
    screenResolution?: string;
    hardwareConcurrency?: number;
    deviceMemory?: number;
    webglVendor?: string;
    webglRenderer?: string;
    timezone?: string;
  }>(),
  reason: text('reason').notNull(),
  bannedBy: varchar('banned_by', { length: 64 }).default('SYSTEM').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => [
  index('idx_blacklist_type_value').on(table.type, table.value),
  index('idx_blacklist_fingerprint').on(table.deviceFingerprint),
  index('idx_blacklist_user_id').on(table.userId)
]);

export type BlacklistEntry = typeof blacklist.$inferSelect;
export type NewBlacklistEntry = typeof blacklist.$inferInsert;
