import { pgTable, serial, integer, varchar, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const devices = pgTable('devices', {
  id: serial('id').primaryKey(),
  deviceId: varchar('device_id', { length: 64 }).notNull().unique(),
  deviceFingerprint: varchar('device_fingerprint', { length: 64 }).notNull(),
  userAgent: text('user_agent'),
  platform: varchar('platform', { length: 32 }),
  screenResolution: varchar('screen_resolution', { length: 32 }),
  timezone: varchar('timezone', { length: 64 }),
  language: varchar('language', { length: 16 }),
  hardwareConcurrency: integer('hardware_concurrency'),
  deviceMemory: integer('device_memory'),
  webglVendor: varchar('webgl_vendor', { length: 128 }),
  webglRenderer: varchar('webgl_renderer', { length: 128 }),
  firstSeen: timestamp('first_seen').defaultNow().notNull(),
  lastSeen: timestamp('last_seen').defaultNow().notNull(),
  accessCount: integer('access_count').default(0).notNull()
}, (table) => [
  index('idx_devices_device_id').on(table.deviceId),
  index('idx_devices_fingerprint').on(table.deviceFingerprint)
]);

export const userDevices = pgTable('user_devices', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  deviceId: varchar('device_id', { length: 64 }).notNull(),
  firstSeen: timestamp('first_seen').defaultNow().notNull(),
  lastSeen: timestamp('last_seen').defaultNow().notNull(),
  isCurrent: boolean('is_current').default(true).notNull()
}, (table) => [
  index('idx_user_devices_user_id').on(table.userId),
  index('idx_user_devices_device_id').on(table.deviceId)
]);

export const ipAddresses = pgTable('ip_addresses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  deviceId: varchar('device_id', { length: 64 }),
  firstSeen: timestamp('first_seen').defaultNow().notNull(),
  lastSeen: timestamp('last_seen').defaultNow().notNull(),
  isCurrent: boolean('is_current').default(true).notNull(),
  accessCount: integer('access_count').default(0).notNull()
}, (table) => [
  index('idx_ip_addresses_user_id').on(table.userId),
  index('idx_ip_addresses_ip').on(table.ipAddress)
]);

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type UserDevice = typeof userDevices.$inferSelect;
export type NewUserDevice = typeof userDevices.$inferInsert;
export type IpAddress = typeof ipAddresses.$inferSelect;
export type NewIpAddress = typeof ipAddresses.$inferInsert;