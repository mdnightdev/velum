import { and, eq, or, sql } from 'drizzle-orm';
import { db, executeWithRetry } from '../db/client.js';
import { userBlocks } from '../db/schema/user_blocks.js';
import { relationships } from '../db/schema/relationships.js';
import { logger } from '../utils/logger.js';
import { blockedSendErrorMessage } from '../utils/blockCopy.js';

export type BlockPairState = {
  blocked: boolean;
  iBlocked: boolean;
  theyBlocked: boolean;
};

export { blockedSendErrorMessage };

let tableReady: Promise<void> | null = null;

export async function ensureUserBlocksTable(): Promise<void> {
  if (!tableReady) {
    tableReady = executeWithRetry(async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS user_blocks (
          id SERIAL PRIMARY KEY,
          blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_blocks_pair ON user_blocks (blocker_id, blocked_id)`
      );
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks (blocker_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks (blocked_id)`);

      // Migrate legacy relationships.status='blocked' → directional rows, restore friendship
      const legacy = await db
        .select()
        .from(relationships)
        .where(eq(relationships.status, 'blocked'));
      for (const row of legacy) {
        await db
          .insert(userBlocks)
          .values({ blockerId: row.userId, blockedId: row.friendId })
          .onConflictDoNothing({ target: [userBlocks.blockerId, userBlocks.blockedId] });
        await db
          .update(relationships)
          .set({ status: 'accepted', updatedAt: new Date() })
          .where(eq(relationships.id, row.id));
      }
      if (legacy.length > 0) {
        logger.info('Migrated legacy relationship blocks to user_blocks', { count: legacy.length });
      }
    }).catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  await tableReady;
}

export async function hasBlocked(blockerId: number, blockedId: number): Promise<boolean> {
  await ensureUserBlocksTable();
  const rows = await executeWithRetry(async () => {
    return db
      .select({ id: userBlocks.id })
      .from(userBlocks)
      .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)))
      .limit(1);
  });
  return rows.length > 0;
}

export async function getBlockPairState(viewerId: number, peerId: number): Promise<BlockPairState> {
  await ensureUserBlocksTable();
  const rows = await executeWithRetry(async () => {
    return db
      .select()
      .from(userBlocks)
      .where(
        or(
          and(eq(userBlocks.blockerId, viewerId), eq(userBlocks.blockedId, peerId)),
          and(eq(userBlocks.blockerId, peerId), eq(userBlocks.blockedId, viewerId))
        )
      );
  });
  const iBlocked = rows.some((r) => r.blockerId === viewerId && r.blockedId === peerId);
  const theyBlocked = rows.some((r) => r.blockerId === peerId && r.blockedId === viewerId);
  return { blocked: iBlocked || theyBlocked, iBlocked, theyBlocked };
}

/** Either direction blocks messaging both ways. */
export async function isBlockedBetween(userA: number, userB: number): Promise<boolean> {
  const state = await getBlockPairState(userA, userB);
  return state.blocked;
}

export async function blockUser(blockerId: number, blockedId: number): Promise<void> {
  if (blockerId === blockedId) throw new Error('CANNOT_BLOCK_SELF');
  await ensureUserBlocksTable();
  await executeWithRetry(async () => {
    await db
      .insert(userBlocks)
      .values({ blockerId, blockedId })
      .onConflictDoNothing({ target: [userBlocks.blockerId, userBlocks.blockedId] });
  });
}

export async function unblockUser(blockerId: number, blockedId: number): Promise<boolean> {
  await ensureUserBlocksTable();
  const deleted = await executeWithRetry(async () => {
    return db
      .delete(userBlocks)
      .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)))
      .returning({ id: userBlocks.id });
  });
  return deleted.length > 0;
}

/** Toggle only the viewer's directional block. Returns whether viewer now blocks peer. */
export async function toggleBlock(viewerId: number, peerId: number): Promise<boolean> {
  const already = await hasBlocked(viewerId, peerId);
  if (already) {
    await unblockUser(viewerId, peerId);
    return false;
  }
  await blockUser(viewerId, peerId);
  return true;
}
