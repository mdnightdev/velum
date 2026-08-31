import { db } from '../db/client.js';
import { lounges, loungeMembers } from '../db/schema/lounges.js';
import { eq, sql } from 'drizzle-orm';
import { deduplicateSublounges } from './loungeDeduplicator.js';

export const OFFICIAL_SUBLOUNGES = [
  { id: 2, slug: 'velum_general', name: 'General', description: 'Main community chat & general discussion', accessLevel: 'ALL', isLocked: false, isHidden: false },
  { id: 3, slug: 'velum_market', name: 'Marketplace', description: 'Official trading & commerce discussions', accessLevel: 'ALL', isLocked: false, isHidden: false },
  { id: 4, slug: 'velum_escrow', name: 'Escrow Operations', description: 'Escrow status & secure trade support', accessLevel: 'ALL', isLocked: false, isHidden: false },
  { id: 5, slug: 'velum_offtopic', name: 'Offtopic', description: 'Casual banter, games, & off-topic chatter', accessLevel: 'ALL', isLocked: false, isHidden: false },
  { id: 6, slug: 'velum_bugs', name: 'Bug Reports', description: 'Report system bugs & technical issues', accessLevel: 'ALL', isLocked: false, isHidden: false },
  { id: 7, slug: 'velum_support', name: 'Support', description: 'Velum customer support & ticket assistance', accessLevel: 'ALL', isLocked: false, isHidden: false },
  { id: 8, slug: 'velum_suggestions', name: 'Suggestions', description: 'Propose new features & platform improvements', accessLevel: 'ALL', isLocked: false, isHidden: false },
  { id: 9, slug: 'velum_events', name: 'Live Events', description: 'Community events & scheduled discussions', accessLevel: 'ALL', isLocked: false, isHidden: false },
  { id: 10, slug: 'velum_announcements', name: 'Announcements', description: 'Official Velum platform updates & news', accessLevel: 'ANNOUNCE', isLocked: true, isHidden: true },
  { id: 11, slug: 'velum_executives', name: 'Executive Lounge', description: 'Restricted executive & governance channel', accessLevel: 'EXEC_ONLY', isLocked: true, isHidden: true }
];

let isSeeded = false;

export async function ensureVelumLoungeSeeded() {
  if (isSeeded) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lounges (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(64) UNIQUE,
        name VARCHAR(64) NOT NULL,
        description TEXT,
        owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        parent_lounge_id INTEGER REFERENCES lounges(id) ON DELETE CASCADE,
        is_official BOOLEAN DEFAULT false NOT NULL,
        is_system BOOLEAN DEFAULT false NOT NULL,
        is_private BOOLEAN DEFAULT false NOT NULL,
        invite_code VARCHAR(64),
        access_level VARCHAR(32) DEFAULT 'ALL' NOT NULL,
        type VARCHAR(32) DEFAULT 'user_created' NOT NULL,
        last_message_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      ALTER TABLE lounges ADD COLUMN IF NOT EXISTS slug VARCHAR(64);
      ALTER TABLE lounges ADD COLUMN IF NOT EXISTS parent_lounge_id INTEGER REFERENCES lounges(id) ON DELETE CASCADE;
      ALTER TABLE lounges ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT false NOT NULL;
      ALTER TABLE lounges ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false NOT NULL;
      ALTER TABLE lounges ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false NOT NULL;
      ALTER TABLE lounges ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false NOT NULL;
      ALTER TABLE lounges ADD COLUMN IF NOT EXISTS invite_code VARCHAR(64);
      ALTER TABLE lounges ADD COLUMN IF NOT EXISTS access_level VARCHAR(32) DEFAULT 'ALL' NOT NULL;
      ALTER TABLE lounges ADD COLUMN IF NOT EXISTS type VARCHAR(32) DEFAULT 'user_created' NOT NULL;
      ALTER TABLE lounges ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP;
      ALTER TABLE lounges ADD COLUMN IF NOT EXISTS current_sequence_id INTEGER DEFAULT 0 NOT NULL;
      ALTER TABLE lounges ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW() NOT NULL;
      ALTER TABLE lounges ALTER COLUMN owner_id DROP NOT NULL;

      DROP TABLE IF EXISTS lounge_rooms;

      ALTER TABLE messages DROP COLUMN IF EXISTS room_id;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS client_msg_id VARCHAR(128);
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS sequence_id INTEGER DEFAULT 0 NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_messages_client_msg_id ON messages (sender_id, client_msg_id);
      CREATE INDEX IF NOT EXISTS idx_messages_lounge_sequence ON messages (lounge_id, sequence_id);

      CREATE TABLE IF NOT EXISTS lounge_members (
        id SERIAL PRIMARY KEY,
        lounge_id INTEGER REFERENCES lounges(id) ON DELETE CASCADE NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        role VARCHAR(32) DEFAULT 'member' NOT NULL,
        status VARCHAR(32) DEFAULT 'active' NOT NULL,
        joined_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_read_cursors (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        lounge_id INTEGER REFERENCES lounges(id) ON DELETE CASCADE NOT NULL,
        last_read_msg_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        last_read_seq INTEGER DEFAULT 0 NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        PRIMARY KEY (user_id, lounge_id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_read_cursors_user ON user_read_cursors (user_id);
      CREATE INDEX IF NOT EXISTS idx_user_read_cursors_lounge ON user_read_cursors (lounge_id);

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        lounge_id INTEGER REFERENCES lounges(id) ON DELETE CASCADE NOT NULL,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        content TEXT NOT NULL,
        encrypted BOOLEAN DEFAULT false NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    let [master] = await db.select().from(lounges).where(eq(lounges.slug, 'velum_master_lounge'));
    if (!master) {
      const [inserted] = await db.insert(lounges).values({
        id: 1,
        slug: 'velum_master_lounge',
        name: 'Velum Lounge',
        description: 'Official Velum Master Network Lounge',
        isOfficial: true,
        isSystem: true,
        isPrivate: false,
        type: 'official',
        accessLevel: 'ALL'
      }).onConflictDoNothing().returning();
      master = inserted || (await db.select().from(lounges).where(eq(lounges.slug, 'velum_master_lounge')))[0];
    }

    for (const sub of OFFICIAL_SUBLOUNGES) {
      const [existing] = await db.select().from(lounges).where(eq(lounges.slug, sub.slug));
      if (!existing && master) {
        await db.insert(lounges).values({
          id: sub.id,
          slug: sub.slug,
          name: sub.name,
          description: sub.description,
          parentLoungeId: master.id,
          isOfficial: true,
          isSystem: true,
          isPrivate: sub.accessLevel === 'EXEC_ONLY',
          isHidden: (sub as any).isHidden || false,
          type: sub.accessLevel === 'EXEC_ONLY' ? 'private_sublounge' : 'official',
          accessLevel: sub.accessLevel
        }).onConflictDoNothing();
      }
    }

    // Advance sequence past reserved IDs
    await db.execute(sql`
      SELECT setval(pg_get_serial_sequence('lounges', 'id'), COALESCE((SELECT MAX(id) FROM lounges), 1), true);
    `);

    await deduplicateSublounges();

    isSeeded = true;
  } catch (err) {
    console.error('[LoungeSeeder] Seeding error:', err);
  }
}
