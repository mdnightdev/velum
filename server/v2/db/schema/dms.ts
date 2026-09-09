import { pgTable, serial, integer, text, varchar, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Dedicated 1-on-1 Direct Messages Table
 */
export const dms = pgTable('dms', {
  id: serial('id').primaryKey(),
  sender: integer('sender')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  peer: integer('peer')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  body: text('body').notNull(),
  encrypted: boolean('encrypted').default(false).notNull(),
  replyTo: integer('reply_to'),
  readAt: timestamp('read_at', { withTimezone: true, mode: 'date' }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true, mode: 'date' }),
  isPinned: boolean('is_pinned').default(false).notNull(),
  created: timestamp('created', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
}, (table) => [
  index('idx_dms_pair').on(table.sender, table.peer),
  index('idx_dms_peer_sender').on(table.peer, table.sender),
  index('idx_dms_created').on(table.created)
]);

/**
 * Reactions for 1-on-1 Direct Messages
 */
export const dmReactions = pgTable('dm_reactions', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id')
    .references(() => dms.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  emoji: varchar('emoji', { length: 32 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
}, (table) => [
  // Unique index name must match DB; CREATE UNIQUE INDEX IF NOT EXISTS in migrations.
  uniqueIndex('unique_dm_user_emoji').on(table.messageId, table.userId, table.emoji),
  index('idx_dm_reactions_message').on(table.messageId)
]);

/**
 * User-specific chat clear cutoff points
 */
export const dmClears = pgTable('dm_clears', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  peer: integer('peer')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  lastId: integer('last_id').default(0).notNull(),
  updated: timestamp('updated', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
}, (table) => [
  uniqueIndex('idx_dm_clears_user_peer').on(table.userId, table.peer),
  index('idx_dm_clears_user').on(table.userId)
]);

export type Dm = typeof dms.$inferSelect;
export type NewDm = typeof dms.$inferInsert;
export type DmReaction = typeof dmReactions.$inferSelect;
export type NewDmReaction = typeof dmReactions.$inferInsert;
export type DmClear = typeof dmClears.$inferSelect;
export type NewDmClear = typeof dmClears.$inferInsert;

