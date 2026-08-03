import { pgTable, serial, integer, varchar, text, numeric, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const listings = pgTable('listings', {
  id: serial('id').primaryKey(),
  sellerId: integer('seller_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: varchar('title', { length: 128 }).notNull(),
  description: text('description').notNull(),
  price: numeric('price', { precision: 18, scale: 2 }).notNull(),
  category: varchar('category', { length: 64 }).notNull(),
  stock: integer('stock').default(1).notNull(),
  digitalDelivery: boolean('digital_delivery').default(false).notNull(),
  digitalPayload: text('digital_payload'),
  status: varchar('status', { length: 16 }).default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => [
  index('idx_listings_seller_id').on(table.sellerId),
  index('idx_listings_category').on(table.category)
]);

export const escrows = pgTable('escrows', {
  id: serial('id').primaryKey(),
  listingId: integer('listing_id')
    .references(() => listings.id, { onDelete: 'cascade' })
    .notNull(),
  buyerId: integer('buyer_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  sellerId: integer('seller_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  status: varchar('status', { length: 16 }).default('HELD').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => [
  index('idx_escrows_listing_id').on(table.listingId),
  index('idx_escrows_buyer_id').on(table.buyerId),
  index('idx_escrows_seller_id').on(table.sellerId)
]);

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type Escrow = typeof escrows.$inferSelect;
export type NewEscrow = typeof escrows.$inferInsert;
