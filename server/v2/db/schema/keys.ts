import { pgTable, serial, integer, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export interface OneTimePrekeyItem {
  keyId: number;
  publicKey: string; // Base64 (33 bytes)
}

export const userPrekeys = pgTable('user_prekeys', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  deviceId: text('device_id').notNull(),
  registrationId: integer('registration_id').default(1).notNull(),
  identityKey: text('identity_key').notNull(),
  signedPrekeyId: integer('signed_prekey_id').default(1).notNull(),
  signedPrekey: text('signed_prekey').notNull(),
  signedPrekeySignature: text('signed_prekey_signature').notNull(),
  oneTimePrekeys: text('one_time_prekeys').default('[]').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => [
  uniqueIndex('idx_user_prekeys_user_device').on(table.userId, table.deviceId),
  index('idx_user_prekeys_user_id').on(table.userId)
]);

export type UserPrekey = typeof userPrekeys.$inferSelect;
export type NewUserPrekey = typeof userPrekeys.$inferInsert;
