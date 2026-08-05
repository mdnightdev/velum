import { pgTable, serial, integer, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const userPrekeys = pgTable('user_prekeys', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  identityKey: text('identity_key').notNull(),
  signedPrekey: text('signed_prekey').notNull(),
  signedPrekeySignature: text('signed_prekey_signature').notNull(),
  oneTimePrekeys: text('one_time_prekeys').default('[]').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => [
  index('idx_user_prekeys_user_id').on(table.userId)
]);

export type UserPrekey = typeof userPrekeys.$inferSelect;
export type NewUserPrekey = typeof userPrekeys.$inferInsert;
