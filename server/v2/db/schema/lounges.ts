import { pgTable, serial, integer, varchar, text, boolean, timestamp, index, AnyPgColumn, primaryKey, unique } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const lounges = pgTable('lounges', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 64 }).unique(),
  name: varchar('name', { length: 64 }).notNull(),
  description: text('description'),
  ownerId: integer('owner_id')
    .references(() => users.id, { onDelete: 'set null' }),
  parentLoungeId: integer('parent_lounge_id')
    .references((): AnyPgColumn => lounges.id, { onDelete: 'cascade' }),
  isOfficial: boolean('is_official').default(false).notNull(),
  isSystem: boolean('is_system').default(false).notNull(),
  isPrivate: boolean('is_private').default(false).notNull(),
  isHidden: boolean('is_hidden').default(false).notNull(),
  inviteCode: varchar('invite_code', { length: 64 }),
  accessLevel: varchar('access_level', { length: 32 }).default('ALL').notNull(),
  type: varchar('type', { length: 32 }).default('user_created').notNull(),
  avatarUrl: varchar('avatar_url', { length: 512 }),
  lastMessageAt: timestamp('last_message_at'),
  lastMessageText: text('last_message_text'),
  lastMessageSenderId: integer('last_message_sender_id').references(() => users.id, { onDelete: 'set null' }),
  currentSequenceId: integer('current_sequence_id').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => [
  index('idx_lounges_owner_id').on(table.ownerId),
  index('idx_lounges_parent_lounge_id').on(table.parentLoungeId),
  index('idx_lounges_slug').on(table.slug),
  index('idx_lounges_last_message_at').on(table.lastMessageAt)
]);

export const loungeMembers = pgTable('lounge_members', {
  id: serial('id').primaryKey(),
  loungeId: integer('lounge_id')
    .references(() => lounges.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  role: varchar('role', { length: 32 }).default('member').notNull(),
  status: varchar('status', { length: 32 }).default('active').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull()
}, (table) => [
  index('idx_lounge_members_lounge_user').on(table.loungeId, table.userId)
]);

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  loungeId: integer('lounge_id')
    .references(() => lounges.id, { onDelete: 'cascade' })
    .notNull(),
  senderId: integer('sender_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  content: text('content').notNull(),
  clientMsgId: varchar('client_msg_id', { length: 128 }),
  sequenceId: integer('sequence_id').default(0).notNull(),
  encrypted: boolean('encrypted').default(false).notNull(),
  deliveredTo: text('delivered_to').default(''),
  readBy: text('read_by').default(''),
  isEdited: boolean('is_edited').default(false).notNull(),
  editedAt: timestamp('edited_at'),
  isPinned: boolean('is_pinned').default(false).notNull(),
  replyTo: integer('reply_to'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => [
  index('idx_messages_lounge_id').on(table.loungeId),
  index('idx_messages_sender_id').on(table.senderId),
  index('idx_messages_created_at').on(table.createdAt),
  index('idx_messages_lounge_created').on(table.loungeId, table.createdAt),
  index('idx_messages_client_msg_id').on(table.senderId, table.clientMsgId),
  index('idx_messages_lounge_sequence').on(table.loungeId, table.sequenceId)
]);

export const userUnreadCounts = pgTable('user_unread_counts', {
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  loungeId: integer('lounge_id')
    .references(() => lounges.id, { onDelete: 'cascade' })
    .notNull(),
  unreadCount: integer('unread_count').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => [
  primaryKey({ columns: [table.userId, table.loungeId] }),
  index('idx_user_unread_counts_user').on(table.userId),
  index('idx_user_unread_counts_lounge').on(table.loungeId)
]);

export const messageReactions = pgTable('message_reactions', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id')
    .references(() => messages.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  emoji: varchar('emoji', { length: 32 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => [
  unique('unique_message_user_emoji').on(table.messageId, table.userId, table.emoji),
  index('idx_message_reactions_message').on(table.messageId)
]);

export type Lounge = typeof lounges.$inferSelect;
export type NewLounge = typeof lounges.$inferInsert;
export type LoungeMember = typeof loungeMembers.$inferSelect;
export type NewLoungeMember = typeof loungeMembers.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type UserUnreadCount = typeof userUnreadCounts.$inferSelect;
export type NewUserUnreadCount = typeof userUnreadCounts.$inferInsert;
export type MessageReaction = typeof messageReactions.$inferSelect;
export type NewMessageReaction = typeof messageReactions.$inferInsert;
