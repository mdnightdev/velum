-- Performance optimization indexes
-- Add composite index for lounge message queries (common pattern: get messages by lounge sorted by time)
CREATE INDEX IF NOT EXISTS idx_messages_lounge_created ON messages(lounge_id, created_at DESC);

-- Add index for lounge updates (for last message tracking)
CREATE INDEX IF NOT EXISTS idx_lounges_last_message_at ON lounges(last_message_at DESC);

-- Add index for user session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Add index for user relationships (for DM discovery)
CREATE INDEX IF NOT EXISTS idx_relationships_user_friend ON relationships(user_id, friend_id);
