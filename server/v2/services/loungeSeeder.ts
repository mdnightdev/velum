import { db } from '../db/client.js';
import { lounges, loungeMembers } from '../db/schema/lounges.js';
import { users } from '../db/schema/users.js';
import { eq, sql, and, inArray } from 'drizzle-orm';
import { deduplicateSublounges } from './loungeDeduplicator.js';
import { MIN_PUBLIC_LOUNGE_ID } from '../constants/systemIds.js';

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

/** Platform roles treated as Velum lounge owners (membership.role = owner). */
export const VELUM_LOUNGE_OWNER_SYSTEM_ROLES = ['CLI_ADMIN', 'LOGIN_ADMIN'] as const;
/** Platform roles treated as Velum lounge admins (membership.role = admin). */
export const VELUM_LOUNGE_ADMIN_SYSTEM_ROLES = ['SUPPORT_ADMIN'] as const;

let isSeeded = false;

async function upsertLoungeMembership(
  loungeId: number,
  userId: number,
  role: 'owner' | 'admin'
) {
  const [existing] = await db
    .select()
    .from(loungeMembers)
    .where(and(eq(loungeMembers.loungeId, loungeId), eq(loungeMembers.userId, userId)))
    .limit(1);

  if (!existing) {
    await db.insert(loungeMembers).values({
      loungeId,
      userId,
      role,
      status: 'active',
    });
    return;
  }

  if (existing.role !== role || existing.status !== 'active') {
    await db
      .update(loungeMembers)
      .set({ role, status: 'active' })
      .where(eq(loungeMembers.id, existing.id));
  }
}

/**
 * Persist Velum lounge staff: CLI/LOGIN → owner membership, SUPPORT → admin.
 * Primary lounges.owner_id stays the first CLI_ADMIN (id 1 / midnight) when present.
 */
export async function ensureVelumLoungeStaffMembership() {
  try {
    const [master] = await db
      .select()
      .from(lounges)
      .where(eq(lounges.slug, 'velum_master_lounge'))
      .limit(1);
    if (!master) return;

    const ownerUsers = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(inArray(users.role, [...VELUM_LOUNGE_OWNER_SYSTEM_ROLES]));

    const adminUsers = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(inArray(users.role, [...VELUM_LOUNGE_ADMIN_SYSTEM_ROLES]));

    for (const u of ownerUsers) {
      await upsertLoungeMembership(master.id, u.id, 'owner');
    }
    for (const u of adminUsers) {
      await upsertLoungeMembership(master.id, u.id, 'admin');
    }

    const primaryOwner =
      ownerUsers.find((u) => u.id === 1) ||
      ownerUsers.find((u) => u.role === 'CLI_ADMIN') ||
      ownerUsers[0];

    if (primaryOwner && master.ownerId !== primaryOwner.id) {
      await db
        .update(lounges)
        .set({ ownerId: primaryOwner.id, updatedAt: new Date() })
        .where(eq(lounges.id, master.id));
    }
  } catch (err) {
    console.error('[LoungeSeeder] Staff membership seed error:', err);
  }
}

export async function ensureVelumLoungeSeeded() {
  if (!isSeeded) {
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

      CREATE TABLE IF NOT EXISTS media_assets (
        id SERIAL PRIMARY KEY,
        uploader_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        storage_key TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        mime_type VARCHAR(128) NOT NULL,
        byte_size INTEGER NOT NULL,
        category VARCHAR(32) NOT NULL,
        sha256 VARCHAR(64),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_media_assets_uploader ON media_assets (uploader_id);
      CREATE INDEX IF NOT EXISTS idx_media_assets_category ON media_assets (category);
      CREATE INDEX IF NOT EXISTS idx_media_assets_storage_key ON media_assets (storage_key);
      CREATE INDEX IF NOT EXISTS idx_media_assets_relative_path ON media_assets (relative_path);

      CREATE TABLE IF NOT EXISTS dm_reactions (
        id SERIAL PRIMARY KEY,
        message_id INTEGER REFERENCES dms(id) ON DELETE CASCADE NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        emoji VARCHAR(32) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS unique_dm_user_emoji ON dm_reactions (message_id, user_id, emoji);
      CREATE INDEX IF NOT EXISTS idx_dm_reactions_message ON dm_reactions (message_id);
    `);

      await db.execute(sql`
      UPDATE lounges SET slug = 'velum_master_lounge' WHERE id = 1 AND (slug = 'velum_lounge' OR slug IS NULL);
    `);

      let [master] = await db.select().from(lounges).where(eq(lounges.id, 1));
      if (!master) {
        const [inserted] = await db.insert(lounges).values({
          id: 1,
          slug: 'velum_master_lounge',
          name: 'Velum Lounge',
          description: 'Velum Lounge',
          isOfficial: true,
          isSystem: true,
          isPrivate: false,
          type: 'official',
          accessLevel: 'ALL'
        }).onConflictDoNothing().returning();
        master = inserted || (await db.select().from(lounges).where(eq(lounges.id, 1)))[0];
      }

      for (const sub of OFFICIAL_SUBLOUNGES) {
        const [existing] = await db.select().from(lounges).where(eq(lounges.id, sub.id));
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

      // Advance sequence past reserved official lounge IDs (1-11) so user-created lounges start at 1000+
      await db.execute(sql`
      SELECT setval(
        pg_get_serial_sequence('lounges', 'id'),
        GREATEST((SELECT COALESCE(MAX(id), 1) FROM lounges), ${MIN_PUBLIC_LOUNGE_ID}),
        true
      );
    `);

      await deduplicateSublounges();

      isSeeded = true;
    } catch (err) {
      console.error('[LoungeSeeder] Seeding error:', err);
    }
  }

  // Always re-sync staff roles (CLI/LOGIN owners, SUPPORT admin) after lounge exists.
  await ensureVelumLoungeStaffMembership();
}
