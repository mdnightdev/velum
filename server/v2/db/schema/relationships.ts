import { pgTable, serial, integer, varchar, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const relationships = pgTable('relationships', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  friendId: integer('friend_id').references(() => users.id).notNull(),
  status: varchar('status', { length: 32 }).default('pending').notNull(), // 'pending', 'accepted', 'blocked'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export type Relationship = typeof relationships.$inferSelect;
export type NewRelationship = typeof relationships.$inferInsert;
