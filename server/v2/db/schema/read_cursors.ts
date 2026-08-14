import { pgTable, integer, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { lounges, messages } from './lounges.js';

export const userReadCursors = pgTable('user_read_cursors', {
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  loungeId: integer('lounge_id')
    .references(() => lounges.id, { onDelete: 'cascade' })
    .notNull(),
  lastReadMsgId: integer('last_read_msg_id')
    .references(() => messages.id, { onDelete: 'cascade' }),
  lastReadSeq: integer('last_read_seq').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => [
  primaryKey({ columns: [table.userId, table.loungeId] }),
  index('idx_user_read_cursors_user').on(table.userId),
  index('idx_user_read_cursors_lounge').on(table.loungeId)
]);

export type UserReadCursor = typeof userReadCursors.$inferSelect;
export type NewUserReadCursor = typeof userReadCursors.$inferInsert;
