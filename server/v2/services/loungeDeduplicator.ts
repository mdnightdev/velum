import { db } from '../db/client.js';
import { lounges, loungeMembers, messages } from '../db/schema/lounges.js';
import { eq, inArray, isNotNull, isNull, and } from 'drizzle-orm';

/**
 * Self-healing routine: scans for duplicate sublounges (same parentLoungeId + name)
 * and duplicate top-level user lounges (same ownerId + name) created via race conditions/spam clicks.
 * Preserves the earliest created record and safely removes extra duplicates and their orphaned data.
 */
export async function deduplicateSublounges(): Promise<{ deletedSublounges: number; deletedLounges: number }> {
  let deletedSubloungesCount = 0;
  let deletedLoungesCount = 0;

  try {
    const allLounges = await db.select().from(lounges);

    // 1. Group sublounges by (parentLoungeId + name.toLowerCase())
    const subloungeGroups = new Map<string, typeof allLounges>();

    for (const l of allLounges) {
      if (l.parentLoungeId) {
        const key = `${l.parentLoungeId}_${l.name.trim().toLowerCase()}`;
        const list = subloungeGroups.get(key) || [];
        list.push(l);
        subloungeGroups.set(key, list);
      }
    }

    // Process duplicate sublounges
    for (const [, items] of subloungeGroups.entries()) {
      if (items.length > 1) {
        // Sort by ID ascending (earliest created first)
        items.sort((a, b) => a.id - b.id);
        const [original, ...duplicates] = items;
        const dupIds = duplicates.map(d => d.id);

        if (dupIds.length > 0) {
          // Delete messages in duplicate sublounges
          await db.delete(messages).where(inArray(messages.loungeId, dupIds));
          // Delete memberships in duplicate sublounges
          await db.delete(loungeMembers).where(inArray(loungeMembers.loungeId, dupIds));
          // Delete duplicate sublounges
          await db.delete(lounges).where(inArray(lounges.id, dupIds));

          deletedSubloungesCount += dupIds.length;
          console.log(`[Deduplicator] Self-healed ${dupIds.length} duplicate sublounges for parent ${original.parentLoungeId} ("${original.name}")`);
        }
      }
    }

    // 2. Group top-level user-created lounges by (ownerId + name.toLowerCase())
    const topLoungeGroups = new Map<string, typeof allLounges>();

    for (const l of allLounges) {
      if (!l.parentLoungeId && l.type === 'user_created' && l.ownerId) {
        const key = `${l.ownerId}_${l.name.trim().toLowerCase()}`;
        const list = topLoungeGroups.get(key) || [];
        list.push(l);
        topLoungeGroups.set(key, list);
      }
    }

    // Process duplicate top-level user lounges
    for (const [, items] of topLoungeGroups.entries()) {
      if (items.length > 1) {
        items.sort((a, b) => a.id - b.id);
        const [original, ...duplicates] = items;
        const dupIds = duplicates.map(d => d.id);

        if (dupIds.length > 0) {
          // Find sublounges of duplicate top lounges and delete them too
          const childSubs = allLounges.filter(l => l.parentLoungeId && dupIds.includes(l.parentLoungeId));
          const childSubIds = childSubs.map(cs => cs.id);
          const allTargetIds = [...dupIds, ...childSubIds];

          if (allTargetIds.length > 0) {
            await db.delete(messages).where(inArray(messages.loungeId, allTargetIds));
            await db.delete(loungeMembers).where(inArray(loungeMembers.loungeId, allTargetIds));
            await db.delete(lounges).where(inArray(lounges.id, allTargetIds));
          }

          deletedLoungesCount += dupIds.length;
          console.log(`[Deduplicator] Self-healed ${dupIds.length} duplicate top-level lounges for user ${original.ownerId} ("${original.name}")`);
        }
      }
    }
  } catch (err) {
    console.error('[Deduplicator] Error during deduplication:', err);
  }

  return { deletedSublounges: deletedSubloungesCount, deletedLounges: deletedLoungesCount };
}
