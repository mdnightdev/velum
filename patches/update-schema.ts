import { db } from './server/v2/db/client.js';
import { sql } from 'drizzle-orm';
await db.execute(sql`ALTER TABLE lounges ADD COLUMN IF NOT EXISTS last_message_text TEXT;`);
await db.execute(sql`ALTER TABLE lounges ADD COLUMN IF NOT EXISTS last_message_sender_id INTEGER;`);
console.log("Migration complete!");
process.exit(0);
