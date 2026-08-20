import { pgTable, serial, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const webauthnCredentials = pgTable('webauthn_credentials', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  credentialId: text('credential_id').notNull().unique(),
  publicKey: text('public_key').notNull(),
  counter: integer('counter').default(0),
  transports: jsonb('transports').$type<string[]>(),
  deviceType: text('device_type'),
  backedUp: integer('backed_up').default(0),
  aaguid: text('aaguid'),
  createdAt: timestamp('created_at').defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
  nickname: text('nickname'), // User-friendly name for the passkey
});

export type WebauthnCredential = typeof webauthnCredentials.$inferSelect;