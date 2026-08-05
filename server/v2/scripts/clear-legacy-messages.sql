-- Clear legacy encrypted messages from database
-- This script removes old ratchet:v1 messages and other legacy encryption formats

-- Delete messages with legacy ratchet:v1 encryption
DELETE FROM messages
WHERE content LIKE 'ratchet:v1:%';

-- Optionally delete messages with other legacy patterns
-- Uncomment if you want to clear lounge messages too
-- DELETE FROM messages WHERE content LIKE 'VEL_E2EE[%';

-- Optionally delete all encrypted messages for a fresh start
-- Uncomment to delete ALL encrypted messages
-- DELETE FROM messages WHERE is_encrypted = true;
