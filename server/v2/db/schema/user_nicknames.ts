import { pgTable, serial, integer, varchar, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const userNicknames = pgTable('user_nicknames', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  targetId: integer('target_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  nickname: varchar('nickname', { length: 48 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_user_nicknames_owner_target').on(table.ownerId, table.targetId),
  index('idx_user_nicknames_owner').on(table.ownerId),
]);
