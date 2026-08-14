import { pgTable, serial, integer, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => [
  index('idx_push_subscriptions_user').on(table.userId)
]);

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscriptionRow = typeof pushSubscriptions.$inferInsert;
