import { pgTable, serial, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/** Directional peer block: blocker cannot be messaged by/to blocked (enforced both ways). */
export const userBlocks = pgTable(
  'user_blocks',
  {
    id: serial('id').primaryKey(),
    blockerId: integer('blocker_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    blockedId: integer('blocked_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_user_blocks_pair').on(table.blockerId, table.blockedId),
    index('idx_user_blocks_blocker').on(table.blockerId),
    index('idx_user_blocks_blocked').on(table.blockedId),
  ]
);

export type UserBlock = typeof userBlocks.$inferSelect;
