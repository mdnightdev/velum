-- Clear legacy encrypted messages from database
-- This script removes old ratchet:v1 messages and other legacy encryption formats

-- Delete messages with legacy ratchet:v1 encryption
DELETE FROM messages
WHERE content LIKE 'ratchet:v1:%';

-- Optionally delete messages with other legacy patterns
-- Delete lounge messages
DELETE FROM messages WHERE content LIKE 'VEL_E2EE[%';

-- Delete ALL encrypted messages
DELETE FROM messages WHERE encrypted = true;

--Delete All Attachments
DELETE FROM messages WHERE content LIKE '%[Attachment:%';

--Delete Message history
DELETE FROM messages;

UPDATE lounges SET last_message_text = NULL, last_message_at = NULL, last_message_sender_id = NULL;
