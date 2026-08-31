import { pgTable, serial, varchar, text, boolean, timestamp, integer, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 32 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  salt: text('salt').notNull(),
  passcodeHash: text('passcode_hash'),
  panicPhraseHash: text('panic_phrase_hash'),
  recoveryKeyHash: text('recovery_key_hash'),
  loginRecoveryKeyHash: text('login_recovery_key_hash'),
  recoveryKey: text('recovery_key'),
  recoveryKeyDelivered: boolean('recovery_key_delivered').default(false).notNull(),
  duressActive: boolean('duress_active').default(false).notNull(),
  isCompromised: boolean('is_compromised').default(false).notNull(),
  compromiseTicketId: varchar('compromise_ticket_id', { length: 32 }),
  tempRestoreCode: varchar('temp_restore_code', { length: 64 }),
  role: varchar('role', { length: 32 }).default('USER').notNull(),
  scheduledDeletionAt: timestamp('scheduled_deletion_at'),
  displayName: varchar('display_name', { length: 64 }),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  location: text('location'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const supportAdminNominations = pgTable('support_admin_nominations', {
  id: serial('id').primaryKey(),
  nominatedUserId: integer('nominated_user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  nominatedBy: integer('nominated_by')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  status: varchar('status', { length: 32 }).default('pending').notNull(), // pending, approved, rejected, accepted, declined
  adminAccountId: integer('admin_account_id'), // Reference to created admin account
  credentials: text('credentials'), // Encrypted credentials storage
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => [
  index('idx_nominations_user').on(table.nominatedUserId),
  index('idx_nominations_status').on(table.status)
]);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type SupportAdminNomination = typeof supportAdminNominations.$inferSelect;
export type NewSupportAdminNomination = typeof supportAdminNominations.$inferInsert;

