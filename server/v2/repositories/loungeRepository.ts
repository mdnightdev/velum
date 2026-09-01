import { eq, and, desc, sql } from 'drizzle-orm';
import { db, executeWithRetry } from '../db/client.js';
import { lounges, loungeMembers, type Lounge, type NewLounge, type LoungeMember, type NewLoungeMember } from '../db/schema/index.js';

export class LoungeRepository {
  async findAll(): Promise<Lounge[]> {
    return executeWithRetry(async () => {
      return db.select().from(lounges);
    });
  }

  async findById(id: number): Promise<Lounge | null> {
    return executeWithRetry(async () => {
      const results = await db.select().from(lounges).where(eq(lounges.id, id)).limit(1);
      return results[0] || null;
    });
  }

  async findBySlug(slug: string): Promise<Lounge | null> {
    return executeWithRetry(async () => {
      const results = await db.select().from(lounges).where(eq(lounges.slug, slug)).limit(1);
      return results[0] || null;
    });
  }

  async findOfficial(): Promise<Lounge[]> {
    return executeWithRetry(async () => {
      return db.select().from(lounges).where(eq(lounges.isOfficial, true));
    });
  }

  async findByOwnerId(ownerId: number): Promise<Lounge[]> {
    return executeWithRetry(async () => {
      return db.select().from(lounges).where(eq(lounges.ownerId, ownerId));
    });
  }

  async findSublounges(parentLoungeId: number): Promise<Lounge[]> {
    return executeWithRetry(async () => {
      return db.select().from(lounges).where(eq(lounges.parentLoungeId, parentLoungeId));
    });
  }

  async create(data: NewLounge): Promise<Lounge> {
    return executeWithRetry(async () => {
      const inserted = await db.insert(lounges).values(data).returning();
      return inserted[0];
    });
  }

  async update(id: number, data: Partial<NewLounge>): Promise<Lounge | null> {
    return executeWithRetry(async () => {
      const updated = await db
        .update(lounges)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(lounges.id, id))
        .returning();
      return updated[0] || null;
    });
  }

  async delete(id: number): Promise<boolean> {
    return executeWithRetry(async () => {
      const deleted = await db.delete(lounges).where(eq(lounges.id, id)).returning();
      return deleted.length > 0;
    });
  }

  // Lounge Memberships
  async findMembers(loungeId: number): Promise<LoungeMember[]> {
    return executeWithRetry(async () => {
      return db.select().from(loungeMembers).where(eq(loungeMembers.loungeId, loungeId));
    });
  }

  async findMembership(loungeId: number, userId: number): Promise<LoungeMember | null> {
    return executeWithRetry(async () => {
      const results = await db
        .select()
        .from(loungeMembers)
        .where(and(eq(loungeMembers.loungeId, loungeId), eq(loungeMembers.userId, userId)))
        .limit(1);
      return results[0] || null;
    });
  }

  async addMember(data: NewLoungeMember): Promise<LoungeMember> {
    return executeWithRetry(async () => {
      const inserted = await db.insert(loungeMembers).values(data).returning();
      return inserted[0];
    });
  }

  async removeMember(loungeId: number, userId: number): Promise<boolean> {
    return executeWithRetry(async () => {
      const deleted = await db
        .delete(loungeMembers)
        .where(and(eq(loungeMembers.loungeId, loungeId), eq(loungeMembers.userId, userId)))
        .returning();
      return deleted.length > 0;
    });
  }
}

export const loungeRepository = new LoungeRepository();
