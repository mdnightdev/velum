import { pgTable, serial, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 32 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  salt: text('salt').notNull(),
  passcodeHash: text('passcode_hash'),
  panicPhraseHash: text('panic_phrase_hash'),
  recoveryKeyHash: text('recovery_key_hash'),
  loginRecoveryKeyHash: text('login_recovery_key_hash'),
  duressActive: boolean('duress_active').default(false).notNull(),
  isCompromised: boolean('is_compromised').default(false).notNull(),
  compromiseTicketId: varchar('compromise_ticket_id', { length: 32 }),
  role: varchar('role', { length: 32 }).default('USER').notNull(),
  displayName: varchar('display_name', { length: 64 }),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  location: text('location'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
