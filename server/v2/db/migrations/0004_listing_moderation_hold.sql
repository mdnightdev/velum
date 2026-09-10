-- Listing moderation hold fields (review queue; no auto-ban)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS moderation_reason text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS moderation_lane varchar(16);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS held_at timestamp;
