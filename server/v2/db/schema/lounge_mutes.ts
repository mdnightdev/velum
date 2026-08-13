import { pgTable, integer, varchar, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { lounges } from './lounges.js';

export const loungeMuteSettings = pgTable('lounge_mute_settings', {
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  loungeId: integer('lounge_id')
    .references(() => lounges.id, { onDelete: 'cascade' })
    .notNull(),
  muteRule: varchar('mute_rule', { length: 32 }).default('off').notNull(), // 'off' | 'mentions_only' | 'forever'
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => [
  primaryKey({ columns: [table.userId, table.loungeId] }),
  index('idx_lounge_mutes_user').on(table.userId),
  index('idx_lounge_mutes_lounge').on(table.loungeId)
]);

export type LoungeMuteSetting = typeof loungeMuteSettings.$inferSelect;
export type NewLoungeMuteSetting = typeof loungeMuteSettings.$inferInsert;
