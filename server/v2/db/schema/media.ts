import { pgTable, serial, integer, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const mediaAssets = pgTable('media_assets', {
  id: serial('id').primaryKey(),
  uploaderId: integer('uploader_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  storageKey: text('storage_key').notNull(),
  relativePath: text('relative_path').notNull(),
  mimeType: varchar('mime_type', { length: 128 }).notNull(),
  byteSize: integer('byte_size').notNull(),
  category: varchar('category', { length: 32 }).notNull(), // 'avatar' | 'chat' | 'general'
  sha256: varchar('sha256', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
}, (table) => [
  index('idx_media_assets_uploader').on(table.uploaderId),
  index('idx_media_assets_category').on(table.category),
  index('idx_media_assets_storage_key').on(table.storageKey),
  index('idx_media_assets_relative_path').on(table.relativePath)
]);

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
