import { pgTable, serial, integer, varchar, text, boolean, timestamp, index, AnyPgColumn } from 'drizzle-orm/pg-core';
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => [
  index('idx_lounges_owner_id').on(table.ownerId),
  index('idx_lounges_parent_lounge_id').on(table.parentLoungeId),
  index('idx_lounges_slug').on(table.slug)
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
  encrypted: boolean('encrypted').default(false).notNull(),
  deliveredTo: text('delivered_to').default(''),
  readBy: text('read_by').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => [
  index('idx_messages_lounge_id').on(table.loungeId),
  index('idx_messages_sender_id').on(table.senderId),
  index('idx_messages_created_at').on(table.createdAt)
]);

export type Lounge = typeof lounges.$inferSelect;
export type NewLounge = typeof lounges.$inferInsert;
export type LoungeMember = typeof loungeMembers.$inferSelect;
export type NewLoungeMember = typeof loungeMembers.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
