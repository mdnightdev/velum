import { pgTable, serial, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { lounges } from './lounges.js';

export const userChatClears = pgTable('user_chat_clears', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  loungeId: integer('lounge_id')
    .references(() => lounges.id, { onDelete: 'cascade' })
    .notNull(),
  clearedAt: timestamp('cleared_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
}, (table) => [
  uniqueIndex('idx_user_chat_clears_unique').on(table.userId, table.loungeId),
  index('idx_user_chat_clears_user').on(table.userId),
  index('idx_user_chat_clears_lounge').on(table.loungeId)
]);

export type UserChatClear = typeof userChatClears.$inferSelect;
export type NewUserChatClear = typeof userChatClears.$inferInsert;
